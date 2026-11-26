import { outfits } from './reef-avatar.js';
import { reefPosterUrl } from './reef-model-loader.js';
import { reefLayout } from './reef-layout.js';

const makeButton=(label,action)=>{
  const button=document.createElement('button');
  button.type='button';
  button.textContent=label;
  button.addEventListener('click',action);
  return button;
};

const storageKey='sunpetal-life-v1';
const crops=[
  {id:'moonlace',label:'Moonlace',name:'Moonlace blossoms',yield:3,seconds:9},
  {id:'starkelp',label:'Starkelp',name:'Starkelp fronds',yield:2,seconds:12}
];
const recipes=[
  {id:'moonlaceTea',name:'Moonlace tea',needs:{moonlace:2},duration:25},
  {id:'tideglowStew',name:'Tideglow stew',needs:{moonlace:1,starkelp:1},duration:45}
];
const tabs=['Wardrobe','Garden','Kitchen','Explore','Workshop'];
const destination=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const lumaSwimTime=(from,to)=>Math.max(680,Math.round(destination(from,to)*130)+290);

export function loadLife() {
  const start={outfit:outfits[0].id,quality:matchMedia('(pointer:coarse)').matches?'low':'high',
    pantry:{moonlace:0,starkelp:0},packed:{moonlaceTea:0,tideglowStew:0},plots:reefLayout.fieldPlots.map(()=>null),discovered:[],meal:null,
    style:{pearlFound:false,charmMade:false,charmEquipped:false}};
  try{
    const saved=JSON.parse(localStorage.getItem(storageKey));
    if(saved&&typeof saved==='object'){
      if(outfits.some(outfit=>outfit.id===saved.outfit)) start.outfit=saved.outfit;
      if(saved.quality==='low'||saved.quality==='high') start.quality=saved.quality;
      for(const {id} of crops){
        if(Number.isSafeInteger(saved.pantry?.[id])&&saved.pantry[id]>=0) start.pantry[id]=saved.pantry[id];
      }
      for(const {id} of recipes){
        if(Number.isSafeInteger(saved.packed?.[id])&&saved.packed[id]>=0) start.packed[id]=saved.packed[id];
      }
      start.plots=start.plots.map((_,index)=>{
        const value=saved.plots?.[index];
        if(!value||!Number.isFinite(value.readyAt)||value.readyAt<0)return null;
        const plot={readyAt:value.readyAt};
        if(Number.isFinite(value.tendAt)&&value.tendAt>0&&value.tendAt<value.readyAt)plot.tendAt=value.tendAt;
        return plot;
      });
      if(Array.isArray(saved.discovered)) start.discovered=saved.discovered.filter(value=>typeof value==='string');
      if(typeof saved.meal?.name==='string'&&Number.isFinite(saved.meal.until)) start.meal=saved.meal;
      start.style.charmMade=saved.style?.charmMade===true;
      start.style.pearlFound=start.style.charmMade||saved.style?.pearlFound===true;
      start.style.charmEquipped=start.style.charmMade&&saved.style?.charmEquipped===true;
    }
  }catch{}
  return start;
}

