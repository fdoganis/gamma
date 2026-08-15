import { findXRGamepad } from '../input/XRGamepadUtils';
import type { XRHandedness } from '../types/XRTypes';
import type { WebGLRenderer } from 'three';

export class HapticsManager {
  #renderer: WebGLRenderer;

  constructor(renderer: WebGLRenderer) {
    this.#renderer = renderer;
  }

  // intensity 0-1, duration in ms, see GamepadHapticActuator#pulse
  // No effect on sources with no actuator (hands, screen tap, keyboard/pointer) 
  // TODO: handle navigator.vibrate
  pulse(handedness: XRHandedness, intensity = 0.5, durationMs = 80) {
    const gamepad = findXRGamepad(this.#renderer, handedness);
    gamepad?.hapticActuators?.[0]?.pulse(intensity, durationMs);
  }
}