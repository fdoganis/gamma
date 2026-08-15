import { InputSource } from './InputSource';
import type { Command } from '../core/Command';
import type { Group } from 'three';
import type { XRBindableEvent } from '../types/XRTypes';

export class SpatialInputSource extends InputSource {
  #node: Group;
  #handlers: Partial<Record<XRBindableEvent, () => void>> = {};

  constructor(node: Group) {
    super();
    this.#node = node;
    node.addEventListener('disconnected', this.#onDisconnected);
  }

  get node(): Group { return this.#node; }

  bind(event: XRBindableEvent, command: Command) {
    const prev = this.#handlers[event];
    if (prev) this.#node.removeEventListener(event, prev);
    const handler = () => {
      if (this.enabled) this.queue.push(command);
    };
    this.#handlers[event] = handler;
    this.#node.addEventListener(event, handler);
  }

  #onDisconnected = () => {
    this.queue.length = 0;
  };

  dispose() {
    this.#node.removeEventListener('disconnected', this.#onDisconnected);
    for (const event of Object.keys(this.#handlers) as XRBindableEvent[])
      this.#node.removeEventListener(event, this.#handlers[event]!);
  }
}