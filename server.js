'use strict';

const http = require('node:http');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const { Rooms, ApiError } = require('./server/rooms');

const ROOT = __dirname;
const PUBLIC_FILES = new Set(['/index.html', '/style.css', '/game.js', '/multiplayer.js', '/shared/maps.js']);
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.png': 'image/png' };

function json(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(data));
}

async function body(request) {
  if (request.headers['content-type']?.split(';')[0] !== 'application/json') throw new ApiError(415, 'Očekávám JSON.');
  const raw = await new Promise((resolve, reject) => {
    let length = 0;
    const parts = [];
    request.on('data', chunk => {
      length += chunk.length;
      if (length > 4096) { reject(new ApiError(413, 'Příliš velký požadavek.')); return; }
      parts.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(parts).toString('utf8')));
    request.on('error', reject);
  });
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch { throw new ApiError(400, 'Neplatný JSON.'); }
}

function createServer() {
  const rooms = new Rooms();
  const arrivals = new Map();
  const server = http.createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    try {
      const url = new URL(request.url, 'http://localhost');
      if (url.pathname.startsWith('/api/')) {
        const origin = request.headers.origin;
        if (origin) {
          let originHost;
          try { originHost = new URL(origin).host; } catch { throw new ApiError(403, 'Cizí původ požadavku.'); }
          if (originHost !== request.headers.host) throw new ApiError(403, 'Cizí původ požadavku.');
        }
        if (request.method === 'GET' && url.pathname === '/api/events') {
          const session = rooms.authenticate(url.searchParams.get('token'));
          response.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
          response.write('retry: 1000\n\n');
          rooms.connect(session, response);
          return;
        }
        if (request.method !== 'POST') throw new ApiError(405, 'Použij POST.');
        if (url.pathname === '/api/rooms' || url.pathname === '/api/join') {
          const ip = request.socket.remoteAddress;
          const now = Date.now();
          let rate = arrivals.get(ip);
          if (!rate || now - rate.at > 60000) { rate = { at: now, count: 0 }; arrivals.set(ip, rate); }
          if (++rate.count > 30) throw new ApiError(429, 'Příliš mnoho připojení. Zkus to za minutu.');
          const result = rooms.join(await body(request), url.pathname === '/api/rooms');
          json(response, 201, result); return;
        }
        if (url.pathname === '/api/command') {
          const session = rooms.authenticate(request.headers.authorization?.replace(/^Bearer /, ''));
          rooms.command(session, await body(request));
          json(response, 200, { ok: true }); return;
        }
        throw new ApiError(404, 'Neznámý endpoint.');
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') throw new ApiError(405, 'Použij GET.');
      if (url.pathname === '/healthz') { json(response, 200, { ok: true }); return; }
      let pathname;
      try { pathname = decodeURIComponent(url.pathname); } catch { throw new ApiError(400, 'Neplatná adresa.'); }
      if (pathname === '/') pathname = '/index.html';
      const image = /^\/images\/[^/\\\x00]+\.png$/.test(pathname);
      if (!PUBLIC_FILES.has(pathname) && !image) throw new ApiError(404, 'Soubor nenalezen.');
      let file;
      try { file = await readFile(path.join(ROOT, pathname)); }
      catch { throw new ApiError(404, 'Soubor nenalezen.'); }
      response.writeHead(200, { 'Content-Type': TYPES[path.extname(pathname)],
        'Cache-Control': 'no-cache', 'Content-Length': file.length });
      response.end(request.method === 'HEAD' ? undefined : file);
    } catch (error) {
      if (response.destroyed || response.writableEnded) return;
      if (response.headersSent) { response.end(); return; }
      if (!(error instanceof ApiError)) console.error(error);
      json(response, error.status || 500, { error: error instanceof ApiError ? error.message : 'Chyba serveru.' });
    }
  });
  const simulation = setInterval(() => rooms.tick(), 1000 / 30);
  const housekeeping = setInterval(() => {
    const now = Date.now();
    rooms.cleanup(now);
    for (const [ip, rate] of arrivals) if (now - rate.at > 60000) arrivals.delete(ip);
  }, 5000);
  simulation.unref(); housekeeping.unref();
  server.requestTimeout = 10000;
  server.headersTimeout = 10000;
  server.maxHeadersCount = 40;
  server.rooms = rooms;
  server.shutdown = () => {
    clearInterval(simulation); clearInterval(housekeeping); rooms.close(); server.close();
    server.closeAllConnections();
  };
  server.on('close', () => { clearInterval(simulation); clearInterval(housekeeping); });
  return server;
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || '0.0.0.0';
  const server = createServer();
  server.on('error', error => { console.error(`Server nelze spustit: ${error.message}`); process.exitCode = 1; server.shutdown(); });
  server.listen(port, host, () => console.log(`Water Battle: http://localhost:${server.address().port} (poslouchá na ${host})`));
  process.on('SIGINT', () => server.shutdown());
  process.on('SIGTERM', () => server.shutdown());
}

module.exports = { createServer };
