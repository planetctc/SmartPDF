// Copies the app into www/ and patches the generated Android project:
// "Open with smartPDF" for PDFs, version from the desktop config, storage permission for old Android.
import fs from 'node:fs';
const here = new URL('.', import.meta.url).pathname;
const step = process.argv[2] || 'www';

if (step === 'www') {
  fs.mkdirSync(here + 'www', { recursive: true });
  fs.copyFileSync(here + '../smartpdf.html', here + 'www/index.html');
  console.log('www/index.html ready');
}

if (step === 'android') {
  const ver = JSON.parse(fs.readFileSync(here + '../desktop/neutralino.config.json', 'utf8')).version;
  const [a, b, c] = ver.split('.').map(Number), code = a * 10000 + b * 100 + c;
  const gradle = here + 'android/app/build.gradle';
  let g = fs.readFileSync(gradle, 'utf8');
  g = g.replace(/versionCode \d+/, 'versionCode ' + code).replace(/versionName "[^"]*"/, 'versionName "' + ver + '"');
  fs.writeFileSync(gradle, g);

  const mf = here + 'android/app/src/main/AndroidManifest.xml';
  let m = fs.readFileSync(mf, 'utf8');
  if (!m.includes('application/pdf')) {
    const filter = `
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="content" />
                <data android:scheme="file" />
                <data android:mimeType="application/pdf" />
            </intent-filter>
`;
    m = m.replace(/(<intent-filter>\s*<action android:name="android.intent.action.MAIN" \/>[\s\S]*?<\/intent-filter>)/, '$1' + filter);
    if (!m.includes('application/pdf')) throw new Error('could not add the PDF intent filter');
  }
  if (!m.includes('WRITE_EXTERNAL_STORAGE')) {
    m = m.replace('</manifest>', '    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="29" />\n    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />\n</manifest>');
  }
  if (!m.includes('requestLegacyExternalStorage')) m = m.replace('<application', '<application\n        android:requestLegacyExternalStorage="true"');
  fs.writeFileSync(mf, m);
  console.log('android project patched, version', ver, code);
}
