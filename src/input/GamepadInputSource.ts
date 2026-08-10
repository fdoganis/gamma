// input/GamepadInputSource.ts
import { InputSource } from './InputSource';
import { SelectCommand } from '../commands/SelectCommand';
import { findXRGamepadInHand } from './GamepadHandedness';
import type { IXRNode, XRHandedness } from '../types/XRTypes';
import type { WebXRManager } from 'three';

// TODO: ARCHI: QUESTION: why not listening to gamepadconnected events? why the findXRGamepad?
// How generic is this?

// xr-standard only guarantees buttons[0..3] (trigger, squeeze, touchpad, thumbstick).
// select/squeeze events already cover [0]/[1]. 
// Defaults to [3] spec-guaranteed at that index when a thumbstick exists.
// Device extras (Quest's A/X, B/Y face buttons, typically 4/5) work too,
// aren't guaranteed at those indices across hardware.
// Pass explicit indices if you're targeting one controller family.
export class GamepadInputSource extends InputSource {
  #xr: WebXRManager;
  #handedness: XRHandedness;
  #buttons: readonly number[];
  #wasPressed: boolean[];
  #command: SelectCommand;

  constructor(
    xr: WebXRManager,
    node: IXRNode,
    handedness: XRHandedness,
    buttons: readonly number[] = [3]
  ) {
    super();
    this.#xr = xr;
    this.#handedness = handedness;
    this.#buttons = buttons;
    this.#wasPressed = buttons.map(() => false);
    this.#command = new SelectCommand(node, handedness); // shares the controller's live transform
  }

  override poll() {
    if (!this.enabled) return;

    const gp = findXRGamepadInHand(this.#xr, this.#handedness);
    if (!gp) return;

    for (let i = 0; i < this.#buttons.length; i++) {
      const pressed = gp.buttons[this.#buttons[i]]?.pressed ?? false;
      if (pressed && !this.#wasPressed[i]) {
        this.queue.push(this.#command);
      }

      this.#wasPressed[i] = pressed;
    }
  }
}