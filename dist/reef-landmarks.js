import * as T from './vendor/three.module.min.js';

const full=Math.PI*2;
function shape(parent,geometry,material,x=0,y=0,z=0) {
  const mesh=new T.Mesh(geometry,material);
  mesh.position.set(x,y,z);
  parent.add(mesh);
  return mesh;
}

function line(parent,material,points,radius,segments=24) {
  const curve=new T.CatmullRomCurve3(points.map(point=>new T.Vector3(...point)));
  return shape(parent,new T.TubeGeometry(curve,segments,radius,8,false),material);
}

function scallop(parent,material,x,y,z,width,height,depth) {
  const shell=new T.SphereGeometry(1,24,14);
  const positions=shell.attributes.position;
  for(let i=0;i<positions.count;i++){
    const a=Math.atan2(positions.getX(i),positions.getZ(i));
    const ridge=.94+.06*Math.cos(a*10);
    positions.setX(i,positions.getX(i)*ridge);
    positions.setY(i,positions.getY(i)*ridge);
    positions.setZ(i,positions.getZ(i)*ridge);
  }
  shell.computeVertexNormals();
  const mesh=shape(parent,shell,material,x,y,z);
  mesh.scale.set(width,height,depth);
  return mesh;
}

export function buildHomeStations(scene,places,materials) {
  const region=new T.Group();
  region.name='Courtyard creature nook';
  scene.add(region);
  const {gold,wood}=materials;
  const peach=materials.nacre('#e6b7ad');
  const lilac=materials.nacre('#b89de5');
  const opal=materials.nacre('#71cfcf');
  const navy=materials.limestone('#4e456e');
  const velvet=materials.textile('#933f83');
  const fire=new T.MeshStandardMaterial({color:'#ffb386',emissive:'#ea643f',emissiveIntensity:1.1});
  const pearl=new T.MeshPhysicalMaterial({color:'#fff0da',roughness:.20,clearcoat:.86});
  const base=(position,name)=>{
    const group=new T.Group();
    group.name=name;
    group.position.set(position.x,.04,position.z);
    region.add(group);
    return group;
  };

  const kitchen=new T.Group();
  kitchen.name='Shell kitchen';
  kitchen.position.set(places.kitchen.x,.04,places.kitchen.z);
  scene.add(kitchen);
  shape(kitchen,new T.CylinderGeometry(.75,.87,.18,28),navy,0,.11,0).scale.set(1.18,1,.67);
  shape(kitchen,new T.CylinderGeometry(.66,.74,.66,28),wood,0,.47,0).scale.set(1.12,1,.58);
  shape(kitchen,new T.CylinderGeometry(.80,.73,.085,36),peach,0,.81,0).scale.set(1.15,1,.66);
  for(const x of [-.60,.60]){
    shape(kitchen,new T.CylinderGeometry(.035,.048,1.45,10),gold,x,.94,-.35);
  }
  line(kitchen,gold,[[-.70,1.55,-.35],[-.38,1.82,-.36],[0,1.86,-.36],[.38,1.82,-.36],[.70,1.55,-.35]],.031);
  shape(kitchen,new T.CylinderGeometry(.27,.26,.045,20),fire,-.33,.87,.04);
  const potProfile=[[.10,0],[.23,.03],[.26,.15],[.26,.24],[.21,.27],[.20,.20]]
      .map(([x,y])=>new T.Vector2(x,y));
  shape(kitchen,new T.LatheGeometry(potProfile,24),opal,-.34,.885,.04);
  shape(kitchen,new T.TorusGeometry(.23,.021,8,24),gold,-.34,1.139,.04).rotation.x=Math.PI/2;
  for(let i=0;i<3;i++){
    const x=.14+i*.18;
    scallop(kitchen,i%2===0?lilac:peach,x,.96,.015,.083,.113,.087);
    const spoon=shape(kitchen,new T.TorusGeometry(.07,.014,8,14),gold,x-.32,1.56,-.28);
    spoon.scale.set(.7,1.2,1);
  }

  const fitting=new T.Group();
  fitting.name='Pearl wardrobe';
  fitting.position.set(places.wardrobe.x,.04,places.wardrobe.z);
  fitting.rotation.y=.15;
  scene.add(fitting);
  shape(fitting,new T.CylinderGeometry(.74,.82,.13,28),lilac,0,.14,0).scale.z=.62;
  const mirror=shape(fitting,new T.SphereGeometry(1,32,20),opal,0,.99,-.09);
  mirror.scale.set(.51,.74,.082);
  const frame=shape(fitting,new T.TorusGeometry(1,.055,10,36),gold,0,.99,.014);
  frame.scale.set(.56,.79,1);
  for(const sign of [-1,1]){
    scallop(fitting,velvet,sign*.52,.93,-.08,.126,.74,.13).rotation.z=.15*sign;
    scallop(fitting,pearl,sign*.63,.25,.10,.095,.095,.095);
  }
  scallop(fitting,pearl,0,1.82,.015,.096,.115,.085);

  const nook=base(places.nook,'Shell creature nook');
  nook.rotation.y=.35;
  scallop(nook,navy,0,.11,0,.81,.14,.60);
  scallop(nook,velvet,0,.25,.10,.64,.21,.44);
  const hood=scallop(nook,lilac,0,.61,-.31,.73,.56,.14);
  hood.rotation.x=-.28;
  scallop(nook,pearl,.47,.31,.42,.105,.105,.105);
  scallop(nook,peach,-.52,.32,.39,.14,.09,.14);
  region.traverse(object=>{if(object.isMesh) object.receiveShadow=true;});
  return {region,wardrobe:fitting,kitchen};
}

