import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { clamp, hash, raw, rawHex, disposeTree } from './util.js';
import { boatPath } from './path.js';
import { createWater } from './water.js';
import { Islands } from './islands.js';
import { loadModels, precompile, polish, disposeDeep } from './assets.js';
import { makeBoatProcedural, makePierProcedural, makeSign, makeBirdProcedural, makeBirdShared } from './procedural.js';

/**
 * Landing hero: the opening shot of the TRIPRI v5/v6 journey (boat moored at the departure pier, limestone
 * islands behind, gulls overhead) rendered into `stage`. Scroll progress through the hero (0..1, supplied by the caller)
 * is mapped to the first stretch of the v5 timeline, so the boat casts off while the hero scrolls away.
 *
 * Kept verbatim from v5: SEG / boatPath, the camera, the dirS reverse-scroll logic and the yaw formula, the water
 * shader, the procedural stand-ins (shown first, and kept when a glTF fails). Left out because the camera never looks
 * down at p <= P_MAX: route islands, rafts, sampans, buoys, cloud shadows, bird shadows, the arrival scene.
 *
 * The canvas fades in once the models have been swapped in (or failed, or after REVEAL_MAX_MS), so the pale sky + copy
 * underneath is what shows first. Returns { ready, status, perf, dispose }.
 */
export const REVEAL_MAX_MS = 6000;
export const P_MAX = 0.12;                 // v5 timeline: boat leaves the pier; the top-down turn only starts at .13

/**
 * @param {HTMLElement} stage element that receives the canvas (and the --sky/--hy/--sx/--sy CSS variables)
 * @param {{ getProgress?: () => number, modelBase?: string, onFail?: (e: unknown) => void }} [options]
 */
