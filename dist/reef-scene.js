import * as T from './vendor/three.module.min.js';
import { createReefRenderer } from './reef-renderer.js';
import { buildOpalCottage } from './opal-cottage.js';
import { buildLuma } from './luma.js';
import { addReefLife } from './reef-life.js';
import { makeReefMaterials, makeUnderwaterProbe } from './reef-surfaces.js';
import { glam } from './reef-glam.js'; // [sunpetal-glam]
import { buildHomeStations, buildGlassfin, growCoastalCover, loadEnvironmentArt } from './reef-landmarks.js';
import { createAvatar } from './reef-avatar.js';
import { buildMoonlacePearl } from './reef-keepsake.js';
import { createStaticReefAssets, hasReefModel } from './reef-model-loader.js';
import { createRegionalArt } from './reef-region-art.js';
import { buildFarmIsland,buildCottageRoom } from './reef-homestead.js';
import { buildPlaza } from './reef-plaza.js';
import { plazaLeft } from './reef-plaza-floor.js';
import { createUnderwaterEnvironment } from './underwater-environment.js';
import { loadSeaLife } from './sea-life.js';
import { createFurniture } from './reef-furniture.js'; // [sunpetal-shop]
import { createJuice } from './reef-juice.js';
import { createProps } from './reef-props.js';

