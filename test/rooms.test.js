'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { Rooms, GRACE_MS } = require('../server/rooms');

class Stream extends EventEmitter {
  constructor() { super(); this.writableLength = 0; this.messages = []; }
  write(message) { this.messages.push(message); }
  end() { this.emit('close'); }
  destroy() { this.destroyed = true; this.emit('close'); }
}
function join(rooms, code, mode = '5v5') {
  const result = rooms.join({ code, mode, map: 0, name: 'Tester', teamIndex: 0, skinIndex: 0 }, !code);
  const session = rooms.authenticate(result.token); rooms.connect(session, new Stream()); return session;
}
const hasStatus = status => error => error.status === status;

test('rooms isolate players and secrets; 1v1 and 5v5 enforce their capacities', () => {
  const rooms = new Rooms(); const host = join(rooms, null, '1v1'); join(rooms, host.room.code);
  assert.throws(() => join(rooms, host.room.code), hasStatus(409));
  const teamHost = join(rooms);
  for (let i = 1; i < 5; i++) join(rooms, teamHost.room.code);
  assert.throws(() => join(rooms, teamHost.room.code), hasStatus(409));
  const publicRoom = rooms.publicRoom(teamHost.room);
  assert.equal(publicRoom.players.length, 5);
  assert.equal(publicRoom.humanCount, 5);
  assert.equal(publicRoom.players.filter(p => p.side === 'blue').length, 3);
  assert.equal(JSON.stringify(publicRoom).includes(teamHost.token), false);
  assert.equal(host.room.members.size, 2);
});

test('5v5 rooms fill missing human players with authoritative bots', () => {
  const rooms = new Rooms(); const host = join(rooms); const guest = join(rooms, host.room.code);
  rooms.command(host, { action: 'side', side: 'blue' });
  rooms.command(guest, { action: 'side', side: 'blue' });
  for (const session of [host, guest]) rooms.command(session, { action: 'ready', ready: true });
  rooms.command(host, { action: 'start' });
  const match = host.room.match;
  assert.equal(match.players.length, 10);
  assert.equal(match.players.filter(player => player.bot).length, 8);
  assert.equal(match.players.filter(player => player.side === 'blue').length, 5);
  assert.equal(match.players.filter(player => player.side === 'red').length, 5);
  assert.equal(rooms.publicRoom(host.room).players.filter(player => player.bot).length, 8);
});

test('2v2 stays human-only while 3v3 and 4v4 fill missing slots with bots', () => {
  const rooms = new Rooms();
  const duel = join(rooms, null, '2v2');
  const duelPlayers = [duel];
  for (let i = 1; i < 4; i++) duelPlayers.push(join(rooms, duel.room.code));
  for (const session of duelPlayers) rooms.command(session, { action: 'ready', ready: true });
  rooms.command(duel, { action: 'start' });
  assert.equal(duel.room.match.players.length, 4);
  assert.equal(duel.room.match.players.filter(player => player.bot).length, 0);

  for (const mode of ['3v3', '4v4']) {
    const host = join(rooms, null, mode);
    rooms.command(host, { action: 'ready', ready: true });
    rooms.command(host, { action: 'start' });
    const expected = mode === '3v3' ? 6 : 8;
    assert.equal(host.room.match.players.length, expected);
    assert.equal(host.room.match.players.filter(player => player.bot).length, expected - 1);
  }
});

test('only the host can start and change settings, everyone must be ready', () => {
  const rooms = new Rooms(); const host = join(rooms); const guest = join(rooms, host.room.code);
  assert.throws(() => rooms.command(guest, { action: 'start' }), hasStatus(403));
  assert.throws(() => rooms.command(guest, { action: 'settings', map: 1, mode: '1v1' }), hasStatus(403));
  assert.throws(() => rooms.command(host, { action: 'start' }), hasStatus(409));
  rooms.command(host, { action: 'ready', ready: true }); rooms.command(guest, { action: 'ready', ready: true });
  rooms.command(host, { action: 'settings', map: 1, mode: '1v1' });
  assert.equal(host.ready, false); assert.equal(guest.ready, false);
  rooms.command(host, { action: 'ready', ready: true }); rooms.command(guest, { action: 'ready', ready: true });
  rooms.command(host, { action: 'start' }); assert.equal(host.room.status, 'playing');
  assert.throws(() => join(rooms, host.room.code), hasStatus(409));
  assert.throws(() => rooms.command(host, { action: 'side', side: 'red' }), hasStatus(409));
});

