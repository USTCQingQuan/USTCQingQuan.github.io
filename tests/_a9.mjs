// 响应式检查：用 iframe 精确控制宽度，让页面自己报告溢出情况
import { createServer } from 'node:http';
import { readFile, stat, writeFile, unlink } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const ROOT = 'D:\\DSH-Output\\shixueji\\repo-real';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = 'D:\\DSH-Output\\shixueji\\cp-resp';

// 起本地 HTTP 服务（iframe 跨 file:// 拿不到 contentDocument）
const server = createServer(async (req, res) => {
  try {
    const u = decodeURIComponent(req.url.split('?')[0]);
    const p = path.join(ROOT, u === '/' ? 'index.html' : u);
    const st = await stat(p);
    if (st.isDirectory()) { res.writeHead(404); res.end(); return; }
    const buf = await readFile(p);
    const ct = p.endsWith('.json') ? 'application/json'
      : p.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': ct });
    res.end(buf);
  } catch (e) { res.writeHead(404); res.end('nf'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const WIDTHS = [320, 360, 390, 430, 768, 1024, 1200, 1440];

for (const W of WIDTHS) {
  const harness = path.join(ROOT, '_resp_' + W + '.html');
  const html = `<!doctype html><html><head><meta charset="utf-8">${W < 768 ? '<meta name="viewport" content="width=device-width,initial-scale=1">' : ''}
<style>html,body{margin:0}#f{width:${W}px;height:900px;border:0;display:block}</style></head><body>
<iframe id="f" src="http://127.0.0.1:${port}/index.html"></iframe>
<script>
setTimeout(function(){
  var log = [];
  var d = document.getElementById('f').contentDocument;
  if (!d || !d.body) { log.push('iframe 未就绪'); }
  else {
    var vw = d.documentElement.clientWidth;
    var sw = d.documentElement.scrollWidth;
    log.push('视口=' + vw + '  scrollWidth=' + sw + (sw > vw + 1 ? '  ✗ 横向溢出 ' + (sw - vw) + 'px' : '  ✓ 无横向滚动'));
    if (sw > vw + 1) {
      var bad = [];
      Array.prototype.forEach.call(d.querySelectorAll('*'), function(el){
        var r = el.getBoundingClientRect();
        if (r.right > vw + 1 && r.width > 0 && r.height > 0) {
          bad.push(el.tagName.toLowerCase() + (el.id ? '#'+el.id : '') + (el.className ? '.'+String(el.className).split(' ').join('.') : '') + ' right=' + Math.round(r.right));
        }
      });
      log.push('  溢出元素 ' + bad.length + ' 个:');
      bad.slice(0, 6).forEach(function(b){ log.push('    ' + b); });
    }
    // 检查关键元素是否存在且有尺寸
    var checks = [['品牌条', '.brandbar'], ['轮播', '#heroBanner'], ['图标宫格', '#iconGrid'], ['底部标签栏', '#tabbar']];
    checks.forEach(function(c){
      var el = d.querySelector(c[1]);
      if (!el) { log.push('  ✗ ' + c[0] + ' 不存在'); return; }
      var r = el.getBoundingClientRect();
      var vis = getComputedStyle(el).display !== 'none';
      log.push('  ' + c[0] + ': ' + Math.round(r.width) + 'x' + Math.round(r.height) + (vis ? '' : ' (display:none)'));
    });
    // 底部标签栏应只在 ≤720px 显示
    var tb = d.getElementById('tabbar');
    if (tb) {
      var disp = getComputedStyle(tb).display;
      var expect = vw <= 720 ? 'flex' : 'none';
      log.push('  底部标签栏 display=' + disp + (disp === expect ? '  ✓' : '  ✗ 期望 ' + expect));
    }
  }
  var p = document.createElement('pre'); p.id = 'REPORT';
  p.textContent = log.join('\\n');
  document.body.appendChild(p);
}, 2600);
</script></body></html>`;
  await writeFile(harness, html, 'utf8');

  let dom = '';
  try {
    dom = execFileSync(CHROME, ['--headless', '--disable-gpu', '--no-sandbox', '--user-data-dir=' + PROFILE,
      '--no-first-run', '--disable-extensions', '--disable-crash-reporter',
      '--virtual-time-budget=9000', '--window-size=1600,1000',
      '--dump-dom', 'http://127.0.0.1:' + port + '/_resp_' + W + '.html'],
      { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'], timeout: 120000 });
  } catch (e) { /* dump 超时也尽量取已生成内容 */ }

  const m = dom.match(/id="REPORT">([\s\S]*?)<\/pre>/);
  console.log('──────── 宽度 ' + W + 'px ────────');
  if (m) {
    console.log(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
  } else {
    console.log('  未取到报告');
  }
  console.log('');
  await unlink(harness).catch(() => {});
}

server.close();
