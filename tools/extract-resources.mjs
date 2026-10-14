// 阶段 1 / 步骤 1：把 index.html 内联的 RESOURCES 数组无损抽成 resources.json
//
// 设计原则（对应规范"不破坏现有功能"）：
//   1. 只读取 index.html，绝不改写它；
//   2. 逐条按行解析，保留原始行号，便于回溯与人工核对；
//   3. 输出后立即做"回环校验"：用抽出的数据重建数组文本，
//      与源文件内联数组做字节级比对，确保没有丢字段、没有改字。
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const SRC = process.argv[2];
const OUT = process.argv[3];

const src = await readFile(SRC, 'utf8');
const lines = src.split('\n');

// 1) 定位内联数组
const startIdx = src.indexOf('const RESOURCES = [');
if (startIdx < 0) throw new Error('找不到 const RESOURCES = [');
const endIdx = src.indexOf('\n];', startIdx);
if (endIdx < 0) throw new Error('找不到数组结束标记 \\n];');
const startLine = src.slice(0, startIdx).split('\n').length; // 数组声明所在行
const endLine = src.slice(0, endIdx).split('\n').length;     // '];' 所在行
console.log('内联数组位置: 第 ' + startLine + ' 行 至 第 ' + endLine + ' 行');

// 2) 逐条提取（每条资源独占一行，行号可追溯）
const items = [];
for (let i = startLine; i < endLine; i++) {           // 跳过声明行，止于 '];' 前
  const raw = lines[i];
  if (!raw || raw.trim() === '') continue;
  const m = raw.trim().match(/^\{\s*name:\s*"(.*)",\s*url:\s*"(.*)",\s*description:\s*"(.*)",\s*category:\s*"(.*)",\s*icon:\s*"(.*)",\s*free:\s*(true|false)\s*\},?$/);
  if (!m) throw new Error('第 ' + (i + 1) + ' 行无法解析: ' + raw.trim().slice(0, 80));
  items.push({
    title: m[1],              // name  -> title（规范字段名）
    description: m[3],
    category: m[4],
    url: m[2],
    icon: m[5],
    free: m[6] === 'true',
    _sourceLine: i + 1,       // 仅供回溯，不属于资源内容
  });
}
console.log('解析出资源条数: ' + items.length);

// 3) 回环校验：用抽出的数据重建内联数组文本，与源文件逐字节比对
// 注意：源文件中最后一条资源没有尾逗号，重建时必须保持一致
const rebuilt = items.map((r, i) =>
  '  { name: "' + r.title + '", url: "' + r.url + '", description: "' + r.description +
  '", category: "' + r.category + '", icon: "' + r.icon + '", free: ' + r.free + ' }' +
  (i < items.length - 1 ? ',' : '')
).join('\n');
const original = lines.slice(startLine, endLine).map((l) => l.trimEnd()).filter((l) => l.trim() !== '').join('\n');
const h = (s) => createHash('sha256').update(s, 'utf8').digest('hex');
console.log('回环校验: ' + (h(rebuilt) === h(original) ? 'PASS（重建文本与源文件逐字节一致）' : 'FAIL'));
if (h(rebuilt) !== h(original)) {
  console.log('  rebuilt sha256 = ' + h(rebuilt));
  console.log('  original sha256= ' + h(original));
  const a = original.split('\n');
  const b = rebuilt.split('\n');
  console.log('  original 行数=' + a.length + '  rebuilt 行数=' + b.length);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) {
      console.log('  首个差异在第 ' + (i + 1) + ' 条:');
      console.log('    original[' + (startLine + i) + '行]: ' + JSON.stringify((a[i] || '').slice(0, 120)));
      console.log('    rebuilt          : ' + JSON.stringify((b[i] || '').slice(0, 120)));
      break;
    }
  }
  process.exit(1);
}

// 4) 输出（剥掉内部回溯字段，保持 JSON 干净）
const payload = {
  _note: '阶段 1 抽离产物：内容源自 index.html 内联 RESOURCES 数组，未做任何增删改。字段名 name→title 为对齐规范，值未改。',
  _generatedFrom: 'index.html (git-blob-sha1 e3464d9c8110731477f3c9ffe165a1c8afa0fafb)',
  _count: items.length,
  resources: items.map(({ _sourceLine, ...rest }) => rest),
};
await writeFile(OUT, JSON.stringify(payload, null, 2) + '\n', 'utf8');
console.log('已写出: ' + OUT);

// 5) 字段盘点
const keys = new Set();
for (const r of payload.resources) for (const k of Object.keys(r)) keys.add(k);
console.log('字段: ' + [...keys].join(', '));
