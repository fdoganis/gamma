// Turns a string into the set of lit cells that make up its glyphs, in an
// integer grid: [col, row] with the origin top-left, +col right, +row down.
// A text engine scales these into its own primitives (voxels, segments, …) and
// centres them using `width`. Implementations: bitmap font (BitmapGlyphs) or a
// live canvas rasterisation (CanvasGlyphs).
export interface Glyphs {
  cells: Array<[number, number]>;
  width: number;  // grid columns spanned (for centring)
  height: number; // grid rows spanned (for the +y-up flip)
}

export interface IGlyphSource {
  layout(text: string): Glyphs;
}
