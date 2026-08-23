import { InstancedMesh, BoxGeometry, MeshBasicMaterial, Matrix4, Vector3, Quaternion, Color } from 'three';
import type { Scene, PerspectiveCamera } from 'three';
import type { ITransform } from '../../../types/ITransform';
import type { ITextEngine, TextStyle } from '../../ITextEngine';
import { GLYPH_W, GLYPH_H, glyphRows, isLit } from './littleJsFont';
import { UP, ZERO_SCALE_MATRIX } from './constants';

type VoxelHandle = {
  start: number;
  count: number;
  offsets: Vector3[];
  floatHeight: number;
  visible: boolean;
};

const CHAR_ADVANCE = GLYPH_W + 1;
const DEFAULT_FLOAT_HEIGHT_m = 0.08;
const FULL_LABEL_COLOR = '#ff3333';

const _worldPos = new Vector3();
const _eye = new Vector3();
const _rotMat = new Matrix4();
const _quat = new Quaternion();
const _instMat = new Matrix4();
const _instPos = new Vector3();
const _scaleVec = new Vector3();

export class VoxelTextEngine implements ITextEngine {
  #mesh: InstancedMesh;
  #material: MeshBasicMaterial;
  #camera: PerspectiveCamera;
  #voxelSize: number;
  #maxInstances: number;
  #nextFree = 0;
  #reportedFull = false;

  constructor(scene: Scene, camera: PerspectiveCamera, voxelSize = 0.008, maxInstances = 2048) {
    this.#camera = camera;
    this.#voxelSize = voxelSize;
    this.#maxInstances = maxInstances;
    this.#material = new MeshBasicMaterial();
    this.#mesh = new InstancedMesh(new BoxGeometry(1, 1, 1), this.#material, maxInstances);
    this.#mesh.count = 0;
    this.#mesh.frustumCulled = false; // see note: bounding sphere ignores scattered instances
    scene.add(this.#mesh);
  }

  create(text: string, anchor?: ITransform, style?: TextStyle): VoxelHandle {
    const offsets = this.#layout(text);
    const count = offsets.length;
    const start = this.#nextFree;
    if (start + count > this.#maxInstances) {
      this.#reportFull(anchor);
      return { start, count: 0, offsets: [], floatHeight: DEFAULT_FLOAT_HEIGHT_m, visible: true };
    }
    this.#nextFree += count;
    this.#mesh.count = this.#nextFree;
    this.#paint(start, count, style?.color ?? '#ffffff');

    const handle: VoxelHandle = { start, count, offsets, floatHeight: DEFAULT_FLOAT_HEIGHT_m, visible: true };
    if (anchor) this.sync(handle, anchor);
    return handle;
  }

  setText(handle: unknown, text: string): void {
    const h = handle as VoxelHandle;
    h.offsets = this.#layout(text).slice(0, h.count);
    for (let i = h.offsets.length; i < h.count; i++) this.#hideInstance(h.start + i);
  }

  // TODO: QUESTION: rename to setVisibility?
  setVisible(handle: unknown, visible: boolean): void {
    (handle as VoxelHandle).visible = visible;
  }

  sync(handle: unknown, anchor: ITransform): void {
    const h = handle as VoxelHandle;
    if (h.count === 0) return;

    _worldPos.setFromMatrixPosition(anchor.matrixWorld);
    _worldPos.y += h.floatHeight;

    _eye.set(this.#camera.position.x, _worldPos.y, this.#camera.position.z);
    _rotMat.lookAt(_eye, _worldPos, UP);
    _quat.setFromRotationMatrix(_rotMat);

    _scaleVec.setScalar(h.visible ? this.#voxelSize : 0);
    for (let i = 0; i < h.offsets.length; i++) {
      _instPos.copy(h.offsets[i]).applyQuaternion(_quat).add(_worldPos);
      _instMat.compose(_instPos, _quat, _scaleVec);
      this.#mesh.setMatrixAt(h.start + i, _instMat);
    }
    this.#mesh.instanceMatrix.needsUpdate = true;
  }

  destroy(handle: unknown): void {
    const h = handle as VoxelHandle;
    for (let i = 0; i < h.count; i++) this.#hideInstance(h.start + i);
    this.#mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.#mesh.geometry.dispose();
    this.#material.dispose();
    this.#mesh.removeFromParent();
  }

  #hideInstance(index: number): void {
    this.#mesh.setMatrixAt(index, ZERO_SCALE_MATRIX);
  }

  #paint(start: number, count: number, colorHex: string): void {
    const color = new Color(colorHex);
    for (let i = 0; i < count; i++) this.#mesh.setColorAt(start + i, color);
    if (this.#mesh.instanceColor) this.#mesh.instanceColor.needsUpdate = true;
  }

  #reportFull(anchor?: ITransform): void {
    if (this.#reportedFull) return;
    this.#reportedFull = true;
    const offsets = this.#layout('FULL');
    const start = this.#nextFree;
    if (start + offsets.length > this.#maxInstances) return;
    this.#nextFree += offsets.length;
    this.#mesh.count = this.#nextFree;
    this.#paint(start, offsets.length, FULL_LABEL_COLOR);
    const handle: VoxelHandle = { start, count: offsets.length, offsets, floatHeight: DEFAULT_FLOAT_HEIGHT_m, visible: true };
    if (anchor) this.sync(handle, anchor);
  }

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