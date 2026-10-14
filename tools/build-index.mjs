// tools/build-index.mjs
// 用途：以 resources.json 为唯一数据源，把资源注入 index.html 的 DATA 区块。
//
// 设计原则（对应规范"资源不能全部写死在 HTML / 不破坏现有功能"）：
//   1. resources.json 是唯一数据源；index.html 里的数组是"构建产物"；
//   2. 仍然内嵌一份数据，保证 file:// 打开或 fetch 失败时页面照常工作；
//   3. 只替换 DATA:BEGIN / DATA:END 之间的内容，其余字节原样保留；
//   4. 幂等：连续运行两次结果完全相同。
//
// 用法: node tools/build-index.mjs [resources.json] [index.html]

import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const ROOT = process.cwd();
const JSON_FILE = process.argv[2] || path.join(ROOT, 'resources.json');
const HTML_FILE = process.argv[3] || path.join(ROOT, 'index.html');

const BEGIN = '/* ===== DATA:BEGIN ===== */';
const END = '/* ===== DATA:END ===== */';
const DECL = 'const RESOURCES = [';

const sha = (s) => createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 16);

// 1) 读数据
const doc = JSON.parse(await readFile(JSON_FILE, 'utf8'));
const list = doc.resources;
if (!Array.isArray(list) || list.length === 0) throw new Error('resources.json 里没有 resources 数组');

// 2) 生成内嵌数组（输出顺序与键序固定，保证幂等）
const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, ' ');
const body = list.map((r, i) => {
  if (!r.title || !r.url) throw new Error('第 ' + (i + 1) + ' 条缺 title 或 url');
  const tags = Array.isArray(r.tags) && r.tags.length ? ', tags: [' + r.tags.map((t) => '"' + esc(t) + '"').join(', ') + ']' : '';
  const src = r.source ? ', source: "' + esc(r.source) + '"' : '';
  const sub = r.subcategory ? ', subcategory: "' + esc(r.subcategory) + '"' : '';
  return '  { name: "' + esc(r.title) + '", url: "' + esc(r.url) + '", description: "' + esc(r.description || '') +
    '", category: "' + esc(r.category || '') + '", icon: "' + esc(r.icon || '') +
    '", free: ' + (r.free ? 'true' : 'false') + tags + src + sub + ' }' + (i < list.length - 1 ? ',' : '');
}).join('\n');

const block = DECL + '\n' + body + '\n];';

// 3) 读页面并定位 DATA 区
const html = await readFile(HTML_FILE, 'utf8');
const b = html.indexOf(BEGIN);
const e = html.indexOf(END);
if (b < 0 || e < 0) throw new Error('找不到 DATA 标记，请先确认 index.html 已加上 ' + BEGIN + ' / ' + END);
if (e < b) throw new Error('DATA 标记顺序异常');

const before = html.slice(0, b + BEGIN.length);
const between = html.slice(b + BEGIN.length, e);
const after = html.slice(e);

// 4) 替换区内首个 `const RESOURCES = [ ... ];`
const declIdx = between.indexOf(DECL);
if (declIdx < 0) throw new Error('DATA 区内找不到 ' + DECL);
const declEnd = between.indexOf('\n];', declIdx);
if (declEnd < 0) throw new Error('DATA 区内找不到数组结束 `\\n];`');

const oldArray = between.slice(declIdx, declEnd + 3); // 含结束的 \n];
const newBetween = between.slice(0, declIdx) + block + between.slice(declEnd + 3);
const out = before + newBetween + after;

// 5) 写回 + 报告
await writeFile(HTML_FILE, out, 'utf8');

console.log('数据源 : ' + JSON_FILE + '  (' + list.length + ' 条, sha ' + sha(await readFile(JSON_FILE, 'utf8')) + ')');
console.log('页面   : ' + HTML_FILE);
console.log('替换   : ' + oldArray.length + ' 字节  ->  ' + block.length + ' 字节');
console.log('页面   : ' + html.length + ' 字节  ->  ' + out.length + ' 字节');
console.log('内嵌条数: ' + list.length + '  (免费 ' + list.filter((r) => r.free).length + ')');
console.log('完成。');
