// v3.9.3: PowerShell commands longer than the Windows command-line limit (8191) run from a .ps1 file.
// 3.9.1/3.9.2 one-click update failed with "no response" because its -EncodedCommand line was too long.
// Usage: node tests/pscmd-393.js smartpdf.html   (exits 1 on failure)
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch(), p = await b.newPage(), errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + path.resolve(process.argv[2] || 'smartpdf.html'));
  await p.waitForFunction(() => typeof psRun === 'function' && typeof PS_SCAN === 'function');
  const r = await p.evaluate(async () => {
    // fake Neutralino: remember files and spawned commands, every process exits at once
    const files = {}, spawned = [], removed = [], hs = [];
    window.Neutralino = {
      os: {
        getEnv: async () => 'C:\\Users\\someone\\AppData\\Local\\Temp', getPath: async () => 'C:\\Temp',
        spawnProcess: async cmd => { spawned.push(cmd); const id = spawned.length; setTimeout(() => hs.forEach(h => h({ detail: { id, action: 'exit', data: 0 } })), 5); return { id }; },
      },
      filesystem: { writeBinaryFile: async (f, buf) => { files[f] = new Uint8Array(buf); }, remove: async f => { removed.push(f); } },
      events: { on: (n, h) => hs.push(h), off: (n, h) => { const i = hs.indexOf(h); if (i >= 0) hs.splice(i, 1); } },
    };
    const o = { dev: 'x', feed: 0, intent: 1, dpi: 200, w: 1, h: 1, png: false, out: 'C:\\Temp\\a', res: 'C:\\Temp\\a.json' };
    const longScript = PS_SCAN(o), shortScript = '$a=1';
    await psRun(psCmd(longScript)); await psRun(psCmd(shortScript));
    const [c1, c2] = spawned, f = c1.match(/-File "([^"]+)"/);
    const body = f && files[f[1]] ? new TextDecoder().decode(files[f[1]].slice(3)) : '';
    return {
      longWasLong: psEncode(longScript).length > 8191,
      longUsesFile: !!f && c1.length < 8191, fileHasScript: body === longScript, fileHasBom: !!f && files[f[1]][0] === 0xEF,
      fileRemoved: !!f && removed.includes(f[1]), shortInline: /-EncodedCommand /.test(c2) && c2.length < 8191, mapEmpty: PS_LONG.size === 0,
    };
  });
  await b.close();
  let bad = 0;
  for (const [k, v] of Object.entries(r)) { if (!v) bad++; console.log((v ? 'PASS ' : 'FAIL ') + k); }
  if (errs.length) { bad++; console.log('page errors', errs); } else console.log('PASS no page errors');
  process.exit(bad ? 1 : 0);
})();
