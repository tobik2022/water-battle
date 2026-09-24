/* Online UI and rendering. Movement, damage and scores come only from the server. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const storageKey = 'waterBattleOnlineSession';
  let enabled = false, session = null, room = null, stream = null, connected = false;
  let reconnectTimer = null, busy = false, inputPending = false, sendIn = 0, shot = null;
  let latestState = null, lastEvent = 0;
  const color = side => side === 'blue' ? '#28d7ff' : '#ff547d';
  const ownMember = () => room?.players.find(p => p.id === session?.playerId);
  const isHost = () => room?.hostId === session?.playerId;
  const status = (text, error = false) => {
    $('onlineStatus').textContent = text;
    $('onlineStatus').classList.toggle('error', error);
  };
  const storeSession = value => {
    try { if (value) sessionStorage.setItem(storageKey, JSON.stringify(value)); else sessionStorage.removeItem(storageKey); } catch { /* Private browsing can disable storage. */ }
  };

  async function api(path, data, token) {
    const response = await fetch(path, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(data), signal: AbortSignal.timeout(4000),
    });
    const result = await response.json();
    if (!response.ok) { const error = new Error(result.error || 'Chyba připojení.'); error.status = response.status; throw error; }
    return result;
  }

  function setEnabled(value) {
    enabled = value;
    $('onlinePanel').hidden = !value;
    $('offlineModeBtn').classList.toggle('selected', !value);
    $('onlineModeBtn').classList.toggle('selected', value);
    $('offlineModeBtn').setAttribute('aria-pressed', String(!value));
    $('onlineModeBtn').setAttribute('aria-pressed', String(value));
    startBtn.hidden = value;
    document.querySelector('.lobby-players').hidden = value;
    document.querySelector('.lobby-status').hidden = value;
    updateSelectionVisibility();
    if (value && location.protocol === 'file:') {
      status('Online hra potřebuje backend. Spusť node server.js a otevři http://localhost:3000.', true);
      $('createRoomBtn').disabled = $('joinRoomBtn').disabled = true;
    }
  }

  function updateSelectionVisibility() {
    const inRoom = enabled && !!session;
    teamGrid.hidden = inRoom;
    $('mapPicker').hidden = inRoom;
    document.querySelector('.mode-picker').hidden = inRoom;
    $('playersBtn').disabled = inRoom;
    $('onlineConnect').hidden = !!session;
    $('onlineRoom').hidden = !session || !room;
    $('offlineModeBtn').disabled = !!session;
  }

  function renderRoom() {
    if (!room || !session) return;
    updateSelectionVisibility();
    const me = ownMember();
    $('roomCode').textContent = room.code;
    const invite = new URL(location.href); invite.hash = `room=${room.code}`;
    $('inviteLink').value = invite.href;
    $('roomMode').value = room.mode;
    $('roomMap').value = room.map;
    $('roomSide').value = me?.side || 'blue';
    const locked = room.status !== 'lobby' || busy || !connected;
    $('roomMode').disabled = $('roomMap').disabled = locked || !isHost();
    $('roomSide').disabled = $('readyBtn').disabled = locked;
    $('readyBtn').textContent = me?.ready ? 'PŘIPRAVEN ✓ · ZRUŠIT' : 'JSEM PŘIPRAVEN';
    $('readyBtn').setAttribute('aria-pressed', String(!!me?.ready));
    $('onlinePlayers').replaceChildren();
    for (const side of ['blue', 'red']) for (const member of room.players.filter(p => p.side === side)) {
      const item = document.createElement('li'); item.className = `online-player ${side}`;
      const name = document.createElement('strong');
      name.textContent = `${member.name}${member.id === session.playerId ? ' (TY)' : ''}${member.id === room.hostId ? ' · ZAKLADATEL' : ''}`;
      const detail = document.createElement('small');
      detail.textContent = `${side === 'blue' ? 'Modří' : 'Červení'} · ${teams[member.teamIndex].skins[member.skinIndex].name}`;
      const state = document.createElement('span');
      state.textContent = !member.connected ? 'Obnovuje spojení…' : member.ready ? 'Připraven ✓' : 'Vybírá…';
      item.append(name, detail, state); $('onlinePlayers').append(item);
    }
    const blue = room.players.filter(p => p.side === 'blue').length;
    const red = room.players.length - blue;
    const balanced = blue > 0 && red > 0 && Math.abs(blue - red) <= 1;
    const allReady = room.players.every(p => p.ready && p.connected);
    $('startOnlineBtn').hidden = !isHost();
    $('startOnlineBtn').disabled = locked || !balanced || !allReady;
    $('roomHint').textContent = room.notice || `${room.players.length}/${room.capacity} hráčů · ${maps[room.map].name}. ` +
      (!balanced ? 'Pozvi soupeře a vyrovnej týmy.' : !allReady ? 'Každý hráč musí potvrdit připravenost.' : isHost() ? 'Všichni jsou připraveni. Spusť bitvu.' : 'Čekáme, až zakladatel spustí bitvu.');
    $('rematchBtn').hidden = !isHost();
    $('rematchBtn').disabled = busy || !connected;
  }

  function stopOnlineGame() {
    onlineFrame = null; onlineShoot = null; latestState = null; shot = null;
    $('onlineResult').hidden = true; $('networkBanner').hidden = true;
    game.classList.remove('is-online');
    returnToTeamSelection();
    setGameMode(gameMode);
    mapGrid.children[selectedMap].click();
  }

  function exitRoom(notice = 'Místnost jsi opustil.') {
    clearTimeout(reconnectTimer); reconnectTimer = null;
    stream?.close(); stream = null;
    session = null; room = null; connected = false; storeSession(null);
    stopOnlineGame(); updateSelectionVisibility(); status(notice);
    setGameMode(gameMode);
  }

  function leave() {
    const token = session?.token;
    if (token) api('/api/command', { action: 'leave' }, token).catch(() => {});
    exitRoom();
  }

  function openStream() {
    stream?.close();
    const owner = session;
    const source = new EventSource(`/api/events?token=${encodeURIComponent(owner.token)}`);
    stream = source;
    source.onopen = () => {
      if (session !== owner) return;
      connected = true; clearTimeout(reconnectTimer); reconnectTimer = null;
      $('networkBanner').hidden = true; status('Připojeno k serveru.'); renderRoom();
    };
    source.onmessage = event => {
      if (session !== owner) return;
      const data = JSON.parse(event.data);
      if (data.type === 'replaced') { exitRoom('Tato relace byla otevřena v jiné kartě. Pro dalšího hráče se připoj znovu.'); return; }
      if (data.type === 'expired') { exitRoom('Místnost po nečinnosti vypršela. Založ novou.'); return; }
      if (data.type === 'room') {
        room = data.room;
        if (room.status === 'lobby' && onlineFrame) stopOnlineGame();
        renderRoom();
      }
      if (data.type === 'state') receiveState(data.state);
    };
    source.onerror = () => {
      if (session !== owner) return;
      connected = false; clearControls(); shot = null;
      status('Spojení přerušeno. Zkouším znovu…', true);
      $('networkBanner').textContent = 'Obnovuji spojení…'; $('networkBanner').hidden = !onlineFrame;
      renderRoom();
      if (!reconnectTimer) reconnectTimer = setTimeout(() => {
        if (session === owner) exitRoom('Spojení vypršelo. Připoj se znovu pomocí kódu místnosti.');
      }, 17000);
    };
  }

  async function connect(create) {
    if (busy || session) return;
    if (!selectedTeam) { status('Nejprve vyber tým a postavu dole pod připojením.', true); teamGrid.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    const name = $('onlineName').value.trim();
    if (!name) { status('Napiš svoji přezdívku.', true); $('onlineName').focus(); return; }
    const code = $('roomCodeInput').value.trim().toUpperCase();
    if (!create && !/^[A-F0-9]{6}$/.test(code)) { status('Kód místnosti má 6 znaků. Zkontroluj jej.', true); return; }
    busy = true; $('createRoomBtn').disabled = $('joinRoomBtn').disabled = true;
    status('Připojuji…'); unlockAudio();
    try {
      const result = await api(create ? '/api/rooms' : '/api/join', {
        name, code, map: selectedMap, mode: gameMode, teamIndex: teams.indexOf(selectedTeam), skinIndex: selectedTeam.skinIndex,
      });
      session = { token: result.token, playerId: result.playerId }; room = result.room;
      storeSession(session); openStream(); renderRoom();
    } catch (error) { status(error.status ? error.message : 'Backend není dostupný. Spusť node server.js a otevři adresu serveru.', true); }
    finally { busy = false; $('createRoomBtn').disabled = $('joinRoomBtn').disabled = false; renderRoom(); }
  }

  async function command(action, data = {}) {
    if (!session || busy) return;
    busy = true; renderRoom();
    const owner = session;
    try { await api('/api/command', { action, ...data }, owner.token); }
    catch (error) {
      if (session !== owner) return;
      if (error.status === 401) exitRoom(error.message);
      else status(error.status ? error.message : 'Požadavek se nepodařilo odeslat. Zkus to znovu.', true);
    } finally { busy = false; renderRoom(); }
  }

  function receiveState(state) {
    if (!session || !room || room.status === 'lobby') return;
    const starting = !onlineFrame;
    if (starting) {
      clearTimeout(returnToMenuTimer); clearTimeout(missionNoticeTimer);
      message.classList.remove('complete'); clearControls();
      blueTeam = []; redTeam = []; shots = []; enemyShots = []; particles = []; lastSpawns = [];
      lastEvent = 0; sendIn = 0;
      selectedMap = state.map; gameMode = state.mode;
      onlineFrame = frame; onlineShoot = (x, y) => { if (connected) shot = { x: x + camera.x, y: y + camera.y }; };
      welcome.classList.remove('active'); menu.classList.remove('active'); game.classList.add('active', 'is-online');
      $('onlineResult').hidden = true;
    }
    const oldUnits = new Map([...blueTeam, ...redTeam].map(u => [u.id, u]));
    const units = state.players.map(data => {
      const old = oldUnits.get(data.id);
      const smooth = old && old.hp > 0 && data.hp > 0 && Math.hypot(old.x - data.x, old.y - data.y) < 120;
      return { ...data, x: smooth ? old.x : data.x, y: smooth ? old.y : data.y,
        targetX: data.x, targetY: data.y, color: color(data.side) };
    });
    blueTeam = units.filter(u => u.side === 'blue'); redTeam = units.filter(u => u.side === 'red');
    player = units.find(u => u.id === session.playerId);
    if (!player) { exitRoom('Už nejsi v této bitvě. Připoj se znovu.'); return; }
    enemy = units.find(u => u.side !== player.side);
    shots = state.bullets.filter(b => b.side === 'blue').map(b => ({ ...b, color: color(b.side) }));
    enemyShots = state.bullets.filter(b => b.side === 'red').map(b => ({ ...b, color: color(b.side) }));
    pScore = state.score.blue; eScore = state.score.red; updateScore();
    teamName.textContent = player.side === 'blue' ? 'MODŘÍ · ONLINE' : 'ČERVENÍ · ONLINE';
    missionText.classList.remove('complete'); missionText.textContent = `Tvoje vyřazení: ${player.kills} · Cíl týmu: ${state.limit}`;
    for (const event of state.events) if (event.id > lastEvent) {
      lastEvent = event.id;
      if (audioContext) sound('ko');
    }
    if (state.winner) {
      message.textContent = '';
      $('onlineResult').hidden = false;
      $('onlineResultText').textContent = `${state.winner === player.side ? 'VÍTĚZSTVÍ!' : 'TENTOKRÁT PROHRA'} · ${pScore} : ${eScore}`;
      if (!latestState?.winner && audioContext) sound(state.winner === player.side ? 'win' : 'lose');
      renderRoom();
    } else message.textContent = player.hp <= 0 ? `Návrat za ${Math.max(1, Math.ceil(player.respawnTime))}` : '';
    latestState = state;
    if (starting) { resize(); running = true; startGameLoop(); }
  }

  function frame(dt) {
    for (const unit of [...blueTeam, ...redTeam]) {
      const blend = Math.min(1, dt * 30);
      unit.x += (unit.targetX - unit.x) * blend; unit.y += (unit.targetY - unit.y) * blend;
    }
    sendIn -= dt;
    if (!session || !connected || latestState?.winner || inputPending || sendIn > 0) return;
    sendIn = 0.05;
    let dx = Number(!!(keys.d || keys.arrowright)) - Number(!!(keys.a || keys.arrowleft));
    let dy = Number(!!(keys.s || keys.arrowdown)) - Number(!!(keys.w || keys.arrowup));
    if (touchMove) {
      const tx = touchMove.x - touchMove.sx, ty = touchMove.y - touchMove.sy, length = Math.max(55, Math.hypot(tx, ty));
      dx += tx / length; dy += ty / length;
    }
    const touchTarget = touchAimTarget();
    const aim = shot || { x: (touchTarget?.x ?? pointer.x) + camera.x, y: (touchTarget?.y ?? pointer.y) + camera.y };
    const fire = !!shot || !!touchTarget || pointer.down;
    shot = null;
    const owner = session;
    inputPending = true;
    api('/api/command', { action: 'input', dx, dy, aimX: aim.x, aimY: aim.y, fire }, owner.token)
      .catch(error => {
        if (session === owner && error.status === 401) exitRoom(error.message);
      }).finally(() => { inputPending = false; });
  }

  maps.forEach((map, index) => { const option = document.createElement('option'); option.value = index; option.textContent = map.name; $('roomMap').append(option); });
  $('offlineModeBtn').onclick = () => { if (!session) setEnabled(false); };
  $('onlineModeBtn').onclick = () => setEnabled(true);
  $('createRoomBtn').onclick = () => connect(true);
  $('joinRoomBtn').onclick = () => connect(false);
  $('roomCodeInput').onkeydown = event => { if (event.key === 'Enter') connect(false); };
  $('readyBtn').onclick = () => { unlockAudio(); command('ready', { ready: !ownMember()?.ready }); };
  $('startOnlineBtn').onclick = () => command('start');
  $('roomSide').onchange = () => command('side', { side: $('roomSide').value });
  const settings = () => command('settings', { mode: $('roomMode').value, map: Number($('roomMap').value) });
  $('roomMode').onchange = $('roomMap').onchange = settings;
  $('leaveRoomBtn').onclick = $('resultLeaveBtn').onclick = leave;
  $('rematchBtn').onclick = () => command('rematch');
  $('backBtn').onclick = () => session ? leave() : returnToTeamSelection();
  $('copyInviteBtn').onclick = async () => {
    try { await navigator.clipboard.writeText($('inviteLink').value); status('Pozvánka zkopírována. Pošli ji přátelům.'); }
    catch { $('inviteLink').focus(); $('inviteLink').select(); status('Zkopíruj označený odkaz nebo pošli kód místnosti.'); }
  };
  // pagehide releases the stream; the server reserves the player for 15 seconds.
  addEventListener('pagehide', () => { clearControls(); stream?.close(); });
  addEventListener('pageshow', event => { if (event.persisted && session) openStream(); });
  const inviteCode = new URLSearchParams(location.hash.slice(1)).get('room');
  if (inviteCode && /^[A-F0-9]{6}$/i.test(inviteCode)) { $('roomCodeInput').value = inviteCode.toUpperCase(); setEnabled(true); }
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey));
    if (saved?.token && saved?.playerId && location.protocol !== 'file:') {
      session = saved; setEnabled(true); welcome.classList.remove('active'); menu.classList.add('active');
      status('Obnovuji připojení k místnosti…'); openStream();
    }
  } catch { storeSession(null); }
})();
