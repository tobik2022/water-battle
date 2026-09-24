'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const { createMatch, snapshot } = require('../server/match');

// Run the real client scripts with a minimal DOM and dispatch their pointer events.
function client(online = false, width = 800) {
  const nodes = new Map(), requests = [];
  function element() {
    const listeners = new Map(), children = [], classes = new Set();
    return {
      children, style: { setProperty() {} }, hidden: false,
      clientWidth: width, clientHeight: 600,
      classList: {
        add(...names) { names.forEach(name => classes.add(name)); },
        remove(...names) { names.forEach(name => classes.delete(name)); },
        toggle(name, on) { if (on) classes.add(name); else classes.delete(name); },
      },
      append(...items) { children.push(...items); },
      appendChild(item) { children.push(item); },
      prepend(item) { children.unshift(item); },
      replaceChildren(...items) { children.splice(0, children.length, ...items); },
      get firstElementChild() { return children[0]; },
      setAttribute() {}, setPointerCapture() {},
      getContext() { return { setTransform() {} }; },
      getBoundingClientRect() { return { left: 12, top: 64, width, height: 600 }; },
      querySelector() { return element(); },
      addEventListener(type, callback) {
        if (!listeners.has(type)) listeners.set(type, []);
        listeners.get(type).push(callback);
      },
      dispatch(type, event = {}) { for (const callback of listeners.get(type) || []) callback(event); },
    };
  }
  const node = selector => {
    if (!nodes.has(selector)) nodes.set(selector, element());
    return nodes.get(selector);
  };
  const document = Object.assign(element(), {
    querySelector: node, getElementById: id => node('#' + id),
    querySelectorAll: () => [], createElement: element,
  });
  const window = element();
  let source;
  const context = vm.createContext({
    document, window, Image: class {}, WaterBattleMaps: require('../shared/maps'),
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    sessionStorage: {
      getItem() { return online ? JSON.stringify({ token: 'test-token', playerId: 'p0' }) : null; },
      setItem() {}, removeItem() {},
    },
    addEventListener: window.addEventListener,
    requestAnimationFrame() { return 1; }, cancelAnimationFrame() {},
    setTimeout() { return 1; }, clearTimeout() {}, performance, devicePixelRatio: 2,
    URL, URLSearchParams, AbortSignal,
    location: { href: 'http://localhost/', hash: '', protocol: 'http:' },
    EventSource: class { constructor() { source = this; } close() {} },
    async fetch(path, options) {
      requests.push({ path, ...JSON.parse(options.body) });
      return { ok: true, async json() { return { ok: true }; } };
    },
  });
  const run = code => vm.runInContext(code, context);
  run(readFileSync(join(__dirname, '../game.js'), 'utf8'));
  run('sound=()=>{}');
  if (online) {
    run(readFileSync(join(__dirname, '../multiplayer.js'), 'utf8'));
    assert.ok(source, 'client restores the online session');
    source.onopen();
    const members = [
      { id: 'p0', name: 'Blue', side: 'blue', teamIndex: 0, skinIndex: 0, ready: true, connected: true },
      { id: 'p1', name: 'Red', side: 'red', teamIndex: 1, skinIndex: 0, ready: true, connected: true },
    ];
    source.onmessage({ data: JSON.stringify({ type: 'room', room: {
      code: 'ABC123', hostId: 'p0', status: 'playing', mode: '1v1', map: 0, capacity: 2, players: members,
    } }) });
    const match = createMatch(members, 0, '1v1');
    Object.assign(match.players[0], { x: 1200, y: 1500 });
    match.events.push({ id: 1, attacker: members[0], victim: members[1] });
    source.onmessage({ data: JSON.stringify({ type: 'state', state: snapshot(match) }) });
  } else {
    run(`running=true; player={x:1200,y:1500,r:18,hp:3,speed:260,color:'#28d7ff',name:'Blue',side:'blue'};
      blueTeam=[player]; redTeam=[]; camera.x=1000; camera.y=1200;`);
  }
  const pointer = (type, id, x, y, pointerType = 'touch') => node('#canvas').dispatch(type, {
    pointerId: id, clientX: x + 12, clientY: y + 64, pointerType,
  });
  const frame = async () => {
    run(online ? 'onlineFrame(.05)' : 'update(.05)');
    await new Promise(resolve => setImmediate(resolve));
    return requests.at(-1);
  };
  return { run, pointer, frame, window, document };
}

