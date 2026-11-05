import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { clamp, smooth, lerp, hash, raw, rawHex, disposeTree } from './util.js';
import { SEG, END, boatPath } from './path.js';
import { createWater, ISL_N } from './water.js';
import { Islands } from './islands.js';
import { buildChapters, animateChapters } from './chapters.js';
import { loadModels, precompile, polish, disposeDeep } from './assets.js';
import {
  makeBoatProcedural, makePierProcedural, makeSign, makeRaft, makeSampan, makeBirdProcedural, makeBirdShared, makeRockBase,
} from './procedural.js';

/**
 * TRIPRI hero journey (ported from blender/tripri-hero `main.js`, v6 glTF). Same scene, SEG constants, camera, dirS /
 * yaw reverse-scroll logic, water shader; the story chapters replace the v5 side-text beats; only the host changed: the scroll position comes from
 * `getProgress()` (a GSAP ScrollTrigger pin in the page) instead of a sticky track, and the DOM pieces are passed in.
 *
 * The v5 procedural boat / piers / islands / gulls render first and stay when a model fails to load.
 * The canvas fades in once the models are swapped in (or after REVEAL_MAX_MS).
 *
 * @param {{
 *   speedScale?: number,                      // journey scroll length relative to v5 (5.4 viewports); keeps the dirS thresholds feeling the same
 *   stage: HTMLElement,                       // receives the canvas and the --sky/--hy/--sx/--sy/--glow variables
 *   getProgress: () => number,                // 0..1 journey progress
 *   dom: { copy?: HTMLElement|null, hint?: HTMLElement|null, fin?: HTMLElement|null, vig?: HTMLElement|null, getNav?: () => HTMLElement|null },
 *   modelBase?: string,
 *   onFail?: (e: unknown) => void,
 * }} options
 */
export const REVEAL_MAX_MS = 6000;

