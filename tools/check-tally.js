'use strict';
// V44: latest-only truck receipts and compact resource summaries in both yards.
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
  const errors = [], output = path.resolve(__dirname, '../runs/v44-ui');
  fs.mkdirSync(output, { recursive: true });
  try {
    for (const lot of ['home', 'hollow']) for (const mobile of [false, true]) {
      const p = await browser.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 }, serviceWorkers: 'block' });
      p.on('pageerror', e => errors.push(e.message));
      await p.route(/^https:\/\//, r => r.abort());
      await p.addInitScript(() => {
        window.requestAnimationFrame = () => 0;
        window.__uiNow = 10000;
        performance.now = () => window.__uiNow;
      });
      await p.goto(`http://127.0.0.1:${server.address().port}/?fresh&lot=${lot}`);
      await p.waitForFunction(() => window.__leafYard);
      await p.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
      const dev = s => p.evaluate(s => __leafYard.dev(s), s);
      await dev(`S.cash=S.peak=100000;S.land=1;S.metalSlot=true;S.bag.built=true;S.plant.built=true;S.hive.built=true;S.hive.bees=4;S.hive.packing=true;S.story.done=true;S.flags.antHill=true;S.flags.coalKnown=true;S.flags.ruinKnown=true;bindIds();syncRobots();syncBees();
        S.sales=[{t:30,items:[{k:'leaf',n:2,price:1,amount:2}],bonus:0,total:2},{t:20,items:[{k:'leaf',n:100,price:1,amount:100}],bonus:10,total:110},{t:10,items:[{k:'leaf',n:100,price:1,amount:100}],bonus:10,total:110}];
        resetProduction();S.t+=30;S.realT+=30;productionAdd('picked',60);productionAdd('converted',30);productionAdd('made',30/jarNectar());S.totals.bags=1;S.totals.nectar=60;S.totals.jars=15/jarNectar();S.totals.gifts=6/jarNectar();sampleProduction();openCard('sign');`);
      assert.equal(await p.locator('.receipt .rc-row.low').count(), 2);
      assert.match(await p.locator('.receipt .rc-bonus').innerText(), /\$0\.00\s+-100%/);
      assert.equal(await p.locator('.rc-strip,.rc-notes,[data-act^="receipt:"]').count(), 0);
      assert(!(await p.locator('.receipt').innerText()).includes('yard time'));
      await dev('receiptIndex=1;renderCard(true)');
      assert.match(await p.locator('.receipt .rc-total').innerText(), /2\.00/);
      assert.equal(await dev('S.sales.length'), 3);
      await dev("openCard('bin')");
      assert.equal(await dev('receiptIndex'), 0);
      await dev("openCard('sign');receiptIndex=2;recordSale({takeL:1},0,0,1);renderCard(true)");
      assert.equal(await dev('receiptIndex'), 0);
      for (const kind of ['sign', 'bin', 'tub', 'hive', 'plant']) {
        await dev(`openCard('${kind}');draw()`);
        const bounds = await p.locator('#card').evaluate(c => ({ overflow: c.scrollWidth > c.clientWidth + 2, left: c.getBoundingClientRect().left, right: c.getBoundingClientRect().right, width: innerWidth }));
        assert(!bounds.overflow && bounds.left >= -1 && bounds.right <= bounds.width + 1, `${lot}/${mobile}/${kind} overflow`);
        if (kind === 'sign') {
          assert(!/collecting|last 30 s/.test(await p.locator('.production').innerText()));
          const widths = await p.locator('.production .rc-bar').evaluateAll(bars => bars.map(b => parseFloat(b.style.width)));
          assert.deepEqual(widths.slice(2,6), [100, 50, 25, 10]);
          assert.match(await p.locator('.production').innerText(), lot === 'hollow' ? /Mushrooms sorted/ : /Turned into honey/);
        } else {
          assert.equal(await p.locator('.production,.receipt').count(), 0);
          assert.equal(await p.locator('.resource-summary').count(), 1);
          assert.match(await p.locator('.resource-summary').first().innerText(), /\/s.*Last/s);
          if (kind === 'bin') {
            assert.match(await p.locator('[data-resource="leaf"]').innerText(), /2\.00\/s.*\$0\.13/s);
            assert.equal(await p.locator('[data-resource="metal"]').count(), 0);
          }
          const previous = await p.locator('.resource-summary').first().innerText();
          await dev('S.t+=30;S.realT+=30;sampleProduction();recordSale({takeL:0,takeB:0,takeM:0,takeI:0,takeH:0,takeG:0},0,0,0);window.__uiNow+=1000;renderCard(true)');
          assert.match(await p.locator('.resource-summary').first().innerText(), /0\.00\/s.*\$0\.00/s);
          if (kind === 'bin') assert.notEqual(await p.locator('.resource-summary').first().innerText(), previous);
        }
        await p.screenshot({ path: path.join(output, `${lot}-${mobile ? 'mobile' : 'desktop'}-${kind}.png`) });
      }
      await p.close();
    }
    assert.deepEqual(errors, []);
    console.log('V44 latest receipts, preserved history, compact live summaries and desktop/mobile layout checks passed; previews in runs/v44-ui/');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(e => { console.error(e); process.exitCode = 1; });
