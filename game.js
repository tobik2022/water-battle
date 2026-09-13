const teams = [
  {name:'Aqua Legion', icon:'images/aqua_legion.png', accent:'#28d7ff', motto:'United by Water'},
  {name:'Tidal Titans', icon:'images/Obrázek Codex 13. 9. 2026 19_20_17.png', accent:'#38b6ff', motto:'More Than a Team'},
  {name:'Blue Rippers', icon:'images/blue_rippers_team.png', accent:'#178cff', motto:'Take the Depths'},
  {name:'Hideous Wolves', icon:'images/hideous_wolves.png', accent:'#4da8ff', motto:'Fear the Depths'},
  {name:'Storm Rid', icon:'images/storm_rid.png', accent:'#77e4ff', motto:'Ride the Storm'}
];

const teamGrid = document.querySelector('#teamGrid');
const startBtn = document.querySelector('#startBtn');
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
const killFeed=document.querySelector('#killFeed');
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
  const crops=[[0,.035,.258,.615],[0,.032,.261,.580],[0,.035,.259,.62],[0,.012,.273,.635],[0,.012,.276,.637]];
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
  b.onclick=()=>{selectedTeam=t;document.querySelectorAll('.team').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');startBtn.disabled=false;showSkins()};
  teamGrid.appendChild(b);
});

const keys={}; let pointer={x:0,y:0,down:false}; let running=false, last=0;
let blueTeam=[],redTeam=[];
let player, enemy, shots=[], enemyShots=[], pScore=0,eScore=0, touchMove=null;

const world={width:2400,height:1600};
const camera={x:0,y:0};
function updateCamera(){
 if(!player)return;
 camera.x=Math.max(0,Math.min(world.width-canvas.clientWidth,player.x-canvas.clientWidth/2));
 camera.y=Math.max(0,Math.min(world.height-canvas.clientHeight,player.y-canvas.clientHeight/2));
}
// Fixed world geometry.
const harbor = [
  [.30,.12,.12,.22,'pier'], [.58,.66,.12,.22,'pier'],
  [.30,.66,.12,.22,'pier'], [.58,.12,.12,.22,'pier'],
  [.46,.40,.08,.20,'island'],
  [.12,.24,.07,.09,'crate'], [.81,.67,.07,.09,'crate']
];
const mapObstacles=harbor.map(([x,y,w,h,type])=>({x:x*world.width,y:y*world.height,w:w*world.width,h:h*world.height,type}));
function obstacles(){return mapObstacles}
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
  touchMove=null;pointer.down=false;for(const key in keys)delete keys[key];
  message.textContent='';game.classList.remove('active');menu.classList.add('active');
}
function start(){
  clearTimeout(returnToMenuTimer);returnToMenuTimer=null;
  menu.classList.remove('active'); game.classList.add('active'); resize();
  teamName.textContent=selectedTeam.name; resetMatch(); running=true; last=performance.now(); requestAnimationFrame(loop);
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
  player={x:w*.22,y:h*.5,r:18,speed:260,hp:3,color:'#28d7ff',side:'blue'};
  const bot=side=>({x:0,y:0,r:18,speed:170,hp:3,color:side==='blue'?'#28d7ff':'#ff547d',side,cool:1});
  blueTeam=[player,...Array.from({length:4},()=>bot('blue'))];
  const availableSkins=selectedTeam.skins.map((_,i)=>i).filter(i=>i!==selectedTeam.skinIndex);
  player.skinIndex=selectedTeam.skinIndex;
  blueTeam.slice(1).forEach((u,i)=>u.skinIndex=availableSkins[i]);
  redTeam=Array.from({length:5},()=>bot('red'));enemy=redTeam[0];
  blueTeam.forEach(u=>u.name=selectedTeam.skins[u.skinIndex].name+(u===player?' (TY)':''));
  redTeam.forEach((u,i)=>u.name='Červený '+(i+1));
  respawn();pScore=0;eScore=0;updateScore();message.textContent='';
}
function respawn(){
  const previous=lastSpawns.map(p=>({...p,distance:320}));
  const p=chooseSpawn(previous),e=chooseSpawn([...previous,{...p,distance:800}]);
  Object.assign(player,p,{hp:3});Object.assign(enemy,e,{hp:3,cool:1});
  lastSpawns=[p,e];shots=[];enemyShots=[];
  const placed=[];
  for(const u of [...blueTeam,...redTeam]){
    const anchor=u.side==='blue'?p:e;
    const spots=[];
    for(let x=80;x<world.width-80;x+=64)for(let y=80;y<world.height-80;y+=64)if(!blocked(x,y,36)&&placed.every(v=>Math.hypot(x-v.x,y-v.y)>55))spots.push({x,y});
    spots.sort((a,b)=>Math.hypot(a.x-anchor.x,a.y-anchor.y)-Math.hypot(b.x-anchor.x,b.y-anchor.y));
    Object.assign(u,spots[0],{hp:3,cool:1+Math.random(),navCool:Math.random(),target:null,respawnTime:0});placed.push(u);
  }
  enemy.navCool=0;enemy.target=null;updateCamera();
}
function updateScore(){pScoreEl.textContent=pScore;eScoreEl.textContent=eScore}
function shoot(from,toX,toY,list,color){
  const dx=toX-from.x,dy=toY-from.y,l=Math.hypot(dx,dy)||1;
  list.push({x:from.x,y:from.y,vx:dx/l*520,vy:dy/l*520,r:6,color,life:1.5,attacker:{name:from.name,side:from.side}});
}
function playerShoot(x,y){if(running&&player.hp>0)shoot(player,x+camera.x,y+camera.y,shots,player.color)}

