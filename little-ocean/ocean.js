import * as THREE from './vendor/three.module.min.js';

// Little Ocean — original procedural scene, 10 / Sumie, 2026-11-17.
// Metres are scene units. The aquarium is a small imagined reef, not a husbandry model.
const $ = id => document.getElementById(id);
const canvas = $('ocean');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const state = {time:0, mode:'drift', paused:reduced, lighting:'day', night:false, quality:'medium', feeding:0, sound:false, ready:false};
const clock = {value:0}, moon = {value:0}, cosmos = {value:0};
const rand = (() => {let n=10718;return () => {n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};})();
const range = (a,b) => a+(b-a)*rand();
const clamp = THREE.MathUtils.clamp;
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x205664, .012);
const camera = new THREE.PerspectiveCamera(42,1,.08,180);
let renderer;
try {renderer = new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'default'});}
catch(error){$('loading').hidden=true;$('failure').hidden=false;throw error;}
renderer.setClearColor(0x082b32,0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.04;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const ambient = new THREE.HemisphereLight(0xc6ffff,0x4a5b5f,2.25);
const sun = new THREE.DirectionalLight(0xffeed1,3.0);sun.position.set(-6,15,7);
const rim = new THREE.DirectionalLight(0x75d8e3,1.8);rim.position.set(7,6,-9);
sun.castShadow=true;sun.shadow.mapSize.set(1536,1536);sun.shadow.camera.left=-19;sun.shadow.camera.right=19;sun.shadow.camera.top=16;sun.shadow.camera.bottom=-16;sun.shadow.camera.far=50;sun.shadow.normalBias=.04;sun.shadow.bias=-.0002;
scene.add(ambient,sun,rim);
const reef = new THREE.Group();scene.add(reef);
const glass = new THREE.Group();scene.add(glass);
const dummy = new THREE.Object3D(), vec = new THREE.Vector3(), target = new THREE.Vector3();
const colliders = [];

function join(geometries){
  const positions=[],normals=[],colors=[],uvs=[];
  for(let geo of geometries){
    const g=geo.index?geo.toNonIndexed():geo;
    const p=g.getAttribute('position'),n=g.getAttribute('normal'),c=g.getAttribute('color'),uv=g.getAttribute('uv');
    for(let i=0;i<p.count;i++){
      positions.push(p.getX(i),p.getY(i),p.getZ(i));
      normals.push(n?n.getX(i):0,n?n.getY(i):1,n?n.getZ(i):0);
      colors.push(c?c.getX(i):1,c?c.getY(i):1,c?c.getZ(i):1);
      uvs.push(uv?uv.getX(i):0,uv?uv.getY(i):0);
    }
    if(g!==geo)g.dispose();geo.dispose();
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  g.computeBoundingSphere();return g;
}
function colorize(geo,color){const c=new THREE.Color(color),a=[];for(let i=0;i<geo.attributes.position.count;i++)a.push(c.r,c.g,c.b);geo.setAttribute('color',new THREE.Float32BufferAttribute(a,3));return geo;}
const causticGLSL=`
  float waterLight(vec3 p, float t) {
    vec2 a=p.xz*1.6+vec2(p.y*.2,0.);
    a+=vec2(sin(a.y*.72+t*.53),cos(a.x*.83-t*.4))*1.25;
    a+=vec2(sin(a.y*1.3-a.x*.8-t*.23),cos(a.x*1.1+a.y*.9+t*.28))*.45;
    float f=sin(a.x*3.1+a.y*1.2+t*.65)*sin(a.y*3.4-a.x*.7-t*.57);
    return pow(1.-abs(f),18.);
  }
`;
function material(color, {sway=0,fish=false,manta=false,roughness=.8,starlight=0}={}){
  const m=new THREE.MeshStandardMaterial({color,roughness,metalness:.04,vertexColors:true,side:THREE.DoubleSide});
  m.onBeforeCompile=shader=>{
    shader.uniforms.uTime=clock;shader.uniforms.uMoon=moon;shader.uniforms.uCosmos=cosmos;
    shader.vertexShader='uniform float uTime; varying vec3 vSea;\n'+shader.vertexShader;
    let deform='';
    if(sway)deform=`float root=pow(max(position.y,0.)/${sway>1?'5.8':'1.8'},1.6); transformed.x+=sin(uTime*.65+position.y*.8+instanceMatrix[3].x*.31+instanceMatrix[3].z*.27)*root*${sway}; transformed.z+=cos(uTime*.47+position.y+instanceMatrix[3].z*.4)*root*.23;`;
    if(fish)deform='float bend=max(0.,.25-position.x);transformed.z+=sin(uTime*7.+position.x*5.+instanceMatrix[3].x)*bend*bend*.24;';
    if(manta)deform='float wing=abs(position.x)/2.5;transformed.y+=sin(uTime*1.55-wing*2.)*wing*wing*.8;';
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n'+deform);
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`vec4 wp=vec4(transformed,1.);\n#ifdef USE_INSTANCING\nwp=instanceMatrix*wp;\n#endif\nvSea=(modelMatrix*wp).xyz;\n#include <project_vertex>`);
    shader.fragmentShader='uniform float uTime;uniform float uMoon;uniform float uCosmos;varying vec3 vSea;\n'+causticGLSL+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>\nfloat caustic=waterLight(vSea,uTime);diffuseColor.rgb*=.82+max(0.,vSea.y)*.025; diffuseColor.rgb+=vec3(.32,.46,.37)*caustic*(1.-uMoon*.82)*.24;`);
    // Emission belongs to the swimming mesh, so fins, eyes and silhouettes remain real.
    const glow=fish?2.1:manta?.58:sway?.22:starlight;
    if(glow)shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>\nfloat skin=max(diffuseColor.r,max(diffuseColor.g,diffuseColor.b));vec3 starTint=mix(diffuseColor.rgb,vec3(.50,.65,1.)*skin,.34);float pulse=.88+.12*sin(uTime*.72+vSea.x*.23+vSea.z*.19);totalEmissiveRadiance+=starTint*uCosmos*${glow.toFixed(2)}*pulse;`);
  };
  m.customProgramCacheKey=()=>`${sway}/${fish}/${manta}/${starlight}`;
  return m;
}
const sandMat=material(0xd9cbb0),rockMat=material(0xffffff),plantMat=material(0xffffff,{sway:1.8}),grassMat=material(0xffffff,{sway:.42});
const coralMat=material(0xffffff,{starlight:.32});
const rockCompile=rockMat.onBeforeCompile;
rockMat.onBeforeCompile=shader=>{rockCompile(shader);shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>\nfloat grain=fract(sin(dot(floor(vSea*38.),vec3(127.1,311.7,74.7)))*43758.5453);float mottle=sin(vSea.x*4.2+sin(vSea.z*3.))*sin(vSea.y*6.4+vSea.z*2.);diffuseColor.rgb*=.80+grain*.20+mottle*.13;`);};
rockMat.customProgramCacheKey=()=> 'reef-limestone';

// A gently rippled sand bed, its grains and shadows generated on the CPU.
function floorHeight(x,z){return .32+.1*Math.sin(x*.5+z*.4)+.06*Math.sin(x*.9-z*.7);}
const sand=new THREE.PlaneGeometry(26,16,120,80);sand.rotateX(-Math.PI/2);
const sp=sand.attributes.position,sc=[];
for(let i=0;i<sp.count;i++){
  const x=sp.getX(i),z=sp.getZ(i);sp.setY(i,floorHeight(x,z)+.028*Math.sin(x*8+Math.sin(z*1.9)));
  let shade=.87+range(0,.1)+.07*Math.sin(x*8+Math.sin(z*1.9));
  // Soft contact shadows beneath reef islands, with a light path between them.
  shade*=1-.38*Math.exp(-((x+7)**2/13+(z+1)**2/14));shade*=1-.3*Math.exp(-((x-7)**2/12+(z+2)**2/13));
  sc.push(shade,shade,shade*.96);
}
sand.setAttribute('color',new THREE.Float32BufferAttribute(sc,3));sand.computeVertexNormals();
const seabed=new THREE.Mesh(sand,sandMat);seabed.receiveShadow=true;reef.add(seabed);
const plinth=new THREE.Mesh(new THREE.BoxGeometry(26.3,.42,16.3),new THREE.MeshStandardMaterial({color:0x123d42,roughness:.32,metalness:.38}));plinth.position.y=-.04;scene.add(plinth);
const under=new THREE.Mesh(new THREE.BoxGeometry(25.4,.14,15.4),new THREE.MeshStandardMaterial({color:0x061e2a,roughness:.6}));under.position.y=-.32;scene.add(under);

// Limestone islands and one broad arch; shared material and a single merged draw.
const stones=[];
function stone(x,y,z,sx,sy,sz,collision=true){
  const g=new THREE.SphereGeometry(1,22,14),p=g.attributes.position,c=[];
  for(let i=0;i<p.count;i++){
    const a=p.getX(i),b=p.getY(i),d=p.getZ(i),f=1+.085*Math.sin(a*7+d*3)*Math.cos(b*6)+.035*Math.sin(d*13+b*8);
    p.setXYZ(i,a*f,b*f,d*f);
    const moss=clamp(b*.35+.25+Math.sin(a*6+d*3)*.13,0,.6);
    const col=new THREE.Color(0x9b9b86).lerp(new THREE.Color(0x345b43),moss).multiplyScalar(.65+.21*(b+1)/2+.12*Math.sin(d*9+a*3));c.push(col.r,col.g,col.b);
  }
  g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));g.computeVertexNormals();g.scale(sx,sy,sz);g.rotateY(range(-1,1));g.translate(x,y,z);stones.push(g);
  if(collision)colliders.push({x,y,z,r:Math.min(sx,sy,sz)*.85});
}
stone(-8,1.4,-1.8,3.5,2.3,3);stone(-9.5,2.8,-3.3,2.3,3.6,2.5);stone(-7,3.1,-4.4,2.2,4.0,1.8);
stone(7.3,1.5,-1.5,3.4,2.2,3.0);stone(9,2.4,-4,2.6,3.2,2.2);stone(5.4,1.0,-3.2,2.5,1.3,2.1);
stone(-4.5,.5,4.1,2.1,.8,1.5);stone(7.4,.8,4.5,2.5,1.1,1.2);
// An elliptical arch opening keeps a genuine traversable gap at its centre.
for(let i=0;i<=14;i++){
  const a=i/14*Math.PI,x=-3.2+4.2*Math.cos(a),y=.8+4.6*Math.sin(a),z=-1.9+.3*Math.sin(a*2);
  stone(x,y,z,1.02,.9,.98,true);
}
for(let i=0;i<42;i++){
  const x=range(-12,12),z=range(-7,7),s=range(.08,.32);stone(x,floorHeight(x,z),z,s,s*.7,s*1.3,false);
}
const stoneMesh=new THREE.Mesh(join(stones),rockMat);stoneMesh.castShadow=true;stoneMesh.receiveShadow=true;reef.add(stoneMesh);

// Instanced ribbon vegetation: the rooted base stays still; the tips follow the current.
function ribbon(height,width,segments=12){
  const pos=[],uv=[],idx=[];
  for(let i=0;i<=segments;i++){
    const f=i/segments,w=width*Math.sin(Math.PI*Math.pow(f,.72))*.5;
    for(let side of [-1,1]){pos.push(Math.sin(f*3)*height*.13+side*w,f*height,Math.sin(f*4)*height*.07);uv.push((side+1)/2,f);}
    if(i<segments){let a=i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
const kelpParts=[];
for(let i=0;i<9;i++){
  const h=.5+i*.53;
  for(let side of [-1,1]){const g=ribbon(1.4,.55,8);g.rotateZ(side*(-.7-i*.018));g.rotateY(i*1.4);g.translate(Math.sin(h)*.08,h,0);kelpParts.push(g);}
}
const stem=new THREE.CylinderGeometry(.025,.065,5.8,5,10);stem.translate(0,2.9,0);kelpParts.push(stem);
const kelps=new THREE.InstancedMesh(join(kelpParts),plantMat,74);
for(let i=0;i<74;i++){
  const side=i<42?-1:1,x=side*range(6.4,11.9),z=range(-6.8,-.5),scale=range(.64,1.26);
  dummy.position.set(x,floorHeight(x,z),z);dummy.rotation.set(0,range(0,6.28),range(-.07,.07));dummy.scale.setScalar(scale);dummy.updateMatrix();kelps.setMatrixAt(i,dummy.matrix);
  kelps.setColorAt(i,new THREE.Color().setHSL(range(.32,.43),range(.25,.55),range(.24,.42)));
}kelps.frustumCulled=false;kelps.castShadow=true;kelps.receiveShadow=true;reef.add(kelps);
const blades=new THREE.InstancedMesh(ribbon(1.8,.18,9),grassMat,950);
for(let i=0;i<950;i++){
  const x=range(-12.5,12.5),z=range(-7.3,6.2);
  const path=Math.abs(x+1.1*Math.sin(z*.6))<2.0;
  dummy.position.set(x,floorHeight(x,z),z);dummy.rotation.set(0,range(0,6.28),range(-.28,.28));
  const h=path?range(.07,.22):range(.25,.85);dummy.scale.set(range(.6,1.6),h,1);dummy.updateMatrix();blades.setMatrixAt(i,dummy.matrix);
  blades.setColorAt(i,new THREE.Color().setHSL(range(.32,.46),.42,range(.22,.43)));
}blades.frustumCulled=false;reef.add(blades);

// Coral fans and small rounded colonies add quiet pink and apricot punctuation.
const branches=[];
function branch(a,b,r,color){
  const dir=b.clone().sub(a),g=new THREE.CylinderGeometry(r*.55,r,dir.length(),5,1);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),dir.clone().normalize()));
  g.translate(...a.clone().add(b).multiplyScalar(.5).toArray());colorize(g,color);branches.push(g);
}
function fan(x,y,z,size,color){
  const origin=new THREE.Vector3(x,y,z);
  for(let j=0;j<11;j++){
    const ang=-1.23+j/10*2.46;
    let prev=origin.clone();
    for(let k=1;k<=5;k++){
      const f=k/5,next=new THREE.Vector3(x+Math.sin(ang)*size*f,y+Math.cos(ang)*size*f,z+.12*Math.sin(j+f*3));
      branch(prev,next,.037*(1-f*.6)*size,color);
      if(k>1){const tip=next.clone().add(new THREE.Vector3(Math.sin(ang+.5)*size*.23,Math.cos(ang+.5)*size*.23,.04));branch(next,tip,.018*size,color);}
      prev=next;
    }
  }
}
fan(-8,2.1,1.2,2.0,0xd99589);fan(7.2,2,-.3,1.7,0xdfab86);fan(10,1,3,1.25,0x9684bb);fan(-3.9,.65,4.2,.85,0xe7b39e);
const coralMounds=[];
for(let i=0;i<48;i++){
  const side=i<24?-1:1,x=side*range(5.8,10.3),z=range(-.5,4.0),r=range(.12,.42);
  const g=new THREE.SphereGeometry(r,8,6);g.scale(1,.75,1);g.translate(x,floorHeight(x,z)+r*.5,z);
  colorize(g,new THREE.Color().setHSL(i%3===0?.02:.46,.24,range(.43,.62)));coralMounds.push(g);
}
reef.add(new THREE.Mesh(join(branches),coralMat),new THREE.Mesh(join(coralMounds),coralMat));

// Fish are real mesh silhouettes, including eyes, forked tails, dorsal and side fins.
function fishGeometry(){
  const parts=[],body=new THREE.SphereGeometry(1,14,9);body.scale(.54,.21,.115);colorize(body,0xffffff);parts.push(body);
  function fin(vertices,color){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.computeVertexNormals();colorize(g,color);parts.push(g);}
  fin([-.4,0,0,-.88,.32,0,-.73,0,0,-.4,0,0,-.73,0,0,-.88,-.32,0],0xd9eee0);
  fin([.14,.14,0,-.16,.39,0,-.39,.12,0],0xb1d5ce);
  fin([.1,-.02,.07,-.18,-.14,.31,-.25,-.08,.09,.1,-.02,-.07,-.25,-.08,-.09,-.18,-.14,-.31],0xc7dcd6);
  for(let sign of [-1,1]){
    const eye=new THREE.SphereGeometry(.035,7,5);eye.translate(.32,.065,sign*.09);colorize(eye,0x172c35);parts.push(eye);
    const iris=new THREE.SphereGeometry(.012,6,4);iris.translate(.33,.075,sign*.118);colorize(iris,0xffffff);parts.push(iris);
  }return join(parts);
}
const FISH_COUNT=156,fishMesh=new THREE.InstancedMesh(fishGeometry(),material(0xffffff,{fish:true,roughness:.43}),FISH_COUNT);
fishMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);fishMesh.frustumCulled=false;reef.add(fishMesh);
const fishes=[],palettes=[0x66cbd5,0xeeac83,0xd4d9a0,0x8acbc0];
for(let i=0;i<FISH_COUNT;i++){
  const school=i%4,scale=range(.35,.75)*(school===2?1.2:1);
  fishes.push({p:new THREE.Vector3(range(-10,10),range(1.2,7.6),range(-6,6)),v:new THREE.Vector3(range(-1,1),range(-.2,.2),range(-1,1)),scale,school,phase:range(0,6.28)});
  fishMesh.setColorAt(i,new THREE.Color(palettes[school]).multiplyScalar(range(.78,1.17)));
}
const fishX=new THREE.Vector3(1,0,0),steer=new THREE.Vector3(),avoid=new THREE.Vector3(),feedPoint=new THREE.Vector3(0,4,3.8);
function updateFish(dt){
  const t=state.time;
  for(let i=0;i<FISH_COUNT;i++){
    const f=fishes[i],s=f.school,phase=t*(.13+s*.021)+s*1.73;
    target.set(Math.sin(phase)*7.4,3.1+s*.92+Math.sin(phase*1.2)*.75,Math.cos(phase*.8)*4.1);
    if(state.feeding>0)target.copy(feedPoint).add(vec.set(Math.sin(f.phase+t)*1.2,Math.sin(f.phase*3+t)*.7,Math.cos(f.phase+t)*1.2));
    target.x+=Math.sin(f.phase+t*.3)*1.25;target.z+=Math.cos(f.phase*1.3+t*.2)*1.1;
    steer.copy(target).sub(f.p).multiplyScalar(.24);
    // Neighbour separation; one school shares a slow moving centre and current.
    for(let j=s;j<FISH_COUNT;j+=4){
      if(j===i)continue;avoid.copy(f.p).sub(fishes[j].p);const d2=avoid.lengthSq();
      if(d2>.0001&&d2<.7)steer.addScaledVector(avoid,.5/(d2+.06));
    }
    for(const c of colliders){avoid.set(f.p.x-c.x,f.p.y-c.y,f.p.z-c.z);const d=avoid.length();if(d<c.r+.95)steer.addScaledVector(avoid,(c.r+.95-d)*2.2/(d+.01));}
    if(Math.abs(f.p.x)>11.3)steer.x-=Math.sign(f.p.x)*(Math.abs(f.p.x)-11.3)*2;
    if(Math.abs(f.p.z)>6.5)steer.z-=Math.sign(f.p.z)*(Math.abs(f.p.z)-6.5)*2;
    if(f.p.y<1.1)steer.y+=2;if(f.p.y>9)steer.y-=2;
    f.v.addScaledVector(steer,dt);const speed=f.v.length(),wanted=state.feeding>0?1.55:1.04;
    if(speed>0)f.v.multiplyScalar(THREE.MathUtils.lerp(1,wanted/speed,Math.min(dt*2,1)));
    f.p.addScaledVector(f.v,dt);
    dummy.position.copy(f.p);dummy.quaternion.setFromUnitVectors(fishX,vec.copy(f.v).normalize());dummy.scale.setScalar(f.scale);dummy.updateMatrix();fishMesh.setMatrixAt(i,dummy.matrix);
  }fishMesh.instanceMatrix.needsUpdate=true;
}

// One unhurried manta, dark on top and ivory underneath. Tips flex along the span.
function mantaGeometry(){
  const pos=[],idx=[],col=[];const nx=40,nz=16;
  for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
    const x=(i/nx*2-1)*2.5,u=Math.abs(x)/2.5,v=j/nz;
    const front=-.85+Math.pow(u,.8)*1.35,back=1.15-u*.68;
    const z=THREE.MathUtils.lerp(front,back,v),y=.12*Math.sin(v*Math.PI)*(1-u)-u*u*.2;
    pos.push(x,y,z);const c=new THREE.Color(0x477f86).lerp(new THREE.Color(0x9ba9a0),u*.3+v*.15);col.push(c.r,c.g,c.b);
    if(i<nx&&j<nz){const a=j*(nx+1)+i;idx.push(a,a+nx+1,a+1,a+1,a+nx+1,a+nx+2);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.setIndex(idx);g.computeVertexNormals();return g;
}
const manta=new THREE.Group(),wingMat=material(0xffffff,{manta:true,roughness:.5});
const oldCompile=wingMat.onBeforeCompile;wingMat.onBeforeCompile=shader=>{oldCompile(shader);shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nif(!gl_FrontFacing)diffuseColor.rgb=vec3(.67,.75,.65);');};
manta.add(new THREE.Mesh(mantaGeometry(),wingMat));
const tailPath=new THREE.CatmullRomCurve3([new THREE.Vector3(0,0,.8),new THREE.Vector3(0,-.04,1.7),new THREE.Vector3(.1,-.12,2.7),new THREE.Vector3(.28,-.22,3.3)]);
const tail=new THREE.Mesh(new THREE.TubeGeometry(tailPath,18,.025,5,false),material(0x456b70,{starlight:.6}));manta.add(tail);
for(let sign of [-1,1]){
  const horn=new THREE.Mesh(new THREE.CapsuleGeometry(.09,.4,3,6),material(0x729d9d));horn.rotation.x=Math.PI/2;horn.position.set(sign*.29,.03,-.85);manta.add(horn);
  const eye=new THREE.Mesh(new THREE.SphereGeometry(.045,8,6),new THREE.MeshBasicMaterial({color:0x142d36}));eye.position.set(sign*.4,.1,-.52);manta.add(eye);
}reef.add(manta);

// A little coffee cup waits on the sand, on the sheltered side of the arch.
const cup=new THREE.Group(),cupMat=material(0xf0e7cb,{starlight:.12}),goldMat=material(0xc9ac6f,{starlight:.7});
const saucer=new THREE.Mesh(new THREE.CylinderGeometry(.39,.3,.055,32),cupMat);saucer.position.y=.035;cup.add(saucer);
const bowl=new THREE.Mesh(new THREE.CylinderGeometry(.24,.16,.36,28,1,true),cupMat);bowl.position.y=.23;cup.add(bowl);
const coffee=new THREE.Mesh(new THREE.CircleGeometry(.222,28),new THREE.MeshStandardMaterial({color:0x271d16,roughness:.18}));coffee.rotation.x=-Math.PI/2;coffee.position.y=.375;cup.add(coffee);
const lip=new THREE.Mesh(new THREE.TorusGeometry(.235,.012,6,32),goldMat);lip.rotation.x=Math.PI/2;lip.position.y=.41;cup.add(lip);
const handle=new THREE.Mesh(new THREE.TorusGeometry(.13,.035,6,18),cupMat);handle.position.set(.27,.25,0);cup.add(handle);
cup.position.set(-2.0,floorHeight(-2,2.3),2.3);cup.rotation.y=.3;reef.add(cup);

// Surface reflections. Explicit bounded geometry avoids screen-aligned square artifacts.
const surfaceMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
  uniforms:{uTime:clock,uMoon:moon,uCosmos:cosmos},
  vertexShader:`varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`uniform float uTime,uMoon,uCosmos;varying vec3 vP;${causticGLSL}void main(){float w=waterLight(vec3(vP.x,0.,vP.y),uTime);float edge=pow(max(abs(vP.x)/13.,abs(vP.y)/8.),12.);gl_FragColor=vec4(mix(vec3(.34,.69,.69),vec3(.2,.39,.55),uMoon)+w*.14,(.025+w*.045+edge*.10)*(1.-uCosmos*.85));}`});
