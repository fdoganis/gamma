// Facade over the scene pieces GameRunningState talks to: the socket grid
// (Gameboard), the bodies that rise from it (Actors), and the Sparkles pool —
// all parented to the placed anchor. Adds only the non-positional spawn cue; no
// game rules (cadence, colors, scoring) live here.
import type { Object3D, Vector3, Color } from 'three';

import { Gameboard } from './Gameboard';
import { Actors } from './Actors';
import { Sparkles } from '../animation/Sparkles';
import type { BurstMode } from '../animation/Sparkles';
import type { AudioManager } from '../audio/AudioManager';

export class World {
  #board: Gameboard;
  #actors: Actors;
  #sparkles: Sparkles;
  #audio: AudioManager;

  constructor(root: Object3D, audio: AudioManager) {
    this.#audio = audio;
    this.#board = new Gameboard(root);
    this.#actors = new Actors(root);
    this.#sparkles = new Sparkles(root);
  }

  get holeCount(): number { return this.#board.holeCount; }
  get activeCount(): number { return this.#actors.count; }
  freeHoles(): number[] { return this.#board.freeHoles(); }

  // Raise a body of `colorHex` from `hole`, up for `hold` seconds.
  spawnAtHole(hole: number, colorHex: string, hold: number): void {
    const mesh = this.#actors.spawn(this.#board.holeAt(hole), colorHex, hold);
    if (!mesh) return;
    try {
      this.#audio.playSFX('spawn');
    } catch {
      // audio can fail in restricted/sandboxed contexts — the body still appears
    }
  }

  burstSparkles(origin: Vector3, color: Color, mode?: BurstMode): void {
    this.#sparkles.burst(origin, color, mode);
  }

  update(delta: number): void {
    this.#actors.update(delta);
    this.#sparkles.update(delta);
  }

  reset(): void {
    this.#actors.clear();
    this.#board.reset();
  }

  dispose(): void {
    this.#actors.dispose();
    this.#board.dispose();
    this.#sparkles.dispose();
  }
}
