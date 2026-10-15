// cloudbase/ask/index.js
// 拾学集 · AI 资源检索云函数（腾讯云 CloudBase）
//
// 设计要点：
//   1. API Key 只存在于云函数环境变量 DEEPSEEK_API_KEY，前端永远接触不到；
//   2. 系统提示词从同目录 ai-prompt.txt 读取 —— 它由 tools/build-ai-prompt.mjs 生成，
//      内容固定才能命中大模型的上下文缓存（输入成本降到 1/50）；
//   3. 最关键的一道防护：返回的资源标题必须真实存在于资源库，否则丢弃。
//      即使模型编造了不存在的资源，也到不了用户眼前。
//   4. 限频：同一来源 IP 每天最多 N 次，防止被刷。

const fs = require('fs');
const path = require('path');

const RES_FILE = path.join(__dirname, 'resources.json');
const PROMPT_FILE = path.join(__dirname, 'ai-prompt.txt');

const DAILY_LIMIT = 20;              // 每个 IP 每天最多提问次数
const MODEL = 'deepseek-flash';
const API_URL = 'https://api.deepseek.com/chat/completions';

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
  // 顺手清掉昨天的记录，避免无限增长
  if (usage.size > 5000) {
    for (const k of usage.keys()) if (!k.endsWith(dayKey())) usage.delete(k);
  }
  return true;
}

let cachedPrompt = null;
let validTitles = null;

function loadAssets() {
  if (!cachedPrompt) cachedPrompt = fs.readFileSync(PROMPT_FILE, 'utf8');
  if (!validTitles) {
    const doc = JSON.parse(fs.readFileSync(RES_FILE, 'utf8'));
    validTitles = new Set(doc.resources.map((r) => r.title));
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
      url: urlOf(title),
    });
  }
  return { ok: true, answer, resources: kept, droppedCount: dropped };
}

let titleToUrl = null;
function urlOf(title) {
  if (!titleToUrl) {
    const doc = JSON.parse(fs.readFileSync(RES_FILE, 'utf8'));
    titleToUrl = new Map(doc.resources.map((r) => [r.title, r.url]));
  }
  return titleToUrl.get(title) || '';
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

exports.main = async (event, context) => {
  loadAssets();

  const question = String((event && event.question) || '').slice(0, 300).trim();
  if (!question) return { ok: false, error: '请描述一下你要找什么' };

  const ip = (context && (context.clientIP || context.sourceIp)) ||
    (event && event.clientIP) || 'unknown';
  if (!checkRate(ip)) {
    return { ok: false, error: '今天的提问次数用完了（每天 ' + DAILY_LIMIT + ' 次），明天再来' };
  }

  if (!process.env.DEEPSEEK_API_KEY) {
    return { ok: false, error: '服务端未配置 API Key' };
  }

  let content;
  try {
    content = await callDeepSeek(question);
  } catch (e) {
    return { ok: false, error: 'AI 服务暂时不可用：' + e.message };
  }

  return parseAndValidate(content);
};

// 供本地测试使用
exports.parseAndValidate = parseAndValidate;
exports._loadAssets = () => { loadAssets(); return { promptLen: cachedPrompt ? cachedPrompt.length : 0, titles: validTitles ? validTitles.size : 0 }; };
