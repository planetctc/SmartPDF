// v3.8.1 regression checks for the audit fixes. Exit code 1 if any check fails.
// Run: node tests/regress-381.js smartpdf.html   (needs Playwright)
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + require('path').resolve(process.argv[2] || 'smartpdf.html'));
  await pg.waitForFunction(() => typeof S !== 'undefined' && typeof buildPdf === 'function', null, { timeout: 30000 });
  await pg.waitForTimeout(1200);
  const R = await pg.evaluate(async () => {
    const R = {}, N = PDFLib.PDFName;
    const mk = async (n, label) => { const d = await PDFLib.PDFDocument.create(); const f = await d.embedFont(PDFLib.StandardFonts.Helvetica); for (let i = 0; i < n; i++) d.addPage([300, 300]).drawText(label + ' p' + (i + 1), { x: 20, y: 150, size: 14, font: f }); return d; };
    const file = async (d, name) => new File([await d.save()], name, { type: 'application/pdf' });
    window.Neutralino = { filesystem: { writeBinaryFile: async () => {} }, storage: { setData: async () => {} } };

    // 1. while a save runs: tab switch refused, keys swallowed, dropped file queued and opened afterwards
    await openFiles([await file(await mk(2, 'A'), 'A.pdf')], 'replace', { path: 'C:\\A.pdf' });
    await openFiles([await file(await mk(2, 'B'), 'B.pdf')], 'replace', { path: 'C:\\B.pdf' });
    switchTab(0); S.dirty = true;
    const pr = writeCurrent();
    switchTab(1);
    let keyReached = false; const kh = () => { keyReached = true; }; document.addEventListener('keydown', kh);
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
    document.removeEventListener('keydown', kh);
    requestOpen([await file(await mk(1, 'C'), 'C.pdf')], 'replace');
    const tabsDuring = TABS.list.length, curDuring = TABS.cur;
    await pr; await new Promise(r => setTimeout(r, 1500));
    R.lock = { curDuring, keyReached, tabsDuring, tabsAfter: TABS.list.length, opened: S.fileName, aSaved: TABS.list[0].st ? TABS.list[0].st.dirty === false : null };

    // 2. outline + internal link survive a save; a split keeps only bookmarks of exported pages
    {
      const d = await mk(3, 'O'), ctx = d.context, pr = d.getPages().map(p => p.ref);
      const o1 = ctx.nextRef(), o2 = ctx.nextRef(), root = ctx.nextRef();
      ctx.assign(o1, ctx.obj({ Title: PDFLib.PDFHexString.fromText('第一章'), Parent: root, Next: o2, Dest: [pr[0], 'Fit'] }));
      ctx.assign(o2, ctx.obj({ Title: PDFLib.PDFHexString.fromText('Chapter 3'), Parent: root, Prev: o1, Dest: [pr[2], 'XYZ', 0, 300, null] }));
      ctx.assign(root, ctx.obj({ Type: 'Outlines', First: o1, Last: o2, Count: 2 }));
      d.catalog.set(N.of('Outlines'), root);
      const link = ctx.register(ctx.obj({ Type: 'Annot', Subtype: 'Link', Rect: [10, 10, 100, 40], Border: [0, 0, 0], Dest: [pr[2], 'Fit'] }));
      d.getPage(0).node.addAnnot(link);
      await openFiles([await file(d, 'outline.pdf')], 'replace');
      const all = await PDFLib.PDFDocument.load(await buildPdf(S.pages));
      const pdf = await pdfjsLib.getDocument({ data: await buildPdf(S.pages), isEvalSupported: false }).promise;
      const ol = await pdf.getOutline(), an = await (await pdf.getPage(1)).getAnnotations();
      const li = an.find(a => a.subtype === 'Link');
      R.outline = { titles: (ol || []).map(x => x.title), linkTarget: li && li.dest ? await pdf.getPageIndex(li.dest[0]) : null, pages: all.getPageCount() };
      const one = await pdfjsLib.getDocument({ data: await buildPdf([S.pages[0]]), isEvalSupported: false }).promise;
      const ol1 = await one.getOutline(), an1 = await (await one.getPage(1)).getAnnotations();
      R.outlineSplit = { titles: (ol1 || []).map(x => x.title), links: an1.filter(a => a.subtype === 'Link').length };
    }

    // 3. form: a field the user filled is flattened, the rest stay fillable
    {
      await loadSample();
      const p = S.pages.find(p => fieldCache.size >= 0) && S.pages[1];
      await loadFields(p);
      const f = fieldsOf(p).find(x => x.kind === 'text');
      p.ann.push({ id: uid(), t: 'text', x: f.x + 2, y: f.y + 2, text: 'Ali', size: 10, c: '#000', fk: f.id });
      const sd = await PDFLib.PDFDocument.load(await buildPdf(S.pages));
      R.formFill = { before: 5, after: sd.getForm().getFields().length };
    }

    // 4. PowerShell quoting covers curly quotes
    R.psq = psq("a’b‘c'd");
    return R;
  });
  const ok = [];
  const check = (name, cond) => { ok.push([name, !!cond]); };
  check('tab switch refused while saving', R.lock.curDuring === 0);
  check('keys swallowed while saving', !R.lock.keyReached);
  check('file dropped while saving is queued, then opened', R.lock.tabsDuring === 2 && R.lock.tabsAfter === 3 && R.lock.opened === 'C.pdf');
  check('outline kept on save', JSON.stringify(R.outline.titles) === JSON.stringify(['第一章', 'Chapter 3']));
  check('internal link points at the new page 3', R.outline.linkTarget === 2);
  check('split keeps only bookmarks of exported pages, drops dead link', JSON.stringify(R.outlineSplit.titles) === JSON.stringify(['第一章']) && R.outlineSplit.links === 0);
  check('filled field flattened, other 4 still fillable', R.formFill.after === 4);
  check('psq doubles curly quotes', R.psq === "'a’’b‘‘c''d'");
  check('no page errors', !errs.length);
  for (const [n, v] of ok) console.log((v ? 'PASS ' : 'FAIL ') + n);
  if (ok.some(x => !x[1])) { console.log(JSON.stringify(R, null, 1), errs); process.exitCode = 1; }
  await b.close();
})();
