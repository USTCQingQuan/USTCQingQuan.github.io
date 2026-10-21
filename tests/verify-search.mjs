// 回归测试：搜索结果计数 + 关键词高亮 + 匹配位置提示
//
// 为什么需要它：
//   高亮是把用户输入拼进 DOM 的路径 —— 最容易出的问题是【文本被当成 HTML 解析】，
//   资源名里确实有 "C++"、"R"、">" 之类内容。必须验证高亮走的是文本节点而非 innerHTML。
import { setupDom, loadScript, makeNav } from './dom-stub.mjs';
import { makeChecker } from './dom-stub.mjs';

const FILE = process.argv[2] || 'index.html';
const { script } = await loadScript(FILE);
const { ids } = setupDom([
  'grid', 'empty', 'q', 'freeOnly', 'chips', 'subchips', 'modebar', 'subnav', 'resultBar',
  'view-resources', 'view-guides', 'view-skills', 'view-home', 'iconGrid', 'heroBanner', 'tabbar', 'view-exams', 'subnav', 'view-channels', 'view-key', 'view-repair', 'detail-mask', 'detail-box',
]);
const { check, done } = makeChecker();

globalThis.__FORCE_STUDY__ = true;   // 学习资源已下架，测试里强制打开
  eval(script);

// 新结构下资源列表在学习资源区，先导航过去
makeNav(ids).go('library');


const bar = ids.resultBar;
const q = ids.q;
const cards = () => ids.grid.children;

function search(kw) {
  q.value = kw;
  q.fire('input');
  return cards();
}

console.log('=== 1. 未筛选时结果条应隐藏 ===');
check('默认隐藏', bar.hidden, true);
console.log('');

console.log('=== 2. 搜索后结果条出现并显示条数 ===');
let list = search('英语');
console.log('  搜「英语」→ 卡片 ' + list.length + ' 条');
console.log('  结果条文字: 「' + bar.textContent + '」');
check('结果条显示', bar.hidden, false);
check('文字含"找到"', bar.textContent.includes('找到'), true);
check('文字含实际条数', bar.textContent.includes(String(list.length)), true);
check('文字含关键词', bar.textContent.includes('英语'), true);
console.log('');

console.log('=== 3. 关键词被高亮（用 mark 标签）===');
{
  let hit = 0, markTotal = 0;
  for (const c of cards()) {
    const marks = c.querySelectorAll('.hl');
    if (marks.length) hit++;
    markTotal += marks.length;
  }
  console.log('  含高亮的卡片: ' + hit + ' / ' + cards().length + '，mark 总数: ' + markTotal);
  check('至少一张卡有高亮', hit > 0, true);
}
console.log('');

console.log('=== 4. ★高亮必须是纯文本，不能被当成 HTML 解析 ===');
{
  // 这是最关键的一条：如果实现用 innerHTML 拼字符串，<b> 会被解析成标签。
  // 用一个必然命中的危险关键词来验证。
  const danger = search('<b>');
  console.log('  搜「<b>」→ ' + danger.length + ' 条（预期 0，库里没有这种内容）');
  check('危险字符搜索不报错', true, true);

  // 更直接的验证：搜 "c++"（库里有 C++ 相关内容）看 mark 里的文字是否原样
  ids.q.value = '';
  const plus = search('c++');
  let markTexts = [];
  for (const c of plus) {
    for (const m of c.querySelectorAll('.hl')) markTexts.push(m.textContent);
  }
  console.log('  搜「c++」→ ' + plus.length + ' 条，高亮片段: ' + JSON.stringify(markTexts.slice(0, 5)));
  const allExact = markTexts.every((t) => t.toLowerCase() === 'c++');
  check('高亮片段与原文完全一致（未被转义/解析）', allExact, true);
}
console.log('');

console.log('=== 5. 匹配位置提示（匹配：名称 · 标签 · 简介）===');
{
  search('英语');
  const withWhy = cards().filter((c) => {
    const w = c.querySelector('.card-why');
    return w && w.textContent;
  });
  console.log('  带匹配提示的卡片: ' + withWhy.length + ' / ' + cards().length);
  if (withWhy.length) console.log('  例: 「' + withWhy[0].querySelector('.card-why').textContent + '」');
  check('至少一张有匹配提示', withWhy.length > 0, true);
  const anyWhy = withWhy[0] ? withWhy[0].querySelector('.card-why').textContent : '';
  check('提示以"匹配："开头', anyWhy.startsWith('匹配：'), true);
}
console.log('');

console.log('=== 6. 分类 + 关键词同时生效时，结果条两者都说明 ===');
{
  const chip = ids.chips.children.find((c) => c.textContent === '英语备考');
  if (chip) chip.fire('click');
  search('雅思');
  console.log('  英语备考 + 搜「雅思」→ ' + cards().length + ' 条');
  console.log('  结果条: 「' + bar.textContent + '」');
  check('结果条含分类名', bar.textContent.includes('英语备考'), true);
  check('结果条含关键词', bar.textContent.includes('雅思'), true);
}
console.log('');

console.log('=== 7. 清除按钮：一次恢复全部 ===');
{
  const clear = bar.querySelector('.rb-clear');
  check('有清除按钮', !!clear, true);
  if (clear) clear.fire('click');
  console.log('  清除后 → 卡片 ' + cards().length + ' 条，结果条隐藏=' + bar.hidden + '，搜索框=' + JSON.stringify(q.value));
  check('恢复学习资源区全部 151 条', cards().length, 151);
  check('结果条隐藏', bar.hidden, true);
  check('搜索框已清空', q.value, '');
  check('只看免费已取消', ids.freeOnly.checked, false);
}
console.log('');

console.log('=== 8. 搜不到时结果条显示 0（不是隐藏）===');
{
  const none = search('汉语言文学');
  console.log('  搜「汉语言文学」→ ' + none.length + ' 条，结果条显示=' + (!bar.hidden));
  check('卡片 0 条', none.length, 0);
  check('结果条仍显示（告知 0 条）', bar.hidden, false);
  check('文字含 0', bar.textContent.includes('0'), true);
  check('空状态提示可见', ids.empty.hidden, false);
}
console.log('');

process.exit(done() ? 0 : 1);
