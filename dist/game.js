const canvas = document.querySelector('#world');
const ctx = canvas.getContext('2d');
const questName = document.querySelector('#questName');
const questText = document.querySelector('#questText');
const interactButton = document.querySelector('#interact');
const guide = document.querySelector('#guide');
const storageKey = 'sunpetal-reef-preview-v1';
const stops = [
  { x: 840, y: 350, name: 'Meet Luma', text: 'Swim to the jellyfish and ask it to guide you through the current.', action: 'Meet Luma' },
  { x: 840, y: 350, name: 'Ride the current', text: 'Luma found a current through the kelp. Follow its light to Moonlace Reef.', action: 'Ride current' },
  { x: 1250, y: 511, name: 'Find a moonlace seed', text: 'Look for the golden glow on the reef shelf.', action: 'Collect seed' },
  { x: 395, y: 560, name: 'Plant at home', text: 'Bring the seed to the marked bed at Sunpetal Homebase.', action: 'Plant moonlace' },
  { x: 395, y: 560, name: 'Tend your moonlace', text: 'Guide a little moonlight into the bed to help your plant bloom.', action: 'Tend moonlace' },
  { x: 395, y: 560, name: 'First harvest', text: 'Your moonlace is ready. Harvest it for the homebase.', action: 'Harvest moonlace' }
];
let step = 0;
try {
  const saved = Number(localStorage.getItem(storageKey));
  if (Number.isInteger(saved) && saved >= 0 && saved <= stops.length) step = saved;
} catch {}
const player = { x: 520, y: 610, vx: 0, vy: 0, face: 1 };
const keys = new Set();
const world = { w: 1536, h: 864 };
const camera = { x: player.x, y: player.y };
const background = new Image();
background.src = 'reef.webp';
let target, ride, burstUntil = 0, last = 0;
let width, height, scale, left, top;
let flashUntil = 0;
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function updateQuest() {
  const stop = stops[step];
  questName.textContent = stop?.name ?? 'Moonlace harvested';
  questText.textContent = stop?.text ?? 'You brought moonlace home from the reef. Swim freely around the valley.';
}

function advance() {
  step++;
  try { localStorage.setItem(storageKey, String(step)); } catch {}
  updateQuest();
  flashUntil = performance.now() + 950;
}

function interact() {
  const stop = stops[step];
  if (!stop || ride || guide.open) return;
  if (distance(player, stop) > 79) {
    target = { x: stop.x, y: stop.y };
    return;
  }
  if (step === 1) {
    ride = { started: performance.now(), x: player.x, y: player.y };
    target = undefined;
    return;
  }
  advance();
}

