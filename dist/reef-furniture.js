// Furniture bought in the Shop. Every piece is a real 3D model from the KayKit Furniture Bits
// pack by Kay Lousberg (CC0, free for any use), tinted to match the cottage palette.
// Each piece has a fixed spot, picked to stay clear of the kitchen, wardrobe and doorway.
import * as T from './vendor/three.module.min.js';
import { loadReefModel, hasReefModel } from './reef-model-loader.js';

export const furnitureCatalog=[
  {id:'starfishRug',name:'Plush Rug',price:90,about:'A soft pink oval rug for the middle of the room.'},
  {id:'pearlLamp',name:'Standing Lamp',price:120,about:'A tall lamp that warms up the corner.'},
  {id:'coralPlanter',name:'Potted Cactus',price:180,about:'A cheerful cactus in a pot. Hard to overwater.'},
  {id:'shellSofa',name:'Pillow Sofa',price:320,about:'A cozy pink sofa piled with pillows, made for friends.'},
  {id:'glamVanity',name:'Vanity Table',price:420,about:'A little table with a framed mirror for getting ready.'}
];

const dir='./environment/props/kk-';
// parts: model file, tint, size to fit (height or width), offset inside the piece
const layout={
  starfishRug:{x:1.75,z:.25,parts:[{file:'rug_oval_A',tint:'#ff74b6',solid:true,width:2.3}]},
  pearlLamp:{x:-3.0,z:.35,parts:[{file:'lamp_standing',tint:'#ffd9ec',height:1.6}]},
  coralPlanter:{x:3.0,z:.3,parts:[{file:'cactus_medium_A',tint:'#ffffff',height:.95}]},
  shellSofa:{x:-2.85,z:1.35,turn:Math.PI/2,parts:[{file:'couch_pillows',tint:'#ff8fcb',solid:true,width:1.9}]},
  glamVanity:{x:3.05,z:1.65,turn:-Math.PI/2,parts:[
    {file:'table_small',tint:'#f6d6e8',solid:true,width:.95},
    {file:'pictureframe_standing_A',tint:'#ffffff',width:.5,y:.72,z:-.12}
  ]}
};

function fit(model,{width,height}) {
  const box=new T.Box3().setFromObject(model);
  const size=box.getSize(new T.Vector3());
  const scale=height?height/size.y:width/Math.max(size.x,size.z);
  model.scale.multiplyScalar(scale);
  box.setFromObject(model);
  model.position.y-=box.min.y;
  const center=box.getCenter(new T.Vector3());
  model.position.x-=center.x;
  model.position.z-=center.z;
}

function dress(model,tint,solid) {
  const color=new T.Color(tint);
  model.traverse(object=>{
    if(!object.isMesh)return;
    object.castShadow=true;
    object.receiveShadow=true;
    object.material=object.material.clone();
    if(solid){object.material.map=null;object.material.color.copy(color);}
    else object.material.color.multiply(color);
    object.material.roughness=.55;
  });
}

export function createFurniture(parent) {
  const pieces=new Map();
  const pops=new Map();
  for(const {id} of furnitureCatalog){
    const spec=layout[id];
    const group=new T.Group();
    group.name='Cottage '+id;
    group.visible=false;
    group.position.set(spec.x,0,spec.z);
    group.rotation.y=spec.turn??0;
    group.userData.base=1;
    parent.add(group);
    pieces.set(id,group);
    for(const part of spec.parts){
      const path=dir+part.file+'.glb';
      if(!hasReefModel(path))continue;
      loadReefModel(path).then(({scene})=>{
        const model=scene.clone(true);
        const holder=new T.Group();
        holder.add(model);
        fit(model,part);
        dress(model,part.tint,part.solid);
        holder.position.set(0,part.y??0,part.z??0);
        group.add(holder);
      }).catch(()=>{});
    }
  }
  let known=new Set(),started=false;
  return {
    // Show exactly the pieces in `owned`. Pieces bought since the last call spring in.
    setOwned(owned) {
      const next=new Set(owned);
      for(const [id,group] of pieces){
        const has=next.has(id);
        if(has&&started&&!known.has(id))pops.set(id,0);
        group.visible=has;
        if(!has)pops.delete(id);
        if(!pops.has(id))group.scale.setScalar(group.userData.base);
      }
      known=next;
      started=true;
    },
    tick(dt) {
      for(const [id,time] of pops){
        const group=pieces.get(id);
        const u=Math.min(1,time+dt/.6);
        const spring=u>=1?1:1-Math.exp(-6*u)*Math.cos(u*Math.PI*3.4);
        group.scale.setScalar(group.userData.base*Math.max(.01,spring));
        if(u>=1)pops.delete(id);
        else pops.set(id,u);
      }
    }
  };
}
