import { InputSource } from './InputSource';
import { Command } from '../core/Command';
import type {
  IXRNode,
  XRHandedness,
  XRBindableEvent,
  XRNodeHandler,
  XRNodeEvent
} from '../types/XRTypes';

import type { Vector3 } from 'three';

// TODO: FIXME: WIP

export class SpatialInputSource extends InputSource {
  #node: IXRNode;
  #handedness: XRHandedness;
  #handlers: Partial<Record<XRBindableEvent, XRNodeHandler>> = {};

  //#gamepad: Gamepad | null = null;

  constructor(node: IXRNode, handedness: XRHandedness) {
    super();
    this.#node = node;
    this.#handedness = handedness;
    this.enabled = false; // off until matching device physically connects
    node.addEventListener('connected', this.#onConnected);
    node.addEventListener('disconnected', this.#onDisconnected);
  }

  get position(): Vector3 { return this.#node.position; }

  get node(): IXRNode { return this.#node; }

  bind(event: XRBindableEvent, command: Command) {
    const prev = this.#handlers[event];
    if (prev) { this.#node.removeEventListener(event, prev); }

    const handler: XRNodeHandler = () => {
      if (this.enabled) {
        this.queue.push(command);
      }
    };
    this.#handlers[event] = handler;
    this.#node.addEventListener(event, handler);
  }

  rumble(intensity: number, duration: number = 100) {
    //this._gamepad?.hapticActuators?.[0]?.pulse(intensity, duration);
    // TODO: Mobile: navigator.vibrate?
    console.log('BRRRRRR');
  }

  #onConnected = (e: XRNodeEvent) => {
    this.enabled = e.data?.handedness === this.#handedness;
    // this._gamepad = e?.data?.gamepad; // TODO: FIXME: CHECK
  }

  #onDisconnected = () => {
    this.enabled = false;
    this.queue.length = 0;
    //this._gamepad = null;

  }

  dispose() {
    this.#node.removeEventListener('connected', this.#onConnected);
    this.#node.removeEventListener('disconnected', this.#onDisconnected);
    for (const event of Object.keys(this.#handlers) as XRBindableEvent[])
      this.#node.removeEventListener(event, this.#handlers[event]!);
  }
}