// 回归 · 校园平台页（6 条资源 + 搜索 + 筛选）
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

console.log('=== 1. 默认显示全部 6 条 ===');
{
  const ids = boot('#/campus/campusall');
  const cards = ids.grid.children.length;
  console.log('  卡片数: ' + cards);
  check('校园平台 6 条', cards, CAMPUS.length);
  check('分类条显示「全部」', ids.chips.querySelectorAll('.chip').length > 0, true);
}

console.log('');
console.log('=== 2. 分类筛选 ===');
{
  const ids = boot('#/campus/campusall');
  const chips = ids.chips.querySelectorAll('.chip');
  const labels = chips.map((c) => c.textContent);
  console.log('  chips: ' + labels.join(' / '));
  check('只有「全部 / 校内平台」两个 chip', labels.length, 2);

  const only = chips.find((c) => c.textContent.indexOf('校内平台') === 0);
  only.fire('click');
  console.log('  点「校内平台」后卡片数: ' + ids.grid.children.length);
  check('筛选后仍是 6 条', ids.grid.children.length, CAMPUS.length);
}

console.log('');
console.log('=== 3. 搜索 ===');
{
  const ids = boot('#/campus/campusall');
  const q = ids.q;

  q.value = '评课';
  q.fire('input');
  const n1 = ids.grid.children.length;
  console.log('  搜「评课」: ' + n1 + ' 条');
  check('搜到评课社区', n1, 1);

  q.value = 'zzz不存在的关键词zzz';
  q.fire('input');
  const n2 = ids.grid.children.length;
  console.log('  搜不存在的词: ' + n2 + ' 条');
  check('搜不到时 0 条', n2, 0);
  check('显示空状态提示', ids.empty.hidden, false);

  q.value = '';
  q.fire('input');
  console.log('  清空后: ' + ids.grid.children.length + ' 条');
  check('清空搜索恢复 6 条', ids.grid.children.length, CAMPUS.length);
}

console.log('');
console.log('=== 4. 只看免费 ===');
{
  const ids = boot('#/campus/campusall');
  const freeCount = CAMPUS.filter((r) => r.free).length;
  ids.freeOnly.checked = true;
  ids.freeOnly.fire('change');
  console.log('  勾选「只看免费」: ' + ids.grid.children.length + ' / 免费共 ' + freeCount);
  check('只看免费后条数正确', ids.grid.children.length, freeCount);
}

console.log('');
console.log('=== 5. 详情弹层 ===');
{
  const ids = boot('#/campus/campusall');
  const first = ids.grid.children[0];
  first.fire('click');
  console.log('  detail-mask hidden: ' + ids['detail-mask'].hidden);
  check('点击卡片打开详情', ids['detail-mask'].hidden, false);
  check('详情里显示标题', ids['detail-box'].textContent.length > 0, true);
}

process.exit(done() ? 0 : 1);
