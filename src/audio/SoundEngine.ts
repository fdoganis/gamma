import type { Vector3 } from 'three';

export interface SoundEngine {
  play(id: string, position?: Vector3): void;
  activate?(): void; // resume a suspended AudioContext, browsers require a user gesture first
  dispose?(): void;
}