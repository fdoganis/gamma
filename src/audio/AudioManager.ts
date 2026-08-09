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

  load(id: string, url: string, loop = false, volume = 1): void {
    const sound = new Audio(this.#listener);
    new AudioLoader().load(url, (buffer: AudioBuffer) => {
      sound.setBuffer(buffer);
      sound.setLoop(loop);
      sound.setVolume(volume);
    });
    this.#clips[id] = sound;
  }

  play(id: string): void {
    const s = this.#clips[id];
    if (!this.#muted && s && !s.isPlaying) s.play();
  }

  toggle(): void { this.#muted ? this.activate() : this.deactivate(); }

  activate(): void {
    this.#muted = false;
    if (this.#listener.context.state === 'suspended') this.#listener.context.resume();
  }

  deactivate(): void {
    this.#muted = true;
    for (const id in this.#clips) {
      const s = this.#clips[id];
      if (s.isPlaying) s.stop();
    }
  }

  dispose(): void { this.deactivate(); this.#listener.removeFromParent(); }
}