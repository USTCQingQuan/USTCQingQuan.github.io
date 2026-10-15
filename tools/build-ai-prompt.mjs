// tools/build-ai-prompt.mjs
// 生成 AI 检索用的系统提示词（把资源库编译成一份固定的提示词）。
//
// 为什么单独生成：
//   1. 提示词必须【完全固定】才能命中大模型的上下文缓存（成本降到 1/50）；
//   2. 它能独立于账号与云函数被生成和检验（条数、token 量、字段完整性）；
//   3. 资源库更新后重新跑一次即可，不必改云函数代码。
//
// 用法: node tools/build-ai-prompt.mjs [resources.json] [输出文件]

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const RES_FILE = process.argv[2] || 'resources.json';
const OUT = process.argv[3] || 'ai-prompt.txt';

const doc = JSON.parse(await readFile(RES_FILE, 'utf8'));
const list = doc.resources;
if (!Array.isArray(list) || !list.length) throw new Error('resources.json 里没有 resources 数组');

// 只带 AI 需要的字段，并压缩键名以省 token。
// 注意：字段一旦变化，提示词就变了、缓存会失效 —— 所以这里的结构要尽量稳定。
const slim = list.map((r) => ({
  t: r.title,
  d: r.description,
  c: r.category,
  s: r.subcategory || '',
  g: Array.isArray(r.tags) ? r.tags : [],
  u: r.url,
  // 把已知的使用条件一并给它，避免它瞎猜
  note: [
    r.network_requirement && r.network_requirement !== '未核验' ? '网络:' + r.network_requirement : '',
    r.account_requirement && r.account_requirement !== '未核验' ? '注册:' + r.account_requirement : '',
    r.cost && r.cost !== '免费' ? '费用:' + r.cost : '',
  ].filter(Boolean).join(' '),
}));

const SYS = `你是「拾学集」的资源检索助手。拾学集 (${'https://zmh090523-arch.github.io/'}) 面向中国科学技术大学学生，收录了 ${list.length} 条经过筛选的学习资源。

【必须遵守的规则】
1. 只推荐下面资源库里**确实存在**的资源。绝不编造资源名、网址或内容。
2. 如果资源库里没有用户需要的东西，直接说"资源库里暂时没有这类资源"，并建议他到资源详情页点「报告问题」推荐。**不要硬凑一个相近的来充数。**
3. 每条推荐都要说明**为什么适合他**（结合他的年级、目的、基础），不要只报名字。
4. 资源信息里没有写的使用条件（是否需要注册、是否需要特殊网络、是否需要校园网），**不要猜测**。如果用户明确问到了而这些信息里没有，就回答"这一点尚未核验，建议点开详情页看实际情况"。
5. 用户问的东西如果资源库里有更合适的，主动提出来（比如他找"期中复习"，而库里有历年真题，就一并说明）。
6. 语气像学长给建议，自然、简短、不啰嗦。不要用"首先/其次/最后"这种模板腔。

【资源库】
${JSON.stringify(slim)}

【输出格式】只输出一个 JSON 对象，不要有任何其他文字：
{
  "answer": "给用户的回答（中文，自然口语，2-4 句）",
  "resources": [
    { "title": "必须是资源库里完全一致的标题原文", "reason": "一句话说明为什么推荐它" }
  ]
}
如果资源库里没有合适的，resources 返回空数组 []，并在 answer 里说明。`;

await writeFile(OUT, SYS, 'utf8');

const bytes = Buffer.byteLength(SYS, 'utf8');
// 粗略估算 token：中文约 1 字 1 token，英文/符号约 4 字符 1 token。
// 这里用"中文字符数 + 其他字符数/3"做保守估计。
const cn = (SYS.match(/[\u4e00-\u9fa5]/g) || []).length;
const other = SYS.length - cn;
const estTokens = Math.round(cn + other / 3);

console.log('资源条数     : ' + list.length);
console.log('提示词字节   : ' + bytes);
console.log('中文字符数   : ' + cn);
console.log('估算 token   : 约 ' + estTokens);
console.log('输出文件     : ' + path.resolve(OUT));
console.log('');
console.log('=== 成本估算（deepseek-flash，高峰价：未命中输入 2 元/百万，命中 0.04 元/百万）===');
const inTok = estTokens;
const outTok = 300;                     // 假设回答 300 token
const peakMiss = (inTok * 2 + outTok * 8) / 1e6;
const peakHit = (inTok * 0.04 + outTok * 8) / 1e6;
const idleMiss = (inTok * 1 + outTok * 4) / 1e6;
const idleHit = (inTok * 0.02 + outTok * 4) / 1e6;
console.log('  首次(未命中) 高峰: ' + peakMiss.toFixed(4) + ' 元   空闲: ' + idleMiss.toFixed(4) + ' 元');
console.log('  后续(命中缓存) 高峰: ' + peakHit.toFixed(4) + ' 元   空闲: ' + idleHit.toFixed(4) + ' 元');
console.log('  => 一天 100 次提问、缓存生效，约 ' + (peakHit * 100).toFixed(2) + ' 元（高峰）/ ' + (idleHit * 100).toFixed(2) + ' 元（空闲）');
