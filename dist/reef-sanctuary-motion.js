import * as T from './vendor/three.module.min.js';

// Brings a single-mesh Meshy island to life without re-exporting it.
// Meshy bakes every prop (shells, pearls, seaweed, coral, crystals) into one mesh,
// but each prop is still its own loose piece of geometry. We find those pieces,
// sort them by colour, size and position, then move each one in the vertex shader
// around its own base. One draw call, no extra models.

const KIND = { still:0, kelp:1, coral:2, shell:3, pearl:4, hanging:5, fall:6, crystal:7 };

function textureReader(texture) {
  const image=texture?.image;
  if(!image) return ()=>[1,1,1];
  const size=256;
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=size;
  const context=canvas.getContext('2d',{willReadFrequently:true});
  context.drawImage(image,0,0,size,size);
  const data=context.getImageData(0,0,size,size).data;
  const flip=texture.flipY;
  return (u,v)=>{
    const x=Math.min(size-1,Math.max(0,Math.floor(u*size)));
    const y=Math.min(size-1,Math.max(0,Math.floor((flip?1-v:v)*size)));
    const i=(y*size+x)*4;
    return [data[i]/255,data[i+1]/255,data[i+2]/255];
  };
}

function hsv([r,g,b]) {
  const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
  let h=0;
  if(d>0){
    if(max===r) h=((g-b)/d)%6; else if(max===g) h=(b-r)/d+2; else h=(r-g)/d+4;
    h*=60; if(h<0) h+=360;
  }
  return {h,s:max?d/max:0,v:max};
}

function findPieces(geometry) {
  const position=geometry.attributes.position;
  const count=position.count;
  const parent=new Int32Array(count).map((_,i)=>i);
  const find=i=>{ while(parent[i]!==i){ parent[i]=parent[parent[i]]; i=parent[i]; } return i; };
  const join=(a,b)=>{ a=find(a); b=find(b); if(a!==b) parent[b]=a; };
  // Weld UV seams: vertices sharing a position belong to the same piece.
  const seen=new Map();
  for(let i=0;i<count;i++){
    const key=`${Math.round(position.getX(i)*1e4)},${Math.round(position.getY(i)*1e4)},${Math.round(position.getZ(i)*1e4)}`;
    const first=seen.get(key);
    if(first===undefined) seen.set(key,i); else join(first,i);
  }
  const index=geometry.index;
  if(index){
    for(let i=0;i<index.count;i+=3){
      join(index.getX(i),index.getX(i+1));
      join(index.getX(i),index.getX(i+2));
    }
  }
  const pieces=new Map();
  for(let i=0;i<count;i++){
    const root=find(i);
    if(!pieces.has(root)) pieces.set(root,[]);
    pieces.get(root).push(i);
  }
  return [...pieces.values()];
}

function classify(piece,position,uv,sample,ground,island) {
  const min=new T.Vector3(Infinity,Infinity,Infinity), max=new T.Vector3(-Infinity,-Infinity,-Infinity);
  const colour=[0,0,0];
  const p=new T.Vector3();
  for(const i of piece){
    p.fromBufferAttribute(position,i);
    min.min(p); max.max(p);
    const c=sample(uv.getX(i),uv.getY(i));
    colour[0]+=c[0]; colour[1]+=c[1]; colour[2]+=c[2];
  }
  colour.forEach((_,k)=>colour[k]/=piece.length);
  const size=max.clone().sub(min);
  const centre=min.clone().add(max).multiplyScalar(.5);
  const {h,s,v}=hsv(colour);
  const span=island.max.clone().sub(island.min);
  const rel=size.clone().divide(span);
  const tall=size.y>Math.max(size.x,size.z)*1.1;
  const below=max.y<ground-span.y*.02;
  const blue=h>165&&h<215&&s>.45;
  let kind=KIND.still;
  if(below) kind=blue?KIND.fall:KIND.hanging;
  else if(blue&&tall&&v>.88&&rel.y>.2) kind=KIND.fall;
  else if(s<.24&&v>.88&&Math.max(rel.x,rel.y,rel.z)<.05) kind=KIND.pearl;
  else if(blue&&tall) kind=KIND.kelp;
  else if((h<25||h>345)&&s<.5&&v>.82) kind=KIND.shell;
  else if(h>285&&h<345&&s>.42) kind=KIND.coral;
  else if(h>215&&h<285) kind=KIND.crystal;
  else if(blue) kind=KIND.kelp;
  // Hanging pieces swing from their top; everything else bends from its base.
  const pivot=new T.Vector3(centre.x,kind===KIND.hanging||kind===KIND.fall&&below?max.y:min.y,centre.z);
  return {kind,pivot,height:Math.max(size.y,1e-4),centre,size,min,max};
}

