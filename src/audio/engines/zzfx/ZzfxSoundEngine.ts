// Needs the fuller zzfx.js (github.com/KilledByAPixel/ZzFX), not ZzFXMicro.min.js 
// Only the full build exports zzfxG (render to samples
// without playing) alongside zzfx (render and auto-play through its own
// context). zzfxG is what makes a zzfx sound positionable.
import type { SoundEngine, SoundHandle } from '../../SoundEngine';
import { zzfxG } from './zzfx';

const SOUNDS: Record<string, (number | undefined)[]> = {
  spawn: [1.2, , 523, .02, .05, .1, 1, 1.5, , , 200, .05, , , , , , .8, .02],
};

export class ZzfxSoundEngine implements SoundEngine {
  createSource(id: string, context: AudioContext): SoundHandle | null {
    const params = SOUNDS[id];
    if (!params) return null;
    const samples = zzfxG(...params);
    const buffer = context.createBuffer(1, samples.length, 44100);
    buffer.copyToChannel(samples as Float32Array<ArrayBuffer>, 0); // TODO: FIXME: CHECK: .d.ts
    const source = context.createBufferSource();
    source.buffer = buffer;
    return { source, output: source }; // zzfx already baked its own envelope
  }
}
