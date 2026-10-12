const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const fs = require('fs');
(async () => {
  const [,, file, dur, outdir] = process.argv; const FPS = 30, N = Math.round(+dur * FPS);
  fs.rmSync(__dirname + '/' + outdir, { recursive: true, force: true }); fs.mkdirSync(__dirname + '/' + outdir);
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await br.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.goto('file://' + __dirname + '/' + file); await p.evaluate(() => document.fonts.ready);
  for (let i = 0; i < N; i++) { await p.evaluate((t) => frame(t), i / FPS); await p.screenshot({ path: `${__dirname}/${outdir}/f${String(i).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 90 }); }
  await br.close(); console.log('frames', N);
})();
