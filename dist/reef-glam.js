// [sunpetal-glam] One switch for the glossy, candy-bright "doll glam" look.
//   ?glam=1   full glam (the default)
//   ?glam=0   the original look, to compare
//   ?glam=0.5 halfway
// Every glam change in the game reads this one number, so it is easy to tune or remove.
const raw=new URLSearchParams(globalThis.location?.search??'').get('glam');
const parsed=raw===null||raw===''?1:Number(raw);
export const glam=Number.isFinite(parsed)?Math.min(1,Math.max(0,parsed)):1;
if(glam>0.5)globalThis.document?.documentElement?.classList.add('glam');
