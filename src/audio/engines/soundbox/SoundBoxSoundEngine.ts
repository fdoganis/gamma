// SoundBox (CPlayer) engine: every cue — SFX and the music bed — is a tiny
// SoundBox song rendered once to an AudioBuffer and cached. AudioManager routes
// the buffer through its AudioListener (mute + positioning), same as the other
// engines. Authored by hand (no tracker), so the instruments are real presets
// lifted from a public SoundBox song and the "songs" are a few notes each.
import { CPlayer } from './player-small';
import type { ISoundEngine, SoundHandle } from '../../ISoundEngine';

// Instrument presets (29-int SoundBox `i` arrays), shared across cues. Lifted
// verbatim from Rybar/voxby songs/pot-break.js (its four instruments).
const NOISE_HIT  = [0, 0, 140, 0, 0, 0, 140, 0, 0, 81, 4, 10, 47, 55, 0, 0, 0, 187, 5, 0, 1, 239, 135, 0, 32, 108, 5, 16, 4];
const NOISE_TICK = [0, 0, 128, 0, 0, 0, 128, 0, 0, 125, 0, 1, 59, 0, 0, 0, 0, 0, 0, 0, 2, 193, 171, 0, 29, 39, 3, 88, 3];
const LEAD       = [3, 116, 128, 0, 0, 154, 140, 59, 0, 127, 2, 2, 47, 61, 0, 0, 0, 96, 3, 1, 3, 94, 79, 0, 32, 84, 2, 48, 4];
const BASS       = [0, 255, 116, 64, 0, 255, 120, 0, 64, 127, 4, 6, 35, 0, 0, 0, 0, 0, 0, 0, 2, 14, 0, 3, 72, 0, 0, 25, 3];

type Track = { inst: number[]; seq: number[] }; // seq: one note per row from row 0 (0 = rest)
type Cue = { tracks: Track[]; rows?: number; rowLen?: number; loop?: boolean };

const SFX_ROWLEN = 2205; // ~50 ms/row — snappy

// Placeholder melodies — a few SoundBox note ints each. The instruments are real;
// these note sequences are meant to be replaced by tracker exports (see GNOMES §5).
const CUES: Record<string, Cue> = {
  spawn:   { tracks: [{ inst: NOISE_HIT,  seq: [135] }] },
  hit:     { tracks: [{ inst: NOISE_HIT,  seq: [147, 0, 159] }], rowLen: 1500 },
  unicorn: { tracks: [{ inst: LEAD,       seq: [130, 0, 123] }], rowLen: 3200 },
  win:     { tracks: [{ inst: LEAD,       seq: [147, 151, 154, 159] }], rowLen: 3600 },
  over:    { tracks: [{ inst: BASS,       seq: [123, 0, 116, 0, 109] }], rowLen: 4200 },
  tick:    { tracks: [{ inst: NOISE_TICK, seq: [159] }], rowLen: 1400 },
  music:   {
    tracks: [
      { inst: BASS, seq: [123, 0, 0, 0, 128, 0, 0, 0, 126, 0, 0, 0, 121, 0, 0, 0] },
      { inst: LEAD, seq: [0, 0, 147, 0, 0, 0, 154, 0, 0, 0, 151, 0, 0, 0, 159, 0] },
    ],
    rows: 16, rowLen: 5513, loop: true, // ~2 s loop
  },
};

function toSong(cue: Cue): object {
  const rows = cue.rows ?? Math.max(...cue.tracks.map((t) => t.seq.length)) + 4; // tail rows so releases ring out
  return {
    songData: cue.tracks.map((t) => {
      const n = new Array(rows * 4).fill(0); // SoundBox pattern: 4 sub-columns of `rows`
      t.seq.forEach((note, r) => { if (note) n[r] = note; });
      return { i: t.inst, p: [1], c: [{ n, f: [] }] };
    }),
    rowLen: cue.rowLen ?? SFX_ROWLEN,
    patternLen: rows,
    endPattern: 0,
    numChannels: cue.tracks.length,
  };
}

export class SoundBoxSoundEngine implements ISoundEngine {
  #buffers = new Map<string, AudioBuffer>();

  createSource(id: string, context: AudioContext): SoundHandle | null {
    const cue = CUES[id];
    if (!cue) return null;

    let buffer = this.#buffers.get(id);
    if (!buffer) {
      const player = new CPlayer();
      player.init(toSong(cue));
      while (player.generate() < 1) { /* one pass per channel */ }
      buffer = player.createAudioBuffer(context);
      this.#buffers.set(id, buffer);
    }

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = !!cue.loop;
    source.start();
    return { source, output: source };
  }
}
