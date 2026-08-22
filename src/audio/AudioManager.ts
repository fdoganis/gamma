// TODO: WIP : see ARCHI

// see https://github.com/mrdoob/three.js/blob/master/examples/webxr_xr_haptics.html
// and other spatial audio examples


// Owns only what's engine-agnostic: mute state. 
// How a sound is actually produced (e.g. zzfx, an oscillator, loaded samples, a tracker player) 
// is delegated to SoundEngine 
// audio/AudioManager.ts
import { AudioListener, PositionalAudio } from 'three';
import type { Object3D, PerspectiveCamera } from 'three';
import type { SoundEngine, SoundHandle } from './SoundEngine';

// Owns the shared AudioContext (via its own AudioListener, on the camera)
// and mute state. 
// Positioning lives here, uniformly, regardless of which
// engine produced the waveform
export class AudioManager {
  #listener: AudioListener;
  #engine: SoundEngine;
  #muted: boolean = false;
  #bgm: SoundHandle | null = null;

  constructor(camera: PerspectiveCamera, engine: SoundEngine) {
    this.#listener = new AudioListener();
    camera.add(this.#listener);
    this.#engine = engine;
  }

  get context(): AudioContext { return this.#listener.context; }

  // No source: plays through the listener directly. 
  // Given a source: attached as a child via PositionalAudio, 
  // so it tracks that object and detaches itself once playback ends.
  // see THREE examples 
  playSFX(id: string, source?: Object3D): void {

    const handle = this.#engine.createSource(id, this.context);
    if (!handle) { return; }

    if (source) {
      const audio = new PositionalAudio(this.#listener);
      audio.setNodeSource(handle.output);
      source.add(audio);
      handle.source.onended = () => {
        source.remove(audio);
        audio.disconnect();
      };
    } else {
      handle.output.connect(this.#listener.getInput());
    }
    // handle.source.start(); TODO: QUESTION: ARCHI: see OscillatorSoundEngine
  }

  // Non-positional by design.
  // One channel, not a pool.
  // Starting a new track stops whatever was playing.
  playBGM(id: string) {
    this.#bgm?.source.stop();
    const handle = this.#engine.createSource(id, this.context);
    if (!handle) { return; }

    handle.output.connect(this.#listener.getInput());
    handle.source.start();
    this.#bgm = handle;
  }

  toggle() { this.#muted ? this.activate() : this.deactivate(); }

  activate() {
    this.#muted = false;
    this.#listener.setMasterVolume(1);
    if (this.context.state === 'suspended') this.context.resume();
    this.#engine.activate?.();
  }

  deactivate() {
    this.#muted = true;
    this.#listener.setMasterVolume(0);
  }

  dispose() {
    this.#bgm?.source.stop();
    this.#engine.dispose?.();
    this.#listener.removeFromParent();
  }
}
