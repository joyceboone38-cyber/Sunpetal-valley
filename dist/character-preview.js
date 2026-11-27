import * as T from './vendor/three.module.min.js';
import { GLTFLoader } from './vendor/three-addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from './vendor/three-addons/libs/meshopt_decoder.module.js';
import { createReef } from './reef-scene.js';
import { reefLayout } from './reef-layout.js';
import { prepareCharacterFinish } from './character-finish.js';
import { makeReefGaits } from './character-gait.js';
import { prepareCharacterExpression } from './character-expression.js';

const models = [
  ['Sea-Fairy', 'Sea Fairy']
];
const canvas = document.querySelector('#preview');
const status = document.querySelector('#status');
const title = document.querySelector('#model-title');
const clips = document.querySelector('#animation');
const pause = document.querySelector('#play');
const replay = document.querySelector('#restart');
const modelList = document.querySelector('#model-list');
const cameras = [...document.querySelectorAll('[data-distance]')];
const materialChoices = [...document.querySelectorAll('[data-finish]')];
const review = { actor: new T.Group(), closeUp: false, faceView: false, eyeHeight: 1.15 };
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const cache = new Map();
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const player = { x:-11.38, z:1.00, heading:.18, vx:0, vz:0 };
const order = ['Idle','Walk','Run','Wave','Wing Hover','Wing Glide','Cast'];

let reef;
try {
  reef = createReef(canvas, { ...reefLayout, characterReview: review });
} catch(error) {
  console.error(error);
  status.textContent = 'This device could not open the 3D preview.';
}

let request = 0;
let mixer;
let activeAction;
let animations = [];
let playing = !reduceMotion;
let useSofterFinish = true;
let setActiveFinish;
let expression;
let expressionTime = 0;
let movement = 0;
const runningActions = new Set();
let transition;

function setPlaying(value) {
  playing = value;
  pause.textContent = value ? 'Pause' : 'Play';
  pause.setAttribute('aria-pressed', String(value));
}

function playClip(restart = false) {
  if(!mixer) return;
  const animation = animations.find(clip => clip.name === clips.value);
  const next = mixer.clipAction(animation);
  if (restart || !playing || !activeAction) {
    mixer.stopAllAction();
    runningActions.clear();
    transition = undefined;
    next.reset().setEffectiveWeight(1).play();
    runningActions.add(next);
    activeAction = next;
    mixer.update(0);
    return;
  }
  if(next === activeAction) return;

  const previousClip = activeAction.getClip();
  const locomotion = name => name==='Walk'||name==='Run';
  const startsNew = !runningActions.has(next);
  if(startsNew){
    next.reset().setEffectiveWeight(0).play();
    if(locomotion(previousClip.name)&&locomotion(animation.name)){
      next.time = animation.duration*(activeAction.time/previousClip.duration);
    }
    runningActions.add(next);
  }
  transition = {
    elapsed:0,
    entries:[...runningActions].map(action=>({action,weight:action.getEffectiveWeight()}))
  };
  activeAction = next;
}

function advanceAnimation(dt) {
  if(transition){
    transition.elapsed+=dt;
    const progress = T.MathUtils.smoothstep(transition.elapsed,0,.24);
    for(const {action,weight} of transition.entries){
      action.setEffectiveWeight(T.MathUtils.lerp(weight,action===activeAction?1:0,progress));
    }
    if(progress===1){
      for(const action of runningActions) if(action!==activeAction){
        action.stop();
        runningActions.delete(action);
      }
      transition=undefined;
    }
  }
  mixer?.update(dt);
  const target = clips.value==='Run' ? 1 : clips.value==='Walk' ? .64 : .15;
  movement = T.MathUtils.lerp(movement,target,1-Math.exp(-dt*5));
  expressionTime+=dt;
  expression?.update(expressionTime,movement);
}

