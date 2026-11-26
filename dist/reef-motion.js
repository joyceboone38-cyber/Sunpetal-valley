// Pure motion helpers for the avatar and Luma. No Three.js in this file, so the
// maths can be tested on its own and nothing here can break model loading.

const clamp=(value,low,high)=>Math.max(low,Math.min(high,value));
const damp=(rate,dt)=>1-Math.exp(-rate*dt);
const wrap=angle=>Math.atan2(Math.sin(angle),Math.cos(angle));
const TAU=Math.PI*2;

const neutral=()=>({pitch:0,roll:0,sx:1,sy:1,sz:1,lift:0});

// Extra body motion layered on top of the existing swim, walk and idle clips.
export function createSwimMotion() {
  let prevSpeed=0,prevHeading,turnRate=0,roll=0,stretch=0,kick=0,settle=0,wasMoving=false,reaction=null;
  return {
    react(kind) {
      reaction={kind,age:0,length:kind==='taste'?1.25:.8};
    },
    step(dt,{speed=0,heading=0,moving=false,inWater=false,reduced=false}={}) {
      dt=clamp(dt,0,.1);
      if(prevHeading===undefined)prevHeading=heading;
      if(reduced||dt<=0){
        prevSpeed=speed;
        prevHeading=heading;
        wasMoving=moving;
        if(reduced)reaction=null;
        return neutral();
      }
      const accel=(speed-prevSpeed)/Math.max(dt,.001);
      prevSpeed=speed;
      stretch+=(clamp(accel*.012,-.05,.09)-stretch)*damp(9,dt);
      const headingRate=wrap(heading-prevHeading)/Math.max(dt,.001);
      prevHeading=heading;
      turnRate+=(clamp(headingRate,-7,7)-turnRate)*damp(8,dt);
      // Lean into the turn. A left turn raises heading, and a negative roll dips the left side.
      const rollTarget=moving?clamp(-turnRate*.045,-.32,.32):0;
      roll+=(rollTarget-roll)*damp(7,dt);
      if(moving&&!wasMoving&&inWater)kick=1;
      if(!moving&&wasMoving)settle=1;
      wasMoving=moving;
      kick=Math.max(0,kick-dt*4);
      settle=Math.max(0,settle-dt*1.4);

      const out=neutral();
      out.pitch=-.11*kick*kick;
      out.roll=roll;
      const squash=inWater?stretch:stretch*.3;
      out.sz=1+squash;
      out.sx=out.sy=1-squash*.5;
      out.lift=Math.sin(settle*9)*.025*settle;

      if(reaction){
        reaction.age+=dt;
        const u=reaction.age/reaction.length;
        if(u>=1)reaction=null;
        else{
          const hop=Math.sin(u*Math.PI);
          if(reaction.kind==='taste'){
            out.pitch+=Math.sin(u*Math.PI*4)*.16*(1-u);
            out.roll+=Math.sin(u*Math.PI*6)*.10*(1-u);
            out.lift+=hop*.10;
          }else{
            out.lift+=hop*.24;
            out.roll+=Math.sin(u*Math.PI*4)*.10*(1-u);
            const grow=hop*.07;
            out.sy*=1+grow;
            out.sx*=1-grow*.5;
            out.sz*=1-grow*.5;
          }
        }
      }
      return out;
    }
  };
}

// Luma's mood: excited after good news, curious when you swim near, sleepy when left alone.
export function createMood() {
  let phase=0,last,excite=0,sleepy=0,curious=0,stillFor=0,spinTime=1;
  return {
    emote(name) {
      if(name==='excited'){excite=1;spinTime=0;}
      else if(name==='sleepy')stillFor=60;
      else if(name==='curious')curious=1;
    },
    step(time,{travel=false,speed=0,dist=99}={}) {
      const dt=last===undefined?0:clamp(time-last,0,.1);
      last=time;
      excite=Math.max(0,excite-dt*.45);
      stillFor=speed<.3&&!travel?stillFor+dt:0;
      const sleepyTarget=stillFor>40&&excite<.05?1:0;
      sleepy+=(sleepyTarget-sleepy)*damp(.8,dt);
      const curiousTarget=dist<4.2&&speed>.3&&!travel&&excite<.1&&sleepy<.5?1:0;
      curious+=(curiousTarget-curious)*damp(2.2,dt);
      if(spinTime<1)spinTime=Math.min(1,spinTime+dt/.9);
      const spin=spinTime<1?(1-(1-spinTime)**3)*TAU:0;
      phase+=dt*2.4*(1+excite*.9-sleepy*.55);
      return {beat:Math.sin(phase),excite,sleepy,curious,spin};
    }
  };
}
