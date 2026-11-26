import * as T from './vendor/three.module.min.js';

export function createRegionalArt(scene, load, time, fallbacks, renderer) {
  const regions=new Map();
  const imported={};
  const paints=new Set();
  const mint='#80e4cb',rose='#f29bd4',violet='#c59df3',slate='#a2a9e6';
  const copies=(entries)=>entries.map(({position,scale,yaw})=>[...position,yaw,scale]);
  const byArea={
    home:[
      {asset:'coral',tint:rose,roughness:.63,spots:copies(fallbacks.coral.home),remove:fallbacks.coral.home},
      {asset:'kelp',tint:mint,roughness:.67,spots:copies(fallbacks.kelp.home),remove:fallbacks.kelp.home}
    ],
    reef:[
      {asset:'coral',tint:violet,roughness:.59,spots:copies(fallbacks.coral.reef),remove:fallbacks.coral.reef},
      {asset:'kelp',tint:'#6ccce6',roughness:.63,spots:copies(fallbacks.kelp.reef),remove:fallbacks.kelp.reef},
      {asset:'geode',tint:violet,roughness:.38,spots:copies(fallbacks.geodes),remove:fallbacks.geodes},
      {asset:'glowlog',tint:violet,roughness:.78,spots:copies(fallbacks.glowlogs),remove:fallbacks.glowlogs},
      {asset:'pebbles',tint:slate,roughness:.81,spots:[[8.7,.013,-3.21,.56,[.51,.75,.51]],
        [12.84,.014,-5.39,1.1,[.53,.72,.53]],[17.44,.014,1.4,-.4,[.62,.77,.62]]]},
      {asset:'cave',tint:slate,roughness:.92,spots:[[18,-2.5,-22,.06,[1.78,1.77,1.49]]],remove:fallbacks.caves},
      {asset:'rockarch',tint:violet,roughness:.84,spots:[[.5,-2.2,-29,-.16,[2.23,2.25,1.62]]],remove:fallbacks.arches},
      {asset:'rocks',tint:slate,roughness:.85,spots:copies(fallbacks.rocks),remove:fallbacks.rocks}
    ]
  };
  const orientation=new T.Object3D();

  function paint(original,spec,source) {
    const material=original.clone();
    paints.add(material);
    material.color.multiply(new T.Color('#ffffff').lerp(new T.Color(spec.tint),.31));
    material.roughness=spec.roughness;
    material.metalness=spec.asset==='geode'?.31:.025;
    if(material.normalScale) material.normalScale.multiplyScalar(.78);
    if(spec.asset==='geode'){
      material.emissive.set('#473075');
      material.emissiveIntensity=.13;
    }
    const mushroomCap=spec.asset==='glowlog'&&/cap/.test(source.name);
    if(mushroomCap){
      material.emissive.set('#8864e8');
      material.emissiveIntensity=.42;
    }
    const rock=spec.asset==='cave'||spec.asset==='rocks'||spec.asset==='rockarch';
    if(rock||spec.asset==='glowlog'&&!mushroomCap){
      const grade=rock?`
        float algae=smoothstep(.008,.27,c.g-max(c.r,c.b));
        vec3 stone=mix(vec3(.026,.055,.13),vec3(.110,.166,.260),grain);
        vec3 growth=mix(vec3(.033,.103,.132),vec3(.093,.231,.242),grain);
        diffuseColor.rgb=mix(stone,growth,algae*.72)*.88+c*.12;
      `:`
        vec3 base=mix(vec3(.044,.053,.113),vec3(.22,.134,.285),grain);
        diffuseColor.rgb=mix(base,c,.19);
      `;
      material.onBeforeCompile=shader=>{
        shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`
          #include <color_fragment>
          vec3 c=diffuseColor.rgb;
          float grain=clamp(dot(c,vec3(.2126,.7152,.0722)),0.,1.);
          ${grade}
        `);
      };
      material.customProgramCacheKey=()=>rock?'sunpetal-reef-rock-tone':'sunpetal-moonlace-fungus';
    }
    if(spec.asset==='kelp'){
      source.geometry.computeBoundingBox();
      const {min,max}=source.geometry.boundingBox;
      const stemRange=new T.Vector2(min.y,max.y);
      material.onBeforeCompile=shader=>{
        shader.uniforms.sunpetalKelpTime=time;
        shader.uniforms.sunpetalKelpRange={value:stemRange};
        shader.vertexShader='uniform float sunpetalKelpTime;\nuniform vec2 sunpetalKelpRange;\n'+shader.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          float stem=smoothstep(sunpetalKelpRange.x,sunpetalKelpRange.y,position.y);
          float phase=instanceMatrix[3].x*.81+instanceMatrix[3].z*.42;
          transformed.x+=sin(sunpetalKelpTime*1.22+phase-position.y*1.7)*stem*stem*.087;
          transformed.z+=cos(sunpetalKelpTime*.94+phase-position.y*.8)*stem*stem*.052;`
        );
      };
    }
    return material;
  }

  function place(region,spec,{scene:source}){
    source.updateMatrixWorld(true);
    const bounds=new T.Box3().setFromObject(source,true);
    const center=bounds.getCenter(new T.Vector3());
    if(bounds.isEmpty()) throw new Error('Missing mesh bounds');
    const moved=new T.Matrix4().makeTranslation(-center.x,-bounds.min.y,-center.z);
    const group=new T.Group();
    group.name=region+' · '+spec.asset;
    source.traverse(node=>{
      if(!node.isMesh)return;
      const variants=Array.isArray(node.material)?node.material.map(mat=>paint(mat,spec,node)):paint(node.material,spec,node);
      const batch=new T.InstancedMesh(node.geometry,variants,spec.spots.length);
      const base=new T.Matrix4().multiplyMatrices(moved,node.matrixWorld);
      const placement=new T.Matrix4();
      spec.spots.forEach(([x,y,z,yaw,scale],index)=>{
        orientation.position.set(x,y,z);
        orientation.rotation.y=yaw;
        orientation.scale.set(...scale);
        orientation.updateMatrix();
        batch.setMatrixAt(index,placement.multiplyMatrices(orientation.matrix,base));
      });
      batch.computeBoundingSphere();
      batch.boundingSphere.radius+=spec.asset==='kelp'?.3:0;
      batch.receiveShadow=true;
      group.add(batch);
    });
    if(!group.children.length) throw new Error('No renderable prop meshes');
    scene.add(group);
    for(const fallback of spec.remove??[]) fallback.object.visible=false;
    renderer.refreshShadows?.();
    return spec.spots.length;
  }

  let disposed=false;
  function ensure(region){
    if(disposed||!byArea[region])return Promise.resolve();
    if(!regions.has(region)){
      const jobs=byArea[region].filter(spec=>spec.spots.length).map(spec=>{
        const folder=spec.asset==='coral'?'./environment/':'./environment/grab3d/';
        const label=region+' '+spec.asset;
        return load(folder+spec.asset+'.glb').then(asset=>{
          if(!disposed) imported[label]=place(region,spec,asset);
        }).catch(()=>{if(!disposed) imported[label]=false;});
      });
      regions.set(region,Promise.all(jobs));
    }
    return regions.get(region);
  }

  return {
    ensure,imported,
    dispose(){
      disposed=true;
      for(const material of paints) material.dispose();
      paints.clear();
    }
  };
}
