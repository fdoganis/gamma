// TODO: WIP : see ARCHI

// see https://github.com/mrdoob/three.js/blob/master/examples/webxr_xr_haptics.html
// and other spatial audio examples

import {
  AudioListener,
  Audio,
  AudioLoader,
  PerspectiveCamera
} from 'three';

export class AudioManager {
  #listener: AudioListener;
  #clips: Record<string, Audio> = {};
  #muted: boolean = false;

  constructor(camera: PerspectiveCamera) {
    this.#listener = new AudioListener();
    camera.add(this.#listener);
  }

  load(id: string, url: string, loop = false, volume = 1) {
    const sound = new Audio(this.#listener);
    new AudioLoader().load(url, (buffer: AudioBuffer) => {
      sound.setBuffer(buffer);
      sound.setLoop(loop);
      sound.setVolume(volume);
    });
    this.#clips[id] = sound;
  }

  play(id: string) {
    const s = this.#clips[id];
    if (!this.#muted && s && !s.isPlaying) s.play();
  }

  // No assets needed
  // TODO: add zzFx, SoundBox / pl_synth support
  // TODO: don't create nodes on the fly! Store them. This should actually be a sub-class
  tone(frequency = 440, duration = 0.15, type: OscillatorType = 'sine') {
    if (this.#muted) return;
    const ctx = this.#listener.context;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain).connect(this.#listener.getInput());
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  toggle() { this.#muted ? this.activate() : this.deactivate(); }

  activate() {
    this.#muted = false;
    if (this.#listener.context.state === 'suspended') this.#listener.context.resume();
  }

  deactivate() {
    this.#muted = true;
    for (const id in this.#clips) {
      const s = this.#clips[id];
      if (s.isPlaying) s.stop();
    }
  }

  dispose() { this.deactivate(); this.#listener.removeFromParent(); }
}