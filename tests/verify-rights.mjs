// 回归测试：权益反馈视图（用真实 channels.json）
//
// 为什么要测：这是给权益部用的板块，非技术同学以后会改 channels.json 加渠道。
// 要保证「改了 JSON 就能正常显示」，以及 status 的两种取值都不会让页面崩。
import { readFile } from 'node:fs/promises';
import { setupDom, loadScript, makeChecker } from './dom-stub.mjs';

const { script } = await loadScript('index.html');
const raw = await readFile('channels.json', 'utf8');
const real = JSON.parse(raw);

const { ids } = setupDom([
  'grid', 'empty', 'q', 'freeOnly', 'chips', 'subchips', 'modebar', 'resultBar',
  'view-resources', 'view-guides', 'view-skills', 'view-exams', 'view-rights',
  'detail-mask', 'detail-box',
], { protocol: 'https:' });
const { check, done } = makeChecker();

globalThis.fetch = async (u) => {
  const url = String(u);
  if (url.indexOf('channels.json') >= 0) {
    return { ok: true, status: 200, json: async () => JSON.parse(raw) };
  }
  return { ok: false, status: 404, json: async () => ({}) };
};

let err = null;
try { eval(script); } catch (e) { err = e; }
check('页面脚本无异常', err ? err.message : '', '');

const view = ids['view-rights'];
const modeBtns = () => ids.modebar.children.filter((c) => (c.className || '').includes('mode-btn'));

console.log('=== 1. 切到「权益反馈」===');
{
  const btn = modeBtns().find((b) => b.textContent.indexOf('权益反馈') === 0);
  check('存在「权益反馈」按钮', !!btn, true);
  if (btn) btn.fire('click');
  check('权益视图已显示', view.hidden, false);
  check('资源视图已隐藏', ids['view-resources'].hidden, true);
  await new Promise((r) => setTimeout(r, 60));
  const btn2 = modeBtns().find((b) => b.textContent.indexOf('权益反馈') === 0);
  console.log('  按钮文案: ' + btn2.textContent);
  const okCount = real.categories.reduce((a, c) => a + c.channels.filter((x) => x.status === 'ok').length, 0);
  check('按钮显示可用条数', btn2.textContent, '权益反馈' + okCount);
}
console.log('');

console.log('=== 2. 结构 ===');
{
  check('顶部说明存在', !!view.querySelector('.rt-intro'), true);
  const cats = view.querySelectorAll('.rt-cat');
  console.log('  分类数: ' + cats.length + '（JSON 里 ' + real.categories.length + '）');
  check('分类数一致', cats.length, real.categories.length);
  const items = view.querySelectorAll('.rt-item');
  const expectItems = real.categories.reduce((a, c) => a + c.channels.length, 0);
  console.log('  渠道条目数: ' + items.length + '（JSON 里 ' + expectItems + '）');
  check('条目数一致', items.length, expectItems);
}
console.log('');

console.log('=== 3. status=ok 的条目：有链接、可点 ===');
{
  const items = view.querySelectorAll('.rt-item');
  const withLink = items.filter((i) => i.querySelector('.rt-go'));
  const expectOk = real.categories.reduce((a, c) => a + c.channels.filter((x) => x.status === 'ok').length, 0);
  console.log('  有「去反馈」按钮的: ' + withLink.length + '（应为 ' + expectOk + '）');
  check('可用条目都带链接', withLink.length, expectOk);
  const bad = withLink.filter((i) => !/^https?:/.test(i.querySelector('.rt-go').href));
  check('链接格式都是 http(s)', bad.length, 0);
  const okBadges = items.filter((i) => i.querySelector('.rt-ok'));
  check('可用条目都标「可用」', okBadges.length, expectOk);
}
console.log('');

console.log('=== 4. status=todo 的条目：不显示死链接 ===');
{
  const items = view.querySelectorAll('.rt-item.todo');
  const expectTodo = real.categories.reduce((a, c) => a + c.channels.filter((x) => x.status !== 'ok').length, 0);
  console.log('  待补充条目: ' + items.length + '（应为 ' + expectTodo + '）');
  check('待补充条目数', items.length, expectTodo);
  check('待补充条目没有链接', items.filter((i) => i.querySelector('.rt-go')).length, 0);
  check('待补充条目都标「待补充链接」', items.filter((i) => i.querySelector('.rt-wait')).length, expectTodo);
  // 关键：不能出现 href="" 的空链接（点了会跳回当前页）
  const emptyHref = view.querySelectorAll('.rt-go').filter((a) => !a.href || a.href === '');
  check('没有空 href 的链接', emptyHref.length, 0);
}
console.log('');

console.log('=== 5. 宣传板块（占位）===');
{
  const promo = view.querySelector('.rt-promo');
  check('宣传板块存在', !!promo, true);
  const head = promo ? promo.querySelector('.rt-promo-head h3') : null;
  check('宣传板块标题', head ? head.textContent : '', '权益服务工作');
  const empty = promo ? promo.querySelector('.rt-promo-empty') : null;
  check('占位说明存在', !!empty, true);
  if (empty) console.log('  占位文案: ' + empty.textContent.replace(/\s+/g, ' ').slice(0, 60) + '…');
}
console.log('');

console.log('=== 6. 反复切换不重复构建 ===');
{
  const btnRes = modeBtns().find((b) => b.textContent.indexOf('资源库') === 0);
  const btnRig = modeBtns().find((b) => b.textContent.indexOf('权益反馈') === 0);
  btnRes.fire('click'); btnRig.fire('click');
  btnRes.fire('click'); btnRig.fire('click');
  const introCount = view.querySelectorAll('.rt-intro').length;
  console.log('  切换 4 次后 .rt-intro 个数: ' + introCount);
  check('没有重复构建（说明只建一次）', introCount, 1);
  check('渠道条目数仍是原数', view.querySelectorAll('.rt-item').length,
    real.categories.reduce((a, c) => a + c.channels.length, 0));
}
console.log('');

process.exit(done() ? 0 : 1);
