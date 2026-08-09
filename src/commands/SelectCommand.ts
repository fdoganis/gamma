import { Command } from '../core/Command';
import type { ITransform } from '../types/ITransform';

export class SelectCommand extends Command {
  readonly transform: ITransform;

  constructor(transform: ITransform) {
    super();
    this.transform = transform;
  }
}