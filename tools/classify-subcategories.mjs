// 给 170 条资源建立两级分类：category（保留不动） + subcategory（新增）
// 用索引映射，避免中文标题匹配出错；脚本自带完整性校验，漏项直接报错。
import { readFile, writeFile } from 'node:fs/promises';

const FILE = process.argv[2];
const doc = JSON.parse(await readFile(FILE, 'utf8'));

// 每个大类的子分类定义
const SUBCATS = {
  'AI 与数据科学': ['AI 基础学习', 'Transformer 与 NLP', 'AI 编程与工具', '开源模型与数据集', '本地 AI 部署', 'AI 应用', 'AI 科研与社区'],
  '课程资料': ['试卷与真题', '教材与参考书', '课程资源合集', '课程笔记与讲义', '实验报告与数据', '编程入门教程', '数学工具'],
  '编程开发': ['编程文档与参考', '开发教程与课程', '算法与刷题', '代码托管与开源', '软件源镜像', '数据科学', '编程问答社区', '编程语言与工具'],
  '学术科研': ['文献检索', '论文阅读与管理', '写作与排版', '计算与仿真', '数据分析'],
  '校内平台': ['选课与课程评价', '学习与实验平台', '资源导航', '社区与活动', '文献与工具', '软件源镜像'],
  '视频课程': ['慕课平台', '公开课与单课', '短视频学习'],
  '英语备考': ['四六级', '雅思'],
  '竞赛信息': ['数学建模', '程序设计竞赛', '其他学科竞赛（电子设计等）'],
  '效率工具': ['笔记与知识管理', '记忆与学习', '绘图与可视化'],
  '校园信息': ['升学与就业指导', '校园生活与心理健康', '官方通知'],
};

// 索引 -> 子分类（索引从 1 开始，按上一步列出的顺序；-1 表示跨分类重复条目，会并入同类）
const MAP = {
  'AI 与数据科学': {
    'AI 基础学习': [1, 2, 3, 4, 5, 6],
    'Transformer 与 NLP': [30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40],
    'AI 编程与工具': [7, 8, 9, 10, 11, 12, 13, 14, 41],
    '开源模型与数据集': [15, 16, 17, 18],
    '本地 AI 部署': [19, 20, 21, 22],
    'AI 科研与社区': [23, 24, 25],
    'AI 应用': [26, 27, 28, 29],
  },
  '课程资料': {
    '试卷与真题': [20, 21, 22, 23],
    '教材与参考书': [15, 16, 27, 28, 29, 30, 31, 32, 33, 34],
    '课程资源合集': [1, 2, 3, 8, 9, 14, 17, 18, 19, 24, 35],
    '课程笔记与讲义': [6, 7, 25, 26, 36],
    '实验报告与数据': [10, 11, 12, 13],
    '编程入门教程': [4, 5],
  },
  '编程开发': {
    '编程文档与参考': [3, 9, 16],
    '开发教程与课程': [4, 5, 18, 21],
    '算法与刷题': [2, 11, 20],
    '代码托管与开源': [1, 12],
    '软件源镜像': [13, 14, 15],
    '数据科学': [6, 10],
    '编程问答社区': [8],
    '编程语言与工具': [17, 19],
  },
  '学术科研': {
    '文献检索': [1, 6, 8, 9],
    '论文阅读与管理': [2, 3, 4, 7, 10],
    '写作与排版': [5],
    '计算与仿真': [11, 12, 16],
    '数据分析': [13, 14, 15],
  },
  '校内平台': {
    '选课与课程评价': [1],
    '社区与活动': [2, 4, 5],
    '资源导航': [11, 12, 13],
    '学习与实验平台': [7, 9, 10],
    '文献与工具': [6, 8, 14],
    '软件源镜像': [3],
  },
  '视频课程': {
    '慕课平台': [1, 3, 7, 8],
    '公开课与单课': [4, 5, 6, 9, 10],
    '短视频学习': [2],
  },
  '英语备考': {
    '四六级': [1, 2, 3, 4, 5, 6],
    '雅思': [7, 8, 9, 10, 11],
  },
  '竞赛信息': {
    '数学建模': [1, 2, 3, 4],
    '程序设计竞赛': [5, 6],
    '其他学科竞赛（电子设计等）': [7],
  },
  '效率工具': {
    '笔记与知识管理': [1, 2],
    '记忆与学习': [3],
    '绘图与可视化': [4, 5],
  },
  '校园信息': {
    '升学与就业指导': [2, 4],
    '校园生活与心理健康': [1],
    '官方通知': [3, 5],
  },
};

