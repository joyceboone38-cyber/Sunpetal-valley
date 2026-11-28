// The Sunpetal seabed town: pure layout data and maths (no three.js), so the game, the walking
// rules and the top-down map all read the same numbers. Local metres: x east, z south (towards
// the town entrance). The town group sits at `seabedFrame` in the world.
export const seabedFrame={x:-20,z:2};

// Round wooden decks. `plaza` is the big central deck around the fountain.
export const seabedPads=[
  {id:'fountain',name:'Central Fountain / Plaza',zone:1,x:0,z:0,r:10.5,kind:'plaza'},
  {id:'boutique',name:'Boutique',zone:2,x:-26,z:8,r:7.2,kind:'shop'},
  {id:'crafting',name:'Crafting & Workshop',zone:3,x:-6,z:-25,r:7.2,kind:'shop'},
  {id:'kitchen',name:'Kitchen / Cafe',zone:4,x:21,z:-14,r:7.2,kind:'shop'},
  {id:'potion',name:'Potion / Alchemy',zone:5,x:31,z:7,r:7.2,kind:'shop'},
  {id:'townhall',name:'Town Hall / Orders',zone:6,x:15,z:29,r:8.4,kind:'shop'},
  {id:'homeL',name:'Homebase 1 (Player 1)',zone:0,x:-33,z:-33,r:8.4,kind:'home'},
  {id:'homeR',name:'Homebase 2 (Player 2)',zone:0,x:33,z:-33,r:8.4,kind:'home'},
  {id:'entrance',name:'Town Entrance',zone:0,x:0,z:50,r:4.6,kind:'gate'}
];

// Boardwalks as control points. Width is the full width in metres.
export const seabedPaths=[
  {id:'entrance',w:4.2,pts:[[0,50],[0,40],[0,28],[0,14]]},
  {id:'boutique',w:3.4,pts:[[-10,2],[-16,4],[-21,6],[-26,8]]},
  {id:'crafting',w:3.4,pts:[[-2,-10],[-4,-16],[-5,-21],[-6,-25]]},
  {id:'kitchen',w:3.4,pts:[[8,-7],[14,-9],[18,-12],[21,-14]]},
  {id:'potion',w:3.4,pts:[[10,2],[20,4],[26,6],[31,7]]},
  {id:'townhall',w:3.6,pts:[[6,9],[10,16],[13,23],[15,29]]},
  // The outskirt homes: long winding boardwalks, one from the Boutique side and one from the Kitchen side.
  {id:'homeL',w:2.6,pts:[[-26,8],[-37,3],[-43,-8],[-40,-18],[-36,-26],[-33,-33]]},
  {id:'homeR',w:2.6,pts:[[21,-14],[30,-17],[38,-20],[40,-27],[37,-31],[33,-33]]}
];

// Catmull-Rom through the control points, returned as evenly spaced samples with their heading.
export function samplePath(pts,step=.55){
  const P=[pts[0],...pts,pts[pts.length-1]];
  const dense=[];
  for(let i=1;i<P.length-2;i++){
    const [p0,p1,p2,p3]=[P[i-1],P[i],P[i+1],P[i+2]];
    for(let k=0;k<24;k++){
      const t=k/24,t2=t*t,t3=t2*t;
      dense.push([0,1].map(a=>.5*((2*p1[a])+(-p0[a]+p2[a])*t+(2*p0[a]-5*p1[a]+4*p2[a]-p3[a])*t2+(-p0[a]+3*p1[a]-3*p2[a]+p3[a])*t3)));
    }
  }
  dense.push(pts[pts.length-1]);
  const out=[];let carry=0;
  for(let i=0;i<dense.length-1;i++){
    const [a,b]=[dense[i],dense[i+1]];
    const len=Math.hypot(b[0]-a[0],b[1]-a[1]);
    if(len===0)continue;
    let at=carry?step-carry:0;
    while(at<=len){
      const f=at/len;
      out.push({x:a[0]+(b[0]-a[0])*f,z:a[1]+(b[1]-a[1])*f,heading:Math.atan2(b[0]-a[0],b[1]-a[1])});
      at+=step;
    }
    carry=len-(at-step);
  }
  return out;
}

const sampled=seabedPaths.map(path=>({...path,samples:samplePath(path.pts,.5)}));
export const seabedSamples=sampled;

// True where the town has a wooden floor under the point (world coordinates).
export function boardwalkAt(worldX,worldZ){
  const x=worldX-seabedFrame.x,z=worldZ-seabedFrame.z;
  for(const pad of seabedPads)if(Math.hypot(x-pad.x,z-pad.z)<=pad.r)return true;
  for(const path of sampled){
    const half=path.w/2;
    for(const s of path.samples)if(Math.abs(s.x-x)<=half&&Math.abs(s.z-z)<=half&&Math.hypot(s.x-x,s.z-z)<=half)return true;
  }
  return false;
}

export const deckHeight=.16;
export const seabedWorld=id=>{
  const pad=seabedPads.find(p=>p.id===id);
  return pad?{x:+(seabedFrame.x+pad.x).toFixed(2),z:+(seabedFrame.z+pad.z).toFixed(2)}:undefined;
};

// Things the swimmer cannot pass through (local metres, radius). The fountain basin is the first.
export const seabedSolids=[{id:'fountain',x:0,z:0,r:4.4}];
export const seabedSolidsWorld=seabedSolids.map(o=>({...o,x:seabedFrame.x+o.x,z:seabedFrame.z+o.z}));
