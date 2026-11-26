#!/usr/bin/env python3
"""Download exact-name assets from current Grab3D official catalog, without guessed slugs.
Usage: python get_assets.py --dest public/assets/sunpetal --tint
Python 3.9+, standard library only. No credits, purchases, or API keys.
"""
import argparse,hashlib,json,pathlib,struct,sys,urllib.parse,urllib.request
ROOT=pathlib.Path(__file__).resolve().parent
API='https://grab3d.com/api/v1/models.json'

def fetch(url):
    parsed=urllib.parse.urlparse(url)
    if parsed.scheme!='https' or parsed.hostname not in ('grab3d.com','www.grab3d.com'):
        raise ValueError('Unapproved model host: '+url)
    req=urllib.request.Request(url,headers={'User-Agent':'SunpetalImporter/2.0','Accept':'application/json,model/gltf-binary,*/*'})
    with urllib.request.urlopen(req,timeout=80) as response:
        data=response.read(35_000_001)
    if len(data)>35_000_000:raise ValueError('Over 35 MB: '+url)
    return data

def valid_glb(data):
    return len(data)>=20 and data[:4]==b'glTF' and struct.unpack_from('<II',data,4)==(2,len(data))

def tint_glb(raw,hexcolor):
    if not valid_glb(raw):raise ValueError('Invalid GLB input')
    parts=[];off=12
    while off<len(raw):
        if off+8>len(raw):raise ValueError('Invalid chunk header')
        n,k=struct.unpack_from('<I4s',raw,off);off+=8
        if off+n>len(raw):raise ValueError('Invalid chunk size')
        parts.append((k,raw[off:off+n]));off+=n
    if not parts or parts[0][0]!=b'JSON':raise ValueError('Missing GLB JSON chunk')
    obj=json.loads(parts[0][1].rstrip(b' \x00'))
    rgb=[int(hexcolor[i:i+2],16)/255 for i in (1,3,5)]
    changes=0
    for material in obj.get('materials',[]):
        pbr=material.setdefault('pbrMetallicRoughness',{})
        if 'baseColorTexture' in pbr:continue
        old=pbr.get('baseColorFactor',[1,1,1,1]);pbr['baseColorFactor']=[round(old[i]*0.50+rgb[i]*0.50,5) for i in range(3)]+[old[3]]
        pbr['roughnessFactor']=min(0.72,pbr.get('roughnessFactor',1.0));changes+=1
    js=json.dumps(obj,separators=(',',':')).encode();js+=b' '*(-len(js)%4)
    parts[0]=(b'JSON',js)
    body=b''.join(struct.pack('<I4s',len(data),kind)+data for kind,data in parts)
    output=b'glTF'+struct.pack('<II',2,12+len(body))+body
    if not valid_glb(output):raise ValueError('Tint GLB failed validation')
    return output,changes

def normalized(name):
    return ' '.join(name.casefold().replace('&','and').replace('-',' ').split())

def match_model(item,models):
    target=normalized(item['name'])
    matched=[]
    for m in models:
        name=m.get('name',{})
        actual=name.get('en','') if isinstance(name,dict) else name
        if normalized(actual)==target:matched.append(m)
    if len(matched)==1:return matched[0]
    if not matched:raise ValueError('NOT IN CURRENT CATALOG: '+item['name']+'; no guessed slug or replacement')
    raise ValueError('AMBIGUOUS NAME: '+item['name']+' ('+str(len(matched))+' matches)')

def download(items,catalog,dest,tint=False,priority=2):
    models=catalog['models']
    if not isinstance(models,list):raise ValueError('Catalog missing models array')
    result=[]
    for item in items:
        if item['priority']>priority:continue
        record={k:item[k] for k in ('name','file','area','role','tint')}
        print('Checking',item['name'],flush=True)
        try:
            model=match_model(item,models)
            if model.get('license')!='CC0-1.0':raise ValueError('License not CC0-1.0: '+str(model.get('license')))
            glbs=[f for f in model.get('files',[]) if f.get('format')=='glb']
            if not glbs:raise ValueError('No GLB offered')
            chosen=next((f for f in glbs if f.get('variant')=='light'),None) or next((f for f in glbs if f.get('variant')=='full'),None) or glbs[0]
            if not chosen.get('url'):raise ValueError('No official GLB URL in catalog')
            raw=fetch(chosen['url'])
            if not valid_glb(raw):raise ValueError('Response is not valid GLB v2')
            path=dest/(item['file']+'.glb');path.write_bytes(raw)
            record.update(status='downloaded',slug=model['slug'],file_path=str(path),source=model.get('page'),download_url=chosen['url'],bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest(),license=model['license'],triangles=model.get('specs',{}).get('trianglesLight' if chosen.get('variant')=='light' else 'triangles'))
            if tint:
                tinted,n=tint_glb(raw,item['tint']);target=dest/(item['file']+'_tint.glb');target.write_bytes(tinted);record.update(tint_path=str(target),tinted_materials=n)
            print('  OK:',model['slug'])
        except Exception as e:
            record.update(status='FAILED',error=str(e));print('  FAIL:',e,file=sys.stderr)
        result.append(record)
    (dest/'asset-manifest.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    good=sum(r['status']=='downloaded' for r in result)
    print('Downloaded',good,'/',len(result),'models; see',dest/'asset-manifest.json')
    return good,len(result)

def main():
    p=argparse.ArgumentParser();p.add_argument('--dest',default='models');p.add_argument('--tint',action='store_true');p.add_argument('--priority',type=int,choices=(1,2),default=2);p.add_argument('--catalog',help='Optional previously downloaded official models.json for offline catalog testing');args=p.parse_args()
    destination=pathlib.Path(args.dest).resolve();destination.mkdir(parents=True,exist_ok=True)
    try:
        raw=pathlib.Path(args.catalog).read_bytes() if args.catalog else fetch(API)
        catalog=json.loads(raw)
        if not isinstance(catalog.get('models'),list):raise ValueError('Bad catalog schema')
    except Exception as e:
        print('Cannot load current official catalog:',e,file=sys.stderr)
        return 2
    items=json.loads((ROOT/'assets.json').read_text())
    ok,total=download(items,catalog,destination,args.tint,args.priority)
    return 0 if ok==total else 1
if __name__=='__main__':sys.exit(main())