const movement = new Set(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','shift']);
window.addEventListener('keydown', event => {
  const key = event.key.toLowerCase();
  if (guide.open) return;
  if (movement.has(key)) {
    event.preventDefault();
    keys.add(key);
    target = undefined;
  }
  if (key === 'e' && !event.repeat) interact();
});
window.addEventListener('keyup', event => keys.delete(event.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());
canvas.addEventListener('pointerdown', event => {
  if (ride) return;
  target = { x: clamp((event.clientX - left) / scale, 220, 1410), y: clamp((event.clientY - top) / scale, 350, 750) };
});
interactButton.addEventListener('click', interact);
document.querySelector('#burst').addEventListener('click', () => { burstUntil = performance.now() + 1100; });
document.querySelector('#help').addEventListener('click', () => { keys.clear(); guide.showModal(); });

function resize() {
  width = innerWidth;
  height = innerHeight;
  const density = Math.min(devicePixelRatio, 2);
  canvas.width = Math.round(width * density);
  canvas.height = Math.round(height * density);
  ctx.setTransform(density, 0, 0, density, 0, 0);
}
window.addEventListener('resize', resize);
resize();
updateQuest();

function move(now, dt) {
  if (ride) {
    const progress = clamp((now - ride.started) / 1550, 0, 1);
    const eased = progress * progress * (3 - 2 * progress);
    player.x = ride.x + (1175 - ride.x) * eased;
    player.y = ride.y + (511 - ride.y) * eased - Math.sin(progress * Math.PI) * 102;
    player.face = 1;
    if (progress === 1) { ride = undefined; advance(); }
    return;
  }
  let x = Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft'));
  let y = Number(keys.has('s') || keys.has('arrowdown')) - Number(keys.has('w') || keys.has('arrowup'));
  let pace = 1;
  if (target) {
    x = target.x - player.x;
    y = target.y - player.y;
    const remaining = Math.hypot(x, y);
    pace = Math.min(1, remaining / 55);
    if (remaining < 7) { target = undefined; x = 0; y = 0; }
  }
  const speed = (keys.has('shift') || now < burstUntil ? 365 : 215) * pace;
  const length = Math.hypot(x, y) || 1;
  const nearBed = distance(player, stops[3]) < 125;
  const response = 1 - Math.exp(-dt * (nearBed ? 19 : x || y ? 12 : 8));
  player.vx += (x / length * speed - player.vx) * response;
  player.vy += (y / length * speed - player.vy) * response;
  player.x = clamp(player.x + player.vx * dt, 220, 1410);
  player.y = clamp(player.y + player.vy * dt, 350, 750);
  if (Math.abs(player.vx) > 8) player.face = Math.sign(player.vx);
}

function glow(x, y, radius, color) {
  const g = ctx.createRadialGradient(x,y,0,x,y,radius);
  g.addColorStop(0,color);
  g.addColorStop(1,'transparent');
  ctx.fillStyle = g;
  ctx.fillRect(x-radius,y-radius,radius*2,radius*2);
}

function diamond(x, y, size, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y-size);
  ctx.quadraticCurveTo(x+size*.18,y-size*.18,x+size,y);
  ctx.quadraticCurveTo(x+size*.18,y+size*.18,x,y+size);
  ctx.quadraticCurveTo(x-size*.18,y+size*.18,x-size,y);
  ctx.quadraticCurveTo(x-size*.18,y-size*.18,x,y-size);
  ctx.fill();
}

function mermaid(t) {
  const wake = Math.min(1, Math.hypot(player.vx,player.vy)/180);
  const bob = reducedMotion ? 0 : Math.sin(t*4)*3;
  ctx.save();
  ctx.translate(player.x,player.y+bob);
  ctx.scale(player.face,1);
  glow(0,10,43,'#795dff76');
  for(let i=0;i<8;i++) {
    const phase = (t*.85+i/8)%1;
    ctx.globalAlpha = wake*(1-phase)*.75;
    diamond(-22-phase*65, Math.sin(i*2.4)*phase*18+12, 2+phase*2, '#9bf8ff');
  }
  ctx.globalAlpha = 1;
  const hip = 11;
  const fin = Math.sin(t*(4+wake*8))*5;
  const tail = ctx.createLinearGradient(-37,10,11,28);
  tail.addColorStop(0,'#8cf6ff');tail.addColorStop(.55,'#9669dc');tail.addColorStop(1,'#5f38bc');
  ctx.fillStyle = tail;
  ctx.beginPath();
  ctx.moveTo(3,hip);ctx.bezierCurveTo(-8,29,-26,35,-39,22+fin);
  ctx.quadraticCurveTo(-52,30+fin,-58,17+fin);ctx.quadraticCurveTo(-51,16+fin,-46,17+fin);
  ctx.quadraticCurveTo(-55,7+fin,-52,2+fin);ctx.quadraticCurveTo(-39,4+fin,-36,16+fin);
  ctx.bezierCurveTo(-19,24,-13,5,-4,3);ctx.closePath();ctx.fill();
  ctx.strokeStyle='#c9b8ff';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(-6,14);ctx.quadraticCurveTo(-20,34,-38,21+fin);ctx.stroke();
  const hair = ctx.createLinearGradient(-24,-34,11,16);
  hair.addColorStop(0,'#fb9eea');hair.addColorStop(.55,'#9c3da0');hair.addColorStop(1,'#472568');
  ctx.fillStyle=hair;
  ctx.beginPath();ctx.moveTo(13,-24);ctx.bezierCurveTo(6,-46,-23,-34,-20,-17);
  ctx.bezierCurveTo(-23,-2,-39,-2+fin,-40,13+fin);
  ctx.bezierCurveTo(-25,17+fin,-8,10,-1,3);ctx.closePath();ctx.fill();
  ctx.fillStyle='#bc755f';
  ctx.beginPath();ctx.ellipse(6,-16,10,13,.15,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.ellipse(3,0,6,12,.55,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#d99378';ctx.lineWidth=4;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(7,-2);ctx.quadraticCurveTo(15,4,21,0);ctx.stroke();
  ctx.fillStyle='#d291ff';ctx.beginPath();ctx.ellipse(4,3,7,4,-.38,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#2b1542';ctx.beginPath();ctx.ellipse(11,-17,2,1.5,-.25,0,Math.PI*2);ctx.fill();
  diamond(1,-12,3,'#ffdf9d');diamond(4,-26,3,'#ffe4b5');diamond(17,3,2,'#fff2c5');
  ctx.restore();
}

function draw(now) {
  const t = now / 1000;
  const zoom = width < 710 ? 1.08 : 1;
  scale = Math.max(width/world.w,height/world.h)*zoom;
  left = clamp(width*.5 - camera.x*scale, width-world.w*scale, 0);
  top = clamp(height*.61 - camera.y*scale, height-world.h*scale, 0);
  ctx.clearRect(0,0,width,height);
  ctx.save();ctx.translate(left,top);ctx.scale(scale,scale);
  const sea = ctx.createLinearGradient(0,0,0,864);
  sea.addColorStop(0,'#13748e');sea.addColorStop(1,'#051531');
  ctx.fillStyle=sea;ctx.fillRect(0,0,1536,864);
  if(background.complete && background.naturalWidth) ctx.drawImage(background,0,0,1536,864);
  for(let i=0;i<42;i++) {
    const x=(i*131.31)%1536;
    const y=(i*87.43-(reducedMotion?0:t*(6+i%8)))%864;
    ctx.globalAlpha=.24+(i%4)*.09;
    diamond(x,(y+864)%864,1.1+i%3*.6,'#bcf6ff');
  }
  ctx.globalAlpha=1;
  if (step >= 1 && step < 3) {
    for(let i=0;i<22;i++) {
      const p=(i/22+(reducedMotion?0:t*.34))%1;
      diamond(840+p*353,350+p*161-Math.sin(p*Math.PI)*90,3+2*Math.sin(p*Math.PI),'#a9f7ff');
    }
  }
  if (step === 4 || step === 5) {
    for (let i=0;i<5;i++) {
      const x=370+i*11, y=560+Math.sin(i*4)*9;
      ctx.strokeStyle='#57cea2';ctx.lineWidth=3;
      ctx.beginPath();ctx.moveTo(x,y+9);ctx.quadraticCurveTo(x-4,y,x,y-(step===5?17:7));ctx.stroke();
      diamond(x,y-(step===5?17:7),step===5?8:4,'#ffc3fa');
    }
  }
  const stop=stops[step];
  if(stop&&!ride){
    const markerY=stop.y-25+(reducedMotion?0:Math.sin(t*4)*5);
    glow(stop.x,markerY,34,'#ffc48094');
    diamond(stop.x,markerY,10,'#fff1bc');
    ctx.strokeStyle='#ffe6a4b8';ctx.lineWidth=2;
    ctx.beginPath();ctx.ellipse(stop.x,stop.y+7,22,8,0,0,Math.PI*2);ctx.stroke();
  }
  if (now<flashUntil) glow(player.x,player.y,55,'#dca0ffa0');
  mermaid(t);
  ctx.restore();
}

function frame(now) {
  const dt = Math.min(.045, (now-(last||now))/1000);
  last=now;
  if(!guide.open) move(now,dt);
  const follow = 1-Math.exp(-dt*(reducedMotion?14:5));
  camera.x += (player.x + player.vx*.25 - camera.x)*follow;
  camera.y += (player.y + player.vy*.12 - camera.y)*follow;
  const stop=stops[step];
  interactButton.disabled=!stop||Boolean(ride);
  interactButton.textContent = ride ? 'Riding current…' : stop ? (distance(player,stop)<=79 ? stop.action : 'Swim to marker') : 'Quest complete';
  document.querySelector('#location').textContent=player.x>1050?'Moonlace Reef':player.x>650?'Luma’s Current':'Sunpetal Homebase';
  draw(now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
if(ctx&&window.parent!==window)window.parent.postMessage('sunpetal-illustrated-ready','*');
