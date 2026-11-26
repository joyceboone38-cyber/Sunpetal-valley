import * as T from './vendor/three.module.min.js';

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

export function buildFarmIsland(scene,layout,materials,buildBed){
  const {farmIsland,fieldPlots}=layout;
  const group=new T.Group();
  group.name='Sunpetal Farm Island';
  group.position.set(farmIsland.x,0,farmIsland.z);
  scene.add(group);
  const {wood,gold}=materials;
  const slate=materials.limestone('#495e82');
  const rim=materials.nacre('#b79ad0');
  const paving=materials.limestone('#af879f');
  const pale=materials.nacre('#e3cedc');
  const lilac=materials.nacre('#c78be5');
  const aqua=materials.nacre('#69cac0');
  raisedIsland(group,slate,17.1,12.8,.68,-.95,1.95).position.z=.95;
  raisedIsland(group,rim,16.8,12.5,.1,-.255,1.82).position.z=.95;
  raisedIsland(group,paving,16.51,12.24,.04,-.18,1.7).position.z=.95;
  for(let i=0;i<17;i++){
    block(group,pale,0,.043,-4.96+i*.66,1.83,.052,.59);
  }
  for(const z of [-1.86,1.46,4.72]){
    for(const sign of [-1,1]){
      block(group,pale,sign*4.61,.03,z,7.03,.048,.58);
    }
  }
  for(let i=0;i<8;i++){
    block(group,wood,7.37+i*.26,.048,1.46,.232,.1,1.53);
  }
  const cropMaterials={
    stem:materials.textile('#3b8f79'),leaf:materials.textile('#5ec99f'),petals:lilac,kelp:aqua
  };
  const beds=fieldPlots.map(plot=>{
    const bed=buildBed(plot.x-farmIsland.x,plot.z-farmIsland.z,group);
    const color=plot.crop==='moonlace'?lilac:aqua;
    block(bed,color,-1.10,.425,.82,.37,.15,.09);
    block(bed,gold,-1.10,.34,.82,.04,.15,.033);
    const plants=new T.Group();
    plants.position.y=.26;
    bed.add(plants);
    const blooms=cropInstances(plants,plot.crop,cropMaterials);
    return {plants,blooms};
  });
  for(const x of [-7.6,-1.27,1.27,7.6]){
    for(const z of [-4.78,4.82]){
      disk(group,wood,x,.36,z,.073,.75);
      disk(group,gold,x,.74,z,.153,.065);
      mesh(group,new T.SphereGeometry(.119,12,10),new T.MeshStandardMaterial({
        color:'#ffddb1',emissive:'#ffc879',emissiveIntensity:.72,roughness:.29
      }),x,.86,z);
    }
  }
  for(const sign of [-1,1]){
    block(group,wood,sign*3.14,.14,5.76,1.45,.24,.66);
    block(group,pale,sign*3.14,.31,5.76,1.53,.11,.71);
  }
  const edgeStone=new T.IcosahedronGeometry(1,1);
  const edgeGrass=materials.textile('#4b927f');
  const edgeBloom=materials.nacre('#dc9abd');
  for(const side of [-1,1]){
    for(const [x,z] of [[7.57,-4.52],[8.13,-1.56],[8.09,1.89],[7.73,5.04],[5.91,6.18],[2.03,6.20]]){
      const rock=mesh(group,edgeStone,slate,x*side,.04,z);
      rock.scale.set(.36,.21,.36);
      for(let i=0;i<5;i++){
        const leaf=mesh(group,leafShape,i===2?edgeBloom:edgeGrass,x*side+(i-2)*.103,.22+.09*Math.sin(i*pi/4),z+.075*(i%2));
        leaf.scale.set(.07,.15+.12*Math.sin(i*pi/4),.043);
        leaf.rotation.z=(i-2)*-.26;
      }
    }
  }
  const statuses=[],pops=[];
  const baseHeight=status=>status===2?1:.48;
  return {group,update(crops,reduceMotion){
    beds.forEach(({plants,blooms},index)=>{
      const status=crops[index]??0;
      if(statuses[index]===status)return;
      if(!reduceMotion&&statuses[index]!==undefined&&status>0)pops[index]=0;
      statuses[index]=status;
      plants.visible=status>0;
      plants.scale.set(1,baseHeight(status),1);
      blooms.visible=status===2;
    });
  },
  // Springy pop whenever a bed changes stage: planted, sprouted, ready.
  tick(dt){
    beds.forEach(({plants},index)=>{
      if(pops[index]===undefined)return;
      pops[index]+=dt/.55;
      const base=baseHeight(statuses[index]??0);
      if(pops[index]>=1){
        plants.scale.set(1,base,1);
        pops[index]=undefined;
        return;
      }
      const u=pops[index];
      const spring=1+.34*(1-u)*Math.sin(u*Math.PI*3.2);
      plants.scale.set(1/Math.sqrt(spring),base*spring,1/Math.sqrt(spring));
    });
  }};
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