test('changing side cancels readiness and bots balance the teams', () => {
  const rooms = new Rooms(); const host = join(rooms); const guest = join(rooms, host.room.code);
  rooms.command(guest, { action: 'ready', ready: true });
  rooms.command(guest, { action: 'side', side: 'blue' }); assert.equal(guest.ready, false);
  rooms.command(host, { action: 'ready', ready: true }); rooms.command(guest, { action: 'ready', ready: true });
  rooms.command(host, { action: 'start' });
  assert.equal(host.room.status, 'playing');
  assert.equal(host.room.match.players.filter(player => player.side === 'red').length, 5);
});

test('refresh reconnects the same identity; expired disconnect transfers host and releases empty rooms', () => {
  const rooms = new Rooms(); const host = join(rooms); const guest = join(rooms, host.room.code);
  const id = host.id; host.stream.destroy();
  assert.equal(host.ready, false);
  rooms.connect(host, new Stream()); rooms.cleanup(Date.now() + GRACE_MS + 1);
  assert.equal(rooms.authenticate(host.token).id, id);
  host.stream.destroy(); rooms.cleanup(Date.now() + GRACE_MS + 1);
  assert.equal(guest.room.hostId, guest.id);
  assert.throws(() => rooms.authenticate(host.token), hasStatus(401));
  rooms.remove(guest); assert.equal(rooms.rooms.size, 0); assert.equal(rooms.sessions.size, 0);
});

test('bots keep an active match running when a human leaves', () => {
  const rooms = new Rooms(); const host = join(rooms); const guest = join(rooms, host.room.code);
  for (const s of [host, guest]) rooms.command(s, { action: 'ready', ready: true });
  rooms.command(host, { action: 'start' }); rooms.remove(host);
  assert.equal(guest.room.status, 'playing');
  assert.ok(guest.room.match.players.some(player => player.side === 'blue'));
  assert.ok(guest.room.match.players.some(player => player.side === 'red'));
  assert.equal(guest.room.hostId, guest.id);
});

test('finished matches support a fresh rematch in the same room', () => {
  const rooms = new Rooms(); const host = join(rooms); const guest = join(rooms, host.room.code);
  for (const s of [host, guest]) rooms.command(s, { action: 'ready', ready: true });
  rooms.command(host, { action: 'start' }); host.room.match.winner = 'red'; rooms.tick();
  assert.equal(host.room.status, 'finished');
  assert.throws(() => rooms.command(guest, { action: 'rematch' }), hasStatus(403));
  rooms.command(host, { action: 'rematch' }); assert.equal(host.room.status, 'lobby');
  for (const s of [host, guest]) rooms.command(s, { action: 'ready', ready: true });
  rooms.command(host, { action: 'start' });
  assert.deepEqual(host.room.match.score, { blue: 0, red: 0 });
});

test('replacement stream stays connected when the old stream closes', () => {
  const rooms = new Rooms(); const host = join(rooms); const previous = host.stream;
  const next = new Stream(); rooms.connect(host, next);
  assert.equal(host.stream, next); assert.equal(host.disconnectedAt, null);
  assert.ok(previous.messages.some(m => m.includes('replaced')));
});

test('rooms do not publish duplicate live snapshots', () => {
  const rooms = new Rooms(); const host = join(rooms); const guest = join(rooms, host.room.code);
  for (const session of [host, guest]) rooms.command(session, { action: 'ready', ready: true });
  rooms.command(host, { action: 'start' });
  const stateCount = () => host.stream.messages.filter(message => message.startsWith('data: ') &&
    JSON.parse(message.slice(6)).type === 'state').length;
  const settled = stateCount();
  rooms.publishState(host.room);
  assert.equal(stateCount(), settled);
  rooms.command(host, { action: 'input', dx: 1, dy: 0, aimX: 600, aimY: 800, fire: false });
  rooms.tick();
  rooms.tick();
  assert.ok(stateCount() > settled);
});

test('invalid payloads, unknown sessions and command floods are rejected', () => {
  const rooms = new Rooms();
  assert.throws(() => rooms.join({}), hasStatus(400));
  assert.throws(() => rooms.authenticate('forged'), hasStatus(401));
  assert.throws(() => join(rooms, 'ABCDEF'), hasStatus(404));
  const host = join(rooms);
  assert.throws(() => rooms.command(host, { action: 'ready', ready: 'yes' }), hasStatus(400));
  for (let i = 0; i < 79; i++) rooms.command(host, { action: 'ready', ready: true });
  assert.throws(() => rooms.command(host, { action: 'ready', ready: true }), hasStatus(429));
});
