import * as T from './vendor/three.module.min.js';

function makeFish() {
  const vertices=[], colors=[], triangles=[];
  const pearl=new T.Color('#f3f4ef');
  const blue=new T.Color('#578ebc');
  const bright=new T.Color('#d4f6f2');
  const rings=[
    [-.37,.027,.028],[-.27,.079,.087],[-.10,.13,.146],
    [.11,.104,.111],[.21,.061,.057],[.27,.015,.018],[.28,.001,.001]
  ];
  const sides=12;
  for(let ring=0;ring<rings.length;ring++){
    const [x,halfWidth,halfHeight]=rings[ring];
    for(let side=0;side<=sides;side++){
      const angle=side/sides*Math.PI*2;
      const y=Math.sin(angle), z=Math.cos(angle);
      const tint=pearl.clone().lerp(blue,T.MathUtils.smoothstep(y,-.55,1));
      const stripe=.26*Math.exp(-Math.pow((y-.07)/.15,2));
      tint.lerp(bright,stripe);
      vertices.push(x,y*halfHeight,z*halfWidth);
      colors.push(tint.r,tint.g,tint.b);
      if(ring<rings.length-1&&side<sides){
        const k=ring*(sides+1)+side;
        triangles.push(k,k+sides+1,k+1,k+1,k+sides+1,k+sides+2);
      }
    }
  }

  function fin(points,tintHex) {
    const tint=new T.Color(tintHex);
    const start=vertices.length/3;
    for(let i=0;i<points.length;i++){
      vertices.push(...points[i]);
      const color=pearl.clone().lerp(tint,i===0?.46:.94);
      colors.push(color.r,color.g,color.b);
      if(i>1) triangles.push(start,start+i-1,start+i);
    }
  }

  fin([[-.34,0,0],[-.56,.067,.011],[-.66,.14,.012],[-.60,.01,-.011],[-.65,-.13,.02],[-.52,-.054,.015]],'#8fbbd7');
  fin([[-.21,.091,0],[-.16,.168,.004],[-.013,.199,.003],[.073,.123,0]],'#9fb4d2');
  fin([[-.18,-.058,-.05],[-.29,-.124,-.105],[-.12,-.107,-.095],[.04,-.068,-.08]],'#91add5');
  fin([[-.18,-.058,.05],[-.29,-.124,.105],[-.12,-.107,.095],[.04,-.068,.08]],'#91add5');

  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
  geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  geometry.setIndex(triangles);
  geometry.computeVertexNormals();

  return geometry;
}