addEventListener('keydown',e=>keys[e.key.toLowerCase()]=true); addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);
canvas.addEventListener('pointermove',e=>{const r=canvas.getBoundingClientRect();pointer.x=e.clientX-r.left;pointer.y=e.clientY-r.top});
canvas.addEventListener('pointerdown',e=>{const r=canvas.getBoundingClientRect(); const x=e.clientX-r.left,y=e.clientY-r.top; pointer.down=true;
  if(e.pointerType==='touch' && x<r.width*.5){touchMove={sx:x,sy:y,x,y,id:e.pointerId};canvas.setPointerCapture(e.pointerId)} else playerShoot(x,y);
});
canvas.addEventListener('pointermove',e=>{if(touchMove&&e.pointerId===touchMove.id){const r=canvas.getBoundingClientRect();touchMove.x=e.clientX-r.left;touchMove.y=e.clientY-r.top}});
canvas.addEventListener('pointerup',e=>{if(touchMove&&e.pointerId===touchMove.id)touchMove=null;pointer.down=false});

function hit(a,b){return Math.hypot(a.x-b.x,a.y-b.y)<a.r+b.r}
function roundWin(who){
  if(who==='player')pScore++;else eScore++;updateScore();
  if(pScore>=20||eScore>=20){running=false;message.textContent=pScore>eScore?'MODŘÍ VYHRÁLI!':'ČERVENÍ VYHRÁLI!';returnToMenuTimer=setTimeout(returnToTeamSelection,2500);}
}
function revive(u){
  const avoid=[...blueTeam,...redTeam].filter(v=>v.hp>0).map(v=>({...v,distance:v.side===u.side?60:300}));
  const p=chooseSpawn(avoid)||chooseSpawn([]);Object.assign(u,p,{hp:3,cool:1,navCool:0,target:null});
  if(u===player)message.textContent='';
}

function update(dt){
  const w=world.width,h=world.height; let dx=0,dy=0;
  if(keys['w']||keys['arrowup'])dy--; if(keys['s']||keys['arrowdown'])dy++; if(keys['a']||keys['arrowleft'])dx--; if(keys['d']||keys['arrowright'])dx++;
  if(touchMove){dx+=(touchMove.x-touchMove.sx)/45;dy+=(touchMove.y-touchMove.sy)/45}
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
      s.life=0;victim.hp--;if(victim.hp<=0){victim.respawnTime=3;recordElimination(s.attacker,victim);roundWin(side);if(!running)return}
    }
  }
  shots=shots.filter(s=>s.life>0&&s.x>-20&&s.x<w+20&&s.y>-20&&s.y<h+20); enemyShots=enemyShots.filter(s=>s.life>0&&s.x>-20&&s.x<w+20&&s.y>-20&&s.y<h+20);
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
  for(const u of redTeam)if(u.hp>0)drawUnit(u,'☠',u.hp);
  [...shots,...enemyShots].forEach(s=>{ctx.shadowBlur=16;ctx.shadowColor=s.color;ctx.fillStyle=s.color;ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0});
  ctx.restore();drawMinimap();
}
function drawMinimap(){
 const mw=Math.min(160,canvas.clientWidth*.3),mh=mw*world.height/world.width;
 const x=canvas.clientWidth-mw-14,y=14,s=mw/world.width;
 ctx.save();ctx.fillStyle='#02111de6';ctx.fillRect(x-5,y-5,mw+10,mh+10);
 ctx.strokeStyle='#528392';ctx.lineWidth=1;ctx.strokeRect(x,y,mw,mh);
 for(const b of obstacles()){ctx.fillStyle=b.type==='island'?'#698964':'#aa9371';ctx.fillRect(x+b.x*s,y+b.y*s,b.w*s,b.h*s)}
 ctx.strokeStyle='#ffffff80';ctx.strokeRect(x+camera.x*s,y+camera.y*s,Math.min(canvas.clientWidth,world.width)*s,Math.min(canvas.clientHeight,world.height)*s);
 for(const u of [...blueTeam,...redTeam].filter(u=>u.hp>0)){ctx.fillStyle=u.color;ctx.beginPath();ctx.arc(x+u.x*s,y+u.y*s,3,0,Math.PI*2);ctx.fill()}
 ctx.textAlign='left';ctx.fillStyle='#c0e3e5';ctx.font='bold 12px system-ui';ctx.fillText('ZATOPENÝ PŘÍSTAV',14,26);
 ctx.font='11px system-ui';ctx.fillText('MODŘÍ '+blueTeam.filter(u=>u.hp>0).length+'/5 · ČERVENÍ '+redTeam.filter(u=>u.hp>0).length+'/5 · Cíl: 20 bodů',14,44);ctx.restore();
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
  ctx.fillStyle='#0b2234';ctx.fillRect(u.x-24,u.y-32,48,5);ctx.fillStyle=u.color;ctx.fillRect(u.x-24,u.y-32,48*(hp/3),5);
}
function loop(t){if(!running)return;const dt=Math.min((t-last)/1000,.033);last=t;update(dt);draw();requestAnimationFrame(loop)}

startBtn.onclick=start;document.querySelector('#backBtn').onclick=returnToTeamSelection;