const surface=new THREE.Mesh(new THREE.PlaneGeometry(26,16),surfaceMat);surface.rotation.x=-Math.PI/2;surface.position.y=10.6;glass.add(surface);
const tankEdges=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(26,10.4,16)),new THREE.LineBasicMaterial({color:0xa8d7d4,transparent:true,opacity:.18}));tankEdges.position.y=5.2;glass.add(tankEdges);
const glassMat=new THREE.MeshBasicMaterial({color:0x9bddd7,transparent:true,opacity:.025,depthWrite:false,side:THREE.DoubleSide});
for(const x of [-13,13]){const panel=new THREE.Mesh(new THREE.PlaneGeometry(16,10.4),glassMat);panel.position.set(x,5.2,0);panel.rotation.y=Math.PI/2;glass.add(panel);}

// Suspended dust, faint bubbles and soft shafts. Everything is procedural.
const particlesGeo=new THREE.BufferGeometry(),particles=[],seeds=[];
for(let i=0;i<520;i++){particles.push(range(-12.7,12.7),range(.6,10.2),range(-7.8,7.8));seeds.push(rand());}
particlesGeo.setAttribute('position',new THREE.Float32BufferAttribute(particles,3));particlesGeo.setAttribute('aSeed',new THREE.Float32BufferAttribute(seeds,1));
const particlesMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{uTime:clock,uMoon:moon},
  vertexShader:`uniform float uTime;attribute float aSeed;varying float vA;void main(){vec3 p=position;p.y=.6+mod(p.y-.6+uTime*(.025+aSeed*.045),9.6);p.x+=sin(uTime*.13+aSeed*60.)*.14;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp((aSeed>.97?55.:22.)/(-mv.z),1.,5.);vA=.08+aSeed*.25;}`,
  fragmentShader:`varying float vA;uniform float uMoon;void main(){float r=length(gl_PointCoord-.5);float a=1.-smoothstep(.12,.5,r);gl_FragColor=vec4(mix(vec3(.63,.89,.86),vec3(.3,.8,1.),uMoon),a*vA);}`});