function reefArch(parent,materials,x,z,scale) {
  const group=new T.Group();
  group.position.set(x,0,z);
  group.scale.setScalar(scale);
  parent.add(group);
  const points=[[-1.83,-.21,.04],[-1.60,.96,-.04],[-1.05,2.14,-.16],[-.31,2.91,-.13],[.73,2.70,.11],[1.44,1.88,.18],[1.85,.86,.10],[1.91,-.21,0]];
  const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));
  const frames=curve.computeFrenetFrames(36,false);
  const positions=[],color=[],indices=[],uvs=[];
  const ink=new T.Color('#182746'), indigo=new T.Color('#6559a0'), frost=new T.Color('#4fa4b2'), tint=new T.Color();
  const ring=12;
  for(let i=0;i<=36;i++){
    const f=i/36;
    const center=curve.getPointAt(f);
    const taper=.22+.29*Math.abs(2*f-1)**1.65+.055*Math.cos(f*27);
    for(let n=0;n<=ring;n++){
      const a=n/ring*full;
      const fluting=.86+.13*Math.cos(a*3+f*2.2)+.075*Math.sin(a*5-f*5);
      const r=taper*fluting;
      const vertex=center.clone().addScaledVector(frames.normals[i],Math.cos(a)*r)
        .addScaledVector(frames.binormals[i],Math.sin(a)*r*1.32);
      positions.push(...vertex.toArray());
      uvs.push(n/ring,f*4);
      const band=.5+.5*Math.sin(i*.91+n*.53);
      tint.copy(ink).lerp(indigo,.18+.52*band).lerp(frost,.31*fluting**3);
      color.push(...tint.toArray());
      if(i<36&&n<ring){
        const index=i*(ring+1)+n;
        indices.push(index,index+1,index+ring+1,index+1,index+ring+2,index+ring+1);
      }
    }
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new T.Float32BufferAttribute(color,3));
  geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const rock=shape(group,geometry,materials.basalt);
  rock.material.side=T.DoubleSide;
  rock.castShadow=true;
  rock.receiveShadow=true;
  const vein=new T.MeshStandardMaterial({color:'#8aadff',emissive:'#6496ff',emissiveIntensity:1.15,roughness:.35});
  for(const [start,end] of [[.06,.38],[.42,.62],[.67,.96]]){
    const trace=Array.from({length:11},(_,i)=>{
      const f=T.MathUtils.lerp(start,end,i/10);
      const p=curve.getPointAt(f);
      p.z+=.30+.29*Math.abs(2*f-1)**1.65;
      p.x+=Math.sin(f*21)*.11;
      return p.toArray();
    });
    line(group,vein,trace,.032,17);
  }
  return group;
}

