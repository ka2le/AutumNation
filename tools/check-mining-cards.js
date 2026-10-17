'use strict';
// Storage starts at a vein/pile, then has its own shared card and links to built workplaces.
const fs = require('fs'), path = require('path'), http = require('http'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'C:/Users/kallek/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '../public');
(async () => {
  const server = http.createServer((req, res) => {
    const file = path.join(root, new URL(req.url, 'http://localhost').pathname.replace(/^\/$/, '/index.html'));
    try { res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html'); res.end(fs.readFileSync(file)); }
    catch { res.statusCode = 404; res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe' });
  const errors = [], output = path.resolve(__dirname, '../runs/mining-cards');
  fs.mkdirSync(output, { recursive: true });
  try {
    for (const lot of ['home', 'hollow']) for (const mobile of [false, true]) {
      const p = await browser.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 }, serviceWorkers: 'block' });
      p.on('pageerror', e => errors.push(e.message));
      await p.route(/^https:\/\//, r => r.abort());
      await p.addInitScript(() => window.requestAnimationFrame = () => 0);
      await p.goto(`http://127.0.0.1:${server.address().port}/?fresh&lot=${lot}`);
      await p.waitForFunction(() => window.__leafYard);
      await p.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
      const dev = s => p.evaluate(s => __leafYard.dev(s), s);
      const click = act => p.locator(`[data-act="${act}"]`).click();
      await dev("S.cash=S.peak=100000;S.land=Math.max(...SPOTS.map(p=>p.land));S.story.done=true;S.flags.coalKnown=true;S.flags.ruinKnown=true;openCard('bin')");
      assert.equal(await p.locator('[data-act="metalSlot"],[data-act="up:metalBin"],[data-resource="metal"]').count(), 0);
      assert.equal(await dev("offers().find(o=>o.id==='metalSlot').obj"), 'spot0');
      await dev("openCard('tub')");
      assert.equal(await dev('cardOpen.kind'), 'bin');
      await dev("openCard('spot',0)");
      assert.equal(await p.locator('[data-act="metalSlot"]').count(), 1);
      assert.equal(await p.locator('[data-act="miner"]').count(), 0);
      await click('metalSlot');
      assert(await dev('S.metalSlot'));
      assert.equal(await dev('S.miners.length'), 0);
      assert.equal(await p.locator('[data-act="miner"]').count(), 1);
      // Click the actual roadside tub/crib, rather than calling its card directly.
      const at = await dev('closeCard();w2s(TUB.x+8,TUB.y-24)');
      await p.mouse.click(at.x, at.y);
      assert.equal(await dev('cardOpen.kind'), 'tub');
      assert.match(await p.locator('.ct').innerText(), lot === 'hollow' ? /Log crib/ : /Metal tub/);
      assert.equal(await p.locator('[data-act^="minecard:"]').count(), 0);
      for (const i of [0, 1]) {
        await dev(`openCard('spot',${i})`);
        await click('miner');
        assert.equal(await p.locator('[data-act="up:metalBin"]').count(), 1);
        assert.equal(await p.locator('[data-act="up:metalPrice"]').count(), 1);
      }
      await dev("openCard('tub')");
      assert.equal(await p.locator('[data-act^="minecard:"]').count(), 2);
      const before = await dev('S.lv.metalBin');
      await click('up:metalBin');
      assert.equal(await dev('S.lv.metalBin'), before + 1);
      for (const i of [0, 1]) {
        await dev("openCard('tub')");
        await click(`minecard:${i}`);
        assert.deepEqual(await dev('({kind:cardOpen.kind,i:cardOpen.i,cap:metalCap()})'), { kind: 'spot', i, cap: 12 });
      }
      await dev("S.plant.built=true;S.bag.built=true;openCard('tub');S.binMetal=metalCap();eyeScan()");
      assert.equal(await dev("EYE.lo.find(o=>o.key==='bu:metalBin').go[0]"), 'tub');
      assert.equal(await dev("cardShows(offers().find(o=>o.key==='metalBin'))"), true);
      assert.equal(await p.locator('#keepM').count(), 1);
      for (const kind of ['tub', 'bin', 'bagger', 'spot']) {
        await dev(`openCard('${kind}',0);draw()`);
        const bounds = await p.locator('#card').evaluate(c => ({ overflow: c.scrollWidth > c.clientWidth + 2, left: c.getBoundingClientRect().left, right: c.getBoundingClientRect().right, width: innerWidth }));
        assert(!bounds.overflow && bounds.left >= -1 && bounds.right <= bounds.width + 1, `${lot}/${mobile}/${kind} overflow`);
        if (kind === 'bin' || kind === 'bagger') {
          assert.equal(await p.locator('[data-act="up:metalBin"],[data-act="up:metalPrice"],#keepM,[data-resource="metal"]').count(), 0);
          assert.equal(await dev("cardShows(offers().find(o=>o.key==='metalBin'))"), false);
        }
        await p.screenshot({ path: path.join(output, `${lot}-${mobile ? 'mobile' : 'desktop'}-${kind}.png`) });
      }
      await dev("closeCard();load({S:JSON.parse(JSON.stringify(S))});openCard('tub')");
      assert.equal(await p.locator('[data-act^="minecard:"]').count(), 2);
      await p.close();
    }
    assert.deepEqual(errors, []);
    console.log('Mining/logging purchase flow, tub hit target, shared upgrades, mine links, overview routing and save reload checks passed in both yards at desktop/mobile sizes.');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(e => { console.error(e); process.exitCode = 1; });
