import * as T from './vendor/three.module.min.js';

// Brings Joyce's underwater terrain to life. The model carries a _MOTION attribute
// (kind, sway, phase) baked from its shapes and colours:
//   1 coral and kelp (sway grows toward the tips)  2 waterfalls  3 pools and fountain water
//   4 bright crystals
// Usage: const life=animateTerrain(gltf.scene); then every frame life.update(seconds).
// Call life.setViewHeight(canvas.height) when the canvas size changes.

const vertexMotion=`
  float kind=terrainMotion.x, sway=terrainMotion.y, phase=terrainMotion.z, t=terrainTime;
  vTerrainKind=kind; vTerrainPhase=phase; vTerrainLocal=position; vTerrainNormal=normal;
  if(kind>.5&&kind<1.5){
    float bend=sway*sway*.0065;
    transformed.x+=sin(t*1.15+phase+position.y*38.)*bend;
    transformed.z+=cos(t*.85+phase*1.3+position.y*29.)*bend*.8;
  }
`;
const fragmentGlow=`
  {
    float t=terrainTime;
    vec3 base=diffuseColor.rgb;
    // Water is also found by its colour: deep blue texels shimmer or flow
    // even where the model has few vertices to mark them.
    float kindNow=vTerrainKind;
    if(terrainColorWater>.5&&kindNow<.5){
      float mxc=max(base.r,max(base.g,base.b)),mnc=min(base.r,min(base.g,base.b));
      float satc=mxc>0.?(mxc-mnc)/mxc:0.;
      bool blue=base.g>base.r*1.6&&base.b>base.r*2.&&base.b>base.g*.9&&satc>.55;
      if(blue) kindNow=abs(normalize(vTerrainNormal).y)<.55?2.:3.;
    }
    if(kindNow>1.5&&kindNow<2.5){
      float y=vTerrainLocal.y*210.+t*5.;
      float x=(vTerrainLocal.x+vTerrainLocal.z)*260.;
      float streak=pow(.5+.5*sin(y+sin(x)*1.6),6.)*(.6+.4*sin(x*1.3));
      totalEmissiveRadiance+=vec3(.7,.95,1.)*streak*.75*terrainWater+base*.22;
    }else if(kindNow>2.5&&kindNow<3.5){
      vec2 q=vTerrainLocal.xz*160.;
      float c1=sin(q.x+t*1.7)+sin(q.y*1.13-t*1.3)+sin((q.x+q.y)*.71+t*.9);
      float c2=sin(q.x*1.9-t*2.1+c1)+sin(q.y*2.3+t*1.6);
      float caustic=pow(clamp(.5+.22*(c1+c2*.6),0.,1.),3.);
      float glint=pow(max(0.,sin(q.x*3.1+t*3.)*sin(q.y*2.7-t*2.4)),18.);
      totalEmissiveRadiance+=(base*(caustic*.55+.12)+vec3(.85,1.,1.)*glint*.9)*terrainWater;
    }else if(kindNow>3.5){
      float pulse=.5+.5*sin(t*1.6+vTerrainPhase+vTerrainLocal.y*90.);
      totalEmissiveRadiance+=base*(.12+.4*pulse)*terrainGlow;
    }
  }
`;

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

export function animateTerrain(root,{water=1,glow=1,particles=true,colorWater=true}={}){
  const uniforms={terrainTime:{value:0},terrainWater:{value:water},terrainGlow:{value:glow},terrainColorWater:{value:colorWater?1:0}};
  let particleLayer=null;
  root.traverse(object=>{
    if(!object.isMesh) return;
    const geometry=object.geometry;
    const motion=geometry.getAttribute('_motion')??geometry.getAttribute('_MOTION');
    if(!motion) return;
    geometry.setAttribute('terrainMotion',motion);
    const material=object.material.clone();
    material.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,uniforms);
      const varyings='varying float vTerrainKind;\nvarying float vTerrainPhase;\nvarying vec3 vTerrainLocal;\nvarying vec3 vTerrainNormal;\n';
      shader.vertexShader='attribute vec4 terrainMotion;\nuniform float terrainTime;\n'+varyings+
        shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n'+vertexMotion);
      shader.fragmentShader='uniform float terrainTime;\nuniform float terrainWater;\nuniform float terrainGlow;\nuniform float terrainColorWater;\n'+varyings+
        shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n'+fragmentGlow);
    };
    material.customProgramCacheKey=()=>'sunpetal-terrain';
    object.material=material;
    if(particles){
      const position=geometry.attributes.position,spots=[];
      geometry.computeBoundingBox();
      const surface=[],falls=[];
      for(let i=0;i<position.count;i++){const k=motion.getX(i),w=motion.getW(i);if(k===3||w===1)surface.push(i);else if(k===2||w===2)falls.push(i);}
      for(let n=0;n<Math.min(120,surface.length);n++){const i=surface[Math.floor(Math.random()*surface.length)];spots.push({x:position.getX(i),y:position.getY(i),z:position.getZ(i),type:0});}
      falls.sort((a,b)=>position.getY(a)-position.getY(b));
      const low=falls.slice(0,Math.ceil(falls.length*.08));
      for(let n=0;n<Math.min(140,low.length);n++){const i=low[Math.floor(Math.random()*low.length)];spots.push({x:position.getX(i),y:position.getY(i),z:position.getZ(i),type:1});}
      if(spots.length){particleLayer=makeParticles(spots,new T.Box3(new T.Vector3(),new T.Vector3(.3,.3,.3)));object.add(particleLayer);}
    }
  });
  const scratch=new T.Vector3();
  return {
    uniforms,
    setViewHeight(pixels){ if(particleLayer) particleLayer.material.uniforms.viewHeight.value=pixels; },
    update(seconds){
      uniforms.terrainTime.value=seconds;
      if(particleLayer){const u=particleLayer.material.uniforms;u.sanctuaryTime.value=seconds;u.worldScale.value=particleLayer.getWorldScale(scratch).x;}
    }
  };
}
