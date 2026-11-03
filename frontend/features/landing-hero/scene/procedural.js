// Procedural stand-ins copied from tripri-hero-v5. They render immediately while the glTF models stream in,
// and stay in the scene if a model fails to load (graceful fallback).
import * as THREE from 'three';
import { clamp, hash } from './util.js';

export function makeKarst(h, r, seed) {
  const g = new THREE.CylinderGeometry(r * .42, r, h, 18, 10, false), pp = g.attributes.position, col = [];
  const c1 = new THREE.Color(0x8a9a9a), c2 = new THREE.Color(0x4f7a58), c3 = new THREE.Color(0x6f8686);
  for (let i = 0; i < pp.count; i++) {
    const x = pp.getX(i), y = pp.getY(i), z = pp.getZ(i), a = Math.atan2(z, x), t = (y + h / 2) / h;
    const n = .75 + .5 * hash(Math.round(a * 6) + seed, Math.round(t * 8)), tp = 1 - .18 * Math.sin(t * Math.PI * 1.4);
    pp.setX(i, x * n * tp); pp.setZ(i, z * n * tp); pp.setY(i, y + (hash(i, seed) - .5) * h * .03);
    const c = t > .78 ? c2.clone().lerp(c1, (1 - t) * 3) : c3.clone().lerp(c1, hash(i, seed) * .6); col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
  m.position.y = h / 2 - .6; return m;
}

export function makeBoatProcedural() {
  const g = new THREE.Group(); g.name = 'procedural-boat';
  const wood = new THREE.MeshStandardMaterial({ color: 0x5a3a24, roughness: .8, flatShading: true });
  const woodL = new THREE.MeshStandardMaterial({ color: 0xc79a66, roughness: .7, flatShading: true });
  const sailM = new THREE.MeshStandardMaterial({ color: 0x8e4a2b, roughness: .9, side: THREE.DoubleSide, flatShading: true });
  const sh = new THREE.Shape(); sh.moveTo(-2.6, .8); sh.lineTo(-2, -.1); sh.lineTo(1.9, -.1); sh.quadraticCurveTo(2.7, 0, 3.2, 1); sh.lineTo(2.8, .75);
  sh.quadraticCurveTo(2.2, .35, 1.8, .35); sh.lineTo(-1.9, .35); sh.lineTo(-2.6, .8);
  const hg = new THREE.ExtrudeGeometry(sh, { depth: 1.9, bevelEnabled: true, bevelSize: .18, bevelThickness: .18, bevelSegments: 2 }); hg.translate(0, 0, -.95);
  { const pp = hg.attributes.position; for (let i = 0; i < pp.count; i++) { const u = clamp((pp.getX(i) + 2.6) / 5.8), w = 1 - .62 * Math.pow(Math.abs(u - .42) / .58, 2.2); pp.setZ(i, pp.getZ(i) * w); } hg.computeVertexNormals(); }
  g.add(new THREE.Mesh(hg, wood));
  const box = (w, h, d, x, y, m) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, 0); g.add(o); return o; };
  const cab1 = box(2.6, .7, 1.6, -.4, .75, woodL); box(2.9, .12, 1.8, -.4, 1.16, wood);
  const cab2 = box(1.7, .55, 1.3, -.7, 1.5, woodL); box(2, .1, 1.5, -.7, 1.83, wood);
  const winM = new THREE.MeshStandardMaterial({ color: 0x2a3d46, roughness: .3 });
  [cab1, cab2].forEach((c, ix) => { for (let k = -1; k <= 1; k++) { const w = new THREE.Mesh(new THREE.BoxGeometry(.35, .28, 1.64 - ix * .34), winM); w.position.set(c.position.x + k * (ix ? .5 : .8), c.position.y + .02, 0); g.add(w); } });
  function makeSail(w, h, x, tilt) {
    const sg = new THREE.Group(), geo = new THREE.PlaneGeometry(w, h, 6, 5), pp = geo.attributes.position;
    for (let i = 0; i < pp.count; i++) pp.setZ(i, Math.sin((pp.getX(i) / w + .5) * Math.PI) * .34); geo.computeVertexNormals();
    const s = new THREE.Mesh(geo, sailM); s.position.y = h / 2; sg.add(s);
    for (let k = 0; k <= 4; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(w * 1.04, .05, .07), wood); b.position.set(0, (k / 4) * h, .02); sg.add(b); }
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(.05, .07, h + .3, 8), wood); mast.position.set(-w * .5, h / 2, 0); sg.add(mast);
    sg.position.set(x, .3, 0); sg.rotation.y = tilt; return sg;
  }
  const sails = [makeSail(1.8, 3.6, -1.2, .3), makeSail(1.6, 3, 1, .18), makeSail(1.2, 2.2, 2.3, .05)]; sails.forEach((s) => g.add(s));
  return { group: g, sails };
}

