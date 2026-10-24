#!/usr/bin/env bash
# 打包 Windows 安装包：desktop/build.sh
# 需要：Node 18+、NSIS（Ubuntu: sudo apt-get install nsis）
# 输出：desktop/out/smartPDF-Setup-<版本>.exe
set -euo pipefail
cd "$(dirname "$0")"
VER=$(node -p "require('./neutralino.config.json').version")

cp ../smartpdf.html resources/index.html

# 文字识别组件（扫描件找发票号码用），放进 resources/ocr/，只在用到时才载入
OCR_TMP=$(mktemp -d)
(cd "$OCR_TMP" && npm pack --silent tesseract.js@5.1.1 tesseract.js-core@5.1.1 @tesseract.js-data/eng@1.0.0 >/dev/null && for f in *.tgz; do mkdir -p "${f%.tgz}" && tar xzf "$f" -C "${f%.tgz}"; done)
rm -rf resources/ocr && mkdir -p resources/ocr
cp "$OCR_TMP"/tesseract.js-5.1.1/package/dist/{tesseract.min.js,worker.min.js} resources/ocr/
cp "$OCR_TMP"/tesseract.js-core-5.1.1/package/tesseract-core-{simd-lstm,lstm}.wasm.js resources/ocr/
cp "$OCR_TMP"/tesseract.js-data-eng-1.0.0/package/4.0.0_best_int/eng.traineddata.gz resources/ocr/
rm -rf "$OCR_TMP"
npm i --no-save --silent resedit@2 pe-library@1
npx -y @neutralinojs/neu@11 update
npx -y @neutralinojs/neu@11 build --release

rm -rf out && mkdir out
node seticon.mjs dist/smartPDF/smartPDF-win_x64.exe icon.ico out/smartPDF.exe "$VER"
cp dist/smartPDF/resources.neu icon.ico pdf-file.ico side.bmp installer.nsi out/
sed -i "s/^!define VER .*/!define VER \"$VER\"/; s/^VIProductVersion .*/VIProductVersion \"$VER.0\"/" out/installer.nsi
(cd out && makensis -V2 installer.nsi)
ls -la out/smartPDF-Setup-*.exe
