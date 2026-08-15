import type { Vector3, Group } from 'three';
import type { XRHandedness } from '../types/XRTypes';
import { SpatialInputSource } from './SpatialInputSource';

// Wraps renderer.xr.getHand(n)
// Only difference: position prefers index finger tip for accurate proximity
export class HandSource extends SpatialInputSource {
  #handNode: Group;

  constructor(node: Group, handedness: XRHandedness) {
    super(node);
    this.#handNode = node;
  }

  override get node(): Group { return this.#handNode; }

  // override get position(): Vector3 {
  //   return this.#handNode.joints?.['index-finger-tip']?.position ?? this.#handNode.position;
  // }
}
