// tools/build-index.mjs
// 用途：以 resources.json 为唯一数据源，重建 index.html 中
//       DATA:BEGIN 与 DATA:END 之间的内嵌资源数组。
//
// 设计原则：
//   1. resources.json 是唯一数据源，DATA 区里的一切都是"构建产物"；
//   2. 仍然内嵌数据，保证 file:// 直接打开或 fetch 失败时页面照常工作；
//   3. 只替换 DATA 区，其余字节原样保留；
//   4. 幂等：连续运行两次结果完全相同。
//
// 变更说明（2026-10）：学习资源功能（guides/skills/exams）已整体移除，
// 本脚本不再读取 guides.json / skills.json。
//
// 用法: node tools/build-index.mjs [resources.json] [index.html]

import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const ROOT = process.cwd();
const RES_FILE = process.argv[2] || path.join(ROOT, 'resources.json');
const HTML_FILE = process.argv[3] || path.join(ROOT, 'index.html');

const BEGIN = '/* ===== DATA:BEGIN ===== */';
const END = '/* ===== DATA:END ===== */';
const DECL = 'const RESOURCES = [';

const sha = (s) => createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 16);
const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, ' ');

// ---------- 1) 校验数据源 ----------
const resDoc = JSON.parse(await readFile(RES_FILE, 'utf8'));
const list = resDoc.resources;
if (!Array.isArray(list) || list.length === 0) throw new Error('resources.json 里没有 resources 数组');
if (resDoc._count !== list.length) {
  throw new Error('resources.json 的 _count(' + resDoc._count + ') 与实际条数(' + list.length + ') 不一致');
}

// ---------- 2) 生成资源数组（紧凑行格式，便于 diff） ----------
const DETAIL_FIELDS = ['cost', 'language_support', 'account_requirement', 'student_requirement',
  'network_requirement', 'hardware_requirement', 'verification_status', 'last_verified',
  'alternative_resources'];

const resBody = list.map((r, i) => {
  if (!r.title || !r.url) throw new Error('第 ' + (i + 1) + ' 条缺 title 或 url');
  const tags = Array.isArray(r.tags) && r.tags.length
    ? ', tags: [' + r.tags.map((t) => '"' + esc(t) + '"').join(', ') + ']' : '';
  const src = r.source ? ', source: "' + esc(r.source) + '"' : '';
  const sub = r.subcategory ? ', subcategory: "' + esc(r.subcategory) + '"' : '';
  let extra = '';
  for (const f of DETAIL_FIELDS) {
    const v = r[f];
    if (v !== undefined && v !== null && String(v).trim() !== '') extra += ', ' + f + ': "' + esc(v) + '"';
  }
  return '  { name: "' + esc(r.title) + '", url: "' + esc(r.url) + '", description: "' + esc(r.description || '') +
    '", category: "' + esc(r.category || '') + '", icon: "' + esc(r.icon || '') +
    '", free: ' + (r.free ? 'true' : 'false') + tags + src + sub + extra + ' }' + (i < list.length - 1 ? ',' : '');
}).join('\n');

const digest = sha(JSON.stringify(list));
const freeCount = list.filter((r) => r.free).length;

const DATA_BLOCK =
  '/* ===== 以下内容由 tools/build-index.mjs 自 resources.json 生成，请勿手工编辑 ===== */\n' +
  '/* 要改资源请改 resources.json，然后运行：node tools/build-index.mjs */\n' +
  '\n' +
  '/* 内嵌数据用于兜底：file:// 直接打开或网络异常时页面依然可正常显示。 */\n' +
  'const RES_SHA = "' + digest + '";   // 与 resources.json 同步时校验用\n' +
  DECL + '\n' + resBody + '\n];\n';

// ---------- 3) 重建 DATA 区 ----------
const html = await readFile(HTML_FILE, 'utf8');
const b = html.indexOf(BEGIN);
const e = html.indexOf(END);
if (b < 0 || e < 0) throw new Error('找不到 DATA 标记，请先确认 index.html 已加上 ' + BEGIN + ' / ' + END);
if (e < b) throw new Error('DATA 标记顺序异常');

const oldInner = html.slice(b + BEGIN.length, e);
const out = html.slice(0, b + BEGIN.length) + '\n' + DATA_BLOCK + html.slice(e);

// ---------- 4) 写回 + 报告 ----------
await writeFile(HTML_FILE, out, 'utf8');

console.log('数据源 : ' + RES_FILE + '  (' + list.length + ' 条, sha ' + digest + ')');
console.log('页面   : ' + HTML_FILE);
console.log('DATA 区: ' + oldInner.length + ' 字节  ->  ' + DATA_BLOCK.length + ' 字节');
console.log('内嵌条数: ' + list.length + '  (免费 ' + freeCount + ')');
console.log('完成。');
