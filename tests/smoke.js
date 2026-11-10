// Smoke test: the page loads and the main export paths still work. Run: node tests/smoke.js smartpdf.html
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + require('path').resolve(process.argv[2] || 'smartpdf.html'));
  await pg.waitForFunction(() => typeof buildPdf === 'function' && !!document.querySelector('#welcome'));
  await pg.waitForTimeout(1000);
  const R = await pg.evaluate(async () => {
    const R = {};
    await loadSample(); R.samplePages = S.pages.length;
    R.saveBytes = (await buildPdf(S.pages)).length;
    // redact + save (flattened page)
    const d = await PDFLib.PDFDocument.create(); const f = await d.embedFont(PDFLib.StandardFonts.Helvetica);
    const p = d.addPage([400, 200]); p.drawText('IC: 900202-', { x: 20, y: 100, size: 12, font: f }); p.drawText('10-1234', { x: 20 + f.widthOfTextAtSize('IC: 900202-', 12), y: 100, size: 12, font: f });
    await openFiles([new File([await d.save()], 'ic.pdf', { type: 'application/pdf' })], 'replace');
    openRdk(); $('#rkWords').value = ''; $('#rk_ic').checked = true; await rdkFind(); rdkApply();
    R.redactBoxes = S.pages[0].ann.filter(a => a.rd).length;
    const out = await buildPdf(S.pages); const pdf = await pdfjsLib.getDocument({ data: out, isEvalSupported: false }).promise;
    R.textAfterRedact = (await (await pdf.getPage(1)).getTextContent()).items.map(i => i.str).join('');
    // compress whole doc + encrypt path + extract
    R.compressed = (await compressPdf(await buildPdf(S.pages), 'mid')).length > 0;
    R.tabs = TABS.list.length;
    closeTab(TABS.cur); R.tabsAfterClose = TABS.list.length;
    return R;
  });
  await pg.screenshot({ path: process.env.SHOT || '/tmp/smoke.png' });
  console.log(JSON.stringify(R), errs.length ? 'ERRORS ' + errs.join(' | ') : 'no page errors');
  await b.close();
})();