test('mobile training fires in all eight stick directions, including left on the right half', async () => {
  for (const width of [390, 800]) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    const c = client(false, width), origin = width * .8;
    c.pointer('pointerdown', 1, origin, 350);
    c.pointer('pointermove', 1, origin + dx * 40, 350 + dy * 40);
    await c.frame();
    assert.equal(c.run('shots.length'), 1);
    const bullet = c.run('shots[0]'), length = Math.hypot(dx, dy);
    assert.ok(Math.abs(bullet.vx - dx / length * 520) < .001);
    assert.ok(Math.abs(bullet.vy - dy / length * 520) < .001);
  }
});

test('touch movement and firing keep separate owners across the screen midpoint', async () => {
  const c = client();
  c.pointer('pointerdown', 1, 100, 350);
  c.pointer('pointermove', 1, 160, 350);
  c.pointer('pointerdown', 2, 650, 350);
  c.pointer('pointermove', 2, 350, 350);
  c.pointer('pointerdown', 3, 700, 300);
  c.pointer('pointerdown', 4, 100, 300);
  c.pointer('pointerup', 3, 700, 300);
  await c.frame();
  assert.ok(c.run('player.x') > 1200);
  assert.ok(c.run('shots[0].vx') < 0);
  assert.equal(c.run('touchMove.id'), 1);
  assert.equal(c.run('touchAim.id'), 2);
  c.pointer('pointerup', 1, 160, 350);
  c.run('shots=[]; touchFireTimer=0');
  await c.frame();
  assert.ok(c.run('shots[0].vx') < 0, 'releasing movement keeps firing');
  c.pointer('pointerup', 2, 350, 350);
  c.run('shots=[]');
  await c.frame();
  assert.equal(c.run('shots.length'), 0);
});

test('a centered stick does not fire; cancellation, capture loss and blur stop firing', async () => {
  for (const stop of ['pointerup', 'pointercancel', 'lostpointercapture', 'blur', 'hidden']) {
    const c = client();
    c.pointer('pointerdown', 1, 650, 350);
    c.pointer('pointermove', 1, 647, 350);
    await c.frame();
    assert.equal(c.run('shots.length'), 0, 'touch-down and small jitter do not fire');
    c.pointer('pointermove', 1, 600, 350);
    await c.frame();
    assert.equal(c.run('shots.length'), 1);
    c.run('shots=[]; touchFireTimer=0');
    c.pointer('pointermove', 1, 650, 350);
    await c.frame();
    assert.equal(c.run('shots.length'), 0, 'returning to the center stops fire');
    c.pointer('pointermove', 1, 600, 350);
    if (stop === 'blur') c.window.dispatch('blur');
    else if (stop === 'hidden') { c.document.hidden = true; c.document.dispatch('visibilitychange'); }
    else c.pointer(stop, 1, 600, 350);
    await c.frame();
    assert.equal(c.run('shots.length'), 0);
    assert.equal(c.run('touchAim'), null);
    assert.equal(c.run('pointer.down'), false);
  }
});

test('online input uses stick direction relative to the player even at camera edges', async () => {
  for (const x of [80, 1200, 2320]) {
    const c = client(true);
    c.run(`player.x=player.targetX=${x}; updateCamera()`);
    c.pointer('pointerdown', 1, 100, 350);
    c.pointer('pointermove', 1, 150, 350);
    c.pointer('pointerdown', 2, 650, 350);
    assert.equal((await c.frame()).fire, false);
    c.pointer('pointermove', 2, 600, 350);
    let input = await c.frame();
    assert.equal(input.fire, true);
    assert.equal(input.aimX, x - 200);
    assert.equal(input.aimY, 1500);
    assert.ok(input.dx > 0, 'movement and firing are sent together');
    c.pointer('pointercancel', 2, 600, 350);
    input = await c.frame();
    assert.equal(input.fire, false, 'movement finger does not keep firing');
    assert.ok(input.dx > 0);
  }
});

test('mouse clicks still aim at the cursor in training and online play', async () => {
  for (const online of [false, true]) {
    const c = client(online);
    c.pointer('pointerdown', 1, 30, 300, 'mouse');
    if (online) {
      const input = await c.frame();
      assert.equal(input.fire, true);
      assert.equal(input.aimX, c.run('camera.x') + 30);
      c.pointer('pointerup', 1, 30, 300, 'mouse');
      assert.equal((await c.frame()).fire, false);
    } else {
      assert.equal(c.run('shots.length'), 1);
      assert.ok(c.run('shots[0].vx') < 0);
    }
  }
});
