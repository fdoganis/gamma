// Dev-only (`?calib`): guided hand-whack calibration. Reuses the gameplay scene
// — a target body rises from a hole, you whack it, the next one rises — while
// every frame's palm / wrist / index-tip joint poses are logged, tagged by
// phase, with the target position stamped on each hit frame. Phase 1: whack the
// cube N times (auto-paced so it advances even if the current thresholds are
// mistuned). Phase 2: a fixed window of NON-whack motion (wave, reach, rest) for
// false-positive data. Phase 3: press the headset menu button — `sessionend`
// POSTs the capture to the dev server (vite.config.js /__record sink), landing
// in tests/fixtures/. The whole class folds out of the shipped bundle.
import { Vector3 } from 'three';
import { State } from '../core/State';
import { SelectCommand } from '../commands/SelectCommand';
import { RAINBOW } from '../core/palette';
import type { ITransition } from '../core/StateMachine';
import type { World } from '../world/World';
import type { RenderingManager } from '../rendering/RenderingManager';
import type { TextManager } from '../text/TextManager';
import type { TextHandle } from '../text/ITextEngine';

const HOLES = [0, 1, 4, 5];                                  // middle row
const JOINTS = ['middle-finger-metacarpal', 'wrist', 'index-finger-tip'] as const;
const KEY = ['m', 'w', 'i'] as const;
const WHACK_TARGETS = 12;
const WHACK_WINDOW_S = 2.5;                                  // paced fallback advance
const IDLE_S = 15;
const TARGET_HEX = RAINBOW[3];                               // green — "hit this"

const r4 = (n: number) => Math.round(n * 1e4) / 1e4;

type Phase = 'whack' | 'idle' | 'done';
type Frame = { t: number; hand: string; phase: Phase; m: number[]; w: number[]; i: number[]; r: number; hit?: number[] };

export class CalibState extends State {
  #sm: ITransition;
  #world: World;
  #text: TextManager;
  #render: RenderingManager;

  #phase: Phase = 'whack';
  #frames: Frame[] = [];
  #t0 = 0;
  #count = 0;
  #windowT = 0;
  #idleLeft = IDLE_S;
  #targetId = -1;
  #targetPos = new Vector3();
  #hud: TextHandle | null = null;
  #sent = false;

  constructor(sm: ITransition, world: World, text: TextManager, render: RenderingManager) {
    super();
    this.#sm = sm;
    this.#world = world;
    this.#text = text;
    this.#render = render;
    this.on(SelectCommand, this.#onSelect);
  }

  override enter() {
    this.#phase = 'whack';
    this.#frames = [];
    this.#t0 = performance.now();
    this.#count = 0;
    this.#windowT = 0;
    this.#idleLeft = IDLE_S;
    this.#sent = false;
    this.#hud = this.#text.show('WHACK THE CUBE', this.#render.timerAnchor, { color: '#ffffff' });
    this.#spawnTarget();
    this.#render.renderer.xr.addEventListener('sessionend', this.#onEnd);
  }

  #spawnTarget() {
    const hole = HOLES[(Math.random() * HOLES.length) | 0];
    this.#targetId = this.#world.spawnAtHole(hole, TARGET_HEX, Infinity, 0);
    this.#world.actorMesh(this.#targetId)?.getWorldPosition(this.#targetPos);
  }

  #onSelect = () => { if (this.#phase === 'whack') this.#advance(true); };

  #advance(hit: boolean) {
    if (this.#targetId >= 0) {
      const r = this.#world.despawnActor(this.#targetId);
      if (r) this.#world.burstSparkles(r.position, r.color, 'explode');
      this.#targetId = -1;
    }
    if (hit && this.#frames.length) {
      this.#frames[this.#frames.length - 1].hit = [r4(this.#targetPos.x), r4(this.#targetPos.y), r4(this.#targetPos.z)];
    }
    this.#count++;
    this.#windowT = 0;
    if (this.#count >= WHACK_TARGETS) {
      this.#phase = 'idle';
      this.#setHud('WAVE  REACH  REST  -  DO NOT HIT');
    } else {
      this.#setHud(`WHACK  ${this.#count}`);
      this.#spawnTarget();
    }
  }

  override update(delta: number, frame?: XRFrame) {
    this.#world.update(delta); // target rise + sparkle bursts

    if (frame) this.#record(frame);

    if (this.#phase === 'whack') {
      this.#windowT += delta;
      if (this.#windowT >= WHACK_WINDOW_S) this.#advance(false);
    } else if (this.#phase === 'idle') {
      this.#idleLeft -= delta;
      this.#setHud(`DO NOT HIT  ${Math.max(0, Math.ceil(this.#idleLeft))}`);
      if (this.#idleLeft <= 0) {
        this.#phase = 'done';
        this.#setHud('DONE  -  PRESS MENU');
      }
    }
  }

  #record(frame: XRFrame) {
    const ref = this.#render.renderer.xr.getReferenceSpace();
    if (!ref) return;
    const t = Math.round(performance.now() - this.#t0);
    for (const src of frame.session.inputSources) {
      const hand = src.hand;
      if (!hand) continue;
      const rec: Frame = { t, hand: src.handedness, phase: this.#phase, m: [], w: [], i: [], r: 0 };
      let ok = true;
      for (let k = 0; k < JOINTS.length; k++) {
        const space = hand.get(JOINTS[k]);
        const pose = space ? frame.getJointPose?.(space, ref) : null;
        if (!pose) { ok = false; break; }
        const p = pose.transform.position;
        rec[KEY[k]] = [r4(p.x), r4(p.y), r4(p.z)];
        if (k === 0) rec.r = r4(pose.radius || 0);
      }
      if (ok) this.#frames.push(rec);
    }
  }

  #setHud(text: string) { if (this.#hud) this.#text.setText(this.#hud, text); }

  #onEnd = () => { void this.#send(); };

  async #send() {
    if (this.#sent || !this.#frames.length) return;
    this.#sent = true;
    const body = JSON.stringify({
      ua: navigator.userAgent,
      started: new Date(this.#t0 + performance.timeOrigin).toISOString(),
      frames: this.#frames,
    });
    try { await fetch('/__record?to=calib', { method: 'POST', body }); } catch { /* server gone / offline */ }
  }

  override exit() {
    void this.#send(); // backstop if we leave some other way
    this.#render.renderer.xr.removeEventListener('sessionend', this.#onEnd);
    if (this.#targetId >= 0) this.#world.despawnActor(this.#targetId);
    this.#targetId = -1;
    if (this.#hud) { this.#text.remove(this.#hud); this.#hud = null; }
  }
}
