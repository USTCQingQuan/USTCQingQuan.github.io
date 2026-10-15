// tools/check-guides.mjs
// 指南数据闸门：校验 guides.json / skills.json 的引用完整性。
//
// 为什么需要它：学习路径与技能表里会引用 resources.json 中的资源标题。
// 一旦标题写错或资源被改名，指南里就会出现"指向不存在资源"的死引用，
// 用户点进去什么也没有 —— 这比链接失效更隐蔽。所以引用必须逐个校验。
//
// 用法: node tools/check-guides.mjs [guides.json] [skills.json] [resources.json]

import { readFile } from 'node:fs/promises';

const GUIDE_FILE = process.argv[2] || 'guides.json';
const SKILL_FILE = process.argv[3] || 'skills.json';
const RES_FILE = process.argv[4] || 'resources.json';

const errors = [];
const warns = [];
const err = (m) => errors.push(m);
const warn = (m) => warns.push(m);

const res = JSON.parse(await readFile(RES_FILE, 'utf8'));
const titles = new Set(res.resources.map((r) => r.title));
const cats = new Set(res.resources.map((r) => r.category));
const subs = new Set(res.resources.map((r) => r.subcategory).filter(Boolean));
const urlOf = new Map(res.resources.map((r) => [r.title, r.url]));

console.log('资源基准: ' + res.resources.length + ' 条 / ' + cats.size + ' 大类 / ' + subs.size + ' 子分类');
console.log('');

// ---------- 收集指南里的所有资源引用 ----------
const refCount = new Map();   // 标题 -> 被引用次数
let guideSteps = 0;
let guideBlocks = 0;

function checkRef(t, where) {
  if (!titles.has(t)) { err(where + ' 引用了不存在的资源: 「' + t + '」'); return false; }
  refCount.set(t, (refCount.get(t) || 0) + 1);
  return true;
}

const guides = JSON.parse(await readFile(GUIDE_FILE, 'utf8'));
const byId = new Set();
for (const g of guides.guides) {
  const where = '指南「' + g.title + '」';
  if (byId.has(g.id)) err('指南 id 重复: ' + g.id);
  byId.add(g.id);
  if (!g.title) err('指南缺少 title: ' + g.id);
  if (!Array.isArray(g.steps) || !g.steps.length) { err(where + ' 没有 stages'); continue; }

  for (const [si, st] of g.steps.entries()) {
    guideSteps++;
    const sw = where + ' / 第' + (si + 1) + '阶段「' + (st.title || '?') + '」';
    if (!st.title) err(sw + ' 缺少 title');
    if (!Array.isArray(st.blocks) || !st.blocks.length) { err(sw + ' 没有 blocks'); continue; }
    for (const [bi, b] of st.blocks.entries()) {
      guideBlocks++;
      const bw = sw + ' / 第' + (bi + 1) + '块';
      if (!b.type) err(bw + ' 缺少 type');
      switch (b.type) {
        case 'resources':
          if (!Array.isArray(b.items) || !b.items.length) { err(bw + ' (resources) 没有 items'); break; }
          for (const it of b.items) {
            if (typeof it === 'string') { checkRef(it, bw); }
            else {
              if (!it.title) { err(bw + ' 的条目缺少 title'); continue; }
              if (checkRef(it.title, bw) && it.note === undefined) {
                warn(bw + ' 「' + it.title + '」没有说明（note），建议写明"为什么在这一步用"');
              }
            }
          }
          break;
        case 'text':
          if (!b.text) err(bw + ' (text) 没有 text');
          break;
        case 'checklist':
          if (!Array.isArray(b.items) || !b.items.length) err(bw + ' (checklist) 没有 items');
          break;
        default:
          err(bw + ' 未知 type: ' + b.type);
      }
    }
  }
}

// ---------- 技能表 ----------
const skills = JSON.parse(await readFile(SKILL_FILE, 'utf8'));
let skillItems = 0;
const skillIds = new Set();
for (const grp of skills.groups) {
  if (!grp.title) err('技能分组缺少 title');
  if (!Array.isArray(grp.items) || !grp.items.length) { err('技能分组「' + grp.title + '」没有 items'); continue; }
  for (const it of grp.items) {
    skillItems++;
    if (!it.id) { err('技能分组「' + grp.title + '」有条目缺少 id'); continue; }
    if (skillIds.has(it.id)) err('技能 id 重复: ' + it.id);
    skillIds.add(it.id);
    if (!it.text) err('技能 ' + it.id + ' 缺少 text');
    if (it.ref) checkRef(it.ref, '技能 ' + it.id);
  }
}

// ---------- 结果 ----------
console.log('=== 指南结构 ===');
for (const g of guides.guides) {
  let n = 0;
  for (const st of g.steps) for (const b of st.blocks) if (b.type === 'resources') n += b.items.length;
  console.log('  ' + g.id.padEnd(22) + g.steps.length + ' 阶段  ' + n + ' 个资源引用   「' + g.title + '」');
}
console.log('  合计: ' + guides.guides.length + ' 条指南 / ' + guideSteps + ' 阶段 / ' + guideBlocks + ' 内容块');
console.log('');
console.log('=== 技能自查表 ===');
console.log('  ' + skills.groups.length + ' 个分组 / ' + skillItems + ' 项技能');
console.log('');
console.log('=== 资源引用覆盖 ===');
const total = res.resources.length;
const cited = refCount.size;
console.log('  被指南/技能表引用的资源: ' + cited + ' / ' + total + '（' + ((cited / total) * 100).toFixed(0) + '%）');
const uncited = res.resources.filter((r) => !refCount.has(r.title)).map((r) => r.title);
if (uncited.length) {
  console.log('  未被引用（' + uncited.length + ' 条，仅提示，不算错误）:');
  console.log('    ' + uncited.join('、'));
}
console.log('');

console.log('='.repeat(52));
if (errors.length === 0) {
  console.log('✓ 指南校验通过（0 错误，' + warns.length + ' 警告）');
} else {
  console.log('✗ 指南校验失败：' + errors.length + ' 错误');
  errors.slice(0, 40).forEach((e) => console.log('  ERROR ' + e));
}
if (warns.length) {
  console.log('警告 ' + warns.length + ' 条:');
  warns.slice(0, 12).forEach((w) => console.log('  warn  ' + w));
  if (warns.length > 12) console.log('  ... 其余 ' + (warns.length - 12) + ' 条省略');
}
process.exit(errors.length === 0 ? 0 : 1);
