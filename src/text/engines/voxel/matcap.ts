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
  // Centre = the tone a flat camera-facing voxel gets: a light cool grey that
  // still reads against white/void. Small warm glint offset up-left; hard dark
  // rim for the silhouette edge.
  const g = ctx.createRadialGradient(size * 0.36, size * 0.32, size * 0.04, size * 0.5, size * 0.5, size * 0.7);
  g.addColorStop(0.00, '#fff8ec');
  g.addColorStop(0.14, '#dfe4f2');
  g.addColorStop(0.40, '#b7c0dc');
  g.addColorStop(0.74, '#7b85a6');
  g.addColorStop(0.90, '#3a3f54');
  g.addColorStop(1.00, '#14161f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new CanvasTexture(cv);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}
