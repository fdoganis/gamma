import { BoxGeometry, OctahedronGeometry, Matrix4, Vector3, Quaternion, Color, MeshPhongMaterial, MeshMatcapMaterial, MeshStandardMaterial } from 'three';
import type { Scene, PerspectiveCamera, Material, BufferGeometry } from 'three';
import type { ITransform } from '../../../types/ITransform';
import type { ITextEngine, TextStyle } from '../../ITextEngine';
import { InstancedPool } from '../../../rendering/InstancedPool';
import { billboard } from '../billboard';
import { makeMatcap } from './matcap';
import { makeEnvMap } from './envmap';
import { GLYPH_SOURCE, VOXEL_SHADING, VOXEL_SHAPE } from '../../../game.config';
import type { IGlyphSource } from '../../glyphs/IGlyphSource';
import { BitmapGlyphs } from '../../glyphs/BitmapGlyphs';
import { LIGHT_FONT } from '../../glyphs/light-font';
import { FULL_FONT } from '../../glyphs/full-font';
import { CanvasGlyphs } from '../../glyphs/CanvasGlyphs';

// Every label's voxels are indices into one shared InstancedPool (see
// rendering/InstancedPool.ts) — allocating N indices, not spawning N
// primitives. destroy() frees them back to the pool for reuse by the next
// label, same class Sparkles now uses.
type VoxelHandle = {
  indices: number[];
  offsets: Vector3[]; // local, pre-billboard, centered on the label's own origin — parallel to indices
  color: string;      // kept so setText() can repaint reused pool slots (they carry the last owner's color)
  floatHeight: number;
  visible: boolean;
  facing: Quaternion; // current (smoothed) orientation; slerped toward the camera-facing target each sync
  hasFacing: boolean; // false until the first sync, so a fresh label snaps in instead of turning from identity
};

const DEFAULT_FLOAT_HEIGHT_m = 0.08;
const FULL_LABEL_COLOR = '#ff3333';
const VOXEL_FILL = 0.75; // cube size as a fraction of the grid step: <1 leaves a visible gap between voxels

// scratch — reused by every sync() call, nothing allocated per frame/label
const _worldPos = new Vector3();
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
    // VOXEL_SHADING / VOXEL_SHAPE are literal consts — the unpicked material,
    // geometry, and their texture builders fold away and tree-shake.
    const material: Material =
      VOXEL_SHADING === 'env' ? new MeshStandardMaterial({ envMap: makeEnvMap(), metalness: 1, roughness: 0.18 }) :
      VOXEL_SHADING === 'matcap' ? new MeshMatcapMaterial({ matcap: makeMatcap() }) :
      new MeshPhongMaterial({ shininess: 200 });
    const geometry: BufferGeometry = VOXEL_SHAPE === 'octa'
      ? new OctahedronGeometry(0.7, 0)
      : new BoxGeometry(1, 1, 1);
    this.#pool = new InstancedPool(scene, geometry, maxInstances, material);
    // GLYPH_SOURCE is a literal const — the branches not picked fold away and
    // their font data / canvas code tree-shake out of the build.
    this.#glyphs =
      GLYPH_SOURCE === 'canvas' ? new CanvasGlyphs() :
      GLYPH_SOURCE === 'full' ? new BitmapGlyphs(FULL_FONT) :
      new BitmapGlyphs(LIGHT_FONT);
  }

  create(text: string, anchor?: ITransform, style?: TextStyle): VoxelHandle {
    const color = style?.color ?? '#ffffff';
    const offsets = this.#layout(text);
    if (this.#pool.freeCount < offsets.length) {
      this.#reportFull(anchor);
      return { indices: [], offsets: [], color, floatHeight: DEFAULT_FLOAT_HEIGHT_m, visible: true, facing: new Quaternion(), hasFacing: false };
    }
    const indices = offsets.map(() => this.#pool.allocate()!); // capacity just checked above
    this.#paint(indices, color);

    const handle: VoxelHandle = { indices, offsets, color, floatHeight: DEFAULT_FLOAT_HEIGHT_m, visible: style?.visible ?? true, facing: new Quaternion(), hasFacing: false };
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
    this.#paint(h.indices, h.color); // reused pool slots keep their last owner's color — repaint every time
  }

  setVisible(handle: unknown, visible: boolean): void {
    (handle as VoxelHandle).visible = visible;
  }

  sync(handle: unknown, anchor: ITransform, delta: number): void {
    const h = handle as VoxelHandle;
    if (h.indices.length === 0) return;

    billboard(h, anchor, this.#camera, delta, _worldPos);

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

    const handle: VoxelHandle = { indices, offsets, color: FULL_LABEL_COLOR, floatHeight: DEFAULT_FLOAT_HEIGHT_m, visible: true, facing: new Quaternion(), hasFacing: false };
    if (anchor) this.sync(handle, anchor, 0);
  }

  // Lit cells from the selected glyph source, scaled to voxel offsets, centred
  // on the label origin, flipped so +y is up.
  #layout(text: string): Vector3[] {
    const { cells, width, height } = this.#glyphs.layout(text);
    const s = this.#voxelSize;
    const originX = -width / 2;
    return cells.map(([col, row]) => new Vector3((originX + col) * s, (height - 1 - row) * s, 0));
  }
}