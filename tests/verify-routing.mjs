// 路由与健壮性测试（修正版）
import { readFile } from 'node:fs/promises';
import { setupDom, loadScript, makeChecker } from './dom-stub.mjs';

const { script } = await loadScript('index.html');
const CHANNELS_RAW = await readFile('channels.json', 'utf8');
const { check, done } = makeChecker();

const IDS = [
  'grid', 'empty', 'q', 'freeOnly', 'chips', 'subchips', 'modebar', 'subnav', 'resultBar',
  'view-home', 'iconGrid', 'heroBanner', 'tabbar', 'view-resources', 'view-guides',
  'view-skills', 'view-exams', 'view-channels', 'view-key', 'view-repair', 'view-dept', 'view-teach', 'view-union', 'promoBody', 'detail-mask', 'detail-box',
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
  return ['view-home', 'view-resources', 'view-guides', 'view-skills', 'view-exams', 'view-channels', 'view-key', 'view-repair', 'view-dept', 'view-teach', 'view-union']
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
  ['#/rights', 'view-key'], ['#/rights/channels', 'view-channels'],
  ['#/rights/platforms', 'view-key'],   // 已合并到「校园平台」，旧路由回落到分区首个子视图
  ['#/rights/campus', 'view-key'],
  ['#/repair', 'view-repair'], ['#/repair/repair', 'view-repair'],
  ['#/dept', 'view-dept'], ['#/dept/dept', 'view-dept'],
  ['#/teach', 'view-teach'], ['#/teach/teach', 'view-teach'],
  ['#/campus', 'view-resources'], ['#/campus/campusall', 'view-resources'],
  ['#/study', 'view-resources'], ['#/study/library', 'view-resources'],
  ['#/study/guides', 'view-guides'], ['#/study/skills', 'view-skills'],
  ['#/study/exams', 'view-exams'],
  ['#/nonexistent', 'view-home'],
  ['#/study/nonexistent', 'view-resources'],
  ['#/rights/', 'view-key'], ['#', 'view-home'], ['#/study/exams/extra', 'view-exams'],
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
  check('权益深链一级高亮「学生权益反馈渠道」', at2 ? at2.textContent : '', '学生权益反馈渠道');
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

console.log('=== 5c. 校园报修页 ===');
{
  quiet = true;
  const { ids } = boot('#/repair', undefined, true);
  await new Promise((r) => setTimeout(r, 150));
  quiet = false;
  const rep = ids['view-repair'];
  const cats = rep.querySelectorAll('.rt-cat');
  console.log('  报修页分组数: ' + cats.length);
  check('报修页只显示一组', cats.length, 1);
  if (cats.length) {
    const head = cats[0].querySelector('h3').textContent.replace(/\s+/g, ' ').trim();
    console.log('  分组名: ' + head);
    check('这一组是校园报修', head.indexOf('校园报修') === 0, true);
    const items = cats[0].querySelectorAll('.rt-item');
    console.log('  报修渠道数: ' + items.length);
    check('报修渠道 3 条', items.length, 3);
  }
  check('不再停在载入提示', rep.querySelectorAll('.rt-loading').length, 0);
}

console.log('=== 5d. 部门直拨电话页 ===');
{
  quiet = true;
  const { ids } = boot('#/dept', undefined, true);
  await new Promise((r) => setTimeout(r, 150));
  quiet = false;
  const dep = ids['view-dept'];
  const cats = dep.querySelectorAll('.rt-cat');
  console.log('  电话页分组数: ' + cats.length);
  check('电话页只显示一组', cats.length, 1);
  if (cats.length) {
    const head = cats[0].querySelector('h3').textContent.replace(/\s+/g, ' ').trim();
    console.log('  分组名: ' + head);
    check('这一组是各部门直拨电话', head.indexOf('各部门直拨电话') === 0, true);
    const items = cats[0].querySelectorAll('.rt-item');
    console.log('  电话渠道数: ' + items.length);
    check('电话渠道 11 条', items.length, 11);
    const phones = cats[0].querySelectorAll('.rt-item .rt-go');
    console.log('  拨号按钮数: ' + phones.length);
    check('每条都有拨号按钮', phones.length, 11);
  }
  check('不再停在载入提示', dep.querySelectorAll('.rt-loading').length, 0);
}

console.log('=== 5e. 教学服务页 ===');
{
  quiet = true;
  const { ids } = boot('#/teach', undefined, true);
  await new Promise((r) => setTimeout(r, 150));
  quiet = false;
  const tea = ids['view-teach'];
  const cats = tea.querySelectorAll('.rt-cat');
  console.log('  教学服务页分组数: ' + cats.length);
  check('教学服务页只显示两组', cats.length, 2);
  if (cats.length === 2) {
    const heads = cats.map((c) => c.querySelector('h3').textContent.replace(/\s+/g, ' ').trim());
    heads.forEach((h, i) => console.log('    ' + (i + 1) + '. ' + h));
    check('第一组是教学与课程', heads[0].indexOf('教学与课程') === 0, true);
    check('第二组是学习资源与服务', heads[1].indexOf('学习资源与服务') === 0, true);
  }
  const items = tea.querySelectorAll('.rt-item');
  console.log('  渠道条目数: ' + items.length);
  check('教学服务 3 条渠道（1+2）', items.length, 3);
  check('不再停在载入提示', tea.querySelectorAll('.rt-loading').length, 0);
}

console.log('=== 5e2. 四个快捷页都不带说明框 ===');
{
  quiet = true;
  const PAGES = ['key', 'repair', 'dept', 'teach'];
  for (const sub of PAGES) {
    const { ids } = boot('#/' + (sub === 'key' ? 'rights/key' : sub), undefined, true);
    await new Promise((r) => setTimeout(r, 120));
    const view = ids['view-' + sub];
    const intro = view ? view.querySelectorAll('.rt-intro') : [];
    const cats = view ? view.querySelectorAll('.rt-cat') : [];
    console.log('  ' + sub + ': 说明框 ' + intro.length + ' / 分组 ' + cats.length);
    check(sub + ' 页没有说明框', intro.length, 0);
    check(sub + ' 页仍有内容', cats.length > 0, true);
  }
  quiet = false;
}

console.log('=== 5f. 分类条与说明框已隐藏（真实状态） ===');
{
  // 临时关掉测试开关，看用户实际看到的样子
  delete globalThis.__FORCE_SUBNAV__;
  quiet = true;
  const { ids } = boot('#/rights/key', undefined, true);
  await new Promise((r) => setTimeout(r, 150));
  quiet = false;

  console.log('  subnav.hidden = ' + ids.subnav.hidden);
  check('分类条默认隐藏', ids.subnav.hidden, true);
  check('分类条里没有子按钮', ids.subnav.children.length, 0);

  const key = ids['view-key'];
  const intro = key.querySelectorAll('.rt-intro');
  console.log('  说明框数量: ' + intro.length);
  check('精简页没有说明框', intro.length, 0);
  check('精简页仍有 3 组内容', key.querySelectorAll('.rt-cat').length, 3);

  // 深链接仍能直达（分类条没了，但路由还在）
  const { ids: ids2 } = boot('#/rights/channels', undefined, true);
  await new Promise((r) => setTimeout(r, 150));
  console.log('  深链 #/rights/channels 显示: ' + (ids2['view-channels'].hidden ? '(隐藏)' : 'view-channels'));
  check('深链接仍可直达全部渠道', ids2['view-channels'].hidden, false);

  globalThis.__FORCE_SUBNAV__ = true;   // 还原，后面的用例还要用
}

console.log('=== 5g. 校园平台（校内平台 + 校园信息 合并） ===');
{
  quiet = true;
  const { ids } = boot('#/campus/campusall', undefined, true);
  await new Promise((r) => setTimeout(r, 150));
  quiet = false;
  const grid = ids.grid;
  const cards = grid.children.length;
  console.log('  合并后卡片数: ' + cards);
  check('校园平台合并后 35 条（30+5）', cards, 35);

  const chips = ids.chips.querySelectorAll('.chip');
  const chipText = chips.map((c) => c.textContent);
  console.log('  分类 chips: ' + chipText.join(' / '));
  check('chips 里同时含校内平台与校园信息',
    chipText.some((x) => x.indexOf('校内平台') === 0) && chipText.some((x) => x.indexOf('校园信息') === 0), true);
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
