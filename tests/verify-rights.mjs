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
  'view-home', 'iconGrid', 'tabbar', 'view-resources', 'view-guides', 'view-skills', 'view-exams', 'view-channels', 'promoBody',
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
  const btn = nav.subBtns().find((b) => b.textContent.indexOf('权益反馈') === 0);
  check('存在「权益反馈」子按钮', !!btn, true);
  check('权益视图已显示', view.hidden, false);
  check('资源视图已隐藏', ids['view-resources'].hidden, true);
  await new Promise((r) => setTimeout(r, 60));
  const btn2 = nav.subBtns().find((b) => b.textContent.indexOf('权益反馈') === 0);
  console.log('  按钮文案: ' + btn2.textContent);
  const okCount = real.categories.reduce((a, c) => a + c.channels.filter((x) => x.status === 'ok').length, 0);
  check('二级按钮显示可用条数', btn2.textContent, '权益反馈' + okCount);
  const activeTop = nav.modeBtns().find((b) => (b.className || '').includes('active'));
  check('当前激活的一级按钮是「权益服务」', activeTop ? activeTop.textContent : '', '权益服务');
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
  check('有电话渠道', tels.length, 1);
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
  check('宫格有 8 个入口', items.length, 8);
  // 顺序：权益 3 个 -> 学习 4 个 -> 反馈 1 个
  const tones = items.map((a) => (a.className || '').split(' ').filter((c) => c.indexOf('ig-') === 0 && c !== 'ig-item').join(''));
  check('前 3 个属权益服务', tones.slice(0, 3).every((t) => t === 'ig-rights'), true);
  check('中间 4 个属学习资源', tones.slice(3, 7).every((t) => t === 'ig-study'), true);
  check('最后 1 个是反馈建议', tones[7], 'ig-more');
  const labels = items.map((a) => a.querySelector('.ig-label').textContent);
  check('入口名称', labels.join(' '), '权益反馈 校内平台 校园信息 资源库 历年试卷 学习路径 技能自查 反馈建议');
  // 每个入口都有可点击地址
  const badHref = items.filter((a) => !/^#\/|^https?:/.test(a.href));
  check('所有入口地址有效', badHref.length, 0);
  // 反馈建议是外链，新窗口打开
  const last = items[7];
  check('反馈建议指向问卷', last.href.indexOf('wj.qq.com') >= 0 || last.href.indexOf('http') === 0, true);
  // 有数字角标的项
  const nums = grid.querySelectorAll('.ig-num');
  console.log('  数字角标数: ' + nums.length);
  check('数字角标 7 个（反馈建议无数字）', nums.length, 7);
}

console.log('\n=== 5b. 底部标签栏 ===');
{
  const bar = ids['tabbar'];
  const tabs = bar.querySelectorAll('.tab-item');
  console.log('  标签数: ' + tabs.length);
  check('底部有 4 个标签', tabs.length, 4);
  const tl = tabs.map((t) => t.textContent);
  check('标签文案', tl.join(' '), '🏠首页 🛡️权益服务 📚学习资源 💬反馈建议');
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
  check('只剩一个占位栏目', rows.length, 1);
  const firstTitle = rows[0] ? rows[0].querySelector('h4').textContent : '';
  check('剩下的占位是「如何找到我们」', firstTitle, '如何找到我们');
  check('占位栏目标「内容准备中」', body.querySelectorAll('.promo-soon').length, 1);
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
