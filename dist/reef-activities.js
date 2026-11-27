import { outfits } from './reef-avatar.js';
import { reefPosterUrl } from './reef-model-loader.js';
import { reefLayout } from './reef-layout.js';
import { furnitureCatalog, furnitureById, furnitureRadius, roomFloor } from './reef-furniture.js'; // [sunpetal-shop]
import { crops, cropById, legMs, tileStage, tileProgress, describeTime } from './reef-crops.js';

const makeButton=(label,action)=>{
  const button=document.createElement('button');
  button.type='button';
  button.textContent=label;
  button.addEventListener('click',action);
  return button;
};

const storageKey='sunpetal-life-v1';
const recipes=[
  {id:'moonlaceTea',name:'Moonlace tea',needs:{moonlace:2},duration:25,price:30},
  {id:'tideglowStew',name:'Tideglow stew',needs:{moonlace:1,starkelp:1},duration:45,price:55}
];
const tabs=['Wardrobe','Garden','Market','Boutique','Home','Kitchen','Explore','Workshop'];
// Prices in shells. The first outfit is free, and any look you already wear stays yours.
const outfitPrices={'Sea-Fairy':0};
const shellCap=999999999;
const starterShells=40;
const starterSeeds={moonlace:6,starkelp:4};
const maxHome=60;
const dailyPerShelf=4;
// Where the first five furniture pieces used to sit, so older saves keep their layout.
const legacySpots={starfishRug:[1.75,.25],pearlLamp:[-3.0,.35],coralPlanter:[3.0,.3],shellSofa:[-2.85,1.35,1],glamVanity:[3.05,1.65,3]};
const destination=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const lumaSwimTime=(from,to)=>Math.max(680,Math.round(destination(from,to)*130)+290);
const wholeNumber=value=>Number.isSafeInteger(value)&&value>=0;
const snap=value=>Math.round(value*4)/4;
const clampFloor=(x,z)=>({
  x:Math.min(roomFloor.right,Math.max(roomFloor.left,snap(x))),
  z:Math.min(roomFloor.front,Math.max(roomFloor.back,snap(z)))
});
let uidCounter=0;
const newUid=()=>'f'+Date.now().toString(36)+(uidCounter++).toString(36);

// The shelf changes every day at 8 am UTC, like Scrooge's store in Dreamlight Valley.
const shelfDay=now=>Math.floor((now-8*3600e3)/864e5);
export function dailyShelf(now=Date.now()) {
  let seed=shelfDay(now)*2654435761>>>0;
  const random=()=>{seed=(seed+0x6D2B79F5)>>>0;let t=seed;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};
  const pool=furnitureCatalog.filter(item=>item.daily);
  for(let i=pool.length-1;i>0;i--){
    const j=Math.floor(random()*(i+1));
    [pool[i],pool[j]]=[pool[j],pool[i]];
  }
  return pool.slice(0,dailyPerShelf);
}
const msUntilNewShelf=now=>(shelfDay(now)+1)*864e5+8*3600e3-now;

function validPlot(value) {
  if(!value||typeof value!=='object'||'readyAt' in value)return null;
  if(!value.crop)return {};
  const crop=cropById[value.crop];
  if(!crop||!Number.isInteger(value.watered)||value.watered<0||value.watered>crop.waters)return {};
  if(!Number.isFinite(value.until)||value.until<0)return {};
  const plot={crop:crop.id,watered:value.watered,until:value.until};
  if(Number.isFinite(value.tendAt)&&value.tendAt>0){
    plot.tendAt=value.tendAt;
    plot.tendDone=value.tendDone===true;
  }
  return plot;
}

export function loadLife() {
  const start={outfit:outfits[0].id,quality:matchMedia('(pointer:coarse)').matches?'low':'high',
    pantry:Object.fromEntries(crops.map(crop=>[crop.id,0])),seeds:{...starterSeeds},seedPick:'',
    packed:{moonlaceTea:0,tideglowStew:0},plots:reefLayout.fieldPlots.map(()=>null),discovered:[],meal:null,
    style:{pearlFound:false,charmMade:false,charmEquipped:false},
    shells:starterShells,owned:{outfits:[outfits[0].id]},home:[],stash:{}};
  try{
    const saved=JSON.parse(localStorage.getItem(storageKey));
    if(saved&&typeof saved==='object'){
      if(outfits.some(outfit=>outfit.id===saved.outfit)) start.outfit=saved.outfit;
      if(saved.quality==='low'||saved.quality==='high') start.quality=saved.quality;
      for(const {id} of crops){
        if(wholeNumber(saved.pantry?.[id])) start.pantry[id]=saved.pantry[id];
      }
      for(const {id} of recipes){
        if(wholeNumber(saved.packed?.[id])) start.packed[id]=saved.packed[id];
      }
      // A save from before seeds existed keeps its shells and gets a few starter seeds.
      if(saved.seeds&&typeof saved.seeds==='object'){
        start.seeds={};
        for(const {id} of crops){
          if(wholeNumber(saved.seeds[id])&&saved.seeds[id]>0) start.seeds[id]=saved.seeds[id];
        }
      }
      if(typeof saved.seedPick==='string'&&cropById[saved.seedPick]) start.seedPick=saved.seedPick;
      start.plots=start.plots.map((_,index)=>validPlot(saved.plots?.[index]));
      if(Array.isArray(saved.discovered)) start.discovered=saved.discovered.filter(value=>typeof value==='string');
      if(typeof saved.meal?.name==='string'&&Number.isFinite(saved.meal.until)) start.meal=saved.meal;
      start.style.charmMade=saved.style?.charmMade===true;
      start.style.pearlFound=start.style.charmMade||saved.style?.pearlFound===true;
      start.style.charmEquipped=start.style.charmMade&&saved.style?.charmEquipped===true;
      if(wholeNumber(saved.shells)) start.shells=Math.min(shellCap,saved.shells);
      if(Array.isArray(saved.owned?.outfits)){
        for(const id of saved.owned.outfits){
          if(outfits.some(outfit=>outfit.id===id)&&!start.owned.outfits.includes(id)) start.owned.outfits.push(id);
        }
      }
      if(!start.owned.outfits.includes(start.outfit)) start.owned.outfits.push(start.outfit);
      const seen=new Set();
      if(Array.isArray(saved.home)){
        for(const entry of saved.home){
          if(start.home.length>=maxHome||!furnitureById[entry?.id]||typeof entry.uid!=='string'||entry.uid.length>40||seen.has(entry.uid))continue;
          if(!Number.isFinite(entry.x)||!Number.isFinite(entry.z))continue;
          seen.add(entry.uid);
          start.home.push({uid:entry.uid,id:entry.id,...clampFloor(entry.x,entry.z),rot:Number.isInteger(entry.rot)?((entry.rot%4)+4)%4:0});
        }
      }else if(Array.isArray(saved.owned?.furniture)){
        for(const id of saved.owned.furniture){
          const spot=legacySpots[id];
          if(spot&&!start.home.some(item=>item.id===id)) start.home.push({uid:newUid(),id,x:spot[0],z:spot[1],rot:spot[2]??0});
        }
      }
      if(saved.stash&&typeof saved.stash==='object'){
        for(const {id} of furnitureCatalog){
          if(wholeNumber(saved.stash[id])&&saved.stash[id]>0) start.stash[id]=Math.min(99,saved.stash[id]);
        }
      }
    }
  }catch{}
  return start;
}

