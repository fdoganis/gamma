import { Command } from '../core/Command';
import type { ITransform } from '../types/ITransform';
import type { XRHandedness } from '../types/XRTypes';

export class SelectCommand extends Command {
  readonly transform: ITransform;
  readonly handedness: XRHandedness; // 'none' for sources with no physical hand
  readonly debugRandom: boolean;     // keyboard fallback: no real aim — collect a random actor

  constructor(transform: ITransform, handedness: XRHandedness = 'none', debugRandom = false) {
    super();
    this.transform = transform;
    this.handedness = handedness;
    this.debugRandom = debugRandom;
  }
}
