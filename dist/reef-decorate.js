// Decorating mode for the cottage. Tap a piece to select it, then tap the floor to move it.
// Rotate it, or put it back in your stash. Tap a stash chip and then the floor to place a new
// piece. Furniture bought at the boutique is dropped into a free spot, so this is for fine tuning.
import { furnitureById, roomFloor } from './reef-furniture.js';

const css=`
#decor-bar{position:absolute;z-index:3;left:50%;transform:translateX(-50%);bottom:max(14px,env(safe-area-inset-bottom,0px));
  width:min(560px,calc(100vw - 24px));display:grid;gap:8px;padding:10px 12px;border-radius:22px;
  background:linear-gradient(180deg,#5b2290ee,#37105fee);border:1px solid #ffc6f2a6;box-shadow:0 10px 30px #1a0630aa;color:#fff;font:600 14px/1.3 system-ui,sans-serif}
#decor-bar[hidden]{display:none}
#decor-bar .hint{text-align:center;color:#ffe9fb}
#decor-bar .row{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
#decor-bar .chips{flex-wrap:nowrap;overflow-x:auto;justify-content:flex-start;padding-bottom:2px;-webkit-overflow-scrolling:touch}
#decor-bar .chips button{flex:none}
#decor-bar button{appearance:none;border:1px solid #ffc6f2;background:linear-gradient(180deg,#ff8fdc,#c13aa6);color:#fff;font:700 14px system-ui,sans-serif;
  padding:9px 14px;border-radius:999px;min-height:40px}
#decor-bar button[disabled]{opacity:.45}
#decor-bar button.done{background:linear-gradient(180deg,#ffd77a,#e89a2a);color:#4a2400}
#decor-bar button.chip{background:#ffffff22}
#decor-bar button.chip[aria-pressed="true"]{background:#ffd77a;color:#4a2400}
@media(max-height:520px){#decor-bar{left:auto;right:12px;transform:none;width:300px;bottom:12px;padding:8px 10px;gap:6px}#decor-bar button{padding:6px 10px;min-height:34px;font-size:13px}#decor-bar .hint{font-size:12px}}
body.decorating .actions,body.decorating #stick,body.decorating #area-action,body.decorating #interact,body.decorating #travel{display:none!important}
`;

export function createDecorator({life,getView,player,room,doc=document,onChange=()=>{}}) {
  const style=doc.createElement('style');
  style.textContent=css;
  doc.head.append(style);
  const bar=doc.createElement('div');
  bar.id='decor-bar';
  bar.hidden=true;
  const hint=doc.createElement('div');
  hint.className='hint';
  const chips=doc.createElement('div');
  chips.className='row chips';
  const row=doc.createElement('div');
  row.className='row';
  const button=(label,run,className='')=>{
    const element=doc.createElement('button');
    element.type='button';
    element.textContent=label;
    element.className=className;
    element.addEventListener('click',event=>{event.stopPropagation();run();});
    return element;
  };
  const rotate=button('Rotate',()=>{if(life.selected){life.rotateItem(life.selected);draw();}});
  const stash=button('Put away',()=>{if(life.selected){life.storeItem(life.selected);placing='';draw();}});
  const done=button('Done',()=>state.exit(),'done');
  row.append(rotate,stash,done);
  bar.append(hint,chips,row);
  (doc.querySelector('#game-ui')??doc.body).append(bar);

  let placing='';
  const state={
    active:false,
    enter(id='') {
      if(player.space!=='cottage')return false;
      state.active=true;
      placing=id&&life.stashCount(id)>0?id:'';
      doc.body.classList.add('decorating');
      bar.hidden=false;
      life.selectItem('');
      draw();
      onChange(true);
      return true;
    },
    exit() {
      if(!state.active)return;
      state.active=false;
      placing='';
      doc.body.classList.remove('decorating');
      bar.hidden=true;
      life.selectItem('');
      onChange(false);
    },
    // A tap on the 3D view while decorating.
    tap(event) {
      const view=getView();
      if(!view||!state.active)return;
      const uid=view.pickFurniture?.(event.clientX,event.clientY)??'';
      if(uid){
        placing='';
        life.selectItem(uid);
        draw();
        return;
      }
      const point=view.pick(event.clientX,event.clientY);
      if(!point)return;
      const x=point.x-room.x,z=point.z-room.z;
      if(x<roomFloor.left-.4||x>roomFloor.right+.4||z<roomFloor.back-.4||z>roomFloor.front+.4)return;
      if(placing){
        const uid=life.placeItem(placing,x,z);
        if(uid&&life.stashCount(placing)<1)placing='';
      }else if(life.selected){
        life.moveItem(life.selected,x,z);
      }
      draw();
    }
  };

  function draw() {
    chips.replaceChildren();
    const ids=Object.keys(life.stash).filter(id=>furnitureById[id]&&life.stash[id]>0);
    for(const id of ids){
      const chip=button(furnitureById[id].name+' x'+life.stash[id],()=>{
        placing=placing===id?'':id;
        life.selectItem('');
        draw();
      },'chip');
      chip.setAttribute('aria-pressed',String(placing===id));
      chips.append(chip);
    }
    chips.hidden=!ids.length;
    const selected=life.selected;
    rotate.disabled=!selected;
    stash.disabled=!selected;
    hint.textContent=placing?'Tap the floor to place your '+furnitureById[placing].name.toLowerCase()+'.'
      :selected?'Tap the floor to move it, or rotate it.'
      :'Tap a piece to select it.';
  }
  return state;
}
