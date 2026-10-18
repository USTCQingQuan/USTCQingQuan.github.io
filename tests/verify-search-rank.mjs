// 验证相关度排序与无结果建议
import { setupDom, loadScript, makeNav } from './dom-stub.mjs';
import { makeChecker } from './dom-stub.mjs';

const { script } = await loadScript(process.argv[2] || 'index.html');
const { ids } = setupDom([
  'grid', 'empty', 'q', 'freeOnly', 'chips', 'subchips', 'modebar', 'subnav', 'resultBar',
  'view-resources', 'view-guides', 'view-skills', 'view-home', 'view-exams', 'subnav', 'view-channels', 'detail-mask', 'detail-box',
]);
const { check, done } = makeChecker();
eval(script);

// 新结构下资源列表在学习资源区，先导航过去
makeNav(ids).go('library');


const q = ids.q, cards = () => ids.grid.children;
const nameOf = (c) => (c.querySelector('.card-name') ? c.querySelector('.card-name').textContent : '');

function search(kw) { q.value = kw; q.fire('input'); return cards(); }

console.log('=== 1. 标题命中应排在简介命中之前（相关度排序）===');
{
  const list = search('英语');
  const names = list.map(nameOf);
  console.log('  搜「英语」→ ' + names.length + ' 条，前 6 条：');
  names.slice(0, 6).forEach((n, i) => console.log('    ' + (i + 1) + '. ' + n));
  // 首条应当是标题里含"英语"的
  const first = names[0] || '';
  console.log('  首条标题含「英语」: ' + first.includes('英语'));
  check('首条是标题命中', first.includes('英语'), true);
}
console.log('');

console.log('=== 2. 标题命中排在标签/简介命中之前（用真实结果验证）===');
{
  // 不直接调内部打分函数（它在页面脚本作用域里，测试拿不到），改为验证可观察结果。
  const list = search('英语');
  const rows = list.map((c, i) => ({
    i: i + 1,
    name: nameOf(c),
    hl: c.querySelectorAll('.hl').length,
    why: (c.querySelector('.card-why') || {}).textContent || '',
  }));
  console.log('  搜「英语」→ ' + rows.length + ' 条（■ = 卡片上有高亮）');
  for (const r of rows) {
    console.log('    ' + (r.hl ? '■' : '　') + ' ' + String(r.i).padStart(2) + '. ' +
      r.name.padEnd(26) + r.why);
  }
  const hlCount = rows.filter((r) => r.hl > 0).length;
  console.log('');
  // 严谨验证：按卡片上【显示出来的命中原因】复算分数，结果列表必须严格非递增。
  // 这样不依赖页面内部变量（它们在脚本作用域里，测试取不到），
  // 而是验证"用户看到的原因"与"实际排序"是否自洽。
  const weight = (reason) => {
    if (reason.indexOf('名称') === 0 || reason.indexOf('名称 ·') === 0) return 100;
    if (reason.includes('标签')) return 50;
    if (reason.includes('子分类')) return 30;
    if (reason.includes('分类')) return 20;
    if (reason.includes('来源')) return 15;
    if (reason.includes('简介')) return 10;
    return 0;
  };
  const scores = rows.map((r) => {
    const parts = r.why.replace(/^匹配：/, '').split(' · ');
    return parts.reduce((a, p) => a + weight(p), 0);
  });
  console.log('  按显示出的命中原因复算的分数: ' + scores.join(', '));
  let monotonic = true;
  for (let i = 1; i < scores.length; i++) if (scores[i] > scores[i - 1]) monotonic = false;
  check('结果按相关度严格非递增排列', monotonic, true);
  check('名称命中排在首位', scores[0] >= 100, true);
  check('末位是弱命中（无名称命中）', scores[scores.length - 1] < 100, true);
  console.log('  末位「' + rows[rows.length - 1].name + '」只在标签与简介命中，排在最后合理');
}
console.log('');

console.log('=== 3. 无结果时给出真实存在的标签建议 ===');
{
  const list = search('汉语言文学');
  console.log('  搜「汉语言文学」→ ' + list.length + ' 条');
  const btns = ids.empty.querySelectorAll('.eh-tag');
  const labels = btns.map((b) => b.textContent);
  console.log('  空状态建议: ' + (labels.length ? labels.join(' / ') : '(无)'));
  check('卡片 0 条', list.length, 0);
  check('给出了建议标签', labels.length > 0, true);
  check('建议数量不超过 6', labels.length <= 6, true);
  // 建议的标签必须真的能搜到东西 —— 否则是误导
  if (labels.length) {
    let allWork = true;
    const detail = [];
    for (const t of labels) {
      const n = search(t).length;
      detail.push(t + '(' + n + ')');
      if (n === 0) allWork = false;
    }
    console.log('  逐个验证建议标签: ' + detail.join(' '));
    check('每个建议标签都能搜到结果', allWork, true);
  }
}
console.log('');

console.log('=== 4. 建议按钮可点击并触发搜索 ===');
{
  search('汉语言文学');
  const btns = ids.empty.querySelectorAll('.eh-tag');
  check('有建议按钮', btns.length > 0, true);
  if (btns.length) {
    const label = btns[0].textContent;
    btns[0].fire('click');
    console.log('  点击「' + label + '」后 → 搜索框=' + JSON.stringify(q.value) + '，结果 ' + cards().length + ' 条');
    check('搜索框被填入标签', q.value, label);
    check('确实搜到了结果', cards().length > 0, true);
  }
}
console.log('');

console.log('=== 5. 有结果时不显示建议（只显示原提示）===');
{
  search('英语');
  const btns = ids.empty.querySelectorAll('.eh-tag');
  console.log('  搜「英语」有结果时，空状态建议按钮: ' + btns.length + ' 个');
  check('无结果时才给建议', btns.length, 0);
}
console.log('');

process.exit(done() ? 0 : 1);
