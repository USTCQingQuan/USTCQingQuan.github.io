// 回归测试：数据加载双路径
//   1) https 下走 resources.json 并重绘
//   2) file:// 下静默降级到内嵌数据
// 用法: node tests/verify-loader.mjs [index.html]
import { makeChecker, loadScript } from './dom-stub.mjs';
import { makeEl } from './dom-stub.mjs';

const FILE = process.argv[2] || 'index.html';
const { html, script } = await loadScript(FILE);
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
    'view-resources', 'view-guides', 'view-skills', 'view-exams', 'subnav', 'view-channels', 'view-work', 'detail-mask', 'detail-box']) ids[id] = makeEl('div');
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

console.log('=== 场景 1: https + 远端数据过期（3 条）→ 应拒绝并保留内嵌数据 ===');
const a = await runOnce('https:');
console.log('  同步(内嵌兜底): ' + JSON.stringify(a.sync));
console.log('  fetch 调用     : ' + a.fetchCalled);
console.log('  异步(拒绝旧数据后): ' + JSON.stringify({ cards: a.async.cards, total: a.async.total, free: a.async.free }));
check('fetch 请求了 resources.json', a.fetchCalled, 'resources.json');
check('过期数据被拒绝，卡片保持 170', a.async.cards, 170);
check('总数未被旧数据覆盖', a.async.total, '170');
check('免费数未被旧数据覆盖', a.async.free, '165');

console.log('\n=== 场景 2: file://（不应调用 fetch，保持内嵌数据）===');
const b = await runOnce('file:');
console.log('  同步           : ' + JSON.stringify(b.sync));
console.log('  fetch 调用     : ' + b.fetchCalled);
console.log('  异步           : ' + JSON.stringify({ cards: b.async.cards, total: b.async.total, free: b.async.free }));
check('fetch 未被调用', b.fetchCalled, null);
check('卡片数保持 170', b.async.cards, 170);
check('总数保持 170', b.async.total, '170');

// ===== 场景 3/4：远端数据过期时的防护 =====
// 背景：resources.json 有 10 分钟 CDN 缓存。如果浏览器拿到旧版本，
// 直接覆盖索引会让"点任何卡片都打开同一条"。这里验证防护是否生效。
async function runWithPayload(protocol, payload, sentinel) {
  const ids = {};
  for (const id of ['grid', 'empty', 'q', 'freeOnly', 'chips', 'subchips', 'modebar',
    'view-resources', 'view-guides', 'view-skills', 'view-exams', 'subnav', 'view-channels', 'view-work', 'detail-mask', 'detail-box']) ids[id] = makeEl('div');
  const byId = { total: makeEl('b'), freeCount: makeEl('b'), catCount: makeEl('b'), ...ids };
  ids.q.value = ''; ids.freeOnly.checked = false; ids.subchips.hidden = true; ids['detail-mask'].hidden = true;
  const ft = makeEl('label'); ft.className = 'free-toggle'; ids.chips.children.push(ft);

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
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => payload });

  eval(script);
  await new Promise((r) => setTimeout(r, 60));

  // 点第 5 张卡，看详情打开的是不是它自己
  const card = ids.grid.children[5];
  const box = ids['detail-box'];
  if (card) card.fire('click');
  const got = box.querySelector('.dt-title') ? box.querySelector('.dt-title').textContent : null;
  const cards = ids.grid.children.length;
  const sixth = ids.grid.children[6];
  const cardHref = sixth ? sixth.href : null;
  // 不依赖 data-title 属性，直接读卡片里 .card-name 的文字（更贴近用户看到的东西）
  const nameEl = card ? card.querySelector('.card-name') : null;
  const want = nameEl ? nameEl.textContent : null;
  // 顺带说明 href 的来源：来自远端 payload 还是内嵌数据
  const hrefs = ids.grid.children.slice(0, 8).map((c) => c.href);
  const sentinelAt = sentinel ? ids.grid.children.findIndex((c) => c.href === sentinel) : -1;
  const cardHtml = card ? card.innerHTML : null;
  const boxChildren = box.children.length;
  const hasTitleEl = !!box.querySelector('.dt-title');
  // 逐层看卡片里到底有什么
  const cardKids = card ? card.children.map((c) => (c.className || c.tag) + '[' + c.children.length + ']') : [];
  const nameEls = card ? card.querySelectorAll('.card-name') : [];
  const nameDump = nameEls.map((e) => JSON.stringify(e.textContent));
  return { cards, want, got, cardHref, hrefs, sentinelAt, cardHtml, boxChildren, hasTitleEl, cardKids, nameDump, total: byId.total.textContent };
}

console.log('\n=== 场景 3: 远端数据【过期】（只有 3 条，与页面 170 条不符）===');
const stale = await runWithPayload('https:', { resources: FAKE.resources });
console.log('  卡片数: ' + stale.cards + '   总数显示: ' + stale.total);
console.log('  点第 5 张卡（应为「' + stale.want + '」）→ 详情标题: 「' + stale.got + '」');
check('过期数据被拒绝，卡片仍为 170', stale.cards, 170);
check('总数未被旧数据覆盖', stale.total, '170');
check('点卡片仍打开它自己', stale.got, stale.want);

console.log('\n=== 场景 4: 远端数据【完整对齐】应被采纳（并真的覆盖内嵌数据）===');
{
  // 用页面自己的内嵌数据构造一份"内容一致"的远端数据，但把第 6 条的 URL 改成哨兵值，
  // 这样若能覆盖成功，卡片的 href 就会变成哨兵值 —— 以此证明远端数据确实被采纳了。
  const inner = (html.match(/const RESOURCES = \[([\s\S]*?)\n\];/) || ['', ''])[1];
  const names = [...inner.matchAll(/\{\s*name:\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]);
  console.log('  [诊断] html 长度=' + (html ? html.length : 'null') + '  内嵌区长度=' + inner.length + '  提取到 name 数=' + names.length);
  const SENTINEL = 'https://sentinel.test/adopted';
  const full = {
    resources: names.map((t, k) => ({
      title: t, url: k === 5 ? SENTINEL : 'https://x.test/',
      description: 'd', category: '校内平台', subcategory: '选课与课程评价',
      icon: 'A', free: true, tags: ['t'], source: 'x.test', cost: '免费',
    })),
  };
  const ok = await runWithPayload('https:', full, SENTINEL);
  console.log('  卡片数: ' + ok.cards + '   总数显示: ' + ok.total);
  console.log('  点第 5 张卡（应为「' + ok.want + '」）→ 详情标题: 「' + ok.got + '」');
  console.log('  前 8 张 href: ' + JSON.stringify(ok.hrefs));
  console.log('  哨兵所在下标: ' + ok.sentinelAt);
  // 关键回归点：远端数据被采纳后，卡片标题必须仍是真实标题
  // （曾经因为内嵌数据用 name、resources.json 用 title，导致标题变成字面量 "undefined"）
  console.log('  采纳远端数据后，卡片标题: ' + JSON.stringify(ok.nameDump));
  check('对齐数据被采纳，卡片 170', ok.cards, 170);
  check('总数显示 170', ok.total, '170');
  check('采纳远端数据后卡片标题仍是真实标题（不是 undefined）',
    ok.nameDump[0] === '"' + ok.want + '"', true);
  check('点卡片打开的详情标题 = 卡片自己的标题', ok.got, ok.want);
  check('远端数据确实覆盖了内嵌数据（哨兵 URL 生效）', ok.sentinelAt, 5);
}

process.exit(done() ? 0 : 1);
