import type { ISoundEngine, SoundHandle } from './ISoundEngine';

const TONES: Record<string, { frequency: number; duration: number }> = {
  spawn: { frequency: 440, duration: 0.15 },
  hit: { frequency: 880, duration: 0.12 }, // an octave up, snappier — a collect
};


export class OscillatorSoundEngine implements ISoundEngine {
  createSource(id: string, context: AudioContext): SoundHandle | null {
    const tone = TONES[id];
    if (!tone) return null;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.frequency.value = tone.frequency;
    gain.gain.setValueAtTime(0.3, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + tone.duration);
    osc.connect(gain);
    osc.start();
    osc.stop(context.currentTime + tone.duration);
    return { source: osc, output: gain };
  }
}
