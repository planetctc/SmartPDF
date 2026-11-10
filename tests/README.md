# smartPDF tests

Browser checks run against `smartpdf.html` with Playwright (Node 18+ and `playwright` installed).

| Script | What it checks |
| --- | --- |
| `regress-381.js` | v3.8.1 audit fixes: tab lock while saving, queued drops, bookmarks and links kept, form fields kept, PowerShell quoting. Exits 1 on failure. |
| `repro-save-form-redact.js` | Audit repro (save to wrong tab, form fields, split-number redaction, export cost). Prints JSON. |
| `repro-compress-smask.js` | Audit repro: compressing an image with a soft mask must keep the mask DeviceGray. Prints JSON. |
| `perf-split.js` | Time for one-page exports from a 400-page file. |
| `smoke.js` | Page loads; sample, redaction, compress paths run without page errors. |

```
node desktop/checkjs.mjs
node tests/regress-381.js smartpdf.html
```
