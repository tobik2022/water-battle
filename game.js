const teams = [
  {name:'Aqua Legion', icon:'images/aqua_legion.png', accent:'#28d7ff', motto:'United by Water'},
  {name:'Tidal Titans', icon:'images/Obrázek Codex 13. 9. 2026 19_20_17.png', accent:'#38b6ff', motto:'More Than a Team'},
  {name:'Blue Rippers', icon:'images/blue_rippers_team.png', accent:'#178cff', motto:'Take the Depths'},
  {name:'Hideous Wolves', icon:'images/hideous_wolves.png', accent:'#4da8ff', motto:'Fear the Depths'},
  {name:'Storm Rid', icon:'images/storm_rid.png', accent:'#77e4ff', motto:'Ride the Storm'}
];

const teamGrid = document.querySelector('#teamGrid');
const startBtn = document.querySelector('#startBtn');
const readyMark = document.querySelector('#readyMark');
const rosterModal = document.querySelector('#playerRoster');
const rosterGrid = document.querySelector('#rosterGrid');
const rosterTitle = document.querySelector('#rosterTitle');
const rosterSubtitle = document.querySelector('#rosterSubtitle');
const mapPreview = document.querySelector('#mapPreview');
const previewMapTitle = document.querySelector('#previewMapTitle');
const previewMapMission = document.querySelector('#previewMapMission');
const previewMapCanvas = document.querySelector('#previewMapCanvas');
const previewMapCtx = previewMapCanvas.getContext('2d');
function showMapPreview(i){const m=maps[i],w=previewMapCanvas.width,h=previewMapCanvas.height;previewMapTitle.textContent=m.icon+' '+m.name;previewMapMission.textContent=m.missionText;previewMapCtx.fillStyle='#06243b';previewMapCtx.fillRect(0,0,w,h);previewMapCtx.strokeStyle='#14506a';for(let x=0;x<w;x+=32){previewMapCtx.beginPath();previewMapCtx.moveTo(x,0);previewMapCtx.lineTo(x,h);previewMapCtx.stroke()}for(let y=0;y<h;y+=32){previewMapCtx.beginPath();previewMapCtx.moveTo(0,y);previewMapCtx.lineTo(w,y);previewMapCtx.stroke()}m.obstacles.forEach(([x,y,ow,oh,type])=>{previewMapCtx.fillStyle=type==='island'?'#5c916d':type==='crate'?'#ad8050':'#6a6a68';previewMapCtx.strokeStyle='#d4dfb0';previewMapCtx.lineWidth=2;previewMapCtx.fillRect(x*w,y*h,ow*w,oh*h);previewMapCtx.strokeRect(x*w,y*h,ow*w,oh*h)});previewMapCtx.fillStyle='#28d7ff';previewMapCtx.beginPath();previewMapCtx.arc(w*.12,h*.5,12,0,Math.PI*2);previewMapCtx.fill();previewMapCtx.fillStyle='#ff547d';previewMapCtx.beginPath();previewMapCtx.arc(w*.88,h*.5,12,0,Math.PI*2);previewMapCtx.fill();mapPreview.hidden=false}
document.querySelector('#closeMapPreview').onclick=()=>mapPreview.hidden=true;mapPreview.onclick=e=>{if(e.target===mapPreview)mapPreview.hidden=true};
const mapGrid = document.querySelector('#mapGrid');
const selectedMapLabel = document.querySelector('#selectedMapLabel');
const menu = document.querySelector('#menu');
const welcome=document.querySelector('#welcome');
const welcomeImage=new Image();
welcomeImage.onload=()=>{
  const logo=document.querySelector('#welcomeLogo');
  // Show only the upper-left water emblem from the supplied reference sheet.
  logo.getContext('2d').drawImage(welcomeImage,30/1536*welcomeImage.naturalWidth,45/838*welcomeImage.naturalHeight,266/1536*welcomeImage.naturalWidth,219/838*welcomeImage.naturalHeight,0,0,532,438);
};
welcomeImage.src='images/water-battle-reference.png';
document.querySelector('#enterBtn').onclick=()=>{
  welcome.classList.remove('active');menu.classList.add('active');
  document.querySelector('#teamGrid button').focus();
};
const game = document.querySelector('#game');
const canvas = document.querySelector('#canvas');
const ctx = canvas.getContext('2d');
const teamName = document.querySelector('#teamName');
const pScoreEl = document.querySelector('#playerScore');
const eScoreEl = document.querySelector('#enemyScore');
const message = document.querySelector('#message');
const menuBtn=document.querySelector('#menuBtn'), hamburgerMenu=document.querySelector('#hamburgerMenu');
menuBtn.onclick=e=>{e.stopPropagation();const open=hamburgerMenu.hidden;hamburgerMenu.hidden=!open;menuBtn.setAttribute('aria-expanded',String(open))};
document.addEventListener('click',e=>{if(!hamburgerMenu.hidden&&!hamburgerMenu.contains(e.target)&&e.target!==menuBtn){hamburgerMenu.hidden=true;menuBtn.setAttribute('aria-expanded','false')}});
const missionText = document.querySelector('#missionText');
const killFeed=document.querySelector('#killFeed');
let audioContext=null, missionKills=0, particles=[],missionNoticeTimer=null;
const MAX_UPGRADE_LEVEL=11;
const upgrades={power:0,fireRate:0,speed:0,health:0,projectileSpeed:0,range:0,shield:0,critical:0,cooldown:0,energy:0};
const upgradeDefinitions=[
  ['power','💥','SÍLA STŘELBY','Každá úroveň přidá poškození střel.'],['fireRate','⚡','RYCHLOST STŘELBY','Každá úroveň zkrátí dobu mezi střelami.'],['speed','🏃','RYCHLEJŠÍ CHŮZE','Každá úroveň zrychlí pohyb.'],
  ['health','❤️','VÍCE ŽIVOTŮ','Každá úroveň přidá maximum životů.'],['projectileSpeed','🚀','RYCHLEJŠÍ STŘELY','Každá úroveň zrychlí let střel.'],['range','🎯','DELŠÍ DOSAH','Každá úroveň prodlouží dolet střel.'],
  ['shield','🛡️','VODNÍ ŠTÍT','Každá úroveň pohltí jeden zásah po respawnu.'],['critical','⭐','KRITICKÝ ZÁSAH','Každá úroveň zvyšuje šanci na bonusové poškození.'],['cooldown','🔄','RYCHLÝ RESPAWN','Každá úroveň zkrátí návrat do hry.'],['energy','🔋','VÍCE ENERGIE','Každá úroveň prodlouží nepřetržitou střelbu.']
];
const upgradesModal=document.querySelector('#upgradesModal');
let coins=Number(localStorage.getItem('waterBattleCoins')||0),taskKills=Number(localStorage.getItem('waterBattleTaskKills')||0),taskWins=Number(localStorage.getItem('waterBattleTaskWins')||0),taskRound=Number(localStorage.getItem('waterBattleTaskRound')||0),taskKillReward=localStorage.getItem('waterBattleTaskKillReward')==='1',taskTenKillReward=localStorage.getItem('waterBattleTaskTenKillReward')==='1',taskWinReward=localStorage.getItem('waterBattleTaskWinReward')==='1';
const coinCount=document.querySelector('#coinCount');
const coinCountLobby=document.querySelector('#coinCountLobby');
const coinIcon='<img class="coin-icon" style="width:16px;height:16px;object-fit:cover;border-radius:50%;vertical-align:middle" src="images/water_coin.png" alt="Vodní mince">';
function updateCoins(){coinCount.textContent=coins;coinCountLobby.textContent=coins;localStorage.setItem('waterBattleCoins',String(coins))}
function updateTasks(){localStorage.setItem('waterBattleTaskKills',String(taskKills));localStorage.setItem('waterBattleTaskWins',String(taskWins));if(!tasksModal.hidden)showTasks()}
function upgradeCost(level){return 10+level*10}
function showUpgrades(){updateCoins();const grid=document.querySelector('#upgradeGrid');grid.replaceChildren();upgradeDefinitions.forEach(([key,icon,name,desc])=>{const level=upgrades[key],cost=upgradeCost(level);const item=document.createElement('div');item.className='upgrade-item'+(level?' active':'');item.innerHTML=`<div class="upgrade-symbol">${icon}</div><strong>${name}</strong><small>${desc}</small><div class="upgrade-level">ÚROVEŇ ${level}/${MAX_UPGRADE_LEVEL}</div>`;const button=document.createElement('button');button.innerHTML=level>=MAX_UPGRADE_LEVEL?'MAX ÚROVEŇ':`KOUPIT · ${cost} ${coinIcon}`;button.disabled=level>=MAX_UPGRADE_LEVEL||coins<cost;button.onclick=()=>{if(upgrades[key]<MAX_UPGRADE_LEVEL&&coins>=cost){coins-=cost;upgrades[key]++;showUpgrades()}};item.append(button);grid.append(item)});upgradesModal.hidden=false}
updateCoins();
document.querySelector('#upgradesBtn').onclick=showUpgrades;document.querySelector('#closeUpgrades').onclick=()=>upgradesModal.hidden=true;upgradesModal.onclick=e=>{if(e.target===upgradesModal)upgradesModal.hidden=true};
const tasksModal=document.querySelector('#tasksModal'),tasksList=document.querySelector('#tasksList');
function claimTask(type){const goals=taskRound%2?{a:15,b:30,w:3}:{a:5,b:10,w:1};if(type==='kill5'&&!taskKillReward&&taskKills>=goals.a){coins+=25;taskKillReward=true;localStorage.setItem('waterBattleTaskKillReward','1')}if(type==='kill10'&&!taskTenKillReward&&taskKills>=goals.b){coins+=50;taskTenKillReward=true;localStorage.setItem('waterBattleTaskTenKillReward','1')}if(type==='win'&&!taskWinReward&&taskWins>=goals.w){coins+=50;taskWinReward=true;localStorage.setItem('waterBattleTaskWinReward','1')}updateCoins();showTasks()}
function resetTasks(){taskKills=0;taskWins=0;taskRound++;taskKillReward=false;taskTenKillReward=false;taskWinReward=false;localStorage.setItem('waterBattleTaskRound',String(taskRound));localStorage.removeItem('waterBattleTaskKills');localStorage.removeItem('waterBattleTaskWins');localStorage.removeItem('waterBattleTaskKillReward');localStorage.removeItem('waterBattleTaskTenKillReward');localStorage.removeItem('waterBattleTaskWinReward');showTasks()}
function taskButton(type,ready,claimed){return ready&&!claimed?`<button onclick="claimTask('${type}')">VYZVEDNOUT</button>`:claimed?'✓ VYZVEDNUTO':''}
function showTasks(){const alternate=taskRound%2===1;const goals=alternate?{a:15,b:30,w:3}:{a:5,b:10,w:1};const allClaimed=taskKillReward&&taskTenKillReward&&taskWinReward;tasksList.innerHTML=`<div class="upgrade-item active"><strong>${alternate?'💧 ELITNÍ STŘELEC':'🎯 ZABIJ 5 HRÁČŮ'}</strong><small>${alternate?'Vyřaď 15 soupeřů.':'Vyřaď soupeře v bitvách.'}</small><div class="upgrade-level">${Math.min(taskKills,goals.a)}/${goals.a} · ODMĚNA 25 💧🌊</div>${taskButton('kill5',taskKills>=goals.a,taskKillReward)}</div><div class="upgrade-item active"><strong>${alternate?'🌊 VLÁDCE ARÉNY':'🔥 ZABIJ 10 HRÁČŮ'}</strong><small>${alternate?'Vyřaď celkem 30 soupeřů.':'Staň se nejlepším střelcem.'}</small><div class="upgrade-level">${Math.min(taskKills,goals.b)}/${goals.b} · ODMĚNA 50 💧🌊</div>${taskButton('kill10',taskKills>=goals.b,taskTenKillReward)}</div><div class="upgrade-item"><strong>${alternate?'👑 ŠAMPION':'🏆 VYHRAJ BITVU'}</strong><small>${alternate?'Vyhraj tři bitvy.':'Vyhraj jeden zápas.'}</small><div class="upgrade-level">${Math.min(taskWins,goals.w)}/${goals.w} · ODMĚNA 50 💧🌊</div>${taskButton('win',taskWins>=goals.w,taskWinReward)}</div>${allClaimed?'<button onclick="resetTasks()">OBNOVIT ÚKOLY</button>':''}`;tasksModal.hidden=false}
document.querySelector('#tasksBtn').onclick=e=>{e.stopPropagation();hamburgerMenu.hidden=true;menuBtn.setAttribute('aria-expanded','false');showTasks()};document.querySelector('#closeTasks').onclick=()=>tasksModal.hidden=true;tasksModal.onclick=e=>{if(e.target===tasksModal)tasksModal.hidden=true};
function unlockAudio(){if(!audioContext)audioContext=new (window.AudioContext||window.webkitAudioContext)();if(audioContext.state==='suspended')audioContext.resume()}
function sound(type){const now=(audioContext||{}).currentTime||0,osc=audioContext.createOscillator(),gain=audioContext.createGain(),s={shoot:[260,.06,'square',.035],hit:[110,.12,'sawtooth',.06],ko:[70,.28,'triangle',.1],win:[520,.5,'sine',.08],lose:[120,.45,'sine',.06]}[type];osc.type=s[2];osc.frequency.setValueAtTime(s[0],now);osc.frequency.exponentialRampToValueAtTime(s[0]*(type==='win'?1.8:.55),now+s[1]);gain.gain.setValueAtTime(s[3],now);gain.gain.exponentialRampToValueAtTime(.001,now+s[1]);osc.connect(gain).connect(audioContext.destination);osc.start(now);osc.stop(now+s[1])}
function burst(x,y,color,count=12){for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,s=50+Math.random()*180;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.45+Math.random()*.35,color,size:2+Math.random()*4})}}
function updateMission(){const m=maps[selectedMap];missionText.textContent=missionKills>=m.goal?'MISE SPLNĚNA!':m.missionText+' · '+missionKills+'/'+m.goal;missionText.classList.toggle('complete',missionKills>=m.goal)}
function showMissionComplete(){message.textContent='MISE SPLNĚNA!';message.classList.add('complete');clearTimeout(missionNoticeTimer);missionNoticeTimer=setTimeout(()=>{message.textContent='';message.classList.remove('complete')},3000)}
function recordElimination(attacker,victim){
  const entry=document.createElement('li');
  const killer=document.createElement('span'),target=document.createElement('span');
  killer.className=attacker.side;target.className=victim.side;
  killer.textContent=attacker.name;target.textContent=victim.name;
  entry.append(killer,document.createTextNode(' vyřadil/a '),target);
  killFeed.prepend(entry);
  while(killFeed.children.length>5)killFeed.lastElementChild.remove();
}
let selectedTeam = null;
let enemyTeam = null;
function showRoster(){
  rosterGrid.replaceChildren();
  if(!selectedTeam){rosterTitle.textContent='Vyber tým';rosterSubtitle.textContent='Nejdříve vyber tým.';rosterModal.hidden=false;return}
  rosterTitle.textContent=selectedTeam.name;rosterSubtitle.textContent='Postavy tohoto týmu';
  selectedTeam.skins.forEach((skin,i)=>{const card=document.createElement('button');card.className='roster-card-item';card.classList.toggle('selected',i===selectedTeam.skinIndex);const portrait=document.createElement('canvas');portrait.width=128;portrait.height=128;portrait.getContext('2d').drawImage(skin.canvas,0,0);card.append(portrait);const name=document.createElement('strong');name.textContent=skin.name;const tag=document.createElement('small');tag.textContent=i===selectedTeam.skinIndex?'VYBRANÁ POSTAVA':'VYBRAT';card.append(name,tag);card.onclick=()=>{selectedTeam.skinIndex=i;showRoster()};rosterGrid.append(card)});rosterModal.hidden=false;
}
document.querySelector('#playersBtn').onclick=showRoster;document.querySelector('#closeRoster').onclick=()=>rosterModal.hidden=true;rosterModal.onclick=e=>{if(e.target===rosterModal)rosterModal.hidden=true};
let selectedMap = 0;
const maps = [
  {name:'Zatopený přístav', icon:'⚓', tint:'#28d7ff', obstacles:[[.30,.12,.12,.22,'pier'],[.58,.66,.12,.22,'pier'],[.30,.66,.12,.22,'pier'],[.58,.12,.12,.22,'pier'],[.46,.40,.08,.20,'island'],[.12,.24,.07,.09,'crate'],[.81,.67,.07,.09,'crate']]},
  {name:'Korálové bludiště', icon:'🪸', tint:'#ff75c3', obstacles:[[.16,.18,.10,.12,'island'],[.38,.10,.10,.25,'island'],[.62,.65,.10,.25,'island'],[.74,.28,.10,.12,'island'],[.40,.44,.20,.10,'island'],[.14,.66,.12,.10,'crate']]},
  {name:'Ledová zátoka', icon:'❄️', tint:'#b8f4ff', obstacles:[[.22,.16,.18,.10,'island'],[.60,.16,.18,.10,'island'],[.22,.74,.18,.10,'island'],[.60,.74,.18,.10,'island'],[.45,.30,.10,.40,'pier'],[.08,.43,.12,.08,'crate'],[.80,.49,.12,.08,'crate']]},
  {name:'Pirátův ostrov', icon:'☠️', tint:'#ffd166', obstacles:[[.40,.16,.20,.18,'island'],[.18,.47,.18,.12,'pier'],[.64,.47,.18,.12,'pier'],[.42,.62,.16,.16,'crate'],[.08,.18,.08,.12,'crate'],[.84,.70,.08,.12,'crate']]},
  {name:'Bouřkový průliv', icon:'⚡', tint:'#9b8cff', obstacles:[[.14,.10,.08,.30,'pier'],[.78,.60,.08,.30,'pier'],[.34,.36,.32,.08,'pier'],[.34,.56,.32,.08,'pier'],[.46,.18,.08,.14,'crate'],[.46,.68,.08,.14,'crate']]},
  {name:'Laguna', icon:'🌴', tint:'#65e6a7', obstacles:[[.12,.16,.14,.14,'island'],[.74,.16,.14,.14,'island'],[.12,.70,.14,.14,'island'],[.74,.70,.14,.14,'island'],[.40,.40,.20,.20,'island'],[.30,.12,.08,.08,'crate'],[.62,.80,.08,.08,'crate']]},
  {name:'Vodní aréna', icon:'✦', tint:'#ff6b9d', obstacles:[[.12,.12,.18,.08,'pier'],[.70,.12,.18,.08,'pier'],[.12,.80,.18,.08,'pier'],[.70,.80,.18,.08,'pier'],[.42,.30,.16,.08,'crate'],[.42,.62,.16,.08,'crate'],[.42,.44,.16,.12,'island']]},
  {name:'Rozbitá přehrada', icon:'▥', tint:'#ff9f43', obstacles:[[.28,.08,.12,.30,'pier'],[.60,.62,.12,.30,'pier'],[.28,.62,.12,.30,'pier'],[.60,.08,.12,.30,'pier'],[.44,.44,.12,.12,'crate'],[.10,.42,.12,.16,'island'],[.78,.42,.12,.16,'island']]},
  {name:'Měsíční záliv', icon:'☾', tint:'#c2a7ff', obstacles:[[.20,.22,.12,.12,'island'],[.68,.22,.12,.12,'island'],[.20,.66,.12,.12,'island'],[.68,.66,.12,.12,'island'],[.42,.18,.16,.08,'crate'],[.42,.74,.16,.08,'crate'],[.44,.40,.12,.20,'pier']]},
  {name:'Tajný kanál', icon:'〰', tint:'#54e0d0', obstacles:[[.10,.30,.26,.08,'pier'],[.64,.30,.26,.08,'pier'],[.10,.62,.26,.08,'pier'],[.64,.62,.26,.08,'pier'],[.42,.28,.16,.08,'island'],[.42,.64,.16,.08,'island'],[.08,.12,.08,.10,'crate'],[.84,.78,.08,.10,'crate']]}
];
const mapMissions=[
  ['Přístavní nájezd',3,'Získej 3 vyřazení'],['Korálový lov',4,'Získej 4 vyřazení'],['Ledová výprava',2,'Získej 2 vyřazení'],['Poklad kapitána',5,'Získej 5 vyřazení'],['Bouřková hlídka',3,'Získej 3 vyřazení bez prohry'],['Ostrovní převaha',4,'Získej 4 vyřazení'],['Arénový šampion',6,'Získej 6 vyřazení'],['Přehradní průlom',3,'Získej 3 vyřazení'],['Měsíční lovec',2,'Získej 2 vyřazení'],['Tichý průchod',5,'Získej 5 vyřazení']
];
maps.forEach((m,i)=>{m.mission=mapMissions[i][0];m.goal=mapMissions[i][1];m.missionText=mapMissions[i][2]});
maps.forEach((m,i)=>{const b=document.createElement('button');b.className='map-card';b.style.setProperty('--map-accent',m.tint);b.innerHTML=`<span class="map-icon">${m.icon}</span><strong>${m.name}</strong><small>MAPA ${String(i+1).padStart(2,'0')}</small><em>${m.mission}</em><span class="map-info" title="Ukázat mapu">?</span>`;b.onclick=()=>{selectedMap=i;selectedMapLabel.textContent=`· ${m.name}`;document.querySelectorAll('.map-card').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');updateMission()};b.querySelector('.map-info').onclick=e=>{e.stopPropagation();showMapPreview(i)};mapGrid.appendChild(b)});
mapGrid.firstElementChild.classList.add('selected');
const skinNames=[
  ['AquaKing','WaveRider','OceanShade','BlueCurrent','TideQueen'],
  ['Neptune','Marina','Riptide','Abyss','Sirena'],
  ['RipperAqua','SeaShade','DarkWave','RiptideX','NightReaper'],
  ['WolfKing','WaveHowler','DeepFang','IceCurrent','NightWolf'],
  ['StormKing','TideRider','WaveStrike','AquaBlade','StormQueen']
];
function showSkins(){
  const grid=document.querySelector('#skinGrid');grid.replaceChildren();
  document.querySelector('#skinPicker').hidden=false;
  selectedTeam.skins.forEach((skin,i)=>{
    const button=document.createElement('button');button.className='skin';
    button.classList.toggle('selected',i===selectedTeam.skinIndex);
    button.setAttribute('aria-pressed',String(i===selectedTeam.skinIndex));
    const label=document.createElement('span');label.textContent=skin.name;
    button.append(skin.canvas,label);
    button.onclick=()=>{selectedTeam.skinIndex=i;showSkins()};grid.appendChild(button);
  });
}

teams.forEach((t,i)=>{
  // Display the logo panel in the upper left of each team reference sheet.
  const crops=[[0,.035,.258,.615],[0,.032,.261,.580],[0,.035,.259,.62],[.025,.035,.245,.590],[.025,.035,.248,.590]];
  t.image=new Image();
  t.skinIndex=0;
  t.skins=skinNames[i].map(name=>{const portrait=document.createElement('canvas');portrait.width=128;portrait.height=128;portrait.setAttribute('aria-hidden','true');return {name,canvas:portrait}});
  t.logo=document.createElement('canvas');t.logo.className='icon';
  t.logo.setAttribute('aria-hidden','true');
  t.image.onload=()=>{
    const [x,y,w,h]=crops[i],sw=t.image.naturalWidth*w,sh=t.image.naturalHeight*h;
    t.logo.width=Math.round(sw);t.logo.height=Math.round(sh);
    t.logo.getContext('2d').drawImage(t.image,x*t.image.naturalWidth,y*t.image.naturalHeight,sw,sh,0,0,t.logo.width,t.logo.height);
    const top=i===1?.670:i>=3?.698:.709;
    t.skins.forEach((skin,j)=>{
      const left=(i===1?[.010,.098,.187,.276,.365]:[.010,.102,.194,.286,.379])[j];
      const width=i===1?.075:.078,height=i===1?.142:.146;
      skin.canvas.getContext('2d').drawImage(t.image,left*t.image.naturalWidth,top*t.image.naturalHeight,width*t.image.naturalWidth,height*t.image.naturalHeight,0,0,128,128);
    });
  };
  t.image.src=t.icon;
  const b=document.createElement('button');
  b.className='team'; b.style.setProperty('--accent',t.accent);
  b.innerHTML=`<strong>${t.name}</strong><small>${t.motto}</small>`;
  b.prepend(t.logo);
  b.onclick=()=>{selectedTeam=t;document.querySelectorAll('.team').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');startBtn.disabled=false;readyMark.textContent='✓';readyMark.classList.add('ready');showSkins()};
  teamGrid.appendChild(b);
});

const keys={}; let pointer={x:0,y:0,down:false}; let running=false, last=0;
let gameMode='5v5';
const modeDescription=document.querySelector('#modeDescription'), opponentLabel=document.querySelector('#opponentLabel'), opponentDetail=document.querySelector('#opponentDetail');
function setGameMode(mode){gameMode=mode;const duel=mode==='1v1';document.querySelector('#teamModeBtn').classList.toggle('selected',!duel);document.querySelector('#duelModeBtn').classList.toggle('selected',duel);document.querySelector('#teamModeBtn').setAttribute('aria-pressed',String(!duel));document.querySelector('#duelModeBtn').setAttribute('aria-pressed',String(duel));modeDescription.textContent=duel?'Vyber tým, mapu a skin. Postav se soupeři v souboji jeden proti jednomu.':'Vyber tým, mapu a skin. Připrav se do vodní bitvy 5 proti 5.';opponentLabel.textContent=duel?'Soupeř':'Červený tým';opponentDetail.textContent=duel?'1 protivník čeká':'5 protivníků čeká'}
document.querySelector('#teamModeBtn').onclick=()=>setGameMode('5v5');document.querySelector('#duelModeBtn').onclick=()=>setGameMode('1v1');
let blueTeam=[],redTeam=[];
let player, enemy, shots=[], enemyShots=[], pScore=0,eScore=0, touchMove=null, touchAim=null, touchFireTimer=0;

const world={width:2400,height:1600};
const camera={x:0,y:0};
function updateCamera(){
 if(!player)return;
 camera.x=Math.max(0,Math.min(world.width-canvas.clientWidth,player.x-canvas.clientWidth/2));
 camera.y=Math.max(0,Math.min(world.height-canvas.clientHeight,player.y-canvas.clientHeight/2));
}
const harbor = [
  [.30,.12,.12,.22,'pier'], [.58,.66,.12,.22,'pier'],
  [.30,.66,.12,.22,'pier'], [.58,.12,.12,.22,'pier'],
  [.46,.40,.08,.20,'island'],
  [.12,.24,.07,.09,'crate'], [.81,.67,.07,.09,'crate']
];
function obstacles(){return maps[selectedMap].obstacles.map(([x,y,w,h,type])=>({x:x*world.width,y:y*world.height,w:w*world.width,h:h*world.height,type}))}
function blocked(x,y,r){
  return x<r||y<r||x>world.width-r||y>world.height-r||obstacles().some(b=>Math.hypot(x-Math.max(b.x,Math.min(x,b.x+b.w)),y-Math.max(b.y,Math.min(y,b.y+b.h)))<r);
}
function moveUnit(u,dx,dy){
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/4));
  for(let i=0;i<steps;i++){
    if(!blocked(u.x+dx/steps,u.y,u.r))u.x+=dx/steps;
    if(!blocked(u.x,u.y+dy/steps,u.r))u.y+=dy/steps;
  }
}
function clearPath(a,b,r){
  const steps=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/6);
  for(let i=0;i<=steps;i++){const t=steps?i/steps:0;if(blocked(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,r))return false}
  return true;
}
function botTarget(enemy,player){
  if(clearPath(enemy,player,enemy.r))return player;
  const pad=enemy.r+6, nodes=[enemy,player];
  for(const b of obstacles())for(const x of [b.x-pad,b.x+b.w+pad])for(const y of [b.y-pad,b.y+b.h+pad])if(!blocked(x,y,enemy.r))nodes.push({x,y});
  const dist=nodes.map(()=>Infinity),prev=[],done=new Set();dist[0]=0;
  while(done.size<nodes.length){
    let u=-1;for(let i=0;i<nodes.length;i++)if(!done.has(i)&&(u<0||dist[i]<dist[u]))u=i;
    if(u<0||!Number.isFinite(dist[u]))break;if(u===1){let v=1;while(prev[v]!==0)v=prev[v];return nodes[v]}
    done.add(u);
    for(let v=0;v<nodes.length;v++)if(!done.has(v)&&clearPath(nodes[u],nodes[v],enemy.r)){
      const d=dist[u]+Math.hypot(nodes[u].x-nodes[v].x,nodes[u].y-nodes[v].y);if(d<dist[v]){dist[v]=d;prev[v]=u}
    }
  }
  return enemy;
}

function resize(){
  const r=canvas.getBoundingClientRect(), dpr=Math.min(devicePixelRatio||1,2);
  canvas.width=Math.floor(r.width*dpr); canvas.height=Math.floor(r.height*dpr); ctx.setTransform(dpr,0,0,dpr,0,0);
  updateCamera();
}
addEventListener('resize',resize);

let returnToMenuTimer=null;
function returnToTeamSelection(){
  clearTimeout(returnToMenuTimer);returnToMenuTimer=null;running=false;
  touchMove=null;touchAim=null;pointer.down=false;for(const key in keys)delete keys[key];
  message.textContent='';particles=[];game.classList.remove('active');menu.classList.add('active');
}
function start(){
  clearTimeout(returnToMenuTimer);returnToMenuTimer=null;
  menu.classList.remove('active'); game.classList.add('active'); resize();
  unlockAudio();teamName.textContent=selectedTeam.name; resetMatch(); running=true; last=performance.now(); requestAnimationFrame(loop);
}
let lastSpawns=[];
function chooseSpawn(avoid){
  const candidates=[];
  for(let x=80;x<world.width-80;x+=80)for(let y=80;y<world.height-80;y+=80){
    if(!blocked(x,y,36)&&avoid.every(p=>Math.hypot(x-p.x,y-p.y)>=p.distance))candidates.push({x,y});
  }
  return candidates[Math.floor(Math.random()*candidates.length)];
}
function resetMatch(){
  killFeed.replaceChildren();
  const w=world.width,h=world.height;
  const enemyChoices=teams.filter(t=>t!==selectedTeam);
  enemyTeam=enemyChoices[Math.floor(Math.random()*enemyChoices.length)];
  player={x:w*.22,y:h*.5,r:18,speed:260*(1+upgrades.speed*.03),maxHp:3+upgrades.health,hp:3+upgrades.health,color:'#28d7ff',side:'blue',shield:upgrades.shield};
  const bot=side=>({x:0,y:0,r:18,speed:170,hp:3,color:side==='blue'?'#28d7ff':'#ff547d',side,cool:1});
  blueTeam=[player,...Array.from({length:gameMode==='1v1'?0:4},()=>bot('blue'))];
  const availableSkins=selectedTeam.skins.map((_,i)=>i).filter(i=>i!==selectedTeam.skinIndex);
  player.skinIndex=selectedTeam.skinIndex;
  blueTeam.slice(1).forEach((u,i)=>u.skinIndex=availableSkins[i]);
  redTeam=Array.from({length:gameMode==='1v1'?1:5},()=>bot('red'));enemy=redTeam[0];
  blueTeam.forEach(u=>u.name=selectedTeam.skins[u.skinIndex].name+(u===player?' (TY)':''));
  redTeam.forEach((u,i)=>{u.skinIndex=i%enemyTeam.skins.length;u.name=enemyTeam.skins[u.skinIndex].name+' · '+enemyTeam.name+(i?' '+(i+1):'')});
  respawn();pScore=0;eScore=0;missionKills=0;particles=[];updateScore();updateMission();message.textContent='';
}
function respawn(){
  const previous=lastSpawns.map(p=>({...p,distance:320}));
  const p=chooseSpawn(previous),e=chooseSpawn([...previous,{...p,distance:800}]);
  Object.assign(player,p,{hp:player.maxHp});Object.assign(enemy,e,{hp:3,cool:1});
  lastSpawns=[p,e];shots=[];enemyShots=[];
  const placed=[];
  for(const u of [...blueTeam,...redTeam]){
    const anchor=u.side==='blue'?p:e;
    const spots=[];
    for(let x=80;x<world.width-80;x+=64)for(let y=80;y<world.height-80;y+=64)if(!blocked(x,y,36)&&placed.every(v=>Math.hypot(x-v.x,y-v.y)>55))spots.push({x,y});
    spots.sort((a,b)=>Math.hypot(a.x-anchor.x,a.y-anchor.y)-Math.hypot(b.x-anchor.x,b.y-anchor.y));
    Object.assign(u,spots[0],{hp:u===player?(player.maxHp||3):3,shield:u===player?upgrades.shield:0,cool:1+Math.random(),navCool:Math.random(),target:null,respawnTime:0});placed.push(u);
  }
  enemy.navCool=0;enemy.target=null;updateCamera();
}
function updateScore(){pScoreEl.textContent=pScore;eScoreEl.textContent=eScore}
function shoot(from,toX,toY,list,color){
  const dx=toX-from.x,dy=toY-from.y,l=Math.hypot(dx,dy)||1;
  const playerUpgrade=from===player, critical=playerUpgrade&&upgrades.critical>0&&Math.random()<upgrades.critical*.03;
  list.push({x:from.x,y:from.y,vx:dx/l*(520*(1+(playerUpgrade?upgrades.projectileSpeed*.04:0))),vy:dy/l*(520*(1+(playerUpgrade?upgrades.projectileSpeed*.04:0))),r:6,damage:(playerUpgrade?1+Math.floor(upgrades.power/3):1)+(critical?1:0),color,life:1.5*(1+(playerUpgrade?upgrades.range*.08:0)),attacker:{name:from.name,side:from.side}});if(from===player)sound('shoot');
}
function playerShoot(x,y){if(running&&player.hp>0)shoot(player,x+camera.x,y+camera.y,shots,player.color)}

addEventListener('keydown',e=>keys[e.key.toLowerCase()]=true); addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);
canvas.addEventListener('pointermove',e=>{const r=canvas.getBoundingClientRect();pointer.x=e.clientX-r.left;pointer.y=e.clientY-r.top});
canvas.addEventListener('pointerdown',e=>{const r=canvas.getBoundingClientRect(); const x=e.clientX-r.left,y=e.clientY-r.top; pointer.down=true;
  if(e.pointerType==='touch'){canvas.setPointerCapture(e.pointerId);if(x<r.width*.5)touchMove={sx:x,sy:y,x,y,id:e.pointerId};else{touchAim={x,y,id:e.pointerId};playerShoot(x,y)}} else playerShoot(x,y);
});
canvas.addEventListener('pointermove',e=>{const r=canvas.getBoundingClientRect();if(touchMove&&e.pointerId===touchMove.id){touchMove.x=e.clientX-r.left;touchMove.y=e.clientY-r.top}if(touchAim&&e.pointerId===touchAim.id){touchAim.x=e.clientX-r.left;touchAim.y=e.clientY-r.top}});
canvas.addEventListener('pointerup',e=>{if(touchMove&&e.pointerId===touchMove.id)touchMove=null;if(touchAim&&e.pointerId===touchAim.id)touchAim=null;pointer.down=false});
canvas.addEventListener('pointercancel',e=>{if(touchMove&&e.pointerId===touchMove.id)touchMove=null;if(touchAim&&e.pointerId===touchAim.id)touchAim=null;pointer.down=false});

