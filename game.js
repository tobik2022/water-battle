const teams = [
  {name:'Aqua Legion', icon:'🌊', accent:'#28d7ff', motto:'United by Water'},
  {name:'Tidal Titans', icon:'🔱', accent:'#38b6ff', motto:'More Than a Team'},
  {name:'Blue Rippers', icon:'💀', accent:'#178cff', motto:'Take the Depths'},
  {name:'Hideous Wolves', icon:'🐺', accent:'#4da8ff', motto:'Fear the Depths'},
  {name:'Storm Rid', icon:'🌀', accent:'#77e4ff', motto:'Ride the Storm'}
];

const teamGrid = document.querySelector('#teamGrid');
const startBtn = document.querySelector('#startBtn');
const menu = document.querySelector('#menu');
const game = document.querySelector('#game');
const canvas = document.querySelector('#canvas');
const ctx = canvas.getContext('2d');
const teamName = document.querySelector('#teamName');
const pScoreEl = document.querySelector('#playerScore');
const eScoreEl = document.querySelector('#enemyScore');
const message = document.querySelector('#message');
let selectedTeam = null;

teams.forEach((t,i)=>{
  const b=document.createElement('button');
  b.className='team'; b.style.setProperty('--accent',t.accent);
  b.innerHTML=`<span class="icon">${t.icon}</span><strong>${t.name}</strong><small>${t.motto}</small>`;
  b.onclick=()=>{selectedTeam=t;document.querySelectorAll('.team').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');startBtn.disabled=false};
  teamGrid.appendChild(b);
});

const keys={}; let pointer={x:0,y:0,down:false}; let running=false, last=0;
let player, enemy, shots=[], enemyShots=[], pScore=0,eScore=0, touchMove=null;

// Normalized map geometry keeps the same routes on desktop and mobile.
const harbor = [
  [.30,.12,.12,.22,'pier'], [.58,.66,.12,.22,'pier'],
  [.30,.66,.12,.22,'pier'], [.58,.12,.12,.22,'pier'],
  [.46,.40,.08,.20,'island'],
  [.12,.24,.07,.09,'crate'], [.81,.67,.07,.09,'crate']
];
function obstacles(){return harbor.map(([x,y,w,h,type])=>({x:x*canvas.clientWidth,y:y*canvas.clientHeight,w:w*canvas.clientWidth,h:h*canvas.clientHeight,type}))}
function blocked(x,y,r){
  return x<r||y<r||x>canvas.clientWidth-r||y>canvas.clientHeight-r||obstacles().some(b=>Math.hypot(x-Math.max(b.x,Math.min(x,b.x+b.w)),y-Math.max(b.y,Math.min(y,b.y+b.h)))<r);
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
function botTarget(){
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
  if(player&&canvas.clientWidth&&canvas.clientHeight)respawn();
}
addEventListener('resize',resize);

function start(){
  menu.classList.remove('active'); game.classList.add('active'); resize();
  teamName.textContent=selectedTeam.name; resetMatch(); running=true; last=performance.now(); requestAnimationFrame(loop);
}
function resetMatch(){
  const w=canvas.clientWidth,h=canvas.clientHeight;
  player={x:w*.22,y:h*.5,r:18,speed:260,hp:3,color:selectedTeam.accent};
  enemy={x:w*.78,y:h*.5,r:18,speed:160,hp:3,color:'#ff547d',cool:0};
  shots=[];enemyShots=[];pScore=0;eScore=0;updateScore();message.textContent='';
}
function respawn(){
  const w=canvas.clientWidth,h=canvas.clientHeight;
  player.x=w*.22;player.y=h*.5;player.hp=3; enemy.x=w*.78;enemy.y=h*.5;enemy.hp=3;shots=[];enemyShots=[];
  enemy.navCool=0;enemy.target=null;
}
function updateScore(){pScoreEl.textContent=pScore;eScoreEl.textContent=eScore}
function shoot(from,toX,toY,list,color){
  const dx=toX-from.x,dy=toY-from.y,l=Math.hypot(dx,dy)||1;
  list.push({x:from.x,y:from.y,vx:dx/l*520,vy:dy/l*520,r:6,color,life:1.5});
}
function playerShoot(x,y){if(running)shoot(player,x,y,shots,selectedTeam.accent)}

addEventListener('keydown',e=>keys[e.key.toLowerCase()]=true); addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);
canvas.addEventListener('pointermove',e=>{const r=canvas.getBoundingClientRect();pointer.x=e.clientX-r.left;pointer.y=e.clientY-r.top});
canvas.addEventListener('pointerdown',e=>{const r=canvas.getBoundingClientRect(); const x=e.clientX-r.left,y=e.clientY-r.top; pointer.down=true;
  if(e.pointerType==='touch' && x<r.width*.5){touchMove={sx:x,sy:y,x,y,id:e.pointerId};canvas.setPointerCapture(e.pointerId)} else playerShoot(x,y);
});
canvas.addEventListener('pointermove',e=>{if(touchMove&&e.pointerId===touchMove.id){const r=canvas.getBoundingClientRect();touchMove.x=e.clientX-r.left;touchMove.y=e.clientY-r.top}});
canvas.addEventListener('pointerup',e=>{if(touchMove&&e.pointerId===touchMove.id)touchMove=null;pointer.down=false});

function hit(a,b){return Math.hypot(a.x-b.x,a.y-b.y)<a.r+b.r}
function roundWin(who){
  if(who==='player')pScore++; else eScore++; updateScore();
  if(pScore>=5||eScore>=5){running=false;message.textContent=pScore>eScore?'VÍTĚZSTVÍ!':'PROHRA';setTimeout(()=>{running=true;resetMatch();last=performance.now();requestAnimationFrame(loop)},1800)} else respawn();
}

function update(dt){
  const w=canvas.clientWidth,h=canvas.clientHeight; let dx=0,dy=0;
  if(keys['w']||keys['arrowup'])dy--; if(keys['s']||keys['arrowdown'])dy++; if(keys['a']||keys['arrowleft'])dx--; if(keys['d']||keys['arrowright'])dx++;
  if(touchMove){dx+=(touchMove.x-touchMove.sx)/45;dy+=(touchMove.y-touchMove.sy)/45}
  const l=Math.hypot(dx,dy)||1; moveUnit(player,dx/l*player.speed*dt,dy/l*player.speed*dt);
  player.x=Math.max(player.r,Math.min(w-player.r,player.x));player.y=Math.max(player.r,Math.min(h-player.r,player.y));

  const edx=player.x-enemy.x, edy=player.y-enemy.y, el=Math.hypot(edx,edy)||1;
  enemy.navCool=(enemy.navCool||0)-dt;
  if(enemy.navCool<=0){enemy.target=botTarget();enemy.navCool=.3}
  if(el>220||!clearPath(enemy,player,6)){const target=enemy.target||player,tx=target.x-enemy.x,ty=target.y-enemy.y,tl=Math.hypot(tx,ty)||1;moveUnit(enemy,tx/tl*Math.min(enemy.speed*dt,tl),ty/tl*Math.min(enemy.speed*dt,tl))}
  enemy.cool-=dt;if(enemy.cool<=0&&clearPath(enemy,player,6)){shoot(enemy,player.x,player.y,enemyShots,'#ff547d');enemy.cool=.85+Math.random()*.45}

  for(const s of [...shots,...enemyShots]){const next={x:s.x+s.vx*dt,y:s.y+s.vy*dt};if(!clearPath(s,next,s.r))s.life=0;s.x=next.x;s.y=next.y;s.life-=dt}
  for(const s of shots){if(s.life>0&&hit(s,enemy)){s.life=0;enemy.hp--;if(enemy.hp<=0){roundWin('player');return}}}
  for(const s of enemyShots){if(s.life>0&&hit(s,player)){s.life=0;player.hp--;if(player.hp<=0){roundWin('enemy');return}}}
  shots=shots.filter(s=>s.life>0&&s.x>-20&&s.x<w+20&&s.y>-20&&s.y<h+20); enemyShots=enemyShots.filter(s=>s.life>0&&s.x>-20&&s.x<w+20&&s.y>-20&&s.y<h+20);
}

function draw(){
  const w=canvas.clientWidth,h=canvas.clientHeight;ctx.clearRect(0,0,w,h);
  const g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,'#071c2c');g.addColorStop(1,'#02101a');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
  ctx.strokeStyle='#0a3852';ctx.lineWidth=1;for(let x=0;x<w;x+=64){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke()}for(let y=0;y<h;y+=64){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}
  for(let i=0;i<18;i++){const x=(i*97+performance.now()*.02)%w,y=(i*53)%h;ctx.fillStyle='#0c7aa733';ctx.beginPath();ctx.arc(x,y,2+(i%3),0,Math.PI*2);ctx.fill()}
  drawHarbor(w,h);
  drawUnit(player,selectedTeam.icon,player.hp);drawUnit(enemy,'☠',enemy.hp);
  [...shots,...enemyShots].forEach(s=>{ctx.shadowBlur=16;ctx.shadowColor=s.color;ctx.fillStyle=s.color;ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0});
}
function drawHarbor(w,h){
  ctx.save();
  // Subtle moving wave crests, shoreline and illuminated spawn buoys.
  ctx.strokeStyle='#43bbca22';ctx.lineWidth=2;
  for(let y=24;y<h;y+=42){ctx.beginPath();for(let x=0;x<=w;x+=8){const yy=y+Math.sin(x/45+performance.now()/1800+y)*4;if(x===0)ctx.moveTo(x,yy);else ctx.lineTo(x,yy)}ctx.stroke()}
  ctx.strokeStyle='#718983';ctx.lineWidth=10;ctx.strokeRect(0,0,w,h);
  for(const [x,color,label] of [[.22,'#28d7ff','01'],[.78,'#ff547d','02']]){
    ctx.strokeStyle=color+'66';ctx.lineWidth=2;ctx.beginPath();ctx.arc(w*x,h*.5,30,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle=color;ctx.font='11px system-ui';ctx.textAlign='center';ctx.fillText(label,w*x,h*.5+48);
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
  ctx.textAlign='left';ctx.fillStyle='#c0e3e5';ctx.font='bold 12px system-ui';ctx.fillText('ZATOPENÝ PŘÍSTAV',18,26);
  ctx.restore();
}
function drawUnit(u,icon,hp){
  ctx.save();ctx.translate(u.x,u.y);ctx.shadowBlur=22;ctx.shadowColor=u.color;ctx.fillStyle='#06131e';ctx.strokeStyle=u.color;ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,u.r,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.shadowBlur=0;ctx.font='20px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#fff';ctx.fillText(icon,0,1);ctx.restore();
  ctx.fillStyle='#0b2234';ctx.fillRect(u.x-24,u.y-32,48,5);ctx.fillStyle=u.color;ctx.fillRect(u.x-24,u.y-32,48*(hp/3),5);
}
function loop(t){if(!running)return;const dt=Math.min((t-last)/1000,.033);last=t;update(dt);draw();requestAnimationFrame(loop)}

startBtn.onclick=start;document.querySelector('#backBtn').onclick=()=>{running=false;game.classList.remove('active');menu.classList.add('active')};
