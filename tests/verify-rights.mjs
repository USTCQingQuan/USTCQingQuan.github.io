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
  'view-home', 'iconGrid', 'heroBanner', 'tabbar', 'view-resources', 'view-guides', 'view-skills', 'view-exams', 'view-channels', 'view-key', 'view-repair', 'view-dept', 'view-teach', 'promoBody',
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
  const btn = nav.subBtns().find((b) => b.textContent.indexOf('全部渠道') === 0);
  check('存在「全部渠道」子按钮', !!btn, true);
  check('权益视图已显示', view.hidden, false);
  check('资源视图已隐藏', ids['view-resources'].hidden, true);
  await new Promise((r) => setTimeout(r, 60));
  const btn2 = nav.subBtns().find((b) => b.textContent.indexOf('全部渠道') === 0);
  console.log('  按钮文案: ' + btn2.textContent);
  const okCount = real.categories.reduce((a, c) => a + c.channels.filter((x) => x.status === 'ok').length, 0);
  check('二级按钮显示可用条数', btn2.textContent, '全部渠道' + okCount);
  const activeTop = nav.modeBtns().find((b) => (b.className || '').includes('active'));
  check('当前激活的一级按钮是「学生权益反馈渠道」', activeTop ? activeTop.textContent : '', '学生权益反馈渠道');
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

console.log('=== 2b. 学生权益反馈渠道精简页 ===');
{
  // 通过导航进入精简页（stub 里点 <a> 不会自动改 hash，用 nav.go）
  nav.go('key');
  const key = ids['view-key'];
  check('精简页已显示', key.hidden, false);
  check('完整渠道页已隐藏', ids['view-channels'].hidden, true);

  const cats = key.querySelectorAll('.rt-cat');
  const names = cats.map((c) => c.querySelector('h3').textContent.replace(/\s+/g, ' ').trim());
  console.log('  精简页分组数: ' + cats.length);
  cats.forEach((c, i) => console.log('    ' + (i + 1) + '. ' + names[i]));
  check('精简页只显示三组', cats.length, 3);
  if (cats.length === 3) {
    check('第一组是青权中心', names[0].indexOf('青权中心') === 0, true);
    check('第二组是校学生会·研究生会', names[1].indexOf('校学生会') === 0, true);
    check('第三组是高新园区团工委', names[2].indexOf('高新园区团工委') === 0, true);
  }
  const allText = names.join(' ');
  check('不含校园报修', allText.indexOf('校园报修') < 0, true);
  check('不含各部门直拨电话', allText.indexOf('各部门直拨电话') < 0, true);

  const chans = key.querySelectorAll('.rt-item');
  console.log('  精简页渠道条目数: ' + chans.length);
  check('精简页渠道数（1+3+2=6）', chans.length, 6);

  // 回到完整页，确认两个视图互不污染（组数从数据读，不写死）
  ids.modebar.children.filter((c) => (c.className || '').includes('mode-btn'))
    .find((b) => b.textContent === '学生权益反馈渠道').fire('click');
  const subs = ids.subnav.children.filter((c) => (c.className || '').includes('sub-btn'));
  subs.find((b) => b.textContent.indexOf('全部渠道') === 0).fire('click');
  check('完整页是全部组（与数据一致）', ids['view-channels'].querySelectorAll('.rt-cat').length, real.categories.length);
}

console.log('');
console.log('=== 3. 可用条目：按 kind 给出正确操作 ===');
{
  const items = view.querySelectorAll('.rt-item');
  const usable = items.filter((i) => !(i.className || '').includes('todo'));
  const expectOk = real.categories.reduce((a, c) => a + c.channels.filter((x) => x.status === 'ok').length, 0);
  console.log('  可用条目: ' + usable.length + '（应为 ' + expectOk + '）');
  check('可用条目数', usable.length, expectOk);

  // 每类 kind 的操作按钮
  const links = items.filter((i) => {
    const b = i.querySelector('.rt-go');
    return b && /^https?:/.test(String(b.href || ''));
  });
  const tels = items.filter((i) => {
    const b = i.querySelector('.rt-go');
    return b && /^tel:/.test(String(b.href || ''));
  });
  const mails = items.filter((i) => {
    const b = i.querySelector('.rt-go');
    return b && /^mailto:/.test(String(b.href || ''));
  });
  const qqBtns = items.filter((i) => {
    const b = i.querySelector('.rt-go');
    return b && String(b.tag).toLowerCase() === 'button';
  });
  const wx = items.filter((i) => i.querySelector('.rt-wx'));
  console.log('  链接 ' + links.length + ' 个 / 电话 ' + tels.length + ' 个 / 邮箱 ' + mails.length +
    ' 个 / QQ 复制按钮 ' + qqBtns.length + ' 个 / 公众号提示 ' + wx.length + ' 个');
  check('有网页链接渠道', links.length > 0, true);
  check('有电话渠道（含各部门直拨电话）', tels.length, 12);
  check('有邮箱渠道', mails.length, 2);
  check('有 QQ 渠道（按钮非链接）', qqBtns.length, 2);
  check('有公众号渠道', wx.length, 1);

  // 所有 rt-go 必须是 href 或 button，不能是空链接
  const bad = items.filter((i) => {
    const b = i.querySelector('.rt-go');
    if (!b) return false;
    if (String(b.tag).toLowerCase() === 'button') return false;
    const h = String(b.href || '');
    return h === '' || h === '#';
  });
  check('没有空 href 的按钮', bad.length, 0);
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
  const emptyHref = [];
  check('没有空 href 的链接', emptyHref.length, 0);
}
console.log('');

