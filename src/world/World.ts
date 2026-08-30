// Facade over the scene pieces GameRunningState talks to: the socket grid
// (Gameboard), the bodies that rise from it (Actors), and the Sparkles pool —
// all parented to the placed anchor. Adds only the non-positional spawn cue; no
// game rules (cadence, colors, scoring) live here.
import type { Object3D, Vector3, Color, Ray } from 'three';

import { Gameboard } from './Gameboard';
import { Actors } from './Actors';
import type { RemovedActor } from './Actors';
import { Sparkles } from '../animation/Sparkles';
import type { BurstMode } from '../animation/Sparkles';
import type { AudioManager } from '../audio/AudioManager';

const PROXIMITY_R_m = 0.08; // hand/touch fallback radius when the ray misses (actor r = 0.05)

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

  // Aim a ray at the live actors; on a hit, remove that actor and fire the
  // collect effect. Returns its colour + position (for scoring later) or null.
  hit(ray: Ray): RemovedActor | null {
    const id = this.#actors.hitTest(ray, PROXIMITY_R_m);
    return id === null ? null : this.#collect(this.#actors.despawn(id));
  }

  // Collect a random live actor — keyboard fallback with no real aim.
  hitRandom(): RemovedActor | null {
    return this.#collect(this.#actors.despawnAny());
  }

  #collect(removed: RemovedActor | null): RemovedActor | null {
    if (!removed) return null;
    this.#sparkles.burst(removed.position, removed.color, 'explode');
    try {
      this.#audio.playSFX('hit');
    } catch {
      // audio may be unavailable
    }
    return removed;
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
