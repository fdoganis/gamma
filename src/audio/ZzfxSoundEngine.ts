import { zzfx, zzfxX } from './ZzFX'
import type { SoundEngine } from './SoundEngine';

const SOUNDS: Record<string, (number | undefined)[]> = {
  'spawn': [1.2, , 523, .02, .05, .1, 1, 1.5, , , 200, .05, , , , , , .8, .02]
};

export class ZzfxSoundEngine implements SoundEngine {
  play(id: string): void {
    const params = SOUNDS[id];
    if (params) zzfx(...params);
  }

  activate(): void {
    if (zzfxX.state === 'suspended') zzfxX.resume();
  }
}