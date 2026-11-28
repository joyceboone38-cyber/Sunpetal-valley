import { createReef } from './reef-scene.js';
import { reefLayout } from './reef-layout.js';
import { connectLife, loadLife } from './reef-activities.js';
import { createStick } from './reef-touch.js'; // [sunpetal-stick]
import { createDecorator } from './reef-decorate.js';
export { useEmbeddedReefAssets } from './reef-model-loader.js';

let canvas = document.querySelector('#world');
const action = document.querySelector('#interact');
const travelButton = document.querySelector('#travel');
const areaAction = document.querySelector('#area-action');
const farmAccess = document.querySelector('#farm-access');
const guide = document.querySelector('#guide');
const questName = document.querySelector('#questName');
const questText = document.querySelector('#questText');
const location = document.querySelector('#location');
const progressText = document.querySelector('#progressText');
const progressFill = document.querySelector('#progressFill');
const fountainChoices = document.querySelector('#fountainChoices');
const spotButtons = [...document.querySelectorAll('[data-fountain-spot]')];
const storageKey = 'sunpetal-3d-progress-v1';
const decorKey = 'sunpetal-fountain-spot';

const { farm, jelly, shelf, station, grotto, glass, secondBed, displaySpots, travelLandings,
  farmIsland, outdoorBounds, onFarmIsland, cottageRoom, cottageDoor, farmDock, kitchen, wardrobe } = reefLayout;
const quests = [
  { ...jelly, name: 'Meet Luma', text: 'Swim to the jellyfish in the channel.', action: 'Meet Luma' },
  { ...jelly, name: 'Ride the current', text: 'Let Luma guide you to Moonlace Reef.', action: 'Ride current' },
  { ...shelf, name: 'Find a moonlace seed', text: 'Collect the seed on the reef shelf.', action: 'Collect seed' },
  { ...farm, name: 'Plant at home', text: 'Bring your seed to the glowing bed at home. Use Travel to return quickly.', action: 'Plant seed' },
  { ...farm, name: 'Tend your moonlace', text: 'Tend the new shoots so they bloom.', action: 'Tend moonlace' },
  { ...farm, name: 'First harvest', text: 'Harvest the blooms for your crafting table.', action: 'Harvest moonlace' },
  { ...station, name: 'Craft a moonlace lantern', text: 'Take the blooms to the crafting table beside the farm.', action: 'Craft lantern' },
  { ...grotto, name: 'The Glassfin Grotto', text: 'Travel to the reef and collect a starkelp seed among the violet arches.', action: 'Collect starkelp seed' },
  { ...glass, name: 'A glint in the reef', text: 'Gather a piece of tideglass from the rocky edge.', action: 'Collect tideglass' },
  { ...secondBed, name: 'Plant starkelp', text: 'Return home and plant starkelp in the second garden bed.', action: 'Plant starkelp' },
  { ...secondBed, name: 'Tend your starkelp', text: 'Tend the fronds until their tips light up.', action: 'Tend starkelp' },
  { ...secondBed, name: 'Harvest starkelp', text: 'Harvest the fronds for the fountain recipe.', action: 'Harvest starkelp' },
  { ...station, name: 'Craft a tideglass fountain', text: 'Combine starkelp and tideglass at the crafting table.', action: 'Craft fountain' }
];

const lifeState=loadLife();
function showStartupError(message) {
  document.dispatchEvent(new CustomEvent('sunpetal-startup-error',{detail:message}));
}

let view;

let step = 0;
try {
  const value = Number(localStorage.getItem(storageKey));
  if (Number.isInteger(value) && value >= 0 && value <= quests.length) step = value;
} catch {}

let display = -1;
try {
  const savedSpot = localStorage.getItem(decorKey);
  if (step === quests.length && ['0', '1'].includes(savedSpot)) display = Number(savedSpot);
} catch {}

