'use strict';

const maps = require('../shared/maps');
const WORLD = { width: 2400, height: 1600 };
const STEP = 1 / 30;
const SPEED = 260;
const FIRE_INTERVAL = 0.25;
const RESPAWN = 3;
const INPUT_TIMEOUT = 400;
const BOT_THINK = 0.2;
const scoreLimit = mode => mode === '1v1' ? 3 : mode === '2v2' ? 8 : mode === '3v3' ? 12 : mode === '4v4' ? 16 : 20;

function geometry(map) {
  return maps[map].obstacles.map(([x, y, w, h]) => ({
    x: x * WORLD.width, y: y * WORLD.height, w: w * WORLD.width, h: h * WORLD.height,
  }));
}

function blocked(boxes, x, y, r) {
  return x < r || y < r || x > WORLD.width - r || y > WORLD.height - r ||
    boxes.some(b => Math.hypot(x - Math.max(b.x, Math.min(x, b.x + b.w)),
      y - Math.max(b.y, Math.min(y, b.y + b.h))) < r);
}

function move(boxes, unit, dx, dy) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 4));
  for (let i = 0; i < steps; i++) {
    if (!blocked(boxes, unit.x + dx / steps, unit.y, unit.r)) unit.x += dx / steps;
    if (!blocked(boxes, unit.x, unit.y + dy / steps, unit.r)) unit.y += dy / steps;
  }
}

function spawn(match, unit) {
  const alive = match.players.filter(p => p !== unit && p.hp > 0);
  const candidates = [];
  for (let x = 80; x < WORLD.width - 80; x += 80) {
    for (let y = 80; y < WORLD.height - 80; y += 80) {
      if (blocked(match.boxes, x, y, 36)) continue;
      const distance = p => Math.hypot(p.x - x, p.y - y);
      if (alive.some(p => distance(p) < 60)) continue;
      const enemies = alive.filter(p => p.side !== unit.side);
      const safety = enemies.length ? Math.min(...enemies.map(distance)) : 1000;
      const homeDistance = Math.hypot(x - (unit.side === 'blue' ? 240 : 2160), y - 800);
      candidates.push({ x, y, rank: Math.min(safety, 800) - homeDistance * 0.25 });
    }
  }
  candidates.sort((a, b) => b.rank - a.rank);
  const spot = candidates[0];
  if (!spot) throw new Error('Map has no available spawn');
  Object.assign(unit, { x: spot.x, y: spot.y, hp: 3, respawnTime: 0, protection: 1, cool: 0.4 });
}

function createMatch(members, map, mode, now = Date.now()) {
  const match = {
    map, mode, boxes: geometry(map), tick: 0, startedAt: now,
    score: { blue: 0, red: 0 }, limit: scoreLimit(mode),
    players: members.map(member => ({
      id: member.id, name: member.name, side: member.side,
      teamIndex: member.teamIndex, skinIndex: member.skinIndex,
      bot: !!member.bot,
      x: 0, y: 0, r: 18, hp: 0, maxHp: 3, kills: 0,
      respawnTime: 0, protection: 0, cool: 0, botThink: 0, input: null, inputAt: 0,
    })),
    bullets: [], nextBullet: 1, events: [], nextEvent: 1, winner: null,
  };
  for (const unit of match.players) spawn(match, unit);
  return match;
}

function setInput(match, id, data, now = Date.now()) {
  const unit = match.players.find(p => p.id === id);
  if (!unit || !Number.isFinite(data.dx) || !Number.isFinite(data.dy) ||
      !Number.isFinite(data.aimX) || !Number.isFinite(data.aimY) || typeof data.fire !== 'boolean') return false;
  const dx = Math.max(-1, Math.min(1, data.dx));
  const dy = Math.max(-1, Math.min(1, data.dy));
  const length = Math.max(1, Math.hypot(dx, dy));
  unit.input = { dx: dx / length, dy: dy / length,
    aimX: Math.max(0, Math.min(WORLD.width, data.aimX)),
    aimY: Math.max(0, Math.min(WORLD.height, data.aimY)), fire: data.fire };
  unit.inputAt = now;
  return true;
}

