// 回归 · 校园平台页（静态列表 + 详情弹层）
// 搜索与分类筛选已按"力求简洁"的要求整体移除，校园平台只剩 6 张静态卡片。
import { readFile } from 'node:fs/promises';
import { setupDom, loadScript, makeChecker } from './dom-stub.mjs';

const { script } = await loadScript('index.html');
const { check, done } = makeChecker();
const res = JSON.parse(await readFile('resources.json', 'utf8'));
const CAMPUS = res.resources.filter((r) => r.category === '校内平台');

const IDS = ['grid', 'empty', 'q', 'freeOnly', 'chips', 'subchips', 'modebar', 'subnav', 'resultBar',
  'view-home', 'iconGrid', 'promoBody', 'detail-mask', 'detail-box',
  'view-resources', 'view-channels', 'view-key', 'view-repair', 'view-dept', 'view-teach', 'view-union'];

function boot(hash) {
  const dom = setupDom(IDS, { protocol: 'https:', hash });
  globalThis.fetch = async () => ({ ok: false, status: 404, json: async () => ({}) });
  eval(script);
  return dom.ids;
}

console.log('=== 1. 列表直接显示全部 6 条 ===');
{
  const ids = boot('#/campus/campusall');
  const cards = ids.grid.children.length;
  console.log('  卡片数: ' + cards);
  check('校园平台 6 条', cards, CAMPUS.length);
  check('空态提示隐藏', ids.empty.hidden, true);
}

console.log('');
console.log('=== 2. 页面上没有搜索框与筛选按钮 ===');
{
  const html = await readFile('index.html', 'utf8');
  check('源码里没有搜索输入框', html.indexOf('id="q"'), -1);
  check('源码里没有「只看免费」', html.indexOf('只看免费'), -1);
  check('源码里没有工具栏容器', html.indexOf('class="toolbar"'), -1);
  check('源码里没有结果计数条', html.indexOf('resultBar'), -1);
}

console.log('');
console.log('=== 3. 卡片内容 ===');
{
  const ids = boot('#/campus/campusall');
  const first = ids.grid.children[0];
  const name = first.querySelector('.card-name').textContent;
  const badge = first.querySelector('.badge.cat').textContent;
  console.log('  首张: ' + name + ' / ' + badge);
  check('首张是评课社区', name.indexOf('评课') >= 0, true);
  check('分类标签是校内平台', badge, '校内平台');
  check('有跳转链接', String(first.href).indexOf('http') === 0, true);
}

console.log('');
console.log('=== 4. 点击卡片打开详情 ===');
{
  const ids = boot('#/campus/campusall');
  const first = ids.grid.children[0];
  first.fire('click');
  check('详情遮罩已打开', ids['detail-mask'].hidden, false);
  check('详情里有标题', ids['detail-box'].textContent.length > 0, true);
}

console.log('');
console.log('=== 5. 全部资源数 ===');
console.log('  resources.json: ' + res.resources.length + ' 条');
check('资源总数与 _count 一致', res.resources.length, res._count);

process.exit(done() ? 0 : 1);
