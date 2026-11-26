// The market end of Farm Island: a seed stall, the Pearl Boutique and a sell stall, plus a
// few farm props. All of them are real 3D models from the KayKit Medieval Hexagon Pack
// (CC0), loaded from environment/props. Signs above each stall are drawn on a canvas.
import * as T from './vendor/three.module.min.js';
import { loadReefModel, hasReefModel } from './reef-model-loader.js';

const dir='./environment/props/hex-';
const cache=new Map();
function model(name) {
  const path=dir+name+'.glb';
  if(!hasReefModel(path))return Promise.reject(new Error('missing '+name));
  if(!cache.has(path))cache.set(path,loadReefModel(path).catch(error=>{cache.delete(path);throw error;}));
  return cache.get(path);
}

function place(parent,name,{x,z,y=.03,width,height,turn=0}) {
  const holder=new T.Group();
  holder.position.set(x,y,z);
  holder.rotation.y=turn;
  parent.add(holder);
  model(name).then(({scene})=>{
    const copy=scene.clone(true);
    copy.traverse(object=>{if(object.isMesh){object.castShadow=true;object.receiveShadow=true;}});
    const box=new T.Box3().setFromObject(copy);
    const size=box.getSize(new T.Vector3());
    copy.scale.multiplyScalar(width?width/size.x:height/size.y);
    box.setFromObject(copy);
    const center=box.getCenter(new T.Vector3());
    copy.position.set(-center.x,-box.min.y,-center.z);
    holder.add(copy);
  }).catch(()=>{});
  return holder;
}

function sign(text,color) {
  const canvas=document.createElement('canvas');
  canvas.width=512;canvas.height=160;
  const g=canvas.getContext('2d');
  g.fillStyle=color;
  g.beginPath();
  g.roundRect(8,8,496,144,70);
  g.fill();
  g.lineWidth=8;
  g.strokeStyle='#fff3b8';
  g.stroke();
  g.fillStyle='#ffffff';
  g.font='700 66px Georgia, serif';
  g.textAlign='center';
  g.textBaseline='middle';
  g.fillText(text,256,84);
  const texture=new T.CanvasTexture(canvas);
  texture.colorSpace=T.SRGBColorSpace;
  const sprite=new T.Sprite(new T.SpriteMaterial({map:texture,transparent:true,depthWrite:false}));
  sprite.scale.set(1.9,.6,1);
  return sprite;
}

export function createFarmstead(parent,layout) {
  const {farmIsland,stalls}=layout;
  const group=new T.Group();
  group.name='Sunpetal market';
  parent.add(group);
  const specs=[
    ['seeds','market-yellow',2.5,'Seeds','#c76a1f'],
    ['boutique','market-red',3.1,'Pearl Boutique','#b43a8f'],
    ['sell','market-blue',2.5,'Sell','#2b79b8']
  ];
  const hits=[];
  for(const [id,file,width,label,color] of specs){
    const stall=stalls[id];
    const local={x:stall.x-farmIsland.x,z:stall.z-farmIsland.z};
    place(group,file,{...local,width});
    const text=sign(label,color);
    text.position.set(local.x,2.2,local.z+.5);
    group.add(text);
    // A hidden box so a tap works even before the model has finished loading.
    const proxy=new T.Mesh(new T.BoxGeometry(width,1.4,1.7),new T.MeshBasicMaterial({visible:false}));
    proxy.position.set(local.x,.6,local.z);
    proxy.userData.stall=id;
    group.add(proxy);
    hits.push(proxy);
  }
  // Props: a water bucket for the field, a wheelbarrow and sacks by the sell stall, barrels
  // and a crate by the seed stall.
  place(group,'bucket',{x:-6.55,z:-.7,height:.34});
  place(group,'wheelbarrow',{x:6.85,z:-3.5,height:.62,turn:-.5});
  place(group,'sack',{x:6.55,z:-4.35,height:.34});
  place(group,'barrel',{x:-6.9,z:-4.3,height:.55});
  place(group,'crate-open',{x:-6.75,z:-3.35,height:.4,turn:.3});
  return {
    group,
    // Which stall, if any, is under the ray.
    hit(ray) {
      let found=null,nearest=Infinity;
      for(const proxy of hits){
        const point=ray.intersectBox(new T.Box3().setFromObject(proxy),new T.Vector3());
        if(!point)continue;
        const distance=ray.origin.distanceToSquared(point);
        if(distance<nearest){nearest=distance;found=proxy.userData.stall;}
      }
      return found;
    }
  };
}
