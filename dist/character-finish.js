import { glam } from './reef-glam.js'; // [sunpetal-glam]
const G=glam.toFixed(3);
// Each imported character uses one painted atlas for skin, hair, clothing and jewelry.
// Preserve the color map and let its existing hues guide the finish on the mixed surfaces.
function soften(material) {
  const finish = material.clone();
  finish.normalScale.multiplyScalar(.42);
  if (finish.isMeshPhysicalMaterial) {
    finish.specularIntensity *= .67+.9*glam;
    finish.clearcoat = Math.max(finish.clearcoat??0,.3*glam);
    finish.clearcoatRoughness = .2;
    finish.specularColor.setRGB(1, 1, 1);
  }

  finish.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <roughnessmap_fragment>', `
        #include <roughnessmap_fragment>
        vec3 fabricColor = diffuseColor.rgb;
        float copper = smoothstep(.024,.15,fabricColor.r-fabricColor.b);
        float gold = smoothstep(.012,.065,fabricColor.g-fabricColor.b);
        float warmSkin = copper*gold;
        float satinFloor = mix(.47,.66,warmSkin);
        // Allow the original map to keep its relative cloth and jewelry variation.
        roughnessFactor = mix(roughnessFactor,max(roughnessFactor,satinFloor),.93);
        // glam: shiny hair, glossy lips and outfits, a little more color
        float lumaColor = dot(fabricColor,vec3(.2126,.7152,.0722));
        float vividColor = smoothstep(.16,.42,max(max(fabricColor.r,fabricColor.g),fabricColor.b)-min(min(fabricColor.r,fabricColor.g),fabricColor.b));
        float darkHair = 1.-smoothstep(.04,.20,lumaColor);
        float glossTarget = mix(mix(.46,.30,darkHair),.20,vividColor);
        roughnessFactor = mix(roughnessFactor,min(roughnessFactor,glossTarget),.9*${G});
        diffuseColor.rgb = mix(vec3(lumaColor),diffuseColor.rgb,1.+.2*${G});
      `)
      .replace('#include <metalnessmap_fragment>', `
        #include <metalnessmap_fragment>
        metalnessFactor *= mix(.42,.10,warmSkin);
      `)
      .replace('#include <emissivemap_fragment>', `
        #include <emissivemap_fragment>
        float rimGlow = pow(1.-clamp(dot(normalize(normal),normalize(vViewPosition)),0.,1.),3.);
        totalEmissiveRadiance += vec3(1.,.42,.86)*rimGlow*.20*${G};
      `);
  };
  finish.customProgramCacheKey = () => 'sunpetal-character-satin-v1-g'+G;
  return finish;
}

export function prepareCharacterFinish(root) {
  const softerMaterials = new Map();
  const meshes = [];
  function softened(original) {
    if (!original.isMeshStandardMaterial) return original;
    if (!softerMaterials.has(original)) softerMaterials.set(original,soften(original));
    return softerMaterials.get(original);
  }

  root.traverse(object => {
    if (!object.isMesh) return;
    const original = object.material;
    const softer = Array.isArray(original) ? original.map(softened) : softened(original);
    meshes.push({object,original,softer});
  });

  return useSofter => {
    for (const {object,original,softer} of meshes) object.material = useSofter ? softer : original;
  };
}
