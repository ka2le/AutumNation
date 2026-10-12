'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

async function main() {
  const root = path.join(__dirname, '..', 'public');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
  const manifestUrl = 'https://ka2le.github.io/AutumNation/manifest.webmanifest';
  const start = new URL(manifest.start_url, manifestUrl);
  const scope = new URL(manifest.scope, manifestUrl);
  assert.equal(new URL(manifest.id, start.origin).href, 'https://ka2le.github.io/AutumNation/app');
  assert.notEqual(manifest.id, '/AutumNation/', 'The previous install ID may be stuck on Android');
  assert.equal(start.href, scope.href);
  assert.equal(scope.pathname, '/AutumNation/');

  const handlers = {};
  const deleted = [];
  const opened = [];
  const cachedRequests = [];
  let cacheHit;
  const ownCache = {
    match: async (request) => { cachedRequests.push(request); return cacheHit; },
    put: async () => {},
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'sw.js'), 'utf8'), {
    URL, Response,
    self: {
      location: { origin: start.origin },
      registration: { scope: scope.href },
      addEventListener: (name, callback) => { handlers[name] = callback; },
      clients: { claim: async () => {} },
    },
    caches: {
      keys: async () => ['autumnation-v1', 'autumnation-v7', 'autumnation-v8', 'other-app-v1'],
      delete: async (key) => { deleted.push(key); },
      open: async (key) => { opened.push(key); return ownCache; },
    },
    fetch: async () => { throw new Error('Offline'); },
  });
  let activation;
  handlers.activate({ waitUntil: (promise) => { activation = promise; } });
  await activation;
  assert.deepEqual(deleted, ['autumnation-v1', 'autumnation-v7'], 'Other apps and current cache must survive activation');

  function request(url, mode = 'cors') {
    let response;
    handlers.fetch({ request: { method: 'GET', url, mode }, respondWith: (promise) => { response = promise; } });
    return response;
  }
  assert.equal(request('https://ka2le.github.io/OtherApp/game.js'), undefined);
  assert.equal(request('https://example.com/game.js'), undefined);
  cacheHit = new Response('cached game');
  assert.equal(await (await request(new URL('game.js', start).href)).text(), 'cached game');
  assert.deepEqual(opened, ['autumnation-v8']);
  cachedRequests.length = 0;
  cacheHit = undefined;
  await request(new URL('offline-route', start).href, 'navigate');
  assert.equal(cachedRequests[1], 'index.html', 'Offline navigation must use this app cache');
  console.log('PWA checks passed: distinct app identity, path scope, and isolated offline caches.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
