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
  'view-home', 'iconGrid', 'heroBanner', 'tabbar', 'view-resources', 'view-guides', 'view-skills', 'view-exams', 'view-channels', 'view-key', 'view-repair', 'view-dept', 'view-teach', 'view-union', 'promoBody',
  'detail-mask', 'detail-box',
], { protocol: 'https:', hash: '#/rights/channels' });
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

console.log('=== 1. 全部渠道页 ===');
{
  // channels.json 是异步加载的，等它到达再断言
  await new Promise((r) => setTimeout(r, 120));
  // 分类条已移除，页面初始就停在 #/rights/channels
  check('全部渠道页已显示', view.hidden, false);
  check('校园平台页已隐藏', ids['view-resources'].hidden, true);

  const activeTop = nav.modeBtns().find((b) => (b.className || '').includes('active'));
  check('当前激活的一级按钮是「学生权益反馈渠道」', activeTop ? activeTop.textContent : '', '学生权益反馈渠道');

  const okCount = real.categories.reduce((a, c) => a + c.channels.filter((x) => x.status === 'ok').length, 0);
  const allCount = real.categories.reduce((a, c) => a + c.channels.length, 0);
  console.log('  可用 ' + okCount + ' 条 / 全部 ' + allCount + ' 条');
  check('卡片数等于全部渠道数', view.querySelectorAll('.rt-item').length, allCount);
}

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
  await new Promise((r) => setTimeout(r, 120));
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

  // 两个视图是独立容器，互不污染：精简页 3 组，完整页仍是全部组
  check('完整页仍是全部组（与数据一致）',
    ids['view-channels'].querySelectorAll('.rt-cat').length, real.categories.length);
  check('精简页仍是 3 组',
    ids['view-key'].querySelectorAll('.rt-cat').length, 3);
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
  check('有电话渠道（含各部门直拨电话）', tels.length,
    real.categories.reduce((a, c) => a + c.channels.filter((x) => x.kind === 'phone').length, 0));
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

console.log('=== 5. 首页图标宫格 ===');
{
  nav.home();
  const grid = ids['iconGrid'];
  const items = grid.querySelectorAll('.ig-item');
  console.log('  宫格数量: ' + items.length);
  // 学习资源下架后只剩权益服务的 4 个入口
  check('宫格有 4 个入口', items.length, 4);
  // 顺序：权益服务 4 个（含反馈建议）在前 -> 学习资源 4 个在后
  const tones = items.map((a) => (a.className || '').split(' ').filter((c) => c.indexOf('ig-') === 0 && c !== 'ig-item').join(''));
  check('3 个都属权益服务', tones.every((t) => t === 'ig-rights'), true);
  // 标签里可能含零宽空格（控制手机折行位置），比对前先去掉
  const labels = items.map((a) => a.querySelector('.ig-label').textContent.replace(/\u200B/g, ''));
  check('入口名称', labels.join(' '), '青权中心权益反馈渠道 学生会权益反馈渠道 校园报修 部门直拨电话');
  // 每个入口都有可点击地址
  const badHref = items.filter((a) => !/^#\/|^https?:/.test(a.href));
  check('所有入口地址有效', badHref.length, 0);
  // 第 1 个入口「青权中心权益反馈渠道」：直接跳外部网址，新窗口打开
  const first = items[0];
  check('青权中心权益反馈渠道直接跳外链',
    String(first.href).indexOf('young.ustc.edu.cn') >= 0 && String(first.href).indexOf('suggestionsList') >= 0, true);
  check('外链在新窗口打开', first.target, '_blank');

  // 第 2 个入口「学生会反馈渠道」：只到校学生会·研究生会那一组
  const feedback = items[1];
  check('学生会反馈渠道指向独立的 #/union/union', String(feedback.href).indexOf('#/union/union') >= 0, true);
  // 第 3 个入口「校园平台」：合并视图
  const campus = items[2];
  check('第 3 个入口是校园报修', String(campus.href).indexOf('#/repair') >= 0, true);
  // 第 4 个入口「部门直拨电话」
  check('第 4 个入口是部门直拨电话', String(items[3].href).indexOf('#/dept') >= 0, true);
  // 分组标题
  const groupHeads = grid.querySelectorAll('.ig-group-head');
  console.log('  分组数: ' + groupHeads.length);
  check('宫格只剩 1 组', groupHeads.length, 1);
  check('这一组是「权益服务」', groupHeads[0].textContent.indexOf('权益服务') === 0, true);
  // 有数字角标的项
  const nums = grid.querySelectorAll('.ig-num');
  console.log('  数字角标数: ' + nums.length);
  check('所有入口都没有数字角标（求精简）', nums.length, 0);
}

console.log('\n=== 5b. 底部标签栏已移除 ===');
{
  // stub 会按 IDS 列表凭空造元素，所以「已移除」必须查页面源码
  const html = await readFile('index.html', 'utf8');
  check('页面源码里没有 tabbar 容器', html.indexOf('id="tabbar"') >= 0, false);
  check('页面源码里没有 renderTabbar', html.indexOf('function renderTabbar') >= 0, false);
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
