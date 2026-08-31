import { Ray, Vector3, Object3D } from 'three';
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
import type { TextManager } from '../text/TextManager';
import type { TextHandle } from '../text/ITextEngine';

const ROUND_SECONDS = 45;

// The 7 stolen colors of the rainbow (game data — an actor carries one each; its
// index in this array is the actor's `tag`).
const RAINBOW = ['#F00', '#FF7F00', '#FF0', '#0F0', '#00F', '#4B0082', '#8B00FF'];

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
const UNICORN_PENALTY_PTS = 200; // docked only when there's no collected color to snatch back

// Scoring
const POINTS_PER_STREAK = 100;   // k-th unbroken collect scores k * this
const TIME_BONUS_PER_S = 50;     // leftover seconds → points on a win
const TICK_FROM_S = 5;           // countdown pulse plays for the last N seconds

// Score popups
const POPUP_LIFE_S = 0.9;
const POPUP_RISE_MPS = 0.28;     // metres/s the "+N" drifts upward
const POPUP_BLINK_FROM_S = 0.5;  // start the Pac-Man/DK blink here
const POPUP_BLINK_HZ = 8;

// scratch — a select fires rarely, but reuse anyway (matches the codebase style)
const _origin = new Vector3();
const _dir = new Vector3();
const _ray = new Ray();

type Popup = { handle: TextHandle; obj: Object3D; t: number };

export class RunState extends State {
  #world: World;
  #audio: AudioManager;
  #haptics: Haptics;
  #transition: ITransition;
  #text: TextManager;
  #render: RenderingManager;
  #score: Score;
  #timeLeft = ROUND_SECONDS;
  #spawnCooldown = 0;
  #streak = 0;                    // consecutive collects with no actor sinking unhit
  #collected = new Set<number>(); // rainbow indices retrieved this round
  #order: number[] = [];          // same indices in collect order — the unicorn snatches the last one back
  #popups: Popup[] = [];
  #timerLabel: TextHandle | null = null;
  #scoreLabel: TextHandle | null = null;
  #lastShownSecond = -1;

  constructor(world: World, audio: AudioManager, haptics: Haptics, transition: ITransition, text: TextManager, render: RenderingManager, score: Score) {
    super();
    this.#world = world;
    this.#audio = audio;
    this.#haptics = haptics;
    this.#transition = transition;
    this.#text = text;
    this.#render = render;
    this.#score = score;
    this.#registerHandlers();
  }

  #registerHandlers() {
    this.on(SelectCommand, this.#onSelect);
  }

  // A select aims a ray (source world pose, −Z) at the live actors; keyboard has
  // no aim → collect a random actor. A hit buzzes either way. The unicorn is the
  // penalty path; otherwise: score streak * 100, float a "+N" popup, and (first
  // time for a color) light its rainbow arc. All 7 → win, with a leftover-time
  // bonus.
  #onSelect = (cmd: SelectCommand) => {
    const removed = cmd.debugRandom
      ? this.#world.hitRandom()
      : this.#world.hit(this.#rayFrom(cmd.transform));
    if (!removed) return;

    this.#haptics.pulse(cmd.handedness);

    if (removed.tag === UNICORN_TAG) { this.#hitUnicorn(removed.position); return; }

    this.#streak += 1;
    const pts = this.#streak * POINTS_PER_STREAK;
    this.#score.add(pts);
    this.#text.setText(this.#scoreLabel!, String(this.#score.value));
    this.#spawnPopup(removed.position, `#${removed.color.getHexString()}`, pts);

    if (!this.#collected.has(removed.tag)) {
      this.#collected.add(removed.tag);
      this.#order.push(removed.tag);
      this.#world.lightRainbow(removed.tag, RAINBOW[removed.tag]);
      if (this.#collected.size === RAINBOW.length) {
        this.#score.add(Math.max(0, Math.ceil(this.#timeLeft)) * TIME_BONUS_PER_S);
        this.#transition.change(WinState);
      }
    }
  };

  // Tapped the decoy. Break the streak, and snatch the most-recently collected
  // color back (its arc goes gray and it can spawn again); with nothing to
  // snatch, dock points instead. Level-scaled harsher later.
  #hitUnicorn(pos: Vector3) {
    this.#streak = 0;
    const lost = this.#order.pop();
    if (lost !== undefined) {
      this.#collected.delete(lost);
      this.#world.unlightRainbow(lost);
      this.#spawnPopup(pos, UNICORN_HEX, -1); // "-1" arc, next to the graying arc
    } else {
      this.#score.add(-UNICORN_PENALTY_PTS);
      this.#text.setText(this.#scoreLabel!, String(this.#score.value));
      this.#spawnPopup(pos, UNICORN_HEX, -UNICORN_PENALTY_PTS);
    }
  }

  #rayFrom(t: ITransform): Ray {
    _origin.setFromMatrixPosition(t.matrixWorld);
    _dir.set(0, 0, -1).transformDirection(t.matrixWorld);
    return _ray.set(_origin, _dir);
  }

  // localPos is anchor-local (same space as the sparkle burst) → parent the
  // popup's carrier Object3D under the same anchor.
  #spawnPopup(localPos: Vector3, colorHex: string, pts: number) {
    const obj = new Object3D();
    obj.position.copy(localPos);
    this.#render.anchor.add(obj);
    const handle = this.#text.show(pts < 0 ? `${pts}` : `+${pts}`, obj, { color: colorHex });
    this.#popups.push({ handle, obj, t: 0 });
  }

  #advancePopups(delta: number) {
    for (let i = this.#popups.length - 1; i >= 0; i--) {
      const p = this.#popups[i];
      p.t += delta;
      p.obj.position.y += POPUP_RISE_MPS * delta;
      if (p.t >= POPUP_BLINK_FROM_S) {
        this.#text.setVisible(p.handle, Math.floor(p.t * POPUP_BLINK_HZ) % 2 === 0);
      }
      if (p.t >= POPUP_LIFE_S) {
        this.#text.remove(p.handle);
        this.#render.anchor.remove(p.obj);
        this.#popups.splice(i, 1);
      }
    }
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
    if (this.#world.update(delta) > 0) this.#streak = 0; // an actor sank unhit
    this.#advancePopups(delta);

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
    this.#streak = 0;
    this.#collected.clear();
    this.#order.length = 0;
    this.#world.reset();
    this.#timerLabel = this.#text.show(String(ROUND_SECONDS), this.#render.timerAnchor, { color: '#ffffff' });
    this.#scoreLabel = this.#text.show(String(this.#score.value), this.#render.scoreAnchor, { color: '#ffffff' });
    this.#audio.activate();
    this.#audio.playBGM('music'); // looping bed for the round only
  }

  override exit() {
    this.#audio.stopBGM();
    this.#audio.deactivate();
    this.#world.clearSparkles(); // else the winning hit's burst freezes on the Win screen
    if (this.#timerLabel) { this.#text.remove(this.#timerLabel); this.#timerLabel = null; }
    if (this.#scoreLabel) { this.#text.remove(this.#scoreLabel); this.#scoreLabel = null; }
    for (const p of this.#popups) { this.#text.remove(p.handle); this.#render.anchor.remove(p.obj); }
    this.#popups.length = 0;
  }
}
