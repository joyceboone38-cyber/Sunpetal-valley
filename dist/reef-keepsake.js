import * as T from './vendor/three.module.min.js';

function addMesh(parent, geometry, material, x=0,y=0,z=0){
  const mesh=new T.Mesh(geometry,material);
  mesh.position.set(x,y,z);
  parent.add(mesh);
  return mesh;
}

export function buildMoonlacePearl(){
  const shell=new T.Group();
  shell.name='Moonlace Pearl';
  const nacre=new T.MeshPhysicalMaterial({
    color:'#b49be9',roughness:.42,metalness:.24,clearcoat:.62,
    iridescence:.58,iridescenceIOR:1.33,side:T.DoubleSide
  });
  const positions=[],indices=[];
  const ribs=32,layers=10;
  for(let row=0;row<=layers;row++){
    const r=row/layers;
    for(let i=0;i<=ribs;i++){
      const angle=(i/ribs-.5)*2.59;
      const ripple=Math.cos(i/ribs*12*Math.PI)*r**1.25;
      positions.push(Math.sin(angle)*r*(.35+.014*ripple),
        r*(.056+ripple*.019),Math.cos(angle)*r*(.43+ripple*.021));
      if(row<layers&&i<ribs){
        const p=row*(ribs+1)+i;
        indices.push(p,p+1,p+ribs+1,p+1,p+ribs+2,p+ribs+1);
      }
    }
  }
  const fan=new T.BufferGeometry();
  fan.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  fan.setIndex(indices);
  fan.computeVertexNormals();
  addMesh(shell,fan,nacre,0,.055,-.18).receiveShadow=true;
  const lid=addMesh(shell,fan,nacre,0,.066,-.18);
  lid.rotation.x=-1.20;
  const pearl=new T.MeshPhysicalMaterial({
    color:'#cff8ff',emissive:'#377b9f',emissiveIntensity:.68,
    metalness:.12,roughness:.19,clearcoat:1,iridescence:.62
  });
  const core=addMesh(shell,new T.SphereGeometry(.113,20,14),pearl,0,.26,.055);
  const rim=addMesh(shell,new T.TorusGeometry(.146,.011,8,32),
    new T.MeshStandardMaterial({color:'#b9eeff',emissive:'#307a99',emissiveIntensity:1.1}),0,.145,.055);
  rim.rotation.x=-Math.PI/2;
  return {
    shell,
    animate(time){
      core.position.y=.255+Math.sin(time*2.1)*.036;
      pearl.emissiveIntensity=.65+.18*Math.sin(time*2.1);
    }
  };
}

export function buildMoonlaceCharm(){
  const charm=new T.Group();
  charm.name='Moonlace Charm';
  charm.scale.setScalar(.82);
  const rim=new T.MeshPhysicalMaterial({color:'#f9bd79',metalness:.61,roughness:.30,clearcoat:.55});
  const pearl=new T.MeshPhysicalMaterial({
    color:'#d6f9ff',emissive:'#427394',emissiveIntensity:.56,
    metalness:.17,roughness:.19,clearcoat:.88,iridescence:.55
  });
  const blush=new T.MeshStandardMaterial({color:'#eda9e3',metalness:.22,roughness:.37});
  addMesh(charm,new T.TorusGeometry(.064,.008,8,32),rim);
  addMesh(charm,new T.SphereGeometry(.048,16,12),pearl,0,0,.012).scale.set(1,1,.72);
  addMesh(charm,new T.TorusGeometry(.022,.006,6,18),rim,0,.077,.001);
  const faceted=new T.OctahedronGeometry(.024);
  addMesh(charm,faceted,blush,0,-.081,.006).scale.y=1.17;
  addMesh(charm,faceted,rim,-.058,.028,.006).scale.setScalar(.61);
  addMesh(charm,faceted,rim,.058,.028,.006).scale.setScalar(.61);
  return charm;
}
