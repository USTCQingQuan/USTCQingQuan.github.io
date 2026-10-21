// 数据闸门 · 文件编码与内嵌同步
//
// 为什么需要：PowerShell 5.1 的 `Set-Content -Encoding UTF8` 会写入 BOM（EF BB BF），
// JSON.parse 遇到 BOM 直接抛错。浏览器对 fetch().json() 能容错，但任何 Node 工具链、
// CI、别的程序读这些文件都会失败。这种问题平时不显形，一旦换环境排查很费时间。
import { readFile } from 'node:fs/promises';
import { makeChecker } from './dom-stub.mjs';

const { check, done } = makeChecker();

const DATA = ['resources.json', 'channels.json', 'news.json', 'issues.json'];
const PAGE = 'index.html';

console.log('=== 1. 数据文件：无 BOM 且可被 JSON.parse ===');
for (const f of DATA) {
  let buf;
  try { buf = await readFile(f); } catch (e) { check(f + ' 存在', false, true); continue; }
  const hasBom = buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF;
  check(f + ' 无 BOM', hasBom, false);
  let parsed = true;
  try { JSON.parse(buf.toString('utf8')); } catch (e) { parsed = false; }
  check(f + ' 可解析', parsed, true);
}

console.log('');
console.log('=== 2. 页面文件：无 BOM、是完整 HTML ===');
{
  const buf = await readFile(PAGE);
  const hasBom = buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF;
  check(PAGE + ' 无 BOM', hasBom, false);
  const head = buf.slice(0, 40).toString('utf8').toLowerCase();
  check(PAGE + ' 以 <!doctype 开头', head.indexOf('<!doctype') === 0, true);
}

console.log('');
console.log('=== 3. 内嵌资源与 resources.json 同步（防止改了 JSON 忘了 build） ===');
{
  const html = await readFile(PAGE, 'utf8');
  const res = JSON.parse(await readFile('resources.json', 'utf8'));
  const inner = (html.match(/const RESOURCES = \[([\s\S]*?)\n\];/) || ['', ''])[1];
  const names = [...inner.matchAll(/\{\s*name:\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]);
  console.log('  resources.json ' + res.resources.length + ' 条 / 页面内嵌 ' + names.length + ' 条');
  check('内嵌条数与 JSON 一致', names.length, res.resources.length);
  const missing = res.resources.filter((r) => !names.includes(r.title)).map((r) => r.title);
  check('每条资源的标题都在内嵌数据里', missing.length, 0);
  if (missing.length) console.log('    缺: ' + missing.slice(0, 5).join('、'));

  // 数据指纹也要对得上
  const sha = (html.match(/const RES_SHA = "([0-9a-f]+)";/) || [])[1];
  check('DATA 区带数据指纹', !!sha, true);
}

process.exit(done() ? 0 : 1);
