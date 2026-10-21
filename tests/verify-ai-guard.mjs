// 回归测试：云函数的核心防护逻辑（不需要 API Key）
//
// 为什么这个测试重要：
//   AI 检索最大的风险是【编造资源】—— 模型可能一本正经地推荐一个根本不存在的网站。
//   这里的 parseAndValidate 是最后一道闸门：标题不在资源库里就丢弃。
//   这段逻辑必须被验证，不能靠"应该没问题"。
//
// 用法: node tests/verify-ai-guard.mjs
import { createRequire } from 'node:module';
import { makeChecker } from './dom-stub.mjs';

const require = createRequire(import.meta.url);
const fn = require('../cloudbase/ask/index.js');
const { check, done } = makeChecker();

fn._loadAssets();
const assets = fn._loadAssets();
console.log('=== 前置检查 ===');
console.log('  提示词长度: ' + assets.promptLen + ' 字');
console.log('  资源库条数: ' + assets.titles);
check('提示词已加载', assets.promptLen > 10000, true);
check('资源库有 186 条', assets.titles, 186);
console.log('');

console.log('=== 1. 正常返回（AI 推荐真实存在的资源）===');
{
  const r = fn.parseAndValidate(JSON.stringify({
    answer: '你要是想入门 AI，建议从动手学深度学习开始，配套看李沐的视频。',
    resources: [
      { title: '动手学深度学习（PyTorch 版）', reason: '有代码能跑，适合边学边做' },
      { title: 'USTC 评课社区', reason: '选课前看看学长评价' },
    ],
  }));
  console.log('  answer: ' + r.answer.slice(0, 40) + '…');
  console.log('  资源数: ' + r.resources.length + '   丢弃: ' + r.droppedCount);
  r.resources.forEach((x) => console.log('    「' + x.title + '」→ ' + x.url));
  check('校验通过', r.ok, true);
  check('保留 2 条', r.resources.length, 2);
  check('没有丢弃', r.droppedCount, 0);
  check('自动补上了 url', r.resources[0].url.includes('d2l'), true);
}
console.log('');

console.log('=== 2. ★核心防护：AI 编造不存在的资源，必须被丢弃 ===');
{
  const r = fn.parseAndValidate(JSON.stringify({
    answer: '推荐你看看这个。',
    resources: [
      { title: '动手学深度学习（PyTorch 版）', reason: '真实的' },
      { title: '中科大 AI 学习平台', reason: '凭空编造的' },
      { title: 'DeepSeek 官方教程站', reason: '也是编造的' },
      { title: 'USTC 作业答案大全', reason: '编造的' },
    ],
  }));
  console.log('  AI 返回 4 条，保留 ' + r.resources.length + ' 条，丢弃 ' + r.droppedCount + ' 条');
  r.resources.forEach((x) => console.log('    ✓ 保留「' + x.title + '」'));
  check('只保留真实存在的那 1 条', r.resources.length, 1);
  check('丢弃了 3 条编造的', r.droppedCount, 3);
  check('保留的是真实资源', r.resources[0].title, '动手学深度学习（PyTorch 版）');
}
console.log('');

console.log('=== 3. 资源库里没有 → 应如实说明，且不返回资源 ===');
{
  const r = fn.parseAndValidate(JSON.stringify({
    answer: '资源库里暂时没有汉语言文学相关的资料，你可以到详情页点「报告问题」推荐。',
    resources: [],
  }));
  console.log('  answer: ' + r.answer.slice(0, 40) + '…');
  console.log('  资源数: ' + r.resources.length);
  check('校验通过', r.ok, true);
  check('返回空资源数组', r.resources.length, 0);
  check('answer 里说明了没有', r.answer.includes('暂时没有'), true);
}
console.log('');

console.log('=== 4. 标题有细微差异（多空格）也应被拒或归一 ===');
{
  const r = fn.parseAndValidate(JSON.stringify({
    answer: 'x',
    resources: [{ title: '  动手学深度学习（PyTorch 版）  ', reason: '带空格' }],
  }));
  console.log('  带前后空格的标题 → 保留 ' + r.resources.length + ' 条');
  check('前后空格被 trim 后匹配成功', r.resources.length, 1);
}
console.log('');

console.log('=== 5. 重复推荐应去重 ===');
{
  const r = fn.parseAndValidate(JSON.stringify({
    answer: 'x',
    resources: [
      { title: '菜鸟教程', reason: '第一次' },
      { title: '菜鸟教程', reason: '重复的' },
    ],
  }));
  console.log('  同一资源推荐两次 → 保留 ' + r.resources.length + ' 条');
  check('去重后只剩 1 条', r.resources.length, 1);
}
console.log('');

