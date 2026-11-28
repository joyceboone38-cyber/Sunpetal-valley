import * as T from './vendor/three.module.min.js';
import { loadReefModel } from './reef-model-loader.js';
import { plazaFrame } from './reef-plaza-floor.js';

// The Underwater Plaza: Joyce's Meshy town of floating islands, bridges and a shell fountain.
// The model carries a _MOTION attribute, so terrain-motion.js animates its waterfalls, pools,
// coral and bubbles. It replaces the old Homebase island and the channel up to Moonlace Reef.
// The plaza's colours are baked into the mesh (no texture to smear), so the floors get their
// fine detail here: pearl tile seams, a soft tile-to-tile tint and a slow shimmer. Only still,
// up-facing, light stone gets it. Water, coral and rock keep the baked colours.
function addPearlDetail(model) {
  model.traverse(object=>{
    if(!object.isMesh) return;
    const previous=object.material.onBeforeCompile;
    object.material.onBeforeCompile=(shader,renderer)=>{
      previous?.call(object.material,shader,renderer);
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        {
          float upFace=smoothstep(.62,.86,normalize(vTerrainNormal).y);
          float lightStone=smoothstep(.16,.30,dot(diffuseColor.rgb,vec3(.2126,.7152,.0722)));
          float still=1.-step(.5,vTerrainKind);
          float mask=upFace*lightStone*still;
          vec2 q=vTerrainLocal.xz/.04;
          float row=floor(q.y);
          q.x+=row*.5;
          vec2 f=fract(q), cell=floor(q);
          vec2 w=fwidth(q)*1.4+.001;
          vec2 edge=min(f,1.-f);
          float seam=1.-smoothstep(0.,1.,min(edge.x/(.07+w.x),edge.y/(.07+w.y)));
          float h=fract(sin(dot(cell+row,vec2(12.9898,78.233)))*43758.5453);
          float fade=1.-smoothstep(.5,1.4,max(w.x,w.y));
          diffuseColor.rgb*=1.+mask*((h-.5)*.08-seam*.17*fade);
          diffuseColor.rgb+=mask*seam*.02*fade*vec3(1.,.85,.6);
        }`);
    };
    object.material.customProgramCacheKey=()=>'sunpetal-terrain-pearl';
    object.material.needsUpdate=true;
  });
}

export function buildPlaza(scene) {
  const group=new T.Group();
  group.name='Underwater Plaza';
  group.position.set(plazaFrame.x,plazaFrame.y,plazaFrame.z);
  group.scale.setScalar(plazaFrame.scale);
  scene.add(group);
  const state={life:null,viewHeight:800,loaded:false};

  // The town loads the first time Joyce leaves her Homebase, so the game starts light.
  let requested=false;
  const load=()=>{
    if(requested)return;
    requested=true;
    loadReefModel('./environment/underwater-plaza.glb').then(async({scene:model})=>{
    model.name='Underwater Plaza model';
    group.add(model);
    state.loaded=true;
    try{
      const {animateTerrain}=await import('./terrain-motion.js');
      state.life=animateTerrain(model);
      addPearlDetail(model);
      state.life.setViewHeight(state.viewHeight);
    }catch(error){
      // The plaza still shows without its motion.
    }
    }).catch(()=>{});
  };

  return {
    ensureLoaded:load,
    group,
    tick(time){state.life?.update(time);},
    setViewHeight(pixels){
      state.viewHeight=pixels;
      state.life?.setViewHeight(pixels);
    },
    get loaded(){return state.loaded;}
  };
}
