import { Ray, Vector3 } from 'three';
import { State } from '../core/State';
import { SelectCommand } from '../commands/SelectCommand';
import type { World } from '../world/World';
import type { AudioManager } from '../audio/AudioManager';
import type { Haptics } from '../input/XRGamepadUtils';
import type { ITransition } from '../core/StateMachine';
import type { ITransform } from '../types/ITransform';
import type { RenderingManager } from '../rendering/RenderingManager';
import type { Score } from '../core/Score';
import { GameOverState } from './GameOverState';
import { WinState } from './WinState';
import { Scoring, RAINBOW } from './Scoring';
import type { TextManager } from '../text/TextManager';
import type { TextHandle } from '../text/ITextEngine';

const ROUND_SECONDS = 45;

// Emergence rules (game logic — Actors only knows how to raise/hold/sink a body).
const SPAWN_EVERY_S = 0.9;
const SPAWN_JITTER_S = 0.6;
const MAX_ACTIVE = 5;
const UP_MIN_S = 0.7;
const UP_MAX_S = 1.8;

// The unicorn: a decoy that must NOT be tapped. Carries a sentinel tag so it
// never collides with a rainbow index; peeks longer than a gnome (more time to
// misfire); at most one at a time.
const UNICORN_HEX = '#f3ead7'; // cream
const UNICORN_TAG = -1;
const UNICORN_CHANCE = 0.12;   // roll per spawn tick when a hole is free and none is up
const UNICORN_UP_MIN_S = 1.5;
const UNICORN_UP_MAX_S = 2.5;

const TICK_FROM_S = 5;          // countdown pulse plays for the last N seconds

// scratch — a select fires rarely, but reuse anyway (matches the codebase style)
const _origin = new Vector3();
const _dir = new Vector3();
const _ray = new Ray();

export class RunState extends State {
  #world: World;
  #audio: AudioManager;
  #haptics: Haptics;
  #transition: ITransition;
  #text: TextManager;
  #render: RenderingManager;
  #scoring: Scoring;
  #timeLeft = ROUND_SECONDS;
  #spawnCooldown = 0;
  #timerLabel: TextHandle | null = null;
  #lastShownSecond = -1;

  constructor(world: World, audio: AudioManager, haptics: Haptics, transition: ITransition, text: TextManager, render: RenderingManager, score: Score) {
    super();
    this.#world = world;
    this.#audio = audio;
    this.#haptics = haptics;
    this.#transition = transition;
    this.#text = text;
    this.#render = render;
    this.#scoring = new Scoring(world, text, render, score);
    this.#registerHandlers();
  }

  #registerHandlers() {
    this.on(SelectCommand, this.#onSelect);
  }

  // A select aims a ray (source world pose, −Z) at the live actors; keyboard has
  // no aim → collect a random actor. A hit buzzes either way; the unicorn is the
  // penalty path, everything else goes to Scoring. Completing the set → win with
  // a leftover-time bonus.
  #onSelect = (cmd: SelectCommand) => {
    const removed = __DEV__ && cmd.debugRandom
      ? this.#world.hitRandom()
      : this.#world.hit(this.#rayFrom(cmd.transform), cmd.reach || undefined);
    if (!removed) return;

    this.#haptics.pulse(cmd.handedness);

    if (removed.tag === UNICORN_TAG) { this.#scoring.hitUnicorn(removed.position); return; }

    if (this.#scoring.collect(removed)) {
      this.#scoring.awardTimeBonus(this.#timeLeft);
      this.#transition.change(WinState);
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
      if (!this.#scoring.hasColor(i) && !busy.has(i)) avail.push(i);
    }
    if (!free.length || !avail.length || this.#world.activeCount >= MAX_ACTIVE) return;

    const hole = free[(Math.random() * free.length) | 0];
    const tag = avail[(Math.random() * avail.length) | 0];
    this.#world.spawnAtHole(hole, RAINBOW[tag], UP_MIN_S + Math.random() * (UP_MAX_S - UP_MIN_S), tag);
  }

  #tryUnicorn() {
    if (this.#world.activeTags().includes(UNICORN_TAG)) return; // one at a time
    if (Math.random() >= UNICORN_CHANCE) return;
    const free = this.#world.freeHoles();
    if (!free.length) return;
    const hole = free[(Math.random() * free.length) | 0];
    const hold = UNICORN_UP_MIN_S + Math.random() * (UNICORN_UP_MAX_S - UNICORN_UP_MIN_S);
    this.#world.spawnAtHole(hole, UNICORN_HEX, hold, UNICORN_TAG, true);
  }

  override update(delta: number) {
    if (this.#world.update(delta) > 0) this.#scoring.missed(); // an actor sank unhit
    this.#scoring.update(delta);

    this.#spawnCooldown -= delta;
    if (this.#spawnCooldown <= 0) {
      this.#spawnCooldown = SPAWN_EVERY_S + Math.random() * SPAWN_JITTER_S;
      this.#trySpawn();
      if (Math.random() < 0.3) this.#trySpawn(); // sometimes several at once
      this.#tryUnicorn();
    }

    this.#timeLeft -= delta;
    const seconds = Math.max(0, Math.ceil(this.#timeLeft));
    if (seconds !== this.#lastShownSecond) {
      this.#lastShownSecond = seconds;
      this.#text.setText(this.#timerLabel!, String(seconds));
      if (seconds > 0 && seconds <= TICK_FROM_S) this.#audio.playSFX('tick'); // final-seconds pulse
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
    this.#scoring.reset();
    this.#timerLabel = this.#text.show(String(ROUND_SECONDS), this.#render.timerAnchor, { color: '#ffffff' });
    this.#audio.activate();
    this.#audio.playBGM('music'); // looping bed for the round only
  }

  override exit() {
    this.#audio.stopBGM();
    this.#audio.deactivate();
    this.#world.clearSparkles(); // else the winning hit's burst freezes on the Win screen
    this.#scoring.teardown();
    if (this.#timerLabel) { this.#text.remove(this.#timerLabel); this.#timerLabel = null; }
  }
}
