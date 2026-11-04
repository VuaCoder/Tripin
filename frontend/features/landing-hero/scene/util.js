import * as THREE from 'three';

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const smooth = (x, a, b) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const lerp = (a, b, t) => a + (b - a) * t;
export const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };

/**
 * v5 was authored for three r128 (no colour management: hex values were used as display values).
 * `raw()` keeps those display-space values in a THREE.Color without the sRGB->linear conversion, so sky/fog
 * colours that are mixed in the water shader and written to CSS stay identical to v5.
 */
export const raw = (hex) => new THREE.Color().setHex(hex, THREE.LinearSRGBColorSpace);
export const rawHex = (c) => c.getHexString(THREE.LinearSRGBColorSpace);

/** Dispose geometries/materials/textures of a procedural fallback subtree. */
export function disposeTree(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (m.map) m.map.dispose();
        m.dispose();
      }
    }
  });
}