export function createHeroScene(stage, { getProgress, modelBase = '/models/', onFail } = {}) {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;opacity:0;transition:opacity .9s ease';
  stage.appendChild(canvas);

  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' }); }
  catch (e) { canvas.remove(); onFail?.(e); return { dispose() {}, ready: Promise.resolve() }; }
  const narrow = () => innerWidth < 900;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, narrow() ? 1.25 : 1.5)); renderer.setClearColor(0, 0);
  // three >= r155 uses physical light units: v5's (r128) intensities are multiplied by PI to keep the same brightness.
  const PI = Math.PI;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, .5, 600);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x8fb3b3, .9 * PI); scene.add(hemi);
  const sunL = new THREE.DirectionalLight(0xfff0dc, .95 * PI); sunL.color.setHex(0xfff0dc); sunL.position.set(-8, 14, 6); scene.add(sunL);

  // ---- water: no island rings (only the top-down camera uses them), lighter grid on narrow screens ----
  const { mesh: water, W, GRID } = createWater({ islands: 0, segments: narrow() ? 110 : 150 });
  scene.add(water);

  // ---- limestone islands behind the boat (procedural first, instanced stone pillars once the glTF arrives) ----
  const islands = new Islands(scene, [], 0);
  for (let i = 0; i < 7; i++) islands.add(-92 + hash(i, 1) * 70, -46 - hash(i, 2) * 64, 3 + hash(i, 3) * 3, 8 + hash(i, 4) * 9, i * 3);

  // ---- main boat ----
  const boat = new THREE.Group(); boat.rotation.order = 'YXZ';
  const procBoat = makeBoatProcedural(); boat.add(procBoat.group);
  let sails = procBoat.sails;
  scene.add(boat);

  // ---- departure pier ----
  const pier = { slot: new THREE.Group(), dx: 6.5 };
  pier.slot.position.set(-21.5, 0, -3.4); scene.add(pier.slot);
  pier.proc = makePierProcedural(25); pier.slot.add(pier.proc);
  pier.sign = makeSign('BẾN XUẤT PHÁT'); pier.sign.position.set(25 * .28, 2.5, 1.55); pier.slot.add(pier.sign);

  // ---- gulls: procedural triangles first, skinned glTF clones once loaded ----
  const birdShared = makeBirdShared();
  const birds = [];
  function addBird(cx, z, y, speed, phase) {
    const g = new THREE.Group(), pb = makeBirdProcedural(birdShared); g.add(pb.group); scene.add(g);
    birds.push({ g, proc: pb, mixer: null, cx, z, y, speed, phase, rate: .85 + hash(phase, 7) * .35 });
  }
  for (let i = 0; i < 6; i++) addBird(-2, -20 - hash(i, 21) * 40, 8 + hash(i, 22) * 6, (hash(i, 23) > .5 ? 1 : -1) * (1.4 + hash(i, 24) * 1.4), hash(i, 25) * 100);
  for (let i = 0; i < 4; i++) addBird(20, -12 - i * 8.4, 9 + hash(i, 26) * 7, (hash(i, 27) > .5 ? 1 : -1) * (1.6 + hash(i, 28) * 1.8), hash(i, 29) * 100);

  // ---- resize / input ----
  let disposed = false;
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w / h < .9 ? 42 : 32; camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize); ro.observe(canvas); resize();
  let visible = true;
  const io = new IntersectionObserver((es) => { visible = es[es.length - 1].isIntersecting; }); io.observe(stage);
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  const onPointer = (e) => { mouse.tx = e.clientX / innerWidth - .5; mouse.ty = e.clientY / innerHeight - .5; };
  addEventListener('pointermove', onPointer, { passive: true });

  // ---- sky: constant for p <= P_MAX (v5 colours are display-space, see util.raw) ----
  const HTOP = raw(0xcfe3e1), HHOR = raw(0xf3f6f4);
  stage.style.setProperty('--sky-top', '#' + rawHex(HTOP)); stage.style.setProperty('--sky-hor', '#' + rawHex(HHOR));
  stage.style.setProperty('--glow', '.45');
  W.uFog.value.copy(HHOR); W.uSky.value.copy(HTOP).lerp(HHOR, .35);
  W.uFogNear.value = 30; W.uFogFar.value = 150; W.uGlint.value = .8; W.uAmp.value = 1; W.uTint.value = 0;

  // ---- per-frame state ----
  let target = 0, p = 0, prevP = 0, dirT = 1, dirS = 1, idleT = 0, speedS = 0;
  target = p = clamp(getProgress?.() ?? 0) * P_MAX; prevP = p;
  const tmpV = new THREE.Vector3(), camPos = new THREE.Vector3(), look = new THREE.Vector3(), prevB = new THREE.Vector3();
  const heroCam = new THREE.Vector3(), heroLook = new THREE.Vector3();
  const waveH = (x, z, t, a) => a * (Math.sin(x * .35 + t * 1.1) * .10 + Math.cos(z * .30 + t * .8) * .09 + Math.sin((x + z) * .12 + t * .5) * .14);
  const t0 = performance.now(); let last = t0, raf = 0;
  const cssCache = {};
  const setVar = (k, v) => { if (cssCache[k] !== v) { cssCache[k] = v; stage.style.setProperty(k, v); } };

  function frame() {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    const now = performance.now(), dt = Math.min(.1, (now - last) / 1000); last = now;
    if (!visible || document.hidden) return;

    target = clamp(getProgress?.() ?? 0) * P_MAX;
    p += (target - p) * (1 - Math.exp(-dt * 8));
    const dpdt = (p - prevP) / Math.max(dt, .001); prevP = p;
    // boat heading follows the scroll direction: dirS = +1 (bow forward) .. -1 (scrolling back, the boat turns round)
    if (dpdt > .03) dirT = 1; else if (dpdt < -.03) dirT = -1;
    idleT = Math.abs(dpdt) < .012 ? idleT + dt : 0;
    if (idleT > 1.2) dirT = 1;
    dirS += (dirT - dirS) * (1 - Math.exp(-dt * 3.2));
    const t = (now - t0) / 1000;

    // ---- boat (v5 formulas with topE = 0) ----
    mouse.x += (mouse.tx - mouse.x) * .05; mouse.y += (mouse.ty - mouse.y) * .05;
    const bp = boatPath(p), ang = Math.atan2(-bp.dz, bp.dx);
    const bh = waveH(bp.x, bp.z, t, 1);
    boat.position.set(bp.x, bh + .12, bp.z);
    boat.rotation.y = ang + (1 - dirS) * .5 * Math.PI - .28 * dirS;
    boat.rotation.x = Math.sin(t * .9) * .025;
    boat.rotation.z = Math.sin(t * 1.1) * .03;
    sails.forEach((s, i) => { s.rotation.y = [.15, .1, .05][i] + Math.sin(t * .7 + i) * .03; });
    const spd = prevB.distanceTo(tmpV.set(bp.x, 0, bp.z)) / Math.max(dt, .001); prevB.copy(tmpV); speedS += (spd - speedS) * .15;
    const dsg = dirS >= 0 ? 1 : -1; W.uBoat.value.set(bp.x, bp.z); W.uDir.value.set(bp.dx * dsg, bp.dz * dsg); W.uWake.value = clamp(speedS / 5, 0, 1);

    // ---- camera: v5 side view, aimed a little higher so the horizon sits lower and the headline stays on the sky.
    // Narrow screens pull back (v5) and centre the boat under the copy.
    if (narrow()) { heroCam.set(-11, 4.2, 27 * 1.9); heroLook.set(-11, 8.5, 0); }
    else { heroCam.set(-5, 3.4, 27); heroLook.set(-5, 4.2, 0); }
    camPos.copy(heroCam); look.copy(heroLook);
    camPos.x += mouse.x * 1.4; camPos.y += -mouse.y * .6;
    camera.position.copy(camPos); camera.lookAt(look); camera.updateMatrixWorld();

    // ---- water follows the camera ----
    water.position.x = Math.round(camera.position.x / GRID) * GRID;
    water.position.z = Math.round((camera.position.z - 130) / GRID) * GRID;
    W.uTime.value = t;

    // ---- CSS sky behind the transparent canvas: horizon line + sun glow follow the camera ----
    tmpV.set(camera.position.x, camera.position.y, camera.position.z - 400).project(camera);
    setVar('--hy', clamp((1 - (tmpV.y * .5 + .5)) * 100, -60, 140).toFixed(1) + '%');
    tmpV.copy(camera.position).addScaledVector(W.uSunDir.value, 300).project(camera);
    setVar('--sx', clamp((tmpV.x * .5 + .5) * 100, -40, 140).toFixed(1) + '%');
    setVar('--sy', clamp((1 - (tmpV.y * .5 + .5)) * 100, -40, 140).toFixed(1) + '%');

    islands.update(.001, false);
    birds.forEach((b) => {
      const x = b.cx + ((((b.phase + t * b.speed) % 100) + 100) % 100) - 50;
      b.g.position.set(x, b.y + Math.sin(t * .8 + b.phase) * .5, b.z); b.g.rotation.y = b.speed > 0 ? 0 : Math.PI;
      if (b.mixer) b.mixer.update(dt * b.rate);
      else { const fl = Math.sin(t * 7 + b.phase) * .55; b.proc.wl.rotation.x = fl; b.proc.wr.rotation.x = -fl; }
    });

    renderer.render(scene, camera);
  }

  // ---- progressive model swaps ----
  const handlers = {
    async junk(gltf) {
      const m = polish(gltf.scene); boat.add(m);
      await precompile(renderer, m, camera, scene);
      if (disposed) return;
      boat.remove(procBoat.group); disposeTree(procBoat.group); sails = [];
    },
    async pier(gltf) {
      const m = polish(gltf.scene); m.rotation.y = Math.PI; m.position.x = pier.dx;   // hut at the shore end
      pier.slot.add(m);
      pier.sign.position.set(-3 + pier.dx, 3.0, 2.15);                               // lift the sign onto the front beam
      await precompile(renderer, pier.slot, camera, scene);
      if (disposed) return;
      pier.slot.remove(pier.proc); disposeTree(pier.proc);
    },
    async pillar(gltf) { islands.upgrade(gltf); },
    async gull(gltf) {
      const clip = gltf.animations[0];
      birds.forEach((b, i) => {
        const c = SkeletonUtils.clone(gltf.scene); polish(c); c.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
        b.g.remove(b.proc.group); disposeTree(b.proc.group); b.g.add(c);
        const mixer = new THREE.AnimationMixer(c); mixer.clipAction(clip).play(); mixer.setTime(hash(i, 9) * clip.duration); b.mixer = mixer;
      });
    },
  };
  const loading = loadModels({
    base: modelBase,
    onModel: async (id, gltf) => { if (!disposed) await handlers[id](gltf); },
    onError: (id, e) => { console.warn(`[landing-hero] model "${id}" failed, keeping the procedural stand-in:`, e); },
  });

  raf = requestAnimationFrame(frame);
  const reveal = () => { if (!disposed) canvas.style.opacity = '1'; };
  const ready = Promise.race([loading.done, new Promise((r) => setTimeout(r, REVEAL_MAX_MS))]).then(reveal);

  return {
    ready,
    status: loading.status,
    perf: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, textures: renderer.info.memory.textures }),
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect(); removeEventListener('pointermove', onPointer);
      disposeDeep(scene);
      renderer.dispose(); renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