const vertexMotion=`
  float k=aMotion.x, phase=aMotion.y, height=aMotion.z;
  vec3 local=transformed-aPivot;
  float rise=clamp(local.y/height,0.,1.);
  float t=sanctuaryTime;
  vSanctuaryKind=k;
  vSanctuaryRise=rise;
  vSanctuaryPhase=phase;
  if(k>.5&&k<1.5){
    // Kelp: a slow travelling bend, stronger at the tip.
    float bend=rise*rise*height*.32;
    local.x+=sin(t*1.25+phase+rise*2.2)*bend;
    local.z+=cos(t*.93+phase*1.3+rise*1.7)*bend*.7;
  }else if(k>1.5&&k<2.5){
    float bend=rise*rise*height*.12;
    local.x+=sin(t*.9+phase)*bend;
    local.z+=cos(t*.7+phase)*bend;
  }else if(k>2.5&&k<3.5){
    // Shells breathe: lift and swell a touch, like they are about to open.
    float breath=.5+.5*sin(t*.85+phase);
    local.y*=1.+.07*breath*rise;
    local.xz*=1.+.035*breath;
  }else if(k>3.5&&k<4.5){
    local*=1.+.08*sin(t*2.1+phase);
    local.y+=sin(t*1.6+phase)*height*.35;
  }else if(k>4.5&&k<5.5){
    // Hanging crystals swing a little from the rock.
    float drop=clamp(-local.y/height,0.,1.);
    local.x+=sin(t*.8+phase)*drop*drop*height*.09;
    local.z+=cos(t*.65+phase)*drop*drop*height*.09;
  }else if(k>6.5&&k<7.5){
    local.y+=sin(t*1.1+phase)*height*.04;
  }
  transformed=aPivot+local;
  vSanctuaryLocal=position;
`;

const fragmentGlow=`
  if(sanctuaryDebug>.5){
    vec3 kinds[8]=vec3[8](vec3(.5),vec3(0.,1.,.3),vec3(1.,0.,.8),vec3(1.,.5,0.),vec3(1.),vec3(.5,0.,1.),vec3(0.,.4,1.),vec3(1.,1.,0.));
    diffuseColor.rgb=kinds[int(vSanctuaryKind+.5)];
  }
  {
    float t=sanctuaryTime;
    vec3 base=diffuseColor.rgb;
    float mx=max(base.r,max(base.g,base.b)), mn=min(base.r,min(base.g,base.b));
    float sat=mx>0.?(mx-mn)/mx:0.;
    // Water: bright cyan texels on the island body shimmer with moving caustics.
    float water=smoothstep(.10,.25,base.b-base.r)*smoothstep(.40,.60,sat)*smoothstep(.45,.7,mx);
    vec2 q=vSanctuaryLocal.xz*42.;
    float c1=sin(q.x+t*1.7)+sin(q.y*1.13-t*1.3)+sin((q.x+q.y)*.71+t*.9);
    float c2=sin(q.x*1.9-t*2.1+c1)+sin(q.y*2.3+t*1.6);
    float caustic=pow(clamp(.5+.22*(c1+c2*.6),0.,1.),3.);
    float glint=pow(max(0.,sin(q.x*3.1+t*3.)*sin(q.y*2.7-t*2.4)),18.);
    totalEmissiveRadiance+=base*water*(caustic*.55*sanctuaryWater+.12)+vec3(.85,1.,1.)*water*glint*.9*sanctuaryWater;
    if(vSanctuaryKind>5.5&&vSanctuaryKind<6.5){
      // Waterfalls: bright streaks race downward.
      float y=vSanctuaryLocal.y*70.+t*5.5;
      float x=vSanctuaryLocal.x*90.+vSanctuaryLocal.z*90.;
      float streak=pow(.5+.5*sin(y+sin(x)*1.7),6.)*(.6+.4*sin(x*1.3));
      totalEmissiveRadiance+=vec3(.7,.95,1.)*streak*.8+base*.25;
    }else if(vSanctuaryKind>3.5&&vSanctuaryKind<4.5){
      float pulse=.5+.5*sin(t*2.1+vSanctuaryPhase);
      totalEmissiveRadiance+=vec3(1.,.93,.97)*(.25+.55*pulse)*sanctuaryGlow;
    }else if(vSanctuaryKind>4.5&&vSanctuaryKind<5.5||vSanctuaryKind>6.5&&vSanctuaryKind<7.5){
      float shimmer=.5+.5*sin(t*1.4+vSanctuaryPhase+vSanctuaryLocal.y*60.);
      totalEmissiveRadiance+=base*(.15+.35*shimmer)*sanctuaryGlow;
    }else if(vSanctuaryKind>2.5&&vSanctuaryKind<3.5){
      totalEmissiveRadiance+=base*(.06+.08*sin(t*.85+vSanctuaryPhase))*sanctuaryGlow;
    }
  }
`;

