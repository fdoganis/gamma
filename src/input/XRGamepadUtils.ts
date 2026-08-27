// src/input/XRGamepadUtils.ts

import type { WebGLRenderer } from 'three';
import type { XRHandedness } from '../types/XRTypes';


// Gamepads tied to an active XR session are excluded from navigator.getGamepads() by default
// this session-scoped lookup is what a tracked controller actually needs.
export function findXRGamepad(renderer: WebGLRenderer, handedness: XRHandedness): Gamepad | null {
  const session = renderer.xr.getSession();
  if (!session) return null;
  for (const source of session.inputSources)
    if (source.handedness === handedness && source.gamepad) return source.gamepad;
  return null;
}

// The "excluded by default" assumption above isn't guaranteed on every
// WebXR implementation — plausibly (not confirmed) the Meta immersive-web
// emulator surfaces an XR controller's own gamepad through the plain
// navigator.getGamepads() too. GamepadPool uses this to keep from binding
// that same physical trigger a second time, regardless of which is true.
export function isXRGamepad(renderer: WebGLRenderer, gamepad: Gamepad): boolean {
  const session = renderer.xr.getSession();
  if (!session) return false;
  for (const source of session.inputSources)
    if (source.gamepad === gamepad) return true;
  return false;
}

// TODO: ARCHI: QUESTION: Move Haptics elsewhere?
export class Haptics {
  #renderer: WebGLRenderer;

  constructor(renderer: WebGLRenderer) {
    this.#renderer = renderer;
  }

  pulse(handedness: XRHandedness, intensity = 0.5, durationMs = 80): void {
    const actuator = findXRGamepad(this.#renderer, handedness)?.hapticActuators?.[0];
    if (actuator) { actuator.pulse(intensity, durationMs); return; }
    navigator.vibrate?.(durationMs); // Android only — iOS Safari has never implemented the Vibration API
  }
}