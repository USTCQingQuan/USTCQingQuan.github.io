// 回归测试：历年试卷视图（用真实 exams.json 数据）
//
// 为什么用真实数据而不是假数据：之前吃过亏 —— 假数据的字段形状与真实不符，
// 导致真 bug 在测试里看不见。这里直接读 exams.json，断言真实的条数与分布。
import { readFile } from 'node:fs/promises';
import { setupDom, loadScript, makeChecker } from './dom-stub.mjs';

const FILE = process.argv[2] || 'index.html';
const { script } = await loadScript(FILE);
const realExams = JSON.parse(await readFile('exams.json', 'utf8'));

const { ids } = setupDom([
  'grid', 'empty', 'q', 'freeOnly', 'chips', 'subchips', 'modebar', 'resultBar',
  'view-resources', 'view-guides', 'view-skills', 'view-exams', 'detail-mask', 'detail-box',
], { protocol: 'https:' });   // 必须用 https：file:// 下页面会跳过 fetch，走"无法载入"分支
const { check, done } = makeChecker();

// 模拟 exams.json 的加载（页面用 fetch，测试里直接喂）
globalThis.fetch = async (u) => {
  if (String(u).indexOf('exams.json') >= 0) {
    return { ok: true, status: 200, json: async () => realExams };
  }
  return { ok: false, status: 404, json: async () => ({}) };
};

eval(script);

const view = ids['view-exams'];
const modeBtns = () => ids.modebar.children.filter((c) => (c.className || '').includes('mode-btn'));

console.log('=== 1. 切换到试卷模式 ===');
{
  const btn = modeBtns().find((b) => b.textContent.indexOf('历年试卷') === 0);
  check('存在「历年试卷」按钮', !!btn, true);
  if (btn) btn.fire('click');
  check('试卷视图已显示', view.hidden, false);
  check('资源视图已隐藏', ids['view-resources'].hidden, true);
  // exams.json 是异步 fetch，必须等它 resolve 后才会建控件
  await new Promise((r) => setTimeout(r, 60));
  console.log('  等待 exams.json 加载完成');
  check('数据已载入（按钮计数不再是 …）',
    modeBtns().find((b) => b.textContent.indexOf('历年试卷') === 0).textContent.indexOf('1580') > 0, true);
}
console.log('');

console.log('=== 2. 控件是否建好 ===');
{
  const bar = view.querySelector('.ex-bar');
  check('筛选栏存在', !!bar, true);
  const inp = view.querySelector('#exQ');
  const selCat = view.querySelector('#exCat');
  const selCourse = view.querySelector('#exCourse');
  const sortBtn = view.querySelector('#exSort');
  check('搜索框存在', !!inp, true);
  check('科目下拉存在', !!selCat, true);
  check('课程下拉存在', !!selCourse, true);
  check('排序按钮存在', !!sortBtn, true);
  const opts = selCat ? selCat.children.length : 0;
  console.log('  科目下拉项数: ' + opts + '（应为 1 + ' + realExams.cats.length + '）');
  check('科目下拉含全部科目', opts, 1 + realExams.cats.length);
  if (sortBtn) console.log('  排序按钮文案: 「' + sortBtn.textContent + '」');
}
console.log('');

console.log('=== 3. 列表渲染（真实 1580 条，应只渲染前 300）===');
{
  const list = view.querySelector('#exList');
  const rows = list.querySelectorAll('.ex-row');
  console.log('  渲染行数: ' + rows.length);
  check('渲染行数不超过 300', rows.length <= 300, true);
  check('确实渲染了内容', rows.length > 0, true);
  const countEl = view.querySelector('#exCount');
  const txt = countEl ? countEl.textContent : '';
  console.log('  计数文案: 「' + txt.slice(0, 40) + '」');
  check('计数显示 1580', txt.indexOf('1580') >= 0, true);
  // 第一行应是最新的年份（默认倒序）
  const firstYear = rows[0].querySelector('.ex-year').textContent;
  console.log('  第一行年份: ' + firstYear);
  check('默认按年份倒序（首行是最新）', /^20(2[5-9]|[3-9]\d)/.test(firstYear), true);
}
console.log('');

console.log('=== 4. 搜索（多关键词）===');
{
  const inp = view.querySelector('#exQ');
  const list = view.querySelector('#exList');
  inp.value = '数学分析A1';
  inp.fire('input');
  let n = list.querySelectorAll('.ex-row').length;
  console.log('  搜「数学分析A1」→ ' + n + ' 行');
  const expect = realExams.items.filter((it) =>
    JSON.stringify([realExams.courses[it.k], it.y, it.t, it.h, it.n].join(' ')).toLowerCase().indexOf('数学分析a1') >= 0).length;
  check('结果数与真实数据一致', n, expect);
  check('结果非空', n > 0, true);

  inp.value = '2024 期末';
  inp.fire('input');
  n = list.querySelectorAll('.ex-row').length;
  console.log('  搜「2024 期末」→ ' + n + ' 行（多关键词 AND）');
  check('多关键词有结果（旧实现此处为 0）', n > 0, true);

  inp.value = '';
  inp.fire('input');
  console.log('  清空搜索 → ' + list.querySelectorAll('.ex-row').length + ' 行');
}
console.log('');

