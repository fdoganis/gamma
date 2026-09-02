import { BoxGeometry, Matrix4, Vector3, Quaternion, Color, MeshPhongMaterial } from 'three';
import type { Scene, PerspectiveCamera } from 'three';
import type { ITransform } from '../../../types/ITransform';
import type { ITextEngine, TextStyle } from '../../ITextEngine';
import { InstancedPool } from '../../../rendering/InstancedPool';
import { UP } from './constants';
import { GLYPH_SOURCE, VOXEL_OUTLINE } from '../../../game.config';
import type { IGlyphSource } from '../../glyphs/IGlyphSource';
import { BitmapGlyphs } from '../../glyphs/BitmapGlyphs';
import { LIGHT_FONT } from '../../glyphs/light-font';
import { FULL_FONT } from '../../glyphs/full-font';
import { CanvasGlyphs } from '../../glyphs/CanvasGlyphs';

// Every label's voxels are indices into one shared InstancedPool (see
// rendering/InstancedPool.ts) — allocating N indices, not spawning N
// primitives. destroy() frees them for reuse by the next label.
//
// With VOXEL_OUTLINE, each cell gets STRIDE=2 indices: a full-size dark copy
// (indices[0..N)) and a smaller label-colour copy nudged toward the camera
// (indices[N..2N)) — a read-against-anything outline, still one draw call.
type VoxelHandle = {
  indices: number[];
  offsets: Vector3[]; // one per cell, local pre-billboard, centred on the label origin
  color: string;
  floatHeight: number;
  visible: boolean;
  facing: Quaternion; // current (smoothed) orientation; slerped toward camera-facing each sync
  hasFacing: boolean; // false until the first sync, so a fresh label snaps in
};

const STRIDE = VOXEL_OUTLINE ? 2 : 1;
const OUTLINE_COLOR = new Color('#111');
const FRONT_SCALE = 0.62;   // front copy size vs the dark back copy — the gap is the outline
const FRONT_NUDGE = 0.5;    // move the front copy this many voxel-sizes toward the camera

const BILLBOARD_TURN_RATE = 8; // 1/s; exponential turn-to-face
const DEFAULT_FLOAT_HEIGHT_m = 0.08;
const FULL_LABEL_COLOR = '#ff3333';
const VOXEL_FILL = 0.75; // cube size as a fraction of the grid step: <1 leaves a visible gap between voxels

