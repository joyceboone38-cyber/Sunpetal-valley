import * as T from './vendor/three.module.min.js';

const TAU = Math.PI * 2;

export function buildOpalCottage() {
  const house = new T.Group();
  house.name = 'Sunpetal Cottage';

  const brass = new T.MeshStandardMaterial({ color:'#edac5b', metalness:.44, roughness:.32 });
  const darkBrass = new T.MeshStandardMaterial({ color:'#6b3f47', metalness:.24, roughness:.44 });
  const plaster = new T.MeshStandardMaterial({ color:'#e2af9d', roughness:.73 });
  const stone = new T.MeshStandardMaterial({ color:'#a788a9', roughness:.72 });
  const foundation = new T.MeshStandardMaterial({ color:'#59426e', roughness:.82 });
  const window = new T.MeshStandardMaterial({ color:'#f8b36b', emissive:'#ff8e41', emissiveIntensity:.72, vertexColors:true, roughness:.38 });
  const roof = new T.MeshPhysicalMaterial({
    color:'#fff', vertexColors:true, roughness:.36, metalness:.19, clearcoat:.48,
    clearcoatRoughness:.24, iridescence:.66, iridescenceIOR:1.38,
    iridescenceThicknessRange:[160,370], side:T.DoubleSide
  });
  const lilac = new T.Color('#62409e');
  const opal = new T.Color('#74cde8');
  const rose = new T.Color('#ed8dce');

  function add(parent, geometry, material, x=0,y=0,z=0) {
    const object = new T.Mesh(geometry, material);
    object.position.set(x,y,z);
    object.receiveShadow = material !== window;
    object.castShadow = material !== window;
    parent.add(object);
    return object;
  }

  function molding(parent, material, points, thickness) {
    const spline = new T.CatmullRomCurve3(points.map(point=>new T.Vector3(...point)));
    return add(parent,new T.TubeGeometry(spline,Math.max(12,points.length*2),thickness,7),material);
  }

  function ellipse(parent, material, rx, rz, y, width) {
    const ring=add(parent,new T.TorusGeometry(1,width,7,48),material,0,y,0);
    ring.rotation.x=-Math.PI/2;
    ring.scale.set(rx,rz,1);
  }

  function level(parent, material, rx, rz, y, height, flare=0) {
    const cylinder=add(parent,new T.CylinderGeometry(1+flare,1,height,64),material,0,y,0);
    cylinder.scale.set(rx,1,rz);
    return cylinder;
  }

  function arch(parent, theta, width, bottom, height, rx, rz) {
    const plane = new T.Group();
    plane.position.set(Math.sin(theta)*rx,bottom,Math.cos(theta)*rz);
    plane.rotation.y = Math.atan2(Math.sin(theta)/rx,Math.cos(theta)/rz);
    parent.add(plane);

    const outline = new T.Shape();
    const spring=height-width*.52;
    outline.moveTo(-width/2,0);
    outline.lineTo(width/2,0);
    outline.lineTo(width/2,spring);
    outline.quadraticCurveTo(width*.47,height*.92,0,height);
    outline.quadraticCurveTo(-width*.47,height*.92,-width/2,spring);
    outline.closePath();

    const geometry=new T.ShapeGeometry(outline,18);
    const colors=[];
    const vertices=geometry.attributes.position;
    const warm = new T.Color('#8c351c');
    const light = new T.Color('#fff2af');
    for(let i=0;i<vertices.count;i++){
      const heightRatio=vertices.getY(i)/height;
      const tint=warm.clone().lerp(light,.25+.75*Math.sin(heightRatio*Math.PI*.82));
      colors.push(tint.r,tint.g,tint.b);
    }
    geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
    add(plane,geometry,window,0,0,.013);
    const frame=outline.getPoints(10).map(point=>[point.x,point.y,.039]);
    molding(plane,brass,frame,.042);
    const mullion = [[0,.035,.045],[0,spring*.75,.045],[0,height*.89,.045]];
    molding(plane,darkBrass,mullion,.018);
    for(const sign of [-1,1]) {
      const trace=[[sign*width*.04,height*.77,.049],[sign*width*.20,height*.54,.049],[sign*width*.40,height*.40,.049]];
      molding(plane,brass,trace,.013);
    }
  }

  function shellCanopy(parent, rx, rz, height, twist) {
    const point=(radius,theta)=>{
      const frill=Math.cos(theta*10);
      const lift=(.39*Math.cos(theta-.47)+.19*Math.sin(theta*2))*radius**4;
      const flare=1+(frill*.035+.065*Math.sin(theta*3))*radius**2;
      return [
        Math.sin(theta+twist*radius)*radius*rx*flare,
        height*(1-radius**1.25)+lift+frill*radius**2*.082,
        Math.cos(theta+twist*radius)*radius*rz*flare
      ];
    };
    const rings=16, sectors=100;
    const positions=[], colors=[], indices=[];
    for(let row=0;row<=rings;row++){
      const radius=.025+.975*row/rings;
      for(let sector=0;sector<=sectors;sector++){
        const theta=sector/sectors*TAU;
        positions.push(...point(radius,theta));
        const shimmer=.5+.5*Math.sin(theta*3+radius*8);
        const ribbon=.5+.5*Math.cos(theta*10+radius*2);
        const tint=lilac.clone().lerp(opal,shimmer*.70).lerp(rose,ribbon*.31);
        colors.push(tint.r,tint.g,tint.b);
        if(row<rings&&sector<sectors){
          const i=row*(sectors+1)+sector;
          indices.push(i,i+sectors+1,i+1,i+1,i+sectors+1,i+sectors+2);
        }
      }
    }
    const geometry=new T.BufferGeometry();
    geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
    geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    add(parent,geometry,roof);
    const edge=Array.from({length:61},(_,i)=>point(1,i/60*TAU));
    molding(parent,brass,edge,.046);
    for(let rib=0;rib<10;rib++){
      const angle=rib/10*TAU;
      const points=Array.from({length:13},(_,i)=>{
        const sample=point(.063+i*.937/12,angle);
        sample[1]+=.012;
        return sample;
      });
      molding(parent,rib%2===0?brass:darkBrass,points,rib%2===0?.027:.018);
    }
    const jewel=add(parent,new T.SphereGeometry(.12,16,10),brass,0,height+.13,0);
    jewel.scale.set(.8,1.6,.8);
  }

  function pavilion(x,z,rx,rz,height,canopy,twist,angles){
    const bay=new T.Group();
    bay.position.set(x,.29,z);
    house.add(bay);
    level(bay,foundation,rx*1.05,rz*1.06,.06,.24,.04);
    level(bay,plaster,rx,rz,height*.49,height*.96,-.035);
    ellipse(bay,brass,rx*1.02,rz*1.02,.19,.018);
    ellipse(bay,darkBrass,rx,rz,height*.91,.028);
    angles.forEach((theta,index)=>{
      const central=index===0;
      arch(bay,theta,central?Math.min(.85,rx*.72):Math.min(.64,rx*.54),central?.18:.54,
        height*(central?.73:.53),rx*1.005,rz*1.005);
    });
    const dome=new T.Group();
    dome.position.y=height*.93;
    bay.add(dome);
    shellCanopy(dome,rx*1.19,rz*1.23,canopy,twist);
  }

  // A tall fluted shell over the central room, with smaller overlapping side roofs.
  pavilion(-1.79,-.16,1.14,1.19,2.44,1.15,-.15,[0,-.69,.69,-1.4]);
  pavilion(1.83,-.38,1.16,1.26,2.27,1.40,.17,[0,-.76,.76,1.48]);
  pavilion(0,.25,1.67,1.55,3.02,1.73,.21,[0,-.51,.51,-.96,.96]);

  for(let i=0;i<4;i++){
    const z=1.77-i*.095;
    const width=1.23-i*.116;
    const depth=.91-i*.137;
    const step=add(house,new T.CylinderGeometry(1,1.025,.14,48),i%2===0?stone:plaster,0,.045+i*.124,z);
    step.scale.set(width,1,depth);
  }
  const light=new T.PointLight('#ffc07d',17,9,2);
  light.position.set(0,1.28,2.1);
  house.add(light);
  return house;
}
