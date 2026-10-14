// 第五批：其他板块补充（9 条，全部实测通过）
import { readFile, writeFile } from 'node:fs/promises';

const FILE = process.argv[2];
const doc = JSON.parse(await readFile(FILE, 'utf8'));
const TODAY = '2026-10-14';

const N = (t, cat, d, u, icon, lang, tags, cost, net) => ({
  title: t, description: d, category: cat, url: u, icon,
  free: (cost || '免费') === '免费',
  language_support: lang, tags,
  account_requirement: '未核验', student_requirement: '未核验',
  network_requirement: net || '实测可达（本机网络）', hardware_requirement: '未核验',
  verification_status: '链接已实测可达（' + TODAY + '）',
  last_verified: TODAY,
  source: (/^https?:\/\/([^/]+)/.exec(u) || [])[1] || '',
  cost: cost || '免费',
});

const ADD = [
  N('国家高等教育智慧教育平台', '视频课程',
    '教育部委托建设运行的全国性在线开放课程平台,汇聚各高校优质慕课,可免费学习。权威性最高的中文慕课入口。',
    'https://higher.smartedu.cn/', '🏛️', 'zh',
    ['慕课', '高校课程', '官方平台', '免费', '国内可用'], '免费', '国内直连'),

  N('中国高校外语慕课平台 UMOOCs', '视频课程',
    '中国高校外语慕课联盟平台,汇聚各高校外语课程,含学术英语写作、出国英语等方向。',
    'https://moocs.unipus.cn/', '🗣️', 'zh',
    ['英语', '慕课', '学术英语', '高校课程'], '免费', '国内直连'),

  N('全国大学生电子设计竞赛培训网', '竞赛信息',
    '电子设计竞赛官方技术交流平台(站点自述为组委会授权),含信息发布、培训资源与往届回顾。硬件类竞赛目前仅此一条。',
    'https://www.nuedc-training.com.cn/', '🔌', 'zh',
    ['竞赛', '电子设计', '硬件', '官方信息'], '免费', '国内直连'),

  N('Wolfram Alpha', '效率工具',
    '计算型知识引擎,支持符号求导积分、方程求解、矩阵运算与单位换算,可显示解题步骤。中文界面。',
    'https://www.wolframalpha.com/', '🧮', 'zh+en',
    ['数学工具', '计算引擎', '符号运算', '解题步骤']),

  N('MATLAB Onramp 免费入门课', '学术科研',
    'MathWorks 官方免费入门课程,交互式学习 MATLAB 基础语法与工作流,配套已收录的 MATLAB 文档使用。',
    'https://matlabacademy.mathworks.com/details/matlab-onramp/gettingstarted', '📈', 'zh+en',
    ['MATLAB', '入门课程', '官方', '交互式学习']),

  N('物理学习 Wiki', '课程资料',
    '社区维护的物理学习 wiki,含学习方法、科研绘图工具与各方向经验整理,适合物理方向学生。',
    'https://github.com/Physics-Learning-Wiki/Physics-Learning-Wiki', '🔭', 'zh',
    ['物理', 'Wiki', '学习方法', '科研工具', '开源']),

  N('build-your-own-xxx', '编程开发',
    '从零实现各种经典系统的教程合集:Web 服务器、数据库、解释器等,适合进阶理解底层原理。',
    'https://github.com/XiaomingX/build-your-own-xxx', '🔨', 'zh+en',
    ['编程', '进阶', '底层原理', '开源', '项目实战']),

  N('动手学大模型 Dive into LLMs', 'AI 与数据科学',
    '大模型编程实践教程,面向动手复现与微调,适合已有深度学习基础后进入大模型实战。',
    'https://github.com/Jerrykooo/dive-into-llms', '🧗', 'zh',
    ['AI', '大语言模型', '实战教程', '开源']),
];

const uSet = new Set(doc.resources.map((r) => r.url.replace(/\/+$/, '').toLowerCase()));
const tSet = new Set(doc.resources.map((r) => r.title));
for (const r of ADD) {
  if (uSet.has(r.url.replace(/\/+$/, '').toLowerCase())) { console.error('URL 重复: ' + r.title); process.exit(1); }
  if (tSet.has(r.title)) { console.error('标题重复: ' + r.title); process.exit(1); }
}

doc.resources.push(...ADD);
doc._count = doc.resources.length;
doc._batch5 = {
  date: TODAY,
  added: ADD.length,
  note: '经联网搜索发现线索后逐条实测。' +
    '注意: 电子设计竞赛站点自述为"组委会唯一官方技术交流平台"，此为站点自身表述，未经独立核实。' +
    'MATLAB Onramp 收录的是实测的真实跳转地址(matlabacademy.mathworks.com)，非 mathworks.com 原始入口。' +
    '搜索过程发现: 该类"有哪些好资源"的查询返回结果多为内容农场/应用商店/百度百科，' +
    '可靠度低，故只收录实测通过项。',
};

await writeFile(FILE, JSON.stringify(doc, null, 2) + '\n', 'utf8');
const byCat = {};
for (const r of doc.resources) byCat[r.category] = (byCat[r.category] || 0) + 1;
console.log('新增: ' + ADD.length + ' 条');
console.log('总计: ' + doc.resources.length + ' 条');
console.log('');
for (const [c, n] of Object.entries(byCat).sort((a, b) => b[1] - a[1])) console.log('  ' + c.padEnd(16) + n);
