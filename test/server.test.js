'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { createServer } = require('../server');

function decodeState(state, room) {
  if (!state.p) return state;
  return {
    score: { blue: state.s[0], red: state.s[1] }, winner: state.w || null,
    events: state.e ? [{ id: state.e }] : [],
    players: state.p.map(([index, x, y, hp, respawnTime, protection, kills]) => ({
      ...room.players[index], x, y, r: 18, hp, maxHp: 3, respawnTime, protection, kills,
    })),
    bullets: state.b.map(([id, side, x, y]) => ({ id, side: side ? 'red' : 'blue', x, y, r: 6 })),
  };
}

async function setup(t) {
  const server = createServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => server.shutdown());
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = async (path, data, token) => {
    const response = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(data) });
    return { status: response.status, ...await response.json() };
  };
  return { server, base, post };
}

async function events(base, token, t) {
  const controller = new AbortController(); t.after(() => controller.abort());
  const response = await fetch(`${base}/api/events?token=${token}`, { signal: controller.signal });
  assert.equal(response.status, 200);
  const messages = []; const waiting = new Set();
  const reader = response.body.getReader(); const decoder = new TextDecoder(); let text = '';
  const pump = (async () => {
    try {
      while (true) {
        const result = await reader.read(); if (result.done) break;
        text += decoder.decode(result.value, { stream: true });
        let end;
        while ((end = text.indexOf('\n\n')) >= 0) {
          const event = text.slice(0, end); text = text.slice(end + 2);
          if (event.startsWith('data: ')) {
            const data = JSON.parse(event.slice(6)); messages.push(data);
            for (const wake of waiting) wake();
          }
        }
      }
    } catch (error) { if (!controller.signal.aborted) throw error; }
  })();
  t.after(async () => { controller.abort(); await pump; });
  return { messages, close: () => controller.abort(), wait: predicate => new Promise((resolve, reject) => {
    const timer = setTimeout(() => { waiting.delete(check); reject(new Error('SSE event timeout')); }, 4000);
    const check = () => { const match = messages.find(predicate); if (match) { clearTimeout(timer); waiting.delete(check); resolve(match); } };
    waiting.add(check); check();
  }) };
}

test('HTTP serves only game assets and rejects invalid origins, bodies and tokens', async t => {
  const { base, post } = await setup(t);
  for (const path of ['/', '/game.js', '/multiplayer.js', '/shared/maps.js', '/images/aqua_legion.png']) {
    const response = await fetch(base + path); assert.equal(response.status, 200); await response.arrayBuffer();
  }
  for (const path of ['/server.js', '/server/rooms.js', '/package.json', '/.git/config', '/images/..%5cserver.js']) {
    assert.equal((await fetch(base + path)).status, 404);
  }
  assert.equal((await post('/api/command', { action: 'start' }, 'fake')).status, 401);
  assert.equal((await post('/api/rooms', { name: 'x'.repeat(5000) })).status, 413);
  assert.equal((await post('/api/rooms', null)).status, 400);
  assert.equal((await fetch(base + '/api/rooms', { method: 'POST', headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' }, body: '{}' })).status, 403);
  assert.equal((await fetch(base + '/api/rooms', { method: 'POST', headers: { Origin: 'null', 'Content-Type': 'application/json' }, body: '{}' })).status, 403);
  assert.equal((await fetch(base + '/api/rooms', { method: 'POST', body: '{}' })).status, 415);
});

test('two real HTTP clients receive the same match, movement, elimination, victory and rematch', async t => {
  const { server, base, post } = await setup(t);
  const host = await post('/api/rooms', { name: 'Anna', map: 0, mode: '1v1', teamIndex: 0, skinIndex: 0 });
  assert.equal(host.status, 201);
  const guest = await post('/api/join', { name: 'Boris', code: host.room.code.toLowerCase(), teamIndex: 2, skinIndex: 3 });
  const a = await events(base, host.token, t); const b = await events(base, guest.token, t);
  await a.wait(e => e.type === 'room' && e.room.players.every(p => p.connected));
  const command = (user, data) => post('/api/command', data, user.token);
  const input = (user, data) => post('/api/input', data, user.token);
  assert.equal((await command(guest, { action: 'start' })).status, 403);
  for (const user of [host, guest]) assert.equal((await command(user, { action: 'ready', ready: true })).status, 200);
  assert.equal((await command(host, { action: 'start' })).status, 200);
  const initial = decodeState((await a.wait(e => e.type === 'state')).state, host.room);
  await b.wait(e => e.type === 'state');
  const startX = initial.players.find(p => p.id === host.playerId).x;
  await input(host, { dx: 1, dy: 0, aimX: 500, aimY: 1500, fire: false, hp: 100, x: 2000 });
  const moved = await b.wait(e => e.type === 'state' &&
    decodeState(e.state, host.room).players.find(p => p.id === host.playerId).x > startX);
  const movedState = decodeState(moved.state, host.room);
  assert.equal(movedState.players.find(p => p.id === host.playerId).hp, 3);
  // Deterministic final-shot fixture; movement and damage still run through HTTP and the live server loop.
  const match = server.rooms.rooms.get(host.room.code).match;
  Object.assign(match.players[0], { x: 100, y: 1500, cool: 0, protection: 0 });
  Object.assign(match.players[1], { x: 250, y: 1500, hp: 1, protection: 0 });
  match.score.blue = 2;
  await input(host, { dx: 0, dy: 0, aimX: 250, aimY: 1500, fire: true });
  const wonA = decodeState((await a.wait(e => e.type === 'state' && e.state.w === 'blue')).state, host.room);
  const wonB = decodeState((await b.wait(e => e.type === 'state' && e.state.w === 'blue')).state, host.room);
  assert.deepEqual(wonA, wonB); assert.deepEqual(wonA.score, { blue: 3, red: 0 });
  assert.ok(wonA.events[0].id > 0);
  assert.equal((await command(host, { action: 'rematch' })).status, 200);
  await b.wait(e => e.type === 'room' && e.room.notice.startsWith('Nový zápas'));
  // Replacing an SSE connection must retain identity and notify its old tab.
  const reconnected = await events(base, guest.token, t);
  await b.wait(e => e.type === 'replaced');
  const resumed = await reconnected.wait(e => e.type === 'room');
  assert.ok(resumed.room.players.some(p => p.id === guest.playerId && p.connected));
  assert.equal((await command(host, { action: 'leave' })).status, 200);
  await reconnected.wait(e => e.type === 'room' && e.room.hostId === guest.playerId);
});
