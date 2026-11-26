import * as T from './vendor/three.module.min.js';

const TAU = 2*Math.PI;
const UP = new T.Vector3(0,1,0);
const RIGHT = new T.Vector3(1,0,0);
const FORWARD = new T.Vector3(0,0,1);
const SIDES = ['L','R'];

function stepAt(phase, stance) {
  if(phase<stance) return {z:.5-phase/stance,lift:0};

  const swing=(phase-stance)/(1-stance);
  const smooth=swing*swing*(3-2*swing);
  // Match the contact speed on both ends before sweeping the leg forward.
  const tangent=-(1-stance)/stance;
  const join=swing*(1-swing)*(1-2*swing);
  return {z:-.5+smooth+tangent*join,lift:Math.sin(swing*Math.PI)**2};
}

function rotateLocally(entry, axis, angle) {
  if(!entry) return;
  const delta=new T.Quaternion().setFromAxisAngle(axis,angle);
  entry.bone.quaternion.multiply(entry.inverseWorld.clone().multiply(delta).multiply(entry.world));
}

function setWorldRotation(bone, world) {
  const parent=bone.parent.getWorldQuaternion(new T.Quaternion());
  bone.quaternion.copy(parent.invert().multiply(world));
}

function aimAt(bone, child, goal) {
  const start=bone.getWorldPosition(new T.Vector3());
  const axis=child.getWorldPosition(new T.Vector3()).sub(start).normalize();
  const target=goal.clone().sub(start).normalize();
  const delta=new T.Quaternion().setFromUnitVectors(axis,target);
  setWorldRotation(bone,delta.multiply(bone.getWorldQuaternion(new T.Quaternion())));
}

export function makeCookingClip(model) {
  const armJoints=['UpperArm','Forearm','Hand'];
  const joints=['Chest','Head',...SIDES.flatMap(side=>armJoints.map(part=>part+side))];
  const bones=new Map(joints.map(name=>[name,model.getObjectByName(name)]));
  if([...bones.values()].some(bone=>!bone?.isBone))return;
  const rest=new Map([...bones].map(([name,bone])=>[name,bone.quaternion.clone()]));
  const axes=new Map(['Chest','Head'].map(name=>[
    name,RIGHT.clone().applyQuaternion(bones.get(name).getWorldQuaternion(new T.Quaternion()).invert())
  ]));
  const tracks=new Map(joints.map(name=>[name,[]]));
  const times=[],duration=1.42,samples=24;
  const chest=bones.get('Chest'),head=bones.get('Head');
  const arms=SIDES.map(side=>{
    const [shoulder,elbow,hand]=armJoints.map(part=>bones.get(part+side));
    const start=shoulder.getWorldPosition(new T.Vector3());
    const middle=elbow.getWorldPosition(new T.Vector3());
    const end=hand.getWorldPosition(new T.Vector3());
    return {side,shoulder,elbow,hand,upper:start.distanceTo(middle),lower:middle.distanceTo(end)};
  });
  const reset=()=>{for(const [name,bone] of bones)bone.quaternion.copy(rest.get(name));};
  for(let frame=0;frame<=samples;frame++){
    const phase=frame/samples*TAU;
    reset();
    chest.quaternion.multiply(new T.Quaternion().setFromAxisAngle(axes.get('Chest'),.11+.035*Math.cos(phase)));
    head.quaternion.multiply(new T.Quaternion().setFromAxisAngle(axes.get('Head'),.16+.065*Math.sin(phase)));
    const centerX=chest.getWorldPosition(new T.Vector3()).x;
    for(const {side,shoulder,elbow,hand,upper,lower} of arms){
      const start=shoulder.getWorldPosition(new T.Vector3());
      const sideSign=Math.sign(start.x-centerX);
      const length=upper+lower;
      const stir=side==='L';
      const reach=stir
        ?new T.Vector3(-sideSign*.43+.22*Math.cos(phase),-.40+.055*Math.sin(phase),.73+.12*Math.sin(phase))
        :new T.Vector3(-sideSign*.21,-.59,.64);
      const distance=Math.min(reach.length()*length,length-.001);
      const axis=reach.normalize();
      const pole=new T.Vector3(.62*sideSign,-1,-.12);
      pole.addScaledVector(axis,-pole.dot(axis)).normalize();
      const along=(upper**2-lower**2+distance**2)/(2*distance);
      const bend=Math.sqrt(Math.max(0,upper**2-along**2));
      aimAt(shoulder,elbow,start.clone().addScaledVector(axis,along).addScaledVector(pole,bend));
      aimAt(elbow,hand,start.addScaledVector(axis,distance));
      if(stir)hand.quaternion.multiply(new T.Quaternion().setFromAxisAngle(UP,.17*Math.sin(phase)));
    }
    times.push(frame/samples*duration);
    for(const [name,bone] of bones)tracks.get(name).push(...bone.quaternion.toArray());
  }
  reset();
  model.updateMatrixWorld(true);
  return new T.AnimationClip('Cooking',duration,[...tracks].map(([name,values])=>
    new T.QuaternionKeyframeTrack(name+'.quaternion',times,values)));
}

