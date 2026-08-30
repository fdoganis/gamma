// A socket in the gameboard: a position + a self-contained AR "hole" — an
// invisible depth-only occluder shaped like a reversed top hat (flat brim at the
// surface, a crown skirt down the sides, a base disc closing the bottom) wrapped
// around a dark visible pit. It does not know or care what rises out of it —
// that is the Actors system's job.
//
// The occluder is what sells the illusion in passthrough AR: it writes depth
// across the "table", so anything below the surface (outside a hole) is hidden.
// It writes no color. On desktop / the WebXR emulator there is no real table,
// so the holes read as dark shapes in a void — that is expected.
import {
  Mesh,
  MeshBasicMaterial,
  CylinderGeometry,
  CircleGeometry,
  RingGeometry,
  DoubleSide,
  BackSide,
  FrontSide
} from 'three';
import type { Object3D } from 'three';

// --- fixed dimensions (module-private: Gameboard just places holes) ---
const HOLE_R_m = 0.055;   // visible pit opening radius
const CROWN_R_m = 0.06;   // occluder skirt — strictly outside the pit, no z-fight
const BRIM_R_m = 0.13;    // occluder brim — ~= a cross arm, so a cross's brims overlap into one sheet
const PIT_DEPTH_m = 0.22; // deep enough for a gnome (and a taller unicorn) to vanish completely
const PIT_DARK = 0x050505;

// --- shared resources (built once, referenced by every Hole) ---
// Not disposed: they live for the page lifetime, which matches the rest of the
// codebase (RenderingManager never frees its geometry either, and Game.dispose
// is not wired up). Hole.dispose() only detaches this hole's meshes.
const BRIM_GEO = new RingGeometry(HOLE_R_m, BRIM_R_m, 28).rotateX(-Math.PI / 2);
const CROWN_GEO = new CylinderGeometry(CROWN_R_m, CROWN_R_m, PIT_DEPTH_m, 24, 1, true);
const PIT_GEO = new CylinderGeometry(HOLE_R_m, HOLE_R_m, PIT_DEPTH_m, 24, 1, true);
const DISC_GEO = new CircleGeometry(CROWN_R_m, 20).rotateX(-Math.PI / 2);

const OCC_MAT = new MeshBasicMaterial({ colorWrite: false, side: DoubleSide });
const PIT_MAT = new MeshBasicMaterial({ color: PIT_DARK, side: BackSide });
const FLOOR_MAT = new MeshBasicMaterial({ color: PIT_DARK, side: FrontSide }); // faces up after rotateX

const OCC_ORDER = -10; // depth laid down before the actors (default order)
const PIT_ORDER = -5;  // dark walls fill the opening, after the occluder

export class Hole {
  readonly x: number;
  readonly z: number;
  free = true;

  #root: Object3D;
  #fixtures: Mesh[];

  constructor(root: Object3D, x: number, z: number) {
    this.#root = root;
    this.x = x;
    this.z = z;

    const brim = new Mesh(BRIM_GEO, OCC_MAT);
    brim.position.set(x, -0.002, z); // just under the shadow-catcher plane — no z-fight
    const crown = new Mesh(CROWN_GEO, OCC_MAT);
    crown.position.set(x, -PIT_DEPTH_m / 2, z);
    const base = new Mesh(DISC_GEO, OCC_MAT); // closes the "hat" — nobody sees in from below
    base.position.set(x, -PIT_DEPTH_m, z);

    const pit = new Mesh(PIT_GEO, PIT_MAT);
    pit.position.set(x, -PIT_DEPTH_m / 2, z);
    const floor = new Mesh(DISC_GEO, FLOOR_MAT);
    floor.position.set(x, -PIT_DEPTH_m + 0.003, z);

    for (const m of [brim, crown, base]) m.renderOrder = OCC_ORDER;
    for (const m of [pit, floor]) m.renderOrder = PIT_ORDER;

    this.#fixtures = [brim, crown, base, pit, floor];
    root.add(...this.#fixtures);
  }

  dispose(): void {
    for (const f of this.#fixtures) this.#root.remove(f);
  }
}
