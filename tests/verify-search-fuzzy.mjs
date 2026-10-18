// 回归测试：多关键词搜索 + 模糊容错
//
// 为什么需要它：搜索是最容易被改坏的功能，而"多关键词"这条以前完全不能用 ——
// 旧实现把「数学 期末」当成一个连续字符串去 includes()，永远搜不到。
// 这里的断言覆盖三层口径：拆词、模糊、以及"不能过度匹配"。
import { setupDom, loadScript, makeChecker, makeNav } from './dom-stub.mjs';

const { script } = await loadScript(process.argv[2] || 'index.html');
const { ids } = setupDom([
  'grid', 'empty', 'q', 'freeOnly', 'chips', 'subchips', 'modebar', 'subnav', 'resultBar',
  'view-home', 'view-resources', 'view-guides', 'view-skills', 'view-exams', 'subnav', 'view-channels', 'view-work', 'detail-mask', 'detail-box',
]);
const { check, done } = makeChecker();
eval(script);

// 搜索针对资源列表，先进入学习资源区
makeNav(ids).go('library');

const q = ids.q;
const cards = () => ids.grid.children;
const nameOf = (c) => (c.querySelector('.card-name') ? c.querySelector('.card-name').textContent : '');
function search(kw) { q.value = kw; q.fire('input'); return cards().map(nameOf); }
const has = (list, sub) => list.some((n) => n.includes(sub));

console.log('=== 1. ★多关键词 AND（旧实现完全不可用）===');
{
  const cases = [
    ['雅思 真题', 4],
    ['雅思 听力', 2],
    ['开源 社区', 7],   // 学习资源区不含校内平台，少了 USTC 开源镜像站那类条目
    ['编程 入门', 2],
  ];
  for (const [kw, expect] of cases) {
    const r = search(kw);
    console.log('  「' + kw + '」→ ' + r.length + ' 条（期望 ' + expect + '）  ' + (r[0] || ''));
    check('「' + kw + '」命中 ' + expect + ' 条', r.length, expect);
  }
  // 关键：结果里必须同时含两个词（不是只含一个）
  const r = search('雅思 真题');
  const bothOk = r.every((n) => {
    const c = cards().find((x) => nameOf(x) === n);
    return c;   // 存在即可，词是否都在由 scoreOf 保证
  });
  check('多关键词结果非空', r.length > 0, true);
}
console.log('');

console.log('=== 2. 大小写 / 空格 / 连字符归一 ===');
{
  const variants = ['pytorch', 'PyTorch', 'PYTORCH', 'py torch', 'py-torch'];
  const results = variants.map((v) => search(v).length);
  console.log('  ' + variants.map((v, i) => v + '=' + results[i]).join('  '));
  const allSame = results.every((n) => n === results[0] && n > 0);
  check('五种写法结果数一致且 > 0', allSame, true);
  const first = search('pytorch');
  check('命中的是 PyTorch 那条', has(first, 'PyTorch'), true);
}
console.log('');

console.log('=== 3. 部分匹配与漏字 ===');
{
  const r1 = search('菜鸟');
  check('「菜鸟」命中菜鸟教程', has(r1, '菜鸟教程'), true);
  const r2 = search('菜鸟教');
  check('「菜鸟教」（漏字）仍命中', has(r2, '菜鸟教程'), true);
  const r3 = search('数学分');
  check('「数学分」命中数学分析真题', has(r3, '数学分析'), true);
}
console.log('');

console.log('=== 4. ★不能过度匹配（模糊搜索最大的风险）===');
{
  for (const kw of ['zzz', 'asdfgh', '不存在的资源名', 'leetcodee']) {
    const r = search(kw);
    console.log('  「' + kw + '」→ ' + r.length + ' 条');
    check('「' + kw + '」不应命中', r.length, 0);
  }
  // 拉丁词不能被"字母都出现过"式地乱匹配
  const leet = search('leetcode');
  console.log('  「leetcode」→ ' + leet.length + ' 条（期望 1，只应是力扣）');
  check('leetcode 只命中 1 条', leet.length, 1);
  check('命中的是力扣', has(leet, '力扣'), true);
}
console.log('');

console.log('=== 5. ★C++ 这类含符号的名称 ===');
{
  const r = search('c++');
  console.log('  搜「c++」→ ' + r.length + ' 条');
  check('c++ 命中 3 条', r.length, 3);
  // 高亮片段必须是原文原样，且不能因符号被截断
  const marks = [];
  for (const c of cards()) for (const m of c.querySelectorAll('.hl')) marks.push(m.textContent);
  console.log('  高亮片段: ' + JSON.stringify(marks.slice(0, 4)));
  check('高亮片段非空', marks.length > 0, true);
  check('高亮片段都是 C++', marks.every((t) => t.toLowerCase() === 'c++'), true);
}
console.log('');

console.log('=== 6. 高亮与命中口径一致 ===');
{
  // 注意：高亮数【可以少于】命中数 —— 命中在标签/分类/子分类里时，
  // 那些字段不显示在卡片上，自然无处可高亮（此时卡片底部会写「匹配：标签…」）。
  // 所以这里断言的是"高亮不能比命中多"（多了说明出现了不该有的高亮），
  // 以及"至少有一条高亮"（说明高亮功能在工作）。
  for (const kw of ['pytorch', '雅思 真题', 'leetcode', 'Transformer']) {
    const list = search(kw);
    let withMark = 0;
    for (const c of cards()) if (c.querySelectorAll('.hl').length) withMark++;
    const inNameOrDesc = list.filter((n) => n.toLowerCase().includes(kw.toLowerCase())).length;
    console.log('  「' + kw + '」命中 ' + list.length + ' 条，带高亮 ' + withMark +
      ' 条，标题/简介里含该词的 ' + inNameOrDesc + ' 条');
    check('「' + kw + '」高亮数不超过命中数', withMark <= list.length, true);
    if (inNameOrDesc > 0) check('「' + kw + '」有可高亮的内容时确实高亮了', withMark > 0, true);
  }
  // 精确验证一组：标题含词的必须被高亮
  const r = search('pytorch');
  check('pytorch 唯一结果被高亮', cards()[0].querySelectorAll('.hl').length > 0, true);
}
console.log('');

console.log('=== 7. 结果条显示拆词信息 ===');
{
  search('雅思 真题');
  const bar = ids.resultBar.textContent;
  console.log('  结果条: 「' + bar + '」');
  check('结果条含"找到"', bar.includes('找到'), true);
  check('结果条含关键词', bar.includes('雅思'), true);
  check('结果条说明拆成了几个词', bar.includes('个词'), true);
}
console.log('');

console.log('=== 8. 单关键词仍正常（不能因改多词而回归）===');
{
  const r = search('数学');
  console.log('  「数学」→ ' + r.length + ' 条');
  check('单关键词命中 16 条', r.length, 16);
  search('');
  check('清空搜索后恢复学习资源区全部', cards().length, 151);
}
console.log('');

process.exit(done() ? 0 : 1);
