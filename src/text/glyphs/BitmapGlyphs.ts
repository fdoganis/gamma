// A packed 8x8 bitmap font as an IGlyphSource. Deterministic across every
// browser/OS (no canvas, no font availability question). `full-font` and
// `light-font` are the same class with different data + index maps.
import type { IGlyphSource, Glyphs } from './IGlyphSource';

const GLYPH_W = 8;
const GLYPH_H = 8;
const ADVANCE = GLYPH_W + 1; // one blank column between glyphs

export type BitmapFont = {
  data: Uint8Array;                  // GLYPH_H bytes per glyph, one bit = one lit cell
  indexOf: (ch: string) => number;  // glyph slot for a character, or -1
};

export class BitmapGlyphs implements IGlyphSource {
  #font: BitmapFont;
  constructor(font: BitmapFont) { this.#font = font; }

  layout(text: string): Glyphs {
    const cells: Array<[number, number]> = [];
    let col = 0;
    for (const ch of text) {
      const gi = this.#font.indexOf(ch);
      if (gi < 0) continue; // unknown glyph: skip it entirely, like the original
      const base = gi * GLYPH_H;
      for (let y = 0; y < GLYPH_H; y++) {
        const row = this.#font.data[base + y];
        for (let x = 0; x < GLYPH_W; x++) {
          if ((row >> (GLYPH_W - 1 - x)) & 1) cells.push([col + x, y]);
        }
      }
      col += ADVANCE;
    }
    return { cells, width: Math.max(0, col - 1), height: GLYPH_H };
  }
}
