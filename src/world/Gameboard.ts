// The socket grid: two cross clusters of four holes, plus the pooled fixture
// geometry/materials every Hole shares. Layout only — no actors, no cadence.
import {
  MeshPhongMaterial,
  CylinderGeometry,
  CircleGeometry,
  RingGeometry,
  DoubleSide,
  BackSide
} from 'three';
import type { Object3D } from 'three';
import { Hole, HOLE_R_m, COLLAR_R_m, PIT_DEPTH_m } from './Hole';
import type { HoleResources } from './Hole';

// Two crosses (Left/Up/Right/Down each), centred at ±CROSS_CENTER_X_m — easy taps,
// and maps onto a gamepad d-pad + face buttons if a pad fallback is ever added.
const CROSS_CENTER_X_m = 0.28;
const CROSS_ARM_m = 0.13;
const ARMS = [
  [-CROSS_ARM_m, 0], [CROSS_ARM_m, 0], [0, -CROSS_ARM_m], [0, CROSS_ARM_m]
] as const;

export class Gameboard {
  #res: HoleResources;
  #holes: Hole[] = [];

  constructor(root: Object3D) {
    // Felt-green surround (golf-hole readability: colored actor + black pit).
    this.#res = {
      collarGeo: new RingGeometry(HOLE_R_m * 0.98, COLLAR_R_m, 28).rotateX(-Math.PI / 2),
      collarMat: new MeshPhongMaterial({ color: 0x2f7d4f }),
      rimGeo: new RingGeometry(HOLE_R_m, HOLE_R_m + 0.008, 28).rotateX(-Math.PI / 2),
      rimMat: new MeshPhongMaterial({ color: 0x141414 }),
      pitGeo: new CylinderGeometry(HOLE_R_m, HOLE_R_m * 0.8, PIT_DEPTH_m, 24, 1, true),
      pitMat: new MeshPhongMaterial({ color: 0x20202a, side: BackSide }),
      floorGeo: new CircleGeometry(HOLE_R_m * 0.8, 20).rotateX(-Math.PI / 2),
      floorMat: new MeshPhongMaterial({ color: 0x0a0a0d, side: DoubleSide })
    };

    for (const cx of [-CROSS_CENTER_X_m, CROSS_CENTER_X_m]) {
      for (const [dx, dz] of ARMS) {
        this.#holes.push(new Hole(root, cx + dx, dz, this.#res));
      }
    }
  }

  get holeCount(): number { return this.#holes.length; }
  holeAt(i: number): Hole { return this.#holes[i]; }

  freeHoles(): number[] {
    const free: number[] = [];
    this.#holes.forEach((h, i) => { if (h.free) free.push(i); });
    return free;
  }

  reset(): void {
    for (const h of this.#holes) h.free = true;
  }

  dispose(): void {
    for (const h of this.#holes) h.dispose();
    this.#res.collarGeo.dispose();
    this.#res.collarMat.dispose();
    this.#res.rimGeo.dispose();
    this.#res.rimMat.dispose();
    this.#res.pitGeo.dispose();
    this.#res.pitMat.dispose();
    this.#res.floorGeo.dispose();
    this.#res.floorMat.dispose();
  }
}
