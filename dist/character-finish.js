// Each imported character uses one painted atlas for skin, hair, clothing and jewelry.
// Preserve the color map and let its existing hues guide the finish on the mixed surfaces.
function soften(material) {
  const finish = material.clone();
  finish.normalScale.multiplyScalar(.42);
  if (finish.isMeshPhysicalMaterial) {
    finish.specularIntensity *= .67;
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
      `)
      .replace('#include <metalnessmap_fragment>', `
        #include <metalnessmap_fragment>
        metalnessFactor *= mix(.42,.10,warmSkin);
      `);
  };
  finish.customProgramCacheKey = () => 'sunpetal-character-satin-v1';
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
