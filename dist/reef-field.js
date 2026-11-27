// The farm field: a grid of soft pink sand tiles. Each tile can be bare sand, a dug hole,
// a thirsty seedling, a growing plant or a ripe crop. Plants are small and low so a whole
// field reads clearly on a phone screen.
import * as T from './vendor/three.module.min.js';
import { crops, cropById } from './reef-crops.js';

const pi=Math.PI;
const half=.71;
let top=.12; // height of the plot surface above the island ground

function roundedSquare(size,radius) {
  const h=size/2,shape=new T.Shape();
  shape.moveTo(-h+radius,-h);
  shape.lineTo(h-radius,-h);
  shape.quadraticCurveTo(h,-h,h,-h+radius);
  shape.lineTo(h,h-radius);
  shape.quadraticCurveTo(h,h,h-radius,h);
  shape.lineTo(-h+radius,h);
  shape.quadraticCurveTo(-h,h,-h,h-radius);
  shape.lineTo(-h,-h+radius);
  shape.quadraticCurveTo(-h,-h,-h+radius,-h);
  return shape;
}

export function createField(parent,plots,origin,options={}) {
  // overlay: the island model already draws the plot tiles, so only soil, plants and drops are added.
  const overlay=Boolean(options.overlay);
  const scale=options.scale??1;
  if(options.surface!==undefined)top=options.surface;
  // Overlay tiles sit a hair above the model's own tiles so they fully cover them.
  if(overlay)top=.15;
  const group=new T.Group();
  group.name='Sunpetal sand field';
  parent.add(group);

  const tileGeometry=new T.ExtrudeGeometry(roundedSquare(half*2,.3),{
    depth:.05,bevelEnabled:true,bevelThickness:.05,bevelSize:.06,bevelSegments:4,curveSegments:8
  });
  tileGeometry.rotateX(-pi/2);
  const ripple=new T.CapsuleGeometry(.028,.95,3,6);
  ripple.rotateZ(pi/2);
  const holeGeometry=new T.SphereGeometry(1,16,10);
  const crumb=new T.SphereGeometry(1,8,6);
  const sand=new T.MeshStandardMaterial({color:'#dd86ac',roughness:.97,emissive:'#ff8fb8',emissiveIntensity:.05});
  const sandAlt=new T.MeshStandardMaterial({color:'#d77da5',roughness:.97,emissive:'#ff8fb8',emissiveIntensity:.05});
  const addedTile=new T.MeshStandardMaterial({color:'#7d4f38',roughness:.92});
  const panelMaterial=new T.MeshStandardMaterial({color:'#6b4130',roughness:.95});
  const goldMaterial=new T.MeshStandardMaterial({color:'#f0cf7a',roughness:.3,metalness:.65,emissive:'#b8842a',emissiveIntensity:.25});
  const pearlMaterial=new T.MeshStandardMaterial({color:'#fbe3ff',roughness:.3,emissive:'#e9b6ff',emissiveIntensity:.35});
  const seatMaterial=new T.MeshStandardMaterial({color:'#5a3426',roughness:.97});
  const panelGeometry=new T.ExtrudeGeometry(roundedSquare(half*1.62,.2),{depth:.01,bevelEnabled:false,curveSegments:8});
  panelGeometry.rotateX(-pi/2);
  const ringGeometry=new T.TorusGeometry(.5,.022,8,40);
  ringGeometry.rotateX(pi/2);
  const seatGeometry=new T.CircleGeometry(.47,32);
  seatGeometry.rotateX(-pi/2);
  const petalMark=new T.SphereGeometry(1,10,6);
  const studGeometry=new T.SphereGeometry(.045,10,8);
  const furrow=new T.MeshStandardMaterial({color:'#cc7a9c',roughness:.98});
  const soil=new T.MeshStandardMaterial({color:'#6e3447',roughness:.95});
  const soilWet=new T.MeshStandardMaterial({color:'#4f2338',roughness:.8});
  const stemGeometry=new T.CylinderGeometry(.025,.035,.5,6);
  const leafGeometry=new T.SphereGeometry(1,10,7);
  const bladeGeometry=new T.ConeGeometry(.07,.62,6);
  const petalGeometry=new T.SphereGeometry(1,10,7);
  const berryGeometry=new T.SphereGeometry(1,12,9);
  const dropGeometry=new T.ConeGeometry(.075,.19,10);
  const dropBall=new T.SphereGeometry(.085,12,9);
  const dropMaterial=new T.MeshBasicMaterial({color:'#9fe8ff',transparent:true,opacity:.92});
  const wilted=new T.MeshStandardMaterial({color:'#98a672',roughness:.9});
  const cropMaterials=new Map(crops.map(crop=>[crop.id,{
    leaf:new T.MeshStandardMaterial({color:crop.leaf,roughness:.7}),
    bloom:new T.MeshStandardMaterial({color:crop.bloom,emissive:crop.bloom,emissiveIntensity:.35,roughness:.4})
  }]));

  const tiles=plots.map((plot,index)=>{
    const root=new T.Group();
    root.position.set(plot.x-origin.x,0,plot.z-origin.z);
    root.rotation.y=plot.yaw??0;
    root.scale.setScalar(scale);
    group.add(root);
    if(!overlay){
      const base=new T.Mesh(tileGeometry,(index+Math.floor(index/6))%2?sand:sandAlt);
      base.position.y=.02;
      base.receiveShadow=true;
      root.add(base);
      for(const z of [-.34,.34]){
        const line=new T.Mesh(ripple,furrow);
        line.position.set(0,top+.004,z);
        root.add(line);
      }
    }else{
      // Every plot gets the same rich soil tile, with a gold ring, pearl petals and corner studs.
      const tile=new T.Mesh(tileGeometry,addedTile);
      tile.scale.set(1.04,.5,1.04);
      tile.position.y=top-.06;
      tile.receiveShadow=true;
      root.add(tile);
      const panel=new T.Mesh(panelGeometry,panelMaterial);
      panel.position.y=top-.012;
      root.add(panel);
      const marker=new T.Group();
      marker.position.y=top+.004;
      const seat=new T.Mesh(seatGeometry,seatMaterial);
      marker.add(seat);
      const ring=new T.Mesh(ringGeometry,goldMaterial);
      ring.position.y=.012;
      marker.add(ring);
      for(let i=0;i<8;i++){
        const angle=i*pi/4;
        const petal=new T.Mesh(petalMark,pearlMaterial);
        petal.scale.set(.09,.02,.05);
        petal.position.set(Math.cos(angle)*.64,.008,Math.sin(angle)*.64);
        petal.rotation.y=-angle;
        marker.add(petal);
      }
      for(const sx of [-1,1])for(const sz of [-1,1]){
        const stud=new T.Mesh(studGeometry,goldMaterial);
        stud.scale.y=.5;
        stud.position.set(sx*.58,.012,sz*.58);
        marker.add(stud);
      }
      root.add(marker);
    }
    const hole=new T.Group();
    const dirt=new T.Mesh(holeGeometry,soil);
    dirt.scale.set(.4,.06,.34);
    dirt.position.y=.0;
    hole.add(dirt);
    for(const [x,z,s] of [[-.43,.12,.07],[.42,-.1,.06],[.08,.4,.055],[-.2,-.4,.05]]){
      const piece=new T.Mesh(crumb,soil);
      piece.scale.set(s,s*.7,s);
      piece.position.set(x,-.01,z);
      hole.add(piece);
    }
    hole.position.y=top;
    hole.visible=false;
    root.add(hole);

    const plant=new T.Group();
    plant.position.y=top;
    plant.visible=false;
    root.add(plant);
    const stem=new T.Mesh(stemGeometry,wilted);
    stem.position.y=.25;
    plant.add(stem);
    const leaves=[-1,1].map(side=>{
      const leaf=new T.Mesh(leafGeometry,wilted);
      leaf.scale.set(.2,.06,.1);
      leaf.position.set(side*.16,.2,0);
      leaf.rotation.z=side*-.5;
      plant.add(leaf);
      return leaf;
    });
    const blades=[0,1,2].map(i=>{
      const blade=new T.Mesh(bladeGeometry,wilted);
      const angle=i*2*pi/3;
      blade.position.set(Math.cos(angle)*.1,.3,Math.sin(angle)*.1);
      blade.rotation.set(Math.sin(angle)*.35,0,-Math.cos(angle)*.35);
      blade.visible=false;
      plant.add(blade);
      return blade;
    });
    const bloom=new T.Group();
    bloom.position.y=.5;
    plant.add(bloom);
    const drop=new T.Group();
    const tip=new T.Mesh(dropGeometry,dropMaterial);
    tip.position.y=.1;
    const ball=new T.Mesh(dropBall,dropMaterial);
    drop.add(tip,ball);
    drop.position.y=top+.8;
    drop.scale.setScalar(1.7);
    drop.visible=false;
    root.add(drop);
    return {root,hole,dirt,plant,stem,leaves,blades,bloom,drop,shown:undefined,pop:undefined,crop:undefined};
  });

  function buildBloom(tile,crop) {
    tile.bloom.clear();
    const material=cropMaterials.get(crop.id).bloom;
    if(crop.shape==='berry'){
      for(const [x,y,z] of [[0,0,0],[.11,-.05,.04],[-.1,-.04,-.05],[.02,-.08,.12]]){
        const berry=new T.Mesh(berryGeometry,material);
        berry.scale.setScalar(.075);
        berry.position.set(x,y,z);
        tile.bloom.add(berry);
      }
    }else if(crop.shape==='frond'){
      const bud=new T.Mesh(berryGeometry,material);
      bud.scale.set(.07,.12,.07);
      tile.bloom.add(bud);
    }else{
      for(let i=0;i<5;i++){
        const angle=i*2*pi/5;
        const petal=new T.Mesh(petalGeometry,material);
        petal.scale.set(.1,.04,.07);
        petal.position.set(Math.cos(angle)*.11,0,Math.sin(angle)*.11);
        petal.rotation.y=-angle;
        tile.bloom.add(petal);
      }
      const center=new T.Mesh(berryGeometry,cropMaterials.get('sunbloom').bloom);
      center.scale.setScalar(.045);
      tile.bloom.add(center);
    }
  }

  function apply(tile,{s,c,p}) {
    const crop=cropById[c];
    tile.hole.visible=s>=1;
    tile.dirt.material=s>=3?soilWet:soil;
    tile.plant.visible=s>=2&&Boolean(crop);
    tile.drop.visible=s===2;
    if(!crop||s<2)return;
    const mats=cropMaterials.get(crop.id);
    if(tile.crop!==crop.id){
      tile.crop=crop.id;
      buildBloom(tile,crop);
    }
    const thirsty=s===2;
    const frond=crop.shape==='frond';
    tile.stem.visible=!frond;
    tile.leaves.forEach(leaf=>{leaf.visible=!frond;leaf.material=thirsty?wilted:mats.leaf;});
    tile.blades.forEach(blade=>{blade.visible=frond;blade.material=thirsty?wilted:mats.leaf;});
    tile.stem.material=thirsty?wilted:mats.leaf;
    tile.bloom.visible=s===4;
    const grown=s===4?1:.45+.45*p;
    tile.baseScale=thirsty?.38+.3*p:grown;
    tile.plant.scale.setScalar(tile.baseScale*1.7);
    tile.plant.rotation.z=thirsty?.28:0;
  }

  const state=[];
  return {
    group,
    update(list=[]) {
      tiles.forEach((tile,index)=>{
        const value=list[index]??{s:0,c:'',p:0};
        const key=value.s+'|'+value.c+'|'+(value.s===3?Math.round(value.p*20):0);
        if(state[index]===key)return;
        const first=state[index]===undefined;
        const before=state[index]?.split('|')[0];
        state[index]=key;
        apply(tile,value);
        if(!first&&before!==String(value.s)&&value.s>0)tile.pop=0;
      });
    },
    tick(dt,time=0) {
      tiles.forEach((tile,index)=>{
        if(tile.drop.visible)tile.drop.position.y=top+.82+Math.sin(time*3+index)*.06;
        if(tile.pop===undefined)return;
        tile.pop+=dt/.5;
        const u=Math.min(1,tile.pop);
        const spring=1+.3*(1-u)*Math.sin(u*pi*3.2);
        tile.root.scale.set(scale/Math.sqrt(spring),scale*spring,scale/Math.sqrt(spring));
        if(u>=1){tile.root.scale.setScalar(scale);tile.pop=undefined;}
      });
    }
  };
}
