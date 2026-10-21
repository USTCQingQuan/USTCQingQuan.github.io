// 跑全部回归测试与数据闸门。
// 用法: node tests/run-all.mjs
//
// 站点结构（2026-10 精简后）：
//   首页 + 5 个分区：学生权益反馈渠道 / 校园报修 / 部门直拨电话 / 教学服务 / 校园平台
//   另有独立页「学生会反馈渠道」，只从首页宫格进入，不占顶部导航。
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const SUITES = [
  { name: '数据闸门 · resources 完整性', cmd: ['tests/verify-data.mjs'] },
  { name: '数据闸门 · 文件编码与内嵌同步', cmd: ['tests/check-encoding.mjs'] },
  { name: '回归 · 路由与视图', cmd: ['tests/verify-routing.mjs'] },
  { name: '回归 · 校园平台（搜索/筛选/详情）', cmd: ['tests/verify-campus.mjs'] },
  { name: '回归 · 权益渠道与首页宫格', cmd: ['tests/verify-rights.mjs'] },
  { name: '回归 · 数据加载双路径', cmd: ['tests/verify-loader.mjs', 'index.html'] },
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
