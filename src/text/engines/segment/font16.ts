// 16-segment "Union Jack" alphanumeric font for the game's charset
// (space, '+', '-', 0-9, A-Z). Cell layout, y-up:
//
//      A1   A2
//    F  H  I  K  B
//      G1   G2
//    E  L  M  N  C
//      D1   D2
//
// Authored as lit-segment lists and packed to uint16 masks (SEG bit order) by a
// /*#__PURE__*/ IIFE, so the whole table drops when a 'voxel' fork tree-shakes
// SegmentTextEngine. These are starting shapes — tune by screenshot (see
// .doc/GNOMES.md §0); a housekeeping pass can later bake them to a flat literal.

export const FONT16: Record<string, number> = /*#__PURE__*/ (() => {
  const SEG = ['A1', 'A2', 'B', 'C', 'D1', 'D2', 'E', 'F', 'G1', 'G2', 'H', 'I', 'K', 'L', 'M', 'N'];
  const lit: Record<string, string> = {
    ' ': '',
    '-': 'G1 G2',
    '+': 'G1 G2 I M',
    '0': 'A1 A2 B C D1 D2 E F K L',
    '1': 'B C',
    '2': 'A1 A2 B G1 G2 E D1 D2',
    '3': 'A1 A2 B C D1 D2 G1 G2',
    '4': 'F B G1 G2 C',
    '5': 'A1 A2 F G1 G2 C D1 D2',
    '6': 'A1 A2 F E D1 D2 C G1 G2',
    '7': 'A1 A2 B C',
    '8': 'A1 A2 B C D1 D2 E F G1 G2',
    '9': 'A1 A2 B C D1 D2 F G1 G2',
    'A': 'A1 A2 B C E F G1 G2',
    'B': 'A1 A2 B C D1 D2 G2 I M',
    'C': 'A1 A2 F E D1 D2',
    'D': 'A1 A2 B C D1 D2 I M',
    'E': 'A1 A2 F E D1 D2 G1 G2',
    'F': 'A1 A2 F E G1 G2',
    'G': 'A1 A2 F E D1 D2 C G2',
    'H': 'B C E F G1 G2',
    'I': 'A1 A2 D1 D2 I M',
    'J': 'B C D1 D2 E',
    'K': 'F E G1 K N',
    'L': 'F E D1 D2',
    'M': 'F E B C H K',
    'N': 'F E B C H N',
    'O': 'A1 A2 B C D1 D2 E F',
    'P': 'A1 A2 B F E G1 G2',
    'Q': 'A1 A2 B C D1 D2 E F N',
    'R': 'A1 A2 B F E G1 G2 N',
    'S': 'A1 A2 F G1 G2 C D1 D2',
    'T': 'A1 A2 I M',
    'U': 'B C D1 D2 E F',
    'V': 'F E K L',
    'W': 'F E B C L N',
    'X': 'H K L N',
    'Y': 'H K M',
    'Z': 'A1 A2 K L D1 D2',
  };
  const out: Record<string, number> = {};
  for (const ch in lit) {
    out[ch] = lit[ch] ? lit[ch].split(' ').reduce((m, s) => m | (1 << SEG.indexOf(s)), 0) : 0;
  }
  return out;
})();
