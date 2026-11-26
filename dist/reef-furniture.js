// Furniture that can be bought in the Shop and then shows up inside the cottage.
// Each piece is built from simple shapes, so no model files are needed. Every piece has
// a fixed spot in the room, picked to stay clear of the kitchen, the wardrobe and the doorway.
import * as T from './vendor/three.module.min.js';

export const furnitureCatalog=[
  {id:'starfishRug',name:'Starfish Rug',price:90,about:'A plush pink starfish for the middle of the room.'},
  {id:'pearlLamp',name:'Pearl Lamp',price:120,about:'A glowing pearl on a golden stand.'},
  {id:'coralPlanter',name:'Coral Planter',price:180,about:'Bright coral growing from a glossy pot.'},
  {id:'shellSofa',name:'Shell Sofa',price:320,about:'A scalloped pink sofa made for sitting with friends.'},
  {id:'glamVanity',name:'Glam Vanity',price:420,about:'A mirror, a golden frame and a row of tiny bottles.'}
];

const glossy=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:.34,metalness:.08,...extra});
const gold=()=>new T.MeshStandardMaterial({color:'#f6c862',roughness:.28,metalness:.85});

function put(group,geometry,material,x,y,z,sx=1,sy=1,sz=1){
  const mesh=new T.Mesh(geometry,material);
  mesh.position.set(x,y,z);
  mesh.scale.set(sx,sy,sz);
  mesh.castShadow=true;
  mesh.receiveShadow=true;
  group.add(mesh);
  return mesh;
}

const sphere=new T.SphereGeometry(1,24,16);
const cylinder=new T.CylinderGeometry(1,1,1,24);
const cone=new T.ConeGeometry(1,1,12);
const box=new T.BoxGeometry(1,1,1);

function starfishRug(){
  const group=new T.Group();
  const shape=new T.Shape();
  for(let i=0;i<10;i++){
    const radius=i%2?.42:1.05;
    const angle=Math.PI/2+i*Math.PI/5;
    const x=Math.cos(angle)*radius,y=Math.sin(angle)*radius;
    if(i===0)shape.moveTo(x,y);else shape.lineTo(x,y);
  }
  shape.closePath();
  const star=new T.Mesh(new T.ExtrudeGeometry(shape,{
    depth:.03,bevelEnabled:true,bevelThickness:.03,bevelSize:.07,bevelSegments:3
  }),glossy('#ff5fae',{roughness:.85}));
  star.rotation.x=-Math.PI/2;
  star.position.y=.02;
  star.receiveShadow=true;
  group.add(star);
  put(group,sphere,glossy('#ffe3f1',{roughness:.5}),0,.095,0,.16,.05,.16);
  for(let i=0;i<5;i++){
    const angle=Math.PI/2+i*2*Math.PI/5;
    put(group,sphere,glossy('#ffd0e8',{roughness:.5}),Math.cos(angle)*.62,.095,-Math.sin(angle)*.62,.07,.03,.07);
  }
  group.position.set(1.75,0,.25);
  group.scale.setScalar(1.1);
  return group;
}

function pearlLamp(){
  const group=new T.Group();
  const metal=gold();
  put(group,cylinder,metal,0,.04,0,.3,.08,.3);
  put(group,cylinder,metal,0,.62,0,.04,1.16,.04);
  put(group,sphere,new T.MeshStandardMaterial({
    color:'#fff1f9',emissive:'#ffc2ea',emissiveIntensity:1.1,roughness:.2
  }),0,1.3,0,.26,.26,.26);
  group.position.set(-3.0,0,.35);
  return group;
}

