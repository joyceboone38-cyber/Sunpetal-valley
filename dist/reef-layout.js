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
const farmIsland = {
  x:farmWest,z:3.45,
  arrival:{x:farmWest+7.72,z:farmDock.z},
  bounds:{left:farmWest-8.35,right:farmWest+8.35,back:-1.65,front:10.6}
};
const outdoorBounds={left:farmWest-10.2,right:22,back:-10,front:11};
const onFarmIsland=({x,z})=>{
  const {left,right,back,front}=farmIsland.bounds;
  return x>=left&&x<=right&&z>=back&&z<=front;
};
const cottageRoom = { x: -112, z: 0, arrival:{x:-112,z:2.45}, bounds:{left:-115.3,right:-108.7,back:-1.28,front:2.85} };
const fieldPlots=Array.from({length:12},(_,index)=>{
  const side=index%2===0?-1:1;
  const number=Math.floor(index/2);
  const x=farmIsland.x+side*(number%2===0?2.78:6.06);
  const z=farmIsland.z-3.55+Math.floor(number/2)*3.32;
  return {x,z,number:number+1,crop:side<0?'moonlace':'starkelp',approach:{x,z:z+1.12}};
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
