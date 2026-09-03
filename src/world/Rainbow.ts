// The rainbow the colors were stolen from: seven half-torus arcs standing over
// the board, in real order — RAINBOW[0] (red) outermost, violet innermost. Each
// ring is an Apple-Watch-style gauge: a dim desaturated **track** always shows
// the ring's identity, and a full-colour **fill** arc sweeps thetaLength = π·fill
// over it (fill = count / N for the level). All seven full = round won.
import { Mesh, MeshBasicMaterial, TorusGeometry, Color } from 'three';
import type { Object3D } from 'three';
import { RAINBOW } from '../core/palette';

const ARCS = RAINBOW.length;
const INNER_R_m = 0.26;
const GAP_m = 0.022;      // radial spacing between rings
const TRACK_TUBE_m = 0.012;
const FILL_TUBE_m = 0.015; // fatter, so the fill covers the track where present
const RADIAL_SEG = 8;
const TUBULAR_SEG = 44;
const Z_OFF_m = -0.15;    // sit toward the far edge, so actors are in front
const TRACK_S = 0.2;      // an unlit track: same hue, near-flat saturation/lightness
const TRACK_L = 0.52;
const EMPTY = 1e-4;       // ~zero sweep for an unfilled arc

const _hsl = { h: 0, s: 0, l: 0 };
const _target = RAINBOW.map((hex) => new Color(hex));
const _track = _target.map((c) => (c.getHSL(_hsl), new Color().setHSL(_hsl.h, TRACK_S, TRACK_L)));

export class Rainbow {
  #root: Object3D;
  #fills: Mesh<TorusGeometry, MeshBasicMaterial>[] = [];
  #tracks: Mesh<TorusGeometry, MeshBasicMaterial>[] = [];
  #radii: number[] = [];

  constructor(root: Object3D) {
    this.#root = root;
    for (let i = 0; i < ARCS; i++) {
      const r = INNER_R_m + (ARCS - 1 - i) * GAP_m;
      this.#radii.push(r);

      // TorusGeometry arc = PI → upper half; the sweep starts at the +X foot.
      const track = new Mesh(
        new TorusGeometry(r, TRACK_TUBE_m, RADIAL_SEG, TUBULAR_SEG, Math.PI),
        new MeshBasicMaterial({ color: _track[i] }),
      );
      track.position.z = Z_OFF_m;
      this.#root.add(track);
      this.#tracks.push(track);

      const fill = new Mesh(
        new TorusGeometry(r, FILL_TUBE_m, RADIAL_SEG, TUBULAR_SEG, EMPTY),
        new MeshBasicMaterial({ color: _target[i] }),
      );
      fill.position.z = Z_OFF_m;
      fill.renderOrder = 1;
      fill.visible = false;
      this.#root.add(fill);
      this.#fills.push(fill);
    }
  }

  // fill 0..1 — regrow the coloured arc to thetaLength = π·fill. Fires only on a
  // collect / unicorn snatch, so rebuilding the little geometry is cheap.
  setFill(i: number, fill: number): void {
    const arc = this.#fills[i];
    if (!arc) return;
    const f = Math.min(1, Math.max(0, fill));
    arc.visible = f > 0;
    arc.geometry.dispose();
    arc.geometry = new TorusGeometry(this.#radii[i], FILL_TUBE_m, RADIAL_SEG, TUBULAR_SEG, Math.PI * f || EMPTY);
  }

  reset(): void {
    for (let i = 0; i < ARCS; i++) this.setFill(i, 0);
  }

  dispose(): void {
    for (const arc of [...this.#tracks, ...this.#fills]) {
      this.#root.remove(arc);
      arc.geometry.dispose();
      arc.material.dispose();
    }
  }
}
