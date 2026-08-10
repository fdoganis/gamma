import type { Matrix4 } from 'three';

export interface ITransform {
  readonly matrixWorld: Matrix4;
}
