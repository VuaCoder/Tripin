import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

// Normalised by the TRIPRI asset pipeline (kept outside the repo): +Y up, water at y = 0, bow toward +X,
// Meshopt-compressed geometry, WebP textures. 
export const MODEL_FILES = {
  junk: 'junk-ship.glb',
  fishing: 'fishing-boat.glb',
  ghebien: 'ghe-bien.glb',
  lighthouse: 'lighthouse.glb',
  pier: 'pier.glb',
  pillar: 'stone-pillar.glb',
  gull: 'seagull.glb',
};

const TIMEOUT_MS = 20000;

/**
 * Starts the downloads in parallel. `onModel(id, gltf)` is called as each one finishes; a model that fails or times
 * out is reported through `onError(id, err)` and the procedural stand-in simply stays in the scene.
 * `done` resolves when everything has settled and never rejects.
 */
export function loadModels({ base, onModel, onError, files = MODEL_FILES }) {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const status = {};
  const jobs = Object.entries(files).map(([id, file]) => {
    status[id] = 'loading';
    let timer;
    const load = new Promise((resolve, reject) => loader.load(base + file, resolve, undefined, reject));
    const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`timeout loading ${file}`)), TIMEOUT_MS); });
    return Promise.race([load, timeout]).then(
      async (gltf) => { try { await onModel(id, gltf); status[id] = 'ok'; } catch (e) { status[id] = 'error'; onError?.(id, e); } },
      (e) => { status[id] = 'error'; onError?.(id, e); },
    ).finally(() => clearTimeout(timer));
  });
  return { status, done: Promise.all(jobs).then(() => undefined) };
}

/** Compile shaders off the main thread (when supported) before an object is swapped in, to avoid a hitch. */
export async function precompile(renderer, obj, camera, scene) {
  try { await renderer.compileAsync(obj, camera, scene); } catch { /* non-fatal */ }
}

export function polish(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (m.map) m.map.anisotropy = 4;
      if (m.name === 'Glass') { // lighthouse lantern: warm glow instead of a dark pane
        m.emissive = new THREE.Color(0xffd59a); m.emissiveIntensity = 1.4; m.transparent = false; m.opacity = 1;
      }
    }
  });
  return root;
}

/** Free GPU resources of everything under `root` (geometries, materials and every texture slot). */
export function disposeDeep(root) {
  const seen = new Set();
  root.traverse((o) => {
    if (o.geometry && !seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); }
    if (o.isInstancedMesh) o.dispose();
    if (!o.material) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (seen.has(m)) continue;
      seen.add(m);
      for (const v of Object.values(m)) if (v && v.isTexture) v.dispose();
      m.dispose();
    }
  });
}
