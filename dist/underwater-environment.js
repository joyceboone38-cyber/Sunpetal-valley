import * as T from './vendor/three.module.min.js';

// The world AROUND Joyce's underwater town, matched to her homeland concept art:
// a painted 360 degree backdrop (sunlit surface, royal-blue water, hazy rock pillars and arches
// with glowing coral, a glowing reef far below), sunbeams, rising bubbles and sparkle motes.
// The creatures (fish schools, sharks, manta rays, whale, 3D jellyfish) live in sea-life.js.
// It does not touch the town or its layout.
//
// Usage:
//   const env=createUnderwaterEnvironment(scene,{center:new THREE.Vector3(0,0,0),radius:12});
//   every frame: env.update(seconds,camera);
// radius = rough half-width of the town in world units. Everything scales from it.
// Options: lights (default true) adds matching soft lighting; quality 'low' trims particles for older phones.

let _seed=20261127;const rnd=()=>(_seed=(_seed*16807)%2147483647)/2147483647;
const rand=(a,b)=>a+rnd()*(b-a);

function canvasTexture(w,h,draw){
  const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);
  const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;
}

// ---------- the water all around: a painted 360 degree backdrop ----------
// Colours sampled from Joyce's homeland concept art. Painted once at start-up (no image files).
function paintBackdrop(){
  const W=2048,H=1024;
  return canvasTexture(W,H,(g)=>{
    let seed=7;const r=()=>(seed=(seed*16807)%2147483647)/2147483647;
    // depth gradient: sunlit surface, royal blue water, deep blue below
    const v=g.createLinearGradient(0,0,0,H);
    v.addColorStop(0,'#8ae8ff');v.addColorStop(.12,'#4ccaf8');v.addColorStop(.26,'#2aa1e2');
    v.addColorStop(.40,'#1c88d6');v.addColorStop(.50,'#1468c0');v.addColorStop(.58,'#0a56a6');
    v.addColorStop(.75,'#034592');v.addColorStop(1,'#012a6a');
    g.fillStyle=v;g.fillRect(0,0,W,H);
    // light net from the surface ripples
    g.globalCompositeOperation='lighter';
    for(let i=0;i<260;i++){const x=r()*W,y=r()*H*.16,rx=20+r()*60;
      g.strokeStyle=`rgba(200,250,255,${.05+r()*.08})`;g.lineWidth=1+r()*2;g.beginPath();g.ellipse(x,y,rx,rx*.35,0,0,6.3);g.stroke();}
    // god-ray streaks fanning down from the surface
    for(let i=0;i<18;i++){const x=r()*W,w=8+r()*30,len=H*(.3+r()*.25),lean=(r()-.5)*120;
      const gr=g.createLinearGradient(0,0,0,len);gr.addColorStop(0,`rgba(190,245,255,${.04+r()*.06})`);gr.addColorStop(1,'rgba(190,245,255,0)');
      g.fillStyle=gr;g.beginPath();g.moveTo(x,0);g.lineTo(x+w,0);g.lineTo(x+w+lean,len);g.lineTo(x+lean,len);g.closePath();g.fill();}
    g.globalCompositeOperation='source-over';
    // wraps shapes across the left/right seam
    const wrap=(x,f)=>{f(x);if(x<200)f(x+W);if(x>W-200)f(x-W);};
    // horizon haze colour and the rock layers, far to near
    const layers=[
      {top:[.455,.485],base:.545,col:'#3b7fd6',cap:'#79aef6',count:12,wid:[4,8],glow:.3},
      {top:[.465,.495],base:.555,col:'#3570cc',cap:'#7f9cf4',count:9,wid:[6,11],glow:.55},
      {top:[.475,.505],base:.57,col:'#3762c0',cap:'#8a8ef0',count:6,wid:[8,15],glow:.8},
      {top:[.485,.515],base:.585,col:'#3f58b6',cap:'#9a84ea',count:4,wid:[10,18],glow:1},
    ];
    for(const L of layers){
      // soft haze band behind this layer
      const hz=g.createLinearGradient(0,H*(L.top[0]-.04),0,H*L.base);hz.addColorStop(0,'rgba(60,140,230,0)');hz.addColorStop(.5,'rgba(60,140,230,.10)');hz.addColorStop(1,'rgba(60,140,230,0)');
      g.fillStyle=hz;g.fillRect(0,H*(L.top[0]-.04),W,H*(L.base-L.top[0]+.04));
      for(let i=0;i<L.count;i++){
        const cx=(i+r()*.8)/L.count*W, w=L.wid[0]+r()*(L.wid[1]-L.wid[0]), top=H*(L.top[0]+r()*(L.top[1]-L.top[0]));
        const arch=r()<.12;
        wrap(cx,x=>{
          const body=g.createLinearGradient(0,top,0,H*L.base);body.addColorStop(0,L.col);body.addColorStop(.7,L.col);body.addColorStop(1,'rgba(3,60,140,0)');
          g.fillStyle=body;g.beginPath();
          if(arch){ // a stone arch like the one in the concept art
            const span=w*2.4;g.moveTo(x-span,H*L.base);g.lineTo(x-span,top+8);g.quadraticCurveTo(x,top-14,x+span,top+8);g.lineTo(x+span,H*L.base);
            g.lineTo(x+span-w*.7,H*L.base);g.lineTo(x+span-w*.7,top+14);g.quadraticCurveTo(x,top-6,x-span+w*.7,top+14);g.lineTo(x-span+w*.7,H*L.base);g.closePath();
          }else{ // pillar, slightly wider at the mesa top
            g.moveTo(x-w*.8,H*L.base);
            for(let k=0;k<=6;k++){const y=H*L.base-(H*L.base-top)*k/6;g.lineTo(x-w*(.8+.2*k/6)+(r()-.5)*6,y);}
            g.lineTo(x+w*(1.0)+(r()-.5)*6,top+3);
            for(let k=6;k>=0;k--){const y=H*L.base-(H*L.base-top)*k/6;g.lineTo(x+w*(.8+.2*k/6)+(r()-.5)*6,y);}
            g.closePath();
          }
          g.fill();
          // sunlit cap
          g.fillStyle=L.cap;g.globalAlpha=.75;g.beginPath();g.ellipse(x,top+(arch?-3:1),arch?w*1.6:w*.95,1.5+w*.08,0,0,6.3);g.fill();g.globalAlpha=1;
          // glowing coral and kelp on top
          const n=arch?2:1+Math.floor(r()*3);
          for(let k=0;k<n;k++){const px=x+(r()-.5)*w*1.6,py=top-2,col=['#ff6fd8','#6ff0ff','#b48bff','#6fffc0','#ffa8e4'][Math.floor(r()*5)],sz=(1.5+r()*3.5)*(.6+L.glow);
            const gl=g.createRadialGradient(px,py-sz*.5,0,px,py-sz*.5,sz*2.2);gl.addColorStop(0,col);gl.addColorStop(1,col+'00');
            g.globalAlpha=.35+.5*L.glow;g.fillStyle=gl;g.beginPath();g.arc(px,py-sz*.5,sz*2.2,0,6.3);g.fill();
            g.strokeStyle=col;g.lineWidth=1+L.glow*1.5;g.beginPath();g.moveTo(px,py);g.quadraticCurveTo(px+(r()-.5)*8,py-sz,px+(r()-.5)*10,py-sz*1.8);g.stroke();g.globalAlpha=1;}
        });
      }
      {const veil=g.createLinearGradient(0,H*.38,0,H*.68);veil.addColorStop(0,'rgba(30,110,205,0)');veil.addColorStop(.45,'rgba(30,110,205,.24)');veil.addColorStop(1,'rgba(30,110,205,0)');g.fillStyle=veil;g.fillRect(0,H*.38,W,H*.30);}
    }
    // deep below: faint glowing reef far down, like the pink glow under the islands
    g.globalCompositeOperation='lighter';
    for(let i=0;i<70;i++){const x=r()*W,y=H*(.80+r()*.17),sz=10+r()*40,col=['255,90,210','110,230,255','170,120,255','255,150,230'][Math.floor(r()*4)];
      const gl=g.createRadialGradient(x,y,0,x,y,sz);gl.addColorStop(0,`rgba(${col},${.10+r()*.18})`);gl.addColorStop(1,`rgba(${col},0)`);
      g.fillStyle=gl;g.beginPath();g.arc(x,y,sz,0,6.3);g.fill();}
    // tiny distant specks and far fish
    for(let i=0;i<500;i++){g.fillStyle=`rgba(220,245,255,${.15+r()*.35})`;g.fillRect(r()*W,r()*H*.85,1+r()*1.5,1+r()*1.5);}
    g.globalCompositeOperation='source-over';
    g.fillStyle='rgba(10,40,100,.45)';
    for(let s2=0;s2<6;s2++){const sx=r()*W,sy=H*(.25+r()*.2);for(let i=0;i<14;i++){const fx=sx+(r()-.5)*70,fy=sy+(r()-.5)*24;g.beginPath();g.ellipse(fx,fy,4,1.6,0,0,6.3);g.fill();g.beginPath();g.moveTo(fx+4,fy);g.lineTo(fx+7,fy-2);g.lineTo(fx+7,fy+2);g.fill();}}
  });
}
function makeWater(R){
  const tex=paintBackdrop();tex.wrapS=T.RepeatWrapping;tex.generateMipmaps=false;tex.minFilter=T.LinearFilter;
  const mat=new T.ShaderMaterial({
    side:T.BackSide,depthWrite:false,fog:false,
    uniforms:{time:{value:0},map:{value:tex}},
    vertexShader:`varying vec3 vDir;void main(){vDir=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position.z=gl_Position.w;}`,
    fragmentShader:`varying vec3 vDir;uniform float time;uniform sampler2D map;
      void main(){
        vec3 d=normalize(vDir);
        vec2 uv=vec2(atan(d.z,d.x)/6.28318+.5,1.-acos(clamp(d.y,-1.,1.))/3.14159);
        vec3 c=texture2D(map,uv).rgb;
        // live touches on top of the painting: sun glow and moving surface light
        float sun=pow(max(0.,dot(d,normalize(vec3(.15,1.,-.25)))),20.);
        c+=vec3(.6,.95,1.)*sun*.3;
        vec2 q=d.xz/max(d.y,.12)*3.;
        float rip=sin(q.x*2.1+time*.6)+sin(q.y*2.7-time*.5)+sin((q.x+q.y)*1.6+time*.4);
        c+=vec3(.5,.9,1.)*smoothstep(1.4,2.6,rip)*smoothstep(.4,.85,d.y)*.16;
        gl_FragColor=vec4(c,1.);
      }`
  });
  const m=new T.Mesh(new T.SphereGeometry(R*14,64,32),mat);m.frustumCulled=false;m.renderOrder=-10;m.name='Underwater backdrop';
  return m;
}

