// 共享 DOM 桩：给所有验证脚本使用。
//
// 为什么合并：此前每个验证脚本各写了一份桩，能力不一致（有的 querySelector 不支持后代选择器、
// 有的 parseFragment 造裸对象、有的 classList 与 className 不同步），导致同一个页面在不同脚本里
// 表现不同，浪费了大量时间排查"到底是桩的问题还是页面的问题"。统一成一份，行为只需对齐一次。
//
// 已知与真实 DOM 的差异（不影响本项目断言，但使用时要心里有数）：
//   1. querySelector 会向下递归整个子树并返回第一个匹配（真实 DOM 还会区分直接子元素）；
//      因此断言"某行的某个格子"时必须用 children 直接取，不能用 row.querySelector。
//   2. 不支持 CSS 伪类、属性选择器、:nth-child 等。
//   3. 没有布局：getBoundingClientRect、offsetWidth 等一律不可用。

export function makeEl(tag) {
  const el = {
    tag, children: [], _text: '', style: { setProperty() {} }, hidden: false,
    className: '', listeners: {}, attrs: {},
    // 表单类元素必须有 value / checked / type —— 真实浏览器里它们恒存在（空串 / false）。
    // 踩过的坑：桩里没有 value 时，页面读 inp.value.trim() 会抛
    // "Cannot read properties of undefined"，而错误位置在页面代码里，
    // 极易被误判成页面 bug（排查花了很久）。凡是页面会碰的原生属性都要给默认值。
    value: '', checked: false, type: '', placeholder: '',
    get textContent() { return this._text + this.children.map((c) => c.textContent).join(''); },
    set textContent(v) { this._text = String(v); this.children = []; },
    get innerHTML() { return this._html == null ? '' : this._html; },
    set innerHTML(v) { this._html = v; this.children = v === '' ? [] : parseFragment(v); },
    setAttribute(k, v) { this.attrs[k] = String(v); },
    getAttribute(k) { return this.attrs[k]; },
    // id 需要同时可从 el.id 读取、也能被 findById 通过 attrs.id 查到 ——
    // 页面两种写法都有（el.id = 'x' 与 setAttribute('id','x')），必须都支持。
    get id() { return this.attrs.id || ''; },
    set id(v) { this.attrs.id = String(v); },
    // childNodes 是标准 DOM API，真实浏览器里恒存在。
    // 页面用它判断"有没有插入过子节点"（如高亮时），桩里必须一并提供，
    // 否则会报 undefined —— 那是桩的能力缺失，不是页面 bug。
    get childNodes() { return this.children; },
    focus() {}, blur() {},
    appendChild(c) { this.children.push(c); return c; },
    insertBefore(c) { this.children.push(c); return c; },
    addEventListener(ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); },
    fire(ev, payload) {
      const e = Object.assign({ preventDefault() {}, stopPropagation() {}, target: this }, payload || {});
      for (const fn of this.listeners[ev] || []) fn(e);
    },
    querySelectorAll(sel) {
      const parts = sel.split(/\s+/); let cur = [this];
      for (const p of parts) {
        const isId = p.startsWith('#');
        const isCls = p.startsWith('.');
        // 支持复合类选择器（.a.b）—— 页面用 querySelectorAll('.rt-item.todo') 这类写法。
        // 踩过的坑：早先按单个类匹配，'.rt-item.todo' 会被当成一个叫 "rt-item.todo" 的类，
        // 永远匹配不到，测试报"待补充条目 0 个"，看着像页面 bug，其实是桩太弱。
        const wantCls = isCls ? p.split('.').filter(Boolean) : [];
        const want = p.replace(/^[.#]/, '');
        const next = [];
        const walk = (n) => {
          for (const c of n.children) {
            const cls = (c.className || '').split(/\s+/).filter(Boolean);
            const cid = (c.attrs && c.attrs.id) || '';
            let hit;
            if (isId) hit = cid === want;
            else if (isCls) hit = wantCls.every((w) => cls.includes(w));
            else hit = c.tag === want;
            if (hit) next.push(c);
            walk(c);
          }
        };
        for (const n of cur) walk(n);
        cur = next;
      }
      return cur;
    },
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; },
    // classList 与 className 是同一份数据的两种视图，必须同步写回
    classList: {
      _set() { return new Set(String(this._owner.className || '').split(/\s+/).filter(Boolean)); },
      _commit(s) { this._owner.className = [...s].join(' '); },
      add(...c) { const s = this._set(); c.forEach((x) => s.add(x)); this._commit(s); },
      remove(...c) { const s = this._set(); c.forEach((x) => s.delete(x)); this._commit(s); },
      toggle(c, on) { const s = this._set(); on ? s.add(c) : s.delete(c); this._commit(s); },
      contains(c) { return this._set().has(c); },
    },
  };
  el.classList = Object.create(el.classList);
  el.classList._owner = el;
  return el;
}

