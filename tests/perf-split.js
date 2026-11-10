// Timing: one-page exports from a 400-page file (split "each page"). Run: node tests/perf-split.js smartpdf.html
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage();
  pg.on('pageerror', e => console.log('PAGEERR', e.message));
  await pg.goto('file://' + require('path').resolve(process.argv[2] || 'smartpdf.html'));
  await pg.waitForFunction(() => typeof buildPdf === 'function'); await pg.waitForTimeout(800);
  console.log(JSON.stringify(await pg.evaluate(async () => {
    const d = await PDFLib.PDFDocument.create(), f = await d.embedFont(PDFLib.StandardFonts.Helvetica);
    for (let i = 0; i < 400; i++) d.addPage([300, 300]).drawText('Big p' + (i + 1), { x: 20, y: 150, size: 14, font: f });
    await openFiles([new File([await d.save()], 'big.pdf', { type: 'application/pdf' })], 'replace');
    const t0 = performance.now(); await buildPdf([S.pages[0]]); const first = performance.now() - t0;
    const t1 = performance.now(); for (let i = 1; i < 41; i++) await buildPdf([S.pages[i]]); const per = (performance.now() - t1) / 40;
    return { firstMs: Math.round(first), warmMsPerPage: Math.round(per), est400s: +((first + per * 399) / 1000).toFixed(1) };
  })));
  await b.close();
})();
