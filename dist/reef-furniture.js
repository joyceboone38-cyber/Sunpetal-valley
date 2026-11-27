// Furniture for the cottage. Every piece is a real 3D model from the KayKit Furniture Bits
// pack by Kay Lousberg (CC0, free for any use), tinted to match the cottage palette.
// Pieces are bought at the Pearl Boutique and then placed anywhere in the room.
import * as T from './vendor/three.module.min.js';
import { loadReefModel, hasReefModel } from './reef-model-loader.js';

const dir='./environment/props/kk-';
const pink=(file,tint,width,extra={})=>({parts:[{file,tint,solid:true,width,...extra}]});
const wood=(file,tint,size,extra={})=>({parts:[{file,tint,...size,...extra}]});

// daily:true pieces only appear on the boutique's rotating daily shelf.
export const furnitureCatalog=[
  {id:'starfishRug',name:'Plush Rug',price:150,about:'A soft pink oval rug.',...pink('rug_oval_A','#ff74b6',2.3)},
  {id:'pearlLamp',name:'Standing Lamp',price:200,about:'A tall lamp that warms up a corner.',...wood('lamp_standing','#ffd9ec',{height:1.6})},
  {id:'coralPlanter',name:'Potted Cactus',price:300,about:'A cheerful cactus in a pot.',...wood('cactus_medium_A','#ffffff',{height:.95})},
  {id:'shellSofa',name:'Pillow Sofa',price:650,about:'A cozy pink sofa piled with pillows.',...pink('couch_pillows','#ff8fcb',1.9)},
  {id:'glamVanity',name:'Vanity Table',price:900,about:'A little table with a framed mirror.',parts:[
    {file:'table_small',tint:'#f6d6e8',solid:true,width:.95},
    {file:'pictureframe_standing_A',tint:'#ffffff',width:.5,y:.72,z:-.12}
  ]},
  {id:'lowTable',name:'Low Table',price:180,about:'A low table for tea with friends.',...pink('table_low','#f6d6e8',1.1)},
  {id:'floorPillow',name:'Floor Pillow',price:60,about:'A squishy pillow for the floor.',...pink('pillow_A','#ffb0dd',.6)},
  {id:'armchair',name:'Pillow Armchair',price:420,daily:true,about:'A plush chair with a pillow.',...pink('armchair_pillows','#ff9fd2',1.05)},
  {id:'singleBed',name:'Dream Bed',price:800,daily:true,about:'A bed made for sweet dreams.',...pink('bed_single_A','#ffb3de',2.1)},
  {id:'doubleBed',name:'Royal Bed',price:1400,daily:true,about:'A big bed for a big sleepover.',...pink('bed_double_A','#e98fd0',2.4)},
  {id:'treasureShelf',name:'Treasure Shelf',price:520,daily:true,about:'A shelf full of keepsakes.',...wood('shelf_B_large_decorated','#ffd9ec',{height:1.5})},
  {id:'tableLamp',name:'Table Lamp',price:110,daily:true,about:'A small glowing lamp.',...wood('lamp_table','#ffd9ec',{height:.55})},
  {id:'stripedRug',name:'Striped Rug',price:240,daily:true,about:'A long striped rug.',...wood('rug_rectangle_stripes_A','#ffb0dd',{width:2.2})},
  {id:'smallCactus',name:'Little Cactus',price:90,daily:true,about:'A tiny cactus for a tiny corner.',...wood('cactus_small_A','#ffffff',{height:.5})},
  {id:'cabinet',name:'Keepsake Cabinet',price:380,daily:true,about:'A cabinet with a pretty display.',...wood('cabinet_small_decorated','#ffc7e4',{width:1.1})},
  {id:'coffeeTable',name:'Coffee Table',price:260,daily:true,about:'A table for snacks and magazines.',...pink('table_medium','#f6d6e8',1.3)},
  {id:'chair',name:'Cozy Chair',price:140,daily:true,about:'A simple, comfy chair.',...pink('chair_A','#ff9fd2',.7)},
  {id:'bookStack',name:'Book Stack',price:70,daily:true,about:'A little stack of storybooks.',...wood('book_set','#ffffff',{width:.5})},
  {id:'mirrorFrame',name:'Mirror Frame',price:160,daily:true,about:'A standing frame for your favorite picture.',...wood('pictureframe_standing_B','#ffffff',{height:.8})}
];
export const furnitureById=Object.fromEntries(furnitureCatalog.map(item=>[item.id,item]));
// Roughly how much floor a piece covers, used to find a free spot for new purchases.
export const furnitureRadius=item=>Math.max(...item.parts.map(part=>part.width?part.width/2:.35));

