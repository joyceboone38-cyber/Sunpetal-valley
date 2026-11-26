// An on-screen thumbstick for phones and tablets. Hold and drag the pearl to swim in
// that direction. It sits beside the existing tap-to-swim and drag-to-turn-camera
// controls, which keep working everywhere outside the stick.
//
// Use ?stick=1 to force it on a computer and ?stick=0 to hide it.

const css=`
#stick{position:absolute;z-index:2;left:max(18px,env(safe-area-inset-left,0px));bottom:max(18px,env(safe-area-inset-bottom,0px));
  width:132px;height:132px;border-radius:50%;touch-action:none;user-select:none;-webkit-user-select:none;
  background:radial-gradient(circle at 50% 42%,#ffffff22,#ff8fdc30 62%,#a8259f44);
  border:2px solid #ffc6f2a6;box-shadow:0 6px 22px #2a0a4a80,inset 0 0 18px #ffffff2e}
#stick[hidden]{display:none}
#stick::before{content:"";position:absolute;inset:36px;border-radius:50%;border:1px dashed #ffffff3d}
#stick .pearl{position:absolute;left:50%;top:50%;width:58px;height:58px;margin:-29px 0 0 -29px;border-radius:50%;
  background:radial-gradient(circle at 34% 28%,#fff,#ffd6f3 38%,#e444b8 100%);
  box-shadow:0 4px 12px #5a0a5a99,inset 0 -3px 6px #a8259f80;will-change:transform}
#stick.live{border-color:#fff0a8}
@media(max-height:480px){#stick{width:112px;height:112px}#stick .pearl{width:50px;height:50px;margin:-25px 0 0 -25px}}
`;

export function createStick({doc=document,onStart=()=>{}}={}) {
  const forced=new URLSearchParams(globalThis.location?.search??'').get('stick');
  const touchy=forced==='1'||(forced!=='0'&&(globalThis.matchMedia?.('(pointer:coarse)').matches||globalThis.navigator?.maxTouchPoints>0));
  const state={x:0,z:0,active:false};
  const result={
    // x is right, z is toward the viewer, each from -1 to 1, like the arrow keys but smooth.
    vector:()=>state,
    reset(){state.x=state.z=0;state.active=false;thumb?.style.setProperty('transform','translate(0,0)');base?.classList.remove('live');}
  };
  if(!touchy||!doc?.head)return result;

  const style=doc.createElement('style');
  style.textContent=css;
  doc.head.append(style);
  const base=doc.createElement('div');
  base.id='stick';
  base.setAttribute('aria-label','Swim stick');
  const thumb=doc.createElement('div');
  thumb.className='pearl';
  base.append(thumb);
  (doc.querySelector('#game-ui')??doc.body).append(base);

  let pointerId=null;
  const dead=.12;
  function move(event) {
    const box=base.getBoundingClientRect();
    const radius=box.width/2;
    const dx=event.clientX-(box.left+radius),dy=event.clientY-(box.top+radius);
    const length=Math.hypot(dx,dy);
    const reach=radius*.62;
    const pull=Math.min(1,length/reach);
    const shown=length>0?Math.min(length,reach)/length:0;
    thumb.style.transform='translate('+(dx*shown).toFixed(1)+'px,'+(dy*shown).toFixed(1)+'px)';
    const strength=pull<dead?0:(pull-dead)/(1-dead);
    state.x=length>0?dx/length*strength:0;
    state.z=length>0?dy/length*strength:0;
    state.active=strength>0;
  }
  base.addEventListener('pointerdown',event=>{
    if(pointerId!==null)return;
    pointerId=event.pointerId;
    base.setPointerCapture(pointerId);
    base.classList.add('live');
    event.preventDefault();
    event.stopPropagation();
    onStart();
    move(event);
  });
  base.addEventListener('pointermove',event=>{if(event.pointerId===pointerId)move(event);});
  const end=event=>{
    if(event.pointerId!==pointerId)return;
    pointerId=null;
    result.reset();
  };
  base.addEventListener('pointerup',end);
  base.addEventListener('pointercancel',end);
  base.addEventListener('lostpointercapture',end);
  globalThis.addEventListener?.('blur',()=>{pointerId=null;result.reset();});
  return result;
}