function legAtPose(leg, phase, settings) {
  const {thigh,shin,foot}=leg;
  const {z,lift}=stepAt(phase,settings.stance);
  const ankle=leg.ankle.clone().add(new T.Vector3(0,lift*settings.lift,z*settings.stride));
  const hip=thigh.getWorldPosition(new T.Vector3());
  const axis=ankle.clone().sub(hip);
  const distance=T.MathUtils.clamp(axis.length(),.001,leg.upper+leg.lower-.0001);
  axis.normalize();
  const pole=leg.pole.clone().addScaledVector(axis,-leg.pole.dot(axis)).normalize();
  const forward=(leg.upper**2-leg.lower**2+distance**2)/(2*distance);
  const bend=Math.sqrt(Math.max(0,leg.upper**2-forward**2));
  const knee=hip.clone().addScaledVector(axis,forward).addScaledVector(pole,bend);
  aimAt(thigh,shin,knee);
  aimAt(shin,foot,ankle);
  const liftRotation=new T.Quaternion().setFromAxisAngle(RIGHT,-lift*.18);
  setWorldRotation(foot,liftRotation.multiply(leg.rotation));
}

export function makeReefGaits(model,height,restrictedStride) {
  const bones=new Map();
  model.updateMatrixWorld(true);
  model.traverse(node=>{
    if(!node.isBone) return;
    const world=node.getWorldQuaternion(new T.Quaternion());
    bones.set(node.name,{bone:node,world,inverseWorld:world.clone().invert(),
      position:node.position.clone(),rotation:node.quaternion.clone()});
  });
  const root=bones.get('Root');
  if(!root||SIDES.some(side=>['Thigh','Shin','Foot'].some(part=>!bones.has(part+side)))) return [];
  const rootSpace=new T.Matrix3().setFromMatrix4(root.bone.parent.matrixWorld).invert();

  const legs=SIDES.map(side=>{
    const thigh=bones.get('Thigh'+side).bone;
    const shin=bones.get('Shin'+side).bone;
    const foot=bones.get('Foot'+side).bone;
    const hip=thigh.getWorldPosition(new T.Vector3());
    const knee=shin.getWorldPosition(new T.Vector3());
    const ankle=foot.getWorldPosition(new T.Vector3());
    const axis=ankle.clone().sub(hip).normalize();
    const pole=FORWARD.clone().addScaledVector(axis,-FORWARD.dot(axis)).normalize();
    return {side,thigh,shin,foot,ankle,pole,upper:hip.distanceTo(knee),lower:knee.distanceTo(ankle),
      rotation:foot.getWorldQuaternion(new T.Quaternion())};
  });

  function reset() {
    for(const {bone,position,rotation} of bones.values()){
      bone.position.copy(position);
      bone.quaternion.copy(rotation);
    }
    model.updateMatrixWorld(true);
  }

  function makeClip(name,duration,settings) {
    const times=[],rootPositions=[];
    const rotations=new Map([...bones.keys()].map(name=>[name,[]]));
    const samples=48;
    for(let frame=0;frame<=samples;frame++){
      const cycle=frame%samples/samples;
      const phase=cycle*TAU;
      reset();
      const dip=height*(-settings.crouch+settings.bounce*(.5-.5*Math.cos(phase*2)));
      root.bone.position.add(new T.Vector3(height*.008*Math.sin(phase),dip,0).applyMatrix3(rootSpace));
      const lean=settings.lean;
      rotateLocally(bones.get('Hips'),UP,.056*Math.cos(phase));
      rotateLocally(bones.get('Spine'),RIGHT,lean*.64);
      rotateLocally(bones.get('Chest'),RIGHT,lean*.36);
      rotateLocally(bones.get('Chest'),UP,-.080*Math.cos(phase-.19));
      rotateLocally(bones.get('Head'),RIGHT,-lean*.64);
      rotateLocally(bones.get('Head'),UP,.042*Math.cos(phase-.28));
      rotateLocally(bones.get('DrapeUpper'),RIGHT,-lean*.85);
      rotateLocally(bones.get('DrapeLower'),RIGHT,-lean*.50+.055*Math.sin(phase-.47));
      for(const [index,leg] of legs.entries()){
        const p=(cycle+index*.5)%1;
        const arm=p*TAU;
        const side=leg.side;
        const sign=index===0?1:-1;
        rotateLocally(bones.get('UpperArm'+side),RIGHT,settings.arm*Math.cos(arm-.15));
        rotateLocally(bones.get('Forearm'+side),RIGHT,-settings.elbow+.069*Math.cos(arm-.55));
        rotateLocally(bones.get('Hand'+side),RIGHT,.045*Math.cos(arm-.79));
        rotateLocally(bones.get('WingUpper'+side),UP,sign*.042*Math.sin(phase*2-.1));
        rotateLocally(bones.get('WingLower'+side),UP,sign*.037*Math.sin(phase*2-.58));
        legAtPose(leg,p,settings);
      }
      times.push(frame/samples*duration);
      rootPositions.push(...root.bone.position.toArray());
      for(const [name,entry] of bones) rotations.get(name).push(...entry.bone.quaternion.toArray());
    }
    reset();
    const tracks=[new T.VectorKeyframeTrack('Root.position',times,rootPositions)];
    for(const [bone,values] of rotations){
      tracks.push(new T.QuaternionKeyframeTrack(bone+'.quaternion',times,values));
    }
    return new T.AnimationClip(name,duration,tracks);
  }

  const short=restrictedStride?.82:1;
  return [
    makeClip('Walk',1.24,{stride:height*.226*short,stance:.60,lift:height*.051,
      crouch:.024,bounce:.011,arm:.28,elbow:.16,lean:.027}),
    makeClip('Run',.86,{stride:height*.323*short,stance:.492,lift:height*.101,
      crouch:.035,bounce:.016,arm:.47,elbow:.51,lean:.096})
  ];
}