export function plankTex(len) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#8a6a48'; g.fillRect(0, 0, 256, 64);
  g.fillStyle = '#6d5136'; for (let i = 0; i < 8; i++) { g.fillRect(i * 32, 0, 2, 64); } for (let i = 0; i < 256; i += 3) g.fillRect(i, (hash(i, 3) * 64) | 0, 2, 1);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(len / 4, 1); return t;
}

/** Wooden sign board. Text is drawn once the web font is available (v5 drew it before the font loaded). */
export function makeSign(text) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const draw = () => {
    g.fillStyle = '#f3efe4'; g.fillRect(0, 0, 512, 128);
    g.strokeStyle = '#5a3a24'; g.lineWidth = 8; g.strokeRect(4, 4, 504, 120); g.fillStyle = '#1b3a47';
    g.font = '700 46px "Be Vietnam Pro", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 66);
    tex.needsUpdate = true;
  };
  draw();
  if (document.fonts && document.fonts.load) document.fonts.load('700 46px "Be Vietnam Pro"', text).then(draw).catch(() => {});
  const sign = new THREE.Group();
  const board = new THREE.Mesh(new THREE.PlaneGeometry(3.4, .85), new THREE.MeshBasicMaterial({ map: tex }));
  const postM = new THREE.MeshStandardMaterial({ color: 0x4a3322, roughness: .9 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, 1.6, 6), postM); pole.position.set(0, -.7, -.03);
  sign.add(board, pole);
  return sign;
}

export function makePierProcedural(len) {
  const g = new THREE.Group(); g.name = 'procedural-pier';
  const deck = new THREE.Mesh(new THREE.BoxGeometry(len, .3, 3.4), new THREE.MeshStandardMaterial({ map: plankTex(len), roughness: .9 })); deck.position.set(0, .95, 0); g.add(deck);
  const postM = new THREE.MeshStandardMaterial({ color: 0x4a3322, roughness: .9 });
  for (let x = -len / 2 + 1; x <= len / 2 - .5; x += 3.2) for (const dz of [-1.5, 1.5]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.17, .2, 2.6, 8), postM); p.position.set(x, .1, dz); g.add(p); }
  for (const xb of [-len / 2 + 3.5, 0]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(.16, .2, .5, 10), new THREE.MeshStandardMaterial({ color: 0x2a3d46, roughness: .5 })); b.position.set(xb, 1.35, 1.3); g.add(b); }
  const crate = (x, zz, s) => { const c = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), new THREE.MeshStandardMaterial({ color: 0xb08a5a, roughness: .9, flatShading: true })); c.position.set(x, 1.1 + s / 2, zz); g.add(c); };
  crate(-len / 2 + len * .3, -.6, .9); crate(-len / 2 + len * .3 + 1.0, -.8, .7); crate(-len / 2 + len * .62, -.7, 1.0);
  const lp = new THREE.Mesh(new THREE.CylinderGeometry(.06, .08, 2.2, 6), postM); lp.position.set(len / 2 - 1, 2.2, -1.3); g.add(lp);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(.22, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd9a0 })); lamp.position.set(len / 2 - 1, 3.4, -1.3); g.add(lamp);
  return g;
}

