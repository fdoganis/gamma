import { InputSource } from './InputSource';
import type { Command } from '../core/Command';

import { findXRGamepad } from './XRGamepadUtils';
import type { WebGLRenderer } from 'three';
import type { XRHandedness } from '../types/XRTypes';


// Wraps one physical Gamepad, whether it comes from an XR controller
// or a standqrd dpad (via navigator.getGamepads()[index]).
// Buttons cn be remapped remap via bind()
export class GamepadSource extends InputSource {
  #resolve: () => Gamepad | null;
  #bindings = new Map<number, Command>();
  #wasPressed = new Map<number, boolean>();

  constructor(resolve: () => Gamepad | null) {
    super();
    this.#resolve = resolve;
  }

  static forXRController(renderer: WebGLRenderer, handedness: XRHandedness): GamepadSource {
    return new GamepadSource(() => findXRGamepad(renderer, handedness));
  }

  static forDesktopPad(index: number): GamepadSource {
    return new GamepadSource(() => navigator.getGamepads()[index]);
  }

  bind(buttonIndex: number, command: Command) {
    this.#bindings.set(buttonIndex, command);
  }

  override poll() {
    if (!this.enabled) return;
    const gamepad = this.#resolve();
    if (!gamepad) return;
    for (const [buttonIndex, command] of this.#bindings) {
      const pressed = gamepad.buttons[buttonIndex]?.pressed ?? false;
      if (pressed && !this.#wasPressed.get(buttonIndex)) this.queue.push(command);
      this.#wasPressed.set(buttonIndex, pressed);
    }
  }
}