console.log('=== 6. 异常输入不应崩溃 ===');
{
  const bad = [
    ['非 JSON 文本', '这不是 JSON'],
    ['JSON 但不是对象', '"just a string"'],
    ['缺 answer', JSON.stringify({ resources: [] })],
    ['answer 是空的', JSON.stringify({ answer: '   ', resources: [] })],
  ];
  for (const [label, input] of bad) {
    let r;
    try { r = fn.parseAndValidate(input); } catch (e) { r = { ok: false, error: 'THREW: ' + e.message }; }
    console.log('  ' + label.padEnd(18) + '→ ok=' + r.ok + '  ' + (r.error || ''));
    check('「' + label + '」被安全拒绝', r.ok, false);
  }
}
console.log('=== 7. HTTP 事件解析（依据 CloudBase 官方 event 结构）===');
{
  // 依据官方文档：通过 HTTP 网关访问时 event = { path, httpMethod, headers, body, ... }
  const cases = [
    ['body 是 JSON 字符串', { httpMethod: 'POST', body: '{"question":"我想学 Python"}' }, '我想学 Python'],
    ['body 是纯文本', { httpMethod: 'POST', body: '我想学 Python' }, '我想学 Python'],
    ['body 是已解析对象', { httpMethod: 'POST', body: { question: '我想学 Python' } }, '我想学 Python'],
    ['直接传 question（控制台测试）', { question: '我想学 Python' }, '我想学 Python'],
    ['base64 编码的 body', { httpMethod: 'POST', isBase64Encoded: true, body: Buffer.from('{"question":"base64 测试"}', 'utf8').toString('base64') }, 'base64 测试'],
    ['空事件', {}, ''],
    ['null', null, ''],
  ];
  for (const [label, ev, expect] of cases) {
    const got = fn.extractQuestion(ev);
    console.log('  ' + label.padEnd(28) + '→ 「' + got + '」');
    check('「' + label + '」解析正确', got, expect);
  }
}
console.log('');

console.log('=== 8. 客户端 IP 提取（用于限频）===');
{
  const cases = [
    ['requestContext.clientIP', { requestContext: { clientIP: '1.2.3.4' } }, '1.2.3.4'],
    ['requestContext.identity', { requestContext: { identity: { sourceIp: '5.6.7.8' } } }, '5.6.7.8'],
    ['X-Forwarded-For（大写）', { headers: { 'X-Forwarded-For': '9.9.9.9, 10.0.0.1' } }, '9.9.9.9'],
    ['x-forwarded-for（小写）', { headers: { 'x-forwarded-for': '11.11.11.11' } }, '11.11.11.11'],
    ['都取不到时兜底', {}, 'unknown'],
  ];
  for (const [label, ev, expect] of cases) {
    const got = fn.extractIp(ev, {});
    console.log('  ' + label.padEnd(28) + '→ ' + got);
    check('「' + label + '」提取正确', got, expect);
  }
}
console.log('');

console.log('=== 9. 完整主流程（mock 掉 DeepSeek 调用，验证端到端接线）===');
{
  // 无 Key 时应返回明确错误，而不是崩溃
  const savedKey = process.env.DEEPSEEK_API_KEY;
  delete process.env.DEEPSEEK_API_KEY;
  const r1 = await fn.main({ httpMethod: 'POST', body: '{"question":"推荐点 AI 入门资源"}' }, {});
  console.log('  未配 Key → statusCode=' + r1.statusCode + '  body=' + r1.body.slice(0, 60));
  const p1 = JSON.parse(r1.body);
  check('未配 Key 时返回 500', r1.statusCode, 500);
  check('错误信息清晰', p1.error.includes('API Key'), true);

  // OPTIONS 预检应通过（CORS）
  const r2 = await fn.main({ httpMethod: 'OPTIONS' }, {});
  console.log('  OPTIONS 预检 → statusCode=' + r2.statusCode + '  CORS=' + (r2.headers['Access-Control-Allow-Origin'] || '(无)'));
  check('OPTIONS 返回 200', r2.statusCode, 200);
  check('带 CORS 头', !!r2.headers['Access-Control-Allow-Origin'], true);

  // 空问题应返回 400
  const r3 = await fn.main({ httpMethod: 'POST', body: '{"question":"   "}' }, {});
  const p3 = JSON.parse(r3.body);
  console.log('  空问题 → statusCode=' + r3.statusCode + '  error=' + p3.error);
  check('空问题返回 400', r3.statusCode, 400);

  if (savedKey) process.env.DEEPSEEK_API_KEY = savedKey;
}
console.log('');

process.exit(done() ? 0 : 1);
