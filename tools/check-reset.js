'use strict';
// Exercise the real Start over buttons in an isolated browser, including save/reload.
const fs = require('fs'), path = require('path'), http = require('http'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'C:/Users/kallek/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '../public');

(async () => {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const file = path.join(root, url.pathname === '/' ? 'index.html' : url.pathname);
    try {
      res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
      res.end(fs.readFileSync(file));
    } catch { res.statusCode = 404; res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe' });
    const page = await browser.newPage({ serviceWorkers: 'block' }), errors = [];
    page.on('pageerror', e => { errors.push(e.message); console.error('Browser error:', e.message); });
    await page.route(/^https:\/\//, route => route.abort());
    await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
    const url = `http://127.0.0.1:${server.address().port}/`;
    const ready = () => page.waitForFunction(() => window.__leafYard && window.__leafYard.dev('LH_READY'));
    await page.goto(url);
    await ready();
    const snapshot = () => page.evaluate(() => {
      const Y = __leafYard, S = Y.state();
      return { levels: S.robots.map(c => c.lv), blowers: S.blowers.length, shakers: S.shakers.length,
        tech: S.tech, gen: S.gen, cash: S.cash, land: S.land,
        roster: Y.dev('Object.keys(idsOf("robot"))'), runT: Y.world().runT || 0 };
    });
    const initial = await snapshot();
    const reset = async () => {
      await page.evaluate(() => __leafYard.open('shed'));
      await page.locator('[data-act="reset1"]').click();
      await page.locator('[data-act="reset2"]').click();
    };
    const upgrade = () => page.evaluate(() => __leafYard.dev(`
      S.cash = S.peak = 10000; S.land = 2;
      S.robots.push(newRobotCfg());
      for (const c of S.robots) for (const k in c.lv) c.lv[k] = trackMax(k);
      S.blowers.push(newHelperCfg('blower')); S.shakers.push(newHelperCfg('shaker'));
      for (const k in TECH) S.tech[k] = true;
      S.gen.oil = 1; WORLD.runT = 900; bindIds(); syncRobots(); save();
      for (const id of Object.keys(window.LOTS || {})) localStorage.setItem(lotKey(id), JSON.stringify(S));
    `));
    await upgrade();
    assert((await snapshot()).levels[0].speed > 0, 'fixture has trained Tinker');
    for (let i = 0; i < 3; i++) {
      await reset();
      assert.deepEqual(await snapshot(), initial, `reset ${i + 1} restores a fresh yard`);
      assert(await page.evaluate(() => __leafYard.dev('Object.keys(window.LOTS || {}).every(id => localStorage.getItem(lotKey(id)) === null)')), 'other yards are wiped');
      await page.evaluate(() => __leafYard.dev('save()'));
      await page.reload();
      await ready();
      assert.deepEqual(await snapshot(), initial, 'reset survives save/reload');
      if (i === 1) await upgrade();
    }
    // Resetting while visiting another yard reloads into an untrained first yard too.
    await page.evaluate(() => {
      const Y = __leafYard;
      Y.dev('WORLD.cur = "hollow"; saveWorld()');
    });
    await page.reload();
    await ready();
    assert.equal(await page.evaluate(() => __leafYard.dev('LOT_ID')), 'hollow');
    await reset();
    await page.waitForLoadState('load');
    await ready();
    await page.waitForFunction(() => __leafYard.dev('LOT_ID') === 'home');
    assert.deepEqual(await snapshot(), initial, 'reset from another yard restores home');
    // Non-saving development games use the same in-memory reset path.
    await page.goto(url + '?fresh');
    await ready();
    await upgrade();
    await reset();
    assert.deepEqual(await snapshot(), initial, 'fresh-mode reset clears trained identities');
    assert.deepEqual(errors, []);
    console.log('Reset checks passed: repeated resets, retraining, saved reloads, other-yard reset, and fresh mode; zero browser errors.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
