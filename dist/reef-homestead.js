import * as T from './vendor/three.module.min.js';
import { createField } from './reef-field.js';
import { loadReefModel } from './reef-model-loader.js';

const pi=Math.PI;
function mesh(parent,shape,material,x,y,z){
  const object=new T.Mesh(shape,material);
  object.position.set(x,y,z);
  object.receiveShadow=true;
  parent.add(object);
  return object;
}
const block=(parent,material,x,y,z,w,h,d)=>mesh(parent,new T.BoxGeometry(w,h,d),material,x,y,z);
function disk(parent,material,x,y,z,r,height){
  return mesh(parent,new T.CylinderGeometry(r,r,height,32),material,x,y,z);
}
function raisedIsland(parent,material,width,length,height,y,corner=.8){
  const island=new T.Shape();
  const w=width/2,d=length/2;
  island.moveTo(-w,-d+corner);
  island.quadraticCurveTo(-w,-d,-w+corner,-d);
  island.lineTo(w-corner,-d);
  island.quadraticCurveTo(w,-d,w,-d+corner);
  island.lineTo(w,d-corner);
  island.quadraticCurveTo(w,d,w-corner,d);
  island.lineTo(-w+corner,d);
  island.quadraticCurveTo(-w,d,-w,d-corner);
  island.closePath();
  const floor=mesh(parent,new T.ExtrudeGeometry(island,{
    depth:height,bevelThickness:.17,bevelSize:.21,bevelSegments:2,curveSegments:12,steps:1
  }),material,0,y,0);
  floor.rotation.x=-pi/2;
  return floor;
}

const leafShape=new T.SphereGeometry(1,10,7);
const flowerShape=new T.SphereGeometry(1,10,7);
const stalkShape=new T.CylinderGeometry(.026,.036,.74,7);

function cropInstances(parent,kind,materials){
  const stems=new T.InstancedMesh(stalkShape,materials.stem,8);
  const leaves=new T.InstancedMesh(leafShape,materials.leaf,16);
  const moonlace=kind==='moonlace';
  const flowers=new T.InstancedMesh(flowerShape,moonlace?materials.petals:materials.kelp,moonlace?40:8);
  const dummy=new T.Object3D();
  function place(batch,index,x,y,z,sx,sy,sz,angle=0){
    dummy.position.set(x,y,z);
    dummy.scale.set(sx,sy,sz);
    dummy.rotation.set(0,0,angle);
    dummy.updateMatrix();
    batch.setMatrixAt(index,dummy.matrix);
  }
  for(let i=0;i<8;i++){
    const x=-.91+(i%4)*.61,z=-.39+Math.floor(i/4)*.73,h=.85+.16*Math.sin(i*4.5);
    place(stems,i,x,h*.37,z,1,h,1);
    for(const side of [-1,1]){
      place(leaves,i*2+Number(side>0),x+side*.112,h*.42,z,.088,.185,.032,side*-.72);
    }
    if(moonlace){
      for(let petal=0;petal<5;petal++){
        const angle=petal*2*pi/5;
        place(flowers,i*5+petal,x+.095*Math.cos(angle),h*.74,z+.095*Math.sin(angle),.093,.043,.078);
      }
    }else place(flowers,i,x,h*.73,z,.062,.153,.063,.24);
  }
  for(const batch of [stems,leaves,flowers])batch.computeBoundingSphere();
  parent.add(stems,leaves,flowers);
  return flowers;
}

// Model-space height of the plot tops in the Pearl Reef Sanctuary (measured from the file).
const sanctuaryPlotTop=.1186;
const plotScale=.62;

