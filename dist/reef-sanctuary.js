import * as T from './vendor/three.module.min.js';
import { animateMeshyIsland } from './reef-sanctuary-motion.js';
import { sanctuaryGround } from './reef-sanctuary-ground.js';

// Joyce's Pearl Reef Sanctuary (Meshy model) is the home island.
// Model units: about 0.93 wide, ground level at y 0.1195, front facing +Z.
export const sanctuaryPlacement = { x:-12, z:1, scale:20, groundLevel:.11947 };

let heights=null;
function decode() {
  const binary=atob(sanctuaryGround.data);
  const bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
  heights=new Int16Array(bytes.buffer);
}

// Height of the walkable sanctuary surface at a world position. 0 off the island.
export function groundAt(x,z) {
  if(!heights) decode();
  const {size}=sanctuaryGround, {x:cx,z:cz,scale}=sanctuaryPlacement;
  const u=((x-cx)/scale+.5)*size-.5, v=((z-cz)/scale+.5)*size-.5;
  if(u<0||v<0||u>size-1||v>size-1) return 0;
  const i=Math.floor(u),k=Math.floor(v),fu=u-i,fv=v-k;
  const at=(a,b)=>heights[Math.min(size-1,b)*size+Math.min(size-1,a)]/1000;
  return (at(i,k)*(1-fu)+at(i+1,k)*fu)*(1-fv)+(at(i,k+1)*(1-fu)+at(i+1,k+1)*fu)*fv;
}

export function installSanctuary(scene,load) {
  let life=null;
  const holder=new T.Group();
  holder.name='Pearl Reef Sanctuary';
  scene.add(holder);
  const {x,z,scale,groundLevel}=sanctuaryPlacement;
  const ready=load('./environment/pearl-reef-sanctuary.glb').then(({scene:asset})=>{
    asset.scale.setScalar(scale);
    asset.position.set(x,-groundLevel*scale,z);
    asset.traverse(object=>{
      if(!object.isMesh) return;
      object.receiveShadow=true;
      object.castShadow=true;
      object.material.envMapIntensity=.55;
    });
    holder.add(asset);
    life=animateMeshyIsland(asset,{float:false});
    return true;
  }).catch(error=>{
    console.warn('Pearl Reef Sanctuary did not load',error);
    return false;
  });
  return {
    holder,
    ready,
    update(seconds,viewHeight){
      if(!life) return;
      life.setViewHeight(viewHeight);
      life.update(seconds);
    }
  };
}

// The sanctuary replaces the old built-from-shapes homebase. Hide what used to stand
// on it (ground, paths, deck, pool, planters, flower beds, lamps, coral and kelp)
// while leaving the story pieces that still live there.
const onHome=(x,z)=>((x-sanctuaryPlacement.x)/10.2)**2+((z-sanctuaryPlacement.z)/9.6)**2<1;
export function clearOldHome(objects,keep=new Set(),keepNear=[]) {
  const box=new T.Box3(),centre=new T.Vector3(),size=new T.Vector3();
  const matrix=new T.Matrix4(),point=new T.Vector3(),hidden=new T.Matrix4().makeScale(0,0,0);
  const kept=(px,pz)=>keepNear.some(spot=>Math.hypot(px-spot.x,pz-spot.z)<(spot.radius??1.2));
  let count=0;
  const visit=object=>{
    if(keep.has(object)||!object.visible||object.isLight||object.isCamera) return;
    if(object.isInstancedMesh){
      object.updateMatrixWorld(true);
      let changed=false;
      for(let i=0;i<object.count;i++){
        object.getMatrixAt(i,matrix);
        point.setFromMatrixPosition(matrix).applyMatrix4(object.matrixWorld);
        if(onHome(point.x,point.z)&&!kept(point.x,point.z)){object.setMatrixAt(i,hidden);changed=true;count++;}
      }
      if(changed){object.instanceMatrix.needsUpdate=true;object.computeBoundingSphere();}
      return;
    }
    box.setFromObject(object);
    if(box.isEmpty()) return;
    box.getCenter(centre);
    box.getSize(size);
    if(Math.max(size.x,size.z)<10){
      if(onHome(centre.x,centre.z)&&!kept(centre.x,centre.z)){object.visible=false;count++;}
      return;
    }
    for(const child of [...object.children]) visit(child);
  };
  for(const object of objects) visit(object);
  return count;
}
