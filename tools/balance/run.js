'use strict';
// Runs a balance script inside the game page in headless Chromium and saves what it returns.
//   node tools/balance/run.js <script.js> <out.json>
// Needs Playwright (npm i -D playwright, or a global install; set PLAYWRIGHT_PATH to its folder if it isn't found).
// The page is public/index.html?fresh, so your saved game is never touched.
const fs = require('fs'), path = require('path');
function loadPlaywright(){
  const tries = [process.env.PLAYWRIGHT_PATH, 'playwright', '/opt/npm-tools/node_modules/playwright'].filter(Boolean);
  for (const t of tries){ try { return require(t); } catch(e){} }
  throw new Error('Playwright not found: npm i -D playwright (then npx playwright install chromium), or set PLAYWRIGHT_PATH');
}
(async () => {
  const [,, scr, out] = process.argv;
  if (!scr || !out){ console.error('usage: node tools/balance/run.js <script.js> <out.json>'); process.exit(1); }
  const { chromium } = loadPlaywright();
  const b = await chromium.launch();
  const p = await b.newPage();
  p.on('pageerror', e => console.error('pageerror', e.message));
  await p.goto('file://' + path.resolve(__dirname, '../../public/index.html') + '?fresh');
  await p.waitForFunction(() => window.__leafYard);
  const t0 = Date.now();
  const res = await p.evaluate(fs.readFileSync(scr, 'utf8'));
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, typeof res === 'string' ? res : JSON.stringify(res));
  console.error('done', path.basename(scr), '->', out, ((Date.now() - t0)/1000).toFixed(0) + 's');
  await b.close();
})();
