// 从 smartpdf.html 的 CHANGELOG 取出最新版本的更新内容，当作 GitHub Release 的说明（软件里的「有新版本」会显示）
import { readFileSync } from 'node:fs';
const html = readFileSync(new URL('../smartpdf.html', import.meta.url), 'utf8');
const start = html.indexOf('const CHANGELOG = [');
const m = /\{\s*v:\s*'([^']+)',\s*d:\s*'([^']+)',\s*items:\s*\[([\s\S]*?)\]\s*\}/.exec(html.slice(start));
if (!m) { console.log(''); process.exit(0); }
const items = [...m[3].matchAll(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g)].map(x => (x[1] ?? x[2]).replace(/\\(['"])/g, '$1'));
console.log(items.map(i => '- ' + i).join('\n'));
