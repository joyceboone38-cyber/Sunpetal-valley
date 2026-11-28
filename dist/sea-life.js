import * as T from './vendor/three.module.min.js';
import {GLTFLoader} from './vendor/three-addons/loaders/GLTFLoader.js';

// Living sea creatures around Joyce's underwater town:
//   colourful reef fish schools (10 species, real Quaternius models, instanced so a whole
//   school is one draw call), sharks and manta rays with their real swim animations,
//   a whale passing far out in the haze, and glowing 3D jellyfish.
// Models: Quaternius Animated Fish Bundle and Fish Pack (CC0 1.0, public domain).
//
// Usage (after the town is loaded):
//   const sea=await loadSeaLife(scene,{center,radius,floorY,basePath:'assets/sea-life/'});
//   every frame: sea.update(seconds,deltaSeconds);
// radius = rough half-width of the town in world units; everything scales from it.
// quality:'low' trims the counts for older phones.

const rand=(a,b)=>a+Math.random()*(b-a);
const FISH=['clownfish','blue_tang','yellow_tang','koi','betta','royal_gramma','mandarin_fish','butterfly_fish','moorish_idol','tetra'];

async function loadBuffer(url){const r=await fetch(url);if(!r.ok)throw new Error('sea-life: cannot load '+url);return r.arrayBuffer();}
function parse(loader,buffer){return new Promise((ok,fail)=>loader.parse(buffer.slice(0),'',ok,fail));}

// ---------------- reef fish schools ----------------
function fishMaterial(uniforms){
  const m=new T.MeshStandardMaterial({vertexColors:true,roughness:.55,metalness:.05});
  m.onBeforeCompile=sh=>{
    Object.assign(sh.uniforms,uniforms);
    sh.vertexShader='attribute float aPhase;\nuniform float seaTime;\n'+sh.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      // body runs along z: head +0.5, tail -0.5. Wag grows toward the tail.
      float tail=clamp(.35-position.z,0.,1.);
      transformed.x+=sin(seaTime*9.+aPhase-position.z*5.)*.11*tail*tail;`);
    sh.fragmentShader=sh.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      // brighter, candy-bright colours to match the art style
      float l=dot(diffuseColor.rgb,vec3(.299,.587,.114));
      diffuseColor.rgb=clamp(mix(vec3(l),diffuseColor.rgb,1.45)*1.55,0.,1.);`);
  };
  m.customProgramCacheKey=()=>'sunpetal-fish';
  return m;
}
function makeSchools(gltf,R,center,floorY,uniforms,perSchool){
  const group=new T.Group();group.name='Fish schools';const schools=[];
  const mat=fishMaterial(uniforms);
  const flip=new T.Matrix4().makeRotationY(Math.PI); // packed fish face -Z; turn them to +Z
  const meshes={};gltf.scene.traverse(o=>{if(o.isMesh)meshes[o.name]=o;});
  FISH.forEach((name,k)=>{
    const src=meshes[name];if(!src)return;
    const geo=src.geometry.clone();geo.applyMatrix4(flip);
    const n=perSchool+(k%3===0?3:0);
    const phase=new Float32Array(n);for(let i=0;i<n;i++)phase[i]=Math.random()*6.28;
    geo.setAttribute('aPhase',new T.InstancedBufferAttribute(phase,1));
    const mesh=new T.InstancedMesh(geo,mat,n);mesh.frustumCulled=false;mesh.name=name+' school';
    const size=R*rand(.04,.06);
    const path={
      r:R*rand(.55,1.7), rz:R*rand(.45,1.4), y:floorY+R*rand(.25,1.0), ay:R*rand(.03,.12),
      speed:rand(.05,.11)*(k%2?1:-1), start:rand(0,6.28), wob:rand(.6,1.4)
    };
    const offsets=[];for(let i=0;i<n;i++)offsets.push(new T.Vector3(rand(-1,1),rand(-.5,.5),rand(-1.4,1.4)).multiplyScalar(R*.07));
    schools.push({mesh,size,path,offsets,n});group.add(mesh);
  });
  const dummy=new T.Object3D(),p=new T.Vector3(),q=new T.Vector3(),o=new T.Vector3();
  const at=(path,a,out)=>out.set(center.x+Math.cos(a)*path.r,path.y+Math.sin(a*2*path.wob)*path.ay,center.z+Math.sin(a)*path.rz);
  return {group,update(t){
    for(const s of schools){
      const a=s.path.start+t*s.path.speed;
      at(s.path,a,p);at(s.path,a+.02*Math.sign(s.path.speed),q);
      dummy.position.copy(p);dummy.lookAt(q);const heading=dummy.quaternion.clone();
      for(let i=0;i<s.n;i++){
        o.copy(s.offsets[i]).applyQuaternion(heading);
        o.y+=Math.sin(t*1.3+i)*R*.008;o.x+=Math.sin(t*.7+i*2.1)*R*.01;
        dummy.position.copy(p).add(o);dummy.quaternion.copy(heading);
        dummy.rotateY(Math.sin(t*1.1+i*1.7)*.12);
        dummy.scale.setScalar(s.size*(.85+.3*((i*37)%10)/10));
        dummy.updateMatrix();s.mesh.setMatrixAt(i,dummy.matrix);
      }
      s.mesh.instanceMatrix.needsUpdate=true;
    }
  }};
}

