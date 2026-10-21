// cloudbase/ask/index.js
// 权益广场 · AI 资源检索云函数（腾讯云 CloudBase，通过 HTTP 网关访问）
//
// 设计要点：
//   1. API Key 只存在于云函数环境变量 DEEPSEEK_API_KEY，前端永远接触不到；
//   2. 系统提示词从同目录 ai-prompt.txt 读取 —— 由 tools/build-ai-prompt.mjs 生成。
//      内容固定才能命中大模型的上下文缓存（输入成本降到 1/50）；
//   3. ★ 最关键的一道防护：返回的资源标题必须真实存在于资源库，否则丢弃。
//      即使模型编造了不存在的资源，也到不了用户眼前；
//   4. 限频：同一来源 IP 每天最多 N 次，防止被刷。
//
// 注意 event 的结构（依据 CloudBase 官方文档「通过 HTTP 访问云函数」）：
//   通过 HTTP 网关调用时，event 形如
//   { path, httpMethod, headers, queryStringParameters, body, isBase64Encoded, requestContext }
//   用户的问题在 body（字符串）里，不是 event.question。

const fs = require('fs');
const path = require('path');

const RES_FILE = path.join(__dirname, 'resources.json');
const PROMPT_FILE = path.join(__dirname, 'ai-prompt.txt');

const DAILY_LIMIT = 20;              // 每个 IP 每天最多提问次数
const MODEL = 'deepseek-flash';
const API_URL = 'https://api.deepseek.com/chat/completions';

// 允许的来源。静态站是 https://zmh090523-arch.github.io，
// 本地用 file:// 或 localhost 调试时是 null/其他值 —— 这里放宽，因为接口本身有鉴权与限频。
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

function reply(obj, statusCode) {
  return {
    statusCode: statusCode || 200,
    headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, CORS),
    body: JSON.stringify(obj),
  };
}

// 简易内存限流（云函数实例复用期间有效；重启后清零，够用）
const usage = new Map();

function dayKey() {
  const d = new Date();
  return d.getUTCFullYear() + '-' + (d.getUTCMonth() + 1) + '-' + d.getUTCDate();
}

function checkRate(ip) {
  const key = ip + '|' + dayKey();
  const n = usage.get(key) || 0;
  if (n >= DAILY_LIMIT) return false;
  usage.set(key, n + 1);
  if (usage.size > 5000) {
    for (const k of usage.keys()) if (!k.endsWith(dayKey())) usage.delete(k);
  }
  return true;
}

let cachedPrompt = null;
let validTitles = null;
let titleToUrl = null;

function loadAssets() {
  if (!cachedPrompt) cachedPrompt = fs.readFileSync(PROMPT_FILE, 'utf8');
  if (!validTitles) {
    const doc = JSON.parse(fs.readFileSync(RES_FILE, 'utf8'));
    validTitles = new Set(doc.resources.map((r) => r.title));
    titleToUrl = new Map(doc.resources.map((r) => [r.title, r.url]));
  }
}

// 供测试直接调用：传入"模型返回的文本"，返回经过校验的结果
function parseAndValidate(content) {
  let out;
  try {
    out = JSON.parse(content);
  } catch (e) {
    return { ok: false, error: 'AI 返回的不是合法 JSON' };
  }
  if (!out || typeof out !== 'object') return { ok: false, error: 'AI 没有给出回答' };
  const answer = typeof out.answer === 'string' ? out.answer.trim() : '';
  if (!answer) return { ok: false, error: 'AI 没有给出回答' };

  const raw = Array.isArray(out.resources) ? out.resources : [];
  const seen = new Set();
  const kept = [];
  let dropped = 0;
  for (const r of raw) {
    const title = r && typeof r.title === 'string' ? r.title.trim() : '';
    if (!title) continue;
    // ★ 核心防护：编造的标题一律丢弃
    if (!validTitles.has(title)) { dropped++; continue; }
    if (seen.has(title)) continue;
    seen.add(title);
    kept.push({
      title,
      reason: (r.reason && String(r.reason).trim()) || '',
      url: titleToUrl.get(title) || '',
    });
  }
  return { ok: true, answer, resources: kept, droppedCount: dropped };
}

// 从 HTTP 事件中取出用户问题（兼容多种调用方式，便于调试）
function extractQuestion(event) {
  if (!event) return '';
  // 1) 直接调用（云函数控制台测试、SDK 调用）
  if (typeof event.question === 'string') return event.question;
  // 2) HTTP 网关：body 是字符串
  if (typeof event.body === 'string' && event.body) {
    let raw = event.body;
    if (event.isBase64Encoded) {
      try { raw = Buffer.from(raw, 'base64').toString('utf8'); } catch (e) { /* 忽略 */ }
    }
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.question === 'string') return parsed.question;
    } catch (e) { /* body 不是 JSON，就当纯文本 */ }
    return raw;
  }
  // 3) HTTP 网关：body 已被解析成对象
  if (event.body && typeof event.body === 'object' && typeof event.body.question === 'string') {
    return event.body.question;
  }
  return '';
}

function extractIp(event, context) {
  const rc = event && event.requestContext;
  if (rc) {
    if (typeof rc.clientIP === 'string') return rc.clientIP;
    if (rc.sourceIp) return rc.sourceIp;
    if (rc.identity && rc.identity.sourceIp) return rc.identity.sourceIp;
  }
  const h = (event && event.headers) || {};
  // 注意 header 名大小写不固定
  for (const k of Object.keys(h)) {
    if (k.toLowerCase() === 'x-forwarded-for') {
      return String(h[k]).split(',')[0].trim();
    }
  }
  if (context && context.clientIP) return context.clientIP;
  return 'unknown';
}

async function callDeepSeek(question) {
  const body = {
    model: MODEL,
    messages: [
      { role: 'system', content: cachedPrompt },
      { role: 'user', content: question },
    ],
    response_format: { type: 'json_object' },
    stream: false,
  };
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + process.env.DEEPSEEK_API_KEY,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error('DeepSeek HTTP ' + res.status + ': ' + t.slice(0, 200));
  }
  const data = await res.json();
  return data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content : '';
}

async function handle(event, context) {
  loadAssets();

  if (event && event.httpMethod === 'OPTIONS') return reply({ ok: true });

  const question = String(extractQuestion(event)).slice(0, 300).trim();
  if (!question) return reply({ ok: false, error: '请描述一下你要找什么' }, 400);

  const ip = extractIp(event, context);
  if (!checkRate(ip)) {
    return reply({ ok: false, error: '今天的提问次数用完了（每天 ' + DAILY_LIMIT + ' 次），明天再来' }, 429);
  }

  if (!process.env.DEEPSEEK_API_KEY) {
    return reply({ ok: false, error: '服务端未配置 API Key' }, 500);
  }

  let content;
  try {
    content = await callDeepSeek(question);
  } catch (e) {
    return reply({ ok: false, error: 'AI 服务暂时不可用：' + e.message }, 502);
  }

  const result = parseAndValidate(content);
  return reply(result, result.ok ? 200 : 502);
}

exports.main = async (event, context) => handle(event, context);

// 供本地测试使用
exports.parseAndValidate = parseAndValidate;
exports.extractQuestion = extractQuestion;
exports.extractIp = extractIp;
exports._loadAssets = () => {
  loadAssets();
  return { promptLen: cachedPrompt ? cachedPrompt.length : 0, titles: validTitles ? validTitles.size : 0 };
};
// 便于测试在无 Key 情况下跑通主流程
exports._setPrompt = (p) => { cachedPrompt = p; };