export function buildGlassfin(scene,grotto,materials) {
  const region=new T.Group();
  region.name='Glassfin Grotto';
  scene.add(region);
  reefArch(region,materials,grotto.x+.07,grotto.z-.61,1);
  reefArch(region,materials,grotto.x+.48,grotto.z-2.02,1.15);
  const fire=new T.MeshPhysicalMaterial({
    color:'#6ac6ff',emissive:'#4164eb',emissiveIntensity:.7,metalness:.32,roughness:.27,clearcoat:.75
  });
  for(const [x,z,height] of [[grotto.x-2.48,grotto.z-1.9,2.7],[grotto.x+2.16,grotto.z-1.04,1.87],[grotto.x-.60,grotto.z-3.19,1.82]]){
    const crown=shape(region,new T.CylinderGeometry(.07,.34,height,6),materials.crystal,x,height*.47,z);
    crown.rotation.z=x<grotto.x?-.15:.20;
    shape(region,new T.ConeGeometry(.36,.41,6),fire,x-.10,height*.94+.11,z);
    for(const side of [-1,1]){
      const shard=shape(region,new T.CylinderGeometry(.02,.19,height*.55,5),fire,x+side*.36,height*.27,z+.22);
      shard.rotation.z=-side*.23;
    }
  }
  return region;
}

