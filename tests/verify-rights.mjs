// 回归测试：权益反馈视图（用真实 channels.json）
//
// 为什么要测：这是给权益部用的板块，非技术同学以后会改 channels.json 加渠道。
// 要保证「改了 JSON 就能正常显示」，以及 status 的两种取值都不会让页面崩。
import { readFile } from 'node:fs/promises';
import { setupDom, loadScript, makeChecker, makeNav } from './dom-stub.mjs';

const { script } = await loadScript('index.html');
const raw = await readFile('channels.json', 'utf8');
const real = JSON.parse(raw);

const { ids } = setupDom([
  'grid', 'empty', 'q', 'freeOnly', 'chips', 'subchips', 'modebar', 'subnav', 'resultBar',
  'view-home', 'view-resources', 'view-guides', 'view-skills', 'view-exams', 'view-channels', 'promoBody',
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

const view = ids['view-channels'];
const workView = ids['view-work'];
const nav = makeNav(ids);

console.log('=== 1. 切到「权益反馈」===');
{
  nav.go('channels');
  const btn = nav.subBtns().find((b) => b.textContent.indexOf('权益反馈') === 0);
  check('存在「权益反馈」子按钮', !!btn, true);
  check('权益视图已显示', view.hidden, false);
  check('资源视图已隐藏', ids['view-home', 'view-resources'].hidden, true);
  await new Promise((r) => setTimeout(r, 60));
  const btn2 = nav.subBtns().find((b) => b.textContent.indexOf('权益反馈') === 0);
  console.log('  按钮文案: ' + btn2.textContent);
  const okCount = real.categories.reduce((a, c) => a + c.channels.filter((x) => x.status === 'ok').length, 0);
  check('二级按钮显示可用条数', btn2.textContent, '权益反馈' + okCount);
  const activeTop = nav.modeBtns().find((b) => (b.className || '').includes('active'));
  check('当前激活的一级按钮是「权益服务」', activeTop ? activeTop.textContent : '', '权益服务');
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

console.log('=== 5. 宣传板块已移到首页 ===');
{
  nav.home();
  check('首页视图已显示', ids['view-home'].hidden, false);
  // 宣传栏目由 renderHome() 建进 #promoBody（静态 HTML 里的 .promo 外壳不在桩里）
  const body = ids['promoBody'];
  const rows = body ? body.children.filter((c) => (c.className || '').includes('promo-row')) : [];
  console.log('  宣传栏目数: ' + rows.length);
  check('三个宣传栏目都摆出来了', rows.length, 3);
  const firstTitle = rows[0] ? rows[0].querySelector('h4').textContent : '';
  check('第一个栏目是「工作动态」', firstTitle, '工作动态');
  check('栏目都标「内容准备中」', body.querySelectorAll('.promo-soon').length, 3);
  nav.go('channels');
}
console.log('');

console.log('=== 6. 反复切换不重复构建 ===');
{
  nav.go('resources'); nav.go('channels');
  nav.go('resources'); nav.go('channels');
  const introCount = view.querySelectorAll('.rt-intro').length;
  console.log('  切换 4 次后 .rt-intro 个数: ' + introCount);
  check('没有重复构建（说明只建一次）', introCount, 1);
  check('渠道条目数仍是原数', view.querySelectorAll('.rt-item').length,
    real.categories.reduce((a, c) => a + c.channels.length, 0));
}
console.log('');

process.exit(done() ? 0 : 1);
