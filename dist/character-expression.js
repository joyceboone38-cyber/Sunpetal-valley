import * as T from './vendor/three.module.min.js';

// Rest-pose eye landmarks measured on the four supplied textured meshes.
const faces = {
  'Blossom-Fairy': {
    eyes: [[-.02399,.86609,.10182],[.02030,.86609,.10227]], width:.016, height:.012,
    hair: [.45,.882,.066,.162]
  },
  'Tideglass-Witch': {
    eyes: [[-.02188,.83099,.07850],[.02001,.83099,.07891]], width:.017, height:.012,
    hair: [.577,.809,.039,.177]
  },
  'Ponytail-Fashion-Avatar': {
    eyes: [[-.00651,1.01212,.12079],[.04560,1.01212,.12058]], width:.020, height:.015,
    hair: [.494,1.047,-.012,.151]
  },
  'Starwing-Fairy': {
    eyes: [[-.02626,.87668,.10499],[.02438,.87668,.10538]], width:.020, height:.014,
    hair: [.482,.878,.059,.170]
  }
};

function paintedHairMap(material) {
  const texture = material.map;
  if (!texture?.image) return;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d', {willReadFrequently:true});
  if (!ctx) return;
  ctx.drawImage(texture.image,0,0,256,256);
  const pixels = ctx.getImageData(0,0,256,256).data;
  texture.updateMatrix();
  const uv = new T.Vector2();
  return (u,v) => {
    texture.transformUv(uv.set(u,v));
    const x = Math.round(T.MathUtils.clamp(uv.x,0,1)*255);
    const y = Math.round(T.MathUtils.clamp(uv.y,0,1)*255);
    const k = 4*(y*256+x);
    return (pixels[k]*.32+pixels[k+1]*.56+pixels[k+2]*.12)/255;
  };
}

function blinkAt(time) {
  const phase = (time+.435)%3.43;
  const closing = T.MathUtils.smoothstep(phase,2.00,2.096);
  const opening = 1-T.MathUtils.smoothstep(phase,2.115,2.237);
  const second = T.MathUtils.smoothstep(phase,2.388,2.46)*(1-T.MathUtils.smoothstep(phase,2.47,2.56));
  const doubleBlink = Math.floor((time+.435)/3.43)%3===1 ? .91 : 0;
  return Math.max(closing*opening,second*doubleBlink);
}

export function prepareCharacterExpression(model,id) {
  const profile = faces[id];
  model.updateMatrixWorld(true);
  const morphs = [];
  const point = new T.Vector3();
  const delta = new T.Vector3();

  model.traverse(mesh => {
    if(!mesh.isSkinnedMesh||!profile) return;
    const geometry = mesh.geometry;
    if(geometry.morphAttributes.position?.length) return;
    const {position,uv,skinIndex,skinWeight} = geometry.attributes;
    const hairTone = paintedHairMap(mesh.material);
    const count = position.count;
    // These bind-pose exports share a mesh-to-rig transform across all joints.
    // It includes the scale and offset of the compressed vertex positions.
    const {bones,boneInverses} = mesh.skeleton;
    const toRestWorld = mesh.matrixWorld.clone()
      .multiply(mesh.bindMatrixInverse)
      .multiply(bones[0].matrixWorld)
      .multiply(boneInverses[0])
      .multiply(mesh.bindMatrix);
    const inverse = new T.Matrix3().setFromMatrix4(toRestWorld).invert();
    const blink = new Float32Array(count*3);
    const sway = new Float32Array(count*3);
    const curl = new Float32Array(count*3);
    const [low,high,front,maxWidth] = profile.hair;
    const center = (profile.eyes[0][0]+profile.eyes[1][0])/2;
    const characterWidth = profile.width/.017;
    const excluded = mesh.skeleton.bones.map(bone=>/Wing|UpperArm|Forearm|Hand/.test(bone.name));
    for(let i=0;i<count;i++){
      point.fromBufferAttribute(position,i).applyMatrix4(toRestWorld);
      for(const [x,y,z] of profile.eyes){
        const across = 1-T.MathUtils.smoothstep(Math.abs(point.x-x),profile.width*.62,profile.width*1.27);
        const upright = 1-T.MathUtils.smoothstep(Math.abs(point.y-y),profile.height*.59,profile.height*1.24);
        const nearFace = T.MathUtils.smoothstep(point.z,z-.029,z-.010);
        const influence = across*upright*nearFace;
        if(influence<=0.0005) continue;
        delta.set(0,(y-profile.height*.16-point.y)*influence*.96,influence*.0008).applyMatrix3(inverse);
        blink.set(delta.toArray(),i*3);
      }
      if(point.y<=low||point.y>=high||point.z>=front+.03||Math.abs(point.x-center)>=maxWidth) continue;
      const lightness = hairTone&&uv ? hairTone(uv.getX(i),uv.getY(i)) : .10;
      const darkFiber = 1-T.MathUtils.smoothstep(lightness,.19,.37);
      const depth = 1-T.MathUtils.smoothstep(point.z,front-.018,front+.028);
      const length = (point.y-low)/(high-low);
      const falloff = T.MathUtils.smoothstep(length,0,.14)*(1-T.MathUtils.smoothstep(length,.17,1));
      const narrowing = 1-T.MathUtils.smoothstep(Math.abs(point.x-center),maxWidth*.79,maxWidth);
      let limb = 0;
      for(let slot=0;slot<4;slot++) if(excluded[skinIndex.getComponent(i,slot)]) limb+=skinWeight.getComponent(i,slot);
      const influence = falloff*narrowing*depth*darkFiber*(1-limb);
      if(influence<.003) continue;
      const signed = Math.sign(point.x-center);
      delta.set(influence*.026*characterWidth,influence*.005*signed,-influence*.014).applyMatrix3(inverse);
      sway.set(delta.toArray(),i*3);
      delta.set(influence*.013*signed,influence*.004,influence*.023*characterWidth).applyMatrix3(inverse);
      curl.set(delta.toArray(),i*3);
    }
    geometry.morphAttributes.position = [blink,sway,curl].map(values=>new T.BufferAttribute(values,3));
    geometry.morphTargetsRelative = true;
    mesh.updateMorphTargets();
    morphs.push(mesh.morphTargetInfluences);
  });

  let lastTime = 0;
  let lateralPhase = -.48;
  let dragPhase = -1.05;
  return {
    eyeHeight: profile ? (profile.eyes[0][1]+profile.eyes[1][1])/2 : undefined,
    update(time,motion){
      const blink = blinkAt(time);
      if(time===0){
        lateralPhase = -.48;
        dragPhase = -1.05;
      }
      const dt = Math.max(0,time-lastTime);
      lastTime = time;
      lateralPhase += dt*(1.56+1.65*motion);
      dragPhase += dt*(1.10+1.90*motion);
      const drift = Math.sin(lateralPhase)*(.47+.36*motion);
      const follow = Math.sin(dragPhase)*(.41+.43*motion);
      for(const values of morphs){
        values[0]=blink;
        values[1]=drift;
        values[2]=follow;
      }
    }
  };
}