function coralPlanter(){
  const group=new T.Group();
  put(group,cylinder,glossy('#f2a7cf'),0,.22,0,.3,.44,.3);
  put(group,cylinder,gold(),0,.45,0,.33,.05,.33);
  const colors=['#ff6f9e','#ffa26b','#ff8fd0','#ff6f9e','#ffc16b'];
  for(let i=0;i<5;i++){
    const angle=i*2*Math.PI/5;
    const branch=put(group,cone,glossy(colors[i],{emissive:colors[i],emissiveIntensity:.12}),
      Math.cos(angle)*.14,.78,Math.sin(angle)*.14,.07,.62+(i%2)*.18,.07);
    branch.rotation.z=Math.cos(angle)*.34;
    branch.rotation.x=-Math.sin(angle)*.34;
  }
  group.position.set(3.0,0,.3);
  return group;
}

function shellSofa(){
  const group=new T.Group();
  const pink=glossy('#ff8fd0',{roughness:.5});
  const deep=glossy('#e95db6',{roughness:.5});
  put(group,sphere,pink,0,.28,0,.95,.26,.46);
  put(group,sphere,deep,0,.62,-.34,.95,.42,.18);
  for(let i=-3;i<=3;i++){
    put(group,sphere,glossy(i%2?'#ffb0e0':'#ff7fc6',{roughness:.5}),i*.26,.86-Math.abs(i)*.045,-.37,.13,.34,.08);
  }
  for(const side of [-1,1])put(group,sphere,deep,side*.98,.42,-.04,.16,.28,.4);
  for(const side of [-1,1])put(group,cylinder,gold(),side*.7,.03,.2,.05,.06,.05);
  group.position.set(-2.85,0,1.35);
  group.rotation.y=Math.PI/2;
  group.scale.setScalar(.82);
  return group;
}

function glamVanity(){
  const group=new T.Group();
  const metal=gold();
  put(group,box,glossy('#f8dcec'),0,.62,0,1.15,.07,.56);
  for(const [x,z] of [[-.5,-.2],[.5,-.2],[-.5,.2],[.5,.2]])put(group,cylinder,metal,x,.3,z,.03,.6,.03);
  const mirror=put(group,sphere,new T.MeshStandardMaterial({color:'#d8f2ff',roughness:.06,metalness:.95}),0,1.32,-.24,.4,.58,.025);
  const frame=new T.Mesh(new T.TorusGeometry(1,.075,10,40),metal);
  frame.position.set(0,1.32,-.235);
  frame.scale.set(.42,.6,1);
  group.add(frame);
  mirror.castShadow=false;
  const bottles=['#c58bff','#ff9ad5','#8fe3ff'];
  for(let i=0;i<3;i++){
    put(group,cylinder,glossy(bottles[i],{roughness:.15}),-.3+i*.22,.74,.02,.055,.16,.055);
    put(group,sphere,metal,-.3+i*.22,.84,.02,.04,.04,.04);
  }
  group.position.set(3.05,0,1.65);
  group.rotation.y=-Math.PI/2;
  return group;
}

const builders={starfishRug,pearlLamp,coralPlanter,shellSofa,glamVanity};

export function createFurniture(parent) {
  const pieces=new Map();
  const pops=new Map();
  for(const {id} of furnitureCatalog){
    const group=builders[id]();
    group.name='Cottage '+id;
    group.visible=false;
    group.userData.base=group.scale.x;
    parent.add(group);
    pieces.set(id,group);
  }
  let known=new Set(),started=false;
  return {
    // Show exactly the pieces in `owned`. Pieces bought since the last call spring in.
    setOwned(owned) {
      const next=new Set(owned);
      for(const [id,group] of pieces){
        const has=next.has(id);
        if(has&&started&&!known.has(id))pops.set(id,0);
        group.visible=has;
        if(!has){pops.delete(id);}
        if(!pops.has(id))group.scale.setScalar(group.userData.base);
      }
      known=next;
      started=true;
    },
    tick(dt) {
      for(const [id,time] of pops){
        const group=pieces.get(id);
        const u=Math.min(1,time+dt/.6);
        const spring=u>=1?1:1-Math.exp(-6*u)*Math.cos(u*Math.PI*3.4);
        group.scale.setScalar(group.userData.base*Math.max(.01,spring));
        if(u>=1)pops.delete(id);
        else pops.set(id,u);
      }
    }
  };
}
