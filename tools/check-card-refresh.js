'use strict';
// Real press/release events across card refreshes, plus a deterministic UI clock.
const fs = require('fs'), path = require('path'), http = require('http'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'C:/Users/kallek/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '../public');
(async () => {
  const server = http.createServer((req, res) => {
    const file = path.join(root, new URL(req.url, 'http://localhost').pathname.replace(/^\/$/, '/index.html'));
    try {
      res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
      res.end(fs.readFileSync(file));
    } catch { res.statusCode = 404; res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe' });
  const errors = [];
  try {
    for (const lot of ['home', 'hollow']) for (const mobile of [false, true]) {
      const p = await browser.newPage({ viewport: mobile ? { width:390, height:844 } : { width:1280, height:800 }, hasTouch:mobile, serviceWorkers:'block' });
      p.on('pageerror', e => errors.push(e.message));
      await p.route(/^https:\/\//, r => r.abort());
      await p.addInitScript(() => {
        window.requestAnimationFrame = () => 0;
        window.__uiNow = 10000;
        performance.now = () => window.__uiNow;
      });
      await p.goto(`http://127.0.0.1:${server.address().port}/?fresh&lot=${lot}`);
      await p.waitForFunction(() => window.__leafYard);
      await p.addStyleTag({ content:'*,*::before,*::after{animation:none!important;transition:none!important}' });
      const dev = s => p.evaluate(s => __leafYard.dev(s), s);
      await dev("S.cash=S.peak=100000;S.land=1;S.metalSlot=true;S.miners=[0];S.hive.built=true;S.hive.bees=4;S.plant.built=true;S.bag.built=true;S.story.done=true;S.flags.antHill=true;bindIds();syncRobots();syncBees();resetProduction();S.t+=30;productionAdd('picked',60);S.totals.metal+=30;S.totals.jars+=15;S.totals.ingots+=6;sampleProduction()");
      // Every production display shares a snapshot, even when cards reopen or force redraw.
      for (const kind of ['sign','bin','tub','hive','plant','spot']) {
        await dev(`openCard('${kind}',0)`);
        const selector = kind === 'sign' ? '.production' : '.resource-summary';
        const before = await p.locator(selector).innerHTML();
        await dev("S.t+=30;productionAdd('picked',120);S.totals.metal+=60;S.totals.jars+=30;S.totals.ingots+=12;sampleProduction();renderCard(true)");
        assert.equal(await p.locator(selector).innerHTML(), before, `${lot}/${kind}: changed within one second`);
      }
      await dev("openCard('bin')");
      const before = await p.locator('.resource-summary').innerText();
      await dev('window.__uiNow+=999;renderCard(true)');
      assert.equal(await p.locator('.resource-summary').innerText(), before);
      await dev('window.__uiNow+=1;renderCard(false)');
      assert.notEqual(await p.locator('.resource-summary').innerText(), before);
      // Include the first opening, repeated openings and a production tick during the press.
      for (const kind of ['sign','hive','spot','bin','tub','plant','robot']) for (let repeat=0; repeat<2; repeat++) {
        await dev(`openCard('${kind}',0);window.__pressedClose=card.querySelector('[data-act="close"]')`);
        const button = p.locator('#card [data-act="close"]'), box = await button.boundingBox();
        await p.mouse.move(box.x+box.width/2, box.y+box.height/2);
        await p.mouse.down();
        await dev("window.__uiNow+=1000;S.t+=1;productionAdd('picked',100);cardSig='refresh required';renderCard(false);markSeen()");
        assert(await p.evaluate(() => window.__pressedClose.isConnected), `${lot}/${kind}: close button replaced during press`);
        await p.mouse.up();
        assert(await p.locator('#card').isHidden(), `${lot}/${kind}: one click did not close`);
      }
      if (mobile) {
        const touch = await p.context().newCDPSession(p);
        for (const kind of ['sign','hive','spot']) {
          await dev(`openCard('${kind}',0);window.__pressedClose=card.querySelector('[data-act="close"]')`);
          const box = await p.locator('#card [data-act="close"]').boundingBox();
          await touch.send('Input.dispatchTouchEvent', { type:'touchStart', touchPoints:[{ x:box.x+box.width/2, y:box.y+box.height/2 }] });
          await dev("window.__uiNow+=1000;S.t+=1;productionAdd('picked',100);cardSig='touch refresh';renderCard(false)");
          assert(await p.evaluate(() => window.__pressedClose.isConnected));
          await touch.send('Input.dispatchTouchEvent', { type:'touchEnd', touchPoints:[] });
          assert(await p.locator('#card').isHidden(), `${lot}/${kind}: one tap did not close`);
        }
        await touch.detach();
      }
      // Cancelled presses must allow future automatic refreshes; keyboard close still works.
      await dev("openCard('bin');card.dispatchEvent(new PointerEvent('pointerdown',{pointerId:77,button:0,bubbles:true}));window.dispatchEvent(new PointerEvent('pointercancel',{pointerId:77}));cardSig='';renderCard(false)");
      assert.equal(await dev('cardPointer'), null);
      await p.locator('#card [data-act="close"]').focus();
      await p.keyboard.press('Enter');
      assert(await p.locator('#card').isHidden());
      await dev("openCard('bin');resetProduction();renderCard(true)");
      assert.match(await p.locator('.resource-summary').innerText(), /0\.00\/s/);
      await p.close();
    }
    assert.deepEqual(errors, []);
    console.log('Single-click card close, held-press refresh, cancellation, keyboard close and one-second production snapshots passed in both yards at desktop/mobile sizes.');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(e => { console.error(e); process.exitCode=1; });
