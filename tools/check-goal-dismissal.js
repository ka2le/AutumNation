'use strict';
// Exercise completion timing, saved goals and story prerequisites through the real HUD.
const fs = require('fs'), path = require('path'), http = require('http'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'C:/Users/kallek/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async () => {
  const root = path.resolve(__dirname, '../public');
  const server = http.createServer((req, res) => {
    try {
      const file = path.join(root, new URL(req.url, 'http://localhost').pathname.replace(/^\/$/, '/index.html'));
      res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
      res.end(fs.readFileSync(file));
    } catch { res.statusCode = 404; res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe' });
    const errors = [];
    for (const lot of ['hollow', 'home']) {
      const page = await browser.newPage({ serviceWorkers:'block' });
      page.on('pageerror', e => errors.push(e.message));
      await page.route(/^https:\/\//, r => r.abort());
      await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
      await page.goto(`http://127.0.0.1:${server.address().port}/?fresh&lot=${lot}`);
      await page.waitForFunction(() => window.__leafYard);
      const dev = code => page.evaluate(code => __leafYard.dev(code), code);
      const goal = id => page.locator(`#hGoals [data-id="${id}"]`);
      if (lot === 'hollow') {
        await dev('S.t=100; S.miles={}; S.fire.struck=false; updGoalHud(0)');
        assert.equal(await goal('dry').count(), 1);
        await dev('S.totals.drySold=DRY_GOAL; updMilestones(); updGoalHud(0)');
        assert.match(await goal('dry').getAttribute('class'), /done/);
        await dev('S.t=105.9; updGoalHud(0)');
        assert.equal(await goal('dry').count(), 1);
        await dev('S.t=106; updGoalHud(0)');
        assert.equal(await goal('dry').count(), 0);
        assert.equal(await dev('S.fire.struck'), false);
        assert.equal(await goal('bees').count(), 1);
        // An early Shaker finishes while canned mushrooms and logs are still outstanding.
        await dev("S.miles.bees=80; S.miles.hiveR=90; S.shakers=[newHelperCfg('shaker')]; updMilestones(); updGoalHud(0)");
        assert.match(await goal('shaker').getAttribute('class'), /done/);
        await dev('S.t=112; updGoalHud(0)');
        assert.equal(await goal('shaker').count(), 0);
        assert.equal(await goal('canned').count(), 1);
        // Old saved completion timestamps also disappear, without clearing progress.
        await dev('S.miles=JSON.parse(JSON.stringify(S.miles)); S.t=1000; updGoalHud(0)');
        assert.equal(await goal('dry').count(), 0);
        assert.equal(await goal('shaker').count(), 0);
        // Chained goals still replace their completed prerequisite after the hold.
        await dev('S.metalSlot=true; updMilestones(); updGoalHud(0)');
        assert.match(await goal('crib').getAttribute('class'), /done/);
        assert.equal(await goal('saw').count(), 0);
        await dev('S.t+=GOAL_DONE_HOLD; updGoalHud(0)');
        assert.equal(await goal('crib').count(), 0);
        assert.equal(await goal('saw').count(), 1);
        await dev('S.totals.honeyCash=CANNED_CASH; S.totals.logsSold=LOGS_GOAL; updMilestones()');
        assert.equal(await dev('S.fire.struck'), true, 'Hidden completed goals must still unlock lightning');
      } else {
        await dev('S.t=100; S.miles={snipR:80}; S.hive.built=true; S.land=1; S.flags.hollowGone=false; S.flags.tinkerGoal=false; updMilestones(); updGoalHud(0)');
        assert.match(await goal('qYard').getAttribute('class'), /done/);
        await dev('S.t+=GOAL_DONE_HOLD; updGoalHud(0)');
        assert.equal(await goal('qYard').count(), 0);
        assert.equal(await goal('qMine').count(), 1);
      }
      await page.close();
    }
    assert.deepEqual(errors, []);
    console.log('Completed goals dismiss independently after six seconds; unfinished goals, saved progress, chained goals and lightning unlock verified.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(e => { console.error(e); process.exitCode=1; });
