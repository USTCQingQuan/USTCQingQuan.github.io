// 第四批：雅思备考资源（全部来自 ieltsonlinetests.com，逐条实测 200 + 真实标题）
import { readFile, writeFile } from 'node:fs/promises';

const FILE = process.argv[2];
const doc = JSON.parse(await readFile(FILE, 'utf8'));
const TODAY = '2026-10-14';
const CAT = '英语备考';
const SRC = 'ieltsonlinetests.com';

const N = (t, d, u, icon, lang, tags, cost) => ({
  title: t, description: d, category: CAT, url: u, icon,
  free: cost === '免费',
  language_support: lang, tags,
  account_requirement: '未核验', student_requirement: '未核验',
  network_requirement: '实测可达（本机网络）', hardware_requirement: '未核验',
  verification_status: '链接已实测可达（' + TODAY + '）',
  last_verified: TODAY,
  source: SRC,
  cost,
});

const ADD = [
  N('IELTS Online Tests 雅思真题库（中文版）',
    '雅思在线真题库简体中文入口,含听力、阅读、写作、口语全套免费模拟题与答案,可在线做题并自动批改客观题。站内另有付费的考官评分与视频课。',
    'https://ieltsonlinetests.com/zh-hans/ielts-exam-library', '🇬🇧', 'zh',
    ['英语', '雅思', 'IELTS', '真题题库', '出国留学'], '免费（部分高级功能付费）'),

  N('IELTS Online Tests 雅思真题库（英文原版）',
    '同站英文原版入口,题库更新通常早于各语言版本,适合适应英文界面的考生。',
    'https://ieltsonlinetests.com/ielts-exam-library', '🌐', 'en',
    ['英语', '雅思', 'IELTS', '真题题库'], '免费（部分高级功能付费）'),

  N('雅思听力练习题库',
    '按听力单项筛选的真题练习,含音频与题目,可反复重做。',
    'https://ieltsonlinetests.com/ielts-exam-library?skill=listening', '🎧', 'zh+en',
    ['英语', '雅思', '听力', '真题题库'], '免费'),

  N('雅思阅读练习题库',
    '按阅读单项筛选的真题练习,含三篇文章与题型解析。',
    'https://ieltsonlinetests.com/ielts-exam-library?skill=reading', '📖', 'zh+en',
    ['英语', '雅思', '阅读', '真题题库'], '免费'),

  N('雅思写作与口语备考技巧',
    '写作与口语的评分标准解读、范文与答题思路,配合题库使用。',
    'https://ieltsonlinetests.com/ielts-tips', '✍️', 'zh+en',
    ['英语', '雅思', '写作', '口语', '备考技巧'], '免费'),
];

const uSet = new Set(doc.resources.map((r) => r.url.replace(/\/+$/, '').toLowerCase()));
const tSet = new Set(doc.resources.map((r) => r.title));
for (const r of ADD) {
  if (uSet.has(r.url.replace(/\/+$/, '').toLowerCase())) { console.error('URL 重复: ' + r.title); process.exit(1); }
  if (tSet.has(r.title)) { console.error('标题重复: ' + r.title); process.exit(1); }
}

doc.resources.push(...ADD);
doc._count = doc.resources.length;
doc._batch4 = {
  date: TODAY,
  added: ADD.length,
  source: '用户提供的 https://ieltsonlinetests.com/ielts-exam-library',
  note: '该站子路径未按常见命名规则(实测 /ielts-listening-practice-tests 等 6 条猜测路径全部 404)，' +
    '故改用从页面抓取真实链接的方式确定 URL，避免收录死链。' +
    '站点含付费项（考官评分、PDF Pack、视频课），故 cost 如实标注为「免费（部分高级功能付费）」。',
};

await writeFile(FILE, JSON.stringify(doc, null, 2) + '\n', 'utf8');
const byCat = {};
for (const r of doc.resources) byCat[r.category] = (byCat[r.category] || 0) + 1;
console.log('新增: ' + ADD.length + ' 条（雅思）');
console.log('总计: ' + doc.resources.length + ' 条');
console.log('英语备考: ' + byCat[CAT] + ' 条');