// ---------- sunbeams: parallel shafts slanting down through the water ----------
function makeRays(R,center,floorY,count){
  const tex=canvasTexture(64,256,(g,w,h)=>{
    const v=g.createLinearGradient(0,0,0,h);v.addColorStop(0,'rgba(255,255,255,1)');v.addColorStop(.35,'rgba(255,255,255,.75)');v.addColorStop(1,'rgba(255,255,255,0)');
    g.fillStyle=v;g.fillRect(0,0,w,h);
    g.globalCompositeOperation='destination-in';
    const s=g.createLinearGradient(0,0,w,0);s.addColorStop(0,'rgba(0,0,0,0)');s.addColorStop(.3,'rgba(0,0,0,.8)');s.addColorStop(.5,'rgba(0,0,0,1)');s.addColorStop(.7,'rgba(0,0,0,.8)');s.addColorStop(1,'rgba(0,0,0,0)');
    g.fillStyle=s;g.fillRect(0,0,w,h);
  });
  const group=new T.Group();group.name='Sunbeams';const beams=[];
  const slant=new T.Euler(.22,0,-.30);   // all beams lean the same way, like sunlight through a surface
  const top=floorY+R*2.6;
  for(let i=0;i<count;i++){
    const w=R*rand(.3,.7),h=R*rand(2.8,3.8);
    const mat=new T.MeshBasicMaterial({map:tex,color:new T.Color(.85,1.,1.),transparent:true,opacity:0,blending:T.AdditiveBlending,depthWrite:false,fog:false,side:T.DoubleSide});
    const beam=new T.Group();
    for(let k=0;k<2;k++){const pl=new T.Mesh(new T.PlaneGeometry(w,h),mat);pl.position.y=-h/2;pl.rotation.y=k*Math.PI/2;beam.add(pl);} // crossed planes: visible from every side
    const a=(i+rand(0,.6))/count*Math.PI*2,d=R*rand(.95,2.1);   // around and behind the town, never piled on top of it
    beam.position.set(center.x+Math.cos(a)*d+R*.5,top,center.z+Math.sin(a)*d);
    beam.rotation.copy(slant);beam.rotation.y=rand(0,3.14);
    beam.userData={mat,base:rand(.18,.32),speed:rand(.12,.3),phase:rand(0,6.28),drift:rand(-.15,.15)};
    group.add(beam);beams.push(beam);
  }
  return {group,update(t){for(const b of beams){const u=b.userData;
    u.mat.opacity=u.base*(.65+.35*Math.sin(t*u.speed+u.phase));
    b.rotation.z=slant.z+Math.sin(t*.07+u.phase)*.04;b.rotation.x=slant.x+u.drift*.2;
  }}};
}

