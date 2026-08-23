// Embedding https://github.com/KilledByAPixel/LittleJS/blob/main/src/engineFont.png
// Licensed under The MIT License
// Copyright (c) 2021 Frank Force http://www.frankforce.com

/*
| approach | real zipped bundle size |
|---|---|
| hardcoded `Record<string, number[]>` (previous message) | 7910 B |
| ship `engineFont.png`, base64-inlined, decode via `Image`+canvas at startup | 8053 B |
| ship `engineFont.png` as a separate zip entry, same runtime decode | 8082 B |
| **raw bits, base64'd into one string, `atob()` + arithmetic lookup** | **7751 B** |

The PNG-shipping versions lost to the hardcoded array.
base64 re-encoding partly destroys the byte patterns the PNG's own compression exploited, 
and DEFLATE compresses the repetitive hardcoded-array *text* better than it compresses base64 *text* of already-compressed binary. 
The zip container also charges per-file overhead, so a second file for something this small is a net loss.

The winning approach uses the PNG only as the *source* I read pixels from (same process as before, same 32×3 grid, same 8×8 glyphs) 
the file itself isn't shipped.
What ships is 760 raw bytes (8 bytes × 95 glyphs), base64'd into one string, unpacked at runtime with `atob()` and indexed by arithmetic instead of a keyed lookup

*/

export const GLYPH_W = 8;
export const GLYPH_H = 8;
const FIRST_CHAR = 0x20;

const PACKED =
  'AAAAAAAAAAAweHgwMAAwAGxsbAAAAAAAbGz+bP5sbAAQftD+FvwQAADGzBgwZsYAOGw4dtzMdgA4MGAAAAAAABgwYGBgMBgAYDAYGBgwYAAAbDj+OGwAAAAwMPwwMAAAAAAAAAAwMDAAAAD8AAAAAAAAAAAAMDAABgwYMGDAgAB8xs7+5sZ8ADBwMDAwMPwAfMYGPGDG/gB8xgYcBsZ8ABw8bMz+DB4A/sDA/AbGfAA8YMD8xsZ8AP7GBgwYMDAAfMbGfMbGfAB8xsZ+Bgx4AAAwMAAAMDAAADAwAAAwMGAMGDBgMBgMAAAA/AAA/AAAYDAYDBgwYAB4zAwYMAAwAHzG3t7ewHwAfMbG/sbGxgD8xsb8xsb8AHzGwMDAxnwA+MzGxsbM+AD+wMD8wMD+AP7AwPzAwMAAfMbAzsbGfADGxsb+xsbGAHgwMDAwMHgAHAwMDMzMeADGxsz4zMbGAMDAwMDAwP4Axu7+1sbGxgDG5vbezsbGAHzGxsbGxnwA/MbG/MDAwAB8xsbGxs58DvzGxvzMxsYAfMbAfAbGfAD8MDAwMDAwAMbGxsbGxnwAxsbGxmw4EADGxsbW/u7GAMZsOBA4bMYAzMx4MDAwMAD+DBgwYMD+AHhgYGBgYHgAwGAwGAwGAAB4GBgYGBh4ABA4bMYAAAAAAAAAAAAA/wBwMBgAAAAAAAAAfAZ+xn4AwMD8xsbG/AAAAHzGwMZ8AAYGfsbGxn4AAAB8xv7AfAA8YGD4YGBgAAAAfsbGfgZ8wMD8xsbGxgAwAHAwMDB4ABgAOBgYGBhwwMDGzPjMxgBwMDAwMDAcAAAAbP7WxsYAAAD4zMzMzAAAAHzGxsZ8AAAA/MbG/MDAAAB+xsZ+BgcAAPzGwMDAAAAAfsB8BvwAYGD4YGBgPAAAAMbGxsZ+AAAAxsZsOBAAAADGxtb+bAAAAMZsOGzGAAAAxsbGfgZ8AAD8GDBg/AAcMDBgMDAcADAwMAAwMDAAcBgYDBgYcABw1hwAAAAAAA==';

function unpack(): Uint8Array {
  const bin = atob(PACKED);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

const DATA = unpack(); // 8 bytes/glyph, dense, indexed by (charCode - FIRST_CHAR)

export function glyphRows(ch: string): number[] | undefined {
  const i = ch.charCodeAt(0) - FIRST_CHAR;
  if (i < 0 || i * GLYPH_H + GLYPH_H > DATA.length) return undefined;
  const base = i * GLYPH_H;
  return [DATA[base], DATA[base + 1], DATA[base + 2], DATA[base + 3], DATA[base + 4], DATA[base + 5], DATA[base + 6], DATA[base + 7]];
}

/* @__NO_SIDE_EFFECTS__ */
export function isLit(rows: number[], x: number, y: number): boolean {
  return ((rows[y] >> (GLYPH_W - 1 - x)) & 1) === 1;
}