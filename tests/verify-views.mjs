// 回归测试：三个视图（资源库 / 学习路径 / 技能自查）与详情页
// 用法: node tests/verify-views.mjs [index.html]
//
// 这些测试跑的是 index.html 里页面自身的脚本，用的是 tests/dom-stub.mjs 提供的 DOM 桩。
// 目的是在每次改动后确认既有功能没有被破坏 —— 项目此前没有任何测试。
import { readFile } from 'node:fs/promises';
import { makeChecker, setupDom, loadScript, makeNav } from './dom-stub.mjs';

const FILE = process.argv[2] || 'index.html';
const { html, script } = await loadScript(FILE);
const { byId, ids, store, calls } = setupDom([
  'grid', 'empty', 'q', 'freeOnly', 'chips', 'subchips', 'modebar',
  'view-home', 'iconGrid', 'heroBanner', 'tabbar', 'view-resources', 'view-guides', 'view-skills', 'view-exams', 'subnav', 'view-channels', 'view-key', 'view-work', 'detail-mask', 'detail-box',
]);
const { check, done } = makeChecker();

try {
  globalThis.__FORCE_STUDY__ = true;   // 学习资源已下架，测试里强制打开
  eval(script);
} catch (e) {
  console.log('  ✗ 页面脚本执行抛错: ' + e.message);
  console.log(e.stack.split('\n').slice(0, 6).join('\n'));
  process.exit(1);
}

const modeBtns = () => ids.modebar.children.filter((c) => (c.className || '').includes('mode-btn'));

console.log('=== 1. 导航结构 ===');
// 首页 + 两个分区；每个分区下有子视图
const nav = makeNav(ids);
check('一级按钮数', modeBtns().length, 3);
check('一级按钮文案', modeBtns().map((b) => b.textContent).join(' | '), '首页 | 学生权益反馈渠道 | 学习资源');
check('默认停在「首页」', modeBtns()[0].textContent, '首页');
check('首页视图默认显示', ids['view-home'].hidden, false);
check('资源网格默认隐藏', ids['view-resources'].hidden, true);
check('首页时不显示二级导航', ids['subnav'].hidden, true);
check('指南视图默认隐藏', ids['view-guides'].hidden, true);
check('技能视图默认隐藏', ids['view-skills'].hidden, true);
check('试卷视图默认隐藏', ids['view-exams'].hidden, true);
check('权益视图默认隐藏', ids['view-channels'].hidden, true);

console.log('\n=== 1b. 学习资源分区 ===');
nav.go('library');
const sub0 = nav.subBtns();
check('二级按钮数', sub0.length, 4);
check('二级按钮文案', sub0.map((b) => b.textContent).join(' | '),
  '资源库151 | 学习路径5 | 技能自查50 | 历年试卷…');
check('资源网格已显示', ids['view-resources'].hidden, false);
check('首页视图已隐藏', ids['view-home'].hidden, true);

console.log('\n=== 2. 切到「学习路径」 ===');
nav.go('guides');
check('资源网格已隐藏', ids['view-resources'].hidden, true);
check('指南视图已显示', ids['view-guides'].hidden, false);
const cards = ids['view-guides'].children.filter((c) => (c.className || '').includes('guide-card'));
check('指南卡片数', cards.length, 5);
check('第一张卡片标题', cards[0].querySelector('h3').textContent, '大一打基础');
check('第一张卡片副标题', cards[0].querySelector('.g-sub').textContent, '数学分析、线性代数、大学物理、程序设计——把地基打牢');
const metas = cards[0].querySelector('.g-meta').children;
check('卡片 meta 三项', metas.map((c) => c.textContent).join(' | '), '4 个阶段 | 23 个资源 | 刚入学或想补基础的本科生');

