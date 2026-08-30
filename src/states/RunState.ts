import { Ray, Vector3 } from 'three';
import { State } from '../core/State';
import { SelectCommand } from '../commands/SelectCommand';
import type { World } from '../world/World';
import type { AudioManager } from '../audio/AudioManager';
import type { Haptics } from '../input/XRGamepadUtils';
import type { ITransition } from '../core/StateMachine';
import type { ITransform } from '../types/ITransform';
import { GameOverState } from './GameOverState';
import { WinState } from './WinState';
import type { TextManager } from '../text/TextManager';
import type { TextHandle } from '../text/ITextEngine';

const ROUND_SECONDS = 45;

// scratch — a select fires rarely, but reuse anyway (matches the codebase style)
const _origin = new Vector3();
const _dir = new Vector3();
const _ray = new Ray();

// The 7 stolen colors of the rainbow (game data — an actor carries one each; its
// index in this array is the actor's `tag`).
const RAINBOW = ['#F00', '#FF7F00', '#FF0', '#0F0', '#00F', '#4B0082', '#8B00FF'];

// Emergence rules (game logic — Actors only knows how to raise/hold/sink a body).
const SPAWN_EVERY_S = 0.9;
const SPAWN_JITTER_S = 0.6;
const MAX_ACTIVE = 5;
const UP_MIN_S = 0.7;
const UP_MAX_S = 1.8;

export class RunState extends State {
  #world: World;
  #audio: AudioManager;
  #haptics: Haptics;
  #transition: ITransition;
  #text: TextManager;
  #timerAnchor: ITransform;
  #timeLeft = ROUND_SECONDS;
  #spawnCooldown = 0;
  #collected = new Set<number>(); // rainbow indices retrieved this round
  #labels: TextHandle[] = []; // dormant: seed for hit score-popups (Pass B)
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

  // A select aims a ray (source world pose, −Z) at the live actors; keyboard has
  // no aim → collect a random actor. On a hit: buzz the hand, and the first time
  // a color is retrieved, light its rainbow arc. All 7 → win.
  #onSelect = (cmd: SelectCommand) => {
    const removed = cmd.debugRandom
      ? this.#world.hitRandom()
      : this.#world.hit(this.#rayFrom(cmd.transform));
    if (!removed) return;
    this.#haptics.pulse(cmd.handedness);

    if (!this.#collected.has(removed.tag)) {
      this.#collected.add(removed.tag);
      this.#world.lightRainbow(removed.tag, RAINBOW[removed.tag]);
      if (this.#collected.size === RAINBOW.length) this.#transition.change(WinState);
    }
  };

  #rayFrom(t: ITransform): Ray {
    _origin.setFromMatrixPosition(t.matrixWorld);
    _dir.set(0, 0, -1).transformDirection(t.matrixWorld);
    return _ray.set(_origin, _dir);
  }

  #trySpawn() {
    const free = this.#world.freeHoles();
    // one actor per color at a time; a collected color never returns
    const busy = new Set(this.#world.activeTags());
    const avail: number[] = [];
    for (let i = 0; i < RAINBOW.length; i++) {
      if (!this.#collected.has(i) && !busy.has(i)) avail.push(i);
    }
    if (!free.length || !avail.length || this.#world.activeCount >= MAX_ACTIVE) return;

    const hole = free[(Math.random() * free.length) | 0];
    const tag = avail[(Math.random() * avail.length) | 0];
    this.#world.spawnAtHole(hole, RAINBOW[tag], UP_MIN_S + Math.random() * (UP_MAX_S - UP_MIN_S), tag);
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
    this.#collected.clear();
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
