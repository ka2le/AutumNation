'use strict';
// Verify the real ending return, letter assignment, task priority and save/reload paths.
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
    page.on('pageerror', e => errors.push(e.message));
    await page.route(/^https:\/\//, route => route.abort());
    await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
    const ready = () => page.waitForFunction(() => window.__leafYard && window.__leafYard.dev('LH_READY'));
    const dev = code => page.evaluate(code => __leafYard.dev(code), code);
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await ready();
    assert.equal(await dev('LETTERS.final.text'), 'I think you want to see this', 'first invitation keeps its original text');
    await dev(`S.letters.push({ id: 'final', ...LETTER_AT(), read: false }); readLetter(0)`);
    assert(await dev('taskTop(S.robots[0], "travel")'), 'first reading still sends Tinker');
    const finishTour = async () => {
      await dev('beginEnding()');
      assert(await dev('S.letters.some(l => l.id === "final")'), 'golden letter survives departure');
      await page.evaluate(() => __leafYard.endingFF(10000));
      assert.equal(await dev('S.flags.ending'), 3, 'full tour returns home');
      await dev('startEndReturn(R[0]); showEndPopup(false)');
      // The loop is frozen for this test; invoke Continue immediately rather than racing its CSS animation/timers.
      await page.locator('#epGo').evaluate(button => button.click());
      assert.equal(await dev('tripHolder() === null'), true, 'return leaves nobody assigned');
      assert(await dev('S.robots[0].off.includes("travel")'), 'optional ride is in Don’t');
      assert(await dev('taskOpen("travel", S.robots[0])'), 'ride is available on task list');
      await dev('autoTripCrew()');
      assert(await dev('tripHolder() === null'), 'crew auto-assignment cannot restart tour');
    };
    await finishTour();
    await dev('save()');
    await page.reload(); await ready();
    assert(await dev('tripHolder() === null && S.trip.to === "ending"'), 'optional ride survives reload');
    await page.evaluate(() => __leafYard.open('letter', __leafYard.state().letters.findIndex(l => l.id === 'final')));
    assert.equal(await page.locator('.letter.gold p').first().textContent(), 'Want to see it again?', 'returned letter invites another tour');
    assert(await dev('tripHolder() === null'), 'rereading the letter does not start a ride');
    await page.locator('[data-act="asg:robot:0:travel"]').click();
    assert(await dev('taskTop(S.robots[0], "travel")'), 'letter Assign puts ride first');
    await finishTour();
    await dev('putTop(S.robots[0], "travel"); taskListChanged("robot", 0)');
    assert(await dev('tripHolder() === S.robots[0] && taskWork(R[0], "travel")'), 'task priority enables another ride');
    await finishTour();
    // Saves from before replay support regain the missing letter and an unassigned ride.
    await dev('S.letters = []; S.trip = null; save()');
    await page.reload(); await ready();
    assert(await dev('S.letters.some(l => l.id === "final") && S.trip.to === "ending" && tripHolder() === null'), 'completed saves can replay too');
    assert.deepEqual(errors, []);
    console.log('Ending replay checks passed: first tour, return, letter Assign, task priority, repeated tours and reload.');
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(e => { console.error(e); process.exitCode = 1; });
