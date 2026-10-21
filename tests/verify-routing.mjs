// 路由与健壮性测试（修正版）
import { readFile } from 'node:fs/promises';
import { setupDom, loadScript, makeChecker } from './dom-stub.mjs';

const { script } = await loadScript('index.html');
const CHANNELS_RAW = await readFile('channels.json', 'utf8');
const { check, done } = makeChecker();

const IDS = [
  'grid', 'empty', 'q', 'freeOnly', 'chips', 'subchips', 'modebar', 'subnav', 'resultBar',
  'view-home', 'iconGrid', 'heroBanner', 'tabbar', 'view-resources', 'view-guides',
  'view-skills', 'view-exams', 'view-channels', 'view-key', 'promoBody', 'detail-mask', 'detail-box',
];

let quiet = false;
const origError = console.error;
console.error = function () { if (!quiet) origError.apply(console, arguments); };

function boot(hash, mode, forceStudy) {
  if (forceStudy) globalThis.__FORCE_STUDY__ = true;
  else delete globalThis.__FORCE_STUDY__;
  const dom = setupDom(IDS, { protocol: 'https:', hash });
  globalThis.fetch = async (u) => {
    const url = String(u);
    if (mode === 'allfail') return { ok: false, status: 500, json: async () => ({}) };
    if (url.indexOf('channels.json') >= 0) return { ok: true, status: 200, json: async () => JSON.parse(CHANNELS_RAW) };
    return { ok: false, status: 404, json: async () => ({}) };
  };
  let err = null;
  try { eval(script); } catch (e) { err = e; }
  return { ids: dom.ids, err };
}

function whichShown(ids) {
  return ['view-home', 'view-resources', 'view-guides', 'view-skills', 'view-exams', 'view-channels', 'view-key']
    .filter((v) => ids[v] && ids[v].hidden === false);
}

console.log('=== 1a. 学习资源【已下架】时：study 路由应回落首页 ===');
{
  const DOWN = [
    ['#/study', 'view-home'],
    ['#/study/library', 'view-home'],
    ['#/study/guides', 'view-home'],
    ['#/study/skills', 'view-home'],
    ['#/study/exams', 'view-home'],
    ['#/study/nonexistent', 'view-home'],
    ['#/study/exams/extra', 'view-home'],
  ];
  for (const [hash, expect] of DOWN) {
    const { ids, err } = boot(hash, undefined, false);
    if (err) { check(hash + ' 不抛错', false, true); continue; }
    const shown = whichShown(ids);
    console.log('  ' + hash.padEnd(24) + '→ ' + (shown.join(',') || '(白屏!)'));
    check(hash + ' 回落首页', shown[0] || '', expect);
  }
}

console.log('');
console.log('=== 1b. 强制打开学习资源时：16 种 hash 全部正确 ===');
const CASES = [
  ['', 'view-home'], ['#/', 'view-home'],
  ['#/rights', 'view-channels', 'view-key'], ['#/rights/channels', 'view-channels', 'view-key'],
  ['#/rights/platforms', 'view-resources'], ['#/rights/campus', 'view-resources'],
  ['#/study', 'view-resources'], ['#/study/library', 'view-resources'],
  ['#/study/guides', 'view-guides'], ['#/study/skills', 'view-skills'],
  ['#/study/exams', 'view-exams'],
  ['#/nonexistent', 'view-home'],
  ['#/study/nonexistent', 'view-resources'],
  ['#/rights/', 'view-channels', 'view-key'], ['#', 'view-home'], ['#/study/exams/extra', 'view-exams'],
];

for (const [hash, expect] of CASES) {
  const { ids, err } = boot(hash, undefined, true);
  if (err) { check('hash=' + JSON.stringify(hash) + ' 不抛错', false, true); continue; }
  const shown = whichShown(ids);
  const label = hash || '(空)';
  console.log('  ' + label.padEnd(24) + '→ ' + (shown.join(',') || '(白屏!)'));
  check('hash=' + label + ' 恰好一个视图', shown.length, 1);
  check('hash=' + label + ' 落到正确视图', shown[0] || '', expect);
}
delete globalThis.__FORCE_STUDY__;

