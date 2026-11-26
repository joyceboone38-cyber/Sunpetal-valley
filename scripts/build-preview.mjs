import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';
import { Logger, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, simplify, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const root=fileURLToPath(new URL('../',import.meta.url));
const dist=join(root,'dist');
const readText=path=>readFile(join(dist,path),'utf8');
const inline=code=>code.replace(/<\/script/gi,'<\\/script');
const output=process.argv[2]??join(dist,'index.html');

await Promise.all([MeshoptDecoder.ready,MeshoptEncoder.ready,MeshoptSimplifier.ready]);
const logger=new Logger(Logger.Verbosity.WARN);
const io=new NodeIO().setLogger(logger).registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.decoder':MeshoptDecoder,'meshopt.encoder':MeshoptEncoder
});

async function compactModel(path,bytes){
  const document=await io.readBinary(bytes);
  document.setLogger(logger);
  const character=path.startsWith('characters/');
  const hero=character||path.endsWith('waterfall-cottage.glb');
  const ratio=path.includes('/props/') ? 1 : character ? .26 : hero ? .30 : bytes.length>350000 ? .55 : .75;
  await document.transform(
    weld(),
    simplify({simplifier:MeshoptSimplifier,ratio,error:hero?.006:.004}),
    textureCompress({encoder:sharp,targetFormat:'webp',resize:hero?[640,640]:[512,512],quality:hero?75:72}),
    dedup(),
    meshopt({encoder:MeshoptEncoder,level:'high'})
  );
  const compressed=gzipSync(await io.writeBinary(document),{level:9});
  const original=gzipSync(bytes,{level:9});
  return compressed.length<original.length?compressed:original;
}

async function packageAssets(folder,assets){
  const files=await readdir(join(dist,folder),{withFileTypes:true});
  for(const file of files.sort((a,b)=>a.name.localeCompare(b.name))){
    const path=folder+'/'+file.name;
    if(file.isDirectory()){
      await packageAssets(path,assets);
    }else if(file.name.endsWith('.glb')){
      const data=await compactModel(path,await readFile(join(dist,path)));
      assets['./'+path]=data.toString('base64');
    }else if(file.name.endsWith('.webp')){
      const data=await readFile(join(dist,path));
      assets['./'+path]='data:image/webp;base64,'+data.toString('base64');
    }
  }
}

async function illustratedPage(){
  const [html,script,art]=await Promise.all([readText('illustrated.html'),readText('game.js'),readFile(join(dist,'reef.webp'))]);
  const code=script.replace("'reef.webp'","'data:image/webp;base64,"+art.toString('base64')+"'");
  return html.replace('<script type="module" src="game.js"></script>',
    ()=>'<script>(()=>{\n'+inline(code)+'\n})();</script>');
}

const [bundle,template,illustrated]=await Promise.all([
  build({
    absWorkingDir:dist,entryPoints:['reef3d.js'],bundle:true,platform:'browser',target:'es2022',
    format:'iife',globalName:'reefGame',minify:true,write:false,
    alias:{three:'./vendor/three.module.min.js'}
  }),
  readFile(join(root,'web/sunpetal.html.in'),'utf8'),
  illustratedPage()
]);
const assets={};
await packageAssets('characters',assets);
await packageAssets('environment',assets);

const runtime=`
(() => {
  const element=document.getElementById('reef-data');
  const assets=JSON.parse(element.textContent);
  element.remove();
  const bytes=data=>Uint8Array.from(atob(data),character=>character.charCodeAt(0));
  const embedded={
    preferEmbedded:window.parent!==window||!/^https?:$/.test(location.protocol),
    hasModel:path=>Object.hasOwn(assets,path),
    poster:path=>assets[path],
    async model(path){
      if(!assets[path])throw new Error('Missing preview model '+path);
      const data=new Blob([bytes(assets[path])]).stream().pipeThrough(new DecompressionStream('gzip'));
      return new Response(data).arrayBuffer();
    }
  };
  ${bundle.outputFiles[0].text.replace(/[ \t]+$/gm,'')}
  reefGame.useEmbeddedReefAssets(embedded);
  window.sunpetalPreview={
    game:reefGame,
    illustrated:()=>new TextDecoder().decode(bytes(document.getElementById('reef-illustrated-data').textContent))
  };
})();
`;
const embed=[
  '<script type="application/json" id="reef-data">',
  JSON.stringify(assets,null,1),
  '</script>',
  '<script type="application/octet-stream" id="reef-illustrated-data">'+Buffer.from(illustrated).toString('base64')+'</script>',
  '<script>'+inline(runtime)+'</script>'
].join('\n');
if(!template.includes('<!-- bundled-preview -->'))throw new Error('Missing preview insertion point');
const html=template.replace('<!-- bundled-preview -->',()=>embed);
await mkdir(dirname(output),{recursive:true});
await writeFile(output,html);
console.log('Built '+output+' with '+Object.keys(assets).length+' embedded assets ('+Buffer.byteLength(html)+' bytes).');
