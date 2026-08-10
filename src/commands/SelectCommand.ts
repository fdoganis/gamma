import { Command } from '../core/Command';
import type { ITransform } from '../types/ITransform';
import type { XRHandedness } from '../types/XRTypes';

export class SelectCommand extends Command {
  readonly transform: ITransform;
  readonly handedness: XRHandedness; // 'none' for sources with no physical hand

  constructor(transform: ITransform, handedness: XRHandedness = 'none') {
    super();
    this.transform = transform;
    this.handedness = handedness;
  }
}