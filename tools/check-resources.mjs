// 资源库自检闸门：任何对 resources.json 的改动都必须先过这一关。
// 用法: node check-resources.mjs <resources.json> [--expected-count N]
//
// 设计要点：本脚本同时兼容"当前 6 字段"与"规范 16 字段"两种状态，
// 因此阶段 2 扩容时无需改写闸门，只需观察"字段覆盖率"上升。
import { readFile } from 'node:fs/promises';

const FILE = process.argv[2];
const expIdx = process.argv.indexOf('--expected-count');
const EXPECTED = expIdx > -1 ? Number(process.argv[expIdx + 1]) : null;

// 规范《资源数据结构要求》定义的 16 个字段
const SPEC_FIELDS = ['title', 'description', 'category', 'tags', 'source', 'url', 'cost',
  'account_requirement', 'student_requirement', 'network_requirement', 'hardware_requirement',
  'language_support', 'quality_level', 'verification_status', 'last_verified', 'alternative_resources'];
// 最小必填（当前阶段）
const REQUIRED = ['title', 'description', 'category', 'url'];
const CATEGORIES = ['AI 与数据科学', '课程资料', '视频课程', '编程开发', '学术科研', '校内平台', '效率工具', '竞赛信息', '校园信息', '英语备考'];

const errors = [];
const warns = [];
const err = (m) => errors.push(m);
const warn = (m) => warns.push(m);

const raw = await readFile(FILE, 'utf8');
let doc;
try { doc = JSON.parse(raw); } catch (e) { console.error('JSON 解析失败: ' + e.message); process.exit(1); }

const list = doc.resources;
if (!Array.isArray(list)) { console.error('缺少 resources 数组'); process.exit(1); }

console.log('文件: ' + FILE);
console.log('条数: ' + list.length + (EXPECTED !== null ? '（期望 ' + EXPECTED + '）' : ''));
if (EXPECTED !== null && list.length !== EXPECTED) err('条数不符：实际 ' + list.length + '，期望 ' + EXPECTED);
if (doc._count !== undefined && doc._count !== list.length) err('_count 字段(' + doc._count + ')与实际条数(' + list.length + ')不一致');

// 1) 必填字段
list.forEach((r, i) => {
  const tag = '#' + (i + 1) + ' ' + (r.title || '(无标题)');
  for (const f of REQUIRED) {
    if (r[f] === undefined || r[f] === null || String(r[f]).trim() === '') err(tag + ' 缺少必填字段 ' + f);
  }
  if (r.description !== undefined && String(r.description).length > 120) warn(tag + ' 描述过长（' + String(r.description).length + ' 字），卡片会截断');
  if (r.free !== undefined && typeof r.free !== 'boolean') err(tag + ' free 必须是布尔值，实际 ' + typeof r.free);
});

// 2) 分类合法性 + 分布
const byCat = {};
list.forEach((r, i) => {
  if (!CATEGORIES.includes(r.category)) err('#' + (i + 1) + ' ' + r.title + ' 分类非法: ' + JSON.stringify(r.category));
  byCat[r.category] = (byCat[r.category] || 0) + 1;
});
console.log('\n分类分布:');
for (const c of CATEGORIES) console.log('  ' + c.padEnd(6) + ' ' + (byCat[c] || 0));
const emptyCats = CATEGORIES.filter((c) => !byCat[c]);
if (emptyCats.length) warn('空分类: ' + emptyCats.join(', '));

// 3) 重复检测
const seenUrl = new Map(); const seenTitle = new Map();
list.forEach((r, i) => {
  const u = String(r.url || '').replace(/\/+$/, '').toLowerCase();
  const t = String(r.title || '').trim().toLowerCase();
  if (seenUrl.has(u)) err('URL 重复: ' + r.title + ' 与 #' + seenUrl.get(u));
  else seenUrl.set(u, i + 1);
  if (seenTitle.has(t)) err('标题重复: ' + r.title);
  else seenTitle.set(t, i + 1);
});

// 4) URL 合法性 / 协议
list.forEach((r) => {
  let u;
  try { u = new URL(r.url); } catch { err(r.title + ' URL 非法: ' + r.url); return; }
  if (!['http:', 'https:'].includes(u.protocol)) err(r.title + ' 协议不支持: ' + u.protocol);
  if (u.protocol === 'http:') warn(r.title + ' 仍为 http://（站点本身是 HTTPS）: ' + r.url);
});