function fetchModel(id) {
  if(!cache.has(id)) {
    const pending = loader.loadAsync('./characters/'+id+'.glb').then(gltf => {
      const mesh = gltf.scene;
      mesh.updateMatrixWorld(true);
      const bounds = new T.Box3().setFromObject(mesh,true);
      const center = bounds.getCenter(new T.Vector3());
      const height = bounds.max.y-bounds.min.y;
      if(!Number.isFinite(height)||height<=0) throw new Error('Invalid model height');
      const gaits = makeReefGaits(mesh,height,id==='Tideglass-Witch'||id==='Starwing-Fairy');
      const animationNames = new Set(gaits.map(clip=>clip.name));
      const expression = prepareCharacterExpression(mesh,id);
      const eyeHeight = .084+1.25*((expression.eyeHeight??(bounds.min.y+height*.86))-bounds.min.y)/height;
      mesh.position.set(-center.x,-bounds.min.y,-center.z);
      const model = new T.Group();
      model.scale.setScalar(1.25/height);
      model.add(mesh);
      const animations = gltf.animations.filter(clip=>!animationNames.has(clip.name)).concat(gaits);
      return {model,animations,expression,eyeHeight,setFinish:prepareCharacterFinish(model)};
    }).catch(error => {
      cache.delete(id);
      throw error;
    });
    cache.set(id,pending);
  }
  return cache.get(id);
}

async function selectModel(id,name) {
  if(!reef) return;
  const sequence = ++request;
  title.textContent = name;
  status.textContent = 'Loading '+name+'…';
  status.hidden = false;
  clips.disabled = pause.disabled = replay.disabled = true;
  for(const button of modelList.children) button.setAttribute('aria-pressed',String(button.dataset.model===id));
  try {
    const result = await fetchModel(id);
    if(sequence!==request) return;
    mixer?.stopAllAction();
    review.actor.clear();
    review.actor.add(result.model);
    setActiveFinish = result.setFinish;
    setActiveFinish(useSofterFinish);
    mixer = new T.AnimationMixer(result.model);
    activeAction = undefined;
    runningActions.clear();
    transition = undefined;
    expression = result.expression;
    expressionTime = 0;
    movement = 0;
    review.eyeHeight = result.eyeHeight;
    expression.update(0,0);
    animations = result.animations;
    const selection = new Set(animations.map(clip => clip.name));
    clips.replaceChildren(...order.filter(name => selection.has(name)).map(name => new Option(name,name)));
    clips.disabled = pause.disabled = replay.disabled = false;
    setPlaying(playing);
    playClip();
    status.hidden = true;
  } catch(error) {
    if(sequence!==request) return;
    console.error(error);
    status.textContent = 'Could not load '+name+'. Select it again to retry.';
  }
}

for(const [id,name] of models) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'model';
  button.dataset.model = id;
  button.setAttribute('aria-pressed','false');
  const image = document.createElement('img');
  image.src = './characters/'+id+'.webp';
  image.alt = '';
  const label = document.createElement('span');
  label.textContent = name;
  button.append(image,label);
  button.addEventListener('click',()=>selectModel(id,name));
  modelList.append(button);
}

for(const button of cameras) button.addEventListener('click',()=>{
  review.closeUp = button.dataset.distance==='close';
  review.faceView = button.dataset.distance==='face';
  for(const choice of cameras) choice.setAttribute('aria-pressed',String(button===choice));
});
for(const button of materialChoices) button.addEventListener('click',()=>{
  useSofterFinish = button.dataset.finish==='softer';
  setActiveFinish?.(useSofterFinish);
  for(const choice of materialChoices) choice.setAttribute('aria-pressed',String(button===choice));
});
clips.addEventListener('change',()=>playClip());
pause.addEventListener('click',()=>setPlaying(!playing));
replay.addEventListener('click',()=>{
  playClip(true);
  setPlaying(true);
});
document.querySelector('#turn-left').addEventListener('click',()=>{player.heading-=Math.PI/4;});
document.querySelector('#turn-right').addEventListener('click',()=>{player.heading+=Math.PI/4;});

let drag;
canvas.addEventListener('pointerdown',event=>{
  if(!event.isPrimary||event.button!==0) return;
  drag={pointer:event.pointerId,x:event.clientX};
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove',event=>{
  if(drag?.pointer!==event.pointerId) return;
  player.heading+=(event.clientX-drag.x)*.012;
  drag.x=event.clientX;
});
canvas.addEventListener('lostpointercapture',()=>{drag=undefined;});

if(reef) {
  selectModel(...models[0]);
  let previous = performance.now();
  function frame(now) {
    const elapsed = Math.min(.14,(now-previous)/1000);
    const dt = Math.min(.052,elapsed);
    previous = now;
    if(playing) advanceAnimation(elapsed);
    reef.render({player,quest:null,step:12,dt,time:now/1000,display:-1,current:false,reduceMotion});
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