const player = { x: farmIsland.arrival.x, z: farmIsland.arrival.z, vx: 0, vz: 0, heading: -Math.PI/2, space:'farm' };
const cookingPoint={x:kitchen.x-.22,z:kitchen.z+1.02,space:'cottage'};
const wardrobePoint={x:wardrobe.x+.18,z:wardrobe.z+1.08,space:'cottage'};
const keys = new Set();
const stick = createStick({onStart:()=>{target=pendingAction=pendingVisit=undefined;}}); // [sunpetal-stick]
const directions = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift']);
const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
const clamp = (value, low, high) => Math.max(low,Math.min(high,value));
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let target, pendingAction, pendingVisit, current, cooking, boostUntil = 0, last = 0, selectedDisplay = -1;
let frameRequest,firstFrame,hasStarted=false;
// The game opens at Joyce's Homebase and farm. The town loads once she leaves it.
let openFarmOnStart=!window.location||!['plaza','cottage'].includes(new URLSearchParams(window.location.search).get('area'));
const life=connectLife({
  state:lifeState,getView:()=>view,layout:reefLayout,player,
  onOpen(){keys.clear();stick.reset();player.vx=player.vz=0;},
  canOpen:()=>!current&&!cooking&&!guide.open,
  canExploreMoonlace:()=>step>=2,
  travelTo:area=>{
    if(player.space==='cottage')leaveCottage();
    beginCurrent(travelLandings[area]);
  },
  walkTo,openFarm,cookingPoint,startCooking,wardrobePoint,
  startDecorating:id=>{
    if(player.space==='cottage')decor.enter(id);
    else goToCottagePoint(cottageRoom.arrival,()=>decor.enter(id));
  },
  goToKitchen:onArrival=>goToCottagePoint(cookingPoint,onArrival),
  goToWardrobe:onArrival=>goToCottagePoint(wardrobePoint,onArrival)
});
const decor=createDecorator({life,getView:()=>view,player,room:cottageRoom,
  onChange:()=>{keys.clear();stick.reset();target=pendingAction=pendingVisit=undefined;}});
const menuOpen=()=>guide.open||life.panel.open||decor.active;

function startCooking(finish){
  if(!view||cooking||player.space!=='cottage')return false;
  cooking={started:performance.now(),x:player.x,z:player.z,heading:player.heading,finish};
  keys.clear();
  target=pendingAction=pendingVisit=undefined;
  player.vx=player.vz=boostUntil=0;
  document.body.dataset.cooking='true';
  return true;
}

function updateCooking(now){
  const elapsed=Math.max(0,now-cooking.started);
  const progress=reduceMotion?1:clamp(elapsed/360,0,1);
  const eased=progress*progress*(3-2*progress);
  const heading=Math.atan2(kitchen.x-cookingPoint.x,kitchen.z+.16-cookingPoint.z);
  const turn=heading-cooking.heading;
  player.x=cooking.x+(cookingPoint.x-cooking.x)*eased;
  player.z=cooking.z+(cookingPoint.z-cooking.z)*eased;
  player.heading=cooking.heading+Math.atan2(Math.sin(turn),Math.cos(turn))*eased;
  if(elapsed<3600)return;
  const {finish}=cooking;
  cooking=undefined;
  delete document.body.dataset.cooking;
  finish();
}

function changeSpace(space,arrival,heading){
  Object.assign(player,arrival,{space,heading,vx:0,vz:0});
  keys.clear();
  target=pendingAction=pendingVisit=undefined;
}

function leaveCottage(){
  changeSpace('outdoor',{x:cottageDoor.x,z:cottageDoor.z+1.27},0);
}

function walkTo(point,onArrival){
  if(current||cooking)return;
  if(player.space==='cottage'&&point.space!=='cottage')leaveCottage();
  if(distance(point,player)<.68){onArrival?.();return;}
  target={...point};
  pendingAction=undefined;
  pendingVisit=onArrival;
}

function openFarm(){
  if(player.space!=='farm')walkTo(farmIsland.arrival);
}

