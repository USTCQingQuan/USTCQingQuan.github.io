// 回归 · 视图与路由
// 覆盖：6 个分区的路由落点、导航高亮、底部栏已移除、内嵌数据兜底、XSS 面、重复点击
import { readFile } from 'node:fs/promises';
import { setupDom, loadScript, makeChecker } from './dom-stub.mjs';

const { script } = await loadScript('index.html');
const CHANNELS_RAW = await readFile('channels.json', 'utf8');
const { check, done } = makeChecker();

const IDS = [
  'grid', 'empty', 'q', 'freeOnly', 'chips', 'subchips', 'modebar', 'subnav', 'resultBar',
  'view-home', 'iconGrid', 'promoBody', 'detail-mask', 'detail-box',
  'view-resources', 'view-channels', 'view-key', 'view-repair', 'view-dept', 'view-teach', 'view-union',
];

const VIEWS = ['view-home', 'view-resources', 'view-channels', 'view-key',
  'view-repair', 'view-dept', 'view-teach', 'view-union'];

let quiet = false;
const origError = console.error;
console.error = function () { if (!quiet) origError.apply(console, arguments); };

function boot(hash, mode) {
  const dom = setupDom(IDS, { protocol: 'https:', hash });
  globalThis.fetch = async (u) => {
    if (mode === 'allfail') return { ok: false, status: 500, json: async () => ({}) };
    if (String(u).indexOf('channels.json') >= 0) {
      return { ok: true, status: 200, json: async () => JSON.parse(CHANNELS_RAW) };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };
  let err = null;
  try { eval(script); } catch (e) { err = e; }
  return { ids: dom.ids, err };
}

function shown(ids) {
  return VIEWS.filter((v) => ids[v] && ids[v].hidden === false);
}

console.log('=== 1. 路由：每个地址都恰好显示一个视图 ===');
const CASES = [
  ['', 'view-home'],
  ['#/', 'view-home'],
  ['#/rights', 'view-key'],
  ['#/rights/key', 'view-key'],
  ['#/rights/channels', 'view-channels'],
  ['#/union', 'view-union'],
  ['#/union/union', 'view-union'],
  ['#/repair', 'view-repair'],
  ['#/dept', 'view-dept'],
  ['#/teach', 'view-teach'],
  ['#/campus', 'view-resources'],
  ['#/campus/campusall', 'view-resources'],
  ['#/nonexistent', 'view-home'],
  ['#/rights/', 'view-key'],
  ['#', 'view-home'],
  ['#/campus/extra', 'view-resources'],
];

for (const [hash, expect] of CASES) {
  const { ids, err } = boot(hash);
  const label = hash || '(空)';
  if (err) { check('hash=' + label + ' 不抛错', false, true); continue; }
  const s = shown(ids);
  console.log('  ' + label.padEnd(22) + '→ ' + (s.join(',') || '(白屏!)'));
  check('hash=' + label + ' 恰好一个视图', s.length, 1);
  check('hash=' + label + ' 落到 ' + expect, s[0] || '', expect);
}

console.log('');
console.log('=== 2. 顶部导航：首页 + 5 个分区 ===');
{
  const { ids } = boot('#/');
  const tops = ids.modebar.children.filter((c) => (c.className || '').includes('mode-btn'));
  const labels = tops.map((b) => b.textContent);
  console.log('  ' + labels.join(' | '));
  check('一级按钮数', tops.length, 6);
  check('一级按钮文案', labels.join(' | '),
    '首页 | 学生权益反馈渠道 | 校园报修 | 部门直拨电话 | 教学服务 | 校园平台');
  check('学生会不在顶部导航里', labels.indexOf('学生会反馈渠道') >= 0, false);
}

console.log('');
console.log('=== 3. 深链下导航高亮同步 ===');
{
  const CASES2 = [
    ['#/repair', '校园报修'],
    ['#/dept', '部门直拨电话'],
    ['#/teach', '教学服务'],
    ['#/campus/campusall', '校园平台'],
    ['#/rights/key', '学生权益反馈渠道'],
  ];
  for (const [hash, expect] of CASES2) {
    const { ids } = boot(hash);
    const tops = ids.modebar.children.filter((c) => (c.className || '').includes('mode-btn'));
    const active = tops.filter((b) => (b.className || '').includes('active'));
    console.log('  ' + hash.padEnd(22) + '高亮: ' + (active.map((b) => b.textContent).join(',') || '(无)'));
    check(hash + ' 高亮 ' + expect, active.length === 1 && active[0].textContent === expect, true);
  }
  const { ids } = boot('#/union/union');
  const tops = ids.modebar.children.filter((c) => (c.className || '').includes('mode-btn'));
  const active = tops.filter((b) => (b.className || '').includes('active'));
  check('学生会页不高亮任何一级按钮', active.length, 0);
}

console.log('');
console.log('=== 3b. 部门直拨电话页（单列列表） ===');
{
  quiet = true;
  const { ids } = boot('#/dept');
  await new Promise((r) => setTimeout(r, 150));
  quiet = false;

  const dep = ids['view-dept'];
  const list = dep.querySelector('.dept-list');
  check('用了单列列表版式', !!list, true);

  const rows = dep.querySelectorAll('.dept-row');
  console.log('  电话行数: ' + rows.length);
  check('电话 9 条', rows.length, 9);

  if (rows.length) {
    const first = rows[0];
    const name = first.querySelector('.dept-name').textContent;
    const no = first.querySelector('.dept-no').textContent;
    console.log('  首行: ' + name + ' / ' + no);
    check('首行是后勤服务热线', name.indexOf('后勤服务热线') === 0, true);
    check('首行号码正确（带区号）', no, '0551-63606384');
    const go = first.querySelector('.dept-go');
    check('每行都有 tel: 拨号链接', !!go && String(go.href).indexOf('tel:') === 0, true);
  }

  check('页面上不出现「待核实」', dep.textContent.indexOf('待核实'), -1);
  check('不再停在载入提示', dep.querySelectorAll('.rt-loading').length, 0);
}

console.log('=== 4. 底部标签栏已移除 ===');
{
  const { ids } = boot('#/');
  check('页面上没有 tabbar 元素', !!ids.tabbar, false);
}

console.log('');
console.log('=== 5. 远端数据全部失败时，内嵌数据兜底 ===');
{
  quiet = true;
  const dom = setupDom(IDS, { protocol: 'https:', hash: '#/campus/campusall' });
  globalThis.fetch = async () => ({ ok: false, status: 500, json: async () => ({}) });
  let err = null;
  try { eval(script); } catch (e) { err = e; }
  await new Promise((r) => setTimeout(r, 100));
  quiet = false;
  check('不抛异常', !!err, false);
  const cards = dom.ids.grid.children.length;
  console.log('  校园平台卡片数: ' + cards + '（来自内嵌数据）');
  check('内嵌数据兜底，校园平台 6 条', cards, 6);
}

console.log('');
console.log('=== 6. 搜索框输入 HTML 不会被当标签解析 ===');
{
  quiet = true;
  const { ids } = boot('#/campus/campusall');
  await new Promise((r) => setTimeout(r, 80));
  ids.q.value = '<img src=x onerror=alert(1)>';
  let threw = false;
  try { ids.q.fire('input'); } catch (e) { threw = true; }
  quiet = false;
  check('输入 HTML 不抛错', threw, false);
  check('没生成 img 节点', ids.grid.querySelectorAll('img').length, 0);
}

console.log('');
console.log('=== 7. 连续点击导航不出错、不叠加视图 ===');
{
  const { ids } = boot('#/');
  const tops = ids.modebar.children.filter((c) => (c.className || '').includes('mode-btn'));
  let threw = false;
  try { for (let i = 0; i < 5; i++) tops.forEach((b) => b.fire('click')); } catch (e) { threw = true; }
  check('连续 5 轮点击不抛错', threw, false);
  check('仍然只显示一个视图', shown(ids).length, 1);
}

process.exit(done() ? 0 : 1);
