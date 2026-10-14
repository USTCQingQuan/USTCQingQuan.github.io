// 第三批：补充 Transformer / 注意力机制 / 神经网络基础资源（全部经真实 HTTP 实测）
import { readFile, writeFile } from 'node:fs/promises';

const FILE = process.argv[2];
const doc = JSON.parse(await readFile(FILE, 'utf8'));
const TODAY = '2026-10-14';
const CAT = 'AI 与数据科学';

const N = (t, d, u, icon, lang, tags, net) => ({
  title: t, description: d, category: CAT, url: u, icon, free: true,
  language_support: lang, tags,
  account_requirement: '未核验', student_requirement: '未核验',
  network_requirement: net || '未核验', hardware_requirement: '未核验',
  verification_status: '链接已实测可达（' + TODAY + '）',
  last_verified: TODAY,
  source: (/^https?:\/\/([^/]+)/.exec(u) || [])[1] || '',
  cost: '免费',
});

const ADD = [
  N('Attention Is All You Need（Transformer 原论文）',
    'Transformer 架构的原始论文,提出自注意力机制,现代大模型的起点。含摘要、PDF 与引用信息。',
    'https://arxiv.org/abs/1706.03762', '📜', 'en',
    ['AI', 'Transformer', '论文原文', '注意力机制']),

  N('The Illustrated Transformer',
    'Jay Alammar 的经典图解文章,用可视化方式讲清自注意力、多头注意力与编码解码结构,公认最好的入门材料。',
    'https://jalammar.github.io/illustrated-transformer/', '🎨', 'en',
    ['AI', 'Transformer', '图解', '注意力机制']),

  N('Learn NLP With Transformers（中文）',
    'Datawhale 开源中文教程,从 NLP 基础讲到 Transformer,含可运行代码,中文读者友好。',
    'https://github.com/datawhalechina/learn-nlp-with-transformers', '📚', 'zh',
    ['AI', 'Transformer', '自然语言处理', '中文教程']),

  N('Hugging Face Transformers 文档',
    '主流 Transformer 模型库官方文档,含预训练模型加载、微调与推理示例。',
    'https://huggingface.co/docs/transformers/index', '🤗', 'en',
    ['AI', 'Transformer', '官方文档', '预训练模型']),

  N('Hugging Face NLP 课程（中文版）',
    'Hugging Face 官方 NLP 课程中文版,从 Transformer 原理讲到微调与部署,免费且带练习。',
    'https://huggingface.co/learn/nlp-course/zh-CN/chapter1/1', '🎓', 'zh',
    ['AI', 'Transformer', '自然语言处理', '中文课程']),

  N('Transformer Explainer（交互可视化）',
    '佐治亚理工出品的交互式可视化工具,可实时观察 GPT-2 内部注意力如何计算。',
    'https://poloclub.github.io/transformer-explainer/', '🔍', 'en',
    ['AI', 'Transformer', '可视化', '交互工具']),

  N('李沐：Transformer 论文逐段精读',
    '《动手学深度学习》作者李沐的论文精读视频,逐段讲解 Transformer 原文与实现细节。',
    'https://www.bilibili.com/video/BV1pu411o7BE', '📺', 'zh',
    ['AI', 'Transformer', '论文精读', '视频课程']),

  N('动手学深度学习：注意力机制',
    '《动手学深度学习》注意力机制章节,含注意力评分、Bahdanau 注意力与多头注意力的完整推导与代码。',
    'https://zh-v2.d2l.ai/chapter_attention-mechanisms/index.html', '🧠', 'zh',
    ['AI', '注意力机制', '在线教材', '可运行代码']),

  N('nanoGPT',
    'Karpathy 的极简 GPT 实现,约 300 行代码训练一个字符级 GPT,理解 Transformer 训练流程的最佳实操。',
    'https://github.com/karpathy/nanoGPT', '🧪', 'en',
    ['AI', 'Transformer', 'GPT', '开源实现']),

  N('build-nanogpt（视频+代码）',
    'Karpathy 从零手写 GPT 的配套视频与代码,逐行讲解注意力、训练循环与推理。',
    'https://github.com/karpathy/build-nanogpt', '🔧', 'en',
    ['AI', 'Transformer', 'GPT', '教学视频']),

  N('The Annotated Transformer',
    '哈佛 NLP 组的经典教程,用可运行代码逐段注释 Transformer 论文实现,理论与代码对照。',
    'https://nlp.seas.harvard.edu/annotated-transformer/', '📝', 'en',
    ['AI', 'Transformer', '代码注释', '教程']),
];

// 去重校验
const uSet = new Set(doc.resources.map((r) => r.url.replace(/\/+$/, '').toLowerCase()));
const tSet = new Set(doc.resources.map((r) => r.title));
const dupU = ADD.filter((r) => uSet.has(r.url.replace(/\/+$/, '').toLowerCase())).map((r) => r.title);
const dupT = ADD.filter((r) => tSet.has(r.title)).map((r) => r.title);
const dupSelf = ADD.map((r) => r.title).filter((t, i, a) => a.indexOf(t) !== i);
if (dupU.length || dupT.length || dupSelf.length) {
  console.error('重复: URL=' + dupU.join(',') + ' 标题=' + dupT.join(',') + ' 内部=' + dupSelf.join(','));
  process.exit(1);
}

doc.resources.push(...ADD);
doc._count = doc.resources.length;
doc._batch3 = {
  date: TODAY,
  added: ADD.length,
  note: '补充 Transformer/注意力机制基础资源,全部经真实 HTTP 实测。' +
    '已排除: 3Blue1Brown B站链接(返回 200 但标题为「视频去哪了呢?」,内容已失效)、' +
    '知乎图解(403 反爬)、Kyubyong/transformer(实为 TensorFlow 实现而非图文教程,避免描述错误)。',
};

await writeFile(FILE, JSON.stringify(doc, null, 2) + '\n', 'utf8');
const byCat = {};
for (const r of doc.resources) byCat[r.category] = (byCat[r.category] || 0) + 1;
console.log('新增: ' + ADD.length + ' 条');
console.log('总计: ' + doc.resources.length + ' 条');
console.log('AI 与数据科学: ' + byCat[CAT] + ' 条');
