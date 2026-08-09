import type { Vector3 } from 'three';
import type { IXRHandNode, XRHandedness } from '../types/XRTypes';
import { SpatialInputSource } from './SpatialInputSource';

// Wraps renderer.xr.getHand(n)
// Only difference: position prefers index finger tip for accurate proximity
export class HandSource extends SpatialInputSource {
  #handNode: IXRHandNode;

  constructor(node: IXRHandNode, handedness: XRHandedness) {
    super(node, handedness);
    this.#handNode = node;
  }

  override get node(): IXRHandNode { return this.#handNode; }

  override get position(): Vector3 {
    return this.#handNode.joints?.['index-finger-tip']?.position ?? this.#handNode.position;
  }
}
