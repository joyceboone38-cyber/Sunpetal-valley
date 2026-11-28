import * as T from './vendor/three.module.min.js';
import { seabedFrame, seabedPads, seabedSamples, deckHeight } from './reef-seabed-layout.js';

// The Sunpetal seabed town. No floating islands: the town sits on the sea floor, joined by warm
// wooden boardwalks and round wooden decks (one per building), with a shell fountain at the
// centre and a shell arch at the town entrance. Everything is plain instanced geometry with flat
// colours, so it stays crisp and light. It builds the first time Joyce leaves her Homebase.
const rngFrom=seed=>{let s=seed>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};};
const smooth=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
const noise=(x,z)=>{
  const n=Math.sin(x*.131+1.7)*Math.cos(z*.117-.4)+.6*Math.sin(x*.29-z*.23+2.1)+.35*Math.sin(x*.61+z*.57);
  return n/1.95; // about -1..1
};
const hex=c=>new T.Color(c);

export function buildSeabed(scene) {
  const group=new T.Group();
  group.name='Sunpetal Seabed Town';
  group.position.set(seabedFrame.x,0,seabedFrame.z);
  group.visible=true;
  scene.add(group);
  const state={loaded:false,time:0,water:null,kelp:null,glow:null,sparkle:null};
  const woodTones=['#e0aa70','#cf9660','#ecbc82','#c48c5c','#d9a26a'].map(hex);
  const woodDark=hex('#6a4426');

  // Distance from a local point to the nearest wooden floor, used to flatten the sand and to keep props off the boards.
  const walkPoints=[];
  for(const path of seabedSamples)for(let i=0;i<path.samples.length;i+=2)walkPoints.push([path.samples[i].x,path.samples[i].z,path.w/2]);
  const walkDistance=(x,z)=>{
    let best=1e9;
    for(const pad of seabedPads)best=Math.min(best,Math.hypot(x-pad.x,z-pad.z)-pad.r);
    for(const [px,pz,half] of walkPoints){const d=Math.hypot(x-px,z-pz)-half;if(d<best)best=d;}
    return best;
  };

  function buildGround(){
    const size=190,seg=150;
    const geo=new T.PlaneGeometry(size,size,seg,seg);
    geo.rotateX(-Math.PI/2);
    geo.translate(0,0,6);
    const pos=geo.attributes.position;
    const colors=new Float32Array(pos.count*3);
    const sand=hex('#e9d6cf'),lilac=hex('#c8b0e0'),deep=hex('#9f8fd0'),moss=hex('#78cfc3'),mint=hex('#a6e6d2');
    const c=new T.Color();
    for(let i=0;i<pos.count;i++){
      const x=pos.getX(i),z=pos.getZ(i);
      const near=walkDistance(x,z);
      const dune=(noise(x*.7,z*.7)*.34+noise(x*.23+9,z*.23)*.55);
      const hold=smooth(1.2,6,near); // flat under and just beside the boardwalks
      pos.setY(i,(dune*hold-.1)*smooth(2,28,Math.hypot(x,z-6)*.7+near*.3));
      // Flat colour patches with soft but short edges: pale sand around the decks, lilac and moss further out.
      const n1=noise(x*.9+3,z*.9-5),n2=noise(x*.55-8,z*.55+4);
      c.copy(lilac);
      if(n1>.12)c.copy(sand);
      if(n1<-.38)c.copy(deep);
      if(n2>.42)c.copy(moss);
      if(n2>.62)c.copy(mint);
      c.lerp(sand,smooth(8,.5,near)*.55); // sandy halo around decks and paths
      colors[i*3]=c.r*.1;colors[i*3+1]=c.g*.1;colors[i*3+2]=c.b*.1; // the game's sun is strong, so the sand is dimmed
    }
    geo.setAttribute('color',new T.BufferAttribute(colors,3));
    geo.computeVertexNormals();
    const mesh=new T.Mesh(geo,new T.MeshStandardMaterial({vertexColors:true,roughness:.95,metalness:0,fog:false}));
    mesh.receiveShadow=true;mesh.name='Seabed';
    group.add(mesh);
  }

  function buildDecks(){
    const plankGeo=new T.BoxGeometry(1,1,1);
    const mat=new T.MeshStandardMaterial({roughness:.78,metalness:0});
    const items=[];
    const rng=rngFrom(7);
    // Round decks: parallel boards clipped to the circle.
    for(const pad of seabedPads){
      const top=pad.kind==='plaza'?deckHeight-.02:deckHeight-.012;
      for(let z=-pad.r+.25;z<=pad.r-.2;z+=.5){
        const half=Math.sqrt(Math.max(0,pad.r*pad.r-z*z))-.12;
        if(half<.6)continue;
        // Break long boards into two pieces with a seam, the way a real deck is laid.
        const pieces=half>3.2?2:1;
        for(let k=0;k<pieces;k++){
          const len=pieces===1?half*2:(half*2-.06)/2;
          const cx=pieces===1?0:(k===0?-half+len/2:half-len/2);
          items.push({x:pad.x+cx,y:top-.05,z:pad.z+z,sx:len,sy:.1,sz:.44,ry:0,tone:rng()});
        }
      }
    }
    // Boardwalks: one board across the path every half metre, following the curve.
    seabedSamples.forEach((path,index)=>{
      for(const s of path.samples){
        items.push({x:s.x,y:deckHeight+.012*index%.02-.05+.012,z:s.z,sx:path.w,sy:.1,sz:.44,ry:s.heading,tone:rng()});
      }
    });
    const planks=new T.InstancedMesh(plankGeo,mat,items.length);
    const m=new T.Matrix4(),q=new T.Quaternion(),e=new T.Euler(),p=new T.Vector3(),s=new T.Vector3(),col=new T.Color();
    items.forEach((it,i)=>{
      e.set(0,it.ry,0);q.setFromEuler(e);p.set(it.x,it.y,it.z);s.set(it.sx,it.sy,it.sz);
      m.compose(p,q,s);planks.setMatrixAt(i,m);
      col.copy(woodTones[Math.floor(it.tone*woodTones.length)%woodTones.length]);
      col.multiplyScalar((.94+((it.tone*17)%1)*.1)*.3);
      planks.setColorAt(i,col);
    });
    planks.instanceMatrix.needsUpdate=true;planks.instanceColor.needsUpdate=true;
    planks.receiveShadow=true;planks.name='Boardwalk planks';
    group.add(planks);

    // Dark understructure so the boards read as a raised deck, not a painted floor.
    const base=new T.MeshStandardMaterial({color:woodDark,roughness:.9});
    for(const pad of seabedPads){
      const skirt=new T.Mesh(new T.CylinderGeometry(pad.r-.05,pad.r+.12,.1,56),base);
      skirt.position.set(pad.x,.05,pad.z);group.add(skirt);
      const rim=new T.Mesh(new T.TorusGeometry(pad.r-.02,.13,8,72),new T.MeshStandardMaterial({color:hex('#8c5c34'),roughness:.7}));
      rim.rotation.x=Math.PI/2;rim.position.set(pad.x,deckHeight-.015,pad.z);group.add(rim);
    }
    const beamGeo=new T.BoxGeometry(1,1,1);
    const beams=[];
    seabedSamples.forEach(path=>{for(let i=0;i<path.samples.length;i+=3)beams.push({s:path.samples[i],w:path.w});});
    const beam=new T.InstancedMesh(beamGeo,base,beams.length);
    beams.forEach((b,i)=>{
      e.set(0,b.s.heading,0);q.setFromEuler(e);p.set(b.s.x,.075,b.s.z);s.set(b.w-.1,.15,.9);
      m.compose(p,q,s);beam.setMatrixAt(i,m);
    });
    beam.instanceMatrix.needsUpdate=true;group.add(beam);

    // Pearl and lilac inlay ring on the plaza deck.
    const inlay=new T.Mesh(new T.TorusGeometry(7.2,.12,6,96),new T.MeshStandardMaterial({color:hex('#fbe7f2'),roughness:.4,emissive:hex('#f6b6d4'),emissiveIntensity:.18}));
    inlay.rotation.x=Math.PI/2;inlay.position.set(0,deckHeight-.0,0);group.add(inlay);
    const inlay2=new T.Mesh(new T.TorusGeometry(9.6,.09,6,96),new T.MeshStandardMaterial({color:hex('#bda2ee'),roughness:.4}));
    inlay2.rotation.x=Math.PI/2;inlay2.position.set(0,deckHeight-.0,0);group.add(inlay2);
  }

  // Posts with warm glass lanterns along both edges of every boardwalk, and round the plaza.
  function buildLanterns(){
    const posts=[];
    seabedSamples.forEach(path=>{
      let travelled=0,last=path.samples[0],side=1;
      for(const s of path.samples){
        travelled+=Math.hypot(s.x-last.x,s.z-last.z);last=s;
        if(travelled<3.4)continue;
        travelled=0;
        for(const sd of [-1,1]){
          const x=s.x+Math.cos(s.heading)*(path.w/2-.12)*sd,z=s.z-Math.sin(s.heading)*(path.w/2-.12)*sd;
          if(seabedPads.some(pad=>Math.hypot(x-pad.x,z-pad.z)<pad.r+.4))continue;
          posts.push({x,z});
        }
        side*=-1;
      }
    });
    for(const pad of seabedPads){
      const count=Math.round(pad.r*1.6);
      for(let k=0;k<count;k++){
        const a=k/count*Math.PI*2+.2;
        const x=pad.x+Math.cos(a)*(pad.r-.25),z=pad.z+Math.sin(a)*(pad.r-.25);
        // Leave the openings where a boardwalk arrives.
        if(seabedSamples.some(path=>path.samples.some(s=>Math.hypot(s.x-x,s.z-z)<path.w/2+.7)))continue;
        if(k%2===0)posts.push({x,z});
      }
    }
    const postMat=new T.MeshStandardMaterial({color:hex('#80522f'),roughness:.8});
    const postGeo=new T.CylinderGeometry(.07,.09,.95,8);postGeo.translate(0,.475,0);
    const capGeo=new T.SphereGeometry(.12,10,8);
    const orbGeo=new T.SphereGeometry(.17,12,10);
    const orbMat=new T.MeshBasicMaterial({color:hex('#ffe2a6')});
    const P=new T.InstancedMesh(postGeo,postMat,posts.length);
    const C=new T.InstancedMesh(capGeo,new T.MeshStandardMaterial({color:hex('#f6d8ec'),roughness:.4}),posts.length);
    const O=new T.InstancedMesh(orbGeo,orbMat,posts.length);
    const m=new T.Matrix4();
    const glow=new Float32Array(posts.length*3);
    posts.forEach((p,i)=>{
      m.makeTranslation(p.x,deckHeight-.02,p.z);P.setMatrixAt(i,m);
      m.makeTranslation(p.x,deckHeight+.93,p.z);C.setMatrixAt(i,m);
      m.makeTranslation(p.x,deckHeight+1.18,p.z);O.setMatrixAt(i,m);
      glow[i*3]=p.x;glow[i*3+1]=deckHeight+1.18;glow[i*3+2]=p.z;
    });
    group.add(P,C,O);
    // A soft warm halo for every lantern, drawn as one batch of points.
    const cv=document.createElement('canvas');cv.width=cv.height=64;
    const g=cv.getContext('2d'),grad=g.createRadialGradient(32,32,2,32,32,32);
    grad.addColorStop(0,'rgba(255,226,166,.95)');grad.addColorStop(.35,'rgba(255,210,140,.35)');grad.addColorStop(1,'rgba(255,200,130,0)');
    g.fillStyle=grad;g.fillRect(0,0,64,64);
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(glow,3));
    const pts=new T.Points(geo,new T.PointsMaterial({map:new T.CanvasTexture(cv),size:2.6,transparent:true,depthWrite:false,blending:T.AdditiveBlending,sizeAttenuation:true}));
    pts.frustumCulled=false;group.add(pts);
    state.glow=pts;
  }

  function petalFan(count,spread,radius,petalSize,color,tip){
    const g=new T.Group();
    const mat=new T.MeshStandardMaterial({color:hex(color),roughness:.35,emissive:hex(tip),emissiveIntensity:.12});
    for(let k=0;k<count;k++){
      const f=count===1?.5:k/(count-1);
      const a=(f-.5)*spread;
      const petal=new T.Mesh(new T.SphereGeometry(1,16,12),mat);
      petal.scale.set(petalSize*.62,petalSize,petalSize*.22);
      petal.position.set(Math.sin(a)*radius,petalSize*.88,Math.cos(a)*radius*.28);
      petal.rotation.z=-a*.9;petal.rotation.y=a*.35;
      g.add(petal);
    }
    return g;
  }

  function buildFountain(){
    const f=new T.Group();f.name='Shell Fountain';f.position.set(0,deckHeight-.02,0);
    const pearl=new T.MeshStandardMaterial({color:hex('#fdeaf3'),roughness:.35});
    const lilac=new T.MeshStandardMaterial({color:hex('#c9b0f0'),roughness:.45});
    const wall=new T.Mesh(new T.LatheGeometry([[4.1,0],[4.7,0],[4.85,.45],[4.7,.95],[4.25,1.0],[4.1,.7],[4.1,0]].map(([r,y])=>new T.Vector2(r,y)),64),pearl);
    f.add(wall);
    const trim=new T.Mesh(new T.TorusGeometry(4.78,.16,8,72),new T.MeshStandardMaterial({color:hex('#f4cf7a'),roughness:.3,metalness:.25}));
    trim.rotation.x=Math.PI/2;trim.position.y=.98;f.add(trim);
    const step=new T.Mesh(new T.CylinderGeometry(5.5,5.7,.22,64),lilac);step.position.y=.11;f.add(step);
    const water=new T.Mesh(new T.CircleGeometry(4.15,56),new T.MeshStandardMaterial({color:hex('#5fd6d0'),emissive:hex('#27b8c8'),emissiveIntensity:.5,roughness:.15,transparent:true,opacity:.92}));
    water.rotation.x=-Math.PI/2;water.position.y=.72;f.add(water);state.water=water;
    const stem=new T.Mesh(new T.CylinderGeometry(.55,.95,1.5,24),lilac);stem.position.y=1.1;f.add(stem);
    const bowl=new T.Mesh(new T.SphereGeometry(1.35,28,16,0,Math.PI*2,0,Math.PI*.5),pearl);bowl.position.y=1.7;bowl.scale.y=.55;f.add(bowl);
    const shell=petalFan(11,Math.PI*1.45,1.5,1.9,'#f8b8da','#ff8fc6');shell.position.y=1.9;f.add(shell);
    const back=petalFan(9,Math.PI*1.2,1.1,1.5,'#d7b4f4','#b48cf2');back.position.set(0,2.05,-.35);back.scale.setScalar(.9);f.add(back);
    const pearlOrb=new T.Mesh(new T.SphereGeometry(.52,24,18),new T.MeshStandardMaterial({color:hex('#fff6fb'),emissive:hex('#ffd9ee'),emissiveIntensity:.9,roughness:.2}));
    pearlOrb.position.set(0,2.2,.25);f.add(pearlOrb);
    // Four small spouts spilling into the basin.
    for(let k=0;k<4;k++){
      const a=k/4*Math.PI*2+Math.PI/4;
      const spout=new T.Mesh(new T.SphereGeometry(.34,14,10),pearl);
      spout.position.set(Math.cos(a)*4.7,.95,Math.sin(a)*4.7);f.add(spout);
    }
    f.scale.setScalar(.72);
    group.add(f);
  }

  function buildGate(){
    const pad=seabedPads.find(p=>p.id==='entrance');
    const g=new T.Group();g.position.set(pad.x,deckHeight-.02,pad.z-1.2);g.name='Town entrance arch';
    const lilac=new T.MeshStandardMaterial({color:hex('#c3a4ee'),roughness:.4});
    const pearl=new T.MeshStandardMaterial({color:hex('#fbe3f0'),roughness:.35});
    for(const sx of [-1,1]){
      const pillar=new T.Mesh(new T.CylinderGeometry(.55,.72,4.2,16),lilac);pillar.position.set(sx*2.8,2.1,0);g.add(pillar);
      const cap=new T.Mesh(new T.SphereGeometry(.72,16,12),pearl);cap.position.set(sx*2.8,4.3,0);g.add(cap);
      const orb=new T.Mesh(new T.SphereGeometry(.4,16,12),new T.MeshStandardMaterial({color:hex('#fff4fa'),emissive:hex('#ffd0ea'),emissiveIntensity:.9}));orb.position.set(sx*2.8,5.2,0);g.add(orb);
    }
    const arch=new T.Mesh(new T.TorusGeometry(2.8,.5,12,40,Math.PI),pearl);arch.position.y=4.3;g.add(arch);
    const crest=petalFan(9,Math.PI*1.3,1.5,1.5,'#f6b4d8','#ff8fc6');crest.position.set(0,7.1,0);g.add(crest);
    group.add(g);
  }

  function buildScatter(){
    const rng=rngFrom(11);
    const place=(count,minDist,maxR)=>{
      const out=[];let tries=0;
      while(out.length<count&&tries<count*40){
        tries++;
        const x=(rng()*2-1)*maxR,z=(rng()*2-1)*(maxR*1.05)+6;
        if(walkDistance(x,z)<minDist)continue;
        out.push([x,z]);
      }
      return out;
    };
    const m=new T.Matrix4(),q=new T.Quaternion(),e=new T.Euler(),p=new T.Vector3(),s=new T.Vector3(),col=new T.Color();
    // Faceted rocks.
    const rocks=place(150,3.2,62);
    const rockMesh=new T.InstancedMesh(new T.IcosahedronGeometry(1,0),new T.MeshStandardMaterial({roughness:.8,flatShading:true}),rocks.length);
    const rockTones=['#a592d8','#8f7fc8','#b9a7e4','#7fb4c8','#c9a8d8'].map(hex);
    rocks.forEach(([x,z],i)=>{
      const k=.5+rng()*1.5;e.set((rng()-.5)*.4,rng()*6.28,(rng()-.5)*.4);q.setFromEuler(e);
      p.set(x,k*.3,z);s.set(k*(1+rng()*.8),k*(.55+rng()*.5),k*(1+rng()*.8));m.compose(p,q,s);rockMesh.setMatrixAt(i,m);
      rockMesh.setColorAt(i,col.copy(rockTones[Math.floor(rng()*rockTones.length)]).multiplyScalar((.9+rng()*.2)*.45));
    });
    group.add(rockMesh);
    // Branching coral: rounded stems with round tips.
    const coralTones=['#ff8fb4','#ff6fb8','#5fd9cb','#ffaa78','#b790ff'].map(hex);
    const clusters=place(95,2.4,60);
    const stems=[];
    clusters.forEach(([x,z])=>{
      const tone=coralTones[Math.floor(rng()*coralTones.length)],base=.7+rng()*1.3;
      const n=3+Math.floor(rng()*4);
      for(let k=0;k<n;k++){
        const a=rng()*6.28,lean=.18+rng()*.5,h=base*(.7+rng()*.8);
        stems.push({x:x+Math.cos(a)*.25,z:z+Math.sin(a)*.25,a,lean,h,tone});
        // A side branch on taller stems.
        if(h>1.1)stems.push({x:x+Math.cos(a)*.25+Math.sin(a)*lean*h*.45,z:z+Math.sin(a)*.25-Math.cos(a)*lean*h*.0,a:a+.9,lean:lean+.4,h:h*.5,tone,y:h*.6});
      }
    });
    const stemMesh=new T.InstancedMesh(new T.CylinderGeometry(.09,.17,1,7),new T.MeshStandardMaterial({roughness:.55}),stems.length);
    const tipMesh=new T.InstancedMesh(new T.SphereGeometry(.17,10,8),new T.MeshStandardMaterial({roughness:.4,emissive:hex('#ff7ab8'),emissiveIntensity:.12}),stems.length);
    stems.forEach((st,i)=>{
      e.set(Math.cos(st.a)*st.lean,0,-Math.sin(st.a)*st.lean);q.setFromEuler(e);
      const y0=st.y||0;
      p.set(st.x,y0+st.h/2*Math.cos(st.lean),st.z);s.set(1,st.h,1);m.compose(p,q,s);stemMesh.setMatrixAt(i,m);
      stemMesh.setColorAt(i,st.tone);
      const tip=new T.Vector3(0,st.h/2,0).applyQuaternion(q).add(p);
      m.compose(tip,new T.Quaternion(),new T.Vector3(1.15,1.15,1.15));tipMesh.setMatrixAt(i,m);tipMesh.setColorAt(i,col.copy(st.tone).lerp(hex('#fff0f6'),.35));
    });
    group.add(stemMesh,tipMesh);
    // Kelp: tall, thin and swaying.
    const kelpPts=place(110,2.6,64);
    const kelp=new T.InstancedMesh(new T.CylinderGeometry(.05,.16,1,6,6),new T.MeshStandardMaterial({color:hex('#4aa87a'),roughness:.7}),kelpPts.length);
    kelp.userData.items=kelpPts.map(([x,z])=>({x,z,h:2+rng()*3.2,ph:rng()*6.28}));
    state.kelp=kelp;group.add(kelp);
    // Crystals near the plaza and the homes, like the glowing ones in the art.
    const crystals=place(40,3,36);
    const cMesh=new T.InstancedMesh(new T.ConeGeometry(.28,1,6),new T.MeshStandardMaterial({color:hex('#9fe7ff'),emissive:hex('#5fd0ff'),emissiveIntensity:.55,roughness:.2,flatShading:true}),crystals.length);
    crystals.forEach(([x,z],i)=>{
      const h=.6+rng()*1.5;e.set((rng()-.5)*.5,rng()*6,(rng()-.5)*.5);q.setFromEuler(e);p.set(x,h/2,z);s.set(1,h,1);m.compose(p,q,s);cMesh.setMatrixAt(i,m);
      cMesh.setColorAt(i,col.copy(rng()<.5?hex('#9fe7ff'):hex('#e0b0ff')));
    });
    group.add(cMesh);
    // Drifting sparkle motes over the whole town.
    const motes=new Float32Array(240*3);
    for(let i=0;i<240;i++){motes[i*3]=(rng()*2-1)*55;motes[i*3+1]=.6+rng()*7;motes[i*3+2]=(rng()*2-1)*58+6;}
    const mg=new T.BufferGeometry();mg.setAttribute('position',new T.BufferAttribute(motes,3));
    const sparkle=new T.Points(mg,new T.PointsMaterial({color:hex('#e8fbff'),size:.18,transparent:true,opacity:.8,depthWrite:false}));
    sparkle.frustumCulled=false;group.add(sparkle);state.sparkle=sparkle;
  }

  const load=()=>{
    if(state.loaded)return;
    state.loaded=true;
    buildGround();buildDecks();buildLanterns();buildFountain();buildGate();buildScatter();
  };

  const tmpM=new T.Matrix4(),tmpQ=new T.Quaternion(),tmpE=new T.Euler(),tmpP=new T.Vector3(),tmpS=new T.Vector3();
  return {
    ensureLoaded:load,
    group,
    tick(time){
      if(!state.loaded)return;
      if(state.water)state.water.material.emissiveIntensity=.45+Math.sin(time*1.6)*.12;
      if(state.sparkle)state.sparkle.position.y=Math.sin(time*.35)*.25;
      const kelp=state.kelp;
      if(kelp){
        const items=kelp.userData.items;
        for(let i=0;i<items.length;i++){
          const it=items[i],sway=Math.sin(time*.9+it.ph)*.16;
          tmpE.set(sway,0,Math.cos(time*.7+it.ph)*.14);tmpQ.setFromEuler(tmpE);
          tmpP.set(it.x,it.h/2*Math.cos(sway),it.z);tmpS.set(1,it.h,1);
          tmpM.compose(tmpP,tmpQ,tmpS);kelp.setMatrixAt(i,tmpM);
        }
        kelp.instanceMatrix.needsUpdate=true;
      }
    },
    setViewHeight(){},
    get loaded(){return state.loaded;}
  };
}
