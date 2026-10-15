// tools/build-index.mjs
// 用途：以 resources.json / guides.json / skills.json 为唯一数据源，
//       重建 index.html 中 DATA:BEGIN 与 DATA:END 之间的全部内容。
//
// 设计原则（对应规范"资源不能全部写死在 HTML / 不破坏现有功能"）：
//   1. 三个 JSON 是唯一数据源；DATA 区里的一切都是"构建产物"；
//   2. 仍然内嵌数据，保证 file:// 打开或 fetch 失败时页面照常工作；
//   3. 只替换 DATA 区，其余字节原样保留；
//   4. 幂等：连续运行两次结果完全相同。
//
// 用法: node tools/build-index.mjs [resources.json] [guides.json] [skills.json] [index.html]

import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const ROOT = process.cwd();
const RES_FILE = process.argv[2] || path.join(ROOT, 'resources.json');
const GUI_FILE = process.argv[3] || path.join(ROOT, 'guides.json');
const SKI_FILE = process.argv[4] || path.join(ROOT, 'skills.json');
const HTML_FILE = process.argv[5] || path.join(ROOT, 'index.html');

const BEGIN = '/* ===== DATA:BEGIN ===== */';
const END = '/* ===== DATA:END ===== */';
const DECL = 'const RESOURCES = [';
const G_DECL = 'const GUIDES = ';
const S_DECL = 'const SKILLS = ';

const sha = (s) => createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 16);
const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, ' ');

// ---------- 1) 资源数组（紧凑行格式，便于人工核对与 diff） ----------
const resDoc = JSON.parse(await readFile(RES_FILE, 'utf8'));
const list = resDoc.resources;
if (!Array.isArray(list) || list.length === 0) throw new Error('resources.json 里没有 resources 数组');

const resBody = list.map((r, i) => {
  if (!r.title || !r.url) throw new Error('第 ' + (i + 1) + ' 条缺 title 或 url');
  const tags = Array.isArray(r.tags) && r.tags.length ? ', tags: [' + r.tags.map((t) => '"' + esc(t) + '"').join(', ') + ']' : '';
  const src = r.source ? ', source: "' + esc(r.source) + '"' : '';
  const sub = r.subcategory ? ', subcategory: "' + esc(r.subcategory) + '"' : '';
  // 详情页要展示的字段必须一并内嵌，否则离线打开时"使用条件"会全部退化成"未核验"，
  // 把有值的数据谎报成未核验 —— 这比字段缺失更糟。这里显式列出，新增字段时记得同步。
  const DETAIL_FIELDS = ['cost', 'language_support', 'account_requirement', 'student_requirement',
    'network_requirement', 'hardware_requirement', 'verification_status', 'last_verified'];
  let extra = '';
  for (const f of DETAIL_FIELDS) {
    const v = r[f];
    if (v !== undefined && v !== null && String(v).trim() !== '') extra += ', ' + f + ': "' + esc(v) + '"';
  }
  return '  { name: "' + esc(r.title) + '", url: "' + esc(r.url) + '", description: "' + esc(r.description || '') +
    '", category: "' + esc(r.category || '') + '", icon: "' + esc(r.icon || '') +
    '", free: ' + (r.free ? 'true' : 'false') + tags + src + sub + extra + ' }' + (i < list.length - 1 ? ',' : '');
}).join('\n');

// ---------- 2) 指南与技能（JSON 直接内嵌，保留结构） ----------
const guidesDoc = JSON.parse(await readFile(GUI_FILE, 'utf8'));
const skillsDoc = JSON.parse(await readFile(SKI_FILE, 'utf8'));
if (!Array.isArray(guidesDoc.guides) || !guidesDoc.guides.length) throw new Error('guides.json 里没有 guides 数组');
if (!Array.isArray(skillsDoc.groups) || !skillsDoc.groups.length) throw new Error('skills.json 里没有 groups 数组');

const DATA_BLOCK =
  '/* ===== 以下内容由 tools/build-index.mjs 自 resources.json / guides.json / skills.json 生成，请勿手工编辑 ===== */\n' +
  '/* 要改资源改 resources.json，要改学习路径改 guides.json，要改技能表改 skills.json，然后重新运行该脚本。 */\n' +
  '\n' +
  '/* 内嵌数据用于兜底：file:// 直接打开或网络异常时页面依然可正常显示。 */\n' +
  DECL + '\n' + resBody + '\n];\n' +
  '\n' +
  G_DECL + JSON.stringify(guidesDoc.guides, null, 2) + ';\n' +
  '\n' +
  S_DECL + JSON.stringify(skillsDoc.groups, null, 2) + ';\n';

// ---------- 3) 读页面并重建 DATA 区 ----------
const html = await readFile(HTML_FILE, 'utf8');
const b = html.indexOf(BEGIN);
const e = html.indexOf(END);
if (b < 0 || e < 0) throw new Error('找不到 DATA 标记，请先确认 index.html 已加上 ' + BEGIN + ' / ' + END);
if (e < b) throw new Error('DATA 标记顺序异常');

const before = html.slice(0, b + BEGIN.length);
const oldInner = html.slice(b + BEGIN.length, e);
const after = html.slice(e);
const out = before + '\n' + DATA_BLOCK + after;

// ---------- 4) 写回 + 报告 ----------
await writeFile(HTML_FILE, out, 'utf8');

const guideRefs = guidesDoc.guides.reduce((n, g) =>
  n + g.steps.reduce((m, s) => m + s.blocks.reduce((k, bl) => k + (bl.type === 'resources' ? bl.items.length : 0), 0), 0), 0);
const skillItems = skillsDoc.groups.reduce((n, g) => n + g.items.length, 0);

console.log('数据源 : ' + RES_FILE + '  (' + list.length + ' 条, sha ' + sha(await readFile(RES_FILE, 'utf8')) + ')');
console.log('        ' + GUI_FILE + '  (' + guidesDoc.guides.length + ' 条指南 / ' + guideRefs + ' 个资源条目，同一资源在多条指南中会重复计数)');
console.log('        ' + SKI_FILE + '  (' + skillsDoc.groups.length + ' 组 / ' + skillItems + ' 项技能)');
console.log('页面   : ' + HTML_FILE);
console.log('DATA 区: ' + oldInner.length + ' 字节  ->  ' + DATA_BLOCK.length + ' 字节');
console.log('页面   : ' + html.length + ' 字节  ->  ' + out.length + ' 字节');
console.log('内嵌条数: ' + list.length + '  (免费 ' + list.filter((r) => r.free).length + ')');
console.log('完成。');
