// The rainbow the colors were stolen from: seven half-torus arcs standing over
// the board. Each arc is a per-color fill gauge — gray at 0, its ROYGBIV color
// at 1 (level N needs N of that color, so fill = count / N). All seven full =
// round won. Generic: it is told "arc i is `fill` full", it does not track
// progress itself.
import { Mesh, MeshBasicMaterial, TorusGeometry, Color } from 'three';
import type { Object3D } from 'three';
import { RAINBOW, GRAY } from '../core/palette';

const ARCS = 7;
const INNER_R_m = 0.26;
const GAP_m = 0.022;   // radial spacing between arcs
const TUBE_m = 0.012;
const Z_OFF_m = -0.15; // sit toward the far edge, so actors are in front of it

const _gray = new Color(GRAY);
const _target = RAINBOW.map((hex) => new Color(hex));

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

  // fill 0..1 — lerp the arc from gray toward its color; snap to full at >= 1.
  setFill(i: number, fill: number): void {
    const arc = this.#arcs[i];
    if (!arc) return;
    if (fill >= 1) arc.material.color.copy(_target[i]);
    else arc.material.color.lerpColors(_gray, _target[i], Math.max(0, fill));
  }

  reset(): void {
    for (const arc of this.#arcs) arc.material.color.copy(_gray);
  }

  dispose(): void {
    for (const arc of this.#arcs) {
      this.#root.remove(arc);
      arc.geometry.dispose();
      arc.material.dispose();
    }
  }
}
