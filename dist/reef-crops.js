// Everything about the crops you can grow. Times are real minutes, like Dreamlight Valley:
// plant a seed in a dug tile, water it, wait, then harvest. Crops with two waterings get
// thirsty again halfway through and stop growing until you water them.
//
// Add ?farmspeed=30 to the address to make crops grow 30 times faster while testing.
const speed=Number(new URLSearchParams(globalThis.location?.search??'').get('farmspeed'))||1;

export const crops=[
  {id:'moonlace',label:'Moonlace',name:'Moonlace blossoms',seconds:120,waters:1,seed:4,price:10,bloom:'#c78be5',leaf:'#5ec99f',shape:'petals'},
  {id:'starkelp',label:'Starkelp',name:'Starkelp fronds',seconds:180,waters:1,seed:7,price:16,bloom:'#69cac0',leaf:'#3b8f79',shape:'frond'},
  {id:'coralberry',label:'Coralberry',name:'Coralberries',seconds:300,waters:1,seed:12,price:30,bloom:'#ff6f9e',leaf:'#4fb58a',shape:'berry'},
  {id:'pearlbean',label:'Pearlbean',name:'Pearlbeans',seconds:600,waters:2,seed:26,price:70,bloom:'#f5ecd7',leaf:'#6bcf9a',shape:'berry'},
  {id:'sunbloom',label:'Sunbloom',name:'Sunblooms',seconds:1200,waters:2,seed:55,price:160,bloom:'#ffc94a',leaf:'#58b873',shape:'petals'},
  {id:'glimmermelon',label:'Glimmermelon',name:'Glimmermelons',seconds:2700,waters:2,seed:120,price:400,bloom:'#9fe8ff',leaf:'#3f9f86',shape:'berry'}
];
export const cropById=Object.fromEntries(crops.map(crop=>[crop.id,crop]));
export const legMs=crop=>crop.seconds*1000/crop.waters/speed;

// Tile stages: 0 bare sand, 1 dug hole, 2 planted and thirsty, 3 growing, 4 ready to harvest.
export function tileStage(plot,now) {
  if(!plot)return 0;
  if(!plot.crop)return 1;
  const crop=cropById[plot.crop];
  if(!crop)return 1;
  if(plot.until>now)return 3;
  return plot.watered>=crop.waters?4:2;
}

// 0 to 1 across the whole life of the plant, used to size it on the tile.
export function tileProgress(plot,now) {
  const crop=plot?.crop&&cropById[plot.crop];
  if(!crop)return 0;
  const leg=legMs(crop);
  const done=Math.max(0,plot.watered-1)*leg+(plot.until>now?leg-(plot.until-now):plot.watered>=1?leg:0);
  return Math.max(0,Math.min(1,done/(leg*crop.waters)));
}

export function describeTime(ms) {
  const total=Math.max(1,Math.ceil(ms/1000));
  if(total<90)return total+'s';
  const minutes=Math.ceil(total/60);
  if(minutes<90)return minutes+' min';
  return Math.floor(minutes/60)+' h '+String(minutes%60).padStart(2,'0')+' min';
}