// scratch — reused every sync(), nothing allocated per frame/label
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
  #glyphs: IGlyphSource;
  #reportedFull = false;

  constructor(scene: Scene, camera: PerspectiveCamera, voxelSize = 0.008, maxInstances = 1024 * 1024) {
    this.#camera = camera;
    this.#voxelSize = voxelSize;
    this.#pool = new InstancedPool(scene, new BoxGeometry(1, 1, 1), maxInstances, new MeshPhongMaterial({ shininess: 200 }));
    // GLYPH_SOURCE is a literal const — unpicked branches fold away and their
    // font data / canvas code tree-shake out.
    this.#glyphs =
      GLYPH_SOURCE === 'canvas' ? new CanvasGlyphs() :
      GLYPH_SOURCE === 'full' ? new BitmapGlyphs(FULL_FONT) :
      new BitmapGlyphs(LIGHT_FONT);
  }

  create(text: string, anchor?: ITransform, style?: TextStyle): VoxelHandle {
    const color = style?.color ?? '#ffffff';
    const offsets = this.#layout(text);
    const handle: VoxelHandle = {
      indices: [], offsets, color,
      floatHeight: DEFAULT_FLOAT_HEIGHT_m, visible: style?.visible ?? true,
      facing: new Quaternion(), hasFacing: false,
    };
    if (!this.#alloc(handle)) this.#reportFull(anchor);
    else if (anchor) this.sync(handle, anchor, 0);
    return handle;
  }

  setText(handle: unknown, text: string): void {
    const h = handle as VoxelHandle;
    // Free and re-allocate rather than resize: strings are short, the churn is
    // trivial, and it keeps the two outline layers aligned.
    for (const i of h.indices) this.#pool.free(i);
    h.indices = [];
    h.offsets = this.#layout(text);
    this.#alloc(h);
  }

  setVisible(handle: unknown, visible: boolean): void {
    (handle as VoxelHandle).visible = visible;
  }

  sync(handle: unknown, anchor: ITransform, delta: number): void {
    const h = handle as VoxelHandle;
    if (h.indices.length === 0) return;

    _worldPos.setFromMatrixPosition(anchor.matrixWorld);
    _worldPos.y += h.floatHeight;

    // Y-locked (cylindrical) billboard: faces the camera horizontally, stays
    // upright. Local +Z ends up pointing toward the camera.
    _eye.set(this.#camera.position.x, _worldPos.y, this.#camera.position.z);
    _rotMat.lookAt(_eye, _worldPos, UP);
    _quat.setFromRotationMatrix(_rotMat);

    if (h.hasFacing) {
      const t = 1 - Math.exp(-BILLBOARD_TURN_RATE * delta); // frame-rate-independent ease
      h.facing.slerp(_quat, t);
    } else {
      h.facing.copy(_quat);
      h.hasFacing = true;
    }

    const s = h.visible ? this.#voxelSize * VOXEL_FILL : 0;
    const n = h.offsets.length;
    for (let k = 0; k < n; k++) {
      // back copy (or the only copy)
      _instPos.copy(h.offsets[k]).applyQuaternion(h.facing).add(_worldPos);
      _scaleVec.setScalar(s);
      _instMat.compose(_instPos, h.facing, _scaleVec);
      this.#pool.setMatrix(h.indices[k], _instMat);

      if (STRIDE === 2) {
        // smaller front copy, nudged toward the camera
        _instPos.set(h.offsets[k].x, h.offsets[k].y, this.#voxelSize * FRONT_NUDGE)
          .applyQuaternion(h.facing).add(_worldPos);
        _scaleVec.setScalar(s * FRONT_SCALE);
        _instMat.compose(_instPos, h.facing, _scaleVec);
        this.#pool.setMatrix(h.indices[n + k], _instMat);
      }
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

  // Allocates STRIDE indices per cell into h.indices and paints them. Returns
  // false (leaving h.indices empty) if the pool can't fit the label.
  #alloc(h: VoxelHandle): boolean {
    const n = h.offsets.length;
    if (this.#pool.freeCount < n * STRIDE) return false;
    for (let i = 0; i < n * STRIDE; i++) h.indices.push(this.#pool.allocate()!);
    this.#paint(h.indices, h.color);
    return true;
  }

  // indices[0..N) are the back layer (dark), indices[N..2N) the front (colour).
  // Without the outline, N === indices.length and everything is the colour.
  #paint(indices: number[], colorHex: string): void {
    const front = new Color(colorHex);
    if (STRIDE === 1) {
      for (const i of indices) this.#pool.setColor(i, front);
      return;
    }
    const n = indices.length >> 1;
    for (let k = 0; k < n; k++) {
      this.#pool.setColor(indices[k], OUTLINE_COLOR);
      this.#pool.setColor(indices[n + k], front);
    }
  }

  // Report capacity errors through the engine itself, once. Silently gives up
  // only if there's no room even for "FULL".
  #reportFull(anchor?: ITransform): void {
    if (this.#reportedFull) return;
    this.#reportedFull = true;

    const handle: VoxelHandle = {
      indices: [], offsets: this.#layout('FULL'), color: FULL_LABEL_COLOR,
      floatHeight: DEFAULT_FLOAT_HEIGHT_m, visible: true,
      facing: new Quaternion(), hasFacing: false,
    };
    if (this.#alloc(handle) && anchor) this.sync(handle, anchor, 0);
  }

  // Lit cells from the selected glyph source → voxel offsets, centred, +y up.
  #layout(text: string): Vector3[] {
    const { cells, width, height } = this.#glyphs.layout(text);
    const s = this.#voxelSize;
    const originX = -width / 2;
    return cells.map(([col, row]) => new Vector3((originX + col) * s, (height - 1 - row) * s, 0));
  }
}
