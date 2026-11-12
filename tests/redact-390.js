// v3.9 precise redaction: only the covered text / image area is removed, the rest stays text.
// Run: node tests/redact-390.js smartpdf.html   (exit code 1 on failure)
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  // 1) a "real" PDF made by Chromium (embedded subset fonts, Type0 / Identity-H, Chinese + English)
  const mk = await b.newPage();
  await mk.setContent(`<html><body style="font:16px sans-serif;padding:40px">
    <p>Customer: Tan Ah Kow</p><p>IC: 880101-14-5678 (keep this line's label)</p>
    <p>客户机密资料：身份证 900202-10-1234 请保密</p><p>Total RM 1,234.50 — signed</p>
    <img src="data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80"><rect width="200" height="80" fill="red"/><text x="10" y="50" font-size="30">PHOTO</text></svg>')}" style="display:block;margin-top:20px">
    </body></html>`);
  const chromePdf = await mk.pdf({ format: 'A4' });
  await mk.close();
  const pg = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + path.resolve(process.argv[2] || 'smartpdf.html'));
  await pg.waitForFunction(() => typeof buildPdf === 'function'); await pg.waitForTimeout(800);
  const R = await pg.evaluate(async (bytes) => {
    const R = {};
    const textOf = async (u8) => { const pdf = await pdfjsLib.getDocument({ data: u8.slice(), isEvalSupported: false }).promise; const t = await (await pdf.getPage(1)).getTextContent(); const s = t.items.map(i => i.str).join(' '); pdf.destroy(); return s; };
    const imgCount = async (u8) => { const d = await PDFLib.PDFDocument.load(u8); return d.context.enumerateIndirectObjects().filter(([, o]) => o.dict && String(o.dict.get(PDFLib.PDFName.of('Subtype'))) === '/Image').length; };
    // raw search: every decoded stream, for the secret digits as ASCII or as hex text
    const rawHas = async (u8, s) => {
      const d = await PDFLib.PDFDocument.load(u8); let all = '';
      for (const [, o] of d.context.enumerateIndirectObjects()) {
        if (o instanceof PDFLib.PDFRawStream) { try { all += String.fromCharCode(...PDFLib.decodePDFRawStream(o).decode().slice(0, 2e6)); } catch (e) { /* skip */ } }
        else all += o.toString();
      }
      return all.includes(s) || all.toLowerCase().includes(Array.from(s, c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(''));
    };
    try {
    // --- A: pdf-lib Helvetica (no /Widths) ---
    {
      const d = await PDFLib.PDFDocument.create(), f = await d.embedFont('Helvetica'), p = d.addPage([420, 200]);
      p.drawText('Name: Ali bin Abu IC: 880101-14-5678 tel 012', { x: 20, y: 150, size: 12, font: f });
      p.drawText('Second line stays readable', { x: 20, y: 120, size: 12, font: f });
      await openFiles([new File([await d.save()], 'a.pdf', { type: 'application/pdf' })], 'replace');
      openRdk(); $('#rkWords').value = ''; $('#rk_ic').checked = true; await rdkFind(); rdkApply();
      const out = await buildPdf(S.pages);
      R.A = { text: await textOf(out), images: await imgCount(out), raw: await rawHas(out, '880101') };
    }    } catch (e) { R.errA = String(e && (e.stack || e.message || e)); }
    try {
    // --- B: Chromium PDF (Type0 fonts), redact IC + Chinese ID + drag a box over the picture ---
    {
      await openFiles([new File([new Uint8Array(bytes)], 'c.pdf', { type: 'application/pdf' })], 'replace');
      openRdk(); $('#rkWords').value = '机密'; $('#rk_ic').checked = true; await rdkFind(); R.B_found = RDK.hits.map(h => h.s); rdkApply();
      const before = await textOf(S.docs[0].bytes);
      const out = await buildPdf(S.pages);
      R.B = { before, text: await textOf(out), raw1: await rawHas(out, '880101'), raw2: await rawHas(out, '900202') };
    }    } catch (e) { R.errB = String(e && (e.stack || e.message || e)); }
    try {
    // --- C: an image partly under a box: only that part changes; text elsewhere stays text ---
    {
      const c = document.createElement('canvas'); c.width = 300; c.height = 100; const x = c.getContext('2d'); x.fillStyle = '#3a7'; x.fillRect(0, 0, 300, 100);
      const png = new Uint8Array(await (await new Promise(r => c.toBlob(r, 'image/png'))).arrayBuffer());
      const d = await PDFLib.PDFDocument.create(), f = await d.embedFont('Helvetica'), p = d.addPage([400, 300]), im = await d.embedPng(png);
      p.drawImage(im, { x: 50, y: 150, width: 300, height: 100 }); p.drawText('Caption text', { x: 50, y: 120, size: 12, font: f });
      await openFiles([new File([await d.save()], 'img.pdf', { type: 'application/pdf' })], 'replace');
      const P = S.pages[0];
      P.ann.push({ id: uid(), t: 'rect', x: 60, y: 60, w: 100, h: 40, c: null, sw: 0, f: '#000000', rd: true });   // display coords: top-left of the picture
      const out = await buildPdf(S.pages);
      const od = await PDFLib.PDFDocument.load(out);
      const imgs = od.context.enumerateIndirectObjects().filter(([, o]) => o.dict && String(o.dict.get(PDFLib.PDFName.of('Subtype'))) === '/Image');
      const big = imgs.find(([, o]) => +String(o.dict.get(PDFLib.PDFName.of('Width'))) === 300);
      let black = null, green = null;
      if (big) { const raw = PDFLib.decodePDFRawStream(big[1]).decode(); const at = (px, py) => raw[(py * 300 + px) * 3 + 1]; black = at(40, 20); green = at(250, 80); }
      R.C = { text: await textOf(out), images: imgs.length, keptSize: !!big, pixelUnderBox: black, pixelOutside: green };
    }    } catch (e) { R.errC = String(e && (e.stack || e.message || e)); }
    try {
    // --- D: a form field under the box disappears with its value ---
    {
      const d = await PDFLib.PDFDocument.create(), p = d.addPage([400, 300]), form = d.getForm();
      const t1 = form.createTextField('secret'); t1.setText('S9876543'); t1.addToPage(p, { x: 50, y: 200, width: 150, height: 20 });
      const t2 = form.createTextField('public'); t2.setText('hello'); t2.addToPage(p, { x: 50, y: 100, width: 150, height: 20 });
      await openFiles([new File([await d.save()], 'f.pdf', { type: 'application/pdf' })], 'replace');
      S.pages[0].ann.push({ id: uid(), t: 'rect', x: 40, y: 75, w: 180, h: 35, c: null, sw: 0, f: '#000000', rd: true });
      const out = await buildPdf(S.pages), od = await PDFLib.PDFDocument.load(out);
      R.D = { fields: od.getForm().getFields().map(f => f.getName()), raw: await rawHas(out, 'S9876543') };
    }    } catch (e) { R.errD = String(e && (e.stack || e.message || e)); }
    return R;
  }, Array.from(chromePdf));
  const res = [];
  const ck = (n, c) => res.push([n, !!c]);
  ck('A: IC removed from text', !/880101/.test(R.A.text));
  ck('A: rest of the line is still text', /Name: Ali bin Abu/.test(R.A.text) && /tel 012/.test(R.A.text) && /Second line/.test(R.A.text));
  ck('A: page not turned into an image', R.A.images === 0);
  ck('A: secret not anywhere in the file', !R.A.raw);
  ck('B: found IC + Chinese ID + keyword', R.B_found.length >= 3);
  ck('B: IC and Chinese ID gone', !/880101/.test(R.B.text.replace(/\s/g, '')) && !/900202/.test(R.B.text.replace(/\s/g, '')) && !/机密/.test(R.B.text.replace(/\s/g, '')));
  ck('B: other text kept', /Tan Ah Kow/.test(R.B.text) && /1,234\.50/.test(R.B.text) && /请保密/.test(R.B.text.replace(/\s/g, '')));
  ck('B: secrets not in the file', !R.B.raw1 && !R.B.raw2);
  ck('C: image kept at full size, only the boxed part black', R.C.keptSize && R.C.pixelUnderBox === 0 && R.C.pixelOutside > 100);
  ck('C: caption still text', /Caption text/.test(R.C.text));
  if (R.errA || R.errB || R.errC || R.errD) console.log(R.errA, R.errB, R.errC, R.errD);
  R.A = R.A || {}; R.B = R.B || {text:''}; R.C = R.C || {}; R.D = R.D || {}; R.B_found = R.B_found || [];
  ck('D: field under the box removed, other kept', JSON.stringify(R.D.fields) === '["public"]' && !R.D.raw);
  ck('no page errors', !errs.length);
  for (const [n, v] of res) console.log((v ? 'PASS ' : 'FAIL ') + n);
  if (res.some(x => !x[1])) { console.log(JSON.stringify(R, null, 1), errs); process.exitCode = 1; }
  await b.close();
})();
