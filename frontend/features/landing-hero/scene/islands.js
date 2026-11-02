import * as THREE from 'three';
import { hash, disposeTree } from './util.js';
import { makeKarst } from './procedural.js';

/**
 * Limestone islands. Each island starts as the v5 procedural karst mesh; once the stone-pillar glTF is loaded
 * every island is rebuilt from InstancedMesh pillars (one main spire + satellites), grouped in three draw calls:
 *   bg    – hero backdrop, always visible
 *   end   – Ha Long arrival backdrop, only shown once p > .5 (v5 `endObjs`)
 *   route – along the journey, pop up with the top-down camera (v5 `routeIsl`, scaled by `rs`)
 */
export class Islands {
  constructor(scene, islU, isl_n) {
    this.scene = scene; this.islU = islU; this.ISL_N = isl_n;
    this.list = []; this.count = 0; this.instanced = null; this.lastRs = -1;
  }

  add(x, z, r, h, seed, reg) {
    const d = { x, z, r, h, seed, group: reg ? 'route' : (z < -190 ? 'end' : 'bg'), idx: -1 };
    d.m = makeKarst(h, r, seed); d.m.position.x = x; d.m.position.z = z; this.scene.add(d.m);
    if (reg && this.count < this.ISL_N) { d.idx = this.count; this.islU[this.count].set(x, z, r * .92); this.count++; }
    else if (reg) d.group = 'route';
    this.list.push(d);
    return d;
  }

  /** Replace the procedural meshes with instanced pillars. Returns the number of instances. */
  upgrade(gltf) {
    let geo, mat;
    gltf.scene.traverse((o) => { if (o.isMesh && !geo) { geo = o.geometry; mat = o.material; } });
    if (!geo) throw new Error('stone pillar glTF has no mesh');
    const per = { bg: [], end: [], route: [] };
    const kBase = 1 / 0.42;                       // unit pillar half-footprint ~0.42 -> island base radius r
    for (const d of this.list) {
      const n = d.group === 'route' ? 2 : 3;      // main spire + satellites
      for (let k = 0; k < n; k++) {
        const main = k === 0;
        const ang = hash(d.seed, 50 + k) * Math.PI * 2, dist = main ? 0 : d.r * (.55 + hash(d.seed, 60 + k) * .5);
        const sc = main ? 1 : .38 + hash(d.seed, 70 + k) * .3;
        per[d.group].push({
          d, x: d.x + Math.cos(ang) * dist, z: d.z + Math.sin(ang) * dist,
          yaw: hash(d.seed, 80 + k) * Math.PI * 2,
          sxz: d.r * kBase * sc * (.92 + hash(d.seed, 90 + k) * .2), sy: d.h * sc * (.9 + hash(d.seed, 95 + k) * .2),
          tint: hash(d.seed, 99 + k),
        });
      }
    }
    const tintA = new THREE.Color(0xffffff), tintB = new THREE.Color(0xc4cfcf), c = new THREE.Color();
    this.instanced = {};
    const karstMat = mat.clone();
    karstMat.onBeforeCompile = (sh) => {            // v5 look: silvery limestone shaft, green vegetation cap
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vUnitY;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvUnitY = position.y;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vUnitY;')
        .replace('#include <color_fragment>', `#include <color_fragment>
          float lum = dot(diffuseColor.rgb, vec3(.299,.587,.114));
          vec3 rock = mix(vec3(.15,.22,.22), vec3(.30,.37,.36), clamp(lum*2.2, 0., 1.));
          float cap = smoothstep(.66, .93, vUnitY);
          diffuseColor.rgb = mix(rock, vec3(.07,.2,.11) * (.7 + lum), cap * .9);`);
    };
    for (const g of ['bg', 'end', 'route']) {
      const items = per[g];
      if (!items.length) continue;
      const mesh = new THREE.InstancedMesh(geo, karstMat, items.length);
      mesh.name = 'pillars-' + g; mesh.frustumCulled = false;
      items.forEach((it, i) => { c.copy(tintA).lerp(tintB, it.tint); mesh.setColorAt(i, c); });
      this.instanced[g] = { mesh, items };
      this.scene.add(mesh);
    }
    this._write(1, true);
    for (const d of this.list) { this.scene.remove(d.m); disposeTree(d.m); d.m = null; }
    return Object.values(this.instanced).reduce((s, g) => s + g.items.length, 0);
  }

  _write(rs, force) {
    const q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), m = new THREE.Matrix4(), up = new THREE.Vector3(0, 1, 0);
    for (const [g, { mesh, items }] of Object.entries(this.instanced)) {
      if (g !== 'route' && !force) continue;
      const k = g === 'route' ? rs : 1;
      items.forEach((it, i) => {
        const cy = it.d.h / 2 - .6;               // v5 scaled the whole mesh about its centre
        const px = it.d.x + (it.x - it.d.x) * k, pz = it.d.z + (it.z - it.d.z) * k, py = cy + (-.6 - cy) * k;
        p.set(px, py, pz); q.setFromAxisAngle(up, it.yaw); s.set(it.sxz * k, it.sy * k, it.sxz * k);
        mesh.setMatrixAt(i, m.compose(p, q, s));
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  /** Per-frame: `rs` is v5's pop-up scale, `showEnd` is p > .5. */
  update(rs, showEnd) {
    if (this.instanced) {
      const r = this.instanced.route;
      if (r) {
        if (Math.abs(rs - this.lastRs) > 1e-4) { this.lastRs = rs; this._write(rs, false); }
        r.mesh.visible = rs > .01;
      }
      if (this.instanced.end) this.instanced.end.mesh.visible = showEnd;
    } else {
      for (const d of this.list) {
        if (d.group === 'route') { d.m.scale.setScalar(rs); d.m.visible = rs > .01; }
        else if (d.group === 'end') d.m.visible = showEnd;
      }
    }
    for (const d of this.list) if (d.idx >= 0) this.islU[d.idx].z = d.r * .92 * rs;
  }
}