reef.add(new THREE.Points(particlesGeo,particlesMat));
const shafts=new THREE.Group();reef.add(shafts);
for(let i=0;i<7;i++){
  const h=10,w=range(.45,1.2),g=new THREE.PlaneGeometry(w,h);
  const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,uniforms:{uTime:clock,uMoon:moon,uCosmos:cosmos,uSeed:{value:i}},
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec2 vUv;uniform float uTime,uMoon,uCosmos,uSeed;void main(){float x=pow(sin(vUv.x*3.14159),2.);float y=smoothstep(0.,.35,vUv.y)*(1.-smoothstep(.87,1.,vUv.y));float a=x*y*.055*(.75+.25*sin(uTime*.2+uSeed))*(1.-uCosmos);gl_FragColor=vec4(mix(vec3(.65,.84,.65),vec3(.25,.43,.8),uMoon),a);}`});
  const ray=new THREE.Mesh(g,mat);ray.position.set(-8+i*2.6,5.5,-3+range(-1,1));ray.rotation.z=-.19;shafts.add(ray);
}

// One point per fish: a soft, depth-tested halo follows its real position.
// Fixed buffers and two extra draws keep Cosmos light enough for a phone.
const starProjection={value:1},starPixelRatio={value:1};
const glowPositions=new Float32Array(FISH_COUNT*3),glowSeeds=[],glowSizes=[],glowColors=[];
const stellarPalette=[0x9fdfff,0xffdbb0,0xc8baff,0xabede4];
for(let i=0;i<FISH_COUNT;i++){
  const f=fishes[i],c=new THREE.Color(stellarPalette[f.school]);
  glowSeeds.push(f.phase);glowSizes.push(f.scale);glowColors.push(c.r,c.g,c.b);
}
const glowGeo=new THREE.BufferGeometry();
glowGeo.setAttribute('position',new THREE.BufferAttribute(glowPositions,3).setUsage(THREE.DynamicDrawUsage));
glowGeo.setAttribute('aSeed',new THREE.Float32BufferAttribute(glowSeeds,1));
glowGeo.setAttribute('aSize',new THREE.Float32BufferAttribute(glowSizes,1));
glowGeo.setAttribute('color',new THREE.Float32BufferAttribute(glowColors,3));
const glowMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending,vertexColors:true,
  uniforms:{uTime:clock,uCosmos:cosmos,uProjection:starProjection},
  vertexShader:`uniform float uProjection;attribute float aSeed,aSize;varying vec3 vColor;varying float vSeed;void main(){vColor=color;vSeed=aSeed;vec4 mv=modelViewMatrix*vec4(position,1.);mv.z+=aSize*.24;gl_Position=projectionMatrix*mv;gl_PointSize=clamp(aSize*2.8*uProjection/max(.1,-mv.z),4.,64.);}`,
  fragmentShader:`uniform float uTime,uCosmos;varying vec3 vColor;varying float vSeed;void main(){vec2 p=(gl_PointCoord-.5)*2.;float r=length(p);float edge=1.-smoothstep(.72,1.,r);float halo=exp(-r*r*6.)*.20;float core=exp(-r*r*90.)*.65;float ray=(exp(-abs(p.x)*65.)*exp(-abs(p.y)*7.)+exp(-abs(p.y)*65.)*exp(-abs(p.x)*7.))*.16;float pulse=.82+.18*sin(uTime*.8+vSeed);gl_FragColor=vec4(vColor,(halo+core+ray)*edge*pulse*uCosmos);}`});
const fishGlow=new THREE.Points(glowGeo,glowMat);fishGlow.frustumCulled=false;fishGlow.visible=false;scene.add(fishGlow);

// A seeded sky around the viewer; changing light never respawns the living reef.
let skySeed=718107;
const skyRandom=()=>{skySeed=(Math.imul(skySeed,1664525)+1013904223)>>>0;return skySeed/4294967296;};
const skyPos=[],skySeeds=[];
for(let i=0;i<1400;i++){
  const y=skyRandom()*2-1,a=skyRandom()*Math.PI*2,r=70+skyRandom()*30,s=Math.sqrt(1-y*y);
  skyPos.push(Math.cos(a)*s*r,y*r,Math.sin(a)*s*r);skySeeds.push(skyRandom());
}
const skyGeo=new THREE.BufferGeometry();skyGeo.setAttribute('position',new THREE.Float32BufferAttribute(skyPos,3));skyGeo.setAttribute('aSeed',new THREE.Float32BufferAttribute(skySeeds,1));
const skyMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending,
  uniforms:{uTime:clock,uCosmos:cosmos,uPixelRatio:starPixelRatio},
  vertexShader:`uniform float uPixelRatio;attribute float aSeed;varying float vSeed;void main(){vSeed=aSeed;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=(1.+pow(aSeed,5.)*2.8)*uPixelRatio;}`,
  fragmentShader:`uniform float uTime,uCosmos;varying float vSeed;void main(){float r=length(gl_PointCoord-.5)*2.;float a=1.-smoothstep(.1,1.,r);vec3 c=mix(vec3(.52,.65,1.),vec3(1.,.84,.67),vSeed);float pulse=.65+.18*sin(uTime*.5+vSeed*70.);gl_FragColor=vec4(c,a*(.25+vSeed*.5)*pulse*uCosmos);}`});
const starSky=new THREE.Points(skyGeo,skyMat);starSky.frustumCulled=false;starSky.visible=false;scene.add(starSky);
const fogDay=new THREE.Color(0x205664),fogMoon=new THREE.Color(0x143445),fogCosmos=new THREE.Color(0x080d24);
function updateCosmos(){
  const active=cosmos.value>.001;fishGlow.visible=starSky.visible=active;
  if(!active)return;
  starProjection.value=canvas.height/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)));
  starPixelRatio.value=renderer.getPixelRatio();starSky.position.copy(camera.position);
  glowGeo.setDrawRange(0,fishMesh.count);
  for(let i=0;i<fishMesh.count;i++)fishes[i].p.toArray(glowPositions,i*3);
  glowGeo.attributes.position.needsUpdate=true;
}

// Outside orbit and inside swimming share one persistent scene.
let width=1,height=1,orbitAngle=.38,orbitPitch=.23,orbitZoom=1,orbitHold=0,swimYaw=0,swimPitch=0;
const swimPosition=new THREE.Vector3(0,4.1,6.2),look=new THREE.Vector3(),desired=new THREE.Vector3(),orbitTarget=new THREE.Vector3(0,4.3,0);
let transition=0;
function orbitFitDistance(){return Math.max(40,19.3/(Math.tan(42*Math.PI/360)*camera.aspect));}
function setOrbitZoom(zoom){
  // Allow the same close inspection on a tall phone and a wide tablet.
  // Keep the outside camera beyond the tank's bounding sphere at every angle.
  orbitZoom=clamp(zoom,22/orbitFitDistance(),1.55);
}
function resize(){
  width=innerWidth;height=innerHeight;camera.aspect=width/height;camera.updateProjectionMatrix();
  setOrbitZoom(orbitZoom);
  const ratio={low:1,medium:Math.min(devicePixelRatio,1.5),high:Math.min(devicePixelRatio,2)}[state.quality];
  renderer.setPixelRatio(ratio);renderer.setSize(width,height,false);
}
addEventListener('resize',resize);resize();
function orbitPosition(){
  // Horizontal FOV drives framing in a narrow Stage Manager window.
  const fit=orbitFitDistance();
  const dist=fit*orbitZoom;
  desired.set(Math.sin(orbitAngle)*Math.cos(orbitPitch)*dist,4.3+Math.sin(orbitPitch)*dist,Math.cos(orbitAngle)*Math.cos(orbitPitch)*dist);
  // The composition leaves room for the title; the scene centre is slightly low.
  orbitTarget.set(0,4.3+(height<570?2.0:1.5),0);
}
const keys=new Set(),joy={x:0,y:0},lift={up:false,down:false};
function updateCamera(dt){
  if(state.mode==='drift'){
    if(!state.paused&&performance.now()>orbitHold)orbitAngle+=dt*.024;
    orbitPitch=clamp(orbitPitch,.04,.75);orbitPosition();look.copy(orbitTarget);
  }else{
    const forward=(keys.has('w')||keys.has('arrowup')?1:0)-(keys.has('s')||keys.has('arrowdown')?1:0)-joy.y;
    const strafe=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0)+joy.x;
    const vertical=(keys.has('e')||lift.up?1:0)-(keys.has('q')||lift.down?1:0);
    const direction=new THREE.Vector3(Math.sin(swimYaw)*Math.cos(swimPitch),Math.sin(swimPitch),-Math.cos(swimYaw)*Math.cos(swimPitch));
    const delta=new THREE.Vector3().copy(direction).multiplyScalar(forward).add(new THREE.Vector3(Math.cos(swimYaw),0,Math.sin(swimYaw)).multiplyScalar(strafe));
    delta.y+=vertical;if(delta.lengthSq()>1)delta.normalize();swimPosition.addScaledVector(delta,dt*2.8);
    swimPosition.x=clamp(swimPosition.x,-12.15,12.15);swimPosition.z=clamp(swimPosition.z,-7.15,7.15);swimPosition.y=clamp(swimPosition.y,.9,9.7);
    for(const c of colliders){vec.set(swimPosition.x-c.x,swimPosition.y-c.y,swimPosition.z-c.z);const d=vec.length(),r=c.r+.35;if(d<r){if(d<.001)vec.set(0,1,0);else vec.divideScalar(d);swimPosition.set(c.x,c.y,c.z).addScaledVector(vec,r);}}
    desired.copy(swimPosition);look.copy(desired).addScaledVector(direction,6);
    $('depth').textContent=`${Math.max(0,10.6-swimPosition.y).toFixed(1)} M`;
  }
  const smoothing=state.mode==='drift'&&transition===0?1:1-Math.exp(-dt*(transition>0?2.4:12));camera.position.lerp(desired,smoothing);
  const q=camera.quaternion.clone();camera.lookAt(look);q.slerp(camera.quaternion,smoothing);camera.quaternion.copy(q);
  // Framing pulls the outside camera back on narrow screens. That extra air
  // must not make the water opaque. Keep its optical depth tied to the reef.
  const distance=camera.position.distanceTo(orbitTarget);
  scene.fog.density=(state.mode==='swim'?.048:.012*Math.min(1,40/distance))*(1.-cosmos.value*.4);
  transition=Math.max(0,transition-dt);
}
orbitPosition();camera.position.copy(desired);camera.lookAt(orbitTarget);
let toastTimer;
function toast(message,duration=4200){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),duration);}
function setMode(mode){
  if(state.mode===mode){if(mode==='drift'){orbitAngle=.38;orbitPitch=.23;orbitZoom=1;orbitHold=performance.now()+2500;}return;}
  state.mode=mode;transition=2.5;resetInputs();
  const swim=mode==='swim';document.body.classList.toggle('swimming',swim);glass.visible=!swim;plinth.visible=!swim;under.visible=!swim;
  camera.fov=swim?62:42;camera.updateProjectionMatrix();
  $('joystick').hidden=!swim;$('vertical').hidden=!swim;$('drift').classList.toggle('active',!swim);$('swim').classList.toggle('active',swim);
  $('drift').setAttribute('aria-pressed',String(!swim));$('swim').setAttribute('aria-pressed',String(swim));$('mode-label').textContent=swim?'INSIDE THE TIDE':'SLOW DRIFT';
  if(swim){swimPosition.set(0,4.1,6.2);swimYaw=0;swimPitch=-.04;toast('左の丸で泳ぐ · 右側をなぞって見回す',5500);}else{$('depth').textContent='GLASS SIDE';}
}
$('drift').onclick=()=>setMode('drift');$('swim').onclick=()=>setMode('swim');

const pointers=new Map();let lastPinch=0,tapStart=null;
canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});tapStart={x:e.clientX,y:e.clientY,t:performance.now()};orbitHold=performance.now()+6500;if(pointers.size>1){tapStart=null;const [a,b]=[...pointers.values()];lastPinch=Math.hypot(a.x-b.x,a.y-b.y);}});
canvas.addEventListener('pointermove',e=>{
  const prev=pointers.get(e.pointerId);if(!prev)return;
  const dx=e.clientX-prev.x,dy=e.clientY-prev.y;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.size===2){const [a,b]=[...pointers.values()],d=Math.hypot(a.x-b.x,a.y-b.y);if(lastPinch&&d>0&&state.mode==='drift')setOrbitZoom(orbitZoom*lastPinch/d);lastPinch=d;return;}
  if(state.mode==='drift'){orbitAngle-=dx*.006;orbitPitch+=dy*.004;orbitHold=performance.now()+6500;}
  else{swimYaw+=dx*.004;swimPitch=clamp(swimPitch+dy*.003,-1.2,1.2);}
});
const raycaster=new THREE.Raycaster(),ndc=new THREE.Vector2();
canvas.addEventListener('pointerup',e=>{
  if(tapStart&&performance.now()-tapStart.t<450&&Math.hypot(e.clientX-tapStart.x,e.clientY-tapStart.y)<8){
    ndc.set(e.clientX/width*2-1,1-e.clientY/height*2);raycaster.setFromCamera(ndc,camera);
    if(raycaster.intersectObject(cup,true).length){toast('海の底でも、コーヒーブレイク。☕  — 10',6500);chime();}
    else if(raycaster.intersectObject(manta,true).length)toast('ゆっくりでいいよ。ここは、急がなくていい海。');
  }pointers.delete(e.pointerId);lastPinch=0;tapStart=null;
});
canvas.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);lastPinch=0;tapStart=null;});
canvas.addEventListener('wheel',e=>{e.preventDefault();if(state.mode==='drift')setOrbitZoom(orbitZoom+e.deltaY*.001);},{passive:false});
let joyId=null,joyOrigin={x:0,y:0};
$('joystick').addEventListener('pointerdown',e=>{joyId=e.pointerId;$('joystick').setPointerCapture(e.pointerId);const r=$('joystick').getBoundingClientRect();joyOrigin={x:r.x+r.width/2,y:r.y+r.height/2};moveJoy(e);});
function moveJoy(e){if(e.pointerId!==joyId)return;const dx=e.clientX-joyOrigin.x,dy=e.clientY-joyOrigin.y,r=Math.max(1,Math.hypot(dx,dy)/29);joy.x=dx/r/29;joy.y=dy/r/29;$('stick').style.transform=`translate(${joy.x*24}px,${joy.y*24}px)`;}
$('joystick').addEventListener('pointermove',moveJoy);
function releaseJoy(){joyId=null;joy.x=joy.y=0;$('stick').style.transform='';}
for(const event of ['pointerup','pointercancel','lostpointercapture'])$('joystick').addEventListener(event,releaseJoy);
for(const id of ['up','down']){
  $(id).addEventListener('pointerdown',e=>{e.preventDefault();$(id).setPointerCapture(e.pointerId);lift[id]=true;});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])$(id).addEventListener(event,()=>lift[id]=false);
}
function resetInputs(){keys.clear();releaseJoy();lift.up=lift.down=false;pointers.clear();lastPinch=0;tapStart=null;}
addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(k==='escape'){if(!$('settings-panel').hidden){closeSettings();$('settings').focus();}else setMode('drift');return;}if(e.target.matches('select,input,button'))return;if(['w','a','s','d','q','e','arrowup','arrowdown','arrowleft','arrowright'].includes(k)){e.preventDefault();keys.add(k);}});
addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));addEventListener('blur',resetInputs);

// Food gathers the shoals near the observer, then dissolves. Never accumulates objects.
const foodGeo=new THREE.BufferGeometry(),foodArray=new Float32Array(28*3);foodGeo.setAttribute('position',new THREE.BufferAttribute(foodArray,3));
const food=new THREE.Points(foodGeo,new THREE.PointsMaterial({color:0xf5d69a,size:.055,transparent:true,opacity:.9}));food.visible=false;reef.add(food);
$('feed').onclick=()=>{
  state.feeding=13;food.visible=true;
  if(state.mode==='swim'){camera.getWorldDirection(vec);feedPoint.copy(camera.position).addScaledVector(vec,3);feedPoint.x=clamp(feedPoint.x,-10,10);feedPoint.z=clamp(feedPoint.z,-5.8,5.8);feedPoint.y=clamp(feedPoint.y,2,8);}
  else feedPoint.set(0,3.8,4.7);
  for(let i=0;i<28;i++){foodArray[i*3]=feedPoint.x+range(-1,1);foodArray[i*3+1]=feedPoint.y+range(0,1.3);foodArray[i*3+2]=feedPoint.z+range(-.8,.8);}foodGeo.attributes.position.needsUpdate=true;
  toast('ほら、集まってきた。',2800);chime();
};

// Sound always begins with an explicit gesture; tab hiding suspends the context.
let audio=null,audioGain=null;
async function ensureAudio(){
  if(!audio){
    const AC=window.AudioContext||window.webkitAudioContext;if(!AC)throw new Error('Audio unavailable');audio=new AC();
    audioGain=audio.createGain();audioGain.gain.value=0;audioGain.connect(audio.destination);
    const len=audio.sampleRate*4,buf=audio.createBuffer(1,len,audio.sampleRate),data=buf.getChannelData(0);let last=0;
    for(let i=0;i<len;i++){last=(last+(Math.random()*2-1)*.018)/1.018;data[i]=last*3.5;}
    const noise=audio.createBufferSource();noise.buffer=buf;noise.loop=true;
    const filter=audio.createBiquadFilter(),waterGain=audio.createGain();filter.type='lowpass';filter.frequency.value=380;waterGain.gain.value=.7;noise.connect(filter);filter.connect(waterGain);waterGain.connect(audioGain);noise.start();
    const swell=audio.createOscillator(),depth=audio.createGain();swell.frequency.value=.10;depth.gain.value=.08;swell.connect(depth);depth.connect(waterGain.gain);swell.start();
  }await audio.resume();
}
function chime(){if(!state.sound||!audio)return;for(let i=0;i<2;i++){const o=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime+i*.19;o.type='sine';o.frequency.value=[659.25,987.77][i];g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.025,t+.02);g.gain.exponentialRampToValueAtTime(.0001,t+1.7);o.connect(g);g.connect(audioGain);o.start(t);o.stop(t+1.8);}}
$('sound').onclick=async()=>{try{await ensureAudio();state.sound=!state.sound;audioGain.gain.setTargetAtTime(state.sound?.28:0,audio.currentTime,.7);$('sound').setAttribute('aria-pressed',String(state.sound));$('sound').setAttribute('aria-label',state.sound?'水の音をオフ':'水の音をオン');$('sound').innerHTML=state.sound?'<svg viewBox="0 0 24 24"><path d="M11 5 6 9H3v6h3l5 4zM16 8q5 4 0 8m3-11q8 7 0 14"/></svg>':'<svg viewBox="0 0 24 24"><path d="M11 5 6 9H3v6h3l5 4zM16 9l5 6m0-6-5 6"/></svg>';if(state.sound)chime();}catch{toast('このブラウザでは音を開けなかったみたい。');}};
const lightModes=['day','moon','cosmos'];
const lightNames={day:'Day',moon:'Moon',cosmos:'Cosmos'};
const lightIcons={day:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',moon:'<path d="M19.5 14.3A8 8 0 0 1 9.7 4.5a8 8 0 1 0 9.8 9.8Z"/>',cosmos:'<path d="m12 3 2.3 6.7L21 12l-6.7 2.3L12 21l-2.3-6.7L3 12l6.7-2.3Z"/><path d="M20 2v4m-2-2h4"/>'};
function setLighting(lighting){
  if(!lightModes.includes(lighting))return;
  state.lighting=lighting;state.night=lighting!=='day';
  document.body.classList.toggle('night',state.night);document.body.classList.toggle('cosmos',lighting==='cosmos');
  const next=lightModes[(lightModes.indexOf(lighting)+1)%lightModes.length];
  $('light').dataset.mode=lighting;$('light').setAttribute('aria-label',`${lightNames[lighting]}。次は${lightNames[next]}`);
  $('light').title=`${lightNames[lighting]} → ${lightNames[next]}`;$('light').innerHTML=`<svg viewBox="0 0 24 24">${lightIcons[lighting]}</svg>`;
  $('light-mode').value=lighting;
  document.querySelector('meta[name="theme-color"]').content=lighting==='cosmos'?'#05071a':state.night?'#071321':'#082b32';
}
$('light').onclick=()=>setLighting(lightModes[(lightModes.indexOf(state.lighting)+1)%lightModes.length]);
$('light-mode').onchange=()=>setLighting($('light-mode').value);setLighting('day');
$('settings').onclick=()=>{const open=$('settings-panel').hidden;$('settings-panel').hidden=!open;$('settings').setAttribute('aria-expanded',String(open));if(open)$('close-settings').focus();};
function closeSettings(){$('settings-panel').hidden=true;$('settings').setAttribute('aria-expanded','false');}
$('close-settings').onclick=()=>{closeSettings();$('settings').focus();};
$('quality').onchange=()=>{state.quality=$('quality').value;fishMesh.count={low:92,medium:156,high:156}[state.quality];blades.count=state.quality==='low'?540:950;kelps.count=state.quality==='low'?50:74;skyGeo.setDrawRange(0,state.quality==='low'?600:1400);resize();};
function pauseLabel(){$('pause').textContent=state.paused?'Play ▷':'Pause Ⅱ';$('pause').setAttribute('aria-pressed',String(state.paused));}
$('pause').onclick=()=>{state.paused=!state.paused;pauseLabel();};pauseLabel();
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else toast('ホーム画面に追加すると、広い画面で開けるよ。');}catch{toast('ホーム画面に追加すると、広い画面で開けるよ。');}};
$('photo').onclick=()=>{
  renderer.render(scene,camera);
  const picture=document.createElement('canvas');picture.width=canvas.width;picture.height=canvas.height;
  const ctx=picture.getContext('2d'),w=picture.width,h=picture.height;
  const gradient=ctx.createRadialGradient(w*.5,h*.35,0,w*.5,h*.35,Math.max(w,h)*.7);
  gradient.addColorStop(0,state.lighting==='cosmos'?'#11132d':state.night?'#18364b':'#22626a');gradient.addColorStop(1,state.lighting==='cosmos'?'#030511':state.night?'#071321':'#061e29');ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);ctx.drawImage(canvas,0,0);
  ctx.fillStyle='#e7eee3';ctx.font=`italic ${Math.round(w*.025)}px Georgia`;ctx.fillText('Little Ocean.',w*.04,h*.08);ctx.font=`${Math.max(12,Math.round(w*.009))}px Georgia`;ctx.fillText('10718 · 10 / for Sumie',w*.04,h*.95);
  picture.toBlob(blob=>{if(!blob){toast('写真を保存できなかったみたい。');return;}const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='little-ocean-10718.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);toast('海の一枚を、持って帰ろう。');},'image/png');
};

// Materials with vertex colours need a white base attribute even on simple meshes.
scene.traverse(object=>{if(object.isMesh&&object.material.vertexColors&&!object.geometry.getAttribute('color'))colorize(object.geometry,0xffffff);});
for(let i=0;i<180;i++){state.time=i/30;updateFish(1/30);}state.time=0;
let last=performance.now(),raf=0,frames=0;
function frame(now){
  raf=requestAnimationFrame(frame);const rawdt=clamp((now-last)/1000,0,.15);last=now;
  const dt=state.paused?0:Math.min(rawdt,.05);state.time+=dt;clock.value=state.time;
  moon.value=THREE.MathUtils.damp(moon.value,state.night?1:0,1.5,rawdt);
  cosmos.value=THREE.MathUtils.damp(cosmos.value,state.lighting==='cosmos'?1:0,1.8,rawdt);
  ambient.intensity=(1.5-moon.value*.65)*(1.-cosmos.value*.82);sun.intensity=(3.3-moon.value*3)*(1.-cosmos.value*.8);rim.intensity=(1.45-moon.value*.4)*(1.-cosmos.value*.7);
  scene.fog.color.copy(fogDay).lerp(fogMoon,moon.value).lerp(fogCosmos,cosmos.value);
  glassMat.opacity=.025*(1.-cosmos.value*.8);tankEdges.material.opacity=.18*(1.-cosmos.value*.72);
  updateFish(dt);updateCamera(rawdt);
  const t=state.time*.115;manta.position.set(Math.sin(t+.9)*7.9,7.0+Math.sin(t*1.7)*.6,Math.cos(t+.9)*4.0);manta.rotation.y=Math.atan2(-Math.cos(t+.9)*7.9,Math.sin(t+.9)*4);manta.rotation.z=Math.sin(t)*.07;
  for(const shaft of shafts.children)shaft.rotation.y=Math.atan2(camera.position.x-shaft.position.x,camera.position.z-shaft.position.z);
  updateCosmos();
  if(state.feeding>0){state.feeding=Math.max(0,state.feeding-dt);for(let i=0;i<28;i++)foodArray[i*3+1]-=dt*.07;foodGeo.attributes.position.needsUpdate=true;food.material.opacity=Math.min(.9,state.feeding/3);if(state.feeding===0)food.visible=false;}
  renderer.render(scene,camera);frames++;
  if(frames===1)renderer.shadowMap.autoUpdate=false;
  if(!state.ready&&frames>2){state.ready=true;$('loading').hidden=true;}
}
raf=requestAnimationFrame(frame);
document.addEventListener('visibilitychange',()=>{resetInputs();if(document.hidden){cancelAnimationFrame(raf);audio?.suspend();}else{last=performance.now();raf=requestAnimationFrame(frame);if(state.sound)audio?.resume().catch(()=>{});}});
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();cancelAnimationFrame(raf);$('failure-text').textContent='水槽を描き直すため、もう一度開いてね。';$('failure').hidden=false;$('loading').hidden=true;audio?.suspend();});
canvas.addEventListener('webglcontextrestored',()=>location.reload());

// Read-only diagnostics for rendering/accessibility regression checks; no account data.
window.oceanDiagnostics=()=>({version:'1.1.0',ready:state.ready,mode:state.mode,paused:state.paused,lighting:state.lighting,night:state.night,cosmos:cosmos.value,glowingFish:fishGlow.visible?glowGeo.drawRange.count:0,stars:starSky.visible?Math.min(skyGeo.drawRange.count,1400):0,geometryCount:renderer.info.memory.geometries,quality:state.quality,feeding:state.feeding,time:state.time,transition,moon:moon.value,fish:fishMesh.count,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,camera:camera.position.toArray(),fov:camera.fov,orbitZoom,orbitDistance:camera.position.distanceTo(orbitTarget),fogDensity:scene.fog.density,swimPosition:swimPosition.toArray(),joystick:{...joy},sound:state.sound,audioState:audio?.state||'none',pixelRatio:renderer.getPixelRatio(),cup:cup.position.clone().project(camera).toArray(),manta:manta.position.clone().project(camera).toArray()});
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
