// v3.9.1 scan fix: the PowerShell scan scripts build, use the fallbacks, and errors are explained.
// Usage: node tests/scan-391.js smartpdf.html   (exits 1 on failure)
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const file = path.resolve(process.argv[2] || 'smartpdf.html');
  const b = await chromium.launch(), p = await b.newPage(), errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + file); await p.waitForTimeout(800);
  const r = await p.evaluate(() => {
    LANG = 'zh';
    const o = { dev: "dev'1", feed: 1, intent: 1, dpi: 200, w: 1654, h: 2338, png: false, out: 'C:\\t\\a', res: 'C:\\t\\a.json' };
    const scan = PS_SCAN(o), list = PS_LIST('C:\\t\\l.json');
    const bal = s => { let n = 0; for (const c of s.replace(/'(?:[^']|'')*'/g, '')) { if (c === '{') n++; else if (c === '}') n--; if (n < 0) return false; } return n === 0; };
    const err = scanErr({ ok: false, code: '80004002', msg: 'Specified cast is not valid.', step: 'transfer', log: 'C:\\t\\smartpdf-scan.log' });
    const hw = scanErr({ ok: false, code: '80210003' });
    return {
      fallbacks: ['$item.Transfer($fmt)', '$item.Transfer()', 'ShowTransfer', 'Items.Item(1)', 'System.Drawing'].every(k => scan.includes(k)),
      balanced: bal(scan) && bal(list) && bal(PS_HEAD + PS_SCANLIB),
      quoted: scan.includes("'dev''1'"),
      noJsLeak: !/\$\{|undefined/.test(scan),
      err, hw, fb: scanFallback({ ok: false, code: '80004002' }), noFb: !scanFallback({ ok: false, code: '80210003' }),
      ver: VERSION,
    };
  });
  await p.evaluate(() => { LANG = 'en'; });
  const en = await p.evaluate(() => scanErr({ ok: false, code: '80004002', msg: 'Specified cast is not valid.', step: 'transfer', log: 'X.log' }));
  await b.close();
  const checks = [
    ['scan script has all fallbacks', r.fallbacks], ['braces balanced', r.balanced], ['device id quoted', r.quoted], ['no JS leaks', r.noJsLeak],
    ['error names step and code', /80004002/.test(r.err) && /从扫描仪取图/.test(r.err) && /smartpdf-scan\.log/.test(r.err)],
    ['paper-out message kept', /进纸器没有纸/.test(r.hw)], ['unknown error falls back to Windows dialog', r.fb], ['hardware status does not fall back', r.noFb],
    ['English error translated', /^Scan failed: .*getting the image from the scanner.*Details: X\.log$/.test(en)], ['no page errors', !errs.length],
  ];
  let bad = 0; for (const [n, ok] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + n); if (!ok) bad++; }
  if (errs.length) console.log(errs);
  console.log('version', r.ver); process.exit(bad ? 1 : 0);
})();
