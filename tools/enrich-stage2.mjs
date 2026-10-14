// 阶段 2 改造脚本：以实测证据为基础，修正已确认的硬伤并补齐可判定的字段。
//
// 原则：
//   1. 只做两件有实测依据的事：修 URL 故障、补"能客观判定"的字段；
//   2. 无法客观判定的核验类字段（注册要求、网络要求、学生身份）一律标 '未核验'，
//      不猜测、不冒充已核验 —— 这些等人工复核（对应 Q3 决定）；
//   3. 幂等：重复运行结果一致。
import { readFile, writeFile } from 'node:fs/promises';

const FILE = process.argv[2];
const doc = JSON.parse(await readFile(FILE, 'utf8'));
const log = [];

// ---------- A. 修正实测确认的 URL 故障 ----------
for (const r of doc.resources) {
  if (r.title === '瀚海星云 BBS') {
    const from = r.url;
    r.url = 'http://bbs.ustc.edu.cn/';
    log.push(['URL 修复', r.title, from + '  ->  ' + r.url,
      'HTTPS 证书使用现代浏览器已拒用的 SHA1 签名算法，实测 3/3 次 ERR_SSL_WRONG_SIGNATURE_TYPE；同域 http 实测 200']);
  }
  if (r.title === '全国大学生数学建模竞赛' && r.url === 'http://www.mcm.edu.cn') {
    const from = r.url;
    r.url = 'https://www.mcm.edu.cn/';
    log.push(['URL 升级', r.title, from + '  ->  ' + r.url, 'http 会 302 跳转到 https，且 https 实测 200']);
  }
}

// ---------- B. 显式补齐规范字段（可客观判定的部分）----------
// language_support: 站点主体语言。已逐条按人工判断填写，属"证据充分可判定"的字段。
const LANG = {
  'zh': ['USTC 评课社区', '瀚海星云 BBS', 'USTC 开源镜像站', 'LUG@USTC', 'Hackergame',
    'USTC 图书馆', '中国大学 MOOC', '哔哩哔哩', '学堂在线', '网易公开课', '菜鸟教程',
    '廖雪峰的官方网站', '力扣 LeetCode', '动手学深度学习', '中国知网', 'Notion', 'Obsidian',
    'Anki', 'Excalidraw', 'USTC 虚拟机平台', '蜗壳学社', 'USTC LaTeX 平台', '希冀平台',
    '我的科大 wdkd', 'USTC Guide', 'USTC 导航', '科大 PPT 模板', '网安大礼包',
    '网安课程往年 PPT', 'SDS 进阶指南', '软院冒险者指南', 'USTCPHysExpData', 'USTCPhysExpData',
    '大物实验报告:PVD 原理与技术', '大物实验报告:锁相放大器', '大物实验报告:拉曼光谱',
    '免费编程书籍·中文', '科大网络资源汇总', '计算机学院课程资源', '科大资源链接汇总',
    '科大数学往年试卷', '科大物理往年试卷', '数学分析真题', '线性代数 B1 真题',
    '人工智能数学原理与算法互助手册', '量子物理讲义', '电磁学 C 总结与习题答案',
    'Gitee', '清华开源镜像站', '浙大开源镜像站', '北外开源镜像站', '牛客网',
    'ProcessOn', '全国大学生数学竞赛', '全国大学生数学建模竞赛', '数模竞赛报名系统',
    '洛谷', '心理健康专题', '计算机保研信息汇总', '形势与政策课程预告', '导师评价网测评',
    '2025 招生导师一览', '四级听力真题合集', '六级听力真题合集', 'U 校园答案(公众号)',
    '四六级真题全套', '科学文库', 'Maic 虚拟课堂'],
  'zh+en': ['CS 自学指南', 'cs-self-learning', 'MIT OpenCourseWare', 'CS50', 'Khan Academy',
    'Coursera', 'GitHub', 'MDN Web Docs', 'freeCodeCamp', 'The Odin Project', 'Kaggle',
    'Google 学术', 'arXiv', 'Connected Papers', 'Zotero', 'Overleaf', 'Stack Overflow',
    'DevDocs', 'Hugging Face', 'alphaXiv', 'ICPC 国际大学生程序设计竞赛',
    '美国大学生数学建模竞赛', 'OpenStax 免费大学教材', 'OpenStax 微积分(全三册)',
    'OpenStax 大学物理(全三册)', '费曼物理学讲义(在线版)', 'LibreTexts 开放教材库',
    '线性代数(Hefferon 免费教材)', "Beej's C 语言指南", '四六级听力在线版', '凸优化(Boyd 经典教材)',
    '免费编程书籍汇总'],
};
const langMap = new Map();
for (const [lang, names] of Object.entries(LANG)) for (const n of names) langMap.set(n, lang);

