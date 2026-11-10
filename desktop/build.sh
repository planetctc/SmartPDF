#!/usr/bin/env bash
# 打包 Windows 安装包：desktop/build.sh
# 需要：Node 18+、NSIS、MinGW（Ubuntu: sudo apt-get install nsis gcc-mingw-w64-x86-64）
# 输出：desktop/out/smartPDF-Setup-<版本>.exe
set -euo pipefail
cd "$(dirname "$0")"
VER=$(node -p "require('./neutralino.config.json').version")

node checkjs.mjs
cp ../smartpdf.html resources/index.html

# 文字识别组件（英文＋简体中文：扫描件变成可搜索、找发票号码），放进 resources/ocr/，只在用到时才载入
OCR_TMP=$(mktemp -d)
(cd "$OCR_TMP" && npm pack --silent tesseract.js@5.1.1 tesseract.js-core@5.1.1 @tesseract.js-data/eng@1.0.0 @tesseract.js-data/chi_sim@1.0.0 >/dev/null && for f in *.tgz; do mkdir -p "${f%.tgz}" && tar xzf "$f" -C "${f%.tgz}"; done)
rm -rf resources/ocr && mkdir -p resources/ocr
cp "$OCR_TMP"/tesseract.js-5.1.1/package/dist/{tesseract.min.js,worker.min.js} resources/ocr/
cp "$OCR_TMP"/tesseract.js-core-5.1.1/package/tesseract-core-{simd-lstm,lstm}.wasm.js resources/ocr/
cp "$OCR_TMP"/tesseract.js-data-eng-1.0.0/package/4.0.0_best_int/eng.traineddata.gz resources/ocr/
cp "$OCR_TMP"/tesseract.js-data-chi_sim-1.0.0/package/4.0.0_best_int/chi_sim.traineddata.gz resources/ocr/
rm -rf "$OCR_TMP"
npm i --no-save --silent resedit@2 pe-library@1
npx -y @neutralinojs/neu@11 update
npx -y @neutralinojs/neu@11 build --release

rm -rf out && mkdir out
node seticon.mjs dist/smartPDF/smartPDF-win_x64.exe icon.ico out/smartPDF.exe "$VER"
# 双击 PDF 用的小启动程序（需要：sudo apt-get install gcc-mingw-w64-x86-64）
echo '1 ICON "icon.ico"' > out/launcher.rc
x86_64-w64-mingw32-windres out/launcher.rc -I. -O coff -o out/launcher.res
x86_64-w64-mingw32-gcc -O2 -s -municode -mwindows launcher.c out/launcher.res -o out/smartPDF-open.exe -lshell32
rm out/launcher.rc out/launcher.res
cp dist/smartPDF/resources.neu icon.ico pdf-file.ico side.bmp installer.nsi out/
sed -i "s/^!define VER .*/!define VER \"$VER\"/; s/^VIProductVersion .*/VIProductVersion \"$VER.0\"/" out/installer.nsi
(cd out && makensis -V2 installer.nsi)
ls -la out/smartPDF-Setup-*.exe
