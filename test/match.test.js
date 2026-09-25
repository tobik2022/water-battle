'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const maps = require('../shared/maps');
const { createMatch, setInput, step, blocked, snapshot, wireSnapshot, SPEED, STEP } = require('../server/match');

const members = count => Array.from({ length: count }, (_, i) => ({ id: `p${i}`, name: `Player ${i}`,
  side: i % 2 ? 'red' : 'blue', teamIndex: i % 5, skinIndex: i % 5 }));
const input = (extra = {}) => ({ dx: 0, dy: 0, aimX: 350, aimY: 1500, fire: false, ...extra });
function corridor(match) {
  Object.assign(match.players[0], { x: 100, y: 1500, cool: 0, protection: 0 });
  Object.assign(match.players[1], { x: 350, y: 1500, protection: 0 });
}
function advance(match, frames, data, start = 10000) {
  for (let i = 0; i < frames; i++) {
    const now = start + i * 1000 * STEP;
    if (data) setInput(match, 'p0', data, now);
    step(match, now);
  }
}

test('all ten maps provide collision-free, separated spawns for ten humans', () => {
  maps.forEach((_, map) => {
    const match = createMatch(members(10), map, '5v5');
    for (const p of match.players) {
      assert.equal(blocked(match.boxes, p.x, p.y, p.r), false);
      assert.equal(p.hp, 3);
      for (const other of match.players) if (p !== other) assert.ok(Math.hypot(p.x - other.x, p.y - other.y) >= 60);
    }
  });
});

test('server normalizes movement, ignores forged positions and expires stale input', () => {
  const match = createMatch(members(2), 0, '1v1'); corridor(match);
  const p = match.players[0];
  setInput(match, p.id, input({ dx: 999, dy: -999, x: 2300, hp: 99 }), 10000);
  step(match, 10000);
  assert.ok(Math.abs(Math.hypot(p.x - 100, p.y - 1500) - SPEED * STEP) < 0.001);
  assert.equal(p.hp, 3);
  const before = { x: p.x, y: p.y };
  step(match, 10401);
  assert.equal(p.x, before.x); assert.equal(p.y, before.y);
  assert.equal(setInput(match, p.id, input({ dx: NaN })), false);
  assert.equal(setInput(match, p.id, input({ aimX: Infinity })), false);
  assert.equal(setInput(match, 'unknown', input()), false);
});

test('players cannot cross piers or world edges', () => {
  const match = createMatch(members(2), 0, '1v1');
  const p = match.players[0]; Object.assign(p, { x: 690, y: 230 });
  advance(match, 60, input({ dx: 1 }));
  assert.ok(p.x <= 702); assert.equal(blocked(match.boxes, p.x, p.y, p.r), false);
  Object.assign(p, { x: 20, y: 1500 }); advance(match, 30, input({ dx: -1 }));
  assert.ok(p.x >= 18);
});

test('server controls fire rate and scores an elimination only once', () => {
  const match = createMatch(members(2), 0, '1v1'); corridor(match);
  advance(match, 42, input({ fire: true, damage: 999, fireRate: 999 }));
  assert.equal(match.score.blue, 1);
  assert.equal(match.players[0].kills, 1);
  assert.equal(match.events.length, 1);
  assert.ok(match.nextBullet <= 7);
  assert.equal(match.players[1].hp, 0);
  advance(match, 110);
  assert.equal(match.players[1].hp, 3);
  assert.equal(blocked(match.boxes, match.players[1].x, match.players[1].y, 18), false);
});

test('shots cannot pass through walls or damage teammates', () => {
  const match = createMatch(members(3), 0, '5v5');
  Object.assign(match.players[0], { x: 650, y: 240, cool: 0, protection: 0 });
  Object.assign(match.players[1], { x: 1040, y: 240, protection: 0 });
  advance(match, 60, input({ fire: true, aimX: 1040, aimY: 240 }));
  assert.equal(match.players[1].hp, 3);
  corridor(match);
  Object.assign(match.players[1], { y: 1100 });
  Object.assign(match.players[2], { x: 200, y: 1500, protection: 0 });
  advance(match, 30, input({ fire: true }), 20000);
  assert.equal(match.players[2].hp, 3);
});

test('respawn protection blocks damage; firing ends protection', () => {
  const match = createMatch(members(2), 0, '1v1'); corridor(match);
  match.players[1].protection = 1;
  advance(match, 18, input({ fire: true }));
  assert.equal(match.players[1].hp, 3);
  assert.equal(match.players[0].protection, 0);
});

test('victory freezes the authoritative match and snapshots contain no input secrets', () => {
  const match = createMatch(members(2), 0, '1v1'); corridor(match);
  match.score.blue = 2; match.players[1].hp = 1;
  advance(match, 30, input({ fire: true }));
  assert.equal(match.winner, 'blue'); assert.equal(match.score.blue, 3);
  const tick = match.tick;
  advance(match, 50, input({ dx: 1, fire: true }));
  assert.equal(match.tick, tick); assert.equal(match.score.blue, 3);
  assert.equal('input' in snapshot(match).players[0], false);
  assert.equal(wireSnapshot(match).p[0].length, 7);
  assert.equal(JSON.stringify(wireSnapshot(match)).includes('input'), false);
});
