import { CanvasTexture, SRGBColorSpace } from 'three';
import type { Texture } from 'three';

// A hand-drawn matcap for the text voxels: a bright warm highlight upper-left
// cooling toward a near-black rim, so every voxel reads with a lit face and dark
// edges (a baked-in outline). MeshMatcapMaterial multiplies it by each voxel's
// instanceColor, so coloured labels stay coloured and white ones pick up the
// warm→cool tint — "white yet colourful" without depending on scene lights.
export function makeMatcap(size = 64): Texture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d')!;
  // Strong bright→dark sweep so a curved ('octa') voxel's facets read as real
  // 3D form: tight warm highlight up-left, quick falloff to a genuinely dark
  // lower/back half. (On a flat 'box' voxel the whole face samples one texel
  // near the centre, so pick a tone that still reads against white/void.)
  const g = ctx.createRadialGradient(size * 0.34, size * 0.30, size * 0.03, size * 0.5, size * 0.5, size * 0.72);
  g.addColorStop(0.00, '#fffef8');
  g.addColorStop(0.18, '#e9edf8');
  g.addColorStop(0.44, '#95a1c6');
  g.addColorStop(0.70, '#464f6e');
  g.addColorStop(1.00, '#0e101a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new CanvasTexture(cv);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}
