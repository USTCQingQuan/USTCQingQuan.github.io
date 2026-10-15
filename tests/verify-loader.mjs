// 回归测试：数据加载双路径
//   1) https 下走 resources.json 并重绘
//   2) file:// 下静默降级到内嵌数据
// 用法: node tests/verify-loader.mjs [index.html]
import { makeChecker, loadScript } from './dom-stub.mjs';
import { makeEl } from './dom-stub.mjs';

const FILE = process.argv[2] || 'index.html';
const { script } = await loadScript(FILE);
const { check, done } = makeChecker();

const FAKE = {
  resources: [
    { title: 'FAKE-FETCH 甲', description: '来自 fetch', category: '校内平台', subcategory: '选课与课程评价', url: 'https://a.test/', icon: 'A', free: true, tags: ['x'], source: 'a.test', cost: '免费' },
    { title: 'FAKE-FETCH 乙', description: '来自 fetch', category: '学术科研', subcategory: '文献检索', url: 'https://b.test/', icon: 'B', free: false, tags: ['y'], source: 'b.test', cost: '付费' },
    { title: 'FAKE-FETCH 丙', description: '来自 fetch', category: '编程开发', subcategory: '算法与刷题', url: 'https://c.test/', icon: 'C', free: true, tags: ['z'], source: 'c.test', cost: '免费' },
  ],
};

function runOnce(protocol) {
  const ids = {};
  for (const id of ['grid', 'empty', 'q', 'freeOnly', 'chips', 'subchips', 'modebar',
    'view-resources', 'view-guides', 'view-skills', 'detail-mask', 'detail-box']) ids[id] = makeEl('div');
  const byId = { total: makeEl('b'), freeCount: makeEl('b'), catCount: makeEl('b'), ...ids };
  ids.q.value = ''; ids.freeOnly.checked = false; ids.subchips.hidden = true; ids['detail-mask'].hidden = true;
  const ft = makeEl('label'); ft.className = 'free-toggle'; ids.chips.children.push(ft);

  let fetchCalled = null;
  globalThis.document = {
    getElementById: (i) => byId[i] || null,
    createElement: (t) => makeEl(t),
    createTextNode: (t) => { const n = makeEl('#text'); n.textContent = t; return n; },
    querySelector: () => null,
    addEventListener() {},
    body: makeEl('body'),
  };
  globalThis.location = { protocol, href: protocol + '//x.test/' };
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.confirm = () => true;
  globalThis.window = { scrollTo() {}, open() {} };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, writable: true, value: {} });
  globalThis.fetch = async (u) => {
    fetchCalled = String(u);
    return { ok: true, status: 200, json: async () => FAKE };
  };

  eval(script);
  const sync = { cards: ids.grid.children.length, total: byId.total.textContent, free: byId.freeCount.textContent };
  return new Promise((resolve) => setTimeout(() => {
    const badges = ids.grid.children.map((c) => {
      const m = (c.innerHTML || '').match(/<span class="badge cat">([^<]*)<\/span>/);
      return m ? m[1] : null;
    });
    resolve({ fetchCalled, sync, async: { cards: ids.grid.children.length, total: byId.total.textContent, free: byId.freeCount.textContent, badges } });
  }, 60));
}

console.log('=== 场景 1: https（应走 fetch 并重绘）===');
const a = await runOnce('https:');
console.log('  同步(内嵌兜底): ' + JSON.stringify(a.sync));
console.log('  fetch 调用     : ' + a.fetchCalled);
console.log('  异步(网络数据) : ' + JSON.stringify(a.async));
check('fetch 请求了 resources.json', a.fetchCalled, 'resources.json');
check('异步后卡片数', a.async.cards, 3);
check('异步后总数', a.async.total, '3');
check('异步后免费数', a.async.free, '2');
check('异步后分类徽章', JSON.stringify(a.async.badges), JSON.stringify(['校内平台', '学术科研', '编程开发']));

console.log('\n=== 场景 2: file://（不应调用 fetch，保持内嵌数据）===');
const b = await runOnce('file:');
console.log('  同步           : ' + JSON.stringify(b.sync));
console.log('  fetch 调用     : ' + b.fetchCalled);
console.log('  异步           : ' + JSON.stringify({ cards: b.async.cards, total: b.async.total, free: b.async.free }));
check('fetch 未被调用', b.fetchCalled, null);
check('卡片数保持 170', b.async.cards, 170);
check('总数保持 170', b.async.total, '170');

process.exit(done() ? 0 : 1);
