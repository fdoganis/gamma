import { Matrix4, Vector3, Quaternion } from 'three';
import type { PerspectiveCamera } from 'three';
import type { ITransform } from '../../types/ITransform';
import { UP } from './voxel/constants';

// Shared Y-locked billboard for the text engines. A label's glyph primitives
// live in one InstancedPool (no per-label Object3D to lookAt), so each engine
// composes instance matrices itself; this advances the smoothed facing they all
// share. Cylindrical: faces the camera horizontally, stays upright.

export interface Billboarded {
  floatHeight: number;
  facing: Quaternion;  // current (smoothed) orientation
  hasFacing: boolean;  // false until the first call, so a fresh label snaps in
}

const TURN_RATE = 8; // 1/s; exponential turn-to-face — larger = snappier

// scratch — reused every call, nothing allocated per frame/label
const _eye = new Vector3();
const _rotMat = new Matrix4();
const _quat = new Quaternion();

// Advances h.facing toward a camera-facing orientation and writes the label's
// world position (anchor origin + floatHeight) into `out`, which it returns.
export function billboard(
  h: Billboarded,
  anchor: ITransform,
  camera: PerspectiveCamera,
  delta: number,
  out: Vector3,
): Vector3 {
  out.setFromMatrixPosition(anchor.matrixWorld);
  out.y += h.floatHeight;

  // Y-locked: eye pinned to the label's height so the text never pitches. Local
  // +Z ends up pointing at the camera. For a full spherical billboard, drop the
  // Y-lock and pass camera.position straight in.
  _eye.set(camera.position.x, out.y, camera.position.z);
  _rotMat.lookAt(_eye, out, UP);
  _quat.setFromRotationMatrix(_rotMat); // target facing this frame

  if (h.hasFacing) {
    const t = 1 - Math.exp(-TURN_RATE * delta); // frame-rate-independent ease
    h.facing.slerp(_quat, t);
  } else {
    h.facing.copy(_quat); // first call: snap in rather than turning from identity
    h.hasFacing = true;
  }
  return out;
}