function openCottage(onArrival){
  changeSpace('cottage',cottageRoom.arrival,Math.PI);
  onArrival?.();
}

function goToCottagePoint(point,onArrival){
  const approach=()=>walkTo(point,onArrival);
  if(player.space==='cottage')approach();
  else walkTo(cottageDoor,()=>openCottage(approach));
}

function mirrorNearby(){
  const distanceToMirror=distance(player,wardrobePoint);
  return distanceToMirror<1.7&&distanceToMirror<distance(player,cookingPoint);
}

function nearbyAreaAction(now=Date.now()){
  if(current)return;
  if(player.space==='farm'){
    return life.lumaTending(now)
      ? {label:'Luma watering…',disabled:true}
      : {label:'Ask Luma',run:life.askLuma};
  }
  if(player.space==='cottage')return {label:'Decorate',run:()=>decor.enter('')};
  if(player.space!=='outdoor')return;
  if(distance(player,cottageDoor)<2.35)return {label:'Enter cottage',run:openCottage};
  if(distance(player,farmDock)<2.05)return {label:'Swim to Farm Island',run:openFarm};
}

function activeQuest() {
  if (quests[step]) return quests[step];
  const choices = displaySpots.map((spot, index) => ({ ...spot, index })).filter(spot => spot.index !== display);
  const selected = choices.find(spot => spot.index === selectedDisplay);
  const spot = selected ?? choices.reduce((best, option) => distance(player,option) < distance(player,best) ? option : best);
  return { ...spot, action: display < 0 ? 'Place fountain' : 'Move fountain' };
}

function updateQuest() {
  if (!view) return;
  const quest = quests[step];
  questName.textContent = quest?.name ?? (display < 0 ? 'Choose a fountain home' : 'Tideglass fountain placed');
  questText.textContent = quest?.text ?? (display < 0
    ? 'Choose Fountain steps or Garden overlook below. Swim to the glowing pad to place your fountain.'
    : `Your fountain is at ${displaySpots[display].name.toLowerCase()}. Choose the other site to move it.`);
  const completed = Math.min(step, quests.length);
  progressText.textContent = step === quests.length ? 'Fountain unlocked' : `Story ${completed + 1} / ${quests.length}`;
  progressFill.style.width = `${completed / quests.length * 100}%`;
  document.querySelector('.progress-track').setAttribute('aria-valuenow', String(completed));
  fountainChoices.hidden = step !== quests.length;
  for (const button of spotButtons) {
    const index = Number(button.dataset.fountainSpot);
    const occupied = index === display;
    button.disabled = occupied;
    button.setAttribute('aria-pressed', String(index === selectedDisplay || occupied));
    button.textContent = `${displaySpots[index].name}${occupied ? ' · placed' : ''}`;
  }
}

function advance() {
  step++;
  selectedDisplay = -1;
  try { localStorage.setItem(storageKey, String(step)); } catch {}
  updateQuest();
}

function beginCurrent(destination, intro = false) {
  if (!view || menuOpen() || current || (!intro && step < 2)) return false;
  current = {
    x: player.x, z: player.z,
    endX: destination.x, endZ: destination.z,
    started: performance.now(), duration: reduceMotion ? 900 : 2300,
    intro
  };
  player.vx = 0;
  player.vz = 0;
  target = undefined;
  pendingAction = undefined;
  pendingVisit = undefined;
  return true;
}

function travel() {
  if(!view||menuOpen()||current||cooking)return;
  if(player.space==='cottage'){
    leaveCottage();
    return;
  }
  if(player.space==='farm'){
    walkTo(farmDock);
    return;
  }
  if(step<2)return;
  const destination = player.x < 4.5 ? travelLandings.reef : travelLandings.home;
  beginCurrent(destination);
}

function chooseSpot(index) {
  if (step !== quests.length || index === display || current || cooking || !view) return;
  selectedDisplay = index;
  target = { x: displaySpots[index].x, z: displaySpots[index].z };
  pendingAction = { step, index };
  pendingVisit = undefined;
  updateQuest();
}

