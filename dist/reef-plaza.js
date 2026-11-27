import * as T from './vendor/three.module.min.js';
import { loadReefModel } from './reef-model-loader.js';
import { plazaFrame } from './reef-plaza-floor.js';

// The Underwater Plaza: Joyce's Meshy town of floating islands, bridges and a shell fountain.
// The model carries a _MOTION attribute, so terrain-motion.js animates its waterfalls, pools,
// coral and bubbles. It replaces the old Homebase island and the channel up to Moonlace Reef.
export function buildPlaza(scene) {
  const group=new T.Group();
  group.name='Underwater Plaza';
  group.position.set(plazaFrame.x,plazaFrame.y,plazaFrame.z);
  group.scale.setScalar(plazaFrame.scale);
  scene.add(group);
  const state={life:null,viewHeight:800,loaded:false};

  loadReefModel('./environment/underwater-plaza.glb').then(async({scene:model})=>{
    model.name='Underwater Plaza model';
    group.add(model);
    state.loaded=true;
    try{
      const {animateTerrain}=await import('./terrain-motion.js');
      state.life=animateTerrain(model);
      state.life.setViewHeight(state.viewHeight);
    }catch(error){
      // The plaza still shows without its motion.
    }
  }).catch(()=>{});

  return {
    group,
    tick(time){state.life?.update(time);},
    setViewHeight(pixels){
      state.viewHeight=pixels;
      state.life?.setViewHeight(pixels);
    },
    get loaded(){return state.loaded;}
  };
}