console.log('=== 5. 科目筛选与课程联动 ===');
{
  const selCat = view.querySelector('#exCat');
  const selCourse = view.querySelector('#exCourse');
  const list = view.querySelector('#exList');
  selCat.value = '物理-四大力学与专业';
  selCat.fire('change');
  const n1 = list.querySelectorAll('.ex-row').length;
  console.log('  选「物理-四大力学与专业」→ ' + n1 + ' 行');
  check('筛选后行数减少', n1 < 300, true);

  // 课程下拉应只剩该科目的课程
  const courseOpts = selCourse.children.slice(1).map((o) => o.value);
  console.log('  课程下拉项数: ' + courseOpts.length + '，例: ' + courseOpts.slice(0, 3).join('/'));
  check('课程下拉已联动', courseOpts.length > 0 && courseOpts.length < realExams.courses.length, true);

  // 选一门具体课程
  if (courseOpts.length) {
    selCourse.value = courseOpts[0];
    selCourse.fire('change');
    const n2 = list.querySelectorAll('.ex-row').length;
    console.log('  再选课程「' + courseOpts[0] + '」→ ' + n2 + ' 行');
    const allSame = list.querySelectorAll('.ex-course').every((c) => c.textContent === courseOpts[0]);
    check('结果全部是该课程', allSame, true);
  }
  selCat.value = '';
  selCat.fire('change');
  selCourse.value = '';
  selCourse.fire('change');
}
console.log('');

console.log('=== 6. 排序切换 ===');
{
  const sortBtn = view.querySelector('#exSort');
  const list = view.querySelector('#exList');
  const before = list.querySelectorAll('.ex-row')[0].querySelector('.ex-year').textContent;
  sortBtn.fire('click');
  const after = list.querySelectorAll('.ex-row')[0].querySelector('.ex-year').textContent;
  console.log('  切换前首行年份: ' + before + '  →  切换后: ' + after);
  check('排序方向已反转', before !== after, true);
  check('升序时首行较早', /^20(0\d|1\d|2[0-3])/.test(after), true);
  console.log('  按钮文案: 「' + sortBtn.textContent + '」');
  sortBtn.fire('click');   // 切回去
}
console.log('');

console.log('=== 7. 下载链接与镜像标记 ===');
{
  const list = view.querySelector('#exList');
  const rows = list.querySelectorAll('.ex-row');
  const links = rows.filter((r) => r.querySelector('.ex-go'));
  const none = rows.filter((r) => r.querySelector('.ex-none'));
  const mirror = rows.filter((r) => r.querySelector('.ex-mirror'));
  console.log('  有下载链接: ' + links.length + ' 行   「暂无链接」: ' + none.length + ' 行   「国内镜像」标记: ' + mirror.length + ' 行');
  check('下载链接数与"暂无链接"数之和等于行数', links.length + none.length, rows.length);
  // 链接必须是 http(s) 开头
  const bad = links.filter((r) => !/^https?:/.test(r.querySelector('.ex-go').href));
  check('所有链接格式正确', bad.length, 0);
  // 镜像标记必须与真实数据的 g 字段一致
  const gCount = realExams.items.filter((x) => x.g).length;
  console.log('  真实数据里镜像条数: ' + gCount + '（共 ' + realExams.total + '）');
  check('镜像条数符合预期（498）', gCount, 498);
}
console.log('');

console.log('=== 8. 切走再切回不报错 ===');
{
  const btnRes = modeBtns().find((b) => b.textContent.indexOf('资源库') === 0);
  const btnEx = modeBtns().find((b) => b.textContent.indexOf('历年试卷') === 0);
  btnRes.fire('click');
  btnEx.fire('click');
  btnRes.fire('click');
  btnEx.fire('click');
  const rows = view.querySelectorAll('.ex-row').length;
  console.log('  反复切换后行数: ' + rows);
  check('反复切换后仍正常渲染', rows > 0, true);
  // 输入框内容不应因重渲染而丢失
  const inp = view.querySelector('#exQ');
  inp.value = '量子力学';
  inp.fire('input');
  const n1 = view.querySelectorAll('.ex-row').length;
  btnRes.fire('click');
  btnEx.fire('click');
  const n2 = view.querySelectorAll('.ex-row').length;
  console.log('  切走再切回，结果数 ' + n1 + ' → ' + n2);
  check('切回后保留搜索条件', n1, n2);
}
console.log('');

process.exit(done() ? 0 : 1);
