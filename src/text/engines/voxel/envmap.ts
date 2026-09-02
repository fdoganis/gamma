import { CanvasTexture, EquirectangularReflectionMapping, SRGBColorSpace } from 'three';
import type { Texture } from 'three';

// A hand-drawn equirect env map for the text voxels: a sky gradient, a dark
// ground band, one bright sun disc. As a metallic material's envMap it makes
// each OctahedronGeometry voxel a little chrome chip whose facets reflect
// different parts of it — the text glints as the head moves (alive in XR), and
// the sun keeps some facets bright against any background. Built at runtime, so
// nothing ships; the PBR shader is in the external three.
export function makeEnvMap(w = 128, h = 64): Texture {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d')!;

  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0.00, '#eef3ff');
  sky.addColorStop(0.55, '#8fa2cc');
  sky.addColorStop(1.00, '#41496a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = '#171a26'; // dark ground band
  ctx.fillRect(0, h * 0.62, w, h * 0.38);

  const sun = ctx.createRadialGradient(w * 0.4, h * 0.28, 0, w * 0.4, h * 0.28, h * 0.22);
  sun.addColorStop(0.0, '#ffffff');
  sun.addColorStop(0.4, '#fff4d6');
  sun.addColorStop(1.0, 'rgba(255,244,214,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, w, h);

  const tex = new CanvasTexture(cv);
  tex.mapping = EquirectangularReflectionMapping;
  tex.colorSpace = SRGBColorSpace;
  return tex;
}