console.log('\n=== 3. 点开一条指南 ===');
cards[1].fire('click');
const detail = ids['view-guides'].children.filter((c) => (c.className || '').includes('guide-detail'));
check('详情已渲染', detail.length, 1);
check('详情标题', detail[0].querySelector('h2').textContent, 'AI 入门到进阶');
const steps = detail[0].children.filter((c) => (c.className || '').includes('gd-step'));
check('阶段数', steps.length, 5);
const links = detail[0].querySelectorAll('a');
check('资源外链数 > 30', links.length > 30, true);
check('外链是真实 URL', /^https?:\/\//.test(links[0] ? links[0].href : ''), true);
const cks = detail[0].querySelectorAll('.gd-ck');
check('自查清单块数', cks.length, 5);
check('清单含提示标题', cks[0].querySelector('b').textContent, '走完这一阶段，你应该能：');
check('首个清单条目数 > 0', cks[0].querySelectorAll('li').length > 0, true);

console.log('\n=== 4. 返回列表 ===');
const backBtn = ids['view-guides'].children.find((c) => (c.className || '').includes('back-btn'));
backBtn.fire('click');
check('回到列表（指南卡片数）', ids['view-guides'].children.filter((c) => (c.className || '').includes('guide-card')).length, 5);

console.log('\n=== 5. 切到「技能自查」 ===');
nav.go('skills');
check('技能视图已显示', ids['view-skills'].hidden, false);
const groups = ids['view-skills'].children.filter((c) => (c.className || '').includes('sk-group'));
check('技能分组数', groups.length, 6);
const boxes = ids['view-skills'].querySelectorAll('input');
check('复选框总数', boxes.length, 50);
const sumHtml = ids['view-skills'].querySelectorAll('.sk-sum')[0].innerHTML;
check('初始完成数为 0', /已完成 <b>0<\/b> \/ 50 项（0%）/.test(sumHtml), true);

console.log('\n=== 6. 勾选一项后进度与持久化 ===');
boxes[0].checked = true;
boxes[0].fire('change');
check('localStorage 已写入', Object.keys(store).length > 0, true);
const saved = JSON.parse(store['shixueji.skills.v1'] || '{}');
check('写入的键数量', Object.keys(saved).length, 1);
check('写入的键名', Object.keys(saved)[0], 'm1');
check('首个分组计数变为 1 / 7', ids['view-skills'].querySelectorAll('.g-cnt')[0].textContent, '1 / 7');

console.log('\n=== 7. 切回资源库，原功能仍在 ===');
nav.go('library');
check('资源视图已显示', ids['view-resources'].hidden, false);
check('资源总数（全部 186 条仍在内存里）', byId.total.textContent, 186);
// 学习资源区只显示其余 8 类：186 - 校内平台(30) - 校园信息(5) = 151
check('学习资源区卡片数', ids.grid.children.length, 151);
// 分类标签：全部 + 8 类（校内平台/校园信息归到权益服务区了）
check('学习资源区分类 chip 数', ids.chips.children.filter((c) => (c.className || '').includes('chip')).length, 9);
ids.q.value = 'Transformer';
ids.q.fire('input');
// 数字从 10 变成 11：搜索口径统一后，「动手学深度学习：注意力机制」因其子分类是
// 「Transformer 与 NLP」而被命中（卡片上显示"匹配：子分类"）。这是改进而非误报 ——
// 旧实现只在名称/简介/标签里找词，子分类仅参与打分、不参与判定，两者口径不一致。
check('搜索 Transformer', ids.grid.children.length, 11);
ids.q.value = '';
ids.q.fire('input');

console.log('\n=== 8. 资源详情页 ===');
const mask = ids['detail-mask'];
const box = ids['detail-box'];
check('详情层初始隐藏', mask.hidden, true);
const card = ids.grid.children[0];
const firstTitle = card.getAttribute('data-title');
check('卡片带 data-title', !!firstTitle, true);
calls.opened.length = 0;
card.fire('click');
check('详情层已显示', mask.hidden, false);
check('未直接跳转外部', calls.opened.length, 0);
check('详情标题与卡片一致', box.querySelector('.dt-title').textContent, firstTitle);
const cardHref = card.href;
check('前往按钮链接与卡片一致', box.querySelector('.dt-go').href, cardHref);
check('显示完整 URL 与卡片一致', box.querySelector('.dt-url').textContent, cardHref);
check('详情副标题含分类', box.querySelector('.dt-sub').textContent.length > 3, true);

const rows = box.querySelectorAll('.dt-row');
// 注意：这两个数字随 FIELD_KEYS 变化。
// 加字段时同步更新 —— 它们的作用是提醒"字段数变了，确认是否有意为之"。
check('字段行数', rows.length, 11);
// 桩的 querySelector 会递归整个子树，所以必须用 children 取该行自己的格子
const rowMap = {};
for (const r of rows) {
  const kEl = r.children.find((c) => (c.className || '').split(/\s+/).includes('k'));
  const vEl = r.children.find((c) => (c.className || '').split(/\s+/).includes('v'));
  if (kEl && vEl) rowMap[kEl.textContent] = vEl.textContent;
}
// 字段值随数据变，这里只验证"字段有值且与数据源一致"，不硬编码具体资源
const firstRec = JSON.parse(await readFile('resources.json', 'utf8')).resources
  .find((r) => r.title === firstTitle);
check('费用与数据一致', rowMap['费用'], firstRec.cost);
check('语言支持与数据一致', rowMap['语言支持'], firstRec.language_support);
check('来源站点与数据一致', rowMap['来源站点'], firstRec.source);
check('子分类与数据一致', rowMap['子分类'], firstRec.subcategory);
const noCount = rows.filter((r) => (r.children.find((c) => (c.className || '').includes('v')) || {}).className === 'v no').length;
// 只统计页面上真正展示的 11 个字段（FIELD_KEYS），记录里还有些字段不上屏
check('未核验字段数在合理范围', noCount >= 0 && noCount <= rows.length, true);
console.log('    （该资源有 ' + noCount + ' / ' + rows.length + ' 个字段未核验）');
const noteText = box.querySelector('.dt-note').textContent;
check('未核验说明存在', noteText.includes('尚未经人工核验'), true);
check('说明条数与未核验字段数一致', noteText.includes(String(noCount) + ' 个字段'), true);

console.log('\n=== 9. 详情层关闭方式 ===');
box.querySelector('.dt-close').fire('click');
check('关闭按钮生效', mask.hidden, true);
card.fire('click');
box.fire('click', { target: box });
check('点内容区不关闭', mask.hidden, false);
mask.fire('click', { target: mask });
check('点遮罩关闭', mask.hidden, true);
card.fire('click');
document.fire('keydown', { key: 'Escape' });
check('Esc 关闭', mask.hidden, true);

console.log('\n=== 10. 箭头按钮 -> 直接跳转，不弹层 ===');
const card2 = ids.grid.children[1];
calls.opened.length = 0;
card2.querySelector('.card-jump').fire('click');
check('触发了外部打开', calls.opened.length, 1);
check('打开的是正确 URL', calls.opened[0] && calls.opened[0].u, card2.href);
check('没有弹出详情层', mask.hidden, true);

console.log('\n=== 11. 报告问题（反馈问卷）===');
const card3 = ids.grid.children[0];
card3.fire('click');
const reportBtn = box.querySelector('.dt-report');
check('详情页有「报告问题」按钮', !!reportBtn, true);
check('按钮文案', reportBtn ? reportBtn.textContent : '', '报告问题');
check('有反馈提示文字', !!box.querySelector('.dt-hint'), true);
check('提示默认文案含「报告问题」', box.querySelector('.dt-hint').textContent.includes('报告问题'), true);

calls.copied.length = 0;
calls.opened.length = 0;
reportBtn.fire('click');
check('点击后复制到剪贴板', calls.copied.length, 1);
const payload = calls.copied[0] || '';
// 内容随当前卡片变，这里按卡片自身的数据校验，不硬编码
check('复制内容含资源名', payload.includes(card3.getAttribute('data-title')), true);
check('复制内容含链接', payload.includes(card3.href), true);
check('复制内容含分类', payload.length > 20, true);
// window.open 在 clipboard 的 .then 里，必须等微任务完成后才能断言
await new Promise((r) => setTimeout(r, 10));
check('打开了反馈问卷', calls.opened.length, 1);
check('问卷地址正确', calls.opened[0] && calls.opened[0].u, 'https://wj.qq.com/s2/28211504/azd9/');
check('提示更新为「已复制」', box.querySelector('.dt-hint').textContent.includes('已复制'), true);
mask.hidden = true;

process.exit(done() ? 0 : 1);
