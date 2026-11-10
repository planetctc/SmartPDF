// Audit repro (v3.8.0): compressing an RGB image with a DeviceGray soft mask.
// Run: node tests/repro-compress-smask.js smartpdf.html
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage();
  await pg.goto("file://" + require("path").resolve(process.argv[2] || "smartpdf.html"));
  await pg.waitForFunction(() => typeof compressPdf === 'function'); await pg.waitForTimeout(800);
  console.log(JSON.stringify(await pg.evaluate(async () => {
    const W = 1500, N = PDFLib.PDFName, d = await PDFLib.PDFDocument.create(), ctx = d.context;
    const rgb = new Uint8Array(W * W * 3), a = new Uint8Array(W * W);
    for (let i = 0; i < W * W; i++) { rgb[i * 3] = (i * 7) & 255; rgb[i * 3 + 1] = (Math.random() * 255) | 0; rgb[i * 3 + 2] = 90; a[i] = 30 + ((Math.random() * 220) | 0); }
    const sm = ctx.register(ctx.flateStream(a, { Type: 'XObject', Subtype: 'Image', Width: W, Height: W, ColorSpace: 'DeviceGray', BitsPerComponent: 8 }));
    const im = ctx.register(ctx.flateStream(rgb, { Type: 'XObject', Subtype: 'Image', Width: W, Height: W, ColorSpace: 'DeviceRGB', BitsPerComponent: 8, SMask: sm }));
    const p = d.addPage([600, 600]); p.node.setXObject(N.of('Im0'), im);
    p.pushOperators(PDFLib.pushGraphicsState(), PDFLib.concatTransformationMatrix(600, 0, 0, 600, 0, 0), PDFLib.drawObject('Im0'), PDFLib.popGraphicsState());
    const src = await d.save(), out = await compressPdf(src, 'strong');
    const od = await PDFLib.PDFDocument.load(out);
    return { srcKB: src.length >> 10, outKB: out.length >> 10, images: od.context.enumerateIndirectObjects().filter(([, o]) => o.dict && String(o.dict.get(N.of('Subtype'))) === '/Image').map(([r, o]) => ({ ref: r.toString(), cs: String(o.dict.get(N.of('ColorSpace'))), filter: String(o.dict.get(N.of('Filter'))), smask: o.dict.get(N.of('SMask')) ? o.dict.get(N.of('SMask')).toString() : null })) };
  }), null, 1));
  await b.close();
})();
