import { Vector3, Matrix4 } from 'three';

export const UP: Readonly<Vector3> = new Vector3(0, 1, 0);
export const ZERO_SCALE_MATRIX: Readonly<Matrix4> = new Matrix4().makeScale(0, 0, 0);