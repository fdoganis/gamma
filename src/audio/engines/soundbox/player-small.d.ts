// Types for the vendored SoundBox CPlayer (player-small.js). The runtime export
// is a constructor function; declared here as a class for `new CPlayer()`.
export class CPlayer {
  // Load a SoundBox song object (songData / rowLen / patternLen / endPattern / numChannels).
  init(song: object): void;
  // Render one channel per call; returns progress 0..1 (>= 1 when the whole song is done).
  generate(): number;
  // Pack the rendered mix into a stereo AudioBuffer on the given context.
  createAudioBuffer(context: BaseAudioContext): AudioBuffer;
}