export function loadEnvironmentArt(scene,{home,wardrobe,kitchen,beds,crafted,landing},places,renderer,load) {
  const clock={mixer:null,duration:4};
  const imported={};
  const jobs=[];
  const paints=[];
  const attach=(key,file,install)=>{
    jobs.push(load('./environment/'+file).then(model=>{
      install(model);
      imported[key]=true;
    }).catch(()=>{
      imported[key]=false;
    }));
  };
  attach('waterfall cottage','waterfall-cottage.glb',({scene:asset,animations})=>{
    asset.name='Waterfall Shell Cottage';
    const scale=5.70;
    asset.scale.set(scale,7.45,scale);
    asset.position.set(places.cottage.x-.01745*scale,.061,places.cottage.z-.02650*scale-.12);
    asset.traverse(object=>{
      if(!object.isMesh||object.material.transparent) return;
      object.castShadow=true;
      object.receiveShadow=true;
      const material=object.material;
      material.envMapIntensity=.78;
      material.metalness*=.69;
      material.roughness*=.85;
      if(material.normalScale) material.normalScale.multiplyScalar(.76);
      if(material.specularColor) material.specularColor.multiplyScalar(.72);
    });
    scene.add(asset);
    home.visible=false;
    renderer.refreshShadows?.();
    if(animations[0]){
      clock.mixer=new T.AnimationMixer(asset);
      clock.duration=animations[0].duration;
      clock.mixer.clipAction(animations[0]).play();
      clock.mixer.update(0);
    }
  });
  attach('pearl wardrobe mirror','pearl-wardrobe.glb',({scene:asset})=>{
    asset.name='Pearl Wardrobe Mirror';
    // The decorated face of the supplied mirror points along its positive X axis.
    asset.rotation.y=-Math.PI/2;
    const bounds=new T.Box3().setFromObject(asset,true);
    const center=bounds.getCenter(new T.Vector3());
    const height=bounds.max.y-bounds.min.y;
    if(!Number.isFinite(height)||height<=0) throw new Error('Invalid wardrobe mirror bounds');
    const scale=1.94/height;
    asset.scale.setScalar(scale);
    asset.position.set(-center.x*scale,-bounds.min.y*scale-.025,-center.z*scale);
    asset.traverse(object=>{
      if(!object.isMesh) return;
      object.castShadow=true;
      object.receiveShadow=true;
    });
    wardrobe.clear();
    wardrobe.add(asset);
    renderer.refreshShadows?.();
  });

  function fitProp(placeholder,asset,name,rotation,scale,ground){
    asset.name=name;
    asset.rotation.y=rotation;
    asset.scale.set(...scale);
    const bounds=new T.Box3().setFromObject(asset,true);
    const center=bounds.getCenter(new T.Vector3());
    if(bounds.isEmpty()) throw new Error('Invalid landmark bounds');
    asset.position.set(-center.x,ground-bounds.min.y,-center.z);
    asset.traverse(object=>{
      if(!object.isMesh) return;
      object.castShadow=true;
      object.receiveShadow=true;
    });
    placeholder.clear();
    placeholder.add(asset);
    renderer.refreshShadows?.();
  }
  attach('pearl reef kitchen','pearl-reef-kitchen.glb',({scene:asset})=>{
    fitProp(kitchen,asset,'Pearl Reef Kitchen',0,[2,2,2],-.025);
  });
  attach('shell garden planters','shell-planter.glb',({scene:asset})=>{
    // The soil surface lands at the same height as the existing crop roots.
    for(const bed of beds) fitProp(bed,asset.clone(true),'Shell Garden Planter',-Math.PI/2,[1.44,.58,1.35],.014);
  });
  attach('jellyfish lantern','jelly-lantern.glb',({scene:asset})=>{
    fitProp(crafted,asset,'Jellyfish Lantern',-Math.PI/2,[.67,.67,.67],.014);
  });
  attach('pearl path landing','pearl-path-landing.glb',({scene:asset})=>{
    asset.traverse(object=>{
      if(!object.isMesh) return;
      object.material.roughness=Math.max(.42,object.material.roughness);
      object.material.metalness=Math.min(.42,object.material.metalness);
      object.material.specularColor?.multiplyScalar(.56);
      object.material.normalScale?.multiplyScalar(.73);
    });
    fitProp(landing,asset,'Pearl Path Landing',0,[1.91,.72,1.81],.006);
  });

  function cluster(file,key,placements,tint){
    attach(key,file,({scene:source})=>{
      source.updateMatrixWorld(true);
      const root=new T.Group();
      root.name=key;
      scene.add(root);
      const dummy=new T.Object3D();
      const matrix=new T.Matrix4();
      source.traverse(mesh=>{
        if(!mesh.isMesh) return;
        const material=mesh.material.clone();
        paints.push(material);
        material.color.multiply(new T.Color(tint));
        material.envMapIntensity=.86;
        if(material.emissiveIntensity>0) material.emissiveIntensity*=.66;
        for(const area of ['home','reef']){
          const spot=placements[area]??[];
          if(!spot.length) continue;
          const instances=new T.InstancedMesh(mesh.geometry,material,spot.length);
          instances.receiveShadow=true;
          spot.forEach(([x,y,z,scale,heading],index)=>{
            dummy.position.set(x,y,z);
            dummy.rotation.y=heading;
            dummy.scale.setScalar(scale);
            dummy.updateMatrix();
            instances.setMatrixAt(index,matrix.multiplyMatrices(dummy.matrix,mesh.matrixWorld));
          });
          instances.computeBoundingSphere();
          root.add(instances);
        }
      });
    });
  }
  cluster('shell.glb','Courtyard shells',{
    home:[[-15.8,.033,-.65,2.3,.11]]
  },'#f3c9e8');
  cluster('coral.glb','Coral fans',{
    reef:[[7.83,.03,-3.99,4.1,1.3],[10.85,.10,-6.03,5.4,-.28],[15.1,.04,2.2,3.7,.92],[18.13,.04,-3.47,3.5,-.40],[19.1,-.35,-5.3,4.55,.39]]
  },'#e6acee');
  cluster('crystals.glb','Moonlace crystal beds',{
    reef:[[9.91,.025,-5.15,2.25,.22],[12.5,.027,-5.20,2.82,1.37],[18.96,.03,-4.4,2.67,.82],[17.24,.03,1.45,2.25,.34],[10.07,-.36,3.55,2.66,-.83]]
  },'#aacaff');
  return {
    imported,
    ready:Promise.all(jobs),
    animate(time){if(clock.mixer) clock.mixer.setTime(time%clock.duration);},
    dispose(){for(const material of paints) material.dispose();}
  };
}

