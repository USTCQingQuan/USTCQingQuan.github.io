// 数据闸门 · resources.json 完整性
// 站点现在只剩「校园平台」一个资源视图（6 条，全属「校内平台」分类），
// 但仍然要求全字段齐全、URL 合法、无重复 —— 以后加资源时不会悄悄掺进脏数据。
import { readFile } from 'node:fs/promises';
import { makeChecker } from './dom-stub.mjs';

const { check, done } = makeChecker();
const d = JSON.parse(await readFile('resources.json', 'utf8'));

console.log('=== 1. 基本计数 ===');
console.log('  资源总数: ' + d.resources.length);
check('_count 与实际一致', d._count, d.resources.length);

console.log('');
console.log('=== 2. 分类 ===');
const byCat = {};
for (const r of d.resources) byCat[r.category] = (byCat[r.category] || 0) + 1;
Object.entries(byCat).sort((a, b) => b[1] - a[1]).forEach(([c, n]) => console.log('  ' + c.padEnd(16) + n));
check('校园平台分类恰好 6 条', byCat['校内平台'] || 0, 6);
check('没有残留的「校园信息」分类', byCat['校园信息'] || 0, 0);

console.log('');
console.log('=== 3. 字段完整性 ===');
const REQUIRED = ['title', 'url', 'description', 'category', 'subcategory', 'icon', 'free',
  'tags', 'source', 'cost', 'language_support', 'account_requirement', 'student_requirement',
  'network_requirement', 'hardware_requirement', 'verification_status', 'last_verified'];
let missing = 0;
for (const r of d.resources) {
  for (const f of REQUIRED) {
    if (r[f] === undefined || r[f] === null || r[f] === '') {
      console.log('  ✗ 「' + r.title + '」缺 ' + f);
      missing++;
    }
  }
}
check('17 个字段齐全', missing, 0);

console.log('');
console.log('=== 4. 唯一性与 URL ===');
const titles = d.resources.map((r) => r.title);
check('无重复标题', titles.filter((t, i) => titles.indexOf(t) !== i).length, 0);
const urls = d.resources.map((r) => r.url.replace(/\/$/, '').toLowerCase());
check('无重复 URL', urls.filter((u, i) => urls.indexOf(u) !== i).length, 0);
check('URL 全为 http(s)', d.resources.filter((r) => !/^https?:\/\//.test(r.url)).length, 0);

console.log('');
console.log('=== 5. 子分类都已声明 ===');
const scheme = (d._subcategories && d._subcategories.scheme) || {};
let undeclared = 0;
for (const r of d.resources) {
  const list = scheme[r.category];
  if (!list || list.indexOf(r.subcategory) < 0) {
    console.log('  ✗ 未声明: ' + r.category + ' / ' + r.subcategory);
    undeclared++;
  }
}
check('子分类全部已声明', undeclared, 0);

console.log('');
console.log('=== 6. 校园平台 6 条清单 ===');
for (const r of d.resources.filter((x) => x.category === '校内平台')) {
  console.log('  · ' + r.title + '  ' + r.url);
}

process.exit(done() ? 0 : 1);
