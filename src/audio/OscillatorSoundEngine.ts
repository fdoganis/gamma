// Zero-dependency default pure Web Audio
import type { SoundEngine } from './SoundEngine';

const TONES: Record<string, { frequency: number; duration: number }> = {
  spawn: { frequency: 440, duration: 0.15 },
};

export class OscillatorSoundEngine implements SoundEngine {
  #ctx = new AudioContext();

  play(id: string) {
    const tone = TONES[id];
    if (!tone) return;
    const osc = this.#ctx.createOscillator();
    const gain = this.#ctx.createGain();
    osc.frequency.value = tone.frequency;
    gain.gain.setValueAtTime(0.3, this.#ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.#ctx.currentTime + tone.duration);
    osc.connect(gain).connect(this.#ctx.destination);
    osc.start();
    osc.stop(this.#ctx.currentTime + tone.duration);
  }

  activate() {
    if (this.#ctx.state === 'suspended') this.#ctx.resume();
  }
}