// ---------- bubbles and sparkle motes ----------
function makeMotes(R,center,floorY,count){
  const geo=new T.BufferGeometry(),pos=new Float32Array(count*3),seed=new Float32Array(count*3);
  for(let i=0;i<count;i++){const a=rand(0,6.28),d=R*Math.sqrt(rnd())*2.4;
    pos.set([center.x+Math.cos(a)*d,floorY+rand(-.3,1.6)*R,center.z+Math.sin(a)*d],i*3);
    seed.set([rnd(),rnd()<.35?0:1,rand(.5,1.4)],i*3);}
  geo.setAttribute('position',new T.BufferAttribute(pos,3));geo.setAttribute('aSeed',new T.BufferAttribute(seed,3));
  const mat=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,
    uniforms:{time:{value:0},R:{value:R},viewHeight:{value:800}},
    vertexShader:`attribute vec3 aSeed;uniform float time,R,viewHeight;varying float vA;varying float vType;
      void main(){vec3 p=position;float life=fract(time*.05*aSeed.z+aSeed.x);
        if(aSeed.y<.5){p.y+=life*R*1.6;p.x+=sin(life*20.+aSeed.x*40.)*R*.01;vA=sin(life*3.1416);}
        else{p.y+=sin(time*.3+aSeed.x*30.)*R*.05;p.x+=cos(time*.2+aSeed.x*20.)*R*.05;vA=.4+.6*pow(.5+.5*sin(time*2.+aSeed.x*50.),3.);}
        vType=aSeed.y;vec4 mv=modelViewMatrix*vec4(p,1.);
        gl_PointSize=(aSeed.y<.5?.020:.010)*R*projectionMatrix[1][1]*viewHeight*.5/-mv.z;gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`varying float vA;varying float vType;
      void main(){vec2 c=gl_PointCoord-.5;float d=length(c);if(d>.5)discard;float a;vec3 col;
        if(vType<.5){a=smoothstep(.5,.38,d)*(.2+.8*smoothstep(.25,.45,d))+smoothstep(.15,0.,length(c-vec2(-.13,.13)))*.8;col=vec3(.8,.97,1.);}
        else{a=smoothstep(.5,0.,d);col=mix(vec3(1.,.75,.95),vec3(.7,1.,1.),step(.5,fract(gl_FragCoord.x*.013)));}
        gl_FragColor=vec4(col,a*vA*.9);}`});
  const pts=new T.Points(geo,mat);pts.frustumCulled=false;pts.name='Bubbles and sparkles';
  return {group:pts,update(t,cam,renderer){mat.uniforms.time.value=t;if(renderer)mat.uniforms.viewHeight.value=renderer.domElement.height;}};
}

export function createUnderwaterEnvironment(scene,{center=new T.Vector3(),radius=10,floorY,lights=true,quality='high',ownFog=true}={}){
  const R=radius, fy=floorY??center.y-R*.35, low=quality==='low';
  // ownFog:false keeps the game's own depth-tinted background and fog.
  if(ownFog){scene.background=new T.Color(0x034c99);
  scene.fog=new T.FogExp2(0x0e5cb4,0.55/(R*3.2));}
  const root=new T.Group();root.name='Underwater environment';scene.add(root);
  const water=makeWater(R);water.position.copy(center);root.add(water);
  const parts=[makeRays(R,center,fy,low?8:14),makeMotes(R,center,fy,low?160:360)];
  parts.forEach(p=>root.add(p.group));
  if(lights){
    const hemi=new T.HemisphereLight(0xf2fbff,0x7a5ab0,1.9);root.add(hemi);
    const sun=new T.DirectionalLight(0xfff4f8,1.5);sun.position.set(center.x+R*.4,center.y+R*3,center.z-R*.6);sun.target.position.copy(center);root.add(sun,sun.target);
  }
  return {
    root,
    update(seconds,camera,renderer){
      water.material.uniforms.time.value=seconds;water.position.copy(camera.position);
      for(const p of parts)p.update(seconds,camera,renderer);
    },
    dispose(){scene.remove(root);}
  };
}
