
import type { WebXRManager } from 'three';
import type { XRHandedness } from '../types/XRTypes';

// Needed by GamepadInputSource (button polling) and HapticsManager (rumble).
export function findXRGamepadInHand(xr: WebXRManager, handedness: XRHandedness): Gamepad | null {
  const session = xr.getSession();
  if (!session) return null;
  for (const source of session.inputSources)
    if (source.handedness === handedness && source.gamepad) return source.gamepad;
  return null;
}