console.log('');
console.log('=== 2. 深链下导航高亮同步 ===');
{
  const { ids } = boot('#/study/exams', undefined, true);
  const tops = ids.modebar.children.filter((c) => (c.className || '').includes('mode-btn'));
  const at = tops.find((b) => (b.className || '').includes('active'));
  check('一级高亮「学习资源」', at ? at.textContent : '', '学习资源');
  const subs = ids.subnav.children.filter((c) => (c.className || '').includes('sub-btn'));
  const as = subs.find((b) => (b.className || '').includes('active'));
  check('二级高亮「历年试卷」', as ? as.textContent.indexOf('历年试卷') : -1, 0);

  const { ids: ids2 } = boot('#/rights/channels');
  const tops2 = ids2.modebar.children.filter((c) => (c.className || '').includes('mode-btn'));
  const at2 = tops2.find((b) => (b.className || '').includes('active'));
  check('权益深链一级高亮「权益服务」', at2 ? at2.textContent : '', '权益服务');
}

console.log('');
console.log('=== 3. 底部标签栏处处存在 ===');
for (const h of ['#/', '#/rights/channels']) {
  const { ids } = boot(h);
  const tabs = ids.tabbar.children.filter((c) => (c.className || '').includes('tab-item'));
  check('hash=' + h + ' 底部标签数（下架后 3 项）', tabs.length, 3);
}
{
  const { ids } = boot('#/', undefined, true);
  const tabs = ids.tabbar.children.filter((c) => (c.className || '').includes('tab-item'));
  check('强制打开学习资源时底部 4 项', tabs.length, 4);
}

console.log('');
console.log('=== 4. 远端数据全部失败时，内嵌数据兜底 ===');
{
  quiet = true;
  const { ids, err } = boot('#/study/library', 'allfail', true);
  await new Promise((r) => setTimeout(r, 120));
  quiet = false;
  check('不抛异常', !!err, false);
  // 页面内嵌了 resources 数据，即使 fetch 全挂也应能渲染
  const cards = ids.grid.children.length;
  console.log('  资源卡片数: ' + cards + '（来自页面内嵌数据）');
  check('内嵌数据兜底，资源库仍有内容', cards, 151);
}

console.log('');
console.log('=== 5. 搜索框在无数据时输入不崩 ===');
{
  quiet = true;
  const { ids } = boot('#/study/library', 'allfail', true);
  await new Promise((r) => setTimeout(r, 80));
  ids.q.value = '<img src=x onerror=alert(1)>';
  let threw = false;
  try { ids.q.fire('input'); } catch (e) { threw = true; }
  quiet = false;
  check('搜索框输入 HTML 不抛错', threw, false);
  console.log('  输入 HTML 后卡片数: ' + ids.grid.children.length);
  // 关键：不能把输入当 HTML 解析（否则会生成 img 节点）
  const imgs = ids.grid.querySelectorAll('img');
  check('输入 <img> 没被当成标签解析', imgs.length, 0);
}

console.log('');
console.log('=== 5b. 精简页在数据异步到达后也能渲染 ===');
{
  // 直接深链到精简页：首次渲染时 CHANNELS 还没到，会先显示「正在载入…」。
  // 数据到达后必须重新渲染，否则会一直卡在载入提示（线上实测踩过）。
  quiet = true;
  const { ids } = boot('#/rights/key');
  await new Promise((r) => setTimeout(r, 150));
  quiet = false;
  const key = ids['view-key'];
  const cats = key.querySelectorAll('.rt-cat');
  console.log('  异步加载后精简页分组数: ' + cats.length);
  check('精简页最终渲染出 3 组', cats.length, 3);
  check('不再停在载入提示', key.querySelectorAll('.rt-loading').length, 0);
}

console.log('=== 6. 重复点击同一导航项不出错 ===');
{
  const { ids } = boot('#/study/library', undefined, true);
  const tops = ids.modebar.children.filter((c) => (c.className || '').includes('mode-btn'));
  let threw = false;
  try {
    for (let i = 0; i < 5; i++) tops.forEach((b) => b.fire('click'));
  } catch (e) { threw = true; }
  check('连续 5 轮点击导航不抛错', threw, false);
  const shown = whichShown(ids);
  check('仍然只显示一个视图', shown.length, 1);
}

process.exit(done() ? 0 : 1);
