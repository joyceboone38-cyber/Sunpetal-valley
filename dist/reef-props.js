import * as T from './vendor/three.module.min.js';

// Drop-in decoration. Put free GLB models in dist/environment/props/ using the file names
// below (the build embeds that folder automatically). Missing files are skipped quietly,
// so you can add them one at a time. Every model is resized to the stated height and set
// on the ground, so any pack works whatever its native scale is.
//
// area 'reef'    : x and z are world positions on the sea floor
// area 'farm'    : x and z are local to Farm Island (its centre is 0,0)
// area 'cottage' : x and z are local to the cottage room (its centre is 0,0)
// Add ?props=debug to the page address to show a magenta marker on every slot.
export const propSlots=[
  // Moonlace Reef, around the shelf, the pearl path and Glassfin Grotto
  {file:'starfish.glb',area:'reef',x:11.4,z:-0.4,height:.22,rotY:.6},
  {file:'starfish.glb',area:'reef',x:14.6,z:0.2,height:.2,rotY:2.1},
  {file:'starfish.glb',area:'reef',x:12.6,z:-3.1,height:.24,rotY:4},
  {file:'seashell.glb',area:'reef',x:15.8,z:-1.9,height:.3,rotY:1},
  {file:'seashell.glb',area:'reef',x:13.9,z:-3.7,height:.26,rotY:3.3},
  {file:'anemone.glb',area:'reef',x:15.0,z:-6.3,height:.6,sway:true},
  {file:'anemone.glb',area:'reef',x:18.0,z:-4.2,height:.55,sway:true,rotY:2},
  {file:'sea-urchin.glb',area:'reef',x:10.5,z:-5.6,height:.3},
  {file:'coral.glb',area:'reef',x:8.2,z:-3.6,height:1.0,sway:true},
  {file:'coral.glb',area:'reef',x:10.9,z:-6.2,height:.9,sway:true,rotY:2.4},
  // Sunpetal Homebase, near the Pearl Tidepool
  {file:'seaweed.glb',area:'reef',x:-6.2,z:2.9,height:.9,sway:true},
  {file:'seaweed.glb',area:'reef',x:-8.8,z:.6,height:.8,sway:true,rotY:1.7},
  // Farm Island, near the dock end
  // Cottage kitchen, beside the stove
  {file:'bowl.glb',area:'cottage',x:-1.6,z:-2.0,height:.25},
  {file:'basket.glb',area:'cottage',x:-2.3,z:-1.6,height:.4,rotY:.5}
];

export function createProps({scene,farmGroup,cottageGroup,load,hasModel,slots=propSlots}) {
  const parents={reef:scene,farm:farmGroup,cottage:cottageGroup};
  const swaying=[];
  const placed=[];
  const debug=typeof location!=='undefined'&&new URLSearchParams(location.search).get('props')==='debug';
  const box=new T.Box3(),size=new T.Vector3(),center=new T.Vector3();

  function place(slot,model,index) {
    const parent=parents[slot.area];
    if(!parent)return;
    const clone=model.clone(true);
    const holder=new T.Group();
    holder.name='Prop '+slot.file;
    holder.add(clone);
    clone.updateMatrixWorld(true);
    box.setFromObject(clone);
    box.getSize(size);
    box.getCenter(center);
    const fit=size.y>1e-4?slot.height/size.y:1;
    clone.scale.multiplyScalar(fit);
    clone.position.set(-center.x*fit,-box.min.y*fit,-center.z*fit);
    holder.position.set(slot.x,slot.y??0,slot.z);
    holder.rotation.y=slot.rotY??0;
    parent.add(holder);
    placed.push(holder);
    if(slot.sway)swaying.push({holder,phase:index*1.7});
  }

  const files=[...new Set(slots.map(slot=>slot.file))];
  const ready=Promise.all(files.map(async file=>{
    const path='./environment/props/'+file;
    if(!hasModel(path))return;
    let model;
    try{
      model=(await load(path)).scene;
    }catch{
      return;
    }
    slots.forEach((slot,index)=>{if(slot.file===file)place(slot,model,index);});
  })).then(()=>{
    if(!debug)return;
    console.table(slots.map(({file,area,x,z,height})=>({file,area,x,z,height})));
    const marker=new T.Mesh(new T.ConeGeometry(.12,.4,8),new T.MeshBasicMaterial({color:'#ff2bd6'}));
    for(const slot of slots){
      const parent=parents[slot.area];
      if(!parent)continue;
      const flag=marker.clone();
      flag.position.set(slot.x,.2+(slot.y??0),slot.z);
      parent.add(flag);
    }
  });

  return {
    ready,
    count:()=>placed.length,
    update(time) {
      for(const {holder,phase} of swaying){
        holder.rotation.z=Math.sin(time*.9+phase)*.045;
        holder.rotation.x=Math.sin(time*.67+phase*1.3)*.03;
      }
    }
  };
}
