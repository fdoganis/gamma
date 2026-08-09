import type { ITransform } from './ITransform';
import type { Vector3 } from 'three';

// Three.js XR nodes satisfy IXRNode/IXRHandNode at runtime.
// Their compile-time types diverge, bridged explicitly here, once, isolated.

export type XRHandedness = 'none' | 'left' | 'right';

export type XRLifecycleEvent = 'connected' | 'disconnected';

export type XRBindableEvent = 'select' | 'selectstart' | 'selectend'
  | 'squeeze' | 'squeezestart' | 'squeezeend';

export type XRNodeEventName = XRLifecycleEvent | XRBindableEvent;

export type XRNodeEvent = { data?: { handedness: XRHandedness } };

export type XRNodeHandler = (e: XRNodeEvent) => void;

export interface IXRNode extends ITransform {
  readonly position: Vector3;
  addEventListener(type: XRNodeEventName, handler: XRNodeHandler): void;
  removeEventListener(type: XRNodeEventName, handler: XRNodeHandler): void;
}

export interface IXRHandNode extends IXRNode {
  joints?: Partial<Record<string, { readonly position: Vector3 }>>;
}