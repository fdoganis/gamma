import { BoxGeometry, Matrix4, Vector3, Quaternion, Color, MeshPhongMaterial } from 'three';
import type { Scene, PerspectiveCamera } from 'three';
import type { ITransform } from '../../../types/ITransform';
import type { ITextEngine, TextStyle } from '../../ITextEngine';
import { InstancedPool } from '../../../rendering/InstancedPool';
import { billboard } from '../billboard';
import { FONT16 } from './font16';

// A label is a set of instanced bars in one shared InstancedPool — one bar per
// lit segment, indices freed back on destroy(). Retro 16-segment "Union Jack"
// display: deterministic, ships no glyph bitmap data (see font16.ts). Same
// billboard + resize-in-place lifecycle as VoxelTextEngine, one draw call.

type Seg = { pos: Vector3; quat: Quaternion; scale: Vector3 };

type SegHandle = {
  indices: number[];
  segs: Seg[];        // parallel to indices — the lit bars for the current text
  color: string;      // kept so #paint can recolour reused pool slots
  floatHeight: number;
  visible: boolean;
  facing: Quaternion; // current (smoothed) orientation — see billboard.ts
  hasFacing: boolean;
};

const CELL_W = 0.030;   // gap between the F/B vertical rails
const CELL_H = 0.050;   // gap between the A1/D1 horizontal rails
const BAR = 0.006;      // bar thickness
const CHAR_ADV = 0.044; // x advance per character
const GAP = BAR * 0.6;  // per-bar shrink so corners meet without blobbing

const DEFAULT_FLOAT_HEIGHT_m = 0.08;

// scratch — reused by every sync() call, nothing allocated per frame
const _worldPos = new Vector3();
const _instMat = new Matrix4();
const _instPos = new Vector3();
const _instQuat = new Quaternion();
const _instScale = new Vector3();

// The 16 bars of one cell: y-up, bottom edge at y=0, centred on x=0. Order must
// match SEGMENTS in font16.ts (bit b ↔ SEGMENTS[b]).
function buildSegments(): Seg[] {
  const hx = CELL_W / 2, hy = CELL_H / 2;
  const hLen = hx - GAP, vLen = hy - GAP, dLen = Math.hypot(hx, hy) - GAP;
  const th = Math.atan2(hy, hx);
  const Z = new Vector3(0, 0, 1);
  const H = (x: number, y: number): Seg => ({ pos: new Vector3(x, y + hy, 0), quat: new Quaternion(), scale: new Vector3(hLen, BAR, BAR) });
  const V = (x: number, y: number): Seg => ({ pos: new Vector3(x, y + hy, 0), quat: new Quaternion(), scale: new Vector3(BAR, vLen, BAR) });
  const D = (x: number, y: number, a: number): Seg => ({ pos: new Vector3(x, y + hy, 0), quat: new Quaternion().setFromAxisAngle(Z, a), scale: new Vector3(dLen, BAR, BAR) });
  return [
    H(-hx / 2, hy),          // A1
    H(hx / 2, hy),           // A2
    V(hx, hy / 2),           // B
    V(hx, -hy / 2),          // C
    H(-hx / 2, -hy),         // D1
    H(hx / 2, -hy),          // D2
    V(-hx, -hy / 2),         // E
    V(-hx, hy / 2),          // F
    H(-hx / 2, 0),           // G1
    H(hx / 2, 0),            // G2
    D(-hx / 2, hy / 2, -th), // H  top-left "\"
    V(0, hy / 2),            // I
    D(hx / 2, hy / 2, th),   // K  top-right "/"
    D(-hx / 2, -hy / 2, th), // L  bottom-left "/"
    V(0, -hy / 2),           // M
    D(hx / 2, -hy / 2, -th), // N  bottom-right "\"
  ];
}

const SEGMENTS = /*#__PURE__*/ buildSegments();

export class SegmentTextEngine implements ITextEngine {
  #pool: InstancedPool;
  #camera: PerspectiveCamera;

  constructor(scene: Scene, camera: PerspectiveCamera, maxInstances = 8192) {
    this.#camera = camera;
    this.#pool = new InstancedPool(scene, new BoxGeometry(1, 1, 1), maxInstances, new MeshPhongMaterial({ shininess: 200 }));
  }

  create(text: string, anchor?: ITransform, style?: TextStyle): SegHandle {
    const h: SegHandle = {
      indices: [], segs: [], color: style?.color ?? '#ffffff',
      floatHeight: DEFAULT_FLOAT_HEIGHT_m, visible: style?.visible ?? true,
      facing: new Quaternion(), hasFacing: false,
    };
    this.#relayout(h, text);
    if (anchor) this.sync(h, anchor, 0);
    return h;
  }

  setText(handle: unknown, text: string): void {
    this.#relayout(handle as SegHandle, text);
  }

  setVisible(handle: unknown, visible: boolean): void {
    (handle as SegHandle).visible = visible;
  }

  sync(handle: unknown, anchor: ITransform, delta: number): void {
    const h = handle as SegHandle;
    if (h.indices.length === 0) return;

    billboard(h, anchor, this.#camera, delta, _worldPos);

    for (let i = 0; i < h.indices.length; i++) {
      const seg = h.segs[i];
      _instPos.copy(seg.pos).applyQuaternion(h.facing).add(_worldPos);
      _instQuat.copy(h.facing).multiply(seg.quat);
      _instScale.copy(seg.scale);
      if (!h.visible) _instScale.setScalar(0);
      _instMat.compose(_instPos, _instQuat, _instScale);
      this.#pool.setMatrix(h.indices[i], _instMat);
    }
  }

  destroy(handle: unknown): void {
    const h = handle as SegHandle;
    for (const i of h.indices) this.#pool.free(i);
    h.indices = [];
  }

  dispose(): void {
    this.#pool.dispose();
  }

  // Rebuild the lit-bar list for `text` and match the pool allocation to it,
  // reusing slots where the count is unchanged (labels resize every tick).
  #relayout(h: SegHandle, text: string): void {
    const segs: Seg[] = [];
    const originX = -(text.length - 1) * CHAR_ADV / 2;
    let c = 0;
    for (const ch of text) {
      const mask = FONT16[ch] ?? 0;
      const cx = originX + c * CHAR_ADV;
      for (let b = 0; b < 16; b++) {
        if (mask & (1 << b)) {
          const s = SEGMENTS[b];
          segs.push({ pos: new Vector3(s.pos.x + cx, s.pos.y, s.pos.z), quat: s.quat, scale: s.scale });
        }
      }
      c++;
    }

    while (h.indices.length > segs.length) this.#pool.free(h.indices.pop()!);
    while (h.indices.length < segs.length) {
      const i = this.#pool.allocate();
      if (i === null) break; // out of room: label truncates rather than crashing
      h.indices.push(i);
    }
    h.segs = segs.slice(0, h.indices.length);
    this.#paint(h);
  }

  #paint(h: SegHandle): void {
    const color = new Color(h.color);
    for (const i of h.indices) this.#pool.setColor(i, color);
  }
}
