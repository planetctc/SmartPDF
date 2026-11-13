# smartPDF tests

Browser checks run against `smartpdf.html` with Playwright (Node 18+ and `playwright` installed).

| Script | What it checks |
| --- | --- |
| `redact-390.js` | v3.9 precise redaction: only covered text / image pixels / form fields removed, rest stays text, secrets not anywhere in the file. Exits 1 on failure. |
| `calc-390.js` | v3.9 form calculation: fields save as standard calculated PDF fields; filling a calculated PDF fills in the results. Exits 1 on failure. |
| `scan-391.js` | v3.9.1 scan fix: PowerShell scan scripts include the Transfer/ShowTransfer/System.Drawing fallbacks, quoting, and errors name the step, code and log file. Exits 1 on failure. |
| `regress-381.js` | v3.8.1 audit fixes: tab lock while saving, queued drops, bookmarks and links kept, form fields kept, PowerShell quoting. Exits 1 on failure. |
| `repro-save-form-redact.js` | Audit repro (save to wrong tab, form fields, split-number redaction, export cost). Prints JSON. |
| `repro-compress-smask.js` | Audit repro: compressing an image with a soft mask must keep the mask DeviceGray. Prints JSON. |
| `perf-split.js` | Time for one-page exports from a 400-page file. |
| `smoke.js` | Page loads; sample, redaction, compress paths run without page errors. |

```
node desktop/checkjs.mjs
node tests/regress-381.js smartpdf.html
node tests/redact-390.js smartpdf.html
node tests/calc-390.js smartpdf.html
node tests/scan-391.js smartpdf.html
```
