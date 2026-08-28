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