import type { SoundEngine } from './SoundEngine';
import type { PerspectiveCamera, Vector3 } from 'three';

// TODO: ARCHI: QUESTION: use THREE AudioListener, see sample in AudioManager
// Should handle any engine!

// Engine uses PannerNode.
// ctx.listener here is the Web Audio API's own listener, not THREE AudioListener wrapper.
// Listener position only needs updating at play time, not every frame:
// these are ~150ms one-shot SFX, not something still playing while the camera keeps moving.
export class PositionalSoundEngine implements SoundEngine {
  #ctx = new AudioContext();
  #camera: PerspectiveCamera;
  #tones: Record<string, { frequency: number; duration: number }> = {
    spawn: { frequency: 440, duration: 0.15 },
  };

  constructor(camera: PerspectiveCamera) {
    this.#camera = camera;
  }

  play(id: string, position?: Vector3): void {
    const tone = this.#tones[id];
    if (!tone) return;

    const cam = this.#camera.position;
    this.#ctx.listener.positionX.value = cam.x;
    this.#ctx.listener.positionY.value = cam.y;
    this.#ctx.listener.positionZ.value = cam.z;

    const panner = new PannerNode(this.#ctx, { panningModel: 'HRTF', refDistance: 0.5 });
    if (position) {
      panner.positionX.value = position.x;
      panner.positionY.value = position.y;
      panner.positionZ.value = position.z;
    }

    const osc = this.#ctx.createOscillator();
    const gain = this.#ctx.createGain();
    osc.frequency.value = tone.frequency;
    gain.gain.setValueAtTime(0.3, this.#ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.#ctx.currentTime + tone.duration);
    osc.connect(gain).connect(panner).connect(this.#ctx.destination);
    osc.start();
    osc.stop(this.#ctx.currentTime + tone.duration);
  }

  activate(): void {
    if (this.#ctx.state === 'suspended') this.#ctx.resume();
  }
}