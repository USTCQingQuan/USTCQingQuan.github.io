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
    appendChild(c) { c.parentNode = this; this.children.push(c); return c; },
    // insertBefore 必须真的插到参照节点前面 —— 页面用它把分类标签
    // 插到"只看免费"之前。桩里直接 push 的话顺序会错，测试里读位置就会误判。
    insertBefore(c, ref) {
      c.parentNode = this;
      const i = ref ? this.children.indexOf(ref) : -1;
      if (i >= 0) this.children.splice(i, 0, c);
      else this.children.push(c);
      return c;
    },
    // remove() 是标准 DOM API，真实浏览器里每个节点都有。
    // 页面用它清掉旧的分类标签（renderChips 里），桩不提供就会报
    // "c.remove is not a function" —— 又是桩的能力缺失。
    remove() {
      const p = this.parentNode;
      if (!p) return;
      const i = p.children.indexOf(this);
      if (i >= 0) p.children.splice(i, 1);
      this.parentNode = null;
    },
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
// 测试里默认打开分类条：多数用例靠点分类条切换视图。
// 想验证「分类条已关闭」的真实状态，用例里 delete globalThis.__FORCE_SUBNAV__ 再 boot。
globalThis.__FORCE_SUBNAV__ = true;

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
  // location.hash 必须可读可写：页面用 hash 路由（#/rights/channels）。
  // 写入 hash 时同步触发 hashchange 监听，模拟浏览器行为。
  const winListeners = {};
  globalThis.location = {
    protocol: opts.protocol || 'file:',
    _hash: opts.hash || '',
    get hash() { return this._hash; },
    set hash(v) {
      const nv = String(v);
      if (this._hash === nv) return;
      this._hash = nv;
      for (const fn of winListeners.hashchange || []) fn({ type: 'hashchange' });
    },
  };
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
    // 页面监听 hashchange 来做路由
    addEventListener(ev, fn) { (winListeners[ev] = winListeners[ev] || []).push(fn); },
    removeEventListener(ev, fn) {
      const arr = winListeners[ev] || [];
      const i = arr.indexOf(fn);
      if (i >= 0) arr.splice(i, 1);
    },
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

/* 两级导航辅助。
   网站结构改为「权益服务 / 学习资源」两个一级分类，下面各有子视图，
   所以测试里"切到某个视图"要点两次（一级 + 二级）。
   集中在这里，避免每个测试各写一份、以后改结构时漏改。 */
export function makeNav(ids) {
  const modeBtns = () => ids.modebar.children.filter((c) => (c.className || '').includes('mode-btn'));
  const subBtns = () => ids.subnav.children.filter((c) => (c.className || '').includes('sub-btn'));
  const SECTION_OF = {
    library: '学习资源', guides: '学习资源', skills: '学习资源', exams: '学习资源',
    channels: '学生权益反馈渠道', key: '学生权益反馈渠道', platforms: '学生权益反馈渠道', campus: '学生权益反馈渠道',
    repair: '校园报修', dept: '部门直拨电话', teach: '教学服务',
    campusall: '校园平台', campus: '校园平台', platforms: '校园平台',
  };
  const LABEL_OF = {
    library: '资源库', guides: '学习路径', skills: '技能自查', exams: '历年试卷',
    channels: '全部渠道', key: '主渠道', platforms: '校内平台', campus: '校园信息',
    repair: '报修入口', dept: '电话清单', teach: '教学与课程',
    campusall: '全部',
  };
  // 切到指定子视图：先点一级（若当前不在该分类），再点二级
  function go(subId) {
    const sec = SECTION_OF[subId];
    if (sec) {
      const b = modeBtns().find((x) => x.textContent === sec);
      if (b) b.fire('click');
    }
    const sb = subBtns().find((x) => x.textContent.indexOf(LABEL_OF[subId]) === 0);
    if (sb) sb.fire('click');
  }
  // 回首页
  function home() {
    const b = modeBtns().find((x) => x.textContent === '首页');
    if (b) b.fire('click');
  }
  return { go, home, modeBtns, subBtns };
}
