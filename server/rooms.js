'use strict';

const { randomBytes, randomUUID } = require('node:crypto');
const maps = require('../shared/maps');
const { createMatch, setInput, step, snapshot } = require('./match');

class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (condition, status, message) => { if (condition) throw new ApiError(status, message); };
const validMode = mode => mode === '1v1' || mode === '5v5';
const capacity = mode => mode === '1v1' ? 2 : 10;
const integer = (value, max) => Number.isInteger(value) && value >= 0 && value < max;
const GRACE_MS = 15000;

class Rooms {
  constructor() { this.rooms = new Map(); this.sessions = new Map(); }

  publicRoom(room) {
    return { code: room.code, hostId: room.hostId, map: room.map, mode: room.mode,
      status: room.status, capacity: capacity(room.mode), notice: room.notice,
      players: [...room.members.values()].map(s => ({ id: s.id, name: s.name, side: s.side,
        ready: s.ready, connected: !!s.stream, teamIndex: s.teamIndex, skinIndex: s.skinIndex })) };
  }

  send(session, type, data) {
    const stream = session.stream;
    if (!stream || stream.destroyed) return;
    // A slow connection must never accumulate an unbounded queue of snapshots.
    if (stream.writableLength > 128 * 1024) { stream.destroy(); return; }
    stream.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  }

  broadcast(room) {
    for (const member of room.members.values()) this.send(member, 'room', { room: this.publicRoom(room) });
  }

  join(data, create = false) {
    const name = typeof data.name === 'string' ? data.name.trim() : '';
    fail(!name || name.length > 20 || /[\x00-\x1f\x7f]/.test(name), 400, 'Přezdívka musí mít 1–20 znaků.');
    fail(!integer(data.teamIndex, 5) || !integer(data.skinIndex, 5), 400, 'Vyber platnou postavu.');
    let room;
    if (create) {
      fail(this.rooms.size >= 100, 503, 'Server je plný. Zkus to později.');
      fail(!validMode(data.mode) || !integer(data.map, maps.length), 400, 'Neplatný režim nebo mapa.');
      let code;
      do { code = randomBytes(4).toString('hex').slice(0, 6).toUpperCase(); } while (this.rooms.has(code));
      room = { code, mode: data.mode, map: data.map, status: 'lobby', members: new Map(),
        hostId: null, match: null, notice: '', lastActivity: Date.now() };
      this.rooms.set(code, room);
    } else {
      const code = typeof data.code === 'string' ? data.code.trim().toUpperCase() : '';
      room = this.rooms.get(code);
      fail(!room, 404, 'Místnost neexistuje. Zkontroluj kód.');
      fail(room.status !== 'lobby', 409, 'Bitva už začala. Počkej na další zápas.');
      fail(room.members.size >= capacity(room.mode), 409, 'Místnost je plná.');
    }
    const blueCount = [...room.members.values()].filter(s => s.side === 'blue').length;
    const session = { token: randomBytes(32).toString('hex'), id: randomUUID(), room,
      name, teamIndex: data.teamIndex, skinIndex: data.skinIndex,
      side: blueCount <= room.members.size - blueCount ? 'blue' : 'red',
      ready: false, stream: null, disconnectedAt: Date.now(), rateAt: 0, rateCount: 0 };
    this.sessions.set(session.token, session);
    room.members.set(session.id, session);
    room.hostId ||= session.id;
    room.notice = '';
    room.lastActivity = Date.now();
    this.broadcast(room);
    return { token: session.token, playerId: session.id, room: this.publicRoom(room) };
  }

  authenticate(token) {
    const session = this.sessions.get(token);
    fail(!session, 401, 'Připojení vypršelo. Připoj se znovu.');
    return session;
  }

  connect(session, response) {
    const previous = session.stream;
    if (previous) this.send(session, 'replaced', {});
    session.stream = response;
    previous?.end();
    session.disconnectedAt = null;
    response.on('close', () => {
      if (session.stream !== response) return;
      session.stream = null;
      session.disconnectedAt = Date.now();
      session.ready = false;
      const unit = session.room.match?.players.find(p => p.id === session.id);
      if (unit) unit.input = null;
      this.broadcast(session.room);
    });
    this.broadcast(session.room);
    if (session.room.match) this.send(session, 'state', { state: snapshot(session.room.match) });
  }