const tau = Math.PI*2;
const material = (color, options = {}) => new T.MeshStandardMaterial({ color, roughness: .82, ...options });
const glow = color => material(color, { emissive: color, emissiveIntensity: .95, roughness: .3 });
const mesh = (parent, geometry, mat, x=0,y=0,z=0) => {
  const object = new T.Mesh(geometry,mat);
  object.position.set(x,y,z);
  parent.add(object);
  return object;
};
const box = (parent, mat, x,y,z,w,h,d) => mesh(parent,new T.BoxGeometry(w,h,d),mat,x,y,z);
const orb = (parent,mat,x,y,z,sx,sy,sz,detail=1) => {
  const object = mesh(parent,new T.IcosahedronGeometry(1,detail),mat,x,y,z);
  object.scale.set(sx,sy,sz);
  return object;
};
function rod(parent,mat,a,b,r1,r2=r1) {
  const start = new T.Vector3(...a), end = new T.Vector3(...b);
  const delta = end.clone().sub(start);
  const shaft = mesh(parent,new T.CylinderGeometry(r2,r1,delta.length(),7),mat);
  shaft.position.copy(start).lerp(end,.5);
  shaft.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());
  return shaft;
}
function tube(parent,mat,points,radius,segments=20) {
  const path = new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));
  return mesh(parent,new T.TubeGeometry(path,segments,radius,7,false),mat);
}
function seeded() {
  let seed = 17513;
  return () => ((seed = (Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
}

export function createReef(canvas, places) {
  const { farm, cottage, cottageLanding, jelly, shelf, moonlacePearl, station, grotto, glass, secondBed, displaySpots } = places;
  const random = seeded();
  let quality=places.quality??'high';
  const renderer = places.rendererOverride ?? createReefRenderer(canvas,{quality,simpleGraphics:places.simpleGraphics});
  const scene = new T.Scene();
  // The old Homebase island and its scenery were replaced by the Underwater Plaza. That code
  // still runs so Moonlace Reef keeps its exact random layout; what it builds for the old town
  // is dropped from the scene right away.
  const dropOldTown=from=>{
    for(const object of scene.children.slice(from))scene.remove(object);
  };
  const artFallbacks={coral:{home:[],reef:[]},kelp:{home:[],reef:[]},geodes:[],glowlogs:[],caves:[],arches:[],rocks:[]};
  const nearWater=new T.Color('#1b4a6b').lerp(new T.Color('#2b8fb8'),glam),deepWater=new T.Color('#252250').lerp(new T.Color('#4b2c86'),glam);
  scene.background=nearWater.clone();
  scene.fog=new T.Fog(nearWater,11,41);
  if(renderer.supportsHDR!==false) scene.environment=makeUnderwaterProbe();
  scene.environmentIntensity=.80+.2*glam;
  const materials=makeReefMaterials();
  const camera = new T.PerspectiveCamera(44,1,.1,115);
  const focus = new T.Vector3(-7,.7,2);
  const gold = materials.gold;
  const amber = glow('#ffc078');
  const violet = material('#6853b8',{roughness:.53,metalness:.25});
  const wood = materials.wood;
  const soil = material('#483045');
  const teal = material('#34a696');
  const pink = glow('#ff80dc');
  const cyan = glow('#70edff');
  const rockMats = ['#354869','#464971','#405e74','#423a65','#315267'].map(materials.limestone);
  const skylight=new T.HemisphereLight(new T.Color('#c4f4fb').lerp(new T.Color('#ffdff6'),glam),new T.Color('#543a65').lerp(new T.Color('#8650b8'),glam),.69+.26*glam);
  scene.add(skylight);
  const sun = new T.DirectionalLight('#edf9ff',2.78);
  sun.position.set(-12.5,30,-4.5);
  sun.castShadow=true;
  sun.shadow.mapSize.set(quality==='low'?1024:2048,quality==='low'?1024:2048);
  Object.assign(sun.shadow.camera,{left:-28,right:28,bottom:-19,top:21,near:1,far:60});
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.normalBias=.034;
  sun.shadow.bias=-.00025;
  sun.shadow.intensity=.81;
  scene.add(sun);
  const fill = new T.DirectionalLight(new T.Color('#c6a1ff').lerp(new T.Color('#ff9fe3'),glam),.67+.5*glam);
  fill.position.set(12,6,6);
  scene.add(fill);
  const porchLight=new T.PointLight('#ffd1a5',15,9,2);
  porchLight.position.set(cottage.x+1.1,2.8,cottage.z+2.65);
  porchLight.visible=Boolean(places.homeVisible);
  scene.add(porchLight);
  const grottoLight=new T.PointLight('#a49cfc',11.5,7,2);
  grottoLight.position.set(grotto.x+.50,1.9,grotto.z-.25);
  scene.add(grottoLight);

  const stoneGeometry=Array.from({length:4},(_,variant)=>{
    const geometry=new T.IcosahedronGeometry(1,4);
    const positions=geometry.attributes.position;
    const colors=[];
    const light=new T.Color('#e3e8df');
    const dark=new T.Color('#667483');
    for(let i=0;i<positions.count;i++){
      const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
      const breakup=1+.12*Math.sin(x*5.1+z*3.2+variant)*Math.cos(y*4.6-z*2.2)
        +.064*Math.sin(z*9.2+x*5.8+variant*1.7);
      const shelf=y+.085*Math.sin(x*4.6+variant)+.064*Math.cos(z*5.4);
      const grain=.76+.12*Math.sin(shelf*18.5+z*.9)+.065*Math.sin(shelf*35.5+x*.6);
      const tint=dark.clone().lerp(light,T.MathUtils.clamp(grain+(y*.18),0,1));
      positions.setXYZ(i,(x+.08*Math.sin(y*4.3+variant))*breakup,y*breakup,z*breakup);
      colors.push(tint.r,tint.g,tint.b);
    }
    geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
    geometry.computeBoundingSphere();
    return geometry;
  });
  const stoneMats=rockMats.map(mat=>{
    const layered=mat.clone();
    layered.vertexColors=true;
    return layered;
  });
  function stone(index,x,y,z,sx,sy,sz){
    const rock=mesh(scene,stoneGeometry[index%stoneGeometry.length],stoneMats[index%stoneMats.length],x,y,z);
    rock.scale.set(sx,sy,sz);
    return rock;
  }

  const waterTime={value:0};
  growCoastalCover(scene,waterTime);
  const effects={value:quality==='low'?.45:1};
  const causticGLSL=`
    vec2 reefCell(vec2 p){
      vec2 n=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3)));
      return fract(sin(n)*43758.5453);
    }
    float reefNoise(vec2 p){
      vec2 cell=floor(p);
      vec2 fraction=fract(p);
      vec2 weight=fraction*fraction*(3.-2.*fraction);
      return mix(mix(reefCell(cell).x,reefCell(cell+vec2(1.,0.)).x,weight.x),
        mix(reefCell(cell+vec2(0.,1.)).x,reefCell(cell+vec2(1.,1.)).x,weight.x),weight.y);
    }
    float reefCaustics(vec2 q,float clock){
      q+=vec2(sin(q.y*.93+clock*.36),cos(q.x*.75-clock*.24))*.27;
      vec2 cell=floor(q);
      vec2 local=fract(q);
      float nearest=4.;
      float next=4.;
      for(int y=-1;y<=1;y++){
        for(int x=-1;x<=1;x++){
          vec2 offset=vec2(float(x),float(y));
          vec2 jitter=reefCell(cell+offset);
          vec2 center=.15+.70*jitter+.085*sin(jitter*6.283+clock*.42);
          vec2 delta=offset+center-local;
          float d=dot(delta,delta);
          next=min(next,max(nearest,d));
          nearest=min(nearest,d);
        }
      }
      float contour=1.-smoothstep(.014,.083,next-nearest);
      float causticMask=smoothstep(-.52,.72,sin(q.x*.57+sin(q.y*.47)*1.9+clock*.12));
      return contour*(.04+.96*causticMask);
    }
  `;
  function lightRipples(surface,strength,shore){
    surface.onBeforeCompile=shader=>{
      shader.uniforms.waterTime=waterTime;
      shader.uniforms.reefEffects=effects;
      shader.vertexShader='varying vec3 reefWorldPosition;\n'+shader.vertexShader.replace(
        '#include <project_vertex>',
        '#include <project_vertex>\nreefWorldPosition=(modelMatrix*vec4(transformed,1.0)).xyz;'
      );
      shader.fragmentShader=`varying vec3 reefWorldPosition;
        uniform float waterTime;
        uniform float reefEffects;
        ${causticGLSL}
      `+shader.fragmentShader.replace('#include <color_fragment>',`
        #include <color_fragment>
        vec2 stoneUV=reefWorldPosition.xz;
        float grain=reefNoise(stoneUV*34.);
        float fleck=reefNoise(stoneUV*8.8);
        float pigment=reefNoise(stoneUV*.95+vec2(fleck*.47));
        float mineral=reefNoise(stoneUV*3.1+vec2(-4.2,1.7));
        vec3 stain=mix(vec3(.45,.51,.74),vec3(1.10,1.09,1.03),smoothstep(.17,.84,pigment));
        float vein=pow(.5+.5*sin(stoneUV.x*5.4+stoneUV.y*4.3+(mineral+.65*pigment)*6.),9.);
        diffuseColor.rgb*=stain*(.71+.31*mineral+.22*fleck+.11*grain);
        diffuseColor.rgb+=vec3(.057,.038,.039)*vein*(.36+.64*pigment);
        diffuseColor.rgb+=vec3(.048,.041,.038)*smoothstep(.64,.94,grain)*mineral;
        float sediment=pow(smoothstep(.30,.86,reefNoise(stoneUV*1.92+vec2(mineral*.61))),2.);
        diffuseColor.rgb*=mix(vec3(.86,.85,.97),vec3(1.15,1.08,1.03),sediment);
        ${shore ? `
          vec2 cliffCenter=vec2(${shore.x.toFixed(2)},${shore.z.toFixed(2)});
          float cliffEdge=length((stoneUV-cliffCenter)/vec2(${shore.rx.toFixed(2)},${shore.rz.toFixed(2)}));
          float algae=smoothstep(.78,.99,cliffEdge+pigment*.14)*smoothstep(.25,.74,mineral);
          diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.086,.16,.18)*(mineral+.46),algae*.72);
        ` : ''}
      `).replace('#include <roughnessmap_fragment>',`
        #include <roughnessmap_fragment>
        roughnessFactor=clamp(roughnessFactor*(.79+.23*mineral+.14*grain),.25,1.);
      `).replace('#include <opaque_fragment>',`
        if(reefEffects>.7){
          float reefLight=reefCaustics(reefWorldPosition.xz*1.62,waterTime);
          outgoingLight+=vec3(.08,.26,.33)*reefLight*${strength.toFixed(2)};
        }
        #include <opaque_fragment>
      `);
    };
    surface.customProgramCacheKey=()=>`reef-light-ripples-${strength}-${shore?.x??0}`;
    return surface;
  }

  const sea = new T.ShaderMaterial({
    uniforms: { time: waterTime, reefEffects:effects },
    vertexShader: `varying vec3 p; varying float depth;
      void main(){
        p=position;
        vec4 view=modelViewMatrix*vec4(position,1.);
        depth=-view.z;
        gl_Position=projectionMatrix*view;
      }`,
    fragmentShader: `uniform float time; uniform float reefEffects; varying vec3 p; varying float depth;
      ${causticGLSL}
      void main(){
        vec2 q=vec2(p.x,-p.y);
        vec2 distortion=vec2(reefNoise(q*.34+vec2(.0,time*.12)),reefNoise(q*.31+vec2(time*.09,4.2)));
        float caustic=reefEffects>.7?reefCaustics(q*1.19+distortion*.83,time):
          .12*pow(.5+.5*sin(q.x*1.8+q.y*.93+distortion.x*7.+time*.31),6.);
        float cloud=reefNoise(q*.18)+.19*reefNoise(q*.43+vec2(time*.05,0.));
        float purple=smoothstep(2.,20.,q.x);
        vec3 col=mix(vec3(.006,.017,.066),vec3(.019,.135,.18),cloud);
        col=mix(col,mix(vec3(.015,.011,.049),vec3(.040,.066,.165),cloud),purple*.82);
        float channelZ=1.5+sin((q.x+1.)*.27)*1.9;
        float channelDistance=(q.y-channelZ)*.33;
        float channel=exp(-channelDistance*channelDistance);
        float reach=smoothstep(-10.,-4.,q.x)*(1.-smoothstep(11.,19.,q.x));
        col+=vec3(.010,.070,.082)*channel*reach;
        float visibility=1.-smoothstep(18.,48.,depth);
        float layers=reefNoise(q*.52+vec2(time*.06,0.));
        col+=vec3(.022,.092,.121)*caustic*visibility*(.25+.48*layers+.22*channel*reach);
        float shelves=min(abs(length((q-vec2(-12.,1.))/vec2(8.5,7.2))-1.),
          abs(length((q-vec2(13.,-2.))/vec2(7.3,6.))-1.));
        shelves=min(shelves,abs(length((q-vec2(${places.farmIsland.x.toFixed(2)},${places.farmIsland.z.toFixed(2)}))/vec2(13.7,13.7))-1.));
        col*=mix(.56,1.,smoothstep(.02,.47,shelves));
        col=mix(vec3(.018,.065,.121),col,.28+.72*visibility);
        gl_FragColor=vec4(col,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const seabed = mesh(scene,new T.PlaneGeometry(240,240),sea,0,-4.8,0);
  seabed.rotation.x=-Math.PI/2;

  const lightShaftMaterial=new T.ShaderMaterial({
    uniforms:{time:waterTime},
    transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false,
    vertexShader:`varying vec2 vUv;
      void main(){
        vUv=uv;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
      }`,
    fragmentShader:`uniform float time; varying vec2 vUv;
      void main(){
        float height=vUv.y;
        float angle=(1.-height)*.16;
        float x=vUv.x+angle;
        float drift=sin(time*.19+height*4.)*.006;
        float shimmer=pow(.5+.5*sin((x+drift)*87.),6.);
        float broad=pow(.5+.5*sin((x+drift*.53)*43.+1.7),3.);
        float bounds=smoothstep(.10,.32,vUv.x)*(1.-smoothstep(.68,.91,vUv.x));
        float fade=smoothstep(.07,.67,height)*(1.-smoothstep(.93,1.,height));
        gl_FragColor=vec4(.10,.54,.88,(shimmer*.25+broad*.15)*bounds*fade);
      }`
  });
  const shafts=mesh(scene,new T.PlaneGeometry(79,24),lightShaftMaterial,0,7.5,-14.5);

  // Keep the existing walkable footprint and build the ledge down into the seabed.
  function island(x,z,rx,rz,palette,phase){
    const radialSteps=96;
    const profiles=[
      { altitude:0, radius:1, tint:'#cfb0a7' },
      { altitude:-.16, radius:1.015, tint:'#a58a9f' },
      { altitude:-.44, radius:.973, tint:'#83738f' },
      { altitude:-.65, radius:1.003, tint:'#67718e' },
      { altitude:-.86, radius:1.028, tint:'#4b587b' },
      { altitude:-1.16, radius:.981, tint:'#5c6e8c' },
      { altitude:-1.44, radius:1.015, tint:'#404f73' },
      { altitude:-1.87, radius:.956, tint:'#3e5275' },
      { altitude:-2.24, radius:.982, tint:'#304461' },
      { altitude:-2.76, radius:.918, tint:'#233956' },
      { altitude:-3.67, radius:.897, tint:'#122e52' }
    ];
    const positions=[],colors=[],indices=[];
    const rim=[];
    for(let row=0;row<profiles.length;row++){
      const {altitude,radius,tint}=profiles[row];
      const color=new T.Color(tint);
      for(let i=0;i<=radialSteps;i++){
        const angle=i/radialSteps*tau;
        const scallop=1+.042*Math.sin(angle*5+phase)+.024*Math.cos(angle*11-phase);
        const carving=.015*Math.sin(angle*19+row*.56)+.013*Math.cos(angle*23-row*.43);
        const variation=1+.075*Math.sin(angle*9+phase)+.036*Math.cos(angle*29+row);
        const px=Math.cos(angle)*rx*(scallop*radius+carving);
        const pz=Math.sin(angle)*rz*(scallop*radius+carving);
        const py=altitude+Math.sin(angle*7+row*.47)*Math.min(.21,row*.038);
        positions.push(px,py,pz);
        colors.push(color.r*variation,color.g*variation,color.b*variation);
        if(row===0&&i<radialSteps) rim.push(new T.Vector2(px,-pz));
        if(row+1<profiles.length&&i<radialSteps){
          const k=row*(radialSteps+1)+i;
          indices.push(k,k+1,k+radialSteps+1,k+1,k+radialSteps+2,k+radialSteps+1);
        }
      }
    }
    const edge=new T.BufferGeometry();
    edge.setAttribute('position',new T.Float32BufferAttribute(positions,3));
    edge.setAttribute('color',new T.Float32BufferAttribute(colors,3));
    edge.setIndex(indices);
    edge.computeVertexNormals();
    const normals=edge.attributes.normal;
    const firstNormal=new T.Vector3(),lastNormal=new T.Vector3();
    for(let row=0;row<profiles.length;row++){
      const first=row*(radialSteps+1),last=first+radialSteps;
      firstNormal.fromBufferAttribute(normals,first).add(lastNormal.fromBufferAttribute(normals,last)).normalize();
      normals.setXYZ(first,firstNormal.x,firstNormal.y,firstNormal.z);
      normals.setXYZ(last,firstNormal.x,firstNormal.y,firstNormal.z);
    }
    const rimMaterial=material(x<0?'#dfc7f3':'#afa7e7',{vertexColors:true,roughness:.77,metalness:.08});
    mesh(scene,edge,rimMaterial,x,0,z).receiveShadow=true;
    const shelfMaterial=materials.limestone(palette);
    shelfMaterial.roughness=x<0?.90:.77;
    shelfMaterial.normalScale.setScalar(x<0?.71:.92);
    const surface=mesh(scene,new T.ShapeGeometry(new T.Shape(rim)),lightRipples(shelfMaterial,x<0?.23:.28,{x,z,rx,rz}),x,.004,z);
    surface.rotation.x=-Math.PI/2;
    surface.receiveShadow=true;
    // Preserve the random sequence used by the other scene assets.
    for(let i=0;i<288;i++) random();
  }
  const oldIsland=scene.children.length;
  island(-12,1,8.5,7.2,'#b38c8d',.24);
  dropOldTown(oldIsland);
  island(13,-2,7.3,6.0,'#3b3e65',1.16);

  const tileMats=['#d4b296','#e0b7b0','#ccaaa5','#e3bda1','#c3a3b7'].map(c=>lightRipples(materials.limestone(c),.32));
  const mortar=material('#59475c',{roughness:1});
  const oldPaving=scene.children.length;
  const paving = new T.Group();
  scene.add(paving);
  const landing = new T.Group();
  landing.name='Cottage approach landing';
  landing.position.set(cottageLanding.x,0,cottageLanding.z);
  paving.add(landing);
  const stoneRandom = seeded();
  for(let row=0;row<17;row++){
    const center=-12.8+Math.sin(row*.36)*.43;
    const section=row>=4&&row<=6?landing:paving;
    const widths=[.58+stoneRandom()*.32,.68+stoneRandom()*.24,.59+stoneRandom()*.33];
    let left=center-widths.reduce((sum,width)=>sum+width,0)/2;
    for(let column=0;column<widths.length;column++){
      const width=widths[column], depth=.43+stoneRandom()*.04;
      const cut=.07+stoneRandom()*.08;
      const stone=new T.Shape();
      stone.moveTo(-width/2+cut,-depth/2);
      stone.lineTo(width/2-cut*.7,-depth/2);
      stone.lineTo(width/2,-depth/2+cut*.7);
      stone.lineTo(width/2-.026,depth/2-cut);
      stone.lineTo(width/2-cut,depth/2);
      stone.lineTo(-width/2+cut*.6,depth/2-.018);
      stone.lineTo(-width/2,depth/2-cut);
      stone.lineTo(-width/2+.022,-depth/2+cut);
      stone.closePath();
      const geometry=new T.ExtrudeGeometry(stone,{depth:.05,bevelEnabled:true,bevelSize:.019,bevelThickness:.014,bevelSegments:1});
      const tile=mesh(section,geometry,[tileMats[(row*2+column)%5],mortar],
        left+width/2-section.position.x,.025,-1+row*.48-section.position.z);
      tile.rotation.set(-Math.PI/2,0,(stoneRandom()-.5)*.14);
      tile.receiveShadow=true;
      left+=width+.048;
    }
  }
  const mosaicStone=materials.nacre('#e4beb4');
  const mosaicInlay=materials.nacre('#9d718d');
  const mosaicCenter=new T.Vector3(-10.58,.009,1.61);
  const floorSeal=mesh(scene,new T.CircleGeometry(1.11,48),mosaicStone,...mosaicCenter.toArray());
  floorSeal.rotation.x=-Math.PI/2;
  floorSeal.receiveShadow=true;
  for(const radius of [.96,1.055]){
    const border=mesh(scene,new T.RingGeometry(radius,radius+.018,64),mosaicInlay,mosaicCenter.x,.013,mosaicCenter.z);
    border.rotation.x=-Math.PI/2;
    border.receiveShadow=true;
  }
  for(let i=0;i<6;i++){
    const heading=i*tau/6;
    const arc=Array.from({length:16},(_,step)=>{
      const t=step/15;
      const angle=heading+Math.sin(t*Math.PI)*.36;
      const radius=.10+t*.74;
      return [mosaicCenter.x+Math.cos(angle)*radius,.015,mosaicCenter.z+Math.sin(angle)*radius];
    });
    tube(scene,mosaicInlay,arc,.012,18).receiveShadow=true;
  }
  dropOldTown(oldPaving);

  const haloSize=64;
  const haloPixels=new Uint8Array(haloSize*haloSize*4);
  for(let y=0;y<haloSize;y++){
    for(let x=0;x<haloSize;x++){
      const radius=Math.hypot((2*x+1)/haloSize-1,(2*y+1)/haloSize-1);
      const index=(y*haloSize+x)*4;
      haloPixels.set([255,255,255,Math.round(255*Math.pow(Math.max(0,1-radius),2.8))],index);
    }
  }
  const haloTexture=new T.DataTexture(haloPixels,haloSize,haloSize);
  haloTexture.magFilter=T.LinearFilter;
  haloTexture.minFilter=T.LinearFilter;
  haloTexture.needsUpdate=true;
  const haloMaterials = {
    amber: new T.SpriteMaterial({map:haloTexture,color:'#ff8c39',opacity:.48,blending:T.AdditiveBlending,depthWrite:false}),
    violet: new T.SpriteMaterial({map:haloTexture,color:'#b25aff',opacity:.52,blending:T.AdditiveBlending,depthWrite:false}),
    cyan: new T.SpriteMaterial({map:haloTexture,color:'#37cfee',opacity:.43,blending:T.AdditiveBlending,depthWrite:false})
  };
  function halo(parent,x,y,z,size,mat){
    const sprite=new T.Sprite(mat);
    sprite.position.set(x,y,z);
    sprite.scale.setScalar(size);
    parent.add(sprite);
  }

  function lamp(parent,x,y,z,lightMaterial=amber) {
    rod(parent,gold,[x,y,z],[x,y+.77,z],.07,.036);
    orb(parent,lightMaterial,x,y+.82,z,.15,.23,.15,1);
    const haloMat=lightMaterial===amber?haloMaterials.amber:lightMaterial===cyan?haloMaterials.cyan:haloMaterials.violet;
    halo(parent,x,y+.84,z+.19,1.48,haloMat);
    const frame=mesh(parent,new T.TorusGeometry(.155,.023,6,10),gold,x,y+.8,z);
    frame.rotation.x=Math.PI/2;
    orb(parent,gold,x,y+1.06,z,.11,.065,.11,0);
  }

  const home = buildOpalCottage();
  home.position.set(cottage.x,.13,cottage.z);
  home.visible=places.homeVisible;
  scene.add(home);

  function gardenOutline(width,depth,curve){
    const w=width*.5,d=depth*.5;
    const shape=new T.Shape();
    shape.moveTo(-w+curve,-d);
    shape.lineTo(w-curve,-d);
    shape.quadraticCurveTo(w,-d,w,-d+curve);
    shape.lineTo(w,d-curve);
    shape.quadraticCurveTo(w,d,w-curve,d);
    shape.lineTo(-w+curve,d);
    shape.quadraticCurveTo(-w,d,-w,d-curve);
    shape.lineTo(-w,-d+curve);
    shape.quadraticCurveTo(-w,-d,-w+curve,-d);
    shape.closePath();
    return shape;
  }
  const bedOuter=gardenOutline(2.88,1.82,.25);
  const bedInner=gardenOutline(2.54,1.48,.20);
  bedOuter.holes.push(new T.Path(bedInner.getPoints(8).reverse()));
  const planterGeometry=new T.ExtrudeGeometry(bedOuter,{
    depth:.23,bevelEnabled:true,bevelThickness:.035,bevelSize:.036,bevelSegments:2,curveSegments:9
  });
  const compostGeometry=new T.ShapeGeometry(bedInner);
  const planterStone=lightRipples(materials.nacre('#b591b7'),.18);
  const compost=lightRipples(soil,.045);
  // [sunpetal-sand] soft pink sand plots with raised rows, in place of the hard stone planters
  const sandMound=new T.ExtrudeGeometry(gardenOutline(3.0,2.0,.7),{
    depth:.07,bevelEnabled:true,bevelThickness:.085,bevelSize:.15,bevelSegments:6,curveSegments:14
  });
  const sandMaterial=new T.MeshStandardMaterial({color:'#e9a9bf',roughness:.97,metalness:0,emissive:'#ff8fb8',emissiveIntensity:.05});
  const furrowMaterial=new T.MeshStandardMaterial({color:'#cf7f9e',roughness:.98});
  const furrowGeometry=new T.CapsuleGeometry(.05,2.1,4,8);
  function bed(x,z,parent=scene) {
    const bed=new T.Group();
    bed.position.set(x,0,z);
    parent.add(bed);
    const mound=mesh(bed,sandMound,sandMaterial,0,.07,0);
    mound.rotation.x=-Math.PI/2;
    mound.receiveShadow=true;
    for(const row of [-.75,-.02,.71]){
      const furrow=mesh(bed,furrowGeometry,furrowMaterial,0,.236,row);
      furrow.rotation.z=Math.PI/2;
      furrow.receiveShadow=true;
    }
    for(let i=0;i<9;i++){
      orb(bed,tileMats[i%5],(random()-.5)*2.5,.236,(random()-.5)*1.5,.03,.016,.02,0);
    }
    return bed;
  }
  const beds=[bed(farm.x,farm.z),bed(secondBed.x,secondBed.z)];
  for(const spot of beds)spot.position.y=places.floorAt(spot.position.x,spot.position.z);
  const stationFrom=scene.children.length;
  box(scene,wood,station.x,.43,station.z,1.32,.78,.76);
  box(scene,materials.nacre('#d7a3cf'),station.x,.88,station.z,1.52,.13,.91);
  rod(scene,gold,[station.x-.64,.12,station.z+.4],[station.x+.64,.12,station.z+.4],.025);
  for(const offset of [-.36,0,.36]){
    const drawer=box(scene,materials.decking('#955f7e'),station.x+offset,.48,station.z+.386,.31,.25,.036);
    drawer.receiveShadow=true;
    orb(scene,gold,station.x+offset,.48,station.z+.425,.037,.033,.022,1);
  }
  orb(scene,cyan,station.x-.32,.99,station.z,.12,.11,.12,1);
  for(const part of scene.children.slice(stationFrom)){
    part.position.y+=places.floorAt(station.x,station.z);
    part.visible=places.homeVisible;
  }
  const {region:homeStations,wardrobe,kitchen}=buildHomeStations(scene,places,materials);
  for(const [x,z] of [[9,-.1],[15.8,-.6]]) lamp(scene,x,.05,z,cyan);

  // Pearl-pink flower beds and shell lanterns echo the illustrated homebase.
  const oldDetails=scene.children.length;
  const sunpetalDetails = new T.Group();
  sunpetalDetails.name = 'Sunpetal flower gardens and shells';
  scene.add(sunpetalDetails);
  const petalMats = ['#ec97d5','#edb0ff','#ffb4a9','#a57bdf'].map(c=>new T.MeshPhysicalMaterial({
    color:c,emissive:c,emissiveIntensity:.23,metalness:.08,roughness:.36,clearcoat:.65
  }));
  const pearl = new T.MeshPhysicalMaterial({color:'#fff0d1',emissive:'#ffb56f',emissiveIntensity:.38,roughness:.17,metalness:.12,clearcoat:1});
  // Petals, centers, and stems are batched per region and material. The lush
  // flower beds stay affordable on low-power WebGL devices.
  const blossomInstances=new Map();
  const petalGeometry=new T.IcosahedronGeometry(1,1);
  const stemGeometry=new T.CylinderGeometry(1,1,1,6);
  const flowerDummy=new T.Object3D();
  function addBlossomInstance(parent,part,hue,mat,geometry,x,y,z,sx,sy,sz,ry=0,rz=0){
    const key=parent.name+':'+part+':'+hue;
    if(!blossomInstances.has(key)) blossomInstances.set(key,{parent,mat,geometry,matrices:[]});
    flowerDummy.position.set(x,y,z);
    flowerDummy.rotation.set(0,ry,rz);
    flowerDummy.scale.set(sx,sy,sz);
    flowerDummy.updateMatrix();
    blossomInstances.get(key).matrices.push(flowerDummy.matrix.clone());
  }
  function blossom(parent,x,z,size,hue,stemHeight=.34){
    addBlossomInstance(parent,'stem',0,teal,stemGeometry,x,.06+stemHeight/2,z,.033,.04+stemHeight,.033);
    const flowerY=.12+stemHeight;
    for(let a=0;a<6;a++){
      const angle=a*tau/6;
      addBlossomInstance(parent,'petal',hue%petalMats.length,petalMats[hue%petalMats.length],
        petalGeometry,x+Math.cos(angle)*size*.57,flowerY,z+Math.sin(angle)*size*.57,
        size*.56,size*.18,size*.33,-angle,Math.cos(angle)*.25);
    }
    addBlossomInstance(parent,'pearl',0,pearl,petalGeometry,x,flowerY+.045,z,size*.21,size*.17,size*.21);
  }
  for(const [x,z,n,hue] of [
    [-17.95,-.95,3,0],[-10.6,7.7,3,2],[-7.4,4.8,3,3]
  ]){
    for(let i=0;i<n;i++){
      const angle=i*2.39996, radius=.16+.14*Math.sqrt(i);
      blossom(sunpetalDetails,x+Math.cos(angle)*radius,z+Math.sin(angle)*radius,
        .20+(i%3)*.035,hue+i,.20+(i%2)*.1);
    }
  }
  function shellLantern(parent,x,z,height=1){
    const shell = new T.Group();parent.add(shell);shell.position.set(x,.04,z);shell.scale.setScalar(height);
    rod(shell,gold,[0,0,0],[0,.56,0],.085,.058);
    orb(shell,gold,0,.12,0,.18,.075,.18,1);
    for(let i=0;i<7;i++){
      const a=i*tau/7;
      const p=orb(shell,petalMats[(i+1)%4],Math.cos(a)*.22,.69,Math.sin(a)*.22,.24,.10,.32,1);
      p.rotation.y=a;
      p.rotation.z=Math.sin(a)*.18;
    }
    orb(shell,pearl,0,.73,0,.21,.23,.21,2);
    halo(shell,0,.73,.08,1.8,haloMaterials.amber);
    orb(shell,gold,0,.99,0,.09,.035,.09,0);
  }
  shellLantern(sunpetalDetails,-7.95,3.4,1);

  // The front-view concept wraps the farm in a curved, lantern-lit waterfront.
  const terrace=new T.Group();
  scene.add(terrace);
  terrace.position.set(-8.8,0,6.15);
  terrace.rotation.y=-.37;
  const decking=['#945f6a','#b78383','#87565f','#aa7777'].map(materials.decking);
  const timber=materials.decking('#493252');
  const outline=new T.Shape();
  outline.absellipse(0,0,3.35,1.72,0,tau);
  const deckBase=mesh(terrace,new T.ExtrudeGeometry(outline,{depth:.19,bevelEnabled:true,bevelThickness:.055,bevelSize:.06,bevelSegments:2,curveSegments:24}),timber,0,-.26,0);
  deckBase.rotation.x=-Math.PI/2;
  for(let row=-7;row<=7;row++){
    const z=row*.216;
    const span=3.27*Math.sqrt(1-Math.pow((Math.abs(z)+.105)/1.68,2));
    const join=Math.sin(row*2.8)*.42;
    box(terrace,decking[(row+8)%4],(join-span)*.5,-.026,z,span+join-.025,.08,.198);
    box(terrace,decking[(row+9)%4],(join+span)*.5,-.026,z,span-join-.025,.08,.198);
  }
  for(const [x,z] of [[-2.38,0],[2.38,0],[-1.4,1.08],[1.4,1.08]]){
    rod(terrace,timber,[x,-2.75,z],[x,-.16,z],.15,.19);
    mesh(terrace,new T.CylinderGeometry(.21,.21,.08,10),gold,x,-.36,z);
  }
  const railArc=[];
  for(let i=0;i<=12;i++){
    const angle=.13+i*.189;
    const x=Math.cos(angle)*3.17,z=Math.sin(angle)*1.57;
    railArc.push([x,.58,z]);
    if(i%2===0){
      rod(terrace,gold,[x,.01,z],[x,.6,z],.033,.046);
      orb(terrace,gold,x,.62,z,.075,.056,.075,1);
    }
  }
  tube(terrace,gold,railArc,.045,34);
  lamp(terrace,2.97,0,.29,amber);
  lamp(terrace,-2.05,0,1.12,amber);

  const terracePool=new T.Group();
  terracePool.position.set(-7.4,-.02,1.5);
  scene.add(terracePool);
  const poolStone=materials.nacre('#9787b1');
  poolStone.roughness=.52;
  const poolWater=material('#36bed3',{emissive:'#1a657d',emissiveIntensity:.8,roughness:.32,metalness:.17});
  mesh(terracePool,new T.CylinderGeometry(1.19,1.27,.27,18),poolStone,0,.10,0);
  const waterSurface=mesh(terracePool,new T.CircleGeometry(1.08,36),poolWater,0,.243,0);
  waterSurface.rotation.x=-Math.PI/2;
  for(let i=0;i<18;i++){
    const angle=i*tau/18;
    const coping=box(terracePool,tileMats[i%5],Math.cos(angle)*1.15,.264,Math.sin(angle)*1.15,.16,.125,.36);
    coping.rotation.y=-angle;
  }
  const poolRipples=Array.from({length:3},()=>{
    const ripple=mesh(terracePool,new T.TorusGeometry(1,.013,6,40),cyan,0,.252,0);
    ripple.rotation.x=Math.PI/2;
    return ripple;
  });
  halo(terracePool,0,.36,.16,2.9,haloMaterials.cyan);

  const crafted=new T.Group();
  crafted.position.set(-10.75,0,3.10);scene.add(crafted);
  lamp(crafted,0,0,0,pink);
  dropOldTown(oldDetails);

  const floraMats=['#ac3e91','#df5fb8','#9246b7','#469ce3','#40bda8','#cb775f'].map(c=>material(c,{flatShading:true}));
  const coralMaterial=materials.coral;
  const coralPalettes=[
    ['#6b275f','#eb73b7'],['#8d305f','#ffa196'],['#553098','#c990ee'],
    ['#214b8b','#4cd1e3'],['#1f6567','#71ddab'],['#8e404d','#f1ae85']
  ];
  function coral(x,y,z,scale,index,visible) {
    const stalkTop=1.05+random()*.45;
    const ends=Array.from({length:5},(_,branch)=>{
      const angle=branch/5*tau+.4+index*.39;
      return [Math.cos(angle)*(.41+random()*.42),.68+branch*.109+random()*.49,Math.sin(angle)*(.37+random()*.36)];
    });
    if(!visible)return;
    const vertices=[],colors=[],indices=[],uvs=[];
    const palette=coralPalettes[index%coralPalettes.length];
    const base=new T.Color(palette[0]),tip=new T.Color(palette[1]),color=new T.Color();
    function limb(points,baseWidth,tipWidth,offset){
      const curve=new T.CatmullRomCurve3(points.map(point=>new T.Vector3(...point)));
      const sides=8, rings=10;
      const frames=curve.computeFrenetFrames(rings,false);
      const start=vertices.length/3;
      for(let step=0;step<=rings;step++){
        const t=step/rings;
        const center=curve.getPointAt(t);
        const width=(baseWidth+(tipWidth-baseWidth)*t)*Math.sqrt(Math.max(.005,1-t**10));
        for(let side=0;side<=sides;side++){
          const angle=side/sides*tau;
          const point=center.clone().addScaledVector(frames.normals[step],Math.cos(angle)*width)
            .addScaledVector(frames.binormals[step],Math.sin(angle)*width);
          vertices.push(point.x,point.y,point.z);
          uvs.push(side/sides,t*2);
          color.copy(base).lerp(tip,Math.min(1,offset+t*.68));
          color.multiplyScalar(.91+Math.cos(angle*2+offset)*.09);
          colors.push(color.r,color.g,color.b);
          if(step<rings&&side<sides){
            const i=start+step*(sides+1)+side;
            indices.push(i,i+1,i+sides+1,i+1,i+sides+2,i+sides+1);
          }
        }
      }
    }

    limb([[0,-.06,0],[.05,.40,.02],[-.07,.77,0],[-.14,stalkTop,.08]],.126,.032,0);
    for(let branch=0;branch<5;branch++){
      const y0=.20+branch*.109;
      const end=ends[branch];
      const middle=[end[0]*.66,end[1]-.24,end[2]*.64];
      limb([[0,y0,0],[middle[0]*.56,y0+.15,middle[2]*.48],middle,end],.081,.024,.16);
      limb([middle,[middle[0]+.035,middle[1]+.12,middle[2]-.09],
        [end[0]+.12,end[1]-.04,end[2]-.21]],.043,.016,.32);
    }
    const geometry=new T.BufferGeometry();
    geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
    geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
    geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const colony=mesh(scene,geometry,coralMaterial,x,y,z);
    colony.scale.setScalar(scale);
    return colony;
  }
  const homeCoral=[7,13,25,31,37];
  for(let i=0;i<42;i++){
    const a=i*.77;
    const right=i%2===0;
    const x=(right?13:-12)+Math.cos(a)*(right?6.4:7.3);
    const z=(right?-2:1)+Math.sin(a)*(right?5.1:6.3);
    const scale=.55+random()*.9;
    const object=coral(x,.06,z,scale,i,right||homeCoral.includes(i));
    if(object&&i%6<2){
      const size=scale*3.15;
      artFallbacks.coral[right?'reef':'home'].push({object,position:[x,.019,z],yaw:a,scale:[size,size,size]});
    }
  }

  // The Moonlace shelf has its own illuminated shell-stone path and distinct
  // blue-lilac blooms; this keeps the two destinations readable at a glance.
  const moonlaceDetails = new T.Group();
  moonlaceDetails.name = 'Moonlace pearl path and reef gardens';
  scene.add(moonlaceDetails);
  const opalTiles = ['#b0a1d3','#8bc6d1','#a98cb5','#a4d9ce'].map(color=>
    lightRipples(materials.nacre(color),.66));
  const shellPath=new T.CatmullRomCurve3([
    new T.Vector3(8.35,.075,1.05),new T.Vector3(10.4,.075,.15),
    new T.Vector3(12.55,.075,-1.65),new T.Vector3(14.5,.075,-3.3),
    new T.Vector3(16.25,.075,-4.92)
  ]);
  for(let i=0;i<29;i++){
    const point=shellPath.getPoint(i/28);
    const tangent=shellPath.getTangent(i/28);
    const across=new T.Vector3(-tangent.z,0,tangent.x);
    for(const side of [-1,0,1]){
      const offset=across.clone().multiplyScalar(side*.47);
      const tile=mesh(moonlaceDetails,new T.CylinderGeometry(.27,.296,.061,8),
        opalTiles[(i+side+32)%4],point.x+offset.x,.06+(.008*(i%3)),point.z+offset.z);
      tile.rotation.y=(i*.23+side*.17);
      tile.receiveShadow=true;
    }
    if(i%4===0){
      orb(moonlaceDetails,cyan,point.x+.78*across.x,.17,point.z+.78*across.z,.06,.11,.06,0);
    }
  }
  const reefBlooms=[
    [8.4,2.35,5,1],[10.05,3.1,4,2],[12.2,2.3,5,3],
    [15.3,2.2,4,0],[18.4,-.7,5,1],[18.8,-3.0,5,0],
    [16.6,-6.1,4,3],[12.1,-5.9,4,2],[8.1,-4.55,4,1]
  ];
  for(const [x,z,quantity,hue] of reefBlooms){
    for(let i=0;i<quantity;i++){
      const angle=i*2.39996, radius=.17+.22*Math.sqrt(i);
      blossom(moonlaceDetails,x+Math.cos(angle)*radius,z+Math.sin(angle)*radius,
        .24+(i%3)*.055,hue+i,.25+(i%3)*.12);
    }
  }
  shellLantern(moonlaceDetails,9.3,2.65,1.04);
  shellLantern(moonlaceDetails,17.65,-.65,.95);
  shellLantern(moonlaceDetails,15.35,-5.55,.83);
  const tidePearls=new T.Group();tidePearls.name='Moonlace opal clusters';scene.add(tidePearls);
  for(const [x,z] of [[11,-5.9],[18.8,-4.5],[17.9,2.35],[8.6,-2.9]]){
    const cluster=new T.Group();
    tidePearls.add(cluster);
    for(let i=0;i<5;i++){
      const a=i*tau/5;
      const crystal=orb(cluster,i%2?cyan:petalMats[i%4],
        x+Math.cos(a)*.23,.24+i*.13,z+Math.sin(a)*.23,
        .13,.32+i*.055,.11,0);
      crystal.rotation.z=.2*Math.sin(a);
    }
    artFallbacks.geodes.push({object:cluster,position:[x,.02,z],yaw:x*.47,scale:[1.38,1.72,1.43]});
  }

  for(const entry of blossomInstances.values()){
    const batch=new T.InstancedMesh(entry.geometry,entry.mat,entry.matrices.length);
    for(let i=0;i<entry.matrices.length;i++) batch.setMatrixAt(i,entry.matrices[i]);
    batch.instanceMatrix.needsUpdate=true;
    batch.computeBoundingSphere();
    entry.parent.add(batch);
  }

  const fanBranchGeometry=new T.CylinderGeometry(.63,1,1,6);
  const fanBranchMaterial=material('#ffffff',{roughness:.84});
  const fanAxis=new T.Vector3(0,1,0);
  const fanPart=new T.Object3D();
  function seaFan(x,y,z,scale,heading,baseColor,tipColor){
    const group=new T.Group();
    scene.add(group);
    group.position.set(x,y,z);
    group.rotation.y=heading;
    group.scale.setScalar(scale);
    const branches=[];
    const trunk=new T.Vector3(0,.44,0);
    branches.push({start:new T.Vector3(0,0,0),end:trunk,width:.086,tint:0});
    for(let i=-4;i<=4;i++){
      const reach=i/4;
      const middle=new T.Vector3(reach*.54,1.05-Math.abs(reach)*.22,Math.sin(i)*.12);
      const end=new T.Vector3(reach*1.03,1.84-Math.abs(reach)*.52,Math.sin(i*.8)*.19);
      branches.push({start:trunk,end:middle,width:.045,tint:.33});
      branches.push({start:middle,end,width:.026,tint:.68});
      for(const side of [-1,1]){
        const fork=middle.clone().lerp(end,.46);
        const tip=end.clone().add(new T.Vector3(side*.13,-.20,side*.06));
        branches.push({start:fork,end:tip,width:.014,tint:1});
      }
    }
    const fan=new T.InstancedMesh(fanBranchGeometry,fanBranchMaterial,branches.length);
    const base=new T.Color(baseColor), tip=new T.Color(tipColor);
    const delta=new T.Vector3();
    for(let i=0;i<branches.length;i++){
      const {start,end,width,tint}=branches[i];
      delta.subVectors(end,start);
      fanPart.position.copy(start).lerp(end,.5);
      fanPart.scale.set(width,delta.length()+.009,width);
      fanPart.quaternion.setFromUnitVectors(fanAxis,delta.normalize());
      fanPart.updateMatrix();
      fan.setMatrixAt(i,fanPart.matrix);
      fan.setColorAt(i,base.clone().lerp(tip,tint));
    }
    fan.computeBoundingSphere();
    group.add(fan);
  }
  seaFan(15.1,.04,-5.75,1.28,.32,'#6e2882','#e895ff');
  seaFan(18.35,.02,-4.5,1.33,-.44,'#a72c80','#ff91ce');
  seaFan(11.1,.04,2.05,.85,-.18,'#3568a4','#67e5ec');

  const anemoneBase=material('#80537e',{roughness:.89});
  const anemoneTips=[pink,cyan,glow('#ffae81')];
  for(const [x,z,color] of [[10.72,-3.62,1],[16.25,-3.3,0],[17.08,1.48,2]]){
    const colony=new T.Group();
    scene.add(colony);
    orb(colony,anemoneBase,x,.105,z,.40,.16,.34,1);
    for(let i=0;i<8;i++){
      const angle=i/8*tau;
      const dx=Math.cos(angle),dz=Math.sin(angle);
      const height=.35+.065*Math.sin(i*2.1);
      tube(colony,anemoneBase,[[x+dx*.11,.16,z+dz*.11],[x+dx*.22,height*.82,z+dz*.22],[x+dx*.33,height,z+dz*.33]],.031,7);
      orb(colony,anemoneTips[color],x+dx*.33,height,z+dz*.33,.046,.061,.046,0);
    }
    artFallbacks.glowlogs.push({object:colony,position:[x,.021,z],yaw:.43*x,scale:[2.28,2.52,2.13]});
  }

  const backdropRocks=[];
  for(let i=0;i<27;i++){
    const x=(random()-.5)*75;
    const base=-2.05+random();
    const z=-11-random()*39;
    const width=1.5+random()*4;
    const height=1+random()*6;
    const depth=1+random()*4;
    const channelOpening=T.MathUtils.smoothstep(Math.abs(x),4,20);
    const rock=stone(i,x,base,-7*(1-channelOpening)+z,width,height*(.53+.47*channelOpening),depth);
    rock.rotation.y=random()*tau;
    if(rock.position.x>7&&rock.position.x<26) backdropRocks.push(rock);
  }
  for(const rock of backdropRocks.sort((a,b)=>b.position.z-a.position.z).slice(0,3)){
    artFallbacks.rocks.push({object:rock,position:[rock.position.x,rock.position.y-.55,rock.position.z],
      yaw:rock.rotation.y,scale:[rock.scale.x*.58,rock.scale.y*.80,rock.scale.z*.58]});
  }
  const backdrop=seeded();
  const farRock=material('#22486a',{vertexColors:true});
  const distantArch=material('#275683',{roughness:1});
  for(let i=0;i<19;i++){
    const x=-58+i*6.5+(backdrop()-.5)*4;
    const z=-25-backdrop()*16;
    const height=5+backdrop()*13;
    const pillar=mesh(scene,stoneGeometry[i%stoneGeometry.length],farRock,x,height*.34-3,z);
    const separation=T.MathUtils.smoothstep(Math.abs(x),6,19);
    pillar.scale.set(2+backdrop()*3,height*(.29+.34*separation),2.8+backdrop()*3);
    pillar.position.y-=2.8*(1-separation);
    pillar.rotation.z=(backdrop()-.5)*.36;
  }
  for(const [x,z,span,height] of [[-19,-24,8,8],[.5,-29,11,12],[18,-22,6,7]]){
    const points=[[x-span*.6,-2,z],[x-span*.48,height*.6,z],[x,height,z],[x+span*.48,height*.61,z],[x+span*.62,-2,z]];
    const arch=tube(scene,distantArch,points,span*.105,24);
    if(x===18) artFallbacks.caves.push({object:arch});
    if(x===.5) artFallbacks.arches.push({object:arch});
  }

  const kelpMaterials=['#116e75','#168c88','#369f86'].map(color=>material(color,{side:T.DoubleSide,vertexColors:true,roughness:.75}));
  const wavingKelp=[];
  const kelpRandom=seeded();
  function kelpBlade(height,bend,phase){
    const bounds=[],colors=[],indices=[];
    const segments=15;
    const tint=new T.Color();
    for(let i=0;i<=segments;i++){
      const p=i/segments;
      const width=(.036+.22*Math.pow(Math.sin(Math.PI*p),.8))*(1-p*.31);
      const center=bend*p*p+Math.sin(p*5+phase)*.18*p;
      for(let side=-1;side<=1;side++){
        bounds.push(center+side*width,p*height,Math.sin(p*4+phase)*.22*p+.085*(1-Math.abs(side))*Math.sin(p*Math.PI));
        tint.setScalar(.54+p*.29+(side===0?.17:0));
        colors.push(tint.r,tint.g,tint.b);
      }
      if(i<segments){
        for(let edge=0;edge<2;edge++){
          const j=i*3+edge;
          indices.push(j,j+3,j+1,j+1,j+3,j+4);
        }
      }
    }
    const geometry=new T.BufferGeometry();
    geometry.setAttribute('position',new T.Float32BufferAttribute(bounds,3));
    geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }
  for(const [x,z] of [[-19,-2],[-7,-3],[6,-4],[17,1],[19,-4],[-19,4.65],[-6.96,7.52],[9,-6.2]]) {
    const keep=x>0;
    const cluster=new T.Group();
    cluster.position.set(x,-.06,z);
    if(keep)scene.add(cluster);
    for(let i=0;i<6;i++){
      const phase=kelpRandom()*tau;
      const height=1.8+kelpRandom()*2.25;
      const spread=(kelpRandom()-.5)*.45;
      if(!keep)continue;
      const blade=mesh(cluster,kelpBlade(height,(i-2.5)*.37,phase),kelpMaterials[i%3],(i-2.5)*.19,0,spread);
      blade.rotation.y=phase*.43;
      wavingKelp.push({blade,phase});
    }
    if(keep&&x!==6) artFallbacks.kelp[x<0?'home':'reef'].push({object:cluster,position:[x,-.048,z],
      yaw:x*.28,scale:[2.6,2.43,2.57]});
  }

  const {creature:luma,animate:animateLuma,emote:emoteLuma}=buildLuma();
  const tendRing=mesh(scene,new T.TorusGeometry(.66,.018,8,40),cyan);
  tendRing.rotation.x=-Math.PI/2;
  tendRing.visible=false;
  scene.add(luma);
  halo(luma,0,.10,.28,2.8,haloMaterials.violet);

  const character=new T.Group();
  const body=new T.Group();
  scene.add(character);character.add(body);
  const review=places.characterReview;
  if(review){
    character.visible=false;
    scene.add(review.actor);
  }
  const skin=material('#a76566',{roughness:.76});
  const hair=material('#432757',{roughness:.63});
  const hairLight=material('#a4488e',{roughness:.54});
  const tailMat=material('#6171d8',{metalness:.34,roughness:.39});
  const finMat=material('#9a76dc',{metalness:.2,roughness:.44,side:T.DoubleSide});
  orb(body,skin,0,.41,0,.235,.35,.16,2);
  orb(body,skin,0,.9,.019,.207,.247,.184,2);
  orb(body,hair,0,1.015,-.035,.236,.216,.191,2);
  for(const sign of [-1,1]){
    tube(body,sign===1?hairLight:hair,[[sign*.18,1.04,-.035],[sign*.21,.85,-.08],[sign*.23,.59,-.2],[sign*.13,.41,-.37]],.082);
    rod(body,skin,[sign*.16,.56,0],[sign*.31,.38,-.047],.061,.042);
    rod(body,skin,[sign*.31,.38,-.047],[sign*.36,.24,-.12],.042,.032);
    orb(body,gold,sign*.19,.83,.045,.041,.073,.026,0);
    orb(body,wood,sign*.075,.925,.178,.033,.017,.017,1);
  }
  orb(body,violet,0,.45,.106,.201,.09,.085,2);
  orb(body,gold,0,.63,.12,.045,.05,.031,0);
  const tail=new T.Group();body.add(tail);
  tube(tail,tailMat,[[0,.2,0],[0,-.11,-.14],[0,-.3,-.52],[0,-.25,-.98]],.14);
  for(const sign of [-1,1]){
    const fin=orb(tail,finMat,sign*.15,-.25,-1.05,.261,.054,.296,1);
    fin.rotation.y=-sign*.55;
  }
  for(let i=0;i<6;i++) orb(tail,cyan,(i%2-.5)*.13,-.03-i*.028,-.15-i*.095,.024,.021,.034,0);

  const marker=new T.Group();scene.add(marker);
  const star=mesh(marker,new T.OctahedronGeometry(.23),amber,0,1.05,0);
  const ring=mesh(marker,new T.TorusGeometry(.53,.028,8,32),amber,0,.08,0);
  ring.rotation.x=Math.PI/2;
  const seed=mesh(scene,new T.OctahedronGeometry(.19),amber,shelf.x,.42,shelf.z);
  const pearlPickup=buildMoonlacePearl();
  pearlPickup.shell.position.set(moonlacePearl.x,.035,moonlacePearl.z);
  pearlPickup.shell.visible=false;
  halo(pearlPickup.shell,0,.28,.067,.97,haloMaterials.cyan);
  scene.add(pearlPickup.shell);
  const pearlHit=new T.Sphere(new T.Vector3(moonlacePearl.x,.24,moonlacePearl.z),.39);
  const flowers=new T.Group();scene.add(flowers);
  flowers.position.y=places.floorAt(farm.x,farm.z);
  const bloomPetals=new T.InstancedMesh(petalGeometry,petalMats[0],42);
  const bloomPearls=new T.InstancedMesh(petalGeometry,pearl,7);
  const blooms=[bloomPetals,bloomPearls];
  flowers.add(...blooms);
  for(let i=0;i<7;i++){
    const x=farm.x-.95+(i%4)*.58,z=farm.z-.27+Math.floor(i/4)*.54;
    const top=.63+.067*(i%3);
    rod(flowers,teal,[x,.27,z],[x,top,z],.025,.016);
    for(let n=0;n<6;n++){
      const angle=(n/6+i*.11)*tau;
      flowerDummy.position.set(x+Math.cos(angle)*.133,top,z+Math.sin(angle)*.133);
      flowerDummy.rotation.set(0,-angle,Math.cos(angle)*.28);
      flowerDummy.scale.set(.134,.049,.085);
      flowerDummy.updateMatrix();
      bloomPetals.setMatrixAt(i*6+n,flowerDummy.matrix);
    }
    flowerDummy.position.set(x,top+.048,z);
    flowerDummy.rotation.set(0,0,0);
    flowerDummy.scale.set(.061,.049,.061);
    flowerDummy.updateMatrix();
    bloomPearls.setMatrixAt(i,flowerDummy.matrix);
    for(let a=0;a<4;a++) orb(flowers,floraMats[4],x+.1*Math.cos(a*tau/4),.49,z+.1*Math.sin(a*tau/4),.072,.028,.072,0);
  }
  for(const batch of blooms) batch.computeBoundingSphere();
  const glassMat=material('#5acfcf',{emissive:'#248496',emissiveIntensity:.65,metalness:.36,roughness:.2});
  const glassfin=buildGlassfin(scene,grotto,materials);
  const grottoSeed=orb(scene,cyan,grotto.x,.59,grotto.z,.16,.23,.16,0);
  const tideglass=new T.Group();
  scene.add(tideglass);tideglass.position.set(glass.x,.06,glass.z);
  for(let i=0;i<4;i++){
    const shard=orb(tideglass,i===1?cyan:glassMat,i*.22-.3,.38-i*.03,(i%2)*.23,.145,.42-i*.06,.14,0);
    shard.rotation.z=(i-1.5)*.22;
  }

  const kelp=new T.Group();
  scene.add(kelp);kelp.position.set(secondBed.x,.27+places.floorAt(secondBed.x,secondBed.z),secondBed.z);
  const tips=[];
  for(let i=0;i<8;i++){
    const x=-.94+(i%4)*.59,z=-.36+Math.floor(i/4)*.66;
    const bend=i%2?.17:-.17;
    tube(kelp,teal,[[x,0,z],[x+bend,.25,z],[x-bend,.48,z+.05],[x+bend,.73,z+.11]],.045,12);
    orb(kelp,floraMats[4],x+bend,.27,z,.16,.08,.036,1).rotation.z=.5;
    tips.push(orb(kelp,cyan,x+bend,.76,z+.11,.084,.12,.078,0));
  }

  const fountain=new T.Group();
  fountain.name='Movable Tideglass Fountain';
  scene.add(fountain);
  const fountainGlass=new T.MeshPhysicalMaterial({
    color:'#65d9ef', emissive:'#145269',emissiveIntensity:.58,
    roughness:.17, metalness:.15,clearcoat:1,clearcoatRoughness:.13,
    transparent:true,opacity:.79,depthWrite:false
  });
  mesh(fountain,new T.CylinderGeometry(.56,.75,.16,12),wood,0,.08,0);
  mesh(fountain,new T.CylinderGeometry(.61,.67,.07,12),gold,0,.18,0);
  mesh(fountain,new T.CylinderGeometry(.19,.36,.44,10),fountainGlass,0,.42,0);
  const bowlProfile=[[.25,.62],[.44,.65],[.63,.73],[.75,.85],[.72,.88],[.62,.78],[.42,.7],[.25,.67]]
    .map(([radius,height])=>new T.Vector2(radius,height));
  mesh(fountain,new T.LatheGeometry(bowlProfile,32),fountainGlass);
  mesh(fountain,new T.TorusGeometry(.74,.034,8,36),gold,0,.865,0).rotation.x=Math.PI/2;
  const pool=mesh(fountain,new T.CircleGeometry(.68,32),glassMat,0,.826,0);
  pool.rotation.x=-Math.PI/2;
  for(let i=0;i<6;i++){
    const angle=i*tau/6,x=Math.cos(angle),z=Math.sin(angle);
    tube(fountain,gold,[[x*.44,.2,z*.44],[x*.26,.37,z*.26],[x*.38,.59,z*.38],[x*.61,.76,z*.61]],.024,12);
    orb(fountain,cyan,x*.66,.8,z*.66,.05,.072,.05,0);
  }
  const fountainPrism=mesh(fountain,new T.OctahedronGeometry(.16),fountainGlass,0,1.07,0);
  fountainPrism.scale.y=1.56;
  const droplets=Array.from({length:15},()=>orb(fountain,cyan,0,0,0,.031,.061,.031,0));

  // A luminous core and five gold-rimmed arcing water jets identify the crafted
  // object in both placement locations (not just the waypoint ring).
  const fountainHeart=orb(fountain,cyan,0,.98,0,.115,.17,.115,1);
  halo(fountain,0,1.02,.12,1.48,haloMaterials.cyan);
  for(let i=0;i<5;i++){
    const a=i*tau/5;
    const vector=(radius,height)=>[Math.cos(a)*radius,height,Math.sin(a)*radius];
    tube(fountain,glassMat,[vector(.10,.96),vector(.21,1.29),vector(.46,1.23),vector(.66,.88)],.022,22);
  }

  const ripple=mesh(fountain,new T.TorusGeometry(1,.013,6,32),glow('#52bedb'),0,.839,0);
  ripple.rotation.x=Math.PI/2;
  const pads=displaySpots.map(spot=>{
    const pad=mesh(scene,new T.TorusGeometry(.77,.027,7,28),cyan,spot.x,.075+places.floorAt(spot.x,spot.z),spot.z);
    pad.rotation.x=Math.PI/2;
    return pad;
  });
  const path=new T.CatmullRomCurve3([new T.Vector3(jelly.x,.7,jelly.z),new T.Vector3(3,.58,2.75),new T.Vector3(8,.63,1.25),new T.Vector3(shelf.x-1,.72,shelf.z)]);

  const currentRibbon=new T.Group();
  currentRibbon.name='Luma current guide ribbons';
  scene.add(currentRibbon);
  const currentLines = [
    [[2.6,.2,3.1],[4,.05,2.7],[5.3,-.15,2.3],[6.9,-.37,1.6],[8.8,-.38,.35]],
    [[2.9,.15,3.5],[4.3,-.05,3.2],[5.8,-.3,2.8],[7.3,-.45,2.1],[9,-.4,1]],
    [[2.4,.1,2.7],[3.9,-.1,2.1],[5.3,-.3,1.5],[7.2,-.53,.5],[9.2,-.5,-.1]]
  ];
  const currentMat=new T.ShaderMaterial({
    uniforms:{time:waterTime,travelGlow:{value:0}},
    transparent:true,depthWrite:false,side:T.DoubleSide,
    blending:T.AdditiveBlending,
    vertexShader:`
      varying vec2 vUv;
      void main(){
        vUv=uv;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
      }`,
    fragmentShader:`
      uniform float time;
      uniform float travelGlow;
      varying vec2 vUv;
      void main(){
        float ribbon=pow(max(0.,sin(vUv.y*3.14159)),1.7);
        float shimmer=.5+.5*sin(vUv.x*71.-time*6.4+sin(vUv.x*32.+time*.85)*.8);
        float pulse=.25+.75*pow(.5+.5*sin(vUv.x*24.-time*3.2),3.);
        float fade=smoothstep(0.,.14,vUv.x)*(1.-smoothstep(.81,1.,vUv.x));
        vec3 tint=mix(vec3(.014,.30,.47),vec3(.14,.87,1.17),pulse);
        gl_FragColor=vec4(tint,fade*ribbon*(.065+.34*shimmer+.23*travelGlow));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  currentLines.forEach((line,index)=>{
    const spline=new T.CatmullRomCurve3(line.map(point=>new T.Vector3(...point)));
    const positions=[],uvs=[],indices=[];
    const segmentCount=58;
    for(let i=0;i<=segmentCount;i++){
      const progress=i/segmentCount;
      const point=spline.getPoint(progress);
      const tangent=spline.getTangent(progress);
      const width=(.14+(index%2)*.12)*Math.sin(progress*Math.PI)**.6;
      for(const side of [-1,1]){
        positions.push(point.x+side*tangent.z*width,point.y,point.z-side*tangent.x*width);
        uvs.push(progress,(side+1)/2);
      }
      if(i<segmentCount){
        const j=i*2;
        indices.push(j,j+1,j+2,j+1,j+3,j+2);
      }
    }
    const ribbon=new T.BufferGeometry();
    ribbon.setAttribute('position',new T.Float32BufferAttribute(positions,3));
    ribbon.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));
    ribbon.setIndex(indices);
    mesh(currentRibbon,ribbon,currentMat);
  });

  const motes=Array.from({length:24},()=>mesh(scene,new T.OctahedronGeometry(.055),cyan));
  const reefLife=addReefLife(scene,haloTexture);
  const farmArea=buildFarmIsland(scene,places,materials,bed);
  const plaza=buildPlaza(scene);
  // The world around the town: painted 360 degree backdrop, sunbeams, bubbles and sparkles.
  const seaCenter=new T.Vector3(-34,0,4);
  const underwater=createUnderwaterEnvironment(scene,{center:seaCenter,radius:34,floorY:-4,lights:false,ownFog:false,quality});
  // Sea creatures (needs assets/sea-life/*.glb; the game runs fine without them).
  let seaLife=null,seaRequested=false;
  const startSeaLife=()=>{
    if(seaRequested)return;
    seaRequested=true;
    loadSeaLife(scene,{center:seaCenter,radius:20,floorY:-3,basePath:'./assets/sea-life/',quality}).then(life=>{seaLife=life;}).catch(()=>{});
  };
  const farmBedBoxes=places.fieldPlots.map(({x,z})=>new T.Box3(
    new T.Vector3(x-.9,-.1,z-.9),new T.Vector3(x+.9,.9,z+.9)
  ));
  const farmBedGlow=mesh(farmArea.group,new T.TubeGeometry(new T.CatmullRomCurve3(
    gardenOutline(1.0,1.0,.2).getPoints(16).slice(0,-1).map(point=>new T.Vector3(point.x,0,point.y)),true
  ),64,.017,6,true),new T.MeshBasicMaterial({color:'#a7ffeb',transparent:true,opacity:.82}));
  farmBedGlow.visible=false;
  const crossing=new T.Group();
  crossing.name='Farm Island crossing';
  scene.add(crossing);
  const dock=places.farmDock;
  for(let index=0;index<8;index++){
    box(crossing,wood,dock.x-.23-index*.28,.058,dock.z,.25,.095,1.54);
  }
  for(const side of [-1,1])shellLantern(crossing,dock.x-1.90,dock.z+side*.87,.69);
  const buoys=[];
  const crossingStart=dock.x-2.35,crossingEnd=places.farmIsland.arrival.x+1.38;
  for(const [index,fraction] of [.18,.50,.82].entries()){
    const x=T.MathUtils.lerp(crossingStart,crossingEnd,fraction);
    const z=dock.z+(index%2===0?.48:-.48);
    const holder=new T.Group();
    holder.position.set(x,.44,z);
    crossing.add(holder);
    orb(holder,cyan,0,0,0,.09,.105,.09,1);
    const rim=mesh(holder,new T.TorusGeometry(.116,.012,6,18),gold);
    rim.rotation.x=Math.PI/2;
    halo(holder,0,0,0,.48,haloMaterials.cyan);
    buoys.push(holder);
  }
  const cottageArea=buildCottageRoom(scene,places,materials,kitchen,wardrobe);
  const furniture=createFurniture(cottageArea);
  halo(scene,places.cottageDoor.x,.18,places.cottageDoor.z,.55,haloMaterials.amber);
  const staticArt=typeof document==='undefined'?null:createStaticReefAssets();
  // The old Homebase had its own coral and kelp scatter; the plaza brings its own.
  artFallbacks.coral.home.length=0;
  artFallbacks.kelp.home.length=0;
  const environment=staticArt?loadEnvironmentArt(scene,{home,wardrobe,kitchen,beds,crafted,landing},places,renderer,staticArt.load):null;
  const regionalArt=staticArt?createRegionalArt(scene,staticArt.load,waterTime,artFallbacks,renderer):null;
  let lastArea,lastSpace;
  const avatar=places.playerOutfit&&!review?createAvatar(scene):null;
  const avatarReady=avatar?.equip(places.playerOutfit);
  // [sunpetal-juice] effects and drop-in props
  const juice=createJuice(scene);
  juice.setQuality(quality);
  const props=staticArt?createProps({scene,farmGroup:farmArea.group,cottageGroup:cottageArea,load:staticArt.load,hasModel:hasReefModel}):null;
  const lastPose={x:0,z:0};
  let bedPulse=0,wasCooking=false,wakeClock=0,steamClock=0,effectsReduced=false;

  const pickRay = new T.Raycaster();
  const plane = new T.Plane(new T.Vector3(0,1,0),0);
  for(const structure of [home,terrace]){
    structure.traverse(object=>{
      if(!object.isMesh) return;
      object.receiveShadow=true;
      if(object.geometry.type==='BoxGeometry'||object.geometry.type==='ExtrudeGeometry'||object.material.isMeshPhysicalMaterial){
        object.castShadow=true;
      }
    });
  }
  let viewWidth=0,viewHeight=0;
  let channelFraming=0,floorFollow=0;
  let lumaFollow=0;
  let fitting=false,fittingBlend=0,cookingBlend=0;
  const aim=new T.Vector3(),offset=new T.Vector3();
  const cookingAim=new T.Vector3(),cookingCamera=new T.Vector3();
  const wrapAngle=angle=>T.MathUtils.euclideanModulo(angle+Math.PI,tau)-Math.PI;
  let yaw=0,pitch=0,zoom=1,targetYaw=0,targetPitch=0,targetZoom=1;
  function rotateCamera(horizontal,vertical=0){
    targetYaw=lastSpace==='cottage'?T.MathUtils.clamp(targetYaw+horizontal,-.94,.94):wrapAngle(targetYaw+horizontal);
    targetPitch=T.MathUtils.clamp(targetPitch+vertical,-.46,.55);
  }
  function zoomCamera(factor){
    targetZoom=T.MathUtils.clamp(targetZoom*factor,.24,1.8);
  }
  function resetCamera(){
    targetYaw=targetPitch=0;
    targetZoom=1;
  }
  function setQuality(value){
    if(quality===value) return;
    quality=value;
    effects.value=quality==='low'?.45:1;
    renderer.setQuality?.(quality);
    juice.setQuality(quality);
  }
  function render({ player, quest, step, dt, time, display, current, cooking, reduceMotion, crops=[],style={},lumaWork,farmBed=-1 }) {
    effectsReduced=Boolean(reduceMotion);
    const width=canvas.clientWidth,height=canvas.clientHeight;
    if(width!==viewWidth||height!==viewHeight){
      viewWidth=width;viewHeight=height;
      renderer.resize(width,height);
      const pixelHeight=Math.round(height*Math.min(window.devicePixelRatio||1,2));
      farmArea.setViewHeight?.(pixelHeight);
      plaza.setViewHeight(pixelHeight);
      camera.aspect=width/Math.max(1,height);camera.updateProjectionMatrix();
    }
    const t=reduceMotion?0:time;
    waterTime.value=t;
    const space=player.space??'outdoor';
    const inCottage=space==='cottage';
    if(inCottage!==(lastSpace==='cottage')||lastSpace===undefined&&space==='farm'){
      farmArea.group.visible=!inCottage;
      crossing.visible=!inCottage;
      cottageArea.visible=inCottage;
      focus.set(player.x,.7,player.z-1.8);
      resetCamera();
      yaw=pitch=0;
      zoom=1;
      fitting=false;
      fittingBlend=0;
      cookingBlend=0;
      channelFraming=0;
    }
    lastSpace=space;
    if(!inCottage){
      farmArea.update(crops,reduceMotion);
      farmArea.tick?.(dt,t);
      plaza.tick(t);
      underwater.update(t,camera,{domElement:canvas});
      seaLife?.update(t,dt);
      farmBedBoxes.forEach((box,index)=>{box.max.y=(crops[index]?.s??0)>=2?.95:.5;});
    }
    const featuredBed=places.fieldPlots[farmBed];
    farmBedGlow.visible=Boolean(featuredBed);
    if(featuredBed){
      farmBedGlow.position.set(featuredBed.x-places.farmIsland.x,.1,featuredBed.z-places.farmIsland.z);
      farmBedGlow.rotation.y=featuredBed.yaw??0;
    }
    for(const [index,buoy] of buoys.entries())buoy.position.y=.44+Math.sin(t*1.9+index*.65)*.09;
    const area=player.x<-1?'home':'reef';
    if(!inCottage&&area!==lastArea){
      lastArea=area;
      regionalArt?.ensure(area);
    }
    const depth=T.MathUtils.smoothstep(player.x,0,16);
    const fi=places.farmIsland;
    const farmFraming=inCottage?0:1-T.MathUtils.smoothstep(player.x,fi.x+9,fi.x+21);
    scene.fog.color.copy(nearWater).lerp(deepWater,depth*.82);
    scene.fog.far=42-depth*6+farmFraming*30;
    scene.background.copy(scene.fog.color);
    shafts.visible=quality!=='low';
    environment?.animate(t);
    for(let i=0;i<poolRipples.length;i++){
      const size=.17+((t*.24+i/3)%1)*.83;
      poolRipples[i].scale.set(size,size,1);
    }
    const smoothing=1-Math.exp(-dt*(reduceMotion?16:5));
    const lookAhead=current?2.6:player.vx*.31;
    const homeFraming=T.MathUtils.smoothstep(-player.x,6,11);
    const middle=1-T.MathUtils.smoothstep(Math.abs(player.x-1.5),2.5,11);
    const targetFraming=reduceMotion?0:Math.max(middle,current?.88:0);
    channelFraming+=(targetFraming-channelFraming)*smoothing*.65;
    focus.x+=(player.x+lookAhead-homeFraming*.9-focus.x)*smoothing;
    focus.z+=(player.z-1.8-homeFraming*1.65+player.vz*.18-channelFraming*1.65-focus.z)*smoothing;
    // Swimmer and camera ride the plaza's floors, bridges and stairs.
    const floorNow=space==='outdoor'?places.floorAt(player.x,player.z):0;
    floorFollow+=(floorNow-floorFollow)*(1-Math.exp(-dt*(reduceMotion?16:6)));
    const tight=camera.aspect<.9?1.27:1;
    camera.position.set(focus.x,(8.5-3.15*channelFraming)*tight+floorFollow,focus.z+(12.9-1.3*channelFraming)*tight);
    aim.set(focus.x,.55+homeFraming*.36+channelFraming*.21+floorFollow,focus.z);
    if(farmFraming>0){
      const position=places.farmIsland;
      const farmX=T.MathUtils.lerp(position.x-5.6,focus.x,camera.aspect<.9?.4:.55);
      const farmZ=T.MathUtils.lerp(position.z,focus.z,.75);
      camera.position.set(
        T.MathUtils.lerp(camera.position.x,farmX,farmFraming),
        T.MathUtils.lerp(camera.position.y,15.5*tight,farmFraming),
        T.MathUtils.lerp(camera.position.z,farmZ+19.5*tight,farmFraming)
      );
      aim.set(T.MathUtils.lerp(aim.x,farmX,farmFraming),T.MathUtils.lerp(aim.y,.44,farmFraming),
        T.MathUtils.lerp(aim.z,farmZ,farmFraming));
    }
    if(inCottage){
      const position=places.cottageRoom;
      const x=T.MathUtils.lerp(position.x,player.x,.28);
      camera.position.set(x,4.4*tight,position.z+6.8*tight);
      aim.set(x,.85,position.z-.58);
    }
    const tending=!current&&lumaWork;
    animateLuma(t,current||Boolean(tending),{
      dist:Math.hypot(luma.position.x-player.x,luma.position.z-player.z),
      speed:Math.hypot(player.vx,player.vz)
    });
    const following=current&&!reduceMotion?.76:0;
    lumaFollow=reduceMotion?0:T.MathUtils.lerp(lumaFollow,following,smoothing*.60);
    currentMat.uniforms.travelGlow.value=reduceMotion?0:lumaFollow;
    const lumaX=T.MathUtils.lerp(jelly.x,player.x+.83,lumaFollow),lumaZ=T.MathUtils.lerp(jelly.z,player.z-.72,lumaFollow);
    luma.position.set(lumaX,1.55+Math.sin(t*1.83)*.175+places.floorAt(lumaX,lumaZ),lumaZ);
    luma.rotation.y=Math.sin(t*.58)*.22;
    tendRing.visible=Boolean(tending&&tending.pulse>0);
    if(tending){
      luma.position.set(tending.x,1.28+Math.sin(t*2)*.12+places.floorAt(tending.x,tending.z),tending.z);
      luma.rotation.y=tending.heading;
      if(tendRing.visible){
        tendRing.position.set(tending.x,.31+places.floorAt(tending.x,tending.z),tending.z);
        tendRing.scale.setScalar(.27+tending.pulse);
      }
    }
    reefLife.animate(t,height,player);
    for(const {blade,phase} of wavingKelp){
      blade.rotation.z=Math.sin(t*1.12+phase)*.074;
      blade.rotation.x=Math.sin(t*.71+phase)*.042;
    }
    marker.visible=false; // quests are switched off for now
    if(quest) marker.position.set(quest.x,.23+places.floorAt(quest.x,quest.z),quest.z);
    star.position.y=1.0+Math.sin(t*3)*.13;star.rotation.y=t*1.6;
    seed.visible=step===2;seed.rotation.y=t;
    pearlPickup.shell.visible=!review&&step>=2&&!style.pearlFound;
    if(pearlPickup.shell.visible) pearlPickup.animate(t);
    flowers.visible=step===4||step===5;
    for(const bloom of blooms) bloom.visible=step===5;
    crafted.visible=step>=7;
    grottoSeed.visible=step===7;
    grottoSeed.position.y=.57+Math.sin(t*3)*.13;
    grottoSeed.rotation.y=t*1.5;
    tideglass.visible=step<=8;
    kelp.visible=step===10||step===11;
    kelp.scale.y=step===11?1:.55;
    for(const tip of tips) tip.visible=step===11;
    fountain.visible=display>=0;
    if(fountain.visible){
      const spot=displaySpots[display];
      fountainPrism.rotation.y=t*.91;
      ripple.scale.setScalar(.14+(t*.47%1)*.52);
      fountain.position.set(spot.x,places.floorAt(spot.x,spot.z),spot.z);
      for(let i=0;i<droplets.length;i++){
        const angle=Math.floor(i/3)/5*tau;
        const phase=(t*.86+i%3/3)%1;
        const radius=.07+phase*.54;
        droplets[i].position.set(Math.cos(angle)*radius,.91+Math.sin(phase*Math.PI)*.49,Math.sin(angle)*radius);
      }
    }
    for(let i=0;i<pads.length;i++) pads[i].visible=step>=13&&i!==display;
    currentRibbon.visible=true;
    for(let i=0;i<motes.length;i++){
      const mote=motes[i];
      mote.visible=step>=1||current;
      if(mote.visible) {
        path.getPoint((i/motes.length+t*.23)%1,mote.position);
        mote.scale.setScalar(step===1||current?1:.52);
      }
    }
    if(space!=='farm'){plaza.ensureLoaded();startSeaLife();} // the town and its sea life load once she leaves her Homebase
    const overPlaza=player.x>=plazaLeft-1&&player.x<4.5;
    const inWater=space==='outdoor'&&(overPlaza?!places.onPlazaFloor(player.x,player.z):player.x<plazaLeft-1||player.x<7.4||Boolean(current))||Boolean(current);
    if(current||cooking||Math.hypot(player.vx,player.vz)>.34) fitting=false;
    fittingBlend+=((fitting?1:0)-fittingBlend)*(1-Math.exp(-dt*(reduceMotion?18:5.6)));
    if(avatar){
      const pose=fitting?{...player,heading:.15}:player;
      const loaded=avatar.update(pose,time,dt,inWater,current,reduceMotion,style.charmEquipped,cooking);
      character.visible=!loaded&&avatar.usePlaceholder();
    }
    lastPose.x=player.x;lastPose.z=player.z;
    if(!reduceMotion&&inWater&&Math.hypot(player.vx,player.vz)>2.2){
      wakeClock+=dt;
      if(wakeClock>.14){
        wakeClock=0;
        juice.bubbles({x:player.x-Math.sin(player.heading)*.5,y:.55,z:player.z-Math.cos(player.heading)*.5});
      }
    }
    if(cooking&&inCottage&&!reduceMotion){
      const stove=places.kitchen;
      const pot={x:stove.x+.10,y:1.0,z:stove.z+.10};
      if(!wasCooking){
        ['#ffd9f2','#b9ffe0','#fff0a6','#f4c6ff','#ffc2dd'].forEach((color,index)=>{
          juice.toss({x:player.x+(index-2)*.12,y:1.05,z:player.z},pot,color);
        });
      }
      steamClock+=dt;
      if(steamClock>.09){steamClock=0;juice.steam(pot);}
    }else steamClock=0;
    wasCooking=Boolean(cooking);
    bedPulse=Math.max(0,bedPulse-dt*2.4);
    farmBedGlow.scale.setScalar((1+bedPulse*.22)*places.farmIsland.scale/16);
    props?.update(t);
    juice.update(dt,{reduce:reduceMotion,viewHeight:height,fov:camera.fov});
    furniture.tick(dt);
    character.position.set(player.x,.28+floorFollow+Math.sin(t*3.4)*.06+(current?Math.sin(t*5)*.12+.24:0),player.z);
    character.rotation.y=player.heading;
    const swim=Math.min(1,Math.hypot(player.vx,player.vz)/6);
    body.rotation.x=-.12-swim*.38;
    tail.rotation.y=Math.sin(t*(3+swim*7))*(.08+swim*.26);
    tail.rotation.x=Math.sin(t*(3+swim*7))*.11;
    if(review){
      review.actor.position.set(player.x,.084,player.z);
      review.actor.rotation.y=player.heading;
      if(review.faceView){
        const distance=Math.max(.50,.48/Math.min(camera.aspect,1));
        camera.position.set(player.x+.11,review.eyeHeight+.026,player.z+distance);
        aim.set(player.x,review.eyeHeight-.019,player.z);
      } else if(review.closeUp){
        const distance=Math.max(2.06,2.07/Math.min(camera.aspect,1));
        camera.position.set(player.x+.52,1.34,player.z+distance);
        aim.set(player.x,.78,player.z);
      }
    } else if(fittingBlend>.002){
      const distance=Math.max(2.8,2.9/camera.aspect**.51);
      camera.position.lerp(new T.Vector3(player.x+.52,1.56,player.z+distance),fittingBlend);
      aim.lerp(new T.Vector3(player.x,.80,player.z),fittingBlend);
    }
    if(!review){
      const response=reduceMotion?1:1-Math.exp(-dt*15);
      yaw=wrapAngle(yaw+wrapAngle(targetYaw-yaw)*response);
      pitch=T.MathUtils.lerp(pitch,targetPitch,response);
      zoom=T.MathUtils.lerp(zoom,targetZoom,response);
      if(Math.abs(yaw)+Math.abs(pitch)+Math.abs(zoom-1)>.0001){
        offset.subVectors(camera.position,aim);
        const distance=Math.max(2.55,offset.length()*zoom);
        const azimuth=Math.atan2(offset.x,offset.z)+yaw;
        const elevation=T.MathUtils.clamp(Math.atan2(offset.y,Math.hypot(offset.x,offset.z))+pitch,.18,1.27);
        const centered=T.MathUtils.smoothstep(zoom,.27,.76);
        aim.x=T.MathUtils.lerp(player.x,aim.x,centered);
        aim.y=T.MathUtils.lerp(.79,aim.y,centered);
        aim.z=T.MathUtils.lerp(player.z,aim.z,centered);
        camera.position.copy(aim).add(offset.setFromSphericalCoords(distance,Math.PI/2-elevation,azimuth));
        camera.position.y=Math.max(1.02,camera.position.y);
      }
    }
    const cookingTarget=inCottage&&cooking?1:0;
    cookingBlend=T.MathUtils.lerp(cookingBlend,cookingTarget,reduceMotion?1:1-Math.exp(-dt*6.3));
    if(cookingBlend>.002){
      const stove=places.kitchen;
      const narrow=Math.max(1,Math.min(1.48,(1.1/camera.aspect)**.53));
      cookingAim.set(stove.x+.10,.94,stove.z+.10);
      cookingCamera.set(cookingAim.x+3.02*narrow,1.72+.20*(narrow-1),cookingAim.z+1.59*narrow);
      camera.position.lerp(cookingCamera,cookingBlend);
      aim.lerp(cookingAim,cookingBlend);
    }
    camera.lookAt(aim);
    camera.updateMatrixWorld();
    renderer.draw(scene,camera);
  }

  function screenRay(x,y){
    const rect=canvas.getBoundingClientRect();
    pickRay.setFromCamera(new T.Vector2((x-rect.left)/rect.width*2-1,1-(y-rect.top)/rect.height*2),camera);
    return pickRay;
  }
  function pick(x,y){
    return screenRay(x,y).ray.intersectPlane(plane,new T.Vector3());
  }
  const bedHit=new T.Vector3();
  function pickFarmBed(x,y){
    if(!farmArea.group.visible)return -1;
    const ray=screenRay(x,y).ray;
    let picked=-1,nearest=Infinity;
    farmBedBoxes.forEach((box,index)=>{
      if(!ray.intersectBox(box,bedHit))return;
      const distance=ray.origin.distanceToSquared(bedHit);
      if(distance<nearest){nearest=distance;picked=index;}
    });
    return picked;
  }
  function hitsWardrobe(x,y){
    return cottageArea.visible&&screenRay(x,y).intersectObject(wardrobe,true).length>0;
  }
  function hitsKitchen(x,y){
    return cottageArea.visible&&screenRay(x,y).intersectObject(kitchen,true).length>0;
  }
  function hitsMoonlacePearl(x,y){
    return pearlPickup.shell.visible&&screenRay(x,y).ray.intersectsSphere(pearlHit);
  }
  function inspect() {
    let objects=0,meshes=0,lights=0;
    scene.traverse(object=>{objects++;if(object.isMesh)meshes++;if(object.isLight)lights++;});
    const regionDetails=Object.fromEntries(
      [sunpetalDetails,moonlaceDetails,currentRibbon,fountain,homeStations,glassfin].map(group=>{
        let childMeshes=0,instances=0;
        group.traverse(object=>{
          if(object.isMesh) childMeshes++;
          if(object.isInstancedMesh) instances+=object.count;
        });
        return [group.name,{meshes:childMeshes,instances}];
      })
    );
    return {
      objects,meshes,lights,regionDetails,imported:{...environment?.imported,...regionalArt?.imported},avatar:avatar?.appearance(),
      landmarks: [home.name,sunpetalDetails.name,moonlaceDetails.name,currentRibbon.name,fountain.name],
      placements: displaySpots.map(spot=>({name:spot.name,x:spot.x,z:spot.z})),
      fountain: {visible:fountain.visible,x:fountain.position.x,z:fountain.position.z},
      moonlacePearl:{visible:pearlPickup.shell.visible,x:moonlacePearl.x,z:moonlacePearl.z},
      homestead:{farmVisible:farmArea.group.visible,beds:places.fieldPlots.length,kitchenVisible:cottageArea.visible,
        kitchenAsset:kitchen.children[0]?.name,wardrobeAsset:wardrobe.children[0]?.name,wardrobeInside:wardrobe.parent===cottageArea},
      camera:{x:camera.position.x,y:camera.position.y,z:camera.position.z,yaw,pitch,zoom}
    };
  }
  return {
    render,pick,pickFarmBed,hitsWardrobe,hitsKitchen,hitsMoonlacePearl,inspect,setQuality,setFitting:value=>{fitting=value;},
    rotateCamera,zoomCamera,resetCamera,cameraHeading:()=>yaw,
    prepareArea:area=>regionalArt?.ensure(area),
    dispose(){
      juice.dispose();
      regionalArt?.dispose();
      environment?.dispose();
      staticArt?.dispose();
      renderer.dispose?.();
    },
    celebrate(kind,detail={}){
      if(effectsReduced)return;
      const bed=detail.bed>=0?places.fieldPlots[detail.bed]:undefined;
      if(bed){
        juice.celebrate(kind,{x:bed.x,y:.3,z:bed.z,color:detail.color});
        bedPulse=1;
      }else if(kind!=='ask'){
        juice.celebrate(kind,{x:lastPose.x,y:.2,z:lastPose.z,color:detail.color});
      }
      if(kind==='meal')avatar?.react('taste');
      else if(kind==='plant'||kind==='harvest'||kind==='pearl'||kind==='charm')avatar?.react('cheer');
      if(kind==='harvest'||kind==='meal'||kind==='ask'||kind==='pearl'||kind==='charm')emoteLuma?.('excited');
    },
    equip:id=>avatar?.equip(id),
    setFurniture:(items,selected)=>furniture.setLayout(items,selected),
    pickFurniture:(x,y)=>cottageArea.visible?furniture.pick(screenRay(x,y).ray):'',
    ready:Promise.all([environment?.ready,avatarReady])
  };
}
