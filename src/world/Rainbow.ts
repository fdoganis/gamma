// The rainbow the colors were stolen from: seven half-torus arcs standing over
// the board, in real rainbow order — RAINBOW[0] (red) is the OUTERMOST arc,
// violet the innermost. Each arc is a per-color fill gauge: a desaturated tint
// of its own color at 0, the full ROYGBIV color at 1 (fill = count / N). All
// seven full = round won. Generic: it is told "arc i is `fill` full".
import { Mesh, MeshBasicMaterial, TorusGeometry, Color } from 'three';
import type { Object3D } from 'three';
import { RAINBOW } from '../core/palette';

const ARCS = RAINBOW.length;
const INNER_R_m = 0.26;
const GAP_m = 0.022;   // radial spacing between arcs
const TUBE_m = 0.012;
const Z_OFF_m = -0.15; // sit toward the far edge, so actors are in front of it
const TRACK_S = 0.2;   // an unlit arc: same hue, near-flat saturation/lightness
const TRACK_L = 0.52;

const _hsl = { h: 0, s: 0, l: 0 };
const _target = RAINBOW.map((hex) => new Color(hex));
const _track = _target.map((c) => (c.getHSL(_hsl), new Color().setHSL(_hsl.h, TRACK_S, TRACK_L)));

export class Rainbow {
  #root: Object3D;
  #arcs: Mesh<TorusGeometry, MeshBasicMaterial>[] = [];

  constructor(root: Object3D) {
    this.#root = root;
    for (let i = 0; i < ARCS; i++) {
      // TorusGeometry arc = PI → upper half: feet at (±R, 0, 0), apex at (0, R, 0).
      const geo = new TorusGeometry(INNER_R_m + (ARCS - 1 - i) * GAP_m, TUBE_m, 8, 40, Math.PI);
      const arc = new Mesh(geo, new MeshBasicMaterial({ color: _track[i] }));
      arc.position.z = Z_OFF_m;
      root.add(arc);
      this.#arcs.push(arc);
    }
  }

  // fill 0..1 — lerp the arc from its unlit tint toward its color; snap full at >= 1.
  setFill(i: number, fill: number): void {
    const arc = this.#arcs[i];
    if (!arc) return;
    if (fill >= 1) arc.material.color.copy(_target[i]);
    else arc.material.color.lerpColors(_track[i], _target[i], Math.max(0, fill));
  }

  reset(): void {
    for (let i = 0; i < ARCS; i++) this.#arcs[i].material.color.copy(_track[i]);
  }

  dispose(): void {
    for (const arc of this.#arcs) {
      this.#root.remove(arc);
      arc.geometry.dispose();
      arc.material.dispose();
    }
  }
}
