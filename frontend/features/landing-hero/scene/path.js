import { clamp, lerp } from './util.js';

// ================= ĐƯỜNG ĐI CỦA THUYỀN (verbatim from tripri-hero-v5) =================
export const R = 10;
export const L = 140;
export const SEG = [.04, .17, .27, .70, .78, .94];   // mốc cuộn của từng đoạn
export const END = { x: 52, z: -160 };

export function boatPath(p) {
  let x, z, dx, dz;
  if (p < SEG[1]) { const u = clamp((p - SEG[0]) / (SEG[1] - SEG[0])); const f = Math.pow(u, 1.5); x = lerp(-14, 10, f); z = 0; dx = 1; dz = 0; }
  else if (p < SEG[2]) { const u = (p - SEG[1]) / (SEG[2] - SEG[1]), a = u * Math.PI / 2; x = 10 + R * Math.sin(a); z = -R * (1 - Math.cos(a)); dx = Math.cos(a); dz = -Math.sin(a); }
  else if (p < SEG[3]) { const u = (p - SEG[2]) / (SEG[3] - SEG[2]); x = 20; z = -10 - u * L; dx = 0; dz = -1; }
  else if (p < SEG[4]) { const u = (p - SEG[3]) / (SEG[4] - SEG[3]), a = u * Math.PI / 2; x = 20 + R * (1 - Math.cos(a)); z = -150 - R * Math.sin(a); dx = Math.sin(a); dz = -Math.cos(a); }
  else { const u = clamp((p - SEG[4]) / (SEG[5] - SEG[4])); const f = 1 - Math.pow(1 - u, 2); x = lerp(30, END.x, f); z = -160; dx = 1; dz = 0; }
  return { x, z, dx, dz };
}
