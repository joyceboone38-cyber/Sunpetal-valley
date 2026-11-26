let loader,embeddedAssets;

export function useEmbeddedReefAssets(assets) {
  embeddedAssets=assets;
}

export function reefPosterUrl(path) {
  return embeddedAssets?.poster(path)??path;
}

export function hasReefModel(path) {
  return embeddedAssets?.hasModel?.(path)??true;
}

export async function loadReefModel(path) {
  loader ??= Promise.all([
    import('./vendor/three-addons/loaders/GLTFLoader.js'),
    import('./vendor/three-addons/libs/meshopt_decoder.module.js')
  ]).then(([{GLTFLoader},{MeshoptDecoder}])=>new GLTFLoader().setMeshoptDecoder(MeshoptDecoder));
  const gltf=await loader;
  if(!embeddedAssets?.preferEmbedded){
    try {
      return await gltf.loadAsync(new URL(path,document.baseURI).href);
    } catch(error) {
      if(!embeddedAssets)throw error;
    }
  }
  return gltf.parseAsync(await embeddedAssets.model(path),'');
}

export function createStaticReefAssets(){
  const files=new Map();
  const resources=new Set();
  let disposed=false;
  function collect({scene}){
    const found=new Set();
    scene.traverse(object=>{
      if(!object.isMesh)return;
      found.add(object.geometry);
      for(const material of Array.isArray(object.material)?object.material:[object.material]){
        found.add(material);
        for(const value of Object.values(material)) if(value?.isTexture) found.add(value);
      }
    });
    for(const resource of found){
      if(disposed) resource.dispose();
      else resources.add(resource);
    }
  }
  return {
    load(path){
      if(!files.has(path)) files.set(path,loadReefModel(path).then(model=>{
        collect(model);
        if(disposed) throw new Error('The scene has been released');
        return model;
      }).catch(error=>{
        files.delete(path);
        throw error;
      }));
      return files.get(path);
    },
    dispose(){
      disposed=true;
      for(const resource of resources) resource.dispose();
      resources.clear();
      files.clear();
    }
  };
}
