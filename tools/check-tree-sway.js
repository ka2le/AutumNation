'use strict';
// Force gust starts/reversals in the real update and measure the rendered tree rotation.
const fs = require('fs'), path = require('path'), http = require('http'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'C:/Users/kallek/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async () => {
  const root = path.resolve(__dirname, '../public');
  const server = http.createServer((req, res) => {
    try {
      const f = path.join(root, new URL(req.url, 'http://localhost').pathname.replace(/^\/$/, '/index.html'));
      res.setHeader('Content-Type', f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html');
      res.end(fs.readFileSync(f));
    } catch { res.statusCode = 404; res.end(); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe' });
    const p = await browser.newPage({ serviceWorkers: 'block' });
    const errors = [];
    p.on('pageerror', e => errors.push(e.message));
    await p.route(/^https:\/\//, r => r.abort());
    await p.addInitScript(() => { window.requestAnimationFrame = () => 0; });
    await p.goto(`http://127.0.0.1:${server.address().port}/?fresh`);
    await p.waitForFunction(() => window.__leafYard);
    const results = await p.evaluate(() => __leafYard.dev(`(() => {
      const results = [];
      const originalRotate = ctx.rotate;
      let angle;
      ctx.rotate = function(a){ angle = a; return originalRotate.call(this, a); };
      const readAngle = () => { drawTreeAt(0, () => false); return angle; };
      try {
        treeShake.fill(0);
        for (const fps of [30, 60, 120]) {
          S.t = 0; gust = 0; gustT = 0.01; treeWind = 0;
          let prev = readAngle(), maxJump = 0;
          // Repeatedly cross real gust boundaries, including forced wind reversals.
          for (let frame = 0; frame < fps*40; frame++) {
            if (frame % (fps*4) === 0) { gust = frame % (fps*8) === 0 ? 40 : -40; gustT = 0; }
            S.t += 1/fps;
            updLeaves(1/fps);
            const next = readAngle();
            if (!Number.isFinite(next)) throw Error('nonfinite tree rotation');
            maxJump = Math.max(maxJump, Math.abs(next - prev)); prev = next;
          }
          // Less than half a world pixel at a canopy tip 250 units from its pivot.
          if (maxJump*250 >= 0.5) throw Error('gust snaps the tree at ' + fps + ' fps: ' + maxJump);
          results.push({ fps, maxTipStep: maxJump*250 });
        }
      } finally { ctx.rotate = originalRotate; }
      return results;
    })()`));
    assert.deepEqual(errors, []);
    await p.emulateMedia({ reducedMotion: 'reduce' });
    await p.reload();
    await p.waitForFunction(() => window.__leafYard);
    assert.equal(await p.evaluate(() => __leafYard.dev(`(() => {
      let angle; const rotate = ctx.rotate;
      ctx.rotate = function(a){ angle = a; return rotate.call(this, a); };
      try { treeWind = 40; drawTreeAt(0, () => false); return angle; }
      finally { ctx.rotate = rotate; }
    })()`)), 0);
    console.log(JSON.stringify(results, null, 2));
    console.log('Tree sway: gust boundaries, reversals, 30/60/120 fps and reduced motion passed.');
  } finally {
    if (browser) await browser.close();
    await new Promise(r => server.close(r));
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
