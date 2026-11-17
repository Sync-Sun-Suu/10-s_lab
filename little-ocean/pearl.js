import * as THREE from './vendor/three.module.min.js';

// A separate, quiet glass garden. The approved Cosmos materials stay intact.
// Silhouettes and leaf edges carry the light; no mesh grid and no bubbles.
export function createPearlGarden({reef,clock,materials,kelps,blades,plinth,under}){
  const amount={value:0},swaps=[],plants=[];
  let active=false;
  function outline(color,kind,sway=0){
    const deform=sway?`float root=pow(max(position.y,0.)/${sway>1?'5.8':'1.8'},1.6);p.x+=sin(uTime*.65+position.y*.8+instanceMatrix[3].x*.31+instanceMatrix[3].z*.27)*root*${sway};p.z+=cos(uTime*.47+position.y+instanceMatrix[3].z*.4)*root*.23;`:'';
    return new THREE.ShaderMaterial({
      transparent:true,depthWrite:false,side:kind===1?THREE.DoubleSide:THREE.FrontSide,forceSinglePass:true,
      uniforms:{uTime:clock,uAmount:amount,uTint:{value:new THREE.Color(color)}},
      vertexShader:`uniform float uTime;varying vec2 vUv;varying vec3 vNormal,vView;
        void main(){vUv=uv;vec3 p=position,n=normal;${deform}vec4 world=vec4(p,1.);
        #ifdef USE_INSTANCING
        world=instanceMatrix*world;mat3 m=mat3(instanceMatrix);n/=vec3(dot(m[0],m[0]),dot(m[1],m[1]),dot(m[2],m[2]));n=m*n;
        #endif
        vec4 view=modelViewMatrix*world;vNormal=normalize(normalMatrix*n);vView=-view.xyz;gl_Position=projectionMatrix*view;}`,
      fragmentShader:`uniform float uAmount;uniform vec3 uTint;varying vec2 vUv;varying vec3 vNormal,vView;
        void main(){float facing=abs(dot(normalize(vNormal),normalize(vView)));float rim=1.-smoothstep(.025,.36,facing);float a=.018+rim*.78;
        ${kind===1?`float w=max(fwidth(vUv.x),.0001);float edge=1.-smoothstep(w*.15,w*.9,min(vUv.x,1.-vUv.x));a=.018+edge*.32;`:''}
        ${kind===2?`float edge=min(min(vUv.x,1.-vUv.x),min(vUv.y,1.-vUv.y));float w=max(fwidth(edge),.0001);a=(1.-smoothstep(w*.2,w*.9,edge))*.18;`:''}
        ${kind===3?`a=.012+rim*.40;`:''}
        ${kind===4?`float w=max(fwidth(vUv.y),.0001);float edge=1.-smoothstep(w*.2,w*.9,min(vUv.y,1.-vUv.y));a=.012+max(edge*.52,rim*.55);`:''}
        gl_FragColor=vec4(uTint,a*uAmount);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        }`
    });
  }
  const styles=new Map([
    [materials.rock,outline(0xe1e0d7,0)],
    [materials.sand,outline(0xc1c9c3,2)],
    [materials.coral,outline(0xddc8c1,3)],
    [materials.cup,outline(0xe6dcc7,4)],
    [materials.gold,outline(0xe8d5ac,4)],
    [materials.coffee,outline(0xd1bfa2,0)]
  ]);
  reef.traverse(object=>{
    const ghost=object.isMesh&&styles.get(object.material);
    if(ghost)swaps.push({object,original:object.material,ghost});
  });
  function sparseLeaves(original,stride,color,sway){
    const count=Math.ceil(original.instanceMatrix.count/stride);
    const ghost=new THREE.InstancedMesh(original.geometry,outline(color,1,sway),count);
    const matrix=new THREE.Matrix4();
    for(let i=0;i<count;i++){original.getMatrixAt(i*stride,matrix);ghost.setMatrixAt(i,matrix);}
    ghost.position.copy(original.position);ghost.quaternion.copy(original.quaternion);ghost.scale.copy(original.scale);
    ghost.frustumCulled=false;ghost.visible=false;original.parent.add(ghost);plants.push({original,ghost,count});
  }
  sparseLeaves(kelps,10,0xd0ddd3,1.8);
  sparseLeaves(blades,7,0xbfcfc5,.42);
  return {
    update(enabled,dt,mode,quality){
      amount.value=THREE.MathUtils.damp(amount.value,enabled?1:0,3,dt);
      if(enabled!==active){
        active=enabled;
        for(const {object,original,ghost} of swaps)object.material=active?ghost:original;
        for(const {original,ghost} of plants){original.visible=!active;ghost.visible=active;}
      }
      for(const p of plants)p.ghost.count=quality==='low'?Math.ceil(p.count*.65):p.count;
      plinth.visible=under.visible=mode==='drift'&&!active;
    },
    diagnostics:()=>({active,amount:amount.value,materials:active?swaps.length:0,kelp:active?plants[0].ghost.count:0,grass:active?plants[1].ghost.count:0})
  };
}