export function parseFragment(str) {
  const root = { tag: '#root', children: [], className: '', attrs: {}, querySelectorAll: () => [], querySelector: () => null };
  const stack = [root];
  const re = /<(\/?)([a-zA-Z][\w-]*)((?:\s+[^>]*?)?)\/?>/g;
  let m;
  while ((m = re.exec(str))) {
    if (m[1] === '/') {
      for (let i = stack.length - 1; i > 0; i--) if (stack[i].tag === m[2]) { stack.length = i; break; }
      continue;
    }
    // 解析出的节点必须是完整元素对象（带 addEventListener 等方法），
    // 否则页面里 a.querySelector(".card-jump").addEventListener(...) 会失败。
    const node = makeEl(m[2]);
    const attrs = m[3] || '';
    const cls = attrs.match(/class="([^"]*)"/); if (cls) node.className = cls[1];
    const href = attrs.match(/href="([^"]*)"/); if (href) node.href = href[1];
    for (const am of attrs.matchAll(/([a-zA-Z-]+)="([^"]*)"/g)) node.attrs[am[1]] = am[2];
    stack[stack.length - 1].children.push(node);
    if (!/\/$/.test(m[0])) stack.push(node);
  }
  return root.children;
}

// 建立完整页面环境。idList 里列出的 id 都会提供对应元素；返回 { byId, ids, calls }
export function setupDom(idList, opts = {}) {
  const ids = {};
  for (const id of idList) ids[id] = makeEl('div');
  const byId = Object.assign({ total: makeEl('b'), freeCount: makeEl('b'), catCount: makeEl('b') }, ids);

  const q = ids.q || makeEl('input');
  q.value = '';
  if (ids.freeOnly) ids.freeOnly.checked = false;
  if (ids.subchips) ids.subchips.hidden = true;
  if (ids['detail-mask']) ids['detail-mask'].hidden = true;

  // 工具栏里的"只看免费"标签需预先存在，页面会 insertBefore 到它前面
  if (ids.chips) {
    const ft = makeEl('label');
    ft.className = 'free-toggle';
    ids.chips.children.push(ft);
  }

  const toolbar = makeEl('div'); toolbar.className = 'toolbar';
  const body = makeEl('body');
  const docListeners = {};
  const calls = { opened: [], copied: [] };

  // getElementById 必须能在【整棵树】里按 id 查，而不只是预设的顶层元素。
  // 真实浏览器就是这样：页面运行时 createElement + el.id = 'x' 之后，
  // document.getElementById('x') 立刻能查到。
  // 踩过的坑：只查预设表时，页面里动态创建的 #exQ / #exCat 全返回 null，
  // 页面在赋值 .hidden 时抛错 —— 那是桩的缺陷，却表现成"页面有 bug"。
  function findById(root, id) {
    if (!root || !root.children) return null;
    for (const c of root.children) {
      if (c.attrs && c.attrs.id === id) return c;
      const got = findById(c, id);
      if (got) return got;
    }
    return null;
  }

  globalThis.document = {
    getElementById: (i) => {
      if (byId[i]) return byId[i];
      for (const key of Object.keys(byId)) {
        const got = findById(byId[key], i);
        if (got) return got;
      }
      return null;
    },
    createElement: (t) => makeEl(t),
    createTextNode: (t) => { const n = makeEl('#text'); n.textContent = t; return n; },
    // DocumentFragment 是真实浏览器标配，页面用它批量拼接再一次性插入。
    // 桩里用一个普通容器代替即可 —— appendChild 到 fragment 后再整体 append，语义一致。
    createDocumentFragment: () => makeEl('#fragment'),
    querySelector: (s) => (s === '.toolbar' ? toolbar : null),
    addEventListener: (ev, fn) => { (docListeners[ev] = docListeners[ev] || []).push(fn); },
    fire(ev, payload) {
      const e = Object.assign({ preventDefault() {}, stopPropagation() {} }, payload || {});
      for (const fn of docListeners[ev] || []) fn(e);
    },
    body,
  };
  globalThis.location = { protocol: opts.protocol || 'file:', href: (opts.protocol || 'file:') + '///x/index.html' };
  globalThis.fetch = async () => { throw new Error('file:// 不应调用 fetch'); };

  const store = {};
  globalThis.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  };
  globalThis.confirm = () => true;
  globalThis.window = {
    scrollTo() {},
    open: (u, t) => { calls.opened.push({ u, t }); },
  };
  // Node 的 navigator 是只读的，必须 defineProperty
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true, writable: true,
    value: { clipboard: { writeText: (s) => { calls.copied.push(s); return Promise.resolve(); } } },
  });

  return { byId, ids, calls, store, body, toolbar };
}

// 断言小工具：统一输出格式并累计失败数
export function makeChecker() {
  const state = { fail: 0 };
  const check = (label, got, want) => {
    const ok = String(got) === String(want);
    if (!ok) state.fail++;
    console.log('  ' + (ok ? '✓' : '✗') + ' ' + label.padEnd(44) + got + (ok ? '' : ' （期望 ' + want + '）'));
    return ok;
  };
  const done = () => {
    console.log('\n' + '='.repeat(60));
    console.log(state.fail === 0 ? '全部通过 ✓' : '有 ' + state.fail + ' 项失败 ✗');
    return state.fail === 0;
  };
  return { check, done, state };
}

// 从 index.html 抽出内联脚本
export async function loadScript(file) {
  const { readFile } = await import('node:fs/promises');
  const html = await readFile(file, 'utf8');
  const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');
  return { html, script };
}
