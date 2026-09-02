// Fork knobs. Each value is a literal const — rolldown folds `=== 'x'` at build
// time and tree-shakes the branches that aren't picked, so a game built on this
// engine edits this one file and gets a minimal bundle with no code deletion.
// (Complements the `__DEV__` vite define, which is build-mode-tied.)

// Glyph source for VoxelTextEngine:
//   'light'  — ~38 glyphs (0-9 A-Z space + -), the game's charset, smallest
//   'full'   — the whole 95-glyph LittleJS font
//   'canvas' — rasterise the browser's monospace font, no glyph data shipped
export const GLYPH_SOURCE: 'full' | 'light' | 'canvas' = 'light';

// Draw a dark full-size copy behind each voxel so glyphs read against bright AR
// passthrough. Doubles a label's instance count (still one draw call). `false`
// removes the second layer and its code entirely.
export const VOXEL_OUTLINE = true;
