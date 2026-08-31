import { Vector3 } from 'three';
import type { XRHandSpace } from 'three';
import type { Object3D } from 'three';
import type { XRHandedness } from '../types/XRTypes';
import { SpatialInputSource } from './SpatialInputSource';
import { SelectCommand } from '../commands/SelectCommand';

// Wraps renderer.xr.getHand(n). Keeps the event bindings of a SpatialInputSource
// (the app still binds `pinchend`), and adds a poll-based "whack" detector: on a
// real tangible table the palm cannot pass through, so a table tap is the palm
// being driven down fast then abruptly stopped by the surface. We watch the palm
// centre joint for exactly that — a fast descent inside a short window, then a
// near-stop, at a height consistent with the placed board.

const PALM = 'middle-finger-metacarpal'; // palm centre; present in every hand pose, less jittery than a fingertip
const SPEED_MIN_mps = 0.5;   // downward speed that counts as a swing
const STOP_SPEED_mps = 0.06; // speed at/under which the palm is "stopped"
const WINDOW_ms = 120;       // a stop only counts if a swing happened this recently
const BAND_LOW_m = -0.03;    // palm y vs. board surface: from 3cm below (tracking slop)…
const BAND_HIGH_m = 0.06;    // …to 6cm above — rejects mid-air stops
const COOLDOWN_ms = 280;     // one whack per hand per this long
const WHACK_REACH_m = 0.14;  // an open palm catches a wider area than a controller point

const _palm = new Vector3();
const _surface = new Vector3();

export class HandSource extends SpatialInputSource {
  #hand: XRHandSpace;
  #handedness: XRHandedness;
  #board: Object3D;

  #prev = new Vector3();
  #prevT = 0;
  #tracking = false;
  #swungUntil = 0; // performance.now() by which a swing must be followed by a stop
  #coolUntil = 0;

  constructor(hand: XRHandSpace, handedness: XRHandedness, board: Object3D) {
    super(hand);
    this.#hand = hand;
    this.#handedness = handedness;
    this.#board = board;
  }

  override poll(): void {
    if (!this.enabled) return;

    const joint = this.#hand.joints[PALM];
    if (!joint) { this.#tracking = false; return; }

    const now = performance.now();
    joint.getWorldPosition(_palm);

    if (this.#tracking) {
      const dt = (now - this.#prevT) / 1000;
      if (dt > 0 && dt < 0.1) {
        const downSpeed = (this.#prev.y - _palm.y) / dt;
        const speed = _palm.distanceTo(this.#prev) / dt;
        if (downSpeed >= SPEED_MIN_mps) this.#swungUntil = now + WINDOW_ms;

        const relY = _palm.y - this.#board.getWorldPosition(_surface).y;
        if (
          now >= this.#coolUntil &&
          now <= this.#swungUntil &&
          speed <= STOP_SPEED_mps &&
          relY >= BAND_LOW_m && relY <= BAND_HIGH_m
        ) {
          this.queue.push(new SelectCommand(joint, this.#handedness, false, WHACK_REACH_m));
          this.#coolUntil = now + COOLDOWN_ms;
          this.#swungUntil = 0;
        }
      }
    }

    this.#prev.copy(_palm);
    this.#prevT = now;
    this.#tracking = true;
  }
}
