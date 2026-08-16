// TODO: ARCHI: WIP

import CPlayer from './player-small';
import type { SoundEngine, SoundHandle } from '../../SoundEngine';

const SONGS: Record<string, object> = { spawn: { /* one-instrument, one-note song object */ } };

export class SoundBoxSoundEngine implements SoundEngine {
  #buffers = new Map<string, AudioBuffer>();

  createSource(id: string, context: AudioContext): SoundHandle | null {
    let buffer = this.#buffers.get(id);
    if (!buffer) {
      const song = SONGS[id];
      if (!song) return null;
      const player = new CPlayer();
      player.init(song);
      while (player.generate() < 1) { }
      buffer = player.createAudioBuffer(context);
      this.#buffers.set(id, buffer as AudioBuffer); // TODO: FIME: CHECK: add proper .d.ts
    }
    const source = context.createBufferSource();
    source.buffer = buffer as AudioBuffer; // TODO: FIME: CHECK: add proper .d.ts
    return { source, output: source };
  }
}