function interact() {
  const quest = activeQuest();
  if (!view || !quest || menuOpen() || current || cooking) return;
  if(player.space==='farm'){
    if(target?.farmBed===undefined)life.farmAction();
    return;
  }
  if(player.space==='cottage'){
    if(mirrorNearby())life.visitWardrobe();
    else goToCottagePoint(cookingPoint,()=>life.show('Kitchen'));
    return;
  }
  pendingVisit = undefined;
  if (distance(player,quest) > 1.5) {
    target = { x: quest.x, z: quest.z };
    pendingAction = { step, index: quest.index };
    return;
  }
  target = undefined;
  pendingAction = undefined;
  if (step === quests.length) {
    if (quest.index === display) return;
    display = quest.index;
    selectedDisplay = -1;
    try { localStorage.setItem(decorKey, String(display)); } catch {}
    updateQuest();
    return;
  }
  if (step === 1) {
    beginCurrent(travelLandings.reef, true);
    return;
  }
  advance();
}

function move(now, dt) {
  if (current) {
    const progress = clamp((now-current.started)/current.duration,0,1);
    const p = progress*progress*(3-2*progress);
    player.x = current.x + (current.endX-current.x)*p;
    player.z = current.z + (current.endZ-current.z)*p + Math.sin(p*Math.PI)*1.8;
    player.heading = Math.atan2(current.endX-current.x,current.endZ-current.z);
    if (progress === 1) {
      player.x = current.endX;
      player.z = current.endZ;
      player.vx = 0;
      player.vz = 0;
      const intro = current.intro;
      current = undefined;
      if (intro) advance();
    }
    return;
  }

  let x = Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft'));
  let z = Number(keys.has('s') || keys.has('arrowdown')) - Number(keys.has('w') || keys.has('arrowup'));
  let pace = 1;
  const pad = stick.vector();
  if (pad.active && !cooking) {
    target = pendingAction = pendingVisit = undefined;
    x = pad.x;
    z = pad.z;
  }
  if (target) {
    x = target.x-player.x;
    z = target.z-player.z;
    const remaining = Math.hypot(x,z);
    if (remaining <= .54) {
      player.x = target.x;
      player.z = target.z;
      player.vx = 0;
      player.vz = 0;
      target = undefined;
      const pending = pendingAction;
      pendingAction = undefined;
      const arrived=pendingVisit;
      pendingVisit=undefined;
      arrived?.();
      if (pending && pending.step === step) {
        if (step !== quests.length || activeQuest().index === pending.index) interact();
      }
      return;
    }
    pace = clamp(remaining/1.55,.18,1);
  } else if (x || z) {
    const heading=view.cameraHeading?.()??0;
    const sin=Math.sin(heading),cos=Math.cos(heading);
    [x,z]=[x*cos+z*sin,z*cos-x*sin];
  }
  const magnitude = Math.hypot(x,z) || 1;
  const speed = (keys.has('shift') || now < boostUntil ? 11.2 : 6.6)*pace*(pad.active?Math.min(1,Math.hypot(pad.x,pad.z)):1)*life.speedBoost;
  const response = 1-Math.exp(-dt*(distance(player,farm)<2.8 ? 15 : x || z ? 9 : 6));
  player.vx += (x/magnitude*speed-player.vx)*response;
  player.vz += (z/magnitude*speed-player.vz)*response;
  const bounds=player.space==='cottage'?cottageRoom.bounds:outdoorBounds;
  player.x = clamp(player.x+player.vx*dt,bounds.left,bounds.right);
  player.z = clamp(player.z+player.vz*dt,bounds.back,bounds.front);
  if (Math.hypot(player.vx,player.vz) > .25) {
    const heading = Math.atan2(player.vx,player.vz);
    const difference = Math.atan2(Math.sin(heading-player.heading),Math.cos(heading-player.heading));
    player.heading += difference*(1-Math.exp(-dt*12));
  }
}