// 5) 规范 16 字段覆盖率（阶段 2 的进度指标）
console.log('\n规范字段覆盖率（阶段 2 进度）:');
let filledTotal = 0;
for (const f of SPEC_FIELDS) {
  let filled = 0;
  for (const r of list) {
    const v = r[f];
    const has = Array.isArray(v) ? v.length > 0 : (v !== undefined && v !== null && String(v).trim() !== '');
    if (has) filled++;
  }
  filledTotal += filled;
  const pct = ((filled / list.length) * 100).toFixed(0);
  console.log('  ' + f.padEnd(22) + String(filled).padStart(3) + '/' + list.length + '  ' + pct.padStart(3) + '%' + (filled === 0 ? '   ← 未实现' : ''));
}
console.log('  合计填充率: ' + ((filledTotal / (SPEC_FIELDS.length * list.length)) * 100).toFixed(1) + '%（' + filledTotal + '/' + (SPEC_FIELDS.length * list.length) + '）');

// 6) 核验进度：区分"字段缺失"与"已标未核验"
//    '未核验' 是诚实占位，不等于已核验；分开统计，避免把占位当成完成。
const tierB = ['account_requirement', 'student_requirement', 'network_requirement', 'hardware_requirement', 'quality_level', 'verification_status', 'last_verified'];
const isEmpty = (v) => v === undefined || v === null || String(v).trim() === '';
console.log('\n批次 B 核验类字段进度（缺失 / 待核验 / 已核验）:');
let needReview = 0;
for (const f of tierB) {
  let miss = 0, unver = 0, done = 0;
  for (const r of list) {
    if (isEmpty(r[f])) miss++;
    else if (String(r[f]).includes('未核验')) unver++;
    else done++;
  }
  needReview = Math.max(needReview, miss + unver);
  console.log('  ' + f.padEnd(22) + '缺失 ' + String(miss).padStart(3) + '   待核验 ' + String(unver).padStart(3) + '   已核验 ' + String(done).padStart(3));
}
console.log('  => 仍需人工核验约 ' + needReview + ' / ' + list.length + ' 条（属阶段 2 剩余工作，不是错误）');

// 7) 两级分类完整性：每条都要有子分类，且子分类必须在其大类下已声明
const declared = doc._subcategories && doc._subcategories.scheme;
if (declared) {
  console.log('\n两级分类校验:');
  let missingSub = 0, badSub = 0;
  for (const r of list) {
    if (!r.subcategory || !String(r.subcategory).trim()) { missingSub++; err(r.title + ' 缺少 subcategory'); continue; }
    const ok = declared[r.category] && declared[r.category].includes(r.subcategory);
    if (!ok) { badSub++; err(r.title + ' 的 subcategory「' + r.subcategory + '」未在「' + r.category + '」下声明'); }
  }
  console.log('  缺少子分类: ' + missingSub + '   子分类未声明: ' + badSub);
  for (const [cat, subs] of Object.entries(declared)) {
    const inCat = list.filter((r) => r.category === cat);
    const used = [...new Set(inCat.map((r) => r.subcategory))];
    const unused = subs.filter((s) => !used.includes(s));
    console.log('  ' + cat.padEnd(16) + inCat.length + ' 条 / ' + used.length + ' 个子分类' +
      (unused.length ? '   （声明但未使用: ' + unused.join('、') + '）' : ''));
  }
} else {
  warn('resources.json 缺少 _subcategories.scheme，无法校验两级分类');
}

// 结果
console.log('\n' + '='.repeat(52));
if (errors.length === 0) {
  console.log('✓ 校验通过（0 错误，' + warns.length + ' 警告）');
} else {
  console.log('✗ 校验失败：' + errors.length + ' 错误');
  errors.slice(0, 30).forEach((e) => console.log('  ERROR ' + e));
}
if (warns.length) {
  console.log('警告 ' + warns.length + ' 条:');
  warns.slice(0, 15).forEach((w) => console.log('  warn  ' + w));
  if (warns.length > 15) console.log('  ... 其余 ' + (warns.length - 15) + ' 条省略');
}
process.exit(errors.length === 0 ? 0 : 1);