export function addReefLife(scene, haloTexture) {
  const clock={value:0};
  const fishMaterial=new T.MeshStandardMaterial({
    side:T.DoubleSide, vertexColors:true,
    roughness:.40, metalness:.21, emissive:'#4e8d9e', emissiveIntensity:.23
  });
  fishMaterial.onBeforeCompile=shader=>{
    shader.uniforms.reefLifeTime=clock;
    shader.vertexShader='uniform float reefLifeTime;\n'+shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      float tail=clamp(.20-position.x,0.,1.);
      float phase=0.;
      #ifdef USE_INSTANCING
        phase=instanceMatrix[3].x*.62+instanceMatrix[3].z*.31;
      #endif
      transformed.z+=sin(reefLifeTime*8.4+position.x*8.+phase)*tail*tail*.29;`
    );
  };

  const fish=makeFish();
  const schools=[
    {x:-6.3,y:1.15,z:1.5,rx:3.3,rz:2.2,speed:.52,phase:.74,count:9,tint:'#c0e3dd'},
    {x:2.9,y:1.15,z:-5.2,rx:5.8,rz:3.2,speed:.31,phase:4.9,count:12,tint:'#9bbdec'},
    {x:10.2,y:.75,z:4.0,rx:3.7,rz:1.9,speed:.55,phase:3.7,count:8,tint:'#e2d4a6'},
    // [sunpetal-alive] candy colored schools, including some around Farm Island
    {x:-34,y:1.3,z:3.5,rx:8.4,rz:5.6,speed:.28,phase:1.2,count:12,tint:'#ffb0dd'},
    {x:-34,y:.9,z:3.5,rx:6.0,rz:4.0,speed:.4,phase:3.1,count:9,tint:'#d2b4ff'},
    {x:-22,y:1.6,z:-3.0,rx:4.6,rz:3.0,speed:.36,phase:5.2,count:9,tint:'#ffd98a'},
    {x:-2.0,y:1.9,z:8.0,rx:5.0,rz:2.4,speed:.33,phase:2.3,count:8,tint:'#9fe8ff'},
    {x:-13,y:2.0,z:-8.0,rx:6.5,rz:3.0,speed:.24,phase:0.4,count:10,tint:'#ffb0dd'}
  ].map(school=>{
    const batch=new T.InstancedMesh(fish,fishMaterial,school.count);
    batch.name='Reef fish school';
    batch.instanceMatrix.setUsage(T.DynamicDrawUsage);
    // The orbit crosses the viewport boundary while the instance matrix changes.
    batch.frustumCulled=false;
    const tint=new T.Color(school.tint);
    for(let i=0;i<school.count;i++){
      batch.setColorAt(i,tint.clone().multiplyScalar(.72+.27*Math.sin(i*1.17)**2));
    }
    scene.add(batch);
    return {...school,batch};
  });
  const transform=new T.Object3D();

  const count=340;
  const geometry=new T.BufferGeometry();
  const positions=[], phases=[], sizes=[];
  for(let i=0;i<count;i++){
    positions.push(
      ((i*.61803398875)%1)*84-54,
      ((i*.754877666)%1)*10-1.8,
      ((i*.569840291)%1-.55)*42
    );
    phases.push(i*2.399963);
    sizes.push(.17+.18*Math.sin(i*1.94)**2);
  }
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('phase',new T.Float32BufferAttribute(phases,1));
  geometry.setAttribute('size',new T.Float32BufferAttribute(sizes,1));
  const particles=new T.Points(geometry,new T.ShaderMaterial({
    uniforms:{clock,glowMap:{value:haloTexture},screenScale:{value:400}},
    transparent:true, depthWrite:false,
    vertexShader:`
      uniform float clock;
      uniform float screenScale;
      attribute float phase;
      attribute float size;
      varying float glimmer;
      varying float tone;
      void main(){
        vec3 point=position;
        point.x+=sin(clock*.15+phase)*.88;
        point.y+=sin(clock*.19+phase*.72)*.42;
        point.z+=cos(clock*.12+phase)*.39;
        vec4 view=modelViewMatrix*vec4(point,1.);
        gl_Position=projectionMatrix*view;
        gl_PointSize=clamp(size*screenScale/max(1.,-view.z),1.5,15.);
        float depthFade=1.-smoothstep(13.,42.,-view.z);
        tone=fract(phase*.318309);
        glimmer=(.34+.5*pow(.5+.5*sin(clock*.8+phase),3.))*depthFade*smoothstep(1.,5.,-view.z);
      }`,
    fragmentShader:`
      uniform sampler2D glowMap;
      varying float glimmer;
      varying float tone;
      void main(){
        float light=texture2D(glowMap,gl_PointCoord).a;
        vec3 tint=mix(vec3(.33,.79,1.),vec3(1.,.66,.92),smoothstep(.35,.65,tone));
        tint=mix(tint,vec3(1.,.9,.55),smoothstep(.8,.95,tone));
        gl_FragColor=vec4(tint,glimmer*light);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  }));
  particles.name='Drifting reef plankton';
  particles.frustumCulled=false;
  scene.add(particles);
  const bubblePositions=[],bubblePhases=[];
  for(const [x,z] of [[-17.2,1.5],[-7.9,2.15],[8.0,-4.55],[18.26,-5.78]]){
    for(let i=0;i<6;i++){
      bubblePositions.push(x+Math.sin(i*2.3)*.48,.28,z+Math.cos(i*2.3)*.36);
      bubblePhases.push((i*.38197)%1);
    }
  }
  const bubbleGeometry=new T.BufferGeometry();
  bubbleGeometry.setAttribute('position',new T.Float32BufferAttribute(bubblePositions,3));
  bubbleGeometry.setAttribute('phase',new T.Float32BufferAttribute(bubblePhases,1));
  const bubbles=new T.Points(bubbleGeometry,new T.ShaderMaterial({
    uniforms:{clock,screenScale:particles.material.uniforms.screenScale},
    transparent:true,depthWrite:false,
    vertexShader:`
      uniform float clock, screenScale;
      attribute float phase;
      varying float opacity;
      void main(){
        float life=fract(clock*.24+phase);
        vec3 point=position+vec3(.12*sin(life*7.+phase),life*2.45,.11*sin(life*9.));
        vec4 view=modelViewMatrix*vec4(point,1.);
        gl_Position=projectionMatrix*view;
        gl_PointSize=clamp(screenScale*(.14+.08*phase)/max(1.,-view.z),1.,12.);
        opacity=.42*smoothstep(0.,.19,life)*(1.-smoothstep(.68,1.,life))*(1.-smoothstep(12.,31.,-view.z));
      }`,
    fragmentShader:`
      varying float opacity;
      void main(){
        vec2 p=gl_PointCoord-.5;
        float ring=1.-smoothstep(.045,.11,abs(length(p)-.31));
        float highlight=exp(-65.*dot(p-vec2(-.15,-.15),p-vec2(-.15,-.15)));
        gl_FragColor=vec4(.44,.81,1.,opacity*(ring*.67+highlight*.33));
        #include <colorspace_fragment>
      }`
  }));
  bubbles.name='Rising bubbles near shelters';
  bubbles.frustumCulled=false;
  scene.add(bubbles);

  function animate(time,viewportHeight,player) {
    clock.value=time;
    particles.material.uniforms.screenScale.value=viewportHeight*.64;
    for(const {x,y,z,rx,rz,speed,phase,batch,count:members} of schools){
      const orbit=time*speed+phase;
      const centerX=x+Math.cos(orbit)*rx;
      const centerZ=z+Math.sin(orbit)*rz;
      const awayX=centerX-player.x,awayZ=centerZ-player.z;
      const distance=Math.hypot(awayX,awayZ);
      const lift=1-T.MathUtils.smoothstep(distance,1.2,3.5);
      const clearance=time===0?0:lift*.62;
      for(let i=0;i<members;i++){
        const drift=Math.sin(time*.72+i*2.4);
        const row=Math.floor(i/3);
        const column=i%3;
        const lag=orbit-row*.18-column*.052;
        const spread=(column-1)*.32+.065*Math.sin(i*2.399);
        transform.position.set(
          x+Math.cos(lag)*(rx+spread),
          y+Math.sin(orbit*1.28+i*.78)*.24+(column-1)*.11+clearance,
          z+Math.sin(lag)*(rz+spread)+drift*.095
        );
        const facing=Math.atan2(Math.cos(lag)*rz,-Math.sin(lag)*rx);
        transform.rotation.set(.14*Math.cos(lag+i),-facing,.08*drift,'YXZ');
        const scale=.63+.23*Math.sin(i*1.84)**2;
        transform.scale.setScalar(scale);
        transform.updateMatrix();
        batch.setMatrixAt(i,transform.matrix);
      }
      batch.instanceMatrix.needsUpdate=true;
    }
  }

  return {animate};
}