export function buildFarmIsland(scene,layout,materials){
  const {farmIsland,fieldPlots}=layout;
  const group=new T.Group();
  group.name='Pearl Reef Sanctuary (farm)';
  group.position.set(farmIsland.x,0,farmIsland.z);
  scene.add(group);
  const field=createField(group,fieldPlots,farmIsland,{overlay:true,scale:plotScale*farmIsland.scale/16});
  const groundY=.074; // where the plot tops sit in the game world
  const state={life:null,viewHeight:800,time:0,loaded:false};

  // Shown only if the model cannot load, so the farm still works.
  const fallback=new T.Group();
  fallback.name='Sanctuary fallback ground';
  const disk=new T.Mesh(new T.CylinderGeometry(1,1,.12,48),materials.limestone('#dca7b8'));
  disk.scale.set(farmIsland.ellipse.rx,1,farmIsland.ellipse.rz);
  disk.position.y=groundY-.06;
  disk.receiveShadow=true;
  fallback.add(disk);
  fallback.visible=false;
  group.add(fallback);

  // The Conch Shell Home: painted vertex colours, no texture. Its base is the rock garden around the door.
  if(layout.farmHome){
    const fh=layout.farmHome;
    loadReefModel('./environment/conch-shell-home.glb').then(({scene:home})=>{
      home.name='Conch Shell Home';
      home.scale.setScalar(fh.scale);
      home.rotation.y=fh.yaw||0;
      home.position.set(fh.x-farmIsland.x,groundY+.9*fh.scale-.12,fh.z-farmIsland.z);
      home.traverse(object=>{if(object.isMesh){object.castShadow=false;object.receiveShadow=true;if(object.material){object.material.color?.setScalar(.8);object.material.envMapIntensity=.45;object.material.roughness=.5;}}});
      group.add(home);
    }).catch(()=>{});
  }
  loadReefModel('./environment/pearl-reef-sanctuary.glb').then(async({scene:model})=>{
    model.name='Pearl Reef Sanctuary';
    model.scale.setScalar(farmIsland.scale);
    model.position.y=groundY-sanctuaryPlotTop*farmIsland.scale;
    model.traverse(object=>{if(object.isMesh)object.receiveShadow=true;});
    group.add(model);
    state.loaded=true;
    try{
      const {animateMeshyIsland}=await import('./reef-sanctuary-motion.js');
      state.life=animateMeshyIsland(model,{float:false});
      state.life.setViewHeight(state.viewHeight);
      // Keep the original pearly pink, lilac and teal: a slight saturation lift and a soft glow.
      model.traverse(object=>{
        if(!object.isMesh||!object.material?.color)return;
        const hsl={};
        object.material.color.getHSL(hsl);
        object.material.color.setHSL(hsl.h,Math.min(1,hsl.s*1.15),hsl.l*.94);
        object.material.envMapIntensity=.75;
      });
    }catch(error){
      // The island still shows without its motion.
    }
  }).catch(()=>{fallback.visible=true;});

  return {group,
    update(tilesNow){field.update(tilesNow);},
    tick(dt,time){
      field.tick(dt,time);
      state.life?.update(time);
    },
    setViewHeight(pixels){
      state.viewHeight=pixels;
      state.life?.setViewHeight(pixels);
    },
    get loaded(){return state.loaded;}
  };
}

export function buildCottageRoom(scene,layout,materials,kitchen,wardrobe){
  const room=new T.Group();
  room.name='Sunpetal Cottage';
  room.position.set(layout.cottageRoom.x,0,layout.cottageRoom.z);
  room.visible=false;
  scene.add(room);
  room.attach(kitchen);
  room.attach(wardrobe);
  const {gold,wood}=materials;
  const plum=materials.limestone('#553c64');
  const cream=materials.nacre('#e3b4ae');
  const pearl=materials.nacre('#f0d1ca');
  const mauve=materials.textile('#955783');
  const ocean=new T.MeshPhysicalMaterial({
    color:'#3990b9',emissive:'#226b9e',emissiveIntensity:.48,roughness:.26,clearcoat:.68
  });
  raisedIsland(room,plum,8.55,6.7,.19,-.35).position.z=.12;
  raisedIsland(room,cream,8.3,6.47,.047,-.16).position.z=.12;
  for(let i=0;i<12;i++){
    block(room,materials.decking(i%2?'#c8928d':'#d7aaa4'),0,-.009,-2.81+.52*i,7.95,.035,.495);
  }
  block(room,plum,0,1.47,-3.02,8.20,2.96,.18);
  block(room,cream,0,.24,-2.88,8.12,.44,.1);
  block(room,gold,0,.49,-2.84,8.15,.035,.048);
  for(const x of [-4.04,4.04]){
    block(room,plum,x,.33,-.72,.14,.66,4.59);
    block(room,gold,x,.68,-.72,.177,.04,4.65);
  }
  for(const x of [-2.55,2.55]){
    const window=mesh(room,new T.SphereGeometry(1,28,20),ocean,x,1.83,-2.88);
    window.scale.set(.63,.91,.079);
    const frame=mesh(room,new T.TorusGeometry(1,.039,8,40),gold,x,1.83,-2.78);
    frame.scale.set(.65,.92,1);
    block(room,gold,x,1.83,-2.755,1.22,.037,.043);
    block(room,gold,x,1.83,-2.743,.036,1.76,.044);
  }
  const cabinet=block(room,wood,2.64,.50,-1.93,1.60,.92,.57);
  cabinet.castShadow=true;
  block(room,pearl,2.64,1.00,-1.93,1.73,.12,.65);
  for(const [i,x] of [2.13,2.49,2.89,3.19].entries()){
    disk(room,i%2?ocean:cream,x,1.13+(i%2)*.05,-1.87,.087+(i%2)*.035,.19+(i%2)*.1);
    disk(room,gold,x,1.24+(i%2)*.092,-1.87,.058,.04);
  }
  const rug=disk(room,mauve,0,.031,1.52,.89,.014);
  rug.scale.z=.54;
  const edging=mesh(room,new T.TorusGeometry(.82,.016,6,42),gold,0,.045,1.52);
  edging.rotation.x=-pi/2;
  edging.scale.y=.54;
  const light=new T.PointLight('#ffcba5',25,8,2);
  light.position.set(.1,3.08,1.04);
  room.add(light);
  return room;
}
