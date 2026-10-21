// 回归测试：两级筛选（大类 -> 子分类）
// 用法: node tests/verify-filters.mjs [index.html]
import { makeChecker, setupDom, loadScript, makeNav } from './dom-stub.mjs';

const FILE = process.argv[2] || 'index.html';
const { script } = await loadScript(FILE);
const { byId, ids } = setupDom([
  'grid', 'empty', 'q', 'freeOnly', 'chips', 'subchips', 'modebar',
  'view-resources', 'view-guides', 'view-skills', 'view-home', 'iconGrid', 'heroBanner', 'tabbar', 'view-exams', 'subnav', 'view-channels', 'view-key', 'view-repair', 'view-dept', 'detail-mask', 'detail-box',
]);
const { check, done } = makeChecker();

globalThis.__FORCE_STUDY__ = true;   // 学习资源已下架，测试里强制打开
  eval(script);

// 新结构下资源列表在学习资源区，先导航过去
makeNav(ids).go('library');


const chips = ids.chips.children.filter((c) => (c.className || '').includes('chip'));
const subChips = () => ids.subchips.children.filter((c) => (c.className || '').includes('sub-chip'));

console.log('=== 1. 初始状态 ===');
check('资源总数', Number(byId.total.textContent), 186);
check('大类标签数（学习资源区 8 类 + 全部）', chips.length, 9);
check('初始子分类区隐藏', ids.subchips.hidden, true);

console.log('\n=== 2. 「全部」时不应显示子分类 ===');
chips[0].fire('click');
check('子分类区仍隐藏', ids.subchips.hidden, true);
check('卡片数（学习资源区 151 条）', ids.grid.children.length, 151);

console.log('\n=== 3. 逐个大类：子分类计数之和 == 该大类条数 ===');
for (const chip of chips.slice(1)) {
  const catName = chip.textContent;
  chip.fire('click');
  const total = ids.grid.children.length;
  const els = subChips();
  // 第一个 sub-chip 是"全部"，其余为各子分类
  const parts = els.slice(1).map((b) => Number(((b.textContent || '').match(/\((\d+)\)/) || [])[1] || 0));
  const sum = parts.reduce((a, b) => a + b, 0);
  const ok = els.length >= 1 && sum === total;
  if (!ok) console.log('      ✗ ' + catName + ' 总数=' + total + ' 子分类求和=' + sum);
  check(catName + ' 子分类求和 == 总数', ok, true);
}

console.log('\n=== 4. 点进子分类 ===');
const catChip = chips.find((c) => c.textContent === '课程资料');
catChip.fire('click');
const paperChip = subChips().find((c) => (c.textContent || '').startsWith('试卷与真题'));
check('存在「试卷与真题」子分类', !!paperChip, true);
if (paperChip) {
  paperChip.fire('click');
  check('课程资料 > 试卷与真题 卡片数', ids.grid.children.length, 4);
}
subChips()[0].fire('click');
check('课程资料 > 全部 卡片数', ids.grid.children.length, 38);

console.log('\n=== 5. 切换大类应清空子分类选择 ===');
const aiChip = chips.find((c) => c.textContent.indexOf('AI') === 0);
aiChip.fire('click');
check('AI 与数据科学卡片数', ids.grid.children.length, 42);
check('子分类选择已重置', subChips()[0].textContent, '全部(42)');

console.log('\n=== 6. 子分类 + 只看免费 叠加 ===');
ids.freeOnly.checked = true;
ids.freeOnly.fire('change');
const aiFree = ids.grid.children.length;
ids.freeOnly.checked = false;
ids.freeOnly.fire('change');
check('只看免费结果 <= 总数', aiFree <= 42, true);

process.exit(done() ? 0 : 1);
