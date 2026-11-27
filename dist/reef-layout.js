const farm = { x: -12, z: 4.2 };
const cottage = { x: -13, z: -3 };
const cottageLanding = { x: -12.68, z: 1.40 };
const jelly = { x: -0.5, z: 1.4 };
const shelf = { x: 13, z: -1.5 };
const moonlacePearl = { x: 14.9, z: -2.88 };
const station = { x: -17.4, z: 3.8 };
const grotto = { x: 16.6, z: -5.2 };
const glass = { x: 9.45, z: -4.6 };
const secondBed = { x: farm.x-2.6, z: farm.z+1.8 };
const wardrobe = { x: -114.60, z: -1.93 };
const kitchen = { x: -112, z: -2.25 };
const nook = { x: -16.65, z: -.47 };
const cottageDoor = { x: -13.0, z: -.72 };
const farmDock = { x: -19.06, z: 4.91 };
const farmWest = -33.95;
// The Pearl Reef Sanctuary: one Meshy island, scaled by `scale`. Model coordinates times the
// scale give metres from the island centre (x,z). Plots follow its 4 + 4 + 3 brown tiles.
const farmIsland = {
  x:farmWest,z:4.2,scale:16,
  arrival:{x:-28.9,z:5.0},
  bounds:{left:farmWest-7.2,right:farmWest+7.2,back:4.2-7.6,front:4.2+7.6},
  ellipse:{rx:6.4,rz:6.7}
};
const outdoorBounds={left:farmWest-10.2,right:22,back:-10,front:12};
const onFarmIsland=({x,z})=>{
  const {left,right,back,front}=farmIsland.bounds;
  return x>=left&&x<=right&&z>=back&&z<=front;
};
const cottageRoom = { x: -112, z: 0, arrival:{x:-112,z:2.45}, bounds:{left:-115.3,right:-108.7,back:-1.28,front:2.85} };
// Twelve plots. The model has 11 (rows of 4, 4 and 3); the 12th sits in the open spot at the end of row 3.
const plotYaw=-Math.atan2(.0128,.0655);
const plotModel=[
  [-.3369,-.1176],[-.2715,-.1049],[-.2060,-.0926],[-.1415,-.0784],
  [-.3501,-.0463],[-.2847,-.0342],[-.2206,-.0207],[-.1545,-.0074],
  [-.3627,.0274],[-.2986,.0398],[-.2332,.0527],[-.1677,.0655]
];
const fieldPlots=plotModel.map(([mx,mz],index)=>{
  const x=farmIsland.x+mx*farmIsland.scale,z=farmIsland.z+mz*farmIsland.scale;
  return {x,z,number:index+1,approach:{x,z:z+.62},yaw:plotYaw,added:index===11};
});
const travelLandings = {
  home: { x: -8.9, z: 6.2 },
  reef: { x: 12, z: -1.5 }
};
const displaySpots = [
  { x: -12.1, z: -.45, name: 'Cottage steps' },
  { x: -10.15, z: 6.55, name: 'Garden overlook' }
];

export const reefLayout = {
  farm, cottage, cottageLanding, cottageDoor, farmDock, farmIsland, outdoorBounds, onFarmIsland, cottageRoom, fieldPlots,
  jelly, shelf, moonlacePearl, station, grotto, glass, secondBed, wardrobe, kitchen, nook, displaySpots, travelLandings
};