export function createJourneyScene({ stage, getProgress, dom, speedScale = 1, modelBase = '/models/', onFail }) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;opacity:0;transition:opacity .9s ease';
  stage.appendChild(canvas);

  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' }); }
  catch (e) { canvas.remove(); onFail?.(e); return { dispose() {}, ready: Promise.resolve(), status: {}, perf: () => ({}) }; }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75)); renderer.setClearColor(0, 0);
  // three >= r155 uses physical light units: v5's (r128) intensities are multiplied by PI to keep the same brightness.
  const PI = Math.PI;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, .5, 600);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x8fb3b3, .9 * PI); scene.add(hemi);
  const sunL = new THREE.DirectionalLight(0xfff0dc, .95 * PI); sunL.position.set(-8, 14, 6); scene.add(sunL);

  // ================= NƯỚC =================
  const { mesh: water, W, islU, GRID } = createWater();
  scene.add(water);

  // objects that only exist for the arrival scene (v5 `endObjs`) are toggled by p > .5
  const endObjs = [];
  const models = {};            // id -> gltf, filled as downloads finish

  // ================= NÚI ĐÁ VÔI =================
  const islands = new Islands(scene, islU, ISL_N);
  for (let i = 0; i < 7; i++) { islands.add(-92 + hash(i, 1) * 70, -46 - hash(i, 2) * 64, 3 + hash(i, 3) * 3, 8 + hash(i, 4) * 9, i * 3); }
  for (let i = 0; i < 9; i++) islands.add(40 + hash(i, 5) * 60, -206 - hash(i, 6) * 64, 3 + hash(i, 7) * 3.2, 8 + hash(i, 8) * 9, i * 5 + 50);
  for (let i = 0; i < ISL_N; i++) { const side = i % 2 ? 1 : -1; islands.add(20 + side * (12 + hash(i, 9) * 9), -16 - i * 8.2, 2.2 + hash(i, 10) * 2.2, 5 + hash(i, 11) * 5, i * 7 + 100, true); }

  // ================= THUYỀN CHÍNH =================
  const boat = new THREE.Group(); boat.rotation.order = 'YXZ';
  const procBoat = makeBoatProcedural(); boat.add(procBoat.group);
  let sails = procBoat.sails;
  scene.add(boat);

  // ================= BẾN TÀU =================
  function makePierSlot(cx, z, len, text, signLocal, flipModel, modelDx) {
    const slot = new THREE.Group(); slot.position.set(cx, 0, z); scene.add(slot);
    const proc = makePierProcedural(len); slot.add(proc);
    const sign = makeSign(text); sign.position.copy(signLocal); slot.add(sign);
    return { slot, proc, sign, flipModel, modelDx };
  }
  const startPier = makePierSlot(-21.5, -3.4, 25, 'BẾN XUẤT PHÁT', new THREE.Vector3(25 * .28, 2.5, 1.55), true, 6.5);
  const endPier = makePierSlot(59, END.z - 3.4, 26, 'BẾN HẠ LONG', new THREE.Vector3(26 * .28, 2.5, 1.55), false, 0);
  endObjs.push(endPier.slot);

  // ================= CHI TIẾT: nhà bè, thuyền nan, phao =================
  const bobbers = [];
  function addRaft(x, z, roof, wall) {
    const g = makeRaft(roof, wall); g.position.set(x, 0, z); g.rotation.y = hash(x, z) * .8 - .4; scene.add(g); bobbers.push(g);
  }
  [[8, -34, 0xc4553a, 0xe9dcc2], [33, -62, 0x2d6fa8, 0xf0e6d0], [9, -96, 0xc4553a, 0xd9c6a0], [32, -122, 0x2f7872, 0xe9dcc2], [10, -140, 0xc4553a, 0xf0e6d0]].forEach((a) => addRaft(...a));
  const smallBoats = [];        // thuyền nan -> fishing_boat / ghe_bien
  [[27, -24, .5], [12, -50, 2.4], [27, -75, 1.2], [13, -108, .2], [28, -132, 2.8], [14, -66, 1.9]].forEach(([x, z, ry], i) => {
    const g = new THREE.Group(); g.add(makeSampan()); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g); bobbers.push(g);
    smallBoats.push({ g, i, swapped: false });
  });
  const buoyM = new THREE.MeshStandardMaterial({ color: 0xe4572e, roughness: .5 }), buoys = [];
  for (let k = 0; k < 5; k++) { for (let j = 0; j < 9; j++) { const b = new THREE.Mesh(new THREE.SphereGeometry(.24, 10, 8), buoyM); const bx = [28, 12, 30, 10, 29][k], bz = [-44, -82, -104, -128, -18][k]; b.position.set(bx + (j % 3) * 1.1, 0, bz + Math.floor(j / 3) * 1.1); scene.add(b); buoys.push(b); } }
  const moored = [];            // small boats tied up at the Ha Long pier (added when the models arrive)

  // ================= CHIM HẢI ÂU + BÓNG =================
  const birdShared = makeBirdShared();
  const sc = document.createElement('canvas'); sc.width = sc.height = 64; { const g = sc.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(3,25,32,.55)'); gr.addColorStop(1, 'rgba(3,25,32,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }
  const shTex = new THREE.CanvasTexture(sc); shTex.colorSpace = THREE.SRGBColorSpace;
  const shadowM = new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false, fog: false });
  const birds = [];
  function addBird(cx, z, y, speed, phase) {
    const g = new THREE.Group(), pb = makeBirdProcedural(birdShared); g.add(pb.group);
    if (cx === 42) endObjs.push(g);
    scene.add(g);
    birds.push({ g, proc: pb, mixer: null, cx, z, y, speed, phase, rate: .85 + hash(phase, 7) * .35 });
  }
  for (let i = 0; i < 6; i++) addBird(-2, -20 - hash(i, 21) * 40, 8 + hash(i, 22) * 6, (hash(i, 23) > .5 ? 1 : -1) * (1.4 + hash(i, 24) * 1.4), hash(i, 25) * 100);
  for (let i = 0; i < 16; i++) addBird(20, -12 - i * 8.4, 9 + hash(i, 26) * 7, (hash(i, 27) > .5 ? 1 : -1) * (1.6 + hash(i, 28) * 1.8), hash(i, 29) * 100);
  for (let i = 0; i < 6; i++) addBird(42, -176 - hash(i, 30) * 40, 8 + hash(i, 31) * 6, (hash(i, 32) > .5 ? 1 : -1) * (1.4 + hash(i, 33) * 1.4), hash(i, 34) * 100);
  const shadows = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), shadowM, birds.length);
  shadows.frustumCulled = false; shadows.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(shadows);

  // bóng mây trôi trên mặt nước (nhìn từ trên)
  const cc = document.createElement('canvas'); cc.width = cc.height = 128; { const g = cc.getContext('2d'), gr = g.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, 'rgba(2,20,28,.9)'); gr.addColorStop(1, 'rgba(2,20,28,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }
  const cloudTex = new THREE.CanvasTexture(cc); cloudTex.colorSpace = THREE.SRGBColorSpace;
  const cloudM = new THREE.MeshBasicMaterial({ map: cloudTex, transparent: true, opacity: 0, depthWrite: false, fog: false });
  const clouds = []; for (let i = 0; i < 7; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), cloudM); m.rotation.x = -Math.PI / 2; m.position.set(0, .4, 0); m.scale.set(26 + hash(i, 41) * 14, 16 + hash(i, 42) * 8, 1); m.userData = { x: -30 + hash(i, 43) * 100, z: -20 - i * 20, s: .5 + hash(i, 44) * .6 }; scene.add(m); clouds.push(m); }

  // ================= CHƯƠNG CÂU CHUYỆN =================
  const chapters = buildChapters(stage);

  // ================= RESIZE / INPUT =================
  let disposed = false;
  const narrow = () => innerWidth < 900;
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w / h < .9 ? 42 : 32; camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize); ro.observe(canvas); resize();
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  const onPointer = (e) => { mouse.tx = e.clientX / innerWidth - .5; mouse.ty = e.clientY / innerHeight - .5; };
  addEventListener('pointermove', onPointer, { passive: true });
  let visible = true;
  const io = new IntersectionObserver((es) => { visible = es[es.length - 1].isIntersecting; }); io.observe(stage);

  const { copy, hint, fin, vig } = dom;
  let target = clamp(getProgress()), p = target;
  // hướng đi của thuyền theo chiều cuộn: dirS = +1 (xuôi, mũi thuyền hướng tới) .. -1 (cuộn ngược, thuyền quay đầu đi về)
  let prevP = p, dirT = 1, dirS = 1, idleT = 0;

  const HTOP = raw(0xcfe3e1), HHOR = raw(0xf3f6f4), ETOP = raw(0xeed8bd), EHOR = raw(0xf7e6cf);
  const tmpC = new THREE.Color(), tmpC2 = new THREE.Color(), tmpS = new THREE.Color(), tmpV = new THREE.Vector3(), camPos = new THREE.Vector3(), look = new THREE.Vector3(), prevB = new THREE.Vector3();
  let speedS = 0;
  const t0 = performance.now();       // THREE.Clock is deprecated in recent three: same elapsed-seconds value
  let last = t0, raf = 0;
  const waveH = (x, z, t, a) => a * (Math.sin(x * .35 + t * 1.1) * .10 + Math.cos(z * .30 + t * .8) * .09 + Math.sin((x + z) * .12 + t * .5) * .14);
  const heroCam = new THREE.Vector3(), heroLook = new THREE.Vector3(), endCam = new THREE.Vector3(), endLook = new THREE.Vector3();
  const shM = new THREE.Matrix4(), shQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2), shP = new THREE.Vector3(), shS = new THREE.Vector3();
  const cssCache = {};
  const setVar = (k, v) => { if (cssCache[k] !== v) { cssCache[k] = v; stage.style.setProperty(k, v); } };

  function frame() {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    const now = performance.now(), dt = Math.min(.1, (now - last) / 1000); last = now;
    target = clamp(getProgress());
    p += (target - p) * (1 - Math.exp(-dt * 8));
    const dpdt = (p - prevP) / Math.max(dt, .001) * speedScale; prevP = p;
    if (dpdt > .03) dirT = 1; else if (dpdt < -.03) dirT = -1;
    idleT = Math.abs(dpdt) < .012 ? idleT + dt : 0;
    if (idleT > 1.2) dirT = 1;                                   // đứng yên một lúc thì thuyền quay lại hướng về phía trước
    dirS += (dirT - dirS) * (1 - Math.exp(-dt * 3.2));
    const t = reduce ? 0 : (now - t0) / 1000;

    // ---- trạng thái ----
    const topE = smooth(p, .13, .28) * (1 - smooth(p, .70, .80));          // 1 = nhìn từ trên xuống
    const endW = smooth(p, .70, .90);                                        // cảnh cập bến (hoàng hôn nhẹ)

    // ---- DOM ----
    if (copy) {
      const co = 1 - smooth(p, .045, .13);
      copy.style.opacity = co.toFixed(3); copy.style.pointerEvents = co < .05 ? 'none' : 'auto';
      copy.style.transform = `translate(${(smooth(p, .04, .14) * 60).toFixed(0)}px,${(-smooth(p, .04, .14) * 60).toFixed(0)}px)`;
    }
    if (hint) hint.style.opacity = (1 - smooth(p, 0, .03)).toFixed(2);
    animateChapters(chapters, p);
    if (fin) { const fo = smooth(p, .93, .985); fin.style.opacity = fo.toFixed(3); fin.style.pointerEvents = fo > .5 ? 'auto' : 'none'; fin.style.transform = `translateY(${((1 - fo) * 20).toFixed(1)}px)`; }
    if (vig) vig.style.opacity = (topE * .9).toFixed(2);
    dom.getNav?.()?.classList.toggle('tj-light', topE > .5);
    if (!visible || document.hidden) return;

    // ---- thuyền ----
    mouse.x += (mouse.tx - mouse.x) * .05; mouse.y += (mouse.ty - mouse.y) * .05;
    const bp = boatPath(p), ang = Math.atan2(-bp.dz, bp.dx);
    const bobAmp = lerp(1, .25, topE);
    const bh = waveH(bp.x, bp.z, t, bobAmp);
    boat.position.set(bp.x, bh + .12, bp.z);
    boat.rotation.y = ang + (1 - dirS) * .5 * Math.PI - .28 * (1 - topE) * dirS;
    const turn = (p >= SEG[1] && p < SEG[2]) ? 1 : (p >= SEG[3] && p < SEG[4]) ? -1 : 0;
    boat.rotation.x = .14 * (1 - topE) * 0 + Math.sin(t * .9) * .025 + turn * .1;
    boat.rotation.z = Math.sin(t * 1.1) * .03;
    sails.forEach((s, i) => { s.rotation.y = lerp([.15, .1, .05][i], [.62, -.55, .45][i], topE) + Math.sin(t * .7 + i) * .03; });
    const spd = prevB.distanceTo(tmpV.set(bp.x, 0, bp.z)) / Math.max(dt, .001); prevB.copy(tmpV); speedS += (spd - speedS) * .15;
    const dsg = dirS >= 0 ? 1 : -1; W.uBoat.value.set(bp.x, bp.z); W.uDir.value.set(bp.dx * dsg, bp.dz * dsg); W.uWake.value = clamp(speedS / 5, 0, 1);

    // ---- camera ----
    const f = narrow() ? 1.9 : 1;                                   // màn hẹp: lùi xa hơn
    heroCam.set(-5, 3.4, 27 * f); heroLook.set(-5, 2.6, 0);
    endCam.set(46, 3.4, END.z + 27 * f); endLook.set(46, 2.6, END.z);
    const sideCam = p < .5 ? heroCam : endCam, sideLook = p < .5 ? heroLook : endLook;
    camPos.copy(sideCam).lerp(tmpV.set(bp.x, 28 * (narrow() ? 1.6 : 1), bp.z + 11 * (narrow() ? 1.6 : 1)), topE);
    look.copy(sideLook).lerp(tmpV.set(bp.x, .8, bp.z), topE);
    camPos.x += mouse.x * 1.4 * (1 - topE); camPos.y += -mouse.y * .6 * (1 - topE);
    camera.position.copy(camPos); camera.lookAt(look); camera.updateMatrixWorld();

    // ---- nước theo camera ----
    water.position.x = Math.round(camera.position.x / GRID) * GRID;
    water.position.z = Math.round((camera.position.z - 130 * (1 - topE)) / GRID) * GRID;
    W.uTime.value = t; W.uAmp.value = bobAmp; W.uGlint.value = lerp(.8, .75, topE);
    W.uTint.value = endW * (1 - topE);
    W.uFogNear.value = lerp(30, 260, topE); W.uFogFar.value = lerp(150, 520, topE);

    // ---- sky/sương (display-space colours, see util.raw) ----
    tmpC.copy(HTOP).lerp(ETOP, endW); tmpC2.copy(HHOR).lerp(EHOR, endW);
    setVar('--sky-top', '#' + rawHex(tmpC)); setVar('--sky-hor', '#' + rawHex(tmpC2));
    W.uFog.value.copy(tmpC2); W.uSky.value.copy(tmpC).lerp(tmpC2, .35);
    hemi.intensity = lerp(.9, .8, topE) * PI; sunL.color.setHex(0xfff0dc).lerp(tmpS.setHex(0xffd0a0), endW * .8);
    tmpV.set(camera.position.x, camera.position.y, camera.position.z - 400).project(camera);
    setVar('--hy', clamp((1 - (tmpV.y * .5 + .5)) * 100, -60, 140).toFixed(1) + '%');
    tmpV.copy(camera.position).addScaledVector(W.uSunDir.value, 300).project(camera);
    setVar('--sx', clamp((tmpV.x * .5 + .5) * 100, -40, 140).toFixed(1) + '%');
    setVar('--sy', clamp((1 - (tmpV.y * .5 + .5)) * 100, -40, 140).toFixed(1) + '%');
    setVar('--glow', ((1 - topE) * lerp(.45, .85, endW)).toFixed(2));

    // vật thể dọc hành trình chỉ hiện khi nhìn từ trên (nhô lên theo camera)
    const rs = Math.max(.001, smooth(topE, .15, .7));
    const showEnd = p > .5;
    islands.update(rs, showEnd);
    endObjs.forEach((o) => { o.visible = showEnd; });
    // ---- chi tiết sống ----
    bobbers.forEach((g, i) => { g.visible = rs > .02; g.scale.setScalar(rs); g.position.y = waveH(g.position.x, g.position.z, t, bobAmp) * .9; g.rotation.z = Math.sin(t * .9 + i) * .02; g.rotation.x = Math.cos(t * .8 + i * 2) * .02; });
    moored.forEach((g, i) => { g.position.y = waveH(g.position.x, g.position.z, t, bobAmp) * .9; g.rotation.z = Math.sin(t * .9 + i * 2) * .02; });
    buoys.forEach((b) => { b.visible = rs > .02; b.position.y = waveH(b.position.x, b.position.z, t, bobAmp) + .1; });
    const shadowOn = topE > .02;
    shadows.visible = shadowOn;
    birds.forEach((b, i) => {
      const x = b.cx + ((((b.phase + t * b.speed) % 100) + 100) % 100) - 50;
      b.g.position.set(x, b.y + Math.sin(t * .8 + b.phase) * .5, b.z); b.g.rotation.y = b.speed > 0 ? 0 : Math.PI;
      const fl = Math.sin(t * 7 + b.phase) * .55;
      if (b.mixer) { if (!reduce && b.g.visible) b.mixer.update(dt * b.rate); }
      else { b.proc.wl.rotation.x = fl; b.proc.wr.rotation.x = -fl; }
      if (shadowOn) {
        shP.set(x + b.y * .28, .08, b.z + b.y * .33); const k = b.g.visible ? 1 : 0; shS.set(1.9 * k, (1.5 + Math.abs(fl) * .3) * k, 1);
        shadows.setMatrixAt(i, shM.compose(shP, shQ, shS));
      }
    });
    if (shadowOn) shadows.instanceMatrix.needsUpdate = true;
    cloudM.opacity = .2 * topE;
    clouds.forEach((c) => { const u = c.userData; c.position.x = 20 + (((u.x + t * u.s * .6) % 110) + 110) % 110 - 55; c.position.z = u.z; });

    renderer.render(scene, camera);
  }

  // ================= MODEL SWAPS (progressive enhancement) =================
  const handlers = {
    async junk(gltf) {
      const m = polish(gltf.scene); boat.add(m);
      await precompile(renderer, m, camera, scene);
      if (disposed) return;
      boat.remove(procBoat.group); disposeTree(procBoat.group); sails = [];
    },
    async fishing(gltf) { models.fishing = gltf.scene; applySmall(); mooring(); },
    async ghebien(gltf) { models.ghebien = gltf.scene; applySmall(); mooring(); },
    async pier(gltf) {
      for (const pr of [startPier, endPier]) {
        const m = gltf.scene.clone(true); polish(m); if (pr.flipModel) m.rotation.y = Math.PI; m.position.x = pr.modelDx;
        pr.slot.add(m); pr.slot.remove(pr.proc); disposeTree(pr.proc);
        // model deck is 3.2 wide and ~1.3 high: lift the sign board onto the front beam
        pr.sign.position.set((pr === startPier ? -3 : 2.4) + pr.modelDx, 3.0, 2.15);
      }
      await precompile(renderer, endPier.slot, camera, scene);
    },
    async pillar(gltf) { islands.upgrade(gltf); },
    async lighthouse(gltf) {
      const g = new THREE.Group(); g.position.set(80, 0, -214); g.scale.setScalar(1.1);
      g.add(makeRockBase());
      const lh = polish(gltf.scene.clone(true)); lh.position.y = 1.05; g.add(lh);
      scene.add(g); endObjs.push(g);
    },
    async gull(gltf) {
      const clip = gltf.animations[0];
      birds.forEach((b, i) => {
        const c = SkeletonUtils.clone(gltf.scene); polish(c); c.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
        b.g.remove(b.proc.group); b.proc.group.visible = false; b.g.add(c);
        const mixer = new THREE.AnimationMixer(c); const a = mixer.clipAction(clip); a.play(); mixer.setTime((hash(i, 9) * clip.duration)); b.mixer = mixer;
      });
    },
  };
  function applySmall() {
    for (const s of smallBoats) {
      if (s.swapped) continue;
      const src = s.i % 2 ? models.ghebien : models.fishing;
      if (!src) continue;
      const m = polish(src.clone(true)); const old = [...s.g.children]; s.g.add(m); old.forEach((o) => { s.g.remove(o); disposeTree(o); }); s.swapped = true;
    }
  }
  function mooring() {
    if (moored.length >= 2 || !models.fishing || !models.ghebien) return;
    [[models.ghebien, 61.2, END.z + 1.4, .1], [models.fishing, 37.5, END.z + 5.5, .38]].forEach(([src, x, z, ry]) => {
      const g = new THREE.Group(); g.add(polish(src.clone(true))); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g); endObjs.push(g); moored.push(g);
    });
  }

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
    get progress() { return p; },
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
