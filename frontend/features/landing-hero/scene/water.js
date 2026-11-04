import * as THREE from 'three';
import { raw } from './util.js';

// ================= NƯỚC (shader) =================
// Same maths as v5. Colours are authored in display space, so the final colour is converted to linear and
// then `#include <colorspace_fragment>` re-encodes it for the output colour space (r160+ requirement).
export const ISL_N = 16;

/**
 * `islands` = number of shallow-water/foam rings the shader evaluates per fragment (v5: 16, used only by the top-down
 * camera). The landing hero never looks down, so it passes 0 and the loop is not compiled at all.
 * `segments` = grid resolution of the displaced plane (v5: 170).
 */
export function createWater({ islands = ISL_N, segments = 170 } = {}) {
  const islU = [];
  for (let i = 0; i < islands; i++) islU.push(new THREE.Vector3(9999, 9999, 1));
  const W = {
    uTime: { value: 0 }, uAmp: { value: 1 }, uSunDir: { value: new THREE.Vector3(-.45, .4, -.8).normalize() }, uGlint: { value: 1 },
    uSky: { value: raw(0xcfe3e1) }, uFog: { value: raw(0xf3f6f4) }, uFogNear: { value: 30 }, uFogFar: { value: 150 },
    uBoat: { value: new THREE.Vector2() }, uDir: { value: new THREE.Vector2(1, 0) }, uWake: { value: 0 }, uTint: { value: 0 },
  };
  if (islands > 0) W.uIsl = { value: islU };
  const material = new THREE.ShaderMaterial({
    uniforms: W,
    vertexShader: `
    uniform float uTime,uAmp; varying vec3 vWorld;
    void main(){
      vec4 wp=modelMatrix*vec4(position,1.); float x=wp.x,z=wp.z,t=uTime;
      wp.y+=uAmp*(sin(x*.35+t*1.1)*.10+cos(z*.30+t*.8)*.09+sin((x+z)*.12+t*.5)*.14);
      vWorld=wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp;
    }`,
    fragmentShader: `
    uniform float uTime,uGlint,uFogNear,uFogFar,uWake,uTint; uniform vec3 uSunDir,uSky,uFog;${islands > 0 ? ` uniform vec3 uIsl[${islands}];` : ""} uniform vec2 uBoat,uDir;
    varying vec3 vWorld;
    vec2 wv(vec2 p,vec2 k,float om,float a,float t){return k*a*cos(dot(k,p)+om*t);}
    void main(){
      vec2 p=vWorld.xz; float t=uTime;
      vec2 s=wv(p,vec2(.9,.35),1.1,.12,t)+wv(p,vec2(-.6,.8),1.4,.10,t)+wv(p,vec2(1.7,-.9),1.9,.07,t)
            +wv(p,vec2(-2.3,1.9),2.4,.05,t)+wv(p,vec2(3.3,2.6),3.1,.035,t)+wv(p,vec2(-4.1,-3.4),3.6,.025,t)+wv(p,vec2(5.3,-1.9),4.1,.02,t)+wv(p,vec2(-6.4,2.8),4.6,.016,t);
      vec3 N=normalize(vec3(-s.x,1.,-s.y));
      vec3 V=normalize(cameraPosition-vWorld);
      // màu nền: ngọc lục bảo, biến thiên theo vùng
      float lf=.5+.5*sin(p.x*.06+sin(p.y*.05)*2.2)*sin(p.y*.045+1.3);
      vec3 col=mix(vec3(.02,.22,.26),vec3(.09,.50,.49),lf*.75);
      // quầng nước nông + bọt quanh núi đá
      float halo=0.,ring=0.;
${islands > 0 ? `      for(int i=0;i<${islands};i++){
        float d=length(p-uIsl[i].xy)/uIsl[i].z;
        halo=max(halo,smoothstep(2.6,1.0,d));
        ring=max(ring,smoothstep(.22,0.,abs(d-1.12))*(.55+.45*sin(d*20.-t*1.6)));
      }
` : ""}      col=mix(col,vec3(.30,.78,.72),halo*.85);
      col=mix(col,vec3(.93,.99,.97),ring*.65);
      // gợn bọt trắng nhẹ
      float crest=smoothstep(.82,1.,sin(dot(vec2(.9,.35),p)+t*1.1+sin(dot(vec2(-.6,.8),p)*1.3)*1.5));
      col+=crest*.025;
      // vệt nước sau thuyền
      vec2 rel=p-uBoat; float along=dot(rel,-uDir); float lat=dot(rel,vec2(-uDir.y,uDir.x));
      float arms=exp(-pow((abs(lat)-(.9+along*.30))/(.22+along*.06),2.))*(1.-smoothstep(0.,28.,along));
      float turb=exp(-pow(lat/(.8+along*.14),2.))*(1.-smoothstep(0.,20.,along))*(.85+.15*sin(along*6.-t*3.+lat*4.));
      float wake=clamp(arms*.6+turb*.8,0.,1.)*smoothstep(-.5,1.5,along)*uWake;
      col=mix(col,vec3(.94,1.,.98),wake*.8);
      // phản xạ trời + ánh nắng lấp lánh
      float fres=pow(1.-max(dot(N,V),0.),4.);
      col=mix(col,uSky,clamp(.03+fres*.7,0.,.7));
      vec3 H=normalize(normalize(uSunDir)+V);
      float sp=pow(max(dot(N,H),0.),700.)*1.7+pow(max(dot(N,H),0.),38.)*.10;
      col+=vec3(1.,.9,.7)*sp*uGlint;
      col*=mix(vec3(1.),vec3(1.1,.97,.86),uTint);
      float d=length(cameraPosition-vWorld); col=mix(col,uFog,smoothstep(uFogNear,uFogFar,d));
      // v5 colours are display-space: decode to linear, then let three encode for the output colour space
      gl_FragColor=sRGBTransferEOTF(vec4(max(col,0.),1.));
      #include <colorspace_fragment>
    }`,
  });
  const geo = new THREE.PlaneGeometry(400, 400, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  return { mesh, W, islU, GRID: 400 / segments };
}