export function connectLife({state,getView,layout,player,walkTo,onOpen,canOpen,canExploreMoonlace,travelTo,
  openFarm,goToKitchen,cookingPoint,startCooking,goToWardrobe,wardrobePoint,startDecorating}) {
  const panel=document.querySelector('#life-panel');
  const content=panel.querySelector('#life-content');
  const buttons=panel.querySelector('#life-tabs');
  const note=document.querySelector('#life-note');
  const status=document.querySelector('#life-feedback');
  const lowGraphics=document.querySelector('#low-graphics');
  let section='Wardrobe',outfitRequest=0,noticeTimer,selectedUid='';
  let lumaButton;
  const landmarks=[
    {id:'shell',name:'Seashell Cottage',point:layout.cottageLanding,hint:'Sunpetal Plaza'},
    {id:'pool',name:'Shell Fountain',point:{x:-9.9,z:3.4},hint:'Sunpetal Plaza'},
    {id:'shelf',name:'Moonlace Shelf',point:layout.shelf,hint:'Moonlace Reef'},
    {id:'grotto',name:'Glassfin Grotto',point:layout.grotto,hint:'Moonlace Reef'}
  ];

  const actions=document.querySelector('.actions');
  const pill=document.createElement('div');
  pill.id='shells';
  pill.className='shells';
  pill.setAttribute('aria-label','Shells');
  actions?.insertBefore(pill,document.querySelector('#life-open'));
  const seedChip=makeButton('',()=>{
    if(!currentSeed()){goToStall('seeds');return;}
    cycleSeed();
  });
  seedChip.id='seed-chip';
  seedChip.className='seedchip';
  seedChip.hidden=true;
  actions?.insertBefore(seedChip,pill);
  function refreshShells(){pill.textContent=state.shells.toLocaleString()+' shells';}
  function refreshSeedChip(){
    const id=currentSeed();
    seedChip.textContent=id?cropById[id].label+' seeds x'+state.seeds[id]:'No seeds';
  }
  function store() {
    try{localStorage.setItem(storageKey,JSON.stringify(state));}catch{}
    refreshShells();
    refreshSeedChip();
  }
  const near=point=>destination(player,point)<1.7;
  const farmAt=()=>player.space==='farm';

  function report(message) {
    status.textContent=message;
    status.hidden=false;
    clearTimeout(noticeTimer);
    noticeTimer=setTimeout(()=>{status.hidden=true;},4400);
  }

  function show(tab=section) {
    if(!getView()||!canOpen())return;
    if(tab!==section)note.textContent='';
    section=tab;
    if(!panel.open){
      onOpen();
      panel.showModal();
      panel.querySelector('#life-close').focus();
    }
    update();
  }

  function visit(point,tab) {
    panel.close();
    walkTo(point,tab?()=>show(tab):undefined);
  }

  const stations={
    workshop:{x:layout.station.x+.94,z:layout.station.z+.62}
  };
  const atMirror=()=>player.space==='cottage'&&near(wardrobePoint);
  function visitWardrobe(){
    if(atMirror()){show('Wardrobe');return;}
    panel.close();
    goToWardrobe(()=>show('Wardrobe'));
  }

  function give(name,detail) {
    const row=document.createElement('div');
    row.className='life-row';
    const info=document.createElement('div');
    const title=document.createElement('strong');
    title.textContent=name;
    const html=document.createElement('small');
    html.textContent=detail;
    info.append(title,html);
    row.append(info);
    return row;
  }

  function infoLine(text) {
    const p=document.createElement('p');
    p.className='life-summary';
    p.textContent=text;
    content.append(p);
  }

  function heading(text) {
    const title=document.createElement('h3');
    title.className='farm-crop-title';
    title.textContent=text;
    content.append(title);
  }

  const pantryLine=()=>'Pantry · '+(crops.filter(crop=>state.pantry[crop.id]>0).map(crop=>state.pantry[crop.id]+' '+crop.label.toLowerCase()).join(' · ')||'empty');

  function wardrobe(){
    infoLine('Choose a look for your playable character.');
    if(!atMirror()){
      const mirror=makeButton('Visit the mirror',visitWardrobe);
      mirror.className='life-route';
      content.append(mirror);
    }
    const grid=document.createElement('div');
    grid.className='outfit-grid';
    for(const outfit of outfits){
      const owned=state.owned.outfits.includes(outfit.id);
      const button=makeButton('',async()=>{
        if(!owned){show('Boutique');return;}
        const ticket=++outfitRequest;
        const oldLabel=label.textContent;
        label.textContent='Putting on…';
        const view=getView();
        const equipped=await view?.equip(outfit.id);
        if(ticket!==outfitRequest||view!==getView()) return;
        if(equipped){
          state.outfit=outfit.id;
          store();
          panel.close();
          report('Wearing '+outfit.name);
          update();
        }else{
          label.textContent=oldLabel;
          note.textContent='That look could not load. Try choosing it again.';
        }
      });
      button.setAttribute('aria-pressed',String(owned&&outfit.id===state.outfit));
      button.className='outfit-card'+(owned?'':' locked');
      const poster=document.createElement('img');
      poster.src=reefPosterUrl('./characters/'+outfit.id+'.webp');
      poster.alt='';
      const label=document.createElement('span');
      label.textContent=owned?outfit.name:outfit.name+' · '+(outfitPrices[outfit.id]??0)+' shells';
      button.append(poster,label);
      grid.append(button);
    }
    content.append(grid);
    const style=state.style;
    const accessory=give('Moonlace Charm',style.charmMade
      ? style.charmEquipped?'Equipped · Floats beside your wrist':'A pearl and gold wrist charm'
      : 'Collect a Moonlace Pearl and craft it at the Workshop.');
    accessory.append(style.charmMade
      ? makeButton(style.charmEquipped?'Remove charm':'Wear charm',()=>{
        style.charmEquipped=!style.charmEquipped;
        store();
        update();
      })
      :makeButton('Workshop',()=>show('Workshop')));
    content.append(accessory);
    const inspect=makeButton('View outfit',()=>{
      panel.close();
      getView()?.setFitting(true);
    });
    inspect.className='life-route';
    content.append(inspect);
  }

  // ---- The field: dig, plant, water, wait, harvest ----
  const reach=1.15,bulkReach=1.75,bulkMax=12;
  const tileDistance=index=>destination(player,layout.fieldPlots[index]);
  const stageOf=(index,now)=>tileStage(state.plots[index],now);
  const pendingTend=(index,now)=>state.plots[index]?.tendAt>now;

  function currentSeed() {
    const picked=state.seedPick;
    if(picked&&state.seeds[picked]>0)return picked;
    const next=crops.find(crop=>state.seeds[crop.id]>0);
    return next?next.id:'';
  }
  function cycleSeed() {
    const owned=crops.filter(crop=>state.seeds[crop.id]>0);
    if(!owned.length)return;
    const at=owned.findIndex(crop=>crop.id===currentSeed());
    state.seedPick=owned[(at+1)%owned.length].id;
    store();
    update();
  }

  function closestBed() {
    if(!farmAt())return -1;
    let nearest=-1,range=reach;
    layout.fieldPlots.forEach((_,index)=>{
      const distance=tileDistance(index);
      if(distance<range){nearest=index;range=distance;}
    });
    return nearest;
  }

  function tilesLike(index,now) {
    const stage=stageOf(index,now);
    const list=[index];
    const others=layout.fieldPlots.map((_,i)=>i).filter(i=>i!==index&&stageOf(i,now)===stage&&tileDistance(i)<bulkReach&&!pendingTend(i,now));
    others.sort((a,b)=>tileDistance(a)-tileDistance(b));
    return list.concat(others).slice(0,bulkMax);
  }

  function worldBedAction(index,now) {
    if(index<0)return {label:'Move onto the plots',disabled:true};
    const stage=stageOf(index,now);
    const count=stage===0||stage===1||stage===4||(stage===2&&!pendingTend(index,now))?tilesLike(index,now).length:1;
    const more=count>1?' '+count:'';
    if(stage===0)return {label:'Dig'+more};
    if(stage===1){
      const seed=currentSeed();
      if(!seed)return {label:'Get seeds'};
      return {label:'Plant '+(count>1?Math.min(count,state.seeds[seed])+' ':'')+cropById[seed].label};
    }
    if(stage===2)return pendingTend(index,now)?{label:'Luma is on it',disabled:true}:{label:'Water'+more};
    if(stage===3)return {label:'Growing · '+describeTime(state.plots[index].until-now),disabled:true};
    return {label:'Harvest'+more};
  }

  function waterTile(index,at) {
    const plot=state.plots[index];
    const crop=cropById[plot.crop];
    plot.watered++;
    plot.until=at+legMs(crop);
  }

  // Do the right thing for these tiles. Returns a short message, or '' if nothing happened.
  function work(indexes,now) {
    const stage=stageOf(indexes[0],now);
    if(stage===0){
      for(const i of indexes)state.plots[i]={};
      return indexes.length===1?'Dug a hole.':'Dug '+indexes.length+' holes.';
    }
    if(stage===1){
      const id=currentSeed();
      if(!id)return '';
      let planted=0;
      for(const i of indexes){
        if(!(state.seeds[id]>0))break;
        state.seeds[id]--;
        state.plots[i]={crop:id,watered:0,until:0};
        planted++;
      }
      if(state.seeds[id]<1)delete state.seeds[id];
      return 'Planted '+planted+' '+cropById[id].label.toLowerCase()+'. Water '+(planted===1?'it':'them')+' to start growing.';
    }
    if(stage===2){
      for(const i of indexes)waterTile(i,now);
      return indexes.length===1?'Watered.':'Watered '+indexes.length+' tiles.';
    }
    if(stage===4){
      const found={};
      let critical=false;
      for(const i of indexes){
        const crop=cropById[state.plots[i].crop];
        const lucky=Math.random()<.12;
        critical=critical||lucky;
        const amount=lucky?3:1;
        state.pantry[crop.id]+=amount;
        found[crop.label]=(found[crop.label]??0)+amount;
        state.plots[i]={};
      }
      const text=Object.entries(found).map(([name,count])=>count+' '+name.toLowerCase()).join(', ');
      return (critical?'Critical harvest! ':'Harvested ')+text+'.';
    }
    return '';
  }

  function celebrateTile(index,stage,message) {
    const id=state.plots[index]?.crop??currentSeed();
    const kind=stage===4?'harvest':stage===2?'tend':'plant';
    getView()?.celebrate?.(kind,{bed:index,color:id});
    return message;
  }

  // The big action button: do the same job on every matching tile within reach.
  function farmAction() {
    if(!farmAt())return;
    const now=Date.now();
    const index=closestBed();
    if(index<0)return;
    const stage=stageOf(index,now);
    if(stage===1&&!currentSeed()){goToStall('seeds');report('Buy seeds in the Market tab.');return;}
    if(stage===3||(stage===2&&pendingTend(index,now)))return;
    const targets=tilesLike(index,now);
    const message=work(targets,now);
    if(!message)return;
    celebrateTile(index,stage,message);
    store();
    report(message);
    note.textContent=message;
    update();
  }

  // Tapping a dug plot with more than one kind of seed asks which one goes in it.
  // New crops show up here on their own: they only need an entry in reef-crops.js.
  let seedPicker;
  function closeSeedPicker() {
    seedPicker?.remove();
    seedPicker=undefined;
  }
  function openSeedPicker(index,owned) {
    closeSeedPicker();
    const box=document.createElement('div');
    box.id='seed-picker';
    box.setAttribute('role','dialog');
    box.setAttribute('aria-label','Choose a seed');
    Object.assign(box.style,{position:'fixed',left:'50%',bottom:'max(86px,env(safe-area-inset-bottom))',transform:'translateX(-50%)',
      zIndex:'40',width:'min(92vw,360px)',maxHeight:'55vh',overflowY:'auto',padding:'10px',borderRadius:'18px',
      background:'linear-gradient(180deg,#5b2c86f2,#3a1a63f2)',border:'1px solid #ffc6f2aa',boxShadow:'0 10px 30px #0008',
      color:'#fff',font:'600 14px system-ui,sans-serif'});
    const title=document.createElement('div');
    title.textContent='Plant which seed here?';
    Object.assign(title.style,{padding:'2px 6px 8px',fontWeight:'800',fontSize:'15px'});
    box.append(title);
    for(const crop of owned){
      const row=document.createElement('button');
      row.type='button';
      Object.assign(row.style,{display:'flex',alignItems:'center',gap:'10px',width:'100%',margin:'0 0 6px',padding:'8px 10px',
        borderRadius:'14px',border:'1px solid #ffffff55',background:'#ffffff18',color:'#fff',font:'inherit',textAlign:'left',cursor:'pointer'});
      const dot=document.createElement('span');
      Object.assign(dot.style,{flex:'none',width:'26px',height:'26px',borderRadius:'50%',background:crop.bloom,border:'3px solid '+crop.leaf});
      const text=document.createElement('span');
      text.style.flex='1';
      text.textContent=crop.label+'  x'+state.seeds[crop.id];
      const detail=document.createElement('small');
      detail.style.display='block';
      detail.style.opacity='.8';
      detail.textContent=describeTime(crop.seconds*1000)+' · '+crop.waters+(crop.waters>1?' waterings':' watering')+' · sells '+crop.price;
      text.append(detail);
      row.append(dot,text);
      row.addEventListener('click',event=>{
        event.stopPropagation();
        state.seedPick=crop.id;
        closeSeedPicker();
        plantHere(index);
      });
      box.append(row);
    }
    const more=document.createElement('button');
    more.type='button';
    more.textContent='Get more seeds';
    Object.assign(more.style,{width:'48%',padding:'8px',borderRadius:'12px',border:'1px solid #ffffff44',background:'transparent',color:'#fff',font:'inherit',cursor:'pointer',marginRight:'4%'});
    more.addEventListener('click',()=>{closeSeedPicker();goToStall('seeds');});
    const cancel=document.createElement('button');
    cancel.type='button';
    cancel.textContent='Cancel';
    Object.assign(cancel.style,{width:'48%',padding:'8px',borderRadius:'12px',border:'1px solid #ffffff44',background:'transparent',color:'#fff',font:'inherit',cursor:'pointer'});
    cancel.addEventListener('click',closeSeedPicker);
    box.append(more,cancel);
    document.body.append(box);
    seedPicker=box;
  }
  function plantHere(index) {
    if(!farmAt()||tileDistance(index)>=reach+.35)return;
    const at=Date.now();
    if(stageOf(index,at)!==1)return;
    const message=work([index],at);
    if(!message)return;
    celebrateTile(index,1,message);
    store();
    report(message);
    note.textContent=message;
    update();
  }

  function useBed(index) {
    const now=Date.now();
    const run=()=>{
      if(!farmAt()||tileDistance(index)>=reach+.35)return;
      const at=Date.now();
      const stage=stageOf(index,at);
      if(stage===1&&!currentSeed()){goToStall('seeds');report('Buy seeds in the Market tab.');return;}
      if(stage===1){
        const owned=crops.filter(crop=>state.seeds[crop.id]>0);
        if(owned.length>1){openSeedPicker(index,owned);return;}
      }
      if(stage===3){report('Growing · '+describeTime(state.plots[index].until-at));return;}
      if(pendingTend(index,at)){report('Luma is on it.');return;}
      const message=work([index],at);
      if(!message)return;
      celebrateTile(index,stage,message);
      store();
      report(message);
      note.textContent=message;
      update();
    };
    if(tileDistance(index)<reach)run();
    else walkTo({...layout.fieldPlots[index].approach,farmBed:index},run);
    return now;
  }

  // Luma waters every thirsty tile, one after another.
  function settle(now) {
    let changed=false;
    state.plots.forEach((plot,index)=>{
      if(!plot?.tendAt||plot.tendDone||plot.tendAt>now)return;
      if(tileStage(plot,plot.tendAt)===2)waterTile(index,plot.tendAt);
      plot.tendDone=true;
      changed=true;
    });
    return changed;
  }

  function lumaTending(now) {
    return state.plots.some(plot=>plot?.tendAt>now);
  }

  function askLuma() {
    const now=Date.now();
    if(!farmAt()||lumaTending(now))return;
    const thirsty=layout.fieldPlots.flatMap((point,index)=>stageOf(index,now)===2?[{point,index,row:Math.floor(index/6)}]:[]);
    if(!thirsty.length){
      const message=state.plots.some(Boolean)?'Nothing is thirsty right now.':'Plant something first, then ask Luma to water it.';
      note.textContent=message;
      report(message);
      return;
    }
    thirsty.sort((a,b)=>a.row-b.row||(a.row%2?b.point.x-a.point.x:a.point.x-b.point.x));
    let from=layout.farmIsland.arrival,tendAt=now;
    for(const {point,index} of thirsty){
      tendAt+=lumaSwimTime(from,point);
      Object.assign(state.plots[index],{tendAt,tendDone:false});
      from=point;
    }
    store();
    note.textContent='Luma is watering '+thirsty.length+(thirsty.length===1?' tile.':' tiles.');
    report(note.textContent);
    getView()?.celebrate?.('ask');
    update();
  }

  function lumaWork(now) {
    let next,previous;
    layout.fieldPlots.forEach((point,index)=>{
      const tendAt=state.plots[index]?.tendAt;
      if(!tendAt)return;
      if(tendAt>now&&(!next||tendAt<next.tendAt))next={point,tendAt};
      if(tendAt<=now&&(!previous||tendAt>previous.tendAt))previous={point,tendAt};
    });
    if(!next)return;
    const close=previous&&next.tendAt-previous.tendAt===lumaSwimTime(previous.point,next.point);
    const from=close?previous.point:layout.farmIsland.arrival;
    const duration=lumaSwimTime(from,next.point);
    const fraction=Math.max(0,1-(next.tendAt-now)/duration);
    const progress=fraction*fraction*(3-2*fraction);
    return {x:from.x+(next.point.x-from.x)*progress,z:from.z+(next.point.z-from.z)*progress,
      heading:Math.atan2(next.point.x-from.x,next.point.z-from.z),pulse:Math.max(0,(fraction-.68)/.32)};
  }

  function garden() {
    lumaButton=undefined;
    infoLine(pantryLine());
    if(!farmAt()){
      infoLine('The Pearl Reef Sanctuary has 12 plots. Dig, plant, water and wait, then harvest and sell in the Market tab.');
      const route=makeButton('Swim to Farm Island',()=>{
        panel.close();
        openFarm();
      });
      route.className='life-route';
      content.append(route);
      return;
    }
    const now=Date.now();
    const counts=[0,0,0,0,0];
    layout.fieldPlots.forEach((_,i)=>counts[stageOf(i,now)]++);
    infoLine('Dug '+counts[1]+' · Thirsty '+counts[2]+' · Growing '+counts[3]+' · Ready '+counts[4]);
    infoLine('Tap sand to dig, tap a hole to plant your chosen seed, water it, then harvest when it blooms. The big button works on every matching tile near you.');
    lumaButton=makeButton(lumaTending(now)?'Luma is watering…':'Ask Luma to water',askLuma);
    lumaButton.className='life-route';
    lumaButton.disabled=lumaTending(now);
    content.append(lumaButton);
    heading('Your seeds');
    const seed=currentSeed();
    const owned=crops.filter(crop=>state.seeds[crop.id]>0);
    if(!owned.length)infoLine('No seeds left. Buy more in the Market tab.');
    for(const crop of owned){
      const row=give(crop.label+' · '+state.seeds[crop.id],crop.id===seed?'Planting this one':'Tap Use to plant this one');
      if(crop.id!==seed)row.append(makeButton('Use',()=>{state.seedPick=crop.id;store();update();}));
      content.append(row);
    }
    heading('Crop guide');
    for(const crop of crops){
      content.append(give(crop.label,describeTime(crop.seconds*1000)+' · '+crop.waters+(crop.waters>1?' waterings':' watering')+' · sells '+crop.price));
    }
  }

  const canCook=recipe=>Object.entries(recipe.needs).every(([name,count])=>state.pantry[name]>=count);
  const atStove=()=>player.space==='cottage'&&near(cookingPoint);
  function visitKitchen(){
    panel.close();
    goToKitchen(()=>show('Kitchen'));
  }
  function serve(recipe,base=Date.now()){
    state.meal={name:recipe.name,until:base+recipe.duration*1000};
    note.textContent=recipe.name+' ready. Swim speed increased.';
    report(recipe.name+' · '+recipe.duration+'s swim boost');
    getView()?.celebrate?.('meal');
  }

  function cook(recipe,pack=false){
    if(!atStove()){visitKitchen();return;}
    if(!canCook(recipe)||(pack&&state.packed[recipe.id]===Number.MAX_SAFE_INTEGER))return;
    if(!startCooking(()=>{
      for(const [name,count] of Object.entries(recipe.needs)) state.pantry[name]-=count;
      if(pack){
        state.packed[recipe.id]++;
        note.textContent=recipe.name+' packed. Open the Kitchen tab anywhere to eat it.';
        report(recipe.name+' packed');
      }else serve(recipe);
      store();
    }))return;
    panel.close();
    report('Cooking '+recipe.name.toLowerCase()+'…');
  }

  function eat(recipe){
    if(state.packed[recipe.id]<1)return;
    state.packed[recipe.id]--;
    serve(recipe,Math.max(Date.now(),state.meal?.until??0));
    store();
    update();
  }

  function kitchen(){
    infoLine(pantryLine());
    for(const recipe of recipes){
      const packed=state.packed[recipe.id];
      if(!packed)continue;
      const row=give(recipe.name,packed+' packed · '+recipe.duration+'s swim boost');
      row.append(makeButton('Eat',()=>eat(recipe)));
      content.append(row);
    }
    if(!atStove()){
      const route=makeButton('Go to cottage kitchen',visitKitchen);
      route.className='life-route';
      content.append(route);
    }
    for(const recipe of recipes){
      const ingredients=Object.entries(recipe.needs).map(([name,count])=>count+' '+name).join(' + ');
      const row=give(recipe.name,ingredients+' · swim speed for '+recipe.duration+'s');
      const button=makeButton('Cook',()=>cook(recipe));
      const pack=makeButton('Cook & pack',()=>cook(recipe,true));
      button.disabled=!atStove()||!canCook(recipe);
      pack.disabled=button.disabled||state.packed[recipe.id]===Number.MAX_SAFE_INTEGER;
      const actions=document.createElement('div');
      actions.className='life-row-actions';
      actions.append(button,pack);
      row.append(actions);
      content.append(row);
    }
  }

  function collectPearl(){
    if(state.style.pearlFound||!canExploreMoonlace()||!near(layout.moonlacePearl))return;
    state.style.pearlFound=true;
    store();
    report('Moonlace Pearl found');
    getView()?.celebrate?.('pearl');
    note.textContent='Bring your pearl to the Plaza Workshop.';
    update();
  }

  function findPearl(){
    if(state.style.pearlFound||!canExploreMoonlace())return;
    if(near(layout.moonlacePearl)){
      collectPearl();
      return;
    }
    panel.close();
    if(player.x<8)travelTo('reef');
    else walkTo(layout.moonlacePearl,collectPearl);
  }

  function explore(){
    const pearl=state.style.pearlFound;
    const unlocked=canExploreMoonlace();
    const souvenir=give('Moonlace Pearl',pearl?'Found along the path to Glassfin Grotto.'
      :unlocked?'Look for an open shell on the path to Glassfin Grotto.':'Ride Luma’s first current to unlock this find.');
    if(pearl)souvenir.append(makeButton('Workshop',()=>show('Workshop')));
    else if(unlocked){
      const label=near(layout.moonlacePearl)?'Collect pearl':player.x<8?'Travel to Moonlace':'Find pearl';
      souvenir.append(makeButton(label,findPearl));
    }
    content.append(souvenir);
    infoLine(state.discovered.length+' / '+landmarks.length+' places discovered');
    for(const landmark of landmarks){
      const visited=state.discovered.includes(landmark.id);
      const row=give(landmark.name,visited?landmark.hint+' · Discovered':landmark.hint);
      row.append(makeButton('Visit',()=>visit(landmark.point)));
      content.append(row);
    }
  }

  function workshop(){
    const style=state.style;
    const row=give('Moonlace Charm',style.charmMade?'Crafted · Available in your Wardrobe'
      :style.pearlFound?'Moonlace Pearl · 1 needed, 1 found':'Moonlace Pearl · 1 needed, 0 found');
    if(style.charmMade)row.append(makeButton('Open Wardrobe',()=>show('Wardrobe')));
    else if(!style.pearlFound)row.append(makeButton('Find pearl',()=>show('Explore')));
    else if(player.x>=8&&canExploreMoonlace())row.append(makeButton('Return to the Plaza',()=>{
      panel.close();
      travelTo('home');
    }));
    else if(!near(stations.workshop))row.append(makeButton('Go to workshop',()=>visit(stations.workshop,'Workshop')));
    else row.append(makeButton('Craft charm',()=>{
      if(style.charmMade||!near(stations.workshop))return;
      style.charmMade=true;
      store();
      note.textContent='Moonlace Charm crafted. Put it on in your Wardrobe.';
      report('Moonlace Charm crafted');
      getView()?.celebrate?.('charm');
      update();
    }));
    content.append(row);
  }

  // ---- Shops ----
  // The Market and Boutique tabs are open from the Life menu anywhere. Stalls come later.
  const atStall=()=>true;
  const tabFor={seeds:'Market',sell:'Market',boutique:'Boutique'};
  function goToStall(id) {
    show(tabFor[id]??'Market');
  }
  function stallRoute() {}

  function buySeed(crop,count) {
    const total=crop.seed*count;
    if(state.shells<total)return;
    state.shells-=total;
    state.seeds[crop.id]=(state.seeds[crop.id]??0)+count;
    if(!state.seedPick)state.seedPick=crop.id;
    store();
    note.textContent='Bought '+count+' '+crop.label.toLowerCase()+' seed'+(count>1?'s':'')+'.';
    report(note.textContent);
    update();
  }

  const sellable=()=>[
    ...crops.map(crop=>({kind:'pantry',id:crop.id,label:crop.name,price:crop.price})),
    ...recipes.map(recipe=>({kind:'packed',id:recipe.id,label:recipe.name,price:recipe.price}))
  ].map(item=>({...item,count:state[item.kind][item.id]})).filter(item=>item.count>0);

  function sell(item,count) {
    if(!atStall('sell'))return;
    const amount=Math.min(count,state[item.kind][item.id]);
    if(amount<1)return;
    state[item.kind][item.id]-=amount;
    state.shells=Math.min(shellCap,state.shells+amount*item.price);
    store();
    note.textContent='Sold '+amount+' '+item.label.toLowerCase()+' for '+amount*item.price+' shells.';
    report(note.textContent);
    getView()?.celebrate?.('harvest');
    update();
  }

  function market() {
    infoLine('You have '+state.shells.toLocaleString()+' shells. Seeds cost shells, and everything you grow sells for more.');
    const seeds=atStall('seeds'),selling=atStall('sell');
    heading('Seeds');
    if(!seeds)stallRoute('seeds','Walk to the Seed Stall');
    for(const crop of crops){
      const row=give(crop.label+' seeds · '+crop.seed+' shells',
        describeTime(crop.seconds*1000)+' · '+crop.waters+(crop.waters>1?' waterings':' watering')+' · sells '+crop.price+' · you have '+(state.seeds[crop.id]??0));
      const group=document.createElement('div');
      group.className='life-row-actions';
      const one=makeButton('Buy 1',()=>buySeed(crop,1));
      const five=makeButton('Buy 5',()=>buySeed(crop,5));
      one.disabled=!seeds||state.shells<crop.seed;
      five.disabled=!seeds||state.shells<crop.seed*5;
      group.append(one,five);
      row.append(group);
      content.append(row);
    }
    heading('Sell crops');
    if(!selling)stallRoute('sell','Walk to the Sell Stall');
    const items=sellable();
    if(!items.length)infoLine('Nothing to sell yet. Harvest crops or pack a dish in the kitchen.');
    for(const item of items){
      const row=give(item.label,item.count+' · '+item.price+' shells each');
      const group=document.createElement('div');
      group.className='life-row-actions';
      const one=makeButton('Sell 1',()=>sell(item,1));
      one.disabled=!selling;
      group.append(one);
      if(item.count>1){
        const all=makeButton('Sell all',()=>sell(item,item.count));
        all.disabled=!selling;
        group.append(all);
      }
      row.append(group);
      content.append(row);
    }
  }

  // ---- Pearl Boutique and your home ----
  function buyOutfit(outfit) {
    const price=outfitPrices[outfit.id]??0;
    if(!atStall('boutique')||state.owned.outfits.includes(outfit.id)||state.shells<price)return;
    state.shells-=price;
    state.owned.outfits.push(outfit.id);
    store();
    note.textContent=outfit.name+' is yours. Put it on in your Wardrobe.';
    report(outfit.name+' bought');
    getView()?.celebrate?.('charm');
    update();
  }

  // The free spot closest to the middle of the room where a new piece fits without overlapping.
  function freeSpot(id) {
    const radius=furnitureRadius(furnitureById[id]);
    const spots=[];
    for(let z=roomFloor.back;z<=roomFloor.front;z+=.5){
      for(let x=roomFloor.left;x<=roomFloor.right;x+=.5)spots.push({x,z,d:Math.hypot(x,z-1.3)});
    }
    spots.sort((a,b)=>a.d-b.d);
    return spots.find(spot=>state.home.every(item=>
      Math.hypot(item.x-spot.x,item.z-spot.z)>(furnitureRadius(furnitureById[item.id])+radius)*.85+.1))??null;
  }
  function refreshHome() {
    getView()?.setFurniture?.(state.home,selectedUid);
  }

  function buyFurniture(item) {
    if(!atStall('boutique')||state.shells<item.price)return;
    const count=state.home.length+Object.values(state.stash).reduce((a,b)=>a+b,0);
    if(count>=maxHome){report('Your home is full.');return;}
    state.shells-=item.price;
    const spot=freeSpot(item.id);
    if(spot)state.home.push({uid:newUid(),id:item.id,x:spot.x,z:spot.z,rot:0});
    else state.stash[item.id]=(state.stash[item.id]??0)+1;
    store();
    refreshHome();
    note.textContent=item.name+(spot?' is in your cottage. Open Home to move it.':' is in your stash. Open Home to place it.');
    report(item.name+' bought');
    getView()?.celebrate?.('charm');
    update();
  }

  function priceRow(item,detail) {
    const have=state.home.filter(piece=>piece.id===item.id).length+(state.stash[item.id]??0);
    const row=give(item.name+(have?' · you have '+have:''),item.price.toLocaleString()+' shells · '+(detail??item.about));
    const buy=makeButton('Buy',()=>buyFurniture(item));
    buy.disabled=!atStall('boutique')||state.shells<item.price;
    row.append(buy);
    content.append(row);
  }

  function boutique() {
    const now=Date.now();
    infoLine('You have '+state.shells.toLocaleString()+' shells.');
    if(!atStall('boutique'))stallRoute('boutique','Walk to the Pearl Boutique');
    heading('Today’s shelf');
    infoLine('New pieces arrive in '+describeTime(msUntilNewShelf(now))+'.');
    for(const item of dailyShelf(now))priceRow(item);
    heading('Always in stock');
    for(const item of furnitureCatalog.filter(piece=>!piece.daily))priceRow(item);
    heading('Looks');
    for(const outfit of outfits){
      const price=outfitPrices[outfit.id]??0;
      const owned=state.owned.outfits.includes(outfit.id);
      const row=give(outfit.name,owned?'Yours · Wear it in the Wardrobe':price.toLocaleString()+' shells');
      if(owned)row.append(makeButton('Wardrobe',()=>show('Wardrobe')));
      else{
        const buy=makeButton('Buy',()=>buyOutfit(outfit));
        buy.disabled=!atStall('boutique')||state.shells<price;
        row.append(buy);
      }
      content.append(row);
    }
  }

  function sellBack(id) {
    const item=furnitureById[id];
    if(!item||!(state.stash[id]>0))return;
    state.stash[id]--;
    if(!state.stash[id])delete state.stash[id];
    const refund=Math.floor(item.price*.75);
    state.shells=Math.min(shellCap,state.shells+refund);
    store();
    note.textContent='Sold '+item.name.toLowerCase()+' back for '+refund+' shells.';
    report(note.textContent);
    update();
  }

  function home() {
    infoLine(state.home.length+' piece'+(state.home.length===1?'':'s')+' in your cottage. Furniture sells back for 75% of what you paid, once it is in your stash.');
    const decorate=makeButton('Decorate cottage',()=>{panel.close();startDecorating?.('');});
    decorate.className='life-route';
    content.append(decorate);
    const stashed=furnitureCatalog.filter(item=>state.stash[item.id]>0);
    heading('Stash');
    if(!stashed.length)infoLine('Nothing in your stash. Store a piece while decorating to see it here.');
    for(const item of stashed){
      const row=give(item.name+' · '+state.stash[item.id],'Place it anywhere in the cottage');
      const group=document.createElement('div');
      group.className='life-row-actions';
      group.append(makeButton('Place',()=>{panel.close();startDecorating?.(item.id);}),
        makeButton('Sell '+Math.floor(item.price*.75),()=>sellBack(item.id)));
      row.append(group);
      content.append(row);
    }
  }

  // The furniture helpers below are used by the decorating mode in reef-decorate.js.
  function placeItem(id,x,z) {
    if(!(state.stash[id]>0)||state.home.length>=maxHome)return '';
    const spot=clampFloor(x,z);
    state.stash[id]--;
    if(!state.stash[id])delete state.stash[id];
    const uid=newUid();
    state.home.push({uid,id,...spot,rot:0});
    selectedUid=uid;
    store();
    refreshHome();
    return uid;
  }
  function moveItem(uid,x,z) {
    const item=state.home.find(piece=>piece.uid===uid);
    if(!item)return;
    Object.assign(item,clampFloor(x,z));
    store();
    refreshHome();
  }
  function rotateItem(uid) {
    const item=state.home.find(piece=>piece.uid===uid);
    if(!item)return;
    item.rot=(item.rot+1)%4;
    store();
    refreshHome();
  }
  function storeItem(uid) {
    const at=state.home.findIndex(piece=>piece.uid===uid);
    if(at<0)return;
    const [item]=state.home.splice(at,1);
    state.stash[item.id]=(state.stash[item.id]??0)+1;
    if(selectedUid===uid)selectedUid='';
    store();
    refreshHome();
  }
  function selectItem(uid) {
    selectedUid=uid;
    refreshHome();
  }

  const draw={Wardrobe:wardrobe,Garden:garden,Market:market,Boutique:boutique,Home:home,Kitchen:kitchen,Explore:explore,Workshop:workshop};
  for(const tab of tabs){
    buttons.append(makeButton(tab,()=>{
      section=tab;
      note.textContent='';
      update();
    }));
  }

  function update(){
    if(!farmAt())closeSeedPicker();
    if(!panel.open)return;
    [...buttons.children].forEach((button,index)=>{
      button.setAttribute('aria-pressed',String(tabs[index]===section));
    });
    content.replaceChildren();
    draw[section]();
  }

  function tick(now){
    for(const landmark of landmarks){
      if(!state.discovered.includes(landmark.id)&&near(landmark.point)){
        state.discovered.push(landmark.id);
        store();
        report('Discovered '+landmark.name);
      }
    }
    if(settle(now)){store();update();}
    seedChip.hidden=!farmAt();
  }

  refreshShells();
  refreshSeedChip();
  lowGraphics.checked=state.quality==='low';
  lowGraphics.addEventListener('change',()=>{
    state.quality=lowGraphics.checked?'low':'high';
    getView()?.setQuality(state.quality);
    store();
  });
  document.querySelector('#life-open').addEventListener('click',()=>show());
  panel.querySelector('#life-close').addEventListener('click',()=>panel.close());
  return {
    panel,show,tick,visitWardrobe,findPearl,closestBed,worldBedAction,useBed,farmAction,lumaWork,lumaTending,askLuma,
    goToStall,placeItem,moveItem,rotateItem,storeItem,selectItem,refreshHome,
    get crops(){
      const now=Date.now();
      return state.plots.map(plot=>({s:tileStage(plot,now),c:plot?.crop??'',p:tileProgress(plot,now)}));
    },
    get speedBoost(){return state.meal?.until>Date.now()?1.13:1;},
    get shells(){return state.shells;},
    get home(){return state.home;},
    get stash(){return state.stash;},
    get selected(){return selectedUid;},
    stashCount:id=>state.stash[id]??0
  };
}
