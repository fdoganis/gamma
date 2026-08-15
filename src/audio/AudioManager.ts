// TODO: WIP : see ARCHI

// see https://github.com/mrdoob/three.js/blob/master/examples/webxr_xr_haptics.html
// and other spatial audio examples

import {
  AudioListener,
  Audio,
  AudioLoader,
  PerspectiveCamera
} from 'three';

import type { Vector3 } from 'three';

// audio/AudioManager.ts
import type { SoundEngine } from './SoundEngine';

// Owns only what's engine-agnostic: mute state. 
// How a sound is actually produced (e.g. zzfx, an oscillator, loaded samples, a tracker player) 
// is delegated to SoundEngine 
export class AudioManager {
  #engine: SoundEngine;
  #muted: boolean = false;

  constructor(engine: SoundEngine) {
    this.#engine = engine;
  }

  play(id: string, position?: Vector3): void {
    if (!this.#muted) this.#engine.play(id, position);
  }

  toggle() { this.#muted ? this.activate() : this.deactivate(); }

  activate() { this.#muted = false; this.#engine.activate?.(); }

  deactivate() { this.#muted = true; }

  dispose() { this.#engine.dispose?.(); }
}