function patchMaterial(material,uniforms) {
  const animated=material.clone();
  animated.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    const varyings='varying float vSanctuaryKind;\nvarying float vSanctuaryRise;\nvarying float vSanctuaryPhase;\nvarying vec3 vSanctuaryLocal;\n';
    shader.vertexShader='attribute vec3 aPivot;\nattribute vec3 aMotion;\nuniform float sanctuaryTime;\n'+varyings+
      shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n'+vertexMotion);
    shader.fragmentShader='uniform float sanctuaryTime;\nuniform float sanctuaryWater;\nuniform float sanctuaryGlow;\nuniform float sanctuaryDebug;\n'+varyings+
      shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n'+fragmentGlow);
  };
  animated.customProgramCacheKey=()=>'pearl-reef-sanctuary';
  return animated;
}

// Particles: bubbles from the pools, mist under the waterfalls, sparkles over pearls.
function makeParticles(spots,island) {
  const span=island.max.clone().sub(island.min);
  const unit=Math.max(span.x,span.z);
  const count=spots.length;
  const geometry=new T.BufferGeometry();
  const origin=new Float32Array(count*3), seed=new Float32Array(count*3);
  spots.forEach((spot,i)=>{
    origin.set([spot.x,spot.y,spot.z],i*3);
    seed.set([Math.random(),spot.type,.6+Math.random()*.8],i*3);
  });
  geometry.setAttribute('position',new T.BufferAttribute(origin,3));
  geometry.setAttribute('aSeed',new T.BufferAttribute(seed,3));
  const material=new T.ShaderMaterial({
    transparent:true,depthWrite:false,blending:T.AdditiveBlending,
    uniforms:{sanctuaryTime:{value:0},unit:{value:unit},worldScale:{value:1},viewHeight:{value:800}},
    vertexShader:`
      attribute vec3 aSeed; uniform float sanctuaryTime,unit,worldScale,viewHeight; varying float vFade; varying float vType;
      void main(){
        float type=aSeed.y, speed=aSeed.z;
        float life=fract(sanctuaryTime*.16*speed+aSeed.x);
        vec3 p=position;
        if(type<.5){        // bubble: rises and wobbles
          p.y+=life*unit*.55;
          p.x+=sin(life*14.+aSeed.x*30.)*unit*.012;
          p.z+=cos(life*11.+aSeed.x*20.)*unit*.012;
          vFade=sin(life*3.14159);
        }else if(type<1.5){ // mist: puffs out sideways and down
          float a=aSeed.x*40.;
          p.x+=cos(a)*life*unit*.07; p.z+=sin(a)*life*unit*.07; p.y-=life*unit*.08;
          vFade=(1.-life)*.8;
        }else{              // sparkle: drifts up, twinkles
          p.y+=life*unit*.1;
          vFade=pow(max(0.,sin(life*3.14159*3.+aSeed.x*9.)),3.);
        }
        vType=type;
        vec4 mv=modelViewMatrix*vec4(p,1.);
        float size=type<.5?.010:type<1.5?.016:.008;
        gl_PointSize=size*unit*worldScale*(1.+.6*life)*projectionMatrix[1][1]*viewHeight*.5/-mv.z;
        gl_Position=projectionMatrix*mv;
      }`,
    fragmentShader:`
      varying float vFade; varying float vType;
      void main(){
        vec2 c=gl_PointCoord-.5; float d=length(c);
        if(d>.5) discard;
        float a;
        vec3 col;
        if(vType<.5){ a=smoothstep(.5,.36,d)*(.25+.75*smoothstep(.22,.42,d)); col=vec3(.75,.95,1.); a+=smoothstep(.16,.0,length(c-vec2(-.12,.12)))*.8; }
        else if(vType<1.5){ a=smoothstep(.5,.0,d)*.35; col=vec3(.85,.97,1.); }
        else { float star=max(smoothstep(.06,0.,abs(c.x))*smoothstep(.5,.0,abs(c.y)),smoothstep(.06,0.,abs(c.y))*smoothstep(.5,.0,abs(c.x))); a=star+smoothstep(.2,0.,d); col=vec3(1.,.88,.96); }
        gl_FragColor=vec4(col,a*vFade);
      }`
  });
  const points=new T.Points(geometry,material);
  points.name='Sanctuary bubbles and sparkles';
  points.frustumCulled=false;
  return points;
}

export function animateMeshyIsland(root,{float=false,particles=true,water=1,glow=1}={}) {
  const uniforms={sanctuaryTime:{value:0},sanctuaryWater:{value:water},sanctuaryGlow:{value:glow},sanctuaryDebug:{value:0}};
  const tally={};
  const spots=[];
  let particleLayer=null;
  root.updateMatrixWorld(true);
  root.traverse(object=>{
    if(!object.isMesh||!object.geometry.attributes.uv) return;
    const geometry=object.geometry;
    const position=geometry.attributes.position, uv=geometry.attributes.uv;
    geometry.computeBoundingBox();
    const island=geometry.boundingBox;
    const sample=textureReader(object.material.map);
    const pieces=findPieces(geometry);
    pieces.sort((a,b)=>b.length-a.length);
    // The biggest piece is the island itself. Its upper surface level is the ground line.
    const body=pieces[0];
    const heights=body.map(i=>position.getY(i)).sort((a,b)=>a-b);
    const ground=heights[Math.floor(heights.length*.6)];
    const pivot=new Float32Array(position.count*3), motion=new Float32Array(position.count*3);
    const water=[];
    for(const i of body){
      const c=sample(uv.getX(i),uv.getY(i));
      const {h,s,v}=hsv(c);
      if(h>170&&h<210&&s>.5&&v>.6&&position.getY(i)>ground-.02*(island.max.y-island.min.y)) water.push(i);
      pivot.set([position.getX(i),position.getY(i),position.getZ(i)],i*3);
    }
    for(let n=1;n<pieces.length;n++){
      const piece=pieces[n];
      const info=classify(piece,position,uv,sample,ground,island);
      tally[info.kind]=(tally[info.kind]||0)+1;
      const phase=Math.random()*Math.PI*2;
      for(const i of piece){
        pivot.set([info.pivot.x,info.pivot.y,info.pivot.z],i*3);
        motion.set([info.kind,phase,info.height],i*3);
      }
      if(info.kind===KIND.pearl&&Math.random()<.9) for(let j=0;j<3;j++) spots.push({x:info.centre.x+(Math.random()-.5)*.03,y:info.max.y,z:info.centre.z+(Math.random()-.5)*.03,type:2});
      if(info.kind===KIND.fall) for(let j=0;j<10;j++) spots.push({x:info.centre.x+(Math.random()-.5)*info.size.x,y:info.min.y,z:info.centre.z+(Math.random()-.5)*info.size.z,type:1});
    }
    for(let j=0;j<Math.min(70,water.length);j++){
      const i=water[Math.floor(Math.random()*water.length)];
      spots.push({x:position.getX(i),y:position.getY(i),z:position.getZ(i),type:0});
    }
    geometry.setAttribute('aPivot',new T.BufferAttribute(pivot,3));
    geometry.setAttribute('aMotion',new T.BufferAttribute(motion,3));
    object.material=patchMaterial(object.material,uniforms);
    // Moving pieces leave the stored bounds a little, so pad them for culling.
    geometry.boundingSphere=null; geometry.computeBoundingSphere(); geometry.boundingSphere.radius*=1.15;
    if(particles&&spots.length){
      particleLayer=makeParticles(spots,island);
      object.add(particleLayer);
    }
  });
  const scratch=new T.Vector3();
  const rest={y:root.position.y,rx:root.rotation.x,rz:root.rotation.z};
  const span=new T.Box3().setFromObject(root).getSize(new T.Vector3());
  return {
    tally,
    uniforms,
    object:root,
    // Call when the canvas resizes: drawing-buffer height in device pixels.
    setViewHeight(pixels){ if(particleLayer) particleLayer.material.uniforms.viewHeight.value=pixels; },
    update(seconds){
      uniforms.sanctuaryTime.value=seconds;
      if(particleLayer){
        const u=particleLayer.material.uniforms;
        u.sanctuaryTime.value=seconds;
        u.worldScale.value=particleLayer.getWorldScale(scratch).x;
      }
      if(float){
        root.position.y=rest.y+Math.sin(seconds*.55)*span.y*.035;
        root.rotation.x=rest.rx+Math.sin(seconds*.37)*.012;
        root.rotation.z=rest.rz+Math.cos(seconds*.31)*.012;
      }
    }
  };
}
