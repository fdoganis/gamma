// Bodies that emerge straight up out of a Hole, hold, then sink back down and
// despawn. Generic: an actor does not know its color means "a stolen rainbow
// colour", or why it was told to appear — GameRunningState owns all of that.
// Backed by the generic EntityManager entity store.
import { Mesh, MeshPhongMaterial, CylinderGeometry, MathUtils } from 'three';
import type { Object3D } from 'three';
import { EntityManager } from './EntityManager';
import { easeOutCubic } from '../animation/Easing';
import type { Hole } from './Hole';

const ACTOR_H_m = 0.12;
const HIDDEN_Y_m = -0.14; // centre: whole body below the rim and inside the pit (fits a taller unicorn too)
const PEEK_Y_m = 0.06;    // centre: clearly above the occluder plane, so a risen body is never culled
const RISE_S = 0.25;
const SINK_S = 0.22;

type Phase = 'rising' | 'holding' | 'sinking';

type Actor = {
  mesh: Mesh<CylinderGeometry, MeshPhongMaterial>;
  hole: Hole;
  phase: Phase;
  phaseT: number; // seconds spent in the current phase
  hold: number;   // seconds to stay up once risen
};

export class Actors {
  #root: Object3D;
  #em = new EntityManager<Actor>();
  #geo: CylinderGeometry;

  constructor(root: Object3D) {
    this.#root = root;
    this.#geo = new CylinderGeometry(0.05, 0.05, ACTOR_H_m, 16);
  }

  get count(): number {
    let n = 0;
    this.#em.forEach(() => { n++; });
    return n;
  }

  // Raise a body of `colorHex` from `hole`, up for `hold` seconds; it sinks and
  // despawns on its own. Returns the mesh (for audio / hit-test) or null if the
  // hole is already taken.
  spawn(hole: Hole, colorHex: string, hold: number): Mesh<CylinderGeometry, MeshPhongMaterial> | null {
    if (!hole.free) return null;
    hole.free = false;

    const mesh = new Mesh(this.#geo, new MeshPhongMaterial({ color: colorHex }));
    mesh.castShadow = true;
    mesh.position.set(hole.x, HIDDEN_Y_m, hole.z);
    this.#root.add(mesh);
    mesh.updateWorldMatrix(true, false); // same-frame world pose for callers

    this.#em.create({ mesh, hole, phase: 'rising', phaseT: 0, hold });
    return mesh;
  }

  update(delta: number): void {
    // Deleting the current entry mid-iteration is safe for a Map (it has already
    // been yielded), so removal happens inline — no deferred `done` list.
    this.#em.forEach((a) => {
      a.phaseT += delta;

      if (a.phase === 'rising') {
        const k = Math.min(a.phaseT / RISE_S, 1);
        a.mesh.position.y = MathUtils.lerp(HIDDEN_Y_m, PEEK_Y_m, easeOutCubic(k));
        if (k >= 1) { a.phase = 'holding'; a.phaseT = 0; }
      } else if (a.phase === 'holding') {
        if (a.phaseT >= a.hold) { a.phase = 'sinking'; a.phaseT = 0; }
      } else {
        // TODO(polish): easeOutCubic decelerates into HIDDEN_Y, so the body
        // creeps the last ~2 frames before it despawns — reads as a small pause.
        // Switch the sink to `linear` (or an ease-in) during final UI tuning.
        const k = Math.min(a.phaseT / SINK_S, 1);
        a.mesh.position.y = MathUtils.lerp(PEEK_Y_m, HIDDEN_Y_m, easeOutCubic(k));
        if (k >= 1) this.#remove(a);
      }
    });
  }

  clear(): void {
    this.#em.forEach((a) => {
      a.hole.free = true;
      this.#root.remove(a.mesh);
      a.mesh.material.dispose();
    });
    this.#em.clear();
  }

  dispose(): void {
    this.clear();
    this.#geo.dispose();
  }

  #remove(a: Actor & { id: number }): void {
    a.hole.free = true;
    this.#root.remove(a.mesh);
    a.mesh.material.dispose();
    this.#em.destroy(a.id);
  }
}