// ---------------- sharks, manta rays, whale (real rigged animations) ----------------
async function makeSwimmer(loader,buffer,{length,clip,path,speedScale=1,bank=0}){
  const g=await parse(loader,buffer);const root=new T.Group();const model=g.scene;
  model.traverse(o=>{if(o.isMesh){o.frustumCulled=false;o.castShadow=false;}});
  const box=new T.Box3().setFromObject(model),size=box.getSize(new T.Vector3()),c=box.getCenter(new T.Vector3());
  const s=length/Math.max(size.z,1e-6);model.scale.setScalar(s);model.position.copy(c).multiplyScalar(-s);
  root.add(model);
  const mixer=new T.AnimationMixer(model);
  const anim=g.animations.find(a=>clip.test(a.name))||g.animations[0];
  if(anim){const act=mixer.clipAction(anim);act.timeScale=speedScale;act.time=Math.random()*anim.duration;act.play();}
  return {root,mixer,path,bank};
}
function pathPoint(p,a,out){return out.set(p.cx+Math.cos(a)*p.r,p.y+Math.sin(a*p.fy+p.py)*p.ay,p.cz+Math.sin(a)*p.rz);}

// ---------------- glowing 3D jellyfish ----------------
function jellyGeometry(){
  // bell: a rounded dome with a frilled rim
  const prof=[];for(let i=0;i<=14;i++){const a=i/14*Math.PI*.5;prof.push(new T.Vector2(Math.sin(a)*1.0,Math.cos(a)*.85-.05));}
  prof.push(new T.Vector2(.92,-.12));prof.push(new T.Vector2(.8,-.06));
  const bell=new T.LatheGeometry(prof,28);
  const parts=[bell];const kinds=[new Float32Array(bell.attributes.position.count).fill(0)];const along=[new Float32Array(bell.attributes.position.count)];
  bell.attributes.position.array.forEach((_,i)=>{});
  { const pos=bell.attributes.position;for(let i=0;i<pos.count;i++)along[0][i]=1.-Math.max(0,pos.getY(i)+.12)/1.;}
  // long thin tentacles round the rim, plus four frilly oral arms in the middle
  const strands=[];
  for(let k=0;k<12;k++){const a=k/12*Math.PI*2;strands.push({x:Math.cos(a)*.85,z:Math.sin(a)*.85,len:rand(2.2,3.2),w:.035});}
  for(let k=0;k<4;k++){const a=k/4*Math.PI*2+.4;strands.push({x:Math.cos(a)*.18,z:Math.sin(a)*.18,len:rand(1.3,1.8),w:.12});}
  for(const s of strands){
    const g=new T.PlaneGeometry(s.w*2,s.len,1,16);g.translate(0,-s.len/2-.1,0);
    g.rotateY(Math.atan2(s.x,s.z));g.translate(s.x,0,s.z);
    const n=g.attributes.position.count,kd=new Float32Array(n).fill(s.w>.1?2:1),al=new Float32Array(n);
    for(let i=0;i<n;i++)al[i]=Math.min(1,(-g.attributes.position.getY(i)-.1)/s.len);
    parts.push(g.toNonIndexed().index?g:g);kinds.push(kd);along.push(al);
  }
  // merge by hand (only position/normal/uv + our two attributes)
  let total=0;const cleaned=parts.map(g=>g.index?g.toNonIndexed():g);
  const kindsNI=[],alongNI=[];
  parts.forEach((g,i)=>{
    if(g.index){const idx=g.index.array;const k=new Float32Array(idx.length),a=new Float32Array(idx.length);
      for(let j=0;j<idx.length;j++){k[j]=kinds[i][idx[j]];a[j]=along[i][idx[j]];}kindsNI.push(k);alongNI.push(a);}
    else{kindsNI.push(kinds[i]);alongNI.push(along[i]);}
  });
  cleaned.forEach(g=>total+=g.attributes.position.count);
  const pos=new Float32Array(total*3),nor=new Float32Array(total*3),kind=new Float32Array(total),al=new Float32Array(total);
  let off=0;cleaned.forEach((g,i)=>{g.computeVertexNormals();pos.set(g.attributes.position.array,off*3);nor.set(g.attributes.normal.array,off*3);
    kind.set(kindsNI[i],off);al.set(alongNI[i],off);off+=g.attributes.position.count;});
  const geo=new T.BufferGeometry();
  geo.setAttribute('position',new T.BufferAttribute(pos,3));geo.setAttribute('normal',new T.BufferAttribute(nor,3));
  geo.setAttribute('aKind',new T.BufferAttribute(kind,1));geo.setAttribute('aAlong',new T.BufferAttribute(al,1));
  return geo;
}
function makeJellies(R,center,floorY,count,uniforms){
  const geo=jellyGeometry();
  const colors=[[1,.45,.85],[.45,.95,1],[.75,.55,1],[1,.7,.92],[.5,1,.85]];
  const col=new Float32Array(count*3),ph=new Float32Array(count);
  for(let i=0;i<count;i++){col.set(colors[i%colors.length],i*3);ph[i]=Math.random()*6.28;}
  geo.setAttribute('aColor',new T.InstancedBufferAttribute(col,3));geo.setAttribute('aPhase',new T.InstancedBufferAttribute(ph,1));
  const mat=new T.ShaderMaterial({
    uniforms,transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,fog:false,
    vertexShader:`attribute float aKind,aAlong,aPhase;attribute vec3 aColor;uniform float seaTime;
      varying vec3 vCol;varying float vKind,vAlong,vRim;
      void main(){
        vec3 p=position;float t=seaTime+aPhase;float pulse=sin(t*2.1);
        if(aKind<.5){
          float rim=clamp(1.-p.y/.8,0.,1.);
          p.xz*=1.-.16*max(pulse,0.)*rim; p.y*=1.+.07*pulse;
          // frilled scallops on the rim
          float ang=atan(p.z,p.x); p.y+=sin(ang*14.)*.035*rim*rim;
        }else{
          float k=aAlong;
          p.x+=sin(t*1.4+k*5.)*.25*k*k+sin(t*2.3+k*9.)*.05*k;
          p.z+=cos(t*1.1+k*4.)*.2*k*k;
          p.y+=max(pulse,0.)*.12*k;
          p.xz*=1.-.12*max(pulse,0.)*(1.-k);
        }
        vKind=aKind;vAlong=aAlong;vCol=aColor;
        vec4 mv=modelViewMatrix*instanceMatrix*vec4(p,1.);
        vec3 n=normalize(normalMatrix*mat3(instanceMatrix)*normal);
        vRim=1.-abs(dot(n,normalize(-mv.xyz)));
        gl_Position=projectionMatrix*mv;
      }`,
    fragmentShader:`uniform float seaTime;varying vec3 vCol;varying float vKind,vAlong,vRim;
      void main(){
        float a;vec3 c=vCol;
        if(vKind<.5){a=.10+.75*pow(vRim,2.2);c=mix(vCol,vec3(1.),.25*pow(vRim,4.));c+=vCol*.25*(1.-vAlong);}
        else if(vKind<1.5){a=.55*(1.-vAlong);}
        else{a=.45*(1.-vAlong*.8);c=mix(vCol,vec3(1.),.2);}
        gl_FragColor=vec4(c*a,a);
      }`
  });
  const mesh=new T.InstancedMesh(geo,mat,count);mesh.frustumCulled=false;mesh.name='Jellyfish';mesh.renderOrder=5;
  const jel=[];for(let i=0;i<count;i++){const a=rand(0,6.28),d=R*rand(.7,2.2);
    jel.push({a,d,y:floorY+R*rand(.15,1.3),size:R*rand(.035,.07),drift:rand(-.02,.02),bob:rand(.15,.35),ph:ph[i],tilt:rand(-.25,.25)});}
  const dummy=new T.Object3D();
  return {group:mesh,update(t){
    jel.forEach((j,i)=>{const a=j.a+t*j.drift;const pulse=Math.sin((t+j.ph)*2.1);
      dummy.position.set(center.x+Math.cos(a)*j.d,j.y+Math.sin(t*j.bob+j.ph)*R*.05+Math.max(0,pulse)*R*.008,center.z+Math.sin(a)*j.d);
      dummy.rotation.set(j.tilt,a,j.tilt*.5);dummy.scale.setScalar(j.size);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});
    mesh.instanceMatrix.needsUpdate=true;
  }};
}

