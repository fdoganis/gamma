import { findXRGamepadInHand } from '../input/GamepadHandedness';
import type { XRHandedness } from '../types/XRTypes';
import type { WebXRManager } from 'three';

export class HapticsManager {
  #xr: WebXRManager;

  constructor(xr: WebXRManager) {
    this.#xr = xr;
  }

  // intensity 0-1, duration in ms, see GamepadHapticActuator#pulse
  // No effect on sources with no actuator (hands, screen tap, keyboard/pointer) 
  // TODO: handle navigator.vibrate
  pulse(handedness: XRHandedness, intensity = 0.5, durationMs = 80) {
    const gamepad = findXRGamepadInHand(this.#xr, handedness);
    gamepad?.hapticActuators?.[0]?.pulse(intensity, durationMs);
  }
}