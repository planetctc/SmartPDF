#!/usr/bin/env bash
# 打包 Windows 安装包：desktop/build.sh
# 需要：Node 18+、NSIS（Ubuntu: sudo apt-get install nsis）
# 输出：desktop/out/smartPDF-Setup-<版本>.exe
set -euo pipefail
cd "$(dirname "$0")"
VER=$(node -p "require('./neutralino.config.json').version")

cp ../smartpdf.html resources/index.html
npm i --no-save --silent resedit@2 pe-library@1
npx -y @neutralinojs/neu@11 update
npx -y @neutralinojs/neu@11 build --release

rm -rf out && mkdir out
node seticon.mjs dist/smartPDF/smartPDF-win_x64.exe icon.ico out/smartPDF.exe "$VER"
cp dist/smartPDF/resources.neu icon.ico side.bmp installer.nsi out/
sed -i "s/^!define VER .*/!define VER \"$VER\"/; s/^VIProductVersion .*/VIProductVersion \"$VER.0\"/" out/installer.nsi
(cd out && makensis -V2 installer.nsi)
ls -la out/smartPDF-Setup-*.exe