function hit(a,b){return Math.hypot(a.x-b.x,a.y-b.y)<a.r+b.r}
function roundWin(who){
  if(who==='player')pScore++;else eScore++;updateScore();
  const scoreLimit=gameMode==='1v1'?3:20;
  if(pScore>=scoreLimit||eScore>=scoreLimit){running=false;const won=pScore>eScore;if(won){taskWins++;updateTasks()}message.textContent=won?'MODŘÍ VYHRÁLI!':'ČERVENÍ VYHRÁLI!';sound(won?'win':'lose');returnToMenuTimer=setTimeout(returnToTeamSelection,2500);}
  else if(gameMode==='1v1'){message.textContent='KOLO VYHRÁNO!';setTimeout(()=>{if(running){message.textContent='';respawn()}},700)}
}
function revive(u){
  const avoid=[...blueTeam,...redTeam].filter(v=>v.hp>0).map(v=>({...v,distance:v.side===u.side?60:300}));
  const p=chooseSpawn(avoid)||chooseSpawn([]);Object.assign(u,p,{hp:u===player?player.maxHp:3,cool:1,navCool:0,target:null});
  if(u===player){player.shield=upgrades.shield;message.textContent='';}
}

function update(dt){
  const w=world.width,h=world.height; let dx=0,dy=0;
  if(keys['w']||keys['arrowup'])dy--; if(keys['s']||keys['arrowdown'])dy++; if(keys['a']||keys['arrowleft'])dx--; if(keys['d']||keys['arrowright'])dx++;
  if(touchMove){const tx=touchMove.x-touchMove.sx,ty=touchMove.y-touchMove.sy,tl=Math.hypot(tx,ty)||1;dx+=tx/Math.max(55,tl);dy+=ty/Math.max(55,tl)}
  touchFireTimer-=dt;if(touchAim&&touchFireTimer<=0&&player.hp>0){playerShoot(touchAim.x,touchAim.y);touchFireTimer=.2/(1+upgrades.fireRate*.08)}
  const l=Math.hypot(dx,dy)||1; if(player.hp>0)moveUnit(player,dx/l*player.speed*dt,dy/l*player.speed*dt);
  player.x=Math.max(player.r,Math.min(w-player.r,player.x));player.y=Math.max(player.r,Math.min(h-player.r,player.y));

  for(const u of [...blueTeam,...redTeam]){
    if(u.hp<=0){u.respawnTime-=dt;if(u===player)message.textContent='Návrat za '+Math.max(1,Math.ceil(u.respawnTime));if(u.respawnTime<=0)revive(u);continue}
    if(u===player)continue;
    const opponents=(u.side==='blue'?redTeam:blueTeam).filter(v=>v.hp>0);
    opponents.sort((a,b)=>Math.hypot(a.x-u.x,a.y-u.y)-Math.hypot(b.x-u.x,b.y-u.y));
    const foe=opponents[0];if(!foe)continue;
    const distance=Math.hypot(foe.x-u.x,foe.y-u.y);u.navCool-=dt;
    if(u.navCool<=0||!u.target){u.target=botTarget(u,foe);u.navCool=.8+Math.random()*.3}
    if(distance>240||!clearPath(u,foe,6)){const tx=u.target.x-u.x,ty=u.target.y-u.y,len=Math.hypot(tx,ty)||1;moveUnit(u,tx/len*Math.min(u.speed*dt,len),ty/len*Math.min(u.speed*dt,len))}
    u.cool-=dt;if(u.cool<=0&&distance<700&&clearPath(u,foe,6)){shoot(u,foe.x,foe.y,u.side==='blue'?shots:enemyShots,u.color);u.cool=.9+Math.random()*.6}
  }
  for(const s of [...shots,...enemyShots]){const next={x:s.x+s.vx*dt,y:s.y+s.vy*dt};if(!clearPath(s,next,s.r))s.life=0;s.x=next.x;s.y=next.y;s.life-=dt}
  for(const [bullets,targets,side] of [[shots,redTeam,'player'],[enemyShots,blueTeam,'enemy']]){
    for(const s of bullets){if(s.life<=0)continue;const victim=targets.find(u=>u.hp>0&&hit(s,u));if(!victim)continue;
      s.life=0;if(victim===player&&player.shield>0){player.shield--;burst(victim.x,victim.y,'#65e6a7',12);sound('hit');continue}victim.hp-=s.damage||1;burst(victim.x,victim.y,victim.color,6);sound('hit');if(victim.hp<=0){victim.respawnTime=Math.max(.7,3-upgrades.cooldown*.18);recordElimination(s.attacker,victim);if(s.attacker.name===player.name){coins+=5;taskKills++;updateCoins();updateTasks();missionKills=Math.min(maps[selectedMap].goal,missionKills+1);updateMission();if(missionKills===maps[selectedMap].goal){showMissionComplete();sound('win');burst(player.x,player.y,'#ffd166',30)}}sound('ko');roundWin(side);if(!running)return}
    }
  }
  shots=shots.filter(s=>s.life>0&&s.x>-20&&s.x<w+20&&s.y>-20&&s.y<h+20); enemyShots=enemyShots.filter(s=>s.life>0&&s.x>-20&&s.x<w+20&&s.y>-20&&s.y<h+20);
  for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.95;p.vy*=.95;p.life-=dt}particles=particles.filter(p=>p.life>0);
}