function frame(now) {
  if(!view)return;
  const dt = Math.min(.05,(now-(last||now))/1000);
  last = now;
  if(cooking)updateCooking(now);
  else if(!menuOpen())move(now,dt);
  if(player.space!=='cottage')player.space=onFarmIsland(player)?'farm':'outdoor';
  if(decor.active&&player.space!=='cottage')decor.exit();
  const wallTime=Date.now();
  life.tick(wallTime);
  const quest = activeQuest();
  const bedTarget=target?.farmBed;
  const nearbyBed=player.space==='farm'?life.closestBed():-1;
  const plotAction=player.space==='farm'?life.worldBedAction(nearbyBed,wallTime):null;
  const label = current ? 'Riding current…' : pendingAction ? 'Swimming to marker…'
    : bedTarget!==undefined ? 'Swimming to bed…'
    : plotAction ? plotAction.label
    : player.space==='cottage' ? mirrorNearby()?'Open wardrobe':'Cook at stove'
    : quest ? (distance(player,quest)<=1.5 ? quest.action : 'Go to quest marker') : 'Quest complete';
  if (action.textContent !== label) action.textContent = label;
  action.disabled = !quest || Boolean(current) || bedTarget!==undefined || Boolean(plotAction?.disabled);
  const canTravel = (player.space!=='outdoor'||step>=2) && !current;
  travelButton.disabled = !canTravel;
  farmAccess.hidden=player.space==='farm';
  farmAccess.disabled=Boolean(current);
  document.querySelector('#life-open').disabled=Boolean(current);
  const travelLabel = player.space==='cottage'?'Leave cottage':player.space==='farm'?'Return to the Plaza'
    :current?'Traveling…':player.x<4.5?'Travel to Moonlace':'Return to Sunpetal';
  if (travelButton.textContent !== travelLabel) travelButton.textContent = travelLabel;
  const here=nearbyAreaAction(wallTime);
  areaAction.hidden=!here;
  areaAction.disabled=Boolean(here?.disabled);
  if(here&&areaAction.textContent!==here.label)areaAction.textContent=here.label;
  const region = player.space==='farm'?'Pearl Reef Sanctuary':player.space==='cottage'?'Sunpetal Cottage'
    :player.x < 4 ? 'Sunpetal Plaza' : player.x > 8 ? (player.z < -3.3 ? 'Glassfin Grotto' : 'Moonlace Reef') : 'Luma’s Current';
  if (location.textContent !== region) location.textContent = region;
  document.body.dataset.questStep = String(step);
  document.body.dataset.fountainSpot = String(display);
  document.body.dataset.traveling = String(Boolean(current));
  document.body.dataset.playerX = player.x.toFixed(2);
  document.body.dataset.playerZ = player.z.toFixed(2);
  document.body.dataset.space=player.space;
  try {
    const lumaWork=player.space!=='cottage'&&player.x<farmDock.x+1?life.lumaWork(wallTime):undefined;
    view.render({ player, quest:player.space==='outdoor'?quest:null, step, dt, time: now/1000, display,
      current: Boolean(current), cooking:Boolean(cooking), reduceMotion, crops:life.crops,style:lifeState.style,lumaWork,farmBed:bedTarget??nearbyBed });
  } catch(error) {
    console.error(error);
    stopReef();
    showStartupError('The 3D view could not draw the reef.');
    return;
  }
  if(!view)return;
  if(firstFrame){
    firstFrame=false;
    document.dispatchEvent(new Event('sunpetal-ready'));
  }
  frameRequest=requestAnimationFrame(frame);
}

