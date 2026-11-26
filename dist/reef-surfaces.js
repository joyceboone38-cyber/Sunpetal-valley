import * as T from './vendor/three.module.min.js';

// A small, generated light probe gives metal, glass and nacre distinct reflections.
export function makeUnderwaterProbe() {
  const width=128,height=64;
  const pixels=new Uint16Array(width*height*4);
  const sources=[
    [new T.Vector3(-.48,.81,.32).normalize(),new T.Color('#adf5ff'),3.8,51],
    [new T.Vector3(-.35,.67,.72).normalize(),new T.Color('#c1f7ff'),1.05,9],
    [new T.Vector3(.7,.42,-.53).normalize(),new T.Color('#b887fa'),1.85,26],
    [new T.Vector3(.24,.12,.97).normalize(),new T.Color('#ffc792'),1.18,29]
  ];
  const direction=new T.Vector3();
  const navy=new T.Color('#172a52'), shallows=new T.Color('#6ebac8');
  const light=new T.Color();
  const pixel=new T.Color();
  const half=T.DataUtils.toHalfFloat;
  for(let y=0;y<height;y++){
    const latitude=((y+.5)/height-.5)*Math.PI;
    const vertical=Math.sin(latitude), horizontal=Math.cos(latitude);
    for(let x=0;x<width;x++){
      const longitude=((x+.5)/width-.5)*Math.PI*2;
      direction.set(Math.cos(longitude)*horizontal,vertical,Math.sin(longitude)*horizontal);
      pixel.copy(navy).lerp(shallows,T.MathUtils.smoothstep(vertical,-.30,.90));
      for(const [axis,color,power,width] of sources){
        const shape=Math.exp((direction.dot(axis)-1)*width)*power;
        pixel.add(light.copy(color).multiplyScalar(shape));
      }
      const i=(y*width+x)*4;
      pixels.set([half(pixel.r),half(pixel.g),half(pixel.b),half(1)],i);
    }
  }
  const texture=new T.DataTexture(pixels,width,height,T.RGBAFormat,T.HalfFloatType);
  texture.mapping=T.EquirectangularReflectionMapping;
  texture.magFilter=texture.minFilter=T.LinearFilter;
  texture.needsUpdate=true;
  return texture;
}

function variation(x,y,period) {
  const phase=(x+y*.67)*Math.PI*2;
  return Math.sin(phase*period)*Math.cos((x*.13-y)*Math.PI*2*period)+
    .54*Math.cos((x+y)*Math.PI*2*(period+3));
}

function surfaceMaps(kind) {
  const size=128;
  const color=new Uint8Array(size*size*4);
  const normal=new Uint8Array(color.length);
  const height=(u,v,i,j)=>{
    const a=Math.sin(u*Math.PI*2),b=Math.cos(v*Math.PI*2);
    const grain=variation(u,v,13)*.11+variation(u,v,37)*.026;
    if(kind==='wood') return grain+.30*Math.sin(v*Math.PI*30+a*.65+variation(u,v,3)*.4);
    if(kind==='cloth') return .17*Math.sin(i*Math.PI*.46)*Math.sin(j*Math.PI*.46)+grain*.34;
    return grain+.23*Math.cos((a*.96+b+variation(u,v,5)*.10)*4.8);
  };
  const pack=value=>Math.round(T.MathUtils.clamp(value,0,1)*255);
  for(let j=0;j<size;j++)for(let i=0;i<size;i++){
    const u=i/size,v=j/size,offset=4*(j*size+i);
    const h=height(u,v,i,j);
    const dx=height(u+1/size,v,i+1,j)-h,dy=height(u,v+1/size,i,j+1)-h;
    const tint=.89+h*(kind==='wood'?.22:.14);
    color.set([pack(tint*1.02),pack(tint),pack(tint*.985),255],offset);
    normal.set([pack(.5-dx*.44),pack(.5-dy*.44),255,255],offset);
  }
  function texture(data,space){
    const map=new T.DataTexture(data,size,size);
    map.colorSpace=space;
    map.wrapS=map.wrapT=T.RepeatWrapping;
    map.magFilter=T.LinearFilter;
    map.minFilter=T.LinearMipmapLinearFilter;
    map.generateMipmaps=true;
    map.needsUpdate=true;
    return map;
  }
  return {map:texture(color,T.SRGBColorSpace),normalMap:texture(normal,T.NoColorSpace)};
}

export function makeReefMaterials() {
  const stone=surfaceMaps('stone'), wood=surfaceMaps('wood'), cloth=surfaceMaps('cloth');
  const standard=(color,properties={})=>new T.MeshStandardMaterial({color,roughness:.75,...properties});
  const nacre=(color)=>new T.MeshPhysicalMaterial({
    ...stone,color,roughness:.31,metalness:.27,clearcoat:.64,clearcoatRoughness:.28,
    iridescence:.47,iridescenceIOR:1.34,iridescenceThicknessRange:[180,345],normalScale:new T.Vector2(.42,.42)
  });
  return {
    gold:new T.MeshPhysicalMaterial({color:'#dda768',metalness:.78,roughness:.27,clearcoat:.35}),
    wood:standard('#31203e',{...wood,roughness:.72,normalScale:new T.Vector2(.58,.58)}),
    decking:color=>standard(color,{...wood,roughness:.69,normalScale:new T.Vector2(.46,.46)}),
    textile:color=>standard(color,{...cloth,roughness:.89,normalScale:new T.Vector2(.46,.46)}),
    limestone:color=>standard(color,{...stone,metalness:.04,roughness:.71,normalScale:new T.Vector2(.56,.56)}),
    nacre,
    basalt:standard('#fff',{...stone,vertexColors:true,metalness:.11,roughness:.69,normalScale:new T.Vector2(.72,.72)}),
    coral:standard('#fff',{...stone,vertexColors:true,roughness:.56,metalness:.02,normalScale:new T.Vector2(.44,.44)}),
    crystal:new T.MeshPhysicalMaterial({
      color:'#a55aff',emissive:'#3930a6',emissiveIntensity:.35,metalness:.49,roughness:.25,clearcoat:1,clearcoatRoughness:.21
    })
  };
}
