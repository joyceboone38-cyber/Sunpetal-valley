import * as T from './vendor/three.module.min.js';

// Small, pooled particle effects: sparkles, bubbles, steam, petals and expanding rings.
// One draw call for every particle, nothing is created per frame after start-up, and
// everything switches off for reduced motion.

const TAU=Math.PI*2;
const rand=(low,high)=>low+Math.random()*(high-low);
const mix=(a,b,t)=>a+(b-a)*t;
const tint=new T.Color();

const vertexShader=`
  attribute float size;
  attribute float alpha;
  attribute vec3 tone;
  uniform float scale;
  varying float vAlpha;
  varying vec3 vTone;
  void main(){
    vec4 view=modelViewMatrix*vec4(position,1.);
    gl_Position=projectionMatrix*view;
    gl_PointSize=max(1.,size*scale/max(.1,-view.z));
    vAlpha=alpha;
    vTone=tone;
  }`;
const fragmentShader=`
  varying float vAlpha;
  varying vec3 vTone;
  void main(){
    vec2 p=gl_PointCoord-.5;
    float core=1.-smoothstep(0.,1.,length(p)*2.);
    float cross=max(0.,1.-abs(p.x)*10.)*max(0.,1.-abs(p.y)*2.4)+max(0.,1.-abs(p.y)*10.)*max(0.,1.-abs(p.x)*2.4);
    float glow=core*core*.9+cross*.3;
    if(glow<.01)discard;
    gl_FragColor=vec4(vTone*1.25,glow*vAlpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

const cropColors={
  moonlace:['#f4c6ff','#ffffff','#ff9bd8'],
  starkelp:['#8dffd0','#ffffff','#d6ff9b'],
  coralberry:['#ff8fb0','#ffffff','#ffc2dd'],
  pearlbean:['#fff4e0','#ffffff','#d6f6ff'],
  sunbloom:['#ffe27a','#ffffff','#ffb86b'],
  glimmermelon:['#9fe8ff','#ffffff','#c9b6ff']
};
const warm=['#ffe3a0','#ffffff','#ffc2dd'];

export function createJuice(scene,{max=280}={}) {
  const positions=new Float32Array(max*3);
  const tones=new Float32Array(max*3);
  const sizes=new Float32Array(max);
  const alphas=new Float32Array(max);
  const geometry=new T.BufferGeometry();
  const attributes={
    position:new T.BufferAttribute(positions,3),
    tone:new T.BufferAttribute(tones,3),
    size:new T.BufferAttribute(sizes,1),
    alpha:new T.BufferAttribute(alphas,1)
  };
  for(const [name,attribute] of Object.entries(attributes)){
    attribute.setUsage(T.DynamicDrawUsage);
    geometry.setAttribute(name,attribute);
  }
  geometry.setDrawRange(0,0);
  const uniforms={scale:{value:800}};
  const material=new T.ShaderMaterial({
    uniforms,vertexShader,fragmentShader,transparent:true,depthWrite:false,blending:T.AdditiveBlending
  });
  const points=new T.Points(geometry,material);
  points.frustumCulled=false;
  points.renderOrder=8;
  points.name='Sunpetal effects';
  scene.add(points);

  const live=[];
  let reduced=false,quality='high';
  const budget=()=>quality==='low'?.5:1;
  const make=extra=>({
    x:0,y:0,z:0,vx:0,vy:0,vz:0,drag:0,gravity:0,life:1,s0:.1,s1:.05,a:1,r:1,g:1,b:1,
    fade:.06,wobble:0,wobbleSpeed:2,phase:rand(0,TAU),twinkle:false,arc:null,age:0,...extra
  });
  function add(particle){
    if(reduced)return;
    if(live.length>=max)live.shift();
    live.push(particle);
  }
  function colorOf(value,lighten=0){
    tint.set(value);
    return {r:mix(tint.r,1,lighten),g:mix(tint.g,1,lighten),b:mix(tint.b,1,lighten)};
  }

  function sparkle({x,y,z,count=12,color='#ffffff',spread=1,speed=1.8,up=.9,size=.14,life=.9,gravity=-.7}) {
    const total=Math.max(1,Math.round(count*budget()));
    for(let i=0;i<total;i++){
      const angle=rand(0,TAU),lift=rand(-.2,1),flat=Math.sqrt(1-Math.min(1,lift*lift));
      const velocity=speed*rand(.45,1);
      add(make({
        x:x+rand(-.08,.08)*spread,y,z:z+rand(-.08,.08)*spread,
        vx:Math.cos(angle)*flat*velocity*spread,vy:lift*velocity*up+.6,vz:Math.sin(angle)*flat*velocity*spread,
        drag:2.1,gravity,life:life*rand(.7,1.2),s0:size*rand(.7,1.3),s1:size*.15,a:.95,
        ...colorOf(Array.isArray(color)?color[i%color.length]:color,rand(0,.45)),fade:.05,twinkle:true
      }));
    }
  }
  function bubbles({x,y,z,count=1,spread=.25}) {
    const total=Math.max(1,Math.round(count*budget()));
    for(let i=0;i<total;i++){
      const size=rand(.05,.09);
      add(make({
        x:x+rand(-spread,spread),y,z:z+rand(-spread,spread),vy:rand(.55,.95),drag:.3,
        life:rand(1.1,1.9),s0:size,s1:size*1.5,a:.5,wobble:.35,wobbleSpeed:rand(3,5),fade:.15,
        ...colorOf('#bfefff')
      }));
    }
  }
  function steam({x,y,z,count=1}) {
    const total=Math.max(1,Math.round(count*budget()));
    for(let i=0;i<total;i++){
      add(make({
        x:x+rand(-.07,.07),y,z:z+rand(-.07,.07),vx:rand(-.08,.08),vy:rand(.35,.6),drag:.4,
        life:rand(1.4,2.1),s0:.16,s1:.46,a:.2,wobble:.12,wobbleSpeed:rand(1.5,2.5),fade:.25,
        ...colorOf('#fff4ea')
      }));
    }
  }
  function petals({x,y,z,count=10,colors=warm}) {
    const total=Math.max(1,Math.round(count*budget()));
    for(let i=0;i<total;i++){
      const angle=rand(0,TAU),velocity=rand(.4,1.2);
      add(make({
        x,y,z,vx:Math.cos(angle)*velocity,vy:rand(1.8,3.2),vz:Math.sin(angle)*velocity,
        drag:.6,gravity:-3.4,life:rand(.9,1.4),s0:.09,s1:.06,a:.95,wobble:.5,wobbleSpeed:rand(4,7),
        ...colorOf(colors[i%colors.length])
      }));
    }
  }
  // A single ingredient flying along a curved path from one point to another.
  function toss(from,to,color='#ffd9f2') {
    add(make({
      arc:{sx:from.x,sy:from.y,sz:from.z,ex:to.x,ey:to.y,ez:to.z,h:rand(.5,.9)},
      life:rand(.55,.75),s0:.13,s1:.09,a:1,fade:.02,...colorOf(color,.15)
    }));
  }

  const ringShape=new T.RingGeometry(.86,1,48);
  const rings=Array.from({length:6},()=>{
    const mesh=new T.Mesh(ringShape,new T.MeshBasicMaterial({
      color:'#ffffff',transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide
    }));
    mesh.rotation.x=-Math.PI/2;
    mesh.visible=false;
    mesh.renderOrder=7;
    scene.add(mesh);
    return {mesh,age:0,life:1,size:1,active:false};
  });
  function ring({x,y,z,color='#ffffff',size=.8,life=.7}) {
    if(reduced)return;
    const slot=rings.find(entry=>!entry.active)??rings.reduce((oldest,entry)=>entry.age>oldest.age?entry:oldest);
    slot.active=true;
    slot.age=0;
    slot.life=life;
    slot.size=size;
    slot.mesh.material.color.set(color);
    slot.mesh.position.set(x,y,z);
    slot.mesh.visible=true;
  }

  // Ready-made bursts for the moments the game cares about.
  function celebrate(kind,{x=0,y=0,z=0,color}={}) {
    const palette=cropColors[color]??warm;
    switch(kind){
      case 'plant':
        ring({x,y:y+.04,z,color:palette[0],size:.75});
        sparkle({x,y:y+.35,z,count:10,color:palette,speed:1.1,size:.1});
        bubbles({x,y:y+.3,z,count:3});
        break;
      case 'tend':
        ring({x,y:y+.04,z,color:palette[0],size:1,life:.9});
        sparkle({x,y:y+.35,z,count:16,color:palette,speed:1.5});
        break;
      case 'harvest':
        ring({x,y:y+.04,z,color:'#ffd98a',size:1.15});
        ring({x,y:y+.06,z,color:palette[0],size:.7,life:.55});
        sparkle({x,y:y+.45,z,count:22,color:['#ffe3a0','#ffffff'],speed:2.4,size:.16});
        petals({x,y:y+.45,z,count:14,colors:palette});
        break;
      case 'meal':
        ring({x,y:y+.04,z,color:'#ffd0a0',size:1.2,life:.9});
        sparkle({x,y:y+.9,z,count:26,color:warm,speed:2.2,size:.15});
        petals({x,y:y+.9,z,count:8,colors:warm});
        steam({x,y:y+1,z,count:6});
        break;
      case 'pearl':
      case 'charm':
        ring({x,y:y+.04,z,color:'#fff4d6',size:1.1,life:.9});
        sparkle({x,y:y+.9,z,count:28,color:['#fff4d6','#ffffff','#ffd98a'],speed:2.6,size:.15});
        break;
      default:
    }
  }

  function update(dt,env={}) {
    reduced=Boolean(env.reduce);
    if(env.viewHeight&&env.fov)uniforms.scale.value=env.viewHeight/(2*Math.tan(env.fov*Math.PI/360));
    dt=Math.min(Math.max(dt,0),.05);
    if(reduced){
      live.length=0;
      for(const entry of rings){entry.active=false;entry.mesh.visible=false;}
    }
    let kept=0,written=0;
    for(let i=0;i<live.length;i++){
      const p=live[i];
      p.age+=dt;
      if(p.age>=p.life)continue;
      live[kept++]=p;
      const u=p.age/p.life;
      if(p.arc){
        const a=p.arc;
        p.x=mix(a.sx,a.ex,u);
        p.z=mix(a.sz,a.ez,u);
        p.y=mix(a.sy,a.ey,u)+a.h*4*u*(1-u);
      }else{
        const keep=Math.exp(-p.drag*dt);
        p.vx*=keep;p.vy*=keep;p.vz*=keep;
        p.vy+=p.gravity*dt;
        p.x+=p.vx*dt+Math.sin(p.age*p.wobbleSpeed+p.phase)*p.wobble*dt;
        p.y+=p.vy*dt;
        p.z+=p.vz*dt+Math.cos(p.age*p.wobbleSpeed*.83+p.phase)*p.wobble*dt;
      }
      const fadeIn=Math.min(1,p.age/Math.max(.001,p.fade));
      let opacity=p.a*fadeIn*(1-u)**1.4;
      if(p.twinkle)opacity*=.75+.25*Math.sin(p.age*30+p.phase);
      const n=written++;
      positions[n*3]=p.x;positions[n*3+1]=p.y;positions[n*3+2]=p.z;
      tones[n*3]=p.r;tones[n*3+1]=p.g;tones[n*3+2]=p.b;
      sizes[n]=mix(p.s0,p.s1,u);
      alphas[n]=opacity;
    }
    live.length=kept;
    geometry.setDrawRange(0,written);
    for(const attribute of Object.values(attributes))attribute.needsUpdate=true;

    for(const entry of rings){
      if(!entry.active)continue;
      entry.age+=dt;
      const u=entry.age/entry.life;
      if(u>=1){entry.active=false;entry.mesh.visible=false;continue;}
      entry.mesh.scale.setScalar(entry.size*(.25+.75*(1-(1-u)**3)));
      entry.mesh.material.opacity=.75*(1-u)**1.6;
    }
  }

  return {
    sparkle,bubbles,steam,petals,toss,ring,celebrate,update,
    setQuality(value){quality=value==='low'?'low':'high';},
    count:()=>live.length,
    dispose(){
      scene.remove(points);
      geometry.dispose();
      material.dispose();
      for(const entry of rings){
        scene.remove(entry.mesh);
        entry.mesh.material.dispose();
      }
      ringShape.dispose();
    }
  };
}
