// v3.10.0: two-page view, reading mode, autosave + crash recovery, OCR review screen, Ctrl+K command palette.
// Usage: node tests/v310.js smartpdf.html   (exits 1 on failure)
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch(), pg = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [];
  pg.on('pageerror', e => errs.push(String(e)));
  await pg.goto('file://' + path.resolve(process.argv[2] || 'smartpdf.html'));
  await pg.waitForFunction(() => typeof wire310 === 'function' && typeof buildPdf === 'function' && !!document.querySelector('#welcome'));
  await pg.waitForTimeout(800);
  const R = {};
  // open a 5-page PDF
  await pg.evaluate(async () => {
    const d = await PDFLib.PDFDocument.create(), f = await d.embedFont(PDFLib.StandardFonts.Helvetica);
    for (let i = 1; i <= 5; i++) d.addPage([400, 560]).drawText('Page ' + i, { x: 40, y: 500, size: 24, font: f });
    await openFiles([new File([await d.save()], 'five.pdf', { type: 'application/pdf' })], 'replace');
  });
  await pg.waitForTimeout(500);
  // --- view modes
  Object.assign(R, await pg.evaluate(async () => {
    const o = {};
    setView('spread', true); await new Promise(r => setTimeout(r, 300));
    const ps = $$('#pages .pg');
    o.spreadClass = $('#pages').classList.contains('spread');
    o.spreadSideBySide = ps.length === 5 && Math.abs(ps[0].getBoundingClientRect().top - ps[1].getBoundingClientRect().top) < 2 && ps[1].getBoundingClientRect().left > ps[0].getBoundingClientRect().right;
    goPage(0); o.stepSpread = viewStep(1) === 2;
    setView('cover', true); await new Promise(r => setTimeout(r, 300));
    const q = $$('#pages .pg');
    o.coverFirstAlone = q[0].getBoundingClientRect().top < q[1].getBoundingClientRect().top - 10 && Math.abs(q[1].getBoundingClientRect().top - q[2].getBoundingClientRect().top) < 2;
    goPage(0); o.stepCover = viewStep(1) === 1;
    o.saved = LS.get('pdfed.view') === 'cover';
    o.label = $('#viewBtn').textContent.length > 0;
    setView('single', true); await new Promise(r => setTimeout(r, 300));
    const s = $$('#pages .pg'); o.singleStacked = s[1].getBoundingClientRect().top > s[0].getBoundingClientRect().bottom;
    return o;
  }));
  // --- reading mode
  await pg.evaluate(() => { goPage(0); setReading(true); });
  await pg.waitForTimeout(500);
  Object.assign(R, await pg.evaluate(() => ({ readingOn: $('#app').classList.contains('reading') && !$('#readBar').hidden && getComputedStyle($('.top')).display === 'none' })));
  await pg.keyboard.press('ArrowRight'); await pg.waitForTimeout(400);
  R.readingArrow = await pg.evaluate(() => S.cur === 1 && $('#rbPg').textContent.startsWith('2 /'));
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(500);
  R.readingOff = await pg.evaluate(() => !$('#app').classList.contains('reading') && $('#readBar').hidden && getComputedStyle($('.top')).display !== 'none');
  // --- Ctrl+K palette
  await pg.keyboard.press('Control+k'); await pg.waitForTimeout(200);
  R.cmdOpens = await pg.evaluate(() => !$('#mCmd').hidden && $$('#cmdList li').length > 10);
  await pg.keyboard.type('4'); await pg.waitForTimeout(100);
  R.cmdPageJumpFirst = await pg.evaluate(() => /4/.test(CMD.hits[0].label));
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(400);
  R.cmdJumped = await pg.evaluate(() => $('#mCmd').hidden && S.cur === 3);
  await pg.keyboard.press('Control+k'); await pg.waitForTimeout(150);
  await pg.keyboard.type(await pg.evaluate(() => T('双页'))); await pg.waitForTimeout(100);
  R.cmdFilters = await pg.evaluate(() => CMD.hits.length >= 1 && CMD.hits.every(c => (c.label + c.sub + c.kind).toLowerCase().includes(T('双页').toLowerCase())));
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(400);
  R.cmdRan = await pg.evaluate(() => VIEW.mode === 'spread');
  await pg.keyboard.press('Control+k'); await pg.waitForTimeout(150);
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(150);
  R.cmdEsc = await pg.evaluate(() => $('#mCmd').hidden);
  await pg.evaluate(() => setView('single', true));
  // --- autosave + recovery (web: IndexedDB)
  Object.assign(R, await pg.evaluate(async () => {
    const o = {};
    S.pages[0].rot = 90; S.dirty = true;
    await rcvTick();
    let list = await rcvList(); o.autosaved = list.length === 1 && list[0].meta.name === 'five.pdf' && list[0].meta.pages === 5;
    const bytes = await rcvGet(list[0].id); o.autosaveIsPdf = !!bytes && new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-';
    // pretend it came from a window that crashed 10 minutes ago
    const id = list[0].id, m = list[0].meta; m.t = Date.now() - 600000; await rcvPut(id, m, bytes);
    RCV.mine.clear(); S.rcvId = null; S.dirty = false;
    await rcvCheck(); o.recoverAsks = !$('#mRcv').hidden && $$('#rcvList input').length === 1;
    const before = TABS.list.length;
    await rcvRestore();
    o.recovered = S.fileName === 'five.pdf' && S.pages.length === 5 && S.dirty === true && TABS.list.length === before + 1;
    o.recoveryCleared = (await rcvList()).length === 0;
    // saved again → autosave is removed
    await rcvTick(); o.autosaveAgain = (await rcvList()).length === 1;
    S.dirty = false; await rcvTick(); o.savedDropsAutosave = (await rcvList()).length === 0;
    return o;
  }));
  // --- OCR review screen
  const pReview = pg.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 80; c.height = 30;
    const items = [{ w: { text: 'He1lo', confidence: 40 }, page: 1, img: c.toDataURL() }, { w: { text: 'world', confidence: 55 }, page: 1, img: c.toDataURL() }];
    window.__it = items; return ocrrShow(items);
  });
  await pg.waitForTimeout(200);
  R.reviewShows = await pg.evaluate(() => !$('#mOcrR').hidden && $$('#ocrRList input').length === 2);
  await pg.fill('#ocrRList input[data-i="0"]', 'Hello');
  await pg.click('#ocrRGo');
  R.reviewFixed = (await pReview) === 1 && await pg.evaluate(() => __it[0].w.text === 'Hello' && __it[1].w.text === 'world' && $('#mOcrR').hidden);
  // --- English labels
  R.english = await pg.evaluate(() => { const was = LANG; setLang('en'); const ok = /Single|Two/.test($('#viewBtn').textContent) && $('#readBtn').textContent.trim() === 'Read'; setLang(was); return ok; });
  await pg.evaluate(() => { setView('cover', false); }); await pg.waitForTimeout(400);
  await pg.screenshot({ path: process.env.SHOT || '/tmp/v310.png' });
  await b.close();
  let bad = 0;
  for (const [k, v] of Object.entries(R)) { if (!v) bad++; console.log((v ? 'PASS ' : 'FAIL ') + k); }
  if (errs.length) { bad++; console.log('page errors', errs); } else console.log('PASS no page errors');
  process.exit(bad ? 1 : 0);
})();
