// 发布前检查：smartpdf.html 里每一段 <script> 都要能解析，不然整个软件打开是空的（v3.7.2 就是这样）
import { readFileSync } from 'fs';
const html = readFileSync(new URL('../smartpdf.html', import.meta.url), 'utf8');
const re = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g;
let m, n = 0, bad = 0;
while ((m = re.exec(html))) {
  if (/type="text\/plain"/.test(m[1])) continue;
  n++;
  try { new Function(m[2]); } catch (e) { bad++; console.error(`script #${n}: ${e.message}`); }
}
// 安全检查：app 里每个 pdfjsLib.getDocument 都要关掉 eval（CVE-2024-4367）
const app = html.slice(html.lastIndexOf('<script>'));
for (const g of app.match(/pdfjsLib\.getDocument\([^\n]*/g) || []) if (!/isEvalSupported:\s*false/.test(g)) { bad++; console.error('getDocument without isEvalSupported: false → ' + g.slice(0, 120)); }
if (bad) process.exit(1);
console.log(`checkjs: ${n} scripts OK`);
