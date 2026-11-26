import * as T from './vendor/three.module.min.js';
import { createMood } from './reef-motion.js';

const TAU=2*Math.PI;

export function buildLuma() {
  const creature=new T.Group();
  creature.name='Luma';
  const clock={value:0};
  const mood=createMood();
  const mantle=new T.Group();
  creature.add(mantle);

  const jelly=new T.ShaderMaterial({
    transparent:true,depthWrite:false,side:T.FrontSide,
    uniforms:{clock},
    vertexShader:`
      varying vec3 vNormalDirection;
      varying vec3 vViewDirection;
      varying vec2 vUv;
      void main(){
        vec4 view=modelViewMatrix*vec4(position,1.);
        vNormalDirection=normalize(normalMatrix*normal);
        vViewDirection=normalize(-view.xyz);
        vUv=uv;
        gl_Position=projectionMatrix*view;
      }`,
    fragmentShader:`
      varying vec3 vNormalDirection;
      varying vec3 vViewDirection;
      varying vec2 vUv;
      uniform float clock;
      void main(){
        vec3 normalDirection=normalize(vNormalDirection);
        float rim=pow(1.-max(dot(normalDirection,normalize(vViewDirection)),0.),2.4);
        float grooves=.5+.5*cos(vUv.x*75.398+sin(vUv.y*5.)*.8);
        float ridge=pow(grooves,7.)*smoothstep(.06,.40,vUv.y);
        float pulse=.5+.5*sin(clock*2.5-vUv.y*11.);
        float crown=smoothstep(.15,.89,vUv.y);
        vec3 color=mix(vec3(.25,.10,.75),vec3(.90,.28,.56),crown*.62+pulse*.12);
        color+=vec3(.91,.40,.56)*rim+vec3(.30,.12,.38)*ridge;
        gl_FragColor=vec4(color,.68+rim*.24);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const bell=new T.Mesh(new T.SphereGeometry(.76,48,24,0,TAU,0,Math.PI*.56),jelly);
  bell.scale.y=.65;
  bell.renderOrder=4;
  mantle.add(bell);

  const opal=new T.MeshStandardMaterial({color:'#f5bbec',emissive:'#ba4578',emissiveIntensity:.71,roughness:.36});
  const ink=new T.MeshStandardMaterial({color:'#34204d',roughness:.52});
  const pearl=new T.MeshStandardMaterial({color:'#fff6ff',emissive:'#ffeaff',emissiveIntensity:.26,roughness:.37});
  const collar=new T.Mesh(new T.SphereGeometry(1,32,12),opal);
  collar.position.y=-.075;
  collar.scale.set(.69,.115,.69);
  mantle.add(collar);

  const scallops=Array.from({length:65},(_,i)=>{
    const a=i/64*TAU;
    const edge=.735+.023*Math.sin(a*12);
    return new T.Vector3(Math.sin(a)*edge,-.085+.033*Math.cos(a*12),Math.cos(a)*edge);
  });
  const fringe=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(scallops),80,.037,8),opal);
  mantle.add(fringe);

  const eyes=[];
  const eyeShape=new T.SphereGeometry(1,20,16);
  for(const side of [-1,1]){
    const eye=new T.Group();
    eye.position.set(side*.205,-.025,.728);
    eye.rotation.y=side*.20;
    mantle.add(eye);
    eyes.push(eye);
    const pupil=new T.Mesh(eyeShape,ink);
    pupil.scale.set(.067,.091,.038);
    eye.add(pupil);
    const shine=new T.Mesh(eyeShape,pearl);
    shine.position.set(-.014,.030,.028);
    shine.scale.set(.020,.024,.014);
    eye.add(shine);
  }
  const smileCurve=new T.QuadraticBezierCurve3(
    new T.Vector3(-.045,-.073,.741),new T.Vector3(0,-.111,.749),new T.Vector3(.045,-.073,.741)
  );
  mantle.add(new T.Mesh(new T.TubeGeometry(smileCurve,14,.008,6),ink));

  const ribbons=new T.Group();
  creature.add(ribbons);
  const ribbonShader=new T.ShaderMaterial({
    uniforms:{clock},
    side:T.DoubleSide,transparent:true,depthWrite:false,
    vertexShader:`
      uniform float clock;
      attribute float strand;
      varying vec2 vUv;
      varying float hue;
      void main(){
        vec3 point=position;
        float envelope=uv.y*uv.y;
        float phase=clock*2.4+strand*1.1-uv.y*6.1;
        point.x+=envelope*sin(phase)*.22;
        point.z+=envelope*cos(phase*.87)*.18;
        point.y+=envelope*sin(phase+1.)*.095;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(point,1.);
        vUv=uv;
        hue=fract(strand*.38);
      }`,
    fragmentShader:`
      varying vec2 vUv;
      varying float hue;
      void main(){
        float edge=1.-smoothstep(.30,.52,abs(vUv.x-.5));
        float taper=1.-smoothstep(.60,1.,vUv.y);
        vec3 color=mix(vec3(1.10,.37,.62),vec3(.36,.53,1.35),hue);
        color+=vec3(.37,.19,.12)*edge;
        gl_FragColor=vec4(color,edge*taper*.77);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const positions=[],uvs=[],strands=[],indices=[];
  const segments=22;
  for(let strand=0;strand<10;strand++){
    const angle=strand/10*TAU;
    const cos=Math.cos(angle),sin=Math.sin(angle);
    const radius=.48+.09*(strand%2);
    const length=1.16+.35*(strand%3)*.5;
    const first=positions.length/3;
    for(let row=0;row<=segments;row++){
      const reach=row/segments;
      const pull=radius*(1-.52*reach);
      const sweep=Math.sin(reach*5+strand*.55)*reach*.25;
      const width=(.065+.012*(strand%3))*(1-.77*reach);
      for(let edge=0;edge<2;edge++){
        const offset=(edge-.5)*width+sweep;
        positions.push(cos*pull+sin*offset,-.13-reach*length,sin*pull-cos*offset);
        uvs.push(edge,reach);
        strands.push(strand);
      }
      if(row<segments){
        const i=first+row*2;
        indices.push(i,i+1,i+2,i+1,i+3,i+2);
      }
    }
  }
  const strandsGeometry=new T.BufferGeometry();
  strandsGeometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  strandsGeometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));
  strandsGeometry.setAttribute('strand',new T.Float32BufferAttribute(strands,1));
  strandsGeometry.setIndex(indices);
  const tentacles=new T.Mesh(strandsGeometry,ribbonShader);
  tentacles.renderOrder=3;
  ribbons.add(tentacles);

  const light=new T.PointLight('#d17adf',9,6.6,2);
  creature.add(light);

  const baseLight=light.intensity;
  function animate(time,travel,context={}) {
    clock.value=time;
    const {beat,excite,sleepy,curious,spin}=mood.step(time,{travel,speed:context.speed,dist:context.dist});
    const squeeze=.11+excite*.05;
    mantle.scale.set(1+beat*(.052+excite*.03),1-beat*squeeze-sleepy*.07,1+beat*(.052+excite*.03));
    mantle.rotation.y=spin;
    ribbons.position.y=beat*.063-sleepy*.05;
    const blink=(time+2.7)%5.8;
    const open=Math.max(.08,1+curious*.35-sleepy*.6);
    for(const eye of eyes){
      eye.scale.y=(1-.94*Math.max(0,1-Math.abs(blink-5.55)/.12))*open;
      eye.scale.x=1+curious*.2;
    }
    creature.rotation.z=Math.sin(time*1.4)*.067*(travel?1.7:1)+curious*.14;
    light.intensity=baseLight*(1+excite*.7-sleepy*.45);
  }

  return {creature,animate,emote:name=>mood.emote(name)};
}