export function connectLife({state,getView,layout,player,walkTo,onOpen,canOpen,canExploreMoonlace,travelTo,
  openFarm,goToKitchen,cookingPoint,startCooking,goToWardrobe,wardrobePoint}) {
  const panel=document.querySelector('#life-panel');
  const content=panel.querySelector('#life-content');
  const buttons=panel.querySelector('#life-tabs');
  const note=document.querySelector('#life-note');
  const status=document.querySelector('#life-feedback');
  const lowGraphics=document.querySelector('#low-graphics');
  let section='Wardrobe',outfitRequest=0,renderTime=0,noticeTimer;
  let gardenRows=[],lumaButton;
  const landmarks=[
    {id:'shell',name:'Waterfall Shell Cottage',point:{x:-13.1,z:.21},hint:'Sunpetal Homebase'},
    {id:'pool',name:'Pearl Tidepool',point:{x:-7.5,z:1.65},hint:'Sunpetal Homebase'},
    {id:'shelf',name:'Moonlace Shelf',point:layout.shelf,hint:'Moonlace Reef'},
    {id:'grotto',name:'Glassfin Grotto',point:layout.grotto,hint:'Moonlace Reef'}
  ];

  function store() {
    try{localStorage.setItem(storageKey,JSON.stringify(state));}catch{}
  }
  const near=point=>destination(player,point)<1.7;

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
      const button=makeButton('',async()=>{
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
      button.setAttribute('aria-pressed',String(outfit.id===state.outfit));
      button.className='outfit-card';
      const poster=document.createElement('img');
      poster.src=reefPosterUrl('./characters/'+outfit.id+'.webp');
      poster.alt='';
      const label=document.createElement('span');
      label.textContent=outfit.name;
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

  const bedDistance=bed=>Math.min(destination(player,bed),destination(player,bed.approach));
  const nearBed=index=>player.space==='farm'&&bedDistance(layout.fieldPlots[index])<1.7;

  function closestBed(){
    if(player.space!=='farm')return -1;
    let nearest=-1,range=1.7;
    layout.fieldPlots.forEach((bed,index)=>{
      const distance=bedDistance(bed);
      if(distance<range){nearest=index;range=distance;}
    });
    return nearest;
  }

  function bedState(index,now){
    const plot=state.plots[index];
    if(!plot)return {action:'plant',detail:'Empty garden bed',button:'Sow'};
    if(!plot.readyAt)return {action:'tend',detail:'Sprouts ready to tend',button:'Tend'};
    if(plot.tendAt>now)return {detail:'Waiting for Luma',button:'Queued'};
    if(plot.readyAt>now)return {detail:'Growing · '+Math.ceil((plot.readyAt-now)/1000)+'s',button:'Growing'};
    return {action:'harvest',detail:'Ready to harvest',button:'Harvest'};
  }

  const bedCrop=index=>crops.find(crop=>crop.id===layout.fieldPlots[index].crop);

  function worldBedAction(index,now){
    if(index<0)return {label:'Tap a bed',disabled:true};
    const plot=bedState(index,now);
    const label=plot.action==='plant'?'Plant':plot.button;
    return {label:plot.action?label+' '+bedCrop(index).label:plot.detail,disabled:!plot.action};
  }

  function visitBed(index){
    const {approach}=layout.fieldPlots[index];
    const showBed=()=>{
      show('Garden');
      gardenRows.find(row=>row.index===index)?.button.focus();
    };
    if(nearBed(index))showBed();
    else{
      panel.close();
      walkTo(approach,showBed);
    }
  }

  function grow(index){
    if(!nearBed(index))return;
    const now=Date.now();
    const {action,detail}=bedState(index,now);
    const crop=bedCrop(index);
    let message;
    if(action==='plant'){
      state.plots[index]={readyAt:0};
      message=crop.name+' planted.';
    }else if(action==='tend'){
      state.plots[index].readyAt=now+crop.seconds*1000;
      message=crop.name+' tended.';
    }else if(action==='harvest'){
      state.plots[index]=null;
      state.pantry[crop.id]+=crop.yield;
      message='Harvested '+crop.yield+' '+crop.name.toLowerCase()+'.';
    }else{
      if(!panel.open)report(detail);
      return;
    }
    note.textContent=message;
    store();
    getView()?.celebrate?.(action,{bed:index,color:crop.id});
    if(!panel.open||action==='harvest')report(message);
    update();
  }

  function useBed(index){
    if(nearBed(index))grow(index);
    else walkTo({...layout.fieldPlots[index].approach,farmBed:index},()=>grow(index));
  }

  function lumaTending(now){
    return state.plots.some(plot=>plot?.tendAt>now);
  }

  function askLuma(){
    const now=Date.now();
    if(player.space!=='farm'||lumaTending(now))return;
    const beds=layout.fieldPlots.flatMap((point,index)=>{
      const plot=state.plots[index];
      return plot&&plot.readyAt===0?[{point,index,row:Math.floor(index/4)}]:[];
    });
    if(!beds.length){
      const message=state.plots.some(Boolean)
        ?'These beds are already tended. Plant another bed for Luma to help.'
        :'Plant a bed first, then ask Luma to tend it.';
      note.textContent=message;
      report(message);
      return;
    }
    beds.sort((a,b)=>a.row-b.row||(a.row%2?b.point.x-a.point.x:a.point.x-b.point.x));
    let from=layout.farmIsland.arrival,tendAt=now;
    for(const {point,index} of beds){
      tendAt+=lumaSwimTime(from,point);
      const crop=crops.find(({id})=>id===point.crop);
      state.plots[index]={tendAt,readyAt:tendAt+crop.seconds*750};
      from=point;
    }
    store();
    note.textContent='Luma is tending '+beds.length+(beds.length===1?' bed.':' beds.');
    report(note.textContent);
    getView()?.celebrate?.('ask');
    update();
  }

  function lumaWork(now){
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

  function garden(){
    infoLine('Pantry · '+state.pantry.moonlace+' moonlace · '+state.pantry.starkelp+' starkelp');
    gardenRows=[];
    lumaButton=undefined;
    if(player.space!=='farm'){
      infoLine('Sunpetal Farm Island has six beds for each crop. Grow them for your pantry and cottage kitchen.');
      const route=makeButton('Swim to Farm Island',()=>{
        panel.close();
        openFarm();
      });
      route.className='life-route';
      content.append(route);
      return;
    }
    infoLine(state.plots.filter(Boolean).length+' of '+layout.fieldPlots.length+' beds planted');
    lumaButton=makeButton('Ask Luma to tend beds',askLuma);
    lumaButton.className='life-route';
    content.append(lumaButton);
    for(const crop of crops){
      const title=document.createElement('h3');
      title.className='farm-crop-title';
      title.textContent=crop.name;
      const grid=document.createElement('div');
      grid.className='farm-bed-grid';
      layout.fieldPlots.forEach(({crop:id,number},index)=>{
        if(id!==crop.id)return;
        const row=give('Bed '+number,'');
        const button=makeButton('',()=>nearBed(index)?grow(index):visitBed(index));
        row.append(button);
        grid.append(row);
        gardenRows.push({detail:row.querySelector('small'),button,index});
      });
      content.append(title,grid);
    }
    refreshGardenRows(Date.now());
  }

  function refreshGardenRows(now){
    if(lumaButton){
      const busy=lumaTending(now);
      lumaButton.disabled=busy;
      const label=busy?'Luma is tending beds…':'Ask Luma to tend beds';
      if(lumaButton.textContent!==label)lumaButton.textContent=label;
    }
    gardenRows.forEach(({detail,button,index})=>{
      const plot=bedState(index,now);
      const nearby=nearBed(index);
      const label=nearby?plot.button:'Go to bed';
      if(detail.textContent!==plot.detail) detail.textContent=plot.detail;
      if(button.textContent!==label) button.textContent=label;
      button.disabled=nearby&&!plot.action;
    });
    renderTime=now;
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
    infoLine('Pantry · '+state.pantry.moonlace+' moonlace · '+state.pantry.starkelp+' starkelp');
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
    note.textContent='Bring your pearl to the Homebase Workshop.';
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
    else if(player.x>=8&&canExploreMoonlace())row.append(makeButton('Return to Homebase',()=>{
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

  const draw={Wardrobe:wardrobe,Garden:garden,Kitchen:kitchen,Explore:explore,Workshop:workshop};
  for(const tab of tabs){
    buttons.append(makeButton(tab,()=>{
      section=tab;
      note.textContent='';
      update();
    }));
  }

  function update(){
    if(!panel.open)return;
    [...buttons.children].forEach((button,index)=>{
      button.setAttribute('aria-pressed',String(tabs[index]===section));
    });
    content.replaceChildren();
    draw[section]();
    renderTime=Date.now();
  }

  function tick(now){
    for(const landmark of landmarks){
      if(!state.discovered.includes(landmark.id)&&near(landmark.point)){
        state.discovered.push(landmark.id);
        store();
        report('Discovered '+landmark.name);
      }
    }
    if(panel.open&&section==='Garden'&&now-renderTime>350&&state.plots.some(plot=>plot?.readyAt>0)) refreshGardenRows(now);
  }

  lowGraphics.checked=state.quality==='low';
  lowGraphics.addEventListener('change',()=>{
    state.quality=lowGraphics.checked?'low':'high';
    getView()?.setQuality(state.quality);
    store();
  });
  document.querySelector('#life-open').addEventListener('click',()=>show());
  panel.querySelector('#life-close').addEventListener('click',()=>panel.close());
  return {
    panel,show,tick,visitWardrobe,findPearl,closestBed,worldBedAction,useBed,lumaWork,lumaTending,askLuma,
    get crops(){
      const now=Date.now();
      return state.plots.map(plot=>!plot?0:!plot.readyAt||plot.readyAt>now?1:2);
    },
    get speedBoost(){return state.meal?.until>Date.now()?1.13:1;}
  };
}
