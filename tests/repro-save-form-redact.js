// Audit repro (v3.8.0): save-to-wrong-tab, form fields lost on save, split-number redaction,
// soft-mask compression, per-export re-parse cost.  Run: node tests/repro-save-form-redact.js smartpdf.html
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1400, height: 900 } });
  pg.on('pageerror', e => console.log('PAGEERR', e.message));
  await pg.goto("file://" + require("path").resolve(process.argv[2] || "smartpdf.html"));
  await pg.waitForFunction(() => typeof S !== 'undefined' && typeof buildPdf === 'function', null, { timeout: 30000 });
  await pg.waitForTimeout(1500);
  const out = await pg.evaluate(async () => {
    const R = {};
    const mk = async (n, label) => { const d = await PDFLib.PDFDocument.create(); const f = await d.embedFont(PDFLib.StandardFonts.Helvetica); for (let i = 0; i < n; i++) d.addPage([300, 300]).drawText(label + ' p' + (i + 1), { x: 20, y: 150, size: 14, font: f }); return d.save(); };
    // ---- T1: switch tab while saving ----
    const writes = [];
    window.Neutralino = { filesystem: { writeBinaryFile: async (p, buf) => { writes.push({ p, n: (await PDFLib.PDFDocument.load(new Uint8Array(buf))).getPageCount() }); } }, storage: { setData: async () => {} } };
    await openFiles([new File([await mk(1, 'A')], 'A.pdf', { type: 'application/pdf' })], 'replace', { path: 'C:\\A.pdf' });
    await openFiles([new File([await mk(3, 'B')], 'B.pdf', { type: 'application/pdf' })], 'replace', { path: 'C:\\B.pdf' });
    R.tabs = TABS.list.length;
    switchTab(0); S.dirty = true;                          // tab A (1 page) has unsaved edits
    const pr = writeCurrent();                              // Ctrl+S on tab A
    switchTab(1);                                           // Ctrl+Tab / a PDF handed in from Explorer
    await pr;
    R.T1_writes = writes; R.T1_tabB_dirty_after = S.dirty; R.T1_tabA_dirty_after = TABS.list[0].st.dirty;
    // ---- T7: form fields survive a plain save? ----
    await loadSample();
    const sampleFields = (await PDFLib.PDFDocument.load(S.docs[0].bytes)).getForm().getFields().length;
    const saved = await buildPdf(S.pages);
    const sd = await PDFLib.PDFDocument.load(saved);
    let annots = 0; sd.getPages().forEach(p => { const a = p.node.Annots(); annots += a ? a.size() : 0; });
    R.T7 = { fieldsBefore: sampleFields, fieldsAfter: sd.getForm().getFields().length, widgetAnnotsAfter: annots, hasAcroForm: !!sd.catalog.get(PDFLib.PDFName.of('AcroForm')) };
    // ---- T4: keyword redaction misses a number split into two text pieces ----
    {
      const d = await PDFLib.PDFDocument.create(); const f = await d.embedFont(PDFLib.StandardFonts.Helvetica); const p = d.addPage([400, 200]);
      p.drawText('IC: 880101-14-5678', { x: 20, y: 150, size: 12, font: f });
      p.drawText('IC: 900202-', { x: 20, y: 100, size: 12, font: f }); p.drawText('10-1234', { x: 20 + f.widthOfTextAtSize('IC: 900202-', 12), y: 100, size: 12, font: f });
      await openFiles([new File([await d.save()], 'ic.pdf', { type: 'application/pdf' })], 'replace');
      openRdk(); $('#rkWords').value = ''; $('#rk_ic').checked = true; await rdkFind();
      R.T4 = { hits: RDK.hits.map(h => h.s), info: $('#rkInfo').textContent, items: (await getItems(S.pages[0])).map(i => i.str) };
      closeModals();
    }
    // ---- T3: compression turns a soft mask (alpha) into an RGB JPEG ----
    {
      const c = document.createElement('canvas'); c.width = 600; c.height = 600; const x = c.getContext('2d');
      for (let i = 0; i < 600; i += 20) { x.fillStyle = `rgba(${i % 255},${(i * 3) % 255},200,${(i % 100) / 100})`; x.fillRect(i, 0, 20, 600); }
      const png = new Uint8Array(await (await new Promise(r => c.toBlob(r, 'image/png'))).arrayBuffer());
      const d = await PDFLib.PDFDocument.create(); const im = await d.embedPng(png); d.addPage([600, 600]).drawImage(im, { x: 0, y: 0, width: 600, height: 600 });
      const src = await d.save();
      const out = await compressPdf(src, 'strong');
      const od = await PDFLib.PDFDocument.load(out), N = PDFLib.PDFName;
      const imgs = od.context.enumerateIndirectObjects().filter(([, o]) => o.dict && String(o.dict.get(N.of('Subtype'))) === '/Image');
      R.T3 = { changed: out !== src, images: imgs.map(([r, o]) => ({ ref: r.toString(), cs: String(o.dict.get(N.of('ColorSpace'))), filter: String(o.dict.get(N.of('Filter'))), smask: o.dict.get(N.of('SMask')) ? o.dict.get(N.of('SMask')).toString() : null })) };
    }
    // ---- P: every single-page export re-parses the whole source ----
    {
      await openFiles([new File([await mk(400, 'Big')], 'big.pdf', { type: 'application/pdf' })], 'replace');
      let t = performance.now(); for (let i = 0; i < 10; i++) await buildPdf([S.pages[i]]); const per = (performance.now() - t) / 10;
      R.P = { pages: S.pages.length, msPerOnePageExport: Math.round(per), estSplitEach400_s: Math.round(per * 400 / 1000) };
    }
    return R;
  });
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})();
