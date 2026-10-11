// AutumNation local dev server — no dependencies, just Node.
// Serves ./public, reloads the browser when a file in ./public changes.
//   node server.js            → http://localhost:8080 (opens your browser)
//   node server.js --port 3000 --no-open
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const args = process.argv.slice(2);
const argVal = (name, def) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] ? args[i + 1] : def; };
const ROOT = path.join(__dirname, 'public');
let port = parseInt(process.env.PORT || argVal('--port', '8080'), 10);
const openBrowser = !args.includes('--no-open');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.woff2': 'font/woff2', '.woff': 'font/woff',
};

// Live reload: a tiny script is injected into HTML pages; it listens on /__reload.
const clients = new Set();
const RELOAD_SNIPPET = '<script>(()=>{const es=new EventSource("/__reload");es.onmessage=()=>location.reload();})();</script>';

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/__reload') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write(': connected\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }
  // a folder without the trailing slash (e.g. /location2): redirect so relative paths work, like GitHub Pages does
  if (!rel.endsWith('/') && fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    res.writeHead(301, { Location: url.pathname + '/' + url.search }); res.end(); return;
  }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found: ' + rel); return; }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    if (ext === '.html') data = Buffer.from(data.toString('utf8').replace('</body>', RELOAD_SNIPPET + '</body>'));
    res.end(data);
  });
});

let reloadTimer = null;
try {
  fs.watch(ROOT, { recursive: true }, (_evt, name) => {
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => {
      console.log('  changed: ' + (name || '?') + ' → reloading browser');
      for (const c of clients) c.write('data: reload\n\n');
    }, 120);
  });
} catch (e) {
  console.log('  (live reload unavailable: ' + e.message + ')');
}

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE' && port < 8100) { port++; server.listen(port); return; }
  console.error(e); process.exit(1);
});
server.on('listening', () => {
  const link = 'http://localhost:' + port;
  console.log('\n  Leaf Yard is running at ' + link);
  console.log('  Fresh game:   ' + link + '/?fresh');
  console.log('  Fast-forward: ' + link + '/?speed=4');
  console.log('  Press Ctrl+C to stop.\n');
  if (openBrowser) {
    const cmd = process.platform === 'win32' ? 'start "" "' + link + '"' : process.platform === 'darwin' ? 'open ' + link : 'xdg-open ' + link;
    exec(cmd, () => {});
  }
});
server.listen(port);
