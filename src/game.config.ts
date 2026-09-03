// Fork knobs. Each value is a literal const — rolldown folds `=== 'x'` at build
// time and tree-shakes the branches that aren't picked, so a game built on this
// engine edits this one file and gets a minimal bundle with no code deletion.
// (Complements the `__DEV__` vite define, which is build-mode-tied.)

// Text rendering engine:
//   'voxel'   — bitmap-font glyphs as instanced voxel cubes (the default)
//   'segment' — 16-segment retro-LED alphanumeric display; no glyph data, so a
//               'segment' fork tree-shakes VoxelTextEngine + all of glyphs/
export const TEXT_ENGINE: 'voxel' | 'segment' = 'voxel';

// Glyph source for VoxelTextEngine:
//   'light'  — ~38 glyphs (0-9 A-Z space + -), the game's charset, smallest
//   'full'   — the whole 95-glyph LittleJS font
//   'canvas' — rasterise the browser's monospace font, no glyph data shipped
export const GLYPH_SOURCE: 'full' | 'light' | 'canvas' = 'light';

// Voxel text shading:
//   'phong'  — MeshPhongMaterial lit by the scene (picks up the sky tint)
//   'matcap' — a tiny canvas-drawn matcap, baked once; screen-consistent,
//              ignores scene lights
//   'env'    — MeshStandardMaterial (metallic) + a tiny hand-drawn env map;
//              each voxel a chrome chip that glints as the head moves. Best
//              paired with VOXEL_SHAPE 'octa'.
export const VOXEL_SHADING: 'phong' | 'matcap' | 'env' = 'phong';

// Voxel primitive:
//   'box'  — BoxGeometry, the classic square "pixel"
//   'octa' — OctahedronGeometry: varied normals, so matcap/env show real
//            per-voxel form (a shaded gem)
export const VOXEL_SHAPE: 'box' | 'octa' = 'box';
