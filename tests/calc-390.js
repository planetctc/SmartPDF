// v3.9 form calculation: fields made in smartPDF save as standard calculated PDF fields,
// and filling a PDF with calculated fields in smartPDF fills in the results. Run: node tests/calc-390.js smartpdf.html
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + require('path').resolve(process.argv[2] || 'smartpdf.html'));
  await pg.waitForFunction(() => typeof buildPdf === 'function'); await pg.waitForTimeout(800);
  const R = await pg.evaluate(async () => {
    const R = {}, N = PDFLib.PDFName;
    const d0 = await PDFLib.PDFDocument.create(); d0.addPage([500, 400]);
    await openFiles([new File([await d0.save()], 'blank.pdf', { type: 'application/pdf' })], 'replace');
    const P = S.pages[0], fld = (name, y, extra) => P.ann.push(Object.assign({ id: uid(), t: 'fld', k: 'text', x: 60, y, w: 140, h: 22, name }, extra || {}));
    fld('数量', 40, { nf: 'int' }); fld('单价', 80, { nf: 'money' });
    fld('小计', 120, { nf: 'money', calc: { op: 'SFN', src: '数量*单价' } });
    fld('运费', 160, { nf: 'money' });
    fld('总额', 200, { nf: 'money', calc: { op: 'SUM', src: '小计, 运费' } });
    const out = await buildPdf(S.pages), od = await PDFLib.PDFDocument.load(out), form = od.getForm();
    const js = name => { const aa = form.getField(name).acroField.dict.lookup(N.of('AA')); const c = aa && aa.lookup(N.of('C')); return c ? c.lookup(N.of('JS')).decodeText() : null; };
    const co = form.acroForm.dict.lookup(N.of('CO'));
    R.saved = { fields: form.getFields().map(f => f.getName()), calcSub: js('小计'), calcTot: js('总额'), ro: form.getTextField('总额').isReadOnly(), co: co ? co.asArray().map(r => form.getFields().find(f => f.ref === r || f.ref.toString() === r.toString()).getName()) : null };
    // reopen the saved file and fill it in smartPDF
    await openFiles([new File([out], 'order.pdf', { type: 'application/pdf' })], 'replace');
    const Q = S.pages[0]; await loadFields(Q);
    const fs = fieldCache.get(Q.doc + ':' + Q.idx), byName = n => fs.find(f => f.name === n);
    R.parsed = { sub: byName('小计').calc, tot: byName('总额').calc, fmt: byName('总额').fmt };
    const put = (n, v) => { const f = fieldsOf(Q, true).find(x => x.id === byName(n).id); const before = snap(); Q.ann.push({ id: uid(), t: 'text', x: f.x + 2, y: f.y + 2, text: v, size: 12, c: '#000', fk: f.id }); commit(before); };
    put('数量', '3'); put('单价', '12.50'); put('运费', '1,000');
    await new Promise(r => setTimeout(r, 400));
    const valOf = n => { const a = Q.ann.find(a => a.fk === byName(n).id); return a ? a.text : null; };
    R.filled = { sub: valOf('小计'), tot: valOf('总额'), clickable: fieldsOf(Q).map(f => fs.find(x => x.id === f.id).name) };
    R.expr = [calcExpr('2*(3+4)-1/2', () => 0), calcExpr('a.b*2', n => (n === 'a.b' ? 5 : 0))];
    return R;
  });
  const res = [], ck = (n, c) => res.push([n, !!c]);
  ck('saved: all 5 fields', R.saved.fields.length === 5);
  ck('saved: formula is a standard calculate script', /BVCALC 数量\*单价 EVCALC/.test(R.saved.calcSub) && /getField\("数量"\)/.test(R.saved.calcSub));
  ck('saved: sum uses AFSimple_Calculate', /AFSimple_Calculate\("SUM", new Array\("小计", "运费"\)\)/.test(R.saved.calcTot));
  ck('saved: calculated field read-only', R.saved.ro);
  ck('saved: calculation order 小计 before 总额', JSON.stringify(R.saved.co) === '["小计","总额"]');
  ck('reopened: scripts understood', R.parsed.sub && R.parsed.sub.op === 'SFN' && R.parsed.tot.op === 'SUM' && R.parsed.fmt && R.parsed.fmt.dec === 2);
  ck('filled: 3 × 12.50 = 37.50', R.filled.sub === '37.50');
  ck('filled: 37.50 + 1,000 = 1,037.50', R.filled.tot === '1,037.50');
  ck('calculated fields cannot be clicked to type', !R.filled.clickable.includes('小计') && !R.filled.clickable.includes('总额'));
  ck('formula parser', R.expr[0] === 13.5 && R.expr[1] === 10);
  ck('no page errors', !errs.length);
  for (const [n, v] of res) console.log((v ? 'PASS ' : 'FAIL ') + n);
  if (res.some(x => !x[1])) { console.log(JSON.stringify(R, null, 1), errs); process.exitCode = 1; }
  await b.close();
})();