function draw(){

  updateCamera();
  const w=world.width,h=world.height;ctx.clearRect(0,0,canvas.clientWidth,canvas.clientHeight);
  ctx.save();ctx.translate(-camera.x,-camera.y);
  const g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,'#071c2c');g.addColorStop(1,'#02101a');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
  ctx.strokeStyle='#0a3852';ctx.lineWidth=1;for(let x=0;x<w;x+=64){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke()}for(let y=0;y<h;y+=64){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}
  for(let i=0;i<18;i++){const x=(i*97+performance.now()*.02)%w,y=(i*53)%h;ctx.fillStyle='#0c7aa733';ctx.beginPath();ctx.arc(x,y,2+(i%3),0,Math.PI*2);ctx.fill()}
  drawHarbor(w,h);
  for(const u of blueTeam)if(u.hp>0){drawUnit(u,selectedTeam.skins[u.skinIndex].canvas,u.hp);if(u===player){ctx.fillStyle='#fff';ctx.font='bold 12px system-ui';ctx.textAlign='center';ctx.fillText('TY',u.x,u.y+36)}}
  for(const u of redTeam)if(u.hp>0)drawUnit(u,enemyTeam?.skins[u.skinIndex]?.canvas||'☠',u.hp);
  [...shots,...enemyShots].forEach(s=>{ctx.shadowBlur=16;ctx.shadowColor=s.color;ctx.fillStyle=s.color;ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0});
  for(const p of particles){ctx.globalAlpha=Math.max(0,p.life/.7);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1;
  ctx.restore();drawMinimap();
  if(touchMove||touchAim){ctx.save();if(touchMove){const dx=touchMove.x-touchMove.sx,dy=touchMove.y-touchMove.sy,l=Math.hypot(dx,dy),max=52,k=Math.min(1,max/(l||1));ctx.globalAlpha=.72;ctx.strokeStyle='#a9edff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(touchMove.sx,touchMove.sy,52,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#32dfff';ctx.beginPath();ctx.arc(touchMove.sx+dx*k,touchMove.sy+dy*k,24,0,Math.PI*2);ctx.fill()}if(touchAim){ctx.globalAlpha=.75;ctx.strokeStyle='#ff8aa8';ctx.lineWidth=2;ctx.beginPath();ctx.arc(touchAim.x,touchAim.y,22,0,Math.PI*2);ctx.moveTo(touchAim.x-30,touchAim.y);ctx.lineTo(touchAim.x+30,touchAim.y);ctx.moveTo(touchAim.x,touchAim.y-30);ctx.lineTo(touchAim.x,touchAim.y+30);ctx.stroke()}ctx.restore()}
}
function drawMinimap(){
 const mw=Math.min(160,canvas.clientWidth*.3),mh=mw*world.height/world.width;
 const x=canvas.clientWidth-mw-14,y=14,s=mw/world.width;
 ctx.save();ctx.fillStyle='#02111de6';ctx.fillRect(x-5,y-5,mw+10,mh+10);
 ctx.strokeStyle='#528392';ctx.lineWidth=1;ctx.strokeRect(x,y,mw,mh);
 for(const b of obstacles()){ctx.fillStyle=b.type==='island'?'#698964':'#aa9371';ctx.fillRect(x+b.x*s,y+b.y*s,b.w*s,b.h*s)}
 ctx.strokeStyle='#ffffff80';ctx.strokeRect(x+camera.x*s,y+camera.y*s,Math.min(canvas.clientWidth,world.width)*s,Math.min(canvas.clientHeight,world.height)*s);
 for(const u of [...blueTeam,...redTeam].filter(u=>u.hp>0)){ctx.fillStyle=u.color;ctx.beginPath();ctx.arc(x+u.x*s,y+u.y*s,3,0,Math.PI*2);ctx.fill()}
 ctx.textAlign='left';ctx.fillStyle=maps[selectedMap].tint;ctx.font='bold 12px system-ui';ctx.fillText(maps[selectedMap].name.toUpperCase(),14,26);
 ctx.font='11px system-ui';const teamSize=gameMode==='1v1'?1:5;const scoreLimit=gameMode==='1v1'?3:20;ctx.fillText('MODŘÍ '+blueTeam.filter(u=>u.hp>0).length+'/'+teamSize+' · ČERVENÍ '+redTeam.filter(u=>u.hp>0).length+'/'+teamSize+' · Cíl: '+scoreLimit+' bodů',14,44);ctx.restore();
}
function drawHarbor(w,h){
  ctx.save();
  // Subtle moving wave crests, shoreline and illuminated spawn buoys.
  ctx.strokeStyle='#43bbca22';ctx.lineWidth=2;
  for(let y=24;y<h;y+=42){ctx.beginPath();for(let x=0;x<=w;x+=8){const yy=y+Math.sin(x/45+performance.now()/1800+y)*4;if(x===0)ctx.moveTo(x,yy);else ctx.lineTo(x,yy)}ctx.stroke()}
  ctx.strokeStyle='#718983';ctx.lineWidth=10;ctx.strokeRect(0,0,w,h);
  for(const [i,p] of lastSpawns.entries()){
    const color=i===0?player.color:enemy.color;
    ctx.strokeStyle=color+'66';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,30,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle=color;ctx.font='11px system-ui';ctx.textAlign='center';ctx.fillText(i===0?'01':'02',p.x,p.y+48);
  }
  for(const b of obstacles()){
    ctx.fillStyle='#00000055';ctx.fillRect(b.x+5,b.y+7,b.w,b.h);
    ctx.fillStyle=b.type==='island'?'#526e54':b.type==='crate'?'#aa7850':'#6c6352';ctx.fillRect(b.x,b.y,b.w,b.h);
    ctx.strokeStyle=b.type==='island'?'#9bb18a':'#b5a482';ctx.lineWidth=3;ctx.strokeRect(b.x,b.y,b.w,b.h);
    if(b.type==='pier'){
      ctx.strokeStyle='#302f2a';ctx.lineWidth=2;for(let y=b.y+12;y<b.y+b.h;y+=12){ctx.beginPath();ctx.moveTo(b.x+2,y);ctx.lineTo(b.x+b.w-2,y);ctx.stroke()}
      ctx.fillStyle='#d8e5cc';for(const x of [b.x,b.x+b.w])for(const y of [b.y,b.y+b.h]){ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fill()}
    }else if(b.type==='crate'){
      ctx.strokeStyle='#e0b980';ctx.beginPath();ctx.moveTo(b.x+4,b.y+4);ctx.lineTo(b.x+b.w-4,b.y+b.h-4);ctx.moveTo(b.x+b.w-4,b.y+4);ctx.lineTo(b.x+4,b.y+b.h-4);ctx.stroke();
    }else{
      ctx.fillStyle='#adc0a1';ctx.beginPath();ctx.ellipse(b.x+b.w/2,b.y+b.h/2,b.w*.26,b.h*.22,-.2,0,Math.PI*2);ctx.fill();
    }
  }

  ctx.restore();
}
function drawUnit(u,icon,hp){
  ctx.save();ctx.translate(u.x,u.y);ctx.shadowBlur=22;ctx.shadowColor=u.color;ctx.fillStyle='#06131e';ctx.strokeStyle=u.color;ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,u.r,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.shadowBlur=0;
  if(typeof icon==='string'){
    ctx.font='20px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#fff';ctx.fillText(icon,0,1);
  }else if(icon.width&&icon.height){
    const size=(u.r-2)*2,scale=Math.min(size/icon.width,size/icon.height);
    ctx.save();ctx.beginPath();ctx.arc(0,0,u.r-2,0,Math.PI*2);ctx.clip();
    ctx.drawImage(icon,-icon.width*scale/2,-icon.height*scale/2,icon.width*scale,icon.height*scale);ctx.restore();
  }
  ctx.restore();
  ctx.fillStyle='#0b2234';ctx.fillRect(u.x-24,u.y-32,48,5);ctx.fillStyle=u.color;ctx.fillRect(u.x-24,u.y-32,48*(hp/(u.maxHp||3)),5);
}
function loop(t){if(!running)return;const dt=Math.min((t-last)/1000,.033);last=t;update(dt);draw();requestAnimationFrame(loop)}

startBtn.onclick=start;document.querySelector('#backBtn').onclick=returnToTeamSelection;
