// The rainbow the colors were stolen from: seven half-torus arcs standing over
// the board, gray until their color is collected. Also the win indicator — all
// seven lit means the round is won. Generic: it is told "light arc i to color X",
// it does not know the colors mean ROYGBIV or track progress itself.
import { Mesh, MeshBasicMaterial, TorusGeometry } from 'three';
import type { Object3D } from 'three';

const ARCS = 7;
const INNER_R_m = 0.26;
const GAP_m = 0.022;   // radial spacing between arcs
const TUBE_m = 0.012;
const Z_OFF_m = -0.15; // sit toward the far edge, so actors are in front of it
const GRAY = 0x555555;

export class Rainbow {
  #root: Object3D;
  #arcs: Mesh<TorusGeometry, MeshBasicMaterial>[] = [];

  constructor(root: Object3D) {
    this.#root = root;
    for (let i = 0; i < ARCS; i++) {
      // TorusGeometry arc = PI → upper half: feet at (±R, 0, 0), apex at (0, R, 0).
      const geo = new TorusGeometry(INNER_R_m + i * GAP_m, TUBE_m, 8, 40, Math.PI);
      const arc = new Mesh(geo, new MeshBasicMaterial({ color: GRAY }));
      arc.position.z = Z_OFF_m;
      root.add(arc);
      this.#arcs.push(arc);
    }
  }

  light(i: number, colorHex: string): void {
    this.#arcs[i]?.material.color.set(colorHex);
  }

  // Back to gray — a collected color was snatched back (unicorn penalty).
  unlight(i: number): void {
    this.#arcs[i]?.material.color.setHex(GRAY);
  }

  reset(): void {
    for (const arc of this.#arcs) arc.material.color.setHex(GRAY);
  }

  dispose(): void {
    for (const arc of this.#arcs) {
      this.#root.remove(arc);
      arc.geometry.dispose();
      arc.material.dispose();
    }
  }
}