// 跨大类移动：某些资源归到别的大类更合理，这里显式声明（索引基于其"原"大类的列表）
// 判定依据：内容是"数学工具/外语慕课"，放在原大类里用户找不到。
const MOVE = [
  { from: '效率工具', idx: 6, toCat: '课程资料', toSub: '数学工具', title: 'Wolfram Alpha' },
  { from: '视频课程', idx: 13, toCat: '学术科研', toSub: '写作与排版', title: '中国高校外语慕课平台 UMOOCs' },
  { from: '视频课程', idx: 12, toCat: '视频课程', toSub: '慕课平台', title: '国家高等教育智慧教育平台' },
  { from: '视频课程', idx: 11, toCat: '课程资料', toSub: '教材与参考书', title: '线性代数的本质（3Blue1Brown）' },
  { from: '编程开发', idx: 7, toCat: 'AI 与数据科学', toSub: 'AI 基础学习', title: '动手学深度学习' },
];

// 修正：上面按"上一步列出的顺序"编号，但英语备考只列了 11 条，UMOOCs 在视频课程里，
// 因此英语备考的 12/13 不存在 —— 做一次显式校验并报告。
const byCat = {};
for (const r of doc.resources) (byCat[r.category] = byCat[r.category] || []).push(r);

const problems = [];
const assigned = new Map();
const movedTitles = new Set(MOVE.map((m) => m.title));
const moveByIdx = new Map(MOVE.map((m) => [m.from + '#' + m.idx, m]));

for (const [cat, groups] of Object.entries(MAP)) {
  const list = byCat[cat] || [];
  const seen = new Set();
  for (const [sub, idxs] of Object.entries(groups)) {
    for (const i of idxs) {
      if (i < 1 || i > list.length) { problems.push(cat + ' 索引越界: ' + i + '（该分类只有 ' + list.length + ' 条）'); continue; }
      if (seen.has(i)) { problems.push(cat + ' 索引重复: ' + i + ' -> ' + list[i - 1].title); continue; }
      seen.add(i);
      assigned.set(list[i - 1].title, { cat, sub });
    }
  }
  // 跨类移动的条目不算"未分配"
  const unassigned = list.filter((r, i) => !seen.has(i + 1) && !movedTitles.has(r.title)).map((r) => r.title);
  for (const u of unassigned) problems.push(cat + ' 未分配子分类: ' + u);
  // 移动声明的原位置必须真实存在
  for (const [key, m] of moveByIdx) {
    const [c, i] = key.split('#');
    if (c !== cat) continue;
    const target = list[Number(i) - 1];
    if (!target) problems.push(cat + ' 移动索引越界: ' + i);
    else if (target.title !== m.title) problems.push(cat + ' 移动目标不符: 索引 ' + i + ' 实际是「' + target.title + '」，声明为「' + m.title + '」');
  }
}

// 应用跨类移动
for (const m of MOVE) {
  const r = doc.resources.find((x) => x.title === m.title);
  if (!r) { problems.push('找不到待移动资源: ' + m.title); continue; }
  if (r.category !== m.from) problems.push('移动源大类不符: ' + m.title + ' 实际在 ' + r.category + '，声明从 ' + m.from);
  if (!SUBCATS[m.toCat].includes(m.toSub)) problems.push('移动目标子分类未声明: ' + m.toCat + ' / ' + m.toSub);
  assigned.set(m.title, { cat: m.toCat, sub: m.toSub });
}

if (problems.length) {
  console.error('发现 ' + problems.length + ' 个问题，未写入任何改动：');
  problems.slice(0, 40).forEach((p) => console.error('  ' + p));
  process.exit(1);
}

// 校验子分类都已在 SUBCATS 中声明
for (const [title, a] of assigned) {
  if (!SUBCATS[a.cat] || !SUBCATS[a.cat].includes(a.sub)) { console.error('子分类未声明: ' + a.cat + ' / ' + a.sub + '（' + title + '）'); process.exit(1); }
}

for (const r of doc.resources) {
  const a = assigned.get(r.title);
  r.subcategory = a.sub;
  r.category = a.cat;   // 应用跨类移动
}
doc._count = doc.resources.length;
doc._subcategories = {
  date: '2026-10-14',
  scheme: SUBCATS,
  note: '两级分类：category 为大方类，subcategory 为其下的子分类。' +
    '试卷作为「课程资料」下的独立子分类保留，不删除。' +
    'Wolfram Alpha 由效率工具移入课程资料/数学工具；中国高校外语慕课平台 UMOOCs 由视频课程移入学术科研/写作与排版。',
};

await writeFile(FILE, JSON.stringify(doc, null, 2) + '\n', 'utf8');

console.log('两级分类已写入：' + doc.resources.length + ' 条全部有子分类\n');
for (const [cat, subs] of Object.entries(SUBCATS)) {
  const list = doc.resources.filter((r) => r.category === cat);
  console.log('【' + cat + '】' + list.length + ' 条');
  for (const s of subs) {
    const items = list.filter((r) => r.subcategory === s);
    console.log('   ├ ' + s + '（' + items.length + '）' + (items.length ? ': ' + items.map((r) => r.title).join('、') : '  ← 空'));
  }
  console.log('');
}