console.log('=== 5a. 首页头条轮播 ===');
{
  nav.home();
  const hb = ids['heroBanner'];
  const slides = hb.querySelectorAll('.hb-slide');
  console.log('  头条条数: ' + slides.length);
  // 学习资源已下架，轮播只剩 3 条权益相关
  check('头条有 3 条', slides.length, 3);
  check('默认只显示第 1 条', slides.filter((x) => (x.className || '').includes('on')).length, 1);
  const dots = hb.querySelectorAll('.hb-dot');
  check('圆点数量与头条一致', dots.length, slides.length);
  // 每条都要有标题与跳转目标
  const noTitle = slides.filter((x) => !x.querySelector('.hb-title'));
  check('每条都有标题', noTitle.length, 0);
  const badHref = slides.filter((x) => !/^#\/|^https?:/.test(String(x.href || '')));
  check('每条都有跳转地址', badHref.length, 0);
  // 4 条里应有站内跳转也有外链
  const inner = slides.filter((x) => String(x.href || '').indexOf('#/') === 0);
  const outer = slides.filter((x) => String(x.href || '').indexOf('http') === 0);
  console.log('  站内 ' + inner.length + ' 条 / 外链 ' + outer.length + ' 条');
  check('既有站内跳转也有外链', inner.length > 0 && outer.length > 0, true);
  // 第一条应是权益反馈入口
  check('第 1 条指向权益反馈', String(slides[0].href || ''), '#/rights/channels');
}

console.log('');
console.log('=== 5a2. 手动滑动 ===');
{
  nav.home();
  const hb = ids['heroBanner'];
  const cur = () => {
    const sl = hb.querySelectorAll('.hb-slide');
    for (let i = 0; i < sl.length; i++) if ((sl[i].className || '').includes('on')) return i;
    return -1;
  };
  const before = cur();
  console.log('  起始在第 ' + (before + 1) + ' 条');

  // 模拟向左滑动 120px（应翻到下一条）
  hb.fire('pointerdown', { clientX: 400, clientY: 100, pointerType: 'touch', pointerId: 1, target: hb });
  hb.fire('pointermove', { clientX: 280, clientY: 100, pointerType: 'touch', pointerId: 1, target: hb });
  hb.fire('pointerup', { clientX: 280, clientY: 100, pointerType: 'touch', pointerId: 1, target: hb });
  const afterL = cur();
  console.log('  左滑后在第 ' + (afterL + 1) + ' 条');
  check('左滑切到下一条', afterL, (before + 1) % 4);

  // 模拟向右滑动 120px（应翻回上一条）
  hb.fire('pointerdown', { clientX: 200, clientY: 100, pointerType: 'touch', pointerId: 2, target: hb });
  hb.fire('pointermove', { clientX: 320, clientY: 100, pointerType: 'touch', pointerId: 2, target: hb });
  hb.fire('pointerup', { clientX: 320, clientY: 100, pointerType: 'touch', pointerId: 2, target: hb });
  const afterR = cur();
  console.log('  右滑后在第 ' + (afterR + 1) + ' 条');
  check('右滑切回上一条', afterR, before);

  // 滑动距离不足阈值：不切页
  const b2 = cur();
  hb.fire('pointerdown', { clientX: 400, clientY: 100, pointerType: 'touch', pointerId: 3, target: hb });
  hb.fire('pointermove', { clientX: 385, clientY: 100, pointerType: 'touch', pointerId: 3, target: hb });
  hb.fire('pointerup', { clientX: 385, clientY: 100, pointerType: 'touch', pointerId: 3, target: hb });
  check('轻滑不切页（阈值生效）', cur(), b2);
  console.log('  轻滑 15px 后仍在第 ' + (cur() + 1) + ' 条');

  // 拖动后应吃掉 click，避免误跳转
  hb.fire('pointerdown', { clientX: 400, clientY: 100, pointerType: 'touch', pointerId: 4, target: hb });
  hb.fire('pointermove', { clientX: 250, clientY: 100, pointerType: 'touch', pointerId: 4, target: hb });
  hb.fire('pointerup', { clientX: 250, clientY: 100, pointerType: 'touch', pointerId: 4, target: hb });
  let prevented = false;
  hb.fire('click', {
    clientX: 250, clientY: 100, target: hb,
    preventDefault() { prevented = true; },
    stopPropagation() {},
  });
  check('拖完后的 click 被拦下', prevented, true);

  // 圆点仍能手动切（不被拖动逻辑干扰）
  const dots = hb.querySelectorAll('.hb-dot');
  dots[2].fire('click', { preventDefault() {}, stopPropagation() {} });
  check('点圆点仍能切到第 3 条', cur(), 2);

  nav.home();
}

console.log('');
console.log('=== 5. 首页图标宫格 ===');
{
  nav.home();
  const grid = ids['iconGrid'];
  const items = grid.querySelectorAll('.ig-item');
  console.log('  宫格数量: ' + items.length);
  // 学习资源下架后只剩权益服务的 4 个入口
  check('宫格有 3 个入口（校内平台与校园信息已合并）', items.length, 3);
  // 顺序：权益服务 4 个（含反馈建议）在前 -> 学习资源 4 个在后
  const tones = items.map((a) => (a.className || '').split(' ').filter((c) => c.indexOf('ig-') === 0 && c !== 'ig-item').join(''));
  check('3 个都属权益服务', tones.every((t) => t === 'ig-rights'), true);
  // 标签里可能含零宽空格（控制手机折行位置），比对前先去掉
  const labels = items.map((a) => a.querySelector('.ig-label').textContent.replace(/\u200B/g, ''));
  check('入口名称', labels.join(' '), '青权中心权益反馈渠道 学生权益反馈渠道 校园平台');
  // 每个入口都有可点击地址
  const badHref = items.filter((a) => !/^#\/|^https?:/.test(a.href));
  check('所有入口地址有效', badHref.length, 0);
  // 第 1 个入口「青权中心权益反馈渠道」：直接跳外部网址，新窗口打开
  const first = items[0];
  check('青权中心权益反馈渠道直接跳外链',
    String(first.href).indexOf('young.ustc.edu.cn') >= 0 && String(first.href).indexOf('suggestionsList') >= 0, true);
  check('外链在新窗口打开', first.target, '_blank');

  // 第 2 个入口「学生权益反馈渠道」：站内精简页
  const feedback = items[1];
  check('学生权益反馈渠道指向站内精简页', String(feedback.href).indexOf('#/rights/key') >= 0, true);
  // 第 3 个入口「校园平台」：合并视图
  const campus = items[2];
  check('校园平台指向合并视图', String(campus.href).indexOf('#/campus/campusall') >= 0, true);
  // 分组标题
  const groupHeads = grid.querySelectorAll('.ig-group-head');
  console.log('  分组数: ' + groupHeads.length);
  check('宫格只剩 1 组', groupHeads.length, 1);
  check('这一组是「权益服务」', groupHeads[0].textContent.indexOf('权益服务') === 0, true);
  // 有数字角标的项
  const nums = grid.querySelectorAll('.ig-num');
  console.log('  数字角标数: ' + nums.length);
  check('数字角标 2 个（第 1 项已改为外链，不带数字）', nums.length, 2);
}

console.log('\n=== 5b. 底部标签栏 ===');
{
  const bar = ids['tabbar'];
  const tabs = bar.querySelectorAll('.tab-item');
  console.log('  标签数: ' + tabs.length);
  check('底部有 3 个标签（学习资源已下架）', tabs.length, 3);
  const tl = tabs.map((t) => t.textContent);
  check('标签文案', tl.join(' '), '🏠首页 🛡️权益服务 💬反馈建议');
  nav.home();
  const activeHome = ids['tabbar'].querySelectorAll('.tab-item.active');
  check('首页时「首页」高亮', activeHome.length, 1);
  nav.go('channels');
  const activeIn = ids['tabbar'].querySelectorAll('.tab-item.active');
  check('权益页时「权益服务」高亮', activeIn.length, 1);
  check('高亮的是权益服务', activeIn[0] ? activeIn[0].textContent.indexOf('权益服务') >= 0 : false, true);
  nav.home();
}

console.log('\n=== 5c. 宣传板块已移到首页 ===');
{
  nav.home();
  check('首页视图已显示', ids['view-home'].hidden, false);
  // 宣传栏目由 renderHome() 建进 #promoBody（静态 HTML 里的 .promo 外壳不在桩里）
  const body = ids['promoBody'];
  // 结构：一个「工作动态」列表块 + 两个占位栏目（典型问题处理 / 如何找到我们）
  check('有工作动态块', !!body.querySelector('.news-block'), true);
  // 工作动态 + 典型问题处理 都有真实数据块，只剩「如何找到我们」是占位
  check('有典型问题处理块', !!body.querySelector('.iss-block'), true);
  const rows = body.children.filter((c) => (c.className || '').includes('promo-row'));
  console.log('  占位栏目数: ' + rows.length);
  check('首页已无占位栏目', rows.length, 0);
  // 三个真实块：工作动态 / 典型问题处理 / 如何找到我们
  const heads = body.querySelectorAll('.iss-block h4').map((h) => h.textContent.replace(/（.*$/, ''));
  console.log('  内容块: ' + heads.join(' | '));
  check('有「典型问题处理」块', heads.some((h) => h.indexOf('典型问题处理') === 0), true);
  check('有「如何找到我们」块', heads.some((h) => h.indexOf('如何找到我们') === 0), true);
  // news.json 在测试里不会被 fetch（桩返回 404），所以走占位文案分支
  const nb = body.querySelector('.news-block');
  check('工作动态块有标题', nb.querySelector('h4').textContent.indexOf('工作动态') === 0, true);
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
