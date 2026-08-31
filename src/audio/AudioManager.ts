// TODO: WIP : see ARCHI

// see https://github.com/mrdoob/three.js/blob/master/examples/webxr_xr_haptics.html
// and other spatial audio examples


// Owns only what's engine-agnostic: mute state. 
// How a sound is actually produced (e.g. zzfx, an oscillator, loaded samples, a tracker player) 
// is delegated to ISoundEngine 
// audio/AudioManager.ts
import { AudioListener, PositionalAudio } from 'three';
import type { Object3D, PerspectiveCamera } from 'three';
import type { ISoundEngine, SoundHandle } from './ISoundEngine';

// Owns the shared AudioContext (via its own AudioListener, on the camera)
// and mute state. 
// Positioning lives here, uniformly, regardless of which
// engine produced the waveform
export class AudioManager {
  #listener: AudioListener;
  #engine: ISoundEngine;
  #muted: boolean = false;
  #bgm: SoundHandle | null = null;

  constructor(camera: PerspectiveCamera, engine: ISoundEngine) {
    this.#listener = new AudioListener();
    camera.add(this.#listener);
    this.#engine = engine;
  }

  get context(): AudioContext { return this.#listener.context; }

  // Non-positional: plays straight through the listener. For cues with no
  // source in the world (UI, stingers).
  playSFX(id: string): void {
    if (this.#muted) { return; }

    const handle = this.#engine.createSource(id, this.context);
    if (!handle) { return; }
    handle.output.connect(this.#listener.getInput());
  }

  // Creates a PositionalAudio permanently parented to `source`. For an
  // emitter that outlives any single sound (a cone's hit/idle SFX): call
  // once at spawn, keep the returned node, trigger() it as many times as
  // needed, and disconnect() + remove it yourself when `source` is destroyed.
  // refDistance defaults to 0.3m, not PannerNode's spec default of 1m —
  // at 1m, every emitter in this game's ~0.6m play radius would be full
  // volume with zero distance falloff (only HRTF direction would differ).
  attach(source: Object3D, refDistance = 0.3): PositionalAudio {
    const audio = new PositionalAudio(this.#listener);
    audio.setRefDistance(refDistance);
    source.add(audio);
    return audio;
  }

  // Plays through an already-attached emitter. Swaps in a fresh
  // engine-generated node each call; the previous node disconnects itself
  // on end, so overlapping triggers layer instead of cutting each other off.
  trigger(audio: PositionalAudio, id: string): void {
    if (this.#muted) { return; }


    const handle = this.#engine.createSource(id, this.context);
    if (!handle) { return; }
    audio.setNodeSource(handle.output);
    handle.source.onended = () => handle.output.disconnect();
  }

  // Non-positional by design. One channel, not a pool. Starting a new track
  // stops whatever was playing. The engine already started (and, for a music
  // cue, set `loop` on) the source — this just routes and tracks it.
  playBGM(id: string) {
    this.stopBGM();
    if (this.#muted) { return; }
    const handle = this.#engine.createSource(id, this.context);
    if (!handle) { return; }
    handle.output.connect(this.#listener.getInput());
    this.#bgm = handle;
  }

  stopBGM() {
    this.#bgm?.source.stop();
    this.#bgm = null;
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