// The part of the cottage floor where furniture can go. Local to the room, clear of the
// kitchen, the wardrobe and the doorway.
export const roomFloor={left:-3.7,right:3.7,back:-.7,front:3.0};

const cache=new Map();
function loadModel(file) {
  const path=dir+file+'.glb';
  if(!hasReefModel(path))return Promise.reject(new Error('missing '+file));
  if(!cache.has(path))cache.set(path,loadReefModel(path).catch(error=>{cache.delete(path);throw error;}));
  return cache.get(path);
}

function fit(model,{width,height}) {
  const box=new T.Box3().setFromObject(model);
  const size=box.getSize(new T.Vector3());
  model.scale.multiplyScalar(height?height/size.y:width/Math.max(size.x,size.z));
  box.setFromObject(model);
  const center=box.getCenter(new T.Vector3());
  model.position.set(-center.x,-box.min.y,-center.z);
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

function build(item) {
  const group=new T.Group();
  for(const part of item.parts){
    loadModel(part.file).then(({scene})=>{
      const model=scene.clone(true);
      const holder=new T.Group();
      holder.add(model);
      fit(model,part);
      dress(model,part.tint,part.solid);
      holder.position.set(0,part.y??0,part.z??0);
      group.add(holder);
    }).catch(()=>{});
  }
  return group;
}

export function createFurniture(parent) {
  const pieces=new Map();
  const pops=new Map();
  const ring=new T.Mesh(new T.TorusGeometry(.62,.035,8,40),new T.MeshBasicMaterial({color:'#fff3a8'}));
  ring.rotation.x=-Math.PI/2;
  ring.position.y=.03;
  ring.visible=false;
  parent.add(ring);
  let started=false;
  return {
    // Show exactly the pieces in `items`: {uid,id,x,z,rot}. New pieces spring in.
    setLayout(items,selected='') {
      const present=new Set();
      for(const entry of items){
        const item=furnitureById[entry.id];
        if(!item)continue;
        present.add(entry.uid);
        let piece=pieces.get(entry.uid);
        if(!piece){
          piece={group:build(item),id:entry.id};
          parent.add(piece.group);
          pieces.set(entry.uid,piece);
          piece.group.userData.uid=entry.uid;
          if(started)pops.set(entry.uid,0);
        }
        piece.group.position.set(entry.x,0,entry.z);
        piece.group.rotation.y=entry.rot*Math.PI/2;
        if(!pops.has(entry.uid))piece.group.scale.setScalar(1);
      }
      for(const [uid,piece] of pieces){
        if(present.has(uid))continue;
        parent.remove(piece.group);
        pieces.delete(uid);
        pops.delete(uid);
      }
      const chosen=pieces.get(selected);
      ring.visible=Boolean(chosen);
      if(chosen)ring.position.set(chosen.group.position.x,.03,chosen.group.position.z);
      started=true;
    },
    // The uid of the piece under the ray, if any.
    pick(ray) {
      let found='',nearest=Infinity;
      const hit=new T.Vector3();
      for(const [uid,piece] of pieces){
        const box=new T.Box3().setFromObject(piece.group);
        if(box.isEmpty())continue;
        if(!ray.intersectBox(box,hit))continue;
        const distance=ray.origin.distanceToSquared(hit);
        if(distance<nearest){nearest=distance;found=uid;}
      }
      return found;
    },
    tick(dt) {
      for(const [uid,time] of pops){
        const piece=pieces.get(uid);
        if(!piece){pops.delete(uid);continue;}
        const u=Math.min(1,time+dt/.6);
        const spring=u>=1?1:1-Math.exp(-6*u)*Math.cos(u*Math.PI*3.4);
        piece.group.scale.setScalar(Math.max(.01,spring));
        if(u>=1)pops.delete(uid);
        else pops.set(uid,u);
      }
      ring.rotation.z+=dt*.8;
    }
  };
}