export function makeRaft(roof, wall) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(5, .3, 3.6), new THREE.MeshStandardMaterial({ color: 0x9c7a50, roughness: .9 })); base.position.y = .15; g.add(base);
  for (const [dx, dz] of [[-2.2, -1.5], [2.2, -1.5], [-2.2, 1.5], [2.2, 1.5]]) { const f = new THREE.Mesh(new THREE.CylinderGeometry(.35, .35, .5, 10), new THREE.MeshStandardMaterial({ color: 0x2d6fa8, roughness: .6 })); f.position.set(dx, 0, dz); g.add(f); }
  const house = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.2, 1.8), new THREE.MeshStandardMaterial({ color: wall, roughness: .8, flatShading: true })); house.position.set(-.6, .9, 0); g.add(house);
  const rf = new THREE.Mesh(new THREE.BoxGeometry(3.1, .14, 2.5), new THREE.MeshStandardMaterial({ color: roof, roughness: .7, flatShading: true })); rf.position.set(-.6, 1.6, 0); g.add(rf);
  const net = new THREE.Mesh(new THREE.BoxGeometry(1.4, .05, 2), new THREE.MeshStandardMaterial({ color: 0xe9dcc2, roughness: 1 })); net.position.set(1.6, .34, 0); g.add(net);
  return g;
}

export function makeSampan() {
  const g = new THREE.Group(); g.name = 'procedural-sampan';
  const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 8), new THREE.MeshStandardMaterial({ color: 0x7a4e2c, roughness: .8, flatShading: true })); hull.scale.set(1.5, .28, .52); hull.position.y = .12; g.add(hull);
  const can = new THREE.Mesh(new THREE.CylinderGeometry(.45, .45, 1.2, 10, 1, false, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0xe9dcc2, roughness: .9, side: THREE.DoubleSide })); can.rotation.z = Math.PI / 2; can.rotation.y = Math.PI / 2; can.position.set(.1, .55, 0); g.add(can);
  return g;
}

/** v5 triangle seagull (manual wing flap) — used until / unless the animated glTF gull is available. */
export function makeBirdProcedural(shared) {
  const g = new THREE.Group(), wl = new THREE.Mesh(shared.wingGeo, shared.mat), wr = new THREE.Mesh(shared.wingGeo, shared.mat); wr.scale.z = -1;
  g.add(wl, wr, new THREE.Mesh(shared.bodyGeo, shared.mat));
  return { group: g, wl, wr };
}
export function makeBirdShared() {
  const wingGeo = new THREE.BufferGeometry();
  wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([.45, 0, 0, -.3, 0, 0, 0, 0, 1.1, -.3, 0, 0, -.5, 0, .5, 0, 0, 1.1], 3)); wingGeo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: 0xf6f6f2, roughness: .8, side: THREE.DoubleSide });
  const bodyGeo = new THREE.ConeGeometry(.13, .7, 6); bodyGeo.rotateZ(-Math.PI / 2);
  return { wingGeo, mat, bodyGeo };
}

/** Flat-topped rock that the lighthouse stands on (top surface at y = 1.05). */
export function makeRockBase() {
  const g = new THREE.CylinderGeometry(3.4, 4.6, 2.4, 14, 3, false), pp = g.attributes.position, col = [];
  const c1 = new THREE.Color(0x8a9a9a), c3 = new THREE.Color(0x6f8686);
  for (let i = 0; i < pp.count; i++) {
    const x = pp.getX(i), y = pp.getY(i), z = pp.getZ(i), a = Math.atan2(z, x), t = (y + 1.2) / 2.4;
    const n = .88 + .24 * hash(Math.round(a * 5) + 7, Math.round(t * 3)); const top = y > 1.1;
    pp.setX(i, x * n); pp.setZ(i, z * n); if (!top) pp.setY(i, y + (hash(i, 5) - .5) * .25);
    const c = c3.clone().lerp(c1, hash(i, 3) * .6); col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
  m.position.y = -.15; return m;
}