export function growCoastalCover(scene,clock) {
  const geometry=new T.PlaneGeometry(1,1,8,12);
  const position=geometry.attributes.position;
  const colors=[];
  const low=new T.Color('#20464a'), high=new T.Color('#c0eee1');
  const tune=new T.Color();
  for(let i=0;i<position.count;i++){
    const progress=position.getY(i)+.5;
    const flank=position.getX(i);
    const taper=.13+.87*Math.sin(Math.PI*progress)**.71;
    position.setXYZ(i,flank*taper+.43*progress**2,progress,
      (1-Math.abs(flank)*1.85)*.12*Math.sin(progress*Math.PI)+progress**1.6*.25);
    tune.copy(low).lerp(high,progress*.82+(1-Math.abs(flank)*2)*.18);
    colors.push(...tune.toArray());
  }
  geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();
  const plant=new T.MeshStandardMaterial({color:'#eee8ee',roughness:.58,vertexColors:true,side:T.DoubleSide});
  plant.onBeforeCompile=shader=>{
    shader.uniforms.reefPlantTime=clock;
    shader.vertexShader='uniform float reefPlantTime;\n'+shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      float phase=instanceMatrix[3].x*.71+instanceMatrix[3].z*.29;
      transformed.x+=sin(reefPlantTime*1.05+phase+position.y*.6)*position.y*position.y*.12;
      transformed.z+=cos(reefPlantTime*.76+phase)*position.y*position.y*.07;`
    );
  };
  const patches=[
    {base:'#60cbad',beds:[[-17.7,-1.2,.78],[-15.7,-1.3,.90],[-9.1,4.04,.54],[-7.8,-1.8,.68],[-18.5,5.4,.72],[-14.2,7.45,.59]]},
    {base:'#5ccbdf',beds:[[8.7,-4.5,.80],[10.9,-5.41,.71],[15.1,-5.42,.64],[18.17,-3.70,.80],[17.6,1.21,.73],[11.8,2.48,.67]]}
  ];
  const dummy=new T.Object3D();
  const colour=new T.Color();
  for(const {base,beds} of patches){
    const cover=new T.InstancedMesh(geometry,plant,beds.length*11);
    let instance=0;
    for(const [x,z,size] of beds){
      for(let n=0;n<11;n++){
        const angle=n*2.399963,spread=.11+.22*Math.sqrt(n);
        dummy.position.set(x+Math.cos(angle)*spread,.019,z+Math.sin(angle)*spread*.75);
        dummy.rotation.set(Math.cos(angle)*.19,angle,-.19+Math.sin(angle)*.45);
        dummy.scale.set(size*(.15+n%3*.025),size*(.41+n%4*.09),size);
        dummy.updateMatrix();
        cover.setMatrixAt(instance,dummy.matrix);
        colour.set(base).lerp(new T.Color(n%2===0?'#6b42a0':'#207581'),.21+n%3*.09);
        cover.setColorAt(instance++,colour);
      }
    }
    cover.name='Swaying perimeter sea grass';
    cover.receiveShadow=true;
    cover.computeBoundingSphere();
    scene.add(cover);
  }
}