function updateBots(match, now) {
  for (let index = 0; index < match.players.length; index++) {
    const bot = match.players[index];
    if (!bot.bot) continue;
    if (bot.hp <= 0) { bot.input = null; continue; }
    bot.botThink -= STEP;
    if (bot.input && bot.botThink > 0) continue;
    const target = match.players
      .filter(player => player.side !== bot.side && player.hp > 0)
      .sort((a, b) => Math.hypot(a.x - bot.x, a.y - bot.y) - Math.hypot(b.x - bot.x, b.y - bot.y))[0];
    if (!target) { bot.input = null; continue; }
    const dx = target.x - bot.x, dy = target.y - bot.y, distance = Math.hypot(dx, dy) || 1;
    let moveX = dx / distance, moveY = dy / distance;
    if (distance < 330) { moveX = -dy / distance; moveY = dx / distance; }
    setInput(match, bot.id, {
      dx: moveX, dy: moveY, aimX: target.x, aimY: target.y, fire: distance < 900,
    }, now);
    bot.botThink = BOT_THINK;
  }
}

function step(match, now = Date.now()) {
  if (match.winner) return;
  match.tick++;
  updateBots(match, now);
  for (const unit of match.players) {
    if (unit.hp <= 0) {
      unit.respawnTime -= STEP;
      if (unit.respawnTime <= 0) spawn(match, unit);
      continue;
    }
    unit.cool = Math.max(0, unit.cool - STEP);
    unit.protection = Math.max(0, unit.protection - STEP);
    if (!unit.input || now - unit.inputAt > INPUT_TIMEOUT) continue;
    const input = unit.input;
    move(match.boxes, unit, input.dx * SPEED * STEP, input.dy * SPEED * STEP);
    if (input.fire && unit.cool <= 0) {
      const dx = input.aimX - unit.x, dy = input.aimY - unit.y;
      const length = Math.hypot(dx, dy);
      if (length < 1) continue;
      unit.protection = 0;
      unit.cool = FIRE_INTERVAL;
      match.bullets.push({ id: match.nextBullet++, owner: unit.id, side: unit.side,
        x: unit.x, y: unit.y, vx: dx / length * 520, vy: dy / length * 520, r: 6, life: 1.5 });
    }
  }

  for (const bullet of match.bullets) {
    // Small swept steps prevent shots from skipping thin walls or players.
    const count = Math.ceil(Math.hypot(bullet.vx, bullet.vy) * STEP / 4);
    for (let i = 0; i < count && bullet.life > 0; i++) {
      bullet.x += bullet.vx * STEP / count;
      bullet.y += bullet.vy * STEP / count;
      if (blocked(match.boxes, bullet.x, bullet.y, bullet.r)) { bullet.life = 0; break; }
      const victim = match.players.find(p => p.side !== bullet.side && p.hp > 0 &&
        Math.hypot(p.x - bullet.x, p.y - bullet.y) < p.r + bullet.r);
      if (!victim) continue;
      bullet.life = 0;
      if (victim.protection > 0) break;
      victim.hp--;
      if (victim.hp > 0) break;
      victim.respawnTime = RESPAWN;
      const attacker = match.players.find(p => p.id === bullet.owner);
      if (attacker) attacker.kills++;
      match.score[bullet.side]++;
      match.events.push({ id: match.nextEvent++, attacker: { name: attacker?.name || 'Hráč', side: bullet.side },
        victim: { name: victim.name, side: victim.side } });
      match.events = match.events.slice(-10);
      if (match.score[bullet.side] >= match.limit) {
        match.winner = bullet.side;
        return;
      }
    }
    bullet.life -= STEP;
  }
  match.bullets = match.bullets.filter(b => b.life > 0);
}

function snapshot(match) {
  return {
    tick: match.tick, map: match.map, mode: match.mode, score: match.score,
    limit: match.limit, winner: match.winner, events: match.events,
    players: match.players.map(({ input, inputAt, cool, botThink, ...player }) => player),
    bullets: match.bullets.map(({ vx, vy, life, owner, ...bullet }) => bullet),
  };
}

// The browser already receives static player metadata in the room event. Keep
// live packets focused on values that change during the match and use short
// keys/arrays to avoid repeating JSON property names 15 times per second.
function wireSnapshot(match) {
  const lastEvent = match.events.at(-1);
  return {
    s: [match.score.blue, match.score.red],
    w: match.winner,
    e: lastEvent?.id || 0,
    p: match.players.map((player, index) => [
      index, Math.round(player.x), Math.round(player.y), player.hp,
      Math.round(player.respawnTime * 100) / 100,
      Math.round(player.protection * 100) / 100, player.kills,
    ]),
    b: match.bullets.map(bullet => [
      bullet.id, bullet.side === 'red' ? 1 : 0, Math.round(bullet.x), Math.round(bullet.y),
    ]),
  };
}

module.exports = { WORLD, STEP, SPEED, FIRE_INTERVAL, RESPAWN, INPUT_TIMEOUT,
  geometry, blocked, move, createMatch, setInput, step, snapshot, wireSnapshot };
