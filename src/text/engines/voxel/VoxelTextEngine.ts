import { BoxGeometry, Matrix4, Vector3, Quaternion, Color, MeshPhongMaterial } from 'three';
import type { Scene, PerspectiveCamera } from 'three';
import type { ITransform } from '../../../types/ITransform';
import type { ITextEngine, TextStyle } from '../../ITextEngine';
import { InstancedPool } from '../../../rendering/InstancedPool';
import { GLYPH_W, GLYPH_H, glyphRows, isLit } from './littleJsFont';
import { UP } from './constants';

// Every label's voxels are indices into one shared InstancedPool (see
// rendering/InstancedPool.ts) — allocating N indices, not spawning N
// primitives. destroy() frees them back to the pool for reuse by the next
// label, same class Sparkles now uses.
type VoxelHandle = {
  indices: number[];
  offsets: Vector3[]; // local, pre-billboard, centered on the label's own origin — parallel to indices
  floatHeight: number;
  visible: boolean;
  facing: Quaternion; // current (smoothed) orientation; slerped toward the camera-facing target each sync
  hasFacing: boolean; // false until the first sync, so a fresh label snaps in instead of turning from identity
};

const BILLBOARD_TURN_RATE = 8; // 1/s; exponential turn-to-face — larger = snappier, smaller = slower

const CHAR_ADVANCE = GLYPH_W + 1; // 1 column of spacing between glyphs
const DEFAULT_FLOAT_HEIGHT_m = 0.08;
const FULL_LABEL_COLOR = '#ff3333';
const VOXEL_FILL = 0.75; // cube size as a fraction of the grid step: <1 leaves a visible gap between voxels

// scratch — reused by every sync() call, nothing allocated per frame/label
const _worldPos = new Vector3();
const _eye = new Vector3();
const _rotMat = new Matrix4();
const _quat = new Quaternion();
const _instMat = new Matrix4();
const _instPos = new Vector3();
const _scaleVec = new Vector3();

export class VoxelTextEngine implements ITextEngine {
  #pool: InstancedPool;
  #camera: PerspectiveCamera;
  #voxelSize: number;
  #reportedFull = false;

  constructor(scene: Scene, camera: PerspectiveCamera, voxelSize = 0.008, maxInstances = 1024 * 1024) {
    this.#camera = camera;
    this.#voxelSize = voxelSize;
    this.#pool = new InstancedPool(scene, new BoxGeometry(1, 1, 1), maxInstances, new MeshPhongMaterial({ shininess: 200 }));
  }

  create(text: string, anchor?: ITransform, style?: TextStyle): VoxelHandle {
    const offsets = this.#layout(text);
    if (this.#pool.freeCount < offsets.length) {
      this.#reportFull(anchor);
      return { indices: [], offsets: [], floatHeight: DEFAULT_FLOAT_HEIGHT_m, visible: true, facing: new Quaternion(), hasFacing: false };
    }
    const indices = offsets.map(() => this.#pool.allocate()!); // capacity just checked above
    this.#paint(indices, style?.color ?? '#ffffff');

    const handle: VoxelHandle = { indices, offsets, floatHeight: DEFAULT_FLOAT_HEIGHT_m, visible: style?.visible ?? true, facing: new Quaternion(), hasFacing: false };
    if (anchor) this.sync(handle, anchor, 0);
    return handle;
  }

  setText(handle: unknown, text: string): void {
    const h = handle as VoxelHandle;
    const offsets = this.#layout(text);

    while (h.indices.length > offsets.length) this.#pool.free(h.indices.pop()!);
    while (h.indices.length < offsets.length) {
      const i = this.#pool.allocate();
      if (i === null) break; // out of room: text silently truncates rather than crashing
      h.indices.push(i);
    }
    h.offsets = offsets.slice(0, h.indices.length);
  }

  setVisible(handle: unknown, visible: boolean): void {
    (handle as VoxelHandle).visible = visible;
  }

  sync(handle: unknown, anchor: ITransform, delta: number): void {
    const h = handle as VoxelHandle;
    if (h.indices.length === 0) return;

    _worldPos.setFromMatrixPosition(anchor.matrixWorld);
    _worldPos.y += h.floatHeight;

    // Y-locked (cylindrical) billboard: faces the camera horizontally, never
    // tilts up/down, so the text stays upright and readable. For a full
    // spherical billboard, drop the Y-lock and use camera.position directly.
    _eye.set(this.#camera.position.x, _worldPos.y, this.#camera.position.z);
    _rotMat.lookAt(_eye, _worldPos, UP);
    _quat.setFromRotationMatrix(_rotMat); // target facing this frame

    if (h.hasFacing) {
      const t = 1 - Math.exp(-BILLBOARD_TURN_RATE * delta); // frame-rate-independent exponential ease // TODO: add to Easing?
      h.facing.slerp(_quat, t);
    } else {
      h.facing.copy(_quat); // first sync: snap in rather than turning from identity
      h.hasFacing = true;
    }

    _scaleVec.setScalar(h.visible ? this.#voxelSize * VOXEL_FILL : 0);
    for (let i = 0; i < h.indices.length; i++) {
      _instPos.copy(h.offsets[i]).applyQuaternion(h.facing).add(_worldPos);
      _instMat.compose(_instPos, h.facing, _scaleVec);
      this.#pool.setMatrix(h.indices[i], _instMat);
    }
  }

  destroy(handle: unknown): void {
    const h = handle as VoxelHandle;
    for (const i of h.indices) this.#pool.free(i);
    h.indices = [];
  }

  dispose(): void {
    this.#pool.dispose();
  }

  #paint(indices: number[], colorHex: string): void {
    const color = new Color(colorHex);
    for (const i of indices) this.#pool.setColor(i, color);
  }

  // No console: it doesn't exist in a headset. Report capacity errors the
  // same way as any other label — through this engine, once, not per failed
  // create(). Silently gives up only if there's no room even for "FULL".
  #reportFull(anchor?: ITransform): void {
    if (this.#reportedFull) return;
    this.#reportedFull = true;

    const offsets = this.#layout('FULL');
    if (this.#pool.freeCount < offsets.length) return;
    const indices = offsets.map(() => this.#pool.allocate()!);
    this.#paint(indices, FULL_LABEL_COLOR);

    const handle: VoxelHandle = { indices, offsets, floatHeight: DEFAULT_FLOAT_HEIGHT_m, visible: true, facing: new Quaternion(), hasFacing: false };
    if (anchor) this.sync(handle, anchor, 0);
  }

  // No canvas, no fillText: glyphs come straight from the packed table,
  // so output is identical on every browser/OS/font-availability combination.
  #layout(text: string): Vector3[] {
    const glyphs = text.split('').map(glyphRows).filter((g): g is number[] => !!g);
    const width = glyphs.length * CHAR_ADVANCE - 1;
    const originX = -width / 2;
    const s = this.#voxelSize;

    const offsets: Vector3[] = [];
    glyphs.forEach((rows, ci) => {
      for (let y = 0; y < GLYPH_H; y++)
        for (let x = 0; x < GLYPH_W; x++)
          if (isLit(rows, x, y))
            offsets.push(new Vector3((originX + ci * CHAR_ADVANCE + x) * s, (GLYPH_H - 1 - y) * s, 0));
    });
    return offsets;
  }
}