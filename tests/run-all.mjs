// 跑全部回归测试与数据闸门。
// 用法: node tests/run-all.mjs
//
// 为什么需要它：项目此前没有任何测试，改动只能靠人工点。
// 这里把「数据闸门 + 页面行为回归」串成一条命令，每次改完都该跑一遍。
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const SUITES = [
  { name: '数据闸门 · resources', cmd: ['tools/check-resources.mjs', 'resources.json'] },
  { name: '数据闸门 · guides/skills', cmd: ['tools/check-guides.mjs', 'guides.json', 'skills.json', 'resources.json'] },
  { name: '回归 · 视图与详情页', cmd: ['tests/verify-views.mjs', 'index.html'] },
  { name: '回归 · 两级筛选', cmd: ['tests/verify-filters.mjs', 'index.html'] },
  { name: '回归 · 数据加载双路径', cmd: ['tests/verify-loader.mjs', 'index.html'] },
  { name: '回归 · 搜索计数与高亮', cmd: ['tests/verify-search.mjs', 'index.html'] },
  { name: '回归 · 搜索排序与建议', cmd: ['tests/verify-search-rank.mjs', 'index.html'] },
  { name: '回归 · 多关键词与模糊搜索', cmd: ['tests/verify-search-fuzzy.mjs', 'index.html'] },
  { name: '回归 · 历年试卷索引', cmd: ['tests/verify-exams.mjs', 'index.html'] },
  { name: '回归 · AI 防幻觉闸门', cmd: ['tests/verify-ai-guard.mjs'] },
];

let failed = 0;
for (const s of SUITES) {
  const script = s.cmd[0];
  if (!existsSync(script)) { console.log('跳过（不存在）: ' + script); continue; }
  console.log('\n' + '#'.repeat(64));
  console.log('# ' + s.name);
  console.log('#'.repeat(64));
  const r = spawnSync(process.execPath, s.cmd, { stdio: 'inherit' });
  if (r.status !== 0) { failed++; console.log('\n>>> 失败: ' + s.name); }
}

console.log('\n' + '='.repeat(64));
console.log(failed === 0 ? '全部测试通过 ✓' : (failed + ' 个测试套件失败 ✗'));
process.exit(failed === 0 ? 0 : 1);