function selectWorldPoint(event){
  if(decor.active){decor.tap(event);return;}
  if (current || cooking || menuOpen()) return;
  const farmBed=view.pickFarmBed?.(event.clientX,event.clientY)??-1;
  if(farmBed>=0){
    target=pendingAction=pendingVisit=undefined;
    life.useBed(farmBed);
    return;
  }
  if(player.space==='cottage'){
    if(view.hitsWardrobe?.(event.clientX,event.clientY)){life.visitWardrobe();return;}
    if(view.hitsKitchen?.(event.clientX,event.clientY)){goToCottagePoint(cookingPoint,()=>life.show('Kitchen'));return;}
  }
  if(player.space==='outdoor'&&view.hitsMoonlacePearl?.(event.clientX,event.clientY)){
    life.findPearl();
    return;
  }
  const point = view.pick(event.clientX,event.clientY);
  if (!point) return;
  if(player.space==='cottage'&&distance(point,kitchen)<1.05){goToCottagePoint(cookingPoint,()=>life.show('Kitchen'));return;}
  if(player.space==='outdoor'&&distance(point,cottageDoor)<.78){walkTo(cottageDoor,openCottage);return;}
  if(player.space==='outdoor'&&distance(point,farmDock)<.82){walkTo(farmDock,openFarm);return;}
  if (player.space==='outdoor'&&step === quests.length) {
    const nearest = displaySpots.findIndex(spot => distance(spot,point) < 1.2 && spot !== displaySpots[display]);
    if (nearest >= 0) { chooseSpot(nearest); return; }
  }
  const bounds=player.space==='cottage'?cottageRoom.bounds:outdoorBounds;
  target = { x:clamp(point.x,bounds.left,bounds.right),z:clamp(point.z,bounds.back,bounds.front) };
  pendingAction = undefined;
  pendingVisit = undefined;
}

const cameraKeys={
  '+':()=>view.zoomCamera(.83),'=':()=>view.zoomCamera(.83),'-':()=>view.zoomCamera(1/.83),
  '[':()=>view.rotateCamera(-Math.PI/8),']':()=>view.rotateCamera(Math.PI/8),
  '0':()=>view.resetCamera()
};
const pointers=new Map();
let cameraGesture=false;
window.addEventListener('keydown', event => {
  if (!view || cooking || menuOpen() || event.ctrlKey || event.metaKey || event.altKey) return;
  const key = event.key.toLowerCase();
  if (directions.has(key)) {
    event.preventDefault();
    keys.add(key);
    if (key !== 'shift') {
      target = undefined;
      pendingAction = undefined;
      pendingVisit = undefined;
    }
  }
  if (key === 'e' && !event.repeat) interact();
  if (key === 't' && !event.repeat) travel();
  if (key === 'l' && !event.repeat && !current) life.show();
  if (Object.hasOwn(cameraKeys,key)) {
    event.preventDefault();
    cameraKeys[key]();
  }
});
window.addEventListener('keyup', event => keys.delete(event.key.toLowerCase()));
window.addEventListener('pagehide',event=>{if(!event.persisted)stopReef();});
function bindCanvas(canvas) {
  canvas.addEventListener('webglcontextlost',()=>{
    if(canvas!==document.querySelector('#world')||!view)return;
    stopReef();
    showStartupError('The 3D graphics stopped. You can retry with simpler graphics.');
  });
  function pinchSpan(){
    const [first,second]=pointers.values();
    return Math.hypot(first.x-second.x,first.y-second.y);
  }
  canvas.addEventListener('pointerdown',event=>{
    if(!view||cooking||(menuOpen()&&!decor.active)||event.button!==0||pointers.size>=2) return;
    if(!pointers.size) cameraGesture=false;
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(pointers.size===2) cameraGesture=true;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove',event=>{
    const point=pointers.get(event.pointerId);
    if(!point||cooking) return;
    const dx=event.clientX-point.x,dy=event.clientY-point.y;
    if(pointers.size===2){
      const before=pinchSpan();
      point.x=event.clientX;point.y=event.clientY;
      const after=pinchSpan();
      if(before>10&&after>10) view.zoomCamera(before/after);
      return;
    }
    if(!cameraGesture&&Math.hypot(dx,dy)<(event.pointerType==='touch'?8:5)) return;
    cameraGesture=true;
    canvas.classList.add('orbiting');
    view.rotateCamera(-dx*.007,dy*.005);
    point.x=event.clientX;point.y=event.clientY;
  });
  function endPointer(event,select){
    const point=pointers.get(event.pointerId);
    if(!point) return;
    pointers.delete(event.pointerId);
    if(!pointers.size) canvas.classList.remove('orbiting');
    if(select&&!cameraGesture&&Math.hypot(event.clientX-point.x,event.clientY-point.y)<9) selectWorldPoint(event);
  }
  canvas.addEventListener('pointerup',event=>endPointer(event,true));
  canvas.addEventListener('pointercancel',event=>endPointer(event,false));
  canvas.addEventListener('lostpointercapture',event=>endPointer(event,false));
  canvas.addEventListener('wheel',event=>{
    if(!view||cooking||(menuOpen()&&!decor.active)||event.ctrlKey||event.metaKey) return;
    event.preventDefault();
    const unit=event.deltaMode===1?16:event.deltaMode===2?canvas.clientHeight:1;
    view.zoomCamera(Math.exp(clamp(event.deltaY*unit*.00165,-1,1)));
  },{passive:false});
}
window.addEventListener('blur', () => {
  keys.clear(); target = undefined; pendingAction = undefined; pendingVisit = undefined;
  pointers.clear();
  canvas.classList.remove('orbiting');
});
action.addEventListener('click',interact);
travelButton.addEventListener('click',travel);
areaAction.addEventListener('click',()=>{if(!menuOpen())nearbyAreaAction()?.run?.();});
farmAccess.addEventListener('click',()=>{if(!current&&!menuOpen())openFarm();});
for (const button of spotButtons) button.addEventListener('click', () => chooseSpot(Number(button.dataset.fountainSpot)));
document.querySelector('#burst').addEventListener('click', () => { if(!cooking)boostUntil = performance.now()+1200; });
document.querySelector('#help').addEventListener('click', () => { if(!cooking){keys.clear();guide.showModal();} });

