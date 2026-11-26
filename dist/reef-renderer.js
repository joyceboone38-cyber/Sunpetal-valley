import * as T from './vendor/three.module.min.js';

// Keep the grade and selective glow in the 3D canvas so the interface stays crisp.
export function createReefRenderer(canvas, {quality='high',simpleGraphics=false}={}) {
  const renderer = new T.WebGLRenderer({
    canvas,antialias:!simpleGraphics,powerPreference:simpleGraphics?'default':'high-performance'
  });
  const density=()=>Math.min(devicePixelRatio,quality==='low'?1.05:1.5);
  let pixelRatio = density();
  let width=1,height=1;
  renderer.setPixelRatio(pixelRatio);
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.11;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  function disposeRenderer(){
    renderer.dispose();
    renderer.forceContextLoss();
  }

  const supportsHDR=!simpleGraphics&&renderer.extensions.has('EXT_color_buffer_float');
  if (!supportsHDR) {
    return {
      supportsHDR,
      resize: (wide,tall) => {
        width=wide;height=tall;
        renderer.setSize(width,height,false);
      },
      setQuality(value){
        quality=value;
        renderer.setPixelRatio(density());
        renderer.setSize(width,height,false);
      },
      draw: (scene,camera) => renderer.render(scene,camera),
      dispose:disposeRenderer,
      refreshShadows:()=>{renderer.shadowMap.needsUpdate=true;}
    };
  }

  const gl=renderer.getContext();
  const supportedSamples=gl.getInternalformatParameter(gl.RENDERBUFFER,gl.RGBA16F,gl.SAMPLES);
  const samples=Array.from(supportedSamples).find(count=>count<=2) ?? 0;
  const source = new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,samples});
  const highlights = new T.WebGLRenderTarget(1,1,{
    type:T.HalfFloatType,depthBuffer:false
  });
  const screen = new T.Scene();
  const camera = new T.OrthographicCamera(-1,1,1,-1,0,1);
  const plane = new T.PlaneGeometry(2,2);
  const vertexShader = `
    varying vec2 vUv;
    void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}
  `;
  const brightPass = new T.ShaderMaterial({
    uniforms:{sceneColor:{value:source.texture},pixel:{value:new T.Vector2()}},
    vertexShader, depthTest:false, depthWrite:false, toneMapped:false,
    fragmentShader:`
      uniform sampler2D sceneColor;
      uniform vec2 pixel;
      varying vec2 vUv;
      void main(){
        vec3 c=(texture2D(sceneColor,vUv+pixel*vec2(-1.,-1.)).rgb+
          texture2D(sceneColor,vUv+pixel*vec2(1.,-1.)).rgb+
          texture2D(sceneColor,vUv+pixel*vec2(-1.,1.)).rgb+
          texture2D(sceneColor,vUv+pixel*vec2(1.,1.)).rgb)*.25;
        float peak=max(max(c.r,c.g),c.b);
        gl_FragColor=vec4(min(c,vec3(4.))*smoothstep(1.03,2.6,peak),1.);
      }
    `
  });
  const grade = new T.ShaderMaterial({
    uniforms:{sceneColor:{value:source.texture},glowMap:{value:highlights.texture},glowStep:{value:new T.Vector2()}},
    vertexShader, depthTest:false, depthWrite:false,
    fragmentShader:`
      uniform sampler2D sceneColor;
      uniform sampler2D glowMap;
      uniform vec2 glowStep;
      varying vec2 vUv;
      void main(){
        vec3 color=texture2D(sceneColor,vUv).rgb;
        vec3 bloom=texture2D(glowMap,vUv).rgb*.20;
        for(int i=0;i<8;i++){
          float angle=float(i)*.785398;
          vec2 offset=vec2(cos(angle),sin(angle))*glowStep;
          bloom+=texture2D(glowMap,vUv+offset).rgb*.10;
        }
        float luma=dot(color,vec3(.2126,.7152,.0722));
        float shadows=1.-smoothstep(.015,.45,luma);
        float saturation=1.06+.13*(1.-smoothstep(.35,1.15,luma));
        color=max(vec3(0.),mix(vec3(luma),color,saturation));
        color*=mix(vec3(1.0),vec3(.93,.98,1.08),shadows);
        color+=bloom*.095;
        vec2 edge=(vUv-.5)*2.;
        color*=1.-.09*smoothstep(.48,1.85,dot(edge,edge));
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  });
  const quad = new T.Mesh(plane,grade);
  quad.frustumCulled=false;
  screen.add(quad);

  function resize(wide,tall){
      width=wide;
      height=tall;
      renderer.setSize(width,height,false);
      if(quality==='low') return;
      const w=Math.max(1,Math.floor(wide*pixelRatio));
      const h=Math.max(1,Math.floor(tall*pixelRatio));
      source.setSize(w,h);
      highlights.setSize(Math.max(1,Math.ceil(w/4)),Math.max(1,Math.ceil(h/4)));
      brightPass.uniforms.pixel.value.set(1/w,1/h);
      grade.uniforms.glowStep.value.set(2.3/highlights.width,2.3/highlights.height);
  }
  return {
    supportsHDR,
    resize,
    setQuality(value){
      if(value===quality) return;
      quality=value;
      pixelRatio=density();
      renderer.setPixelRatio(pixelRatio);
      if(quality==='low'){
        source.dispose();
        highlights.dispose();
      }
      resize(width,height);
    },
    refreshShadows:()=>{renderer.shadowMap.needsUpdate=true;},
    dispose(){
      source.dispose();
      highlights.dispose();
      plane.dispose();
      brightPass.dispose();
      grade.dispose();
      disposeRenderer();
    },
    draw(scene,viewCamera){
      if(quality==='low'){
        renderer.render(scene,viewCamera);
        return;
      }
      renderer.setRenderTarget(source);
      renderer.render(scene,viewCamera);
      quad.material=brightPass;
      renderer.setRenderTarget(highlights);
      renderer.render(screen,camera);
      quad.material=grade;
      renderer.setRenderTarget(null);
      renderer.render(screen,camera);
    }
  };
}