// tags: 由分类 + 已核实的关键词推导，可解释、可复现
const TAG_RULES = [
  [/中科大|USTC|科大|瀚海|蜗壳|希冀|评课/, '中科大'],
  [/镜像/, '镜像站'],
  [/数学|数分|线代|线性代数|微积分|凸优化|高数/, '数学'],
  [/物理|电磁|量子|力学|光学/, '物理'],
  [/化学|生物/, '理科基础'],
  [/英语|四级|六级|CET/, '英语'],
  [/编程|代码|语言|Python|C\+\+|JavaScript|开发/, '编程'],
  [/算法|刷题|竞赛|ICPC|评测/, '算法竞赛'],
  [/论文|文献|arXiv|知网|期刊|引用/, '论文'],
  [/LaTeX|排版/, 'LaTeX'],
  [/数据集|数据科学|机器学习|深度学习|模型|AI|人工智能/, 'AI/数据'],
  [/开源|GitHub|Gitee/, '开源'],
  [/笔记|知识管理|效率|白板|思维导图/, '效率工具'],
  [/课程|慕课|公开课|讲座|课堂/, '课程'],
  [/保研|招生|导师|就业|实习/, '升学就业'],
  [/实验|报告/, '实验'],
  [/网安|安全|CTF/, '网络安全'],
];

let langFilled = 0, tagsFilled = 0, unverifiedMarked = 0;
for (const r of doc.resources) {
  // language_support
  if (r.language_support === undefined) {
    r.language_support = langMap.get(r.title) || '未核验';
    if (r.language_support !== '未核验') langFilled++;
  }
  // tags
  if (!Array.isArray(r.tags) || r.tags.length === 0) {
    const t = new Set();
    const hay = r.title + ' ' + r.description;
    for (const [re, tag] of TAG_RULES) if (re.test(hay)) t.add(tag);
    r.tags = [...t];
    tagsFilled++;
  }
  // 核验类字段：明确标 '未核验'，绝不猜测
  for (const f of ['account_requirement', 'student_requirement', 'network_requirement', 'hardware_requirement']) {
    if (r[f] === undefined) { r[f] = '未核验'; unverifiedMarked++; }
  }
  if (r.verification_status === undefined) r.verification_status = '未核验';
  if (r.last_verified === undefined) r.last_verified = '';
  if (r.source === undefined) {
    r.source = /^https?:\/\/([^/]+)/.exec(r.url)?.[1] || '';
  }
  if (r.cost === undefined) {
    r.cost = r.free ? '免费' : '付费或部分免费';
  }
}

doc._note = '阶段 1 抽离 + 阶段 2 改造产物。字段名 name→title 对齐规范。' +
  'URL 修复、language_support、tags、source、cost 有实测/规则依据；' +
  'account_requirement / student_requirement / network_requirement / hardware_requirement / ' +
  'verification_status 一律标为「未核验」，未做任何猜测，待人工复核。';
doc._stage2 = {
  date: new Date().toISOString().slice(0, 10),
  urlFixes: log.length,
  languageFilled: langFilled, tagsFilled, unverifiedMarked,
};

await writeFile(FILE, JSON.stringify(doc, null, 2) + '\n', 'utf8');

console.log('=== URL 修正 ===');
for (const [kind, title, change, why] of log) {
  console.log('  [' + kind + '] ' + title);
  console.log('      ' + change);
  console.log('      依据: ' + why);
}
console.log('\n=== 字段补齐 ===');
console.log('  language_support 已填: ' + langFilled + ' / ' + doc.resources.length + '（未判定者标「未核验」）');
console.log('  tags 已填条目        : ' + tagsFilled);
console.log('  核验类字段标「未核验」: ' + unverifiedMarked + ' 处');
console.log('  source / cost 已补   : ' + doc.resources.length + ' 条');
