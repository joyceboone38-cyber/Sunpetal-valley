import * as T from './vendor/three.module.min.js';
import { loadReefModel } from './reef-model-loader.js';
import { makeCookingClip, makeReefGaits } from './character-gait.js';
import { prepareCharacterExpression } from './character-expression.js';
import { prepareCharacterFinish } from './character-finish.js';
import { buildMoonlaceCharm } from './reef-keepsake.js';
import { createSwimMotion } from './reef-motion.js';

export const outfits = [
  {id:'Ponytail-Fashion-Avatar',name:'Tideglass Couture'},
  {id:'Blossom-Fairy',name:'Blossom Fairy'},
  {id:'Tideglass-Witch',name:'Tideglass Witch'},
  {id:'Starwing-Fairy',name:'Starwing Fairy'}
];

function swimClip(model){
  const times=[0,.275,.55,.825,1.1],tracks=[];
  const axis=new T.Vector3(1,0,0);
  for(const [pattern,amplitude,offset] of [
    [/^Thigh/,.16,.12],[/^Shin/,.22,-.14],[/^Foot/,.11,.07],
    [/^UpperArm/,.25,-.38],[/^Forearm/,.14,-.18],[/^Chest$/,.08,0]
  ]){
    model.traverse(bone=>{
      if(!bone.isBone||!pattern.test(bone.name))return;
      const sign=bone.name.endsWith('R')?-1:1;
      const local=axis.clone().applyQuaternion(bone.getWorldQuaternion(new T.Quaternion()).invert());
      const values=times.flatMap(t=>bone.quaternion.clone().multiply(new T.Quaternion().setFromAxisAngle(
        local,offset+amplitude*Math.sin(t/1.1*Math.PI*2)*sign
      )).toArray());
      tracks.push(new T.QuaternionKeyframeTrack(bone.name+'.quaternion',times,values));
    });
  }
  return new T.AnimationClip('Channel Swim',1.1,tracks);
}

async function prepareOutfit(id) {
  const {scene:model,animations}=await loadReefModel('./characters/'+id+'.glb');
  model.updateMatrixWorld(true);
  const bounds=new T.Box3().setFromObject(model,true);
  const center=bounds.getCenter(new T.Vector3());
  const height=bounds.max.y-bounds.min.y;
  const gaits=makeReefGaits(model,height,id==='Tideglass-Witch'||id==='Starwing-Fairy');
  const expression=prepareCharacterExpression(model,id);
  const swim=swimClip(model);
  const cooking=makeCookingClip(model);
  model.position.set(-center.x,-bounds.min.y,-center.z);
  const pivot=new T.Group();
  pivot.add(model);
  const eyeLine=(expression.eyeHeight??bounds.min.y+height*.86)-bounds.min.y;
  // Scale by the wearer's eye line, so hats and wings do not resize their body.
  const factor=1.12/eyeLine;
  pivot.scale.setScalar(factor);
  prepareCharacterFinish(pivot)(true);
  const clips=new Map(animations.concat(gaits,swim).map(clip=>[clip.name,clip]));
  if(cooking)clips.set(cooking.name,cooking);
  return {
    pivot,clips,expression,height:height*factor,mixer:new T.AnimationMixer(pivot),
    wrist:model.getObjectByName('HandL')??model.getObjectByName('Hand.L')
  };
}

export function createAvatar(scene) {
  const actor=new T.Group();
  const body=new T.Group();
  actor.add(body);
  scene.add(actor);
  const cached=new Map();
  const wristPoint=new T.Vector3();
  const motion=createSwimMotion();
  let charm;
  let request=0,current,active,activeName,clock=0,lastTime=0,tilt=0,effort=0,loading=true;

  async function equip(id) {
    if(!outfits.some(outfit=>outfit.id===id)) return false;
    const ticket=++request;
    loading=true;
    if(!cached.has(id)){
      cached.set(id,prepareOutfit(id).catch(error=>{
        cached.delete(id);
        throw error;
      }));
    }
    try{
      const outfit=await cached.get(id);
      if(ticket!==request)return false;
      current?.mixer.stopAllAction();
      current?.pivot.removeFromParent();
      current=outfit;
      active=undefined;
      activeName=undefined;
      clock=0;
      body.add(outfit.pivot);
      actor.userData.outfit=id;
      return true;
    }catch(error){
      console.warn('Could not load avatar outfit',id,error);
      return false;
    }finally{
      if(ticket===request) loading=false;
    }
  }

  function update(player,time,dt,inWater,traveling,reducedMotion,charmEquipped,cooking) {
    if(!current) return false;
    const speed=Math.hypot(player.vx,player.vz);
    const moving=speed>.25||traveling;
    const clip=cooking&&current.clips.has('Cooking')?'Cooking'
      :inWater&&moving?'Channel Swim':speed>7.9?'Run':moving?'Walk':'Idle';
    if(clip!==activeName){
      const next=current.mixer.clipAction(current.clips.get(clip));
      if(active) active.fadeOut(.24);
      const rate=clip==='Walk'?1.28:clip==='Cooking'&&reducedMotion?0:1;
      next.reset().setEffectiveWeight(1).setEffectiveTimeScale(rate).play();
      if(active) next.fadeIn(.24);
      active=next;
      activeName=clip;
      actor.userData.animation=clip;
    }
    const rate=Math.max(dt,Math.min(.085,time-lastTime));
    lastTime=time;
    current.mixer.update(rate);
    // Slower return when she stops, so she glides out of the swim instead of snapping upright.
    tilt=T.MathUtils.lerp(tilt,inWater&&moving?.92:0,1-Math.exp(-dt*(moving?5.4:2.7)));
    effort=T.MathUtils.lerp(effort,Math.min(1,speed/7),1-Math.exp(-dt*4));
    if(!reducedMotion) clock+=rate;
    current.expression.update(clock,effort);
    const hover=reducedMotion?0:Math.sin(time*2.1)*.038;
    const extra=motion.step(dt,{speed,heading:player.heading,moving,inWater,reduced:reducedMotion});
    actor.position.set(player.x,(inWater?.35:.14)+tilt*.30+hover+extra.lift,player.z);
    actor.rotation.y=player.heading;
    body.rotation.x=tilt+extra.pitch;
    body.rotation.z=extra.roll;
    body.scale.set(extra.sx,extra.sy,extra.sz);
    if(charmEquipped&&current.wrist){
      if(!charm){
        charm=buildMoonlaceCharm();
        body.add(charm);
      }
      current.wrist.getWorldPosition(wristPoint);
      body.worldToLocal(wristPoint);
      charm.position.copy(wristPoint);
      charm.position.x+=Math.sign(wristPoint.x)*.055;
      charm.position.z+=.085;
      charm.rotation.z=.16*Math.sin(clock*2.2);
      charm.visible=true;
    } else if(charm) charm.visible=false;
    return true;
  }
  return {equip,update,react:kind=>motion.react(kind),usePlaceholder:()=>!current&&!loading,appearance:()=>({
    outfit:actor.userData.outfit,animation:actor.userData.animation,height:current?.height,
    eyeLine:current?1.12:undefined,hover:actor.position.y,charm:charm?.visible??false
  })};
}
