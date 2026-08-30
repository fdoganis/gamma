import { Ray, Vector3 } from 'three';
import { State } from '../core/State';
import { SelectCommand } from '../commands/SelectCommand';
import type { World } from '../world/World';
import type { AudioManager } from '../audio/AudioManager';
import type { Haptics } from '../input/XRGamepadUtils';
import type { ITransition } from '../core/StateMachine';
import type { ITransform } from '../types/ITransform';
import { GameOverState } from './GameOverState';
import type { TextManager } from '../text/TextManager';
import type { TextHandle } from '../text/ITextEngine';

const ROUND_SECONDS = 45;

// scratch — a select fires rarely, but reuse anyway (matches the codebase style)
const _origin = new Vector3();
const _dir = new Vector3();
const _ray = new Ray();

// The 7 stolen colors of the rainbow (game data — a gnome carries one each).
const RAINBOW = ['#F00', '#FF7F00', '#FF0', '#0F0', '#00F', '#4B0082', '#8B00FF'];

// Emergence rules (game logic — Actors only knows how to raise/hold/sink a body).
const SPAWN_EVERY_S = 0.9;
const SPAWN_JITTER_S = 0.6;
const MAX_ACTIVE = 5;
const UP_MIN_S = 0.7;
const UP_MAX_S = 1.8;

export class GameRunningState extends State {
  #world: World;
  #audio: AudioManager;
  #haptics: Haptics;
  #transition: ITransition;
  #text: TextManager;
  #timerAnchor: ITransform;
  #timeLeft = ROUND_SECONDS;
  #spawnCooldown = 0;
  #labels: TextHandle[] = []; // dormant: seed for hit score-popups in the next milestone
  #timerLabel: TextHandle | null = null;
  #lastShownSecond = -1;

  constructor(world: World, audio: AudioManager, haptics: Haptics, transition: ITransition, text: TextManager, timerAnchor: ITransform) {
    super();
    this.#world = world;
    this.#audio = audio;
    this.#haptics = haptics;
    this.#transition = transition;
    this.#text = text;
    this.#timerAnchor = timerAnchor;
    this.#registerHandlers();
  }

  #registerHandlers() {
    this.on(SelectCommand, this.#onSelect);
  }

  // A select aims a ray (from the source's world pose, −Z) at the live actors.
  // On a hit the actor is collected (World fires the sparkle + sound); a hit
  // buzzes the hand that did it. Keyboard has no aim → collect a random actor.
  // TODO(next): track the 7 collected colours, stop re-spawning collected ones,
  // win at 7 / lose at 0, and float a score popup via `#labels`.
  #onSelect = (cmd: SelectCommand) => {
    const removed = cmd.debugRandom
      ? this.#world.hitRandom()
      : this.#world.hit(this.#rayFrom(cmd.transform));
    if (removed) this.#haptics.pulse(cmd.handedness);
  };

  #rayFrom(t: ITransform): Ray {
    _origin.setFromMatrixPosition(t.matrixWorld);
    _dir.set(0, 0, -1).transformDirection(t.matrixWorld);
    return _ray.set(_origin, _dir);
  }

  #trySpawn() {
    const free = this.#world.freeHoles();
    if (!free.length || this.#world.activeCount >= MAX_ACTIVE) return;
    const hole = free[(Math.random() * free.length) | 0];
    const color = RAINBOW[(Math.random() * RAINBOW.length) | 0];
    this.#world.spawnAtHole(hole, color, UP_MIN_S + Math.random() * (UP_MAX_S - UP_MIN_S));
  }

  override update(delta: number) {
    this.#world.update(delta);

    this.#spawnCooldown -= delta;
    if (this.#spawnCooldown <= 0) {
      this.#spawnCooldown = SPAWN_EVERY_S + Math.random() * SPAWN_JITTER_S;
      this.#trySpawn();
      if (Math.random() < 0.3) this.#trySpawn(); // sometimes several at once
    }

    this.#timeLeft -= delta;
    const seconds = Math.max(0, Math.ceil(this.#timeLeft));
    if (seconds !== this.#lastShownSecond) {
      this.#lastShownSecond = seconds;
      this.#text.setText(this.#timerLabel!, String(seconds));
    }

    if (this.#timeLeft <= 0) {
      this.#transition.change(GameOverState);
    }
  }

  override enter() {
    this.#timeLeft = ROUND_SECONDS;
    this.#lastShownSecond = -1;
    this.#spawnCooldown = SPAWN_EVERY_S;
    this.#world.reset();
    this.#timerLabel = this.#text.show(String(ROUND_SECONDS), this.#timerAnchor, { color: '#ffffff' });
    this.#audio.activate();
  }
  override exit() {
    this.#audio.deactivate();
    if (this.#timerLabel) { this.#text.remove(this.#timerLabel); this.#timerLabel = null; }
    for (const h of this.#labels) this.#text.remove(h); // else every round leaks the pool
    this.#labels.length = 0;
  }
}