export function stopReef() {
  if(frameRequest!==undefined)cancelAnimationFrame(frameRequest);
  frameRequest=undefined;
  const previous=view;
  view=undefined;
  keys.clear();
  pointers.clear();
  target=pendingAction=pendingVisit=current=cooking=undefined;
  delete document.body.dataset.cooking;
  player.vx=player.vz=0;
  boostUntil=last=0;
  if(guide.open)guide.close();
  if(life.panel.open)life.panel.close();
  previous?.dispose?.();
}

export function startReef({safeMode=false}={}) {
  stopReef();
  if(hasStarted){
    const fresh=canvas.cloneNode(false);
    fresh.classList.remove('orbiting');
    canvas.replaceWith(fresh);
    canvas=fresh;
  }
  hasStarted=true;
  const quality=safeMode?'low':lifeState.quality;
  try {
    view=createReef(canvas,{...reefLayout,quality,simpleGraphics:safeMode,playerOutfit:lifeState.outfit});
  } catch(error) {
    console.error(error);
    showStartupError(safeMode?'3D graphics are still unavailable here. You can try the illustrated reef.'
      :'The 3D graphics could not start in this window.');
    return;
  }
  lifeState.quality=quality;
  view.setFurniture?.(life.home,life.selected);
  document.querySelector('#low-graphics').checked=quality==='low';
  if(openFarmOnStart){
    openFarmOnStart=false;
    changeSpace('farm',farmIsland.arrival,-Math.PI/2);
  }
  if(new URLSearchParams(window.location.search).get('area')==='plaza')changeSpace('outdoor',reefLayout.travelLandings.home,.9);
  if(new URLSearchParams(window.location.search).get('area')==='cottage')changeSpace('cottage',cottageRoom.arrival,Math.PI);
  bindCanvas(canvas);
  updateQuest();
  firstFrame=true;
  frameRequest=requestAnimationFrame(frame);
}