  command(session, data) {
    const room = session.room;
    const now = Date.now();
    if (now - session.rateAt >= 1000) { session.rateAt = now; session.rateCount = 0; }
    fail(++session.rateCount > 80, 429, 'Příliš mnoho požadavků.');
    if (data.action === 'input') {
      fail(room.status !== 'playing', 409, 'Bitva právě neběží.');
      fail(!session.stream, 409, 'Počkej na obnovení spojení.');
      fail(!setInput(room.match, session.id, data), 400, 'Neplatné ovládání.');
      return;
    }
    if (data.action === 'leave') { this.remove(session); return; }
    room.lastActivity = now;
    if (data.action === 'rematch') {
      fail(session.id !== room.hostId, 403, 'Další zápas chystá zakladatel.');
      fail(room.status !== 'finished', 409, 'Zápas ještě neskončil.');
      room.status = 'lobby'; room.match = null; room.notice = 'Nový zápas — potvrď připravenost.';
      for (const member of room.members.values()) member.ready = false;
      this.broadcast(room); return;
    }
    fail(room.status !== 'lobby', 409, 'Počkej na konec zápasu.');
    switch (data.action) {
      case 'ready':
        fail(typeof data.ready !== 'boolean' || !session.stream, 400, 'Neplatná připravenost.');
        session.ready = data.ready;
        break;
      case 'side': {
        fail(data.side !== 'blue' && data.side !== 'red', 400, 'Neplatná strana.');
        const others = [...room.members.values()].filter(s => s.id !== session.id && s.side === data.side);
        fail(others.length >= capacity(room.mode) / 2, 409, 'Tento tým je plný.');
        session.side = data.side; session.ready = false;
        break;
      }
      case 'settings':
        fail(session.id !== room.hostId, 403, 'Mapu a režim vybírá zakladatel.');
        fail(!validMode(data.mode) || !integer(data.map, maps.length), 400, 'Neplatný režim nebo mapa.');
        fail(['blue', 'red'].some(side => [...room.members.values()].filter(s => s.side === side).length > capacity(data.mode) / 2),
          409, 'Pro souboj 1v1 musí být v každém týmu právě jeden hráč.');
        room.mode = data.mode; room.map = data.map;
        for (const member of room.members.values()) member.ready = false;
        break;
      case 'start': {
        fail(session.id !== room.hostId, 403, 'Bitvu spouští zakladatel.');
        const members = [...room.members.values()];
        const blue = members.filter(s => s.side === 'blue').length;
        const red = members.length - blue;
        fail(!blue || !red || Math.abs(blue - red) > 1, 409, 'Potřebuješ dva vyrovnané týmy (rozdíl nejvýše 1).');
        fail(members.some(s => !s.ready || !s.stream), 409, 'Všichni hráči musí být připojeni a připraveni.');
        room.match = createMatch(members, room.map, room.mode);
        room.status = 'playing'; room.notice = '';
        break;
      }
      default: throw new ApiError(400, 'Neznámá akce.');
    }
    this.broadcast(room);
    if (room.status === 'playing') this.publishState(room);
  }

  remove(session) {
    if (!this.sessions.delete(session.token)) return;
    const room = session.room;
    room.members.delete(session.id);
    const stream = session.stream;
    session.stream = null;
    stream?.end();
    if (!room.members.size) { this.rooms.delete(room.code); return; }
    if (room.hostId === session.id) room.hostId = room.members.keys().next().value;
    if (room.match) {
      room.match.players = room.match.players.filter(p => p.id !== session.id);
      room.match.bullets = room.match.bullets.filter(b => b.owner !== session.id);
      if (room.status === 'playing' && ['blue', 'red'].some(side => !room.match.players.some(p => p.side === side))) {
        room.status = 'lobby'; room.match = null;
        room.notice = 'Tým opustil bitvu. Pozvi další hráče a spusť nový zápas.';
        for (const member of room.members.values()) member.ready = false;
      }
    }
    this.broadcast(room);
  }

  publishState(room) {
    const state = snapshot(room.match);
    for (const member of room.members.values()) this.send(member, 'state', { state });
  }

  tick(now = Date.now()) {
    for (const room of this.rooms.values()) {
      if (room.status !== 'playing') continue;
      step(room.match, now);
      if (room.match.winner) { room.status = 'finished'; room.lastActivity = now; this.broadcast(room); }
      if (room.match.tick % 2 === 0 || room.match.winner) this.publishState(room);
    }
  }

  cleanup(now = Date.now()) {
    for (const session of this.sessions.values()) {
      if (session.disconnectedAt !== null && now - session.disconnectedAt > GRACE_MS) this.remove(session);
      else if (session.stream) session.stream.write(': heartbeat\n\n');
    }
    for (const room of this.rooms.values()) {
      if (room.status !== 'playing' && now - room.lastActivity > 30 * 60 * 1000) {
        for (const session of room.members.values()) {
          this.send(session, 'expired', {}); this.remove(session);
        }
      }
    }
  }

  close() {
    for (const session of [...this.sessions.values()]) this.remove(session);
  }
}

module.exports = { Rooms, ApiError, GRACE_MS };