export async function loadSeaLife(scene,{center=new T.Vector3(),radius=10,floorY,basePath='assets/sea-life/',quality='high'}={}){
  const R=radius,fy=floorY??center.y-R*.35,low=quality==='low';
  const loader=new GLTFLoader();
  const uniforms={seaTime:{value:0}};
  const root=new T.Group();root.name='Sea life';scene.add(root);
  const [fishBuf,sharkBuf,mantaBuf,whaleBuf]=await Promise.all(['reef-fish.glb','shark.glb','manta-ray.glb','whale.glb'].map(f=>loadBuffer(basePath+f)));
  const fish=makeSchools(await parse(loader,fishBuf),R,center,fy,uniforms,low?5:9);root.add(fish.group);
  const jellies=makeJellies(R,center,fy,low?6:11,uniforms);root.add(jellies.group);
  const swimmers=[];
  const P=(r,rz,y,ay,speed,start)=>({cx:center.x,cz:center.z,r,rz,y,ay,fy:1.5,py:rand(0,6),speed,start});
  swimmers.push(await makeSwimmer(loader,sharkBuf,{length:R*.28,clip:/swimming_normal/i,path:P(R*1.75,R*1.5,fy+R*.55,R*.08,.11,3.2),bank:.35}));
  swimmers.push(await makeSwimmer(loader,sharkBuf,{length:R*.22,clip:/swimming_normal/i,path:P(R*2.3,R*2.0,fy+R*.2,R*.1,-.08,2.6),bank:.35,speedScale:.9}));
  swimmers.push(await makeSwimmer(loader,mantaBuf,{length:R*.22,clip:/swim/i,path:P(R*1.3,R*1.6,fy+R*.95,R*.12,.07,3.7),bank:.5,speedScale:.8}));
  if(!low)swimmers.push(await makeSwimmer(loader,mantaBuf,{length:R*.17,clip:/swim/i,path:P(R*2.0,R*1.2,fy+R*.4,R*.1,-.07,2.9),bank:.5,speedScale:.85}));
  swimmers.push(await makeSwimmer(loader,whaleBuf,{length:R*1.1,clip:/swim/i,path:P(R*4.2,R*3.6,fy+R*1.4,R*.15,.022,3.6),bank:.15,speedScale:.6}));
  swimmers.forEach(s=>root.add(s.root));
  const p=new T.Vector3(),q=new T.Vector3();
  return {
    root,
    update(seconds,delta=1/60){
      uniforms.seaTime.value=seconds;fish.update(seconds);jellies.update(seconds);
      for(const s of swimmers){
        const a=s.path.start+seconds*s.path.speed,dir=Math.sign(s.path.speed);
        pathPoint(s.path,a,p);pathPoint(s.path,a+.03*dir,q);
        s.root.position.copy(p);s.root.lookAt(q);s.root.rotateZ(-dir*s.bank);
        s.mixer.update(delta);
      }
    },
    dispose(){scene.remove(root);}
  };
}
