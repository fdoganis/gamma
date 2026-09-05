// Bodies that emerge straight up out of a Hole, hold, then sink back down and
// despawn. Generic: an actor does not know its color means "a stolen rainbow
// color", or why it was told to appear — RunState owns all of that.
import { Mesh, MeshPhongMaterial, MeshBasicMaterial, CylinderGeometry, CapsuleGeometry, SphereGeometry, TorusGeometry, MathUtils, Raycaster, Vector3 } from 'three';
import type { Object3D, Ray, Color, BufferGeometry } from 'three';
import { easeOutCubic } from '../animation/Easing';
import type { Hole } from './Hole';

const _actorWorld = new Vector3(); // scratch: actor world position for the proximity test

// what a collected actor leaves behind: its caller-supplied `tag` (opaque here —
// RunState uses it for the rainbow index) plus color + position for effects.
export type RemovedActor = { tag: number; color: Color; position: Vector3 };

// what a ray/proximity query found, without touching it. `decoy` lets the caller
// decide whether this hit means "collect" or "penalty" (RunState: a decoy is the
// unicorn — tapping it is punished and the body stays standing).
export type ActorHit = { id: number; tag: number; decoy: boolean; position: Vector3 };

const ACTOR_H_m = 0.12;
const HORN_HEX = 0xd8899b;   // pink — the horn + cheeks of the decoy (the unicorn)
const MANE = ['#F00', '#FF0', '#0F0', '#08F', '#80F']; // arc colors down the unicorn's back
const HIDDEN_Y_m = -0.14; // center: whole body below the rim and inside the pit (fits a taller unicorn too)
const PEEK_Y_m = 0.06;    // center: clearly above the occluder plane, so a risen body is never culled
const RISE_S = 0.25;
const SINK_S = 0.22;

type Phase = 'rising' | 'holding' | 'sinking';

type Actor = {
  id: number;
  mesh: Mesh<BufferGeometry, MeshPhongMaterial>;
  hole: Hole;
  tag: number;    // opaque caller id (RunState: rainbow color index)
  decoy: boolean; // horned; a tap never removes it and its unhit sink is not a miss
  phase: Phase;
  phaseT: number; // seconds spent in the current phase
  hold: number;   // seconds to stay up once risen
};

export class Actors {
  #root: Object3D;
  #actors = new Map<number, Actor>(); // live bodies by id — inlined, single consumer
  #nextId = 0;
  #geo: CylinderGeometry;             // normal actor body
  #raycaster = new Raycaster();

  // shared decoy (unicorn) parts — one set, every unicorn reuses them
  #decoyGeo = new CapsuleGeometry(0.045, 0.04, 4, 12); // rounder, cuter body
  #hornGeo = new CylinderGeometry(0, 0.018, 0.05, 10); // small cone
  #eyeGeo = new SphereGeometry(0.012, 8, 6);
  #cheekGeo = new SphereGeometry(0.017, 8, 6);
  #maneGeo = new TorusGeometry(0.028, 0.007, 6, 14, Math.PI * 0.8);
  #pinkMat = new MeshPhongMaterial({ color: HORN_HEX });          // horn + cheeks
  #eyeMat = new MeshPhongMaterial({ color: 0x111111 });
  #maneMat = MANE.map((c) => new MeshBasicMaterial({ color: c }));

  constructor(root: Object3D) {
    this.#root = root;
    this.#geo = new CylinderGeometry(0.05, 0.05, ACTOR_H_m, 16);
  }

  // A cream capsule with black eyes, pink cheeks half-sunk in the body, a small
  // horn tipped toward the viewer, and a fan of rainbow arcs for a mane.
  #dressUnicorn(body: Object3D): void {
    for (const sx of [-1, 1]) {
      const eye = new Mesh(this.#eyeGeo, this.#eyeMat);
      eye.position.set(sx * 0.016, 0.02, 0.038);
      body.add(eye);
      const cheek = new Mesh(this.#cheekGeo, this.#pinkMat);
      cheek.position.set(sx * 0.038, -0.005, 0.026); // mostly inside the capsule
      body.add(cheek);
    }
    const horn = new Mesh(this.#hornGeo, this.#pinkMat);
    horn.position.set(0, ACTOR_H_m / 2 + 0.01, 0.006);
    horn.rotation.x = 0.22; // ~13° toward the viewer (+Z)
    body.add(horn);
    this.#maneMat.forEach((mat, k) => {
      const arc = new Mesh(this.#maneGeo, mat);
      arc.position.set(0, 0.005 + k * 0.006, -0.03);
      arc.rotation.set(Math.PI / 2, 0, (k - 2) * 0.28); // lay it back, fan it out
      arc.scale.setScalar(1 - k * 0.06);
      body.add(arc);
    });
  }

  get count(): number { return this.#actors.size; }

  // Rainbow indices of the actors currently alive (so RunState can keep one
  // actor per color).
  activeTags(): number[] {
    const tags: number[] = [];
    for (const a of this.#actors.values()) tags.push(a.tag);
    return tags;
  }

  // Raise a body of `colorHex` from `hole`, up for `hold` seconds, carrying
  // `tag`; it sinks and despawns on its own. `decoy` swaps the body for the
  // dressed-up unicorn capsule and marks it as one that survives a tap. Returns
  // the mesh (for audio / hit-test) or null if the hole is already taken.
  // `hold` may be Infinity — the body then stays up until despawned explicitly.
  spawn(hole: Hole, colorHex: string, hold: number, tag: number, decoy = false): { id: number; mesh: Mesh<BufferGeometry, MeshPhongMaterial> } | null {
    if (!hole.free) return null;
    hole.free = false;

    const mesh = new Mesh(decoy ? this.#decoyGeo : this.#geo, new MeshPhongMaterial({ color: colorHex }));
    mesh.castShadow = true;
    mesh.position.set(hole.x, HIDDEN_Y_m, hole.z);
    if (decoy) this.#dressUnicorn(mesh); // eyes / cheeks / horn / mane ride along with every rise / sink / cull
    this.#root.add(mesh);
    mesh.updateWorldMatrix(true, false); // same-frame world pose for callers

    const id = this.#nextId++;
    this.#actors.set(id, { id, mesh, hole, tag, decoy, phase: 'rising', phaseT: 0, hold });
    return { id, mesh };
  }

  // Ray hit against live actors; falls back to the nearest actor within
  // `proximityR` of the ray origin (direct touch — a hand pinch fires with the
  // fingertip on the body). Returns the hit (id + tag + decoy + position), or
  // null on a miss. Non-destructive — the caller chooses whether to despawn().
  hitTest(ray: Ray, proximityR: number): ActorHit | null {
    const meshes: Mesh[] = [];
    let nearId = -1;
    let nearD = proximityR;
    for (const a of this.#actors.values()) {
      meshes.push(a.mesh);
      // ray.origin is world-space; a.mesh.position is local to the placed anchor,
      // so compare against the actor's world position (matters once the board is
      // anchored anywhere but the origin — i.e. on a real device).
      const d = a.mesh.getWorldPosition(_actorWorld).distanceTo(ray.origin);
      if (d < nearD) { nearD = d; nearId = a.id; }
    }
    this.#raycaster.set(ray.origin, ray.direction);
    const hitMesh = this.#raycaster.intersectObjects(meshes, false)[0]?.object;

    let picked: Actor | undefined;
    if (hitMesh) { for (const a of this.#actors.values()) if (a.mesh === hitMesh) { picked = a; break; } }
    else if (nearId >= 0) picked = this.#actors.get(nearId);
    return picked
      ? { id: picked.id, tag: picked.tag, decoy: picked.decoy, position: picked.mesh.position.clone() }
      : null;
  }

  // The live mesh for an id (so World can emit a positional sound from it before
  // despawn). undefined if the actor is already gone.
  meshOf(id: number): Mesh<BufferGeometry, MeshPhongMaterial> | undefined {
    return this.#actors.get(id)?.mesh;
  }

  // Remove one actor now (a collect / hit). Returns its tag + color + last position.
  despawn(id: number): RemovedActor | null {
    const a = this.#actors.get(id);
    if (!a) return null;
    const removed: RemovedActor = { tag: a.tag, color: a.mesh.material.color.clone(), position: a.mesh.position.clone() };
    this.#remove(a);
    return removed;
  }

  // Collect a random live actor (keyboard fallback — no real aim). Skips decoys:
  // the debug key should never punish the player for a keypress it didn't aim.
  despawnAny(): RemovedActor | null {
    const ids: number[] = [];
    for (const a of this.#actors.values()) if (!a.decoy) ids.push(a.id);
    return ids.length ? this.despawn(ids[(Math.random() * ids.length) | 0]) : null;
  }

  // Advances every actor. Returns the number of **misses** this frame — actors
  // that sank back down unhit (a hit removes via despawn(), not here). RunState
  // uses it to break the streak.
  update(delta: number): number {
    let missed = 0;
    // Deleting the current entry mid-iteration is safe for a Map (it has already
    // been yielded), so removal happens inline — no deferred `done` list.
    this.#actors.forEach((a) => {
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
        if (k >= 1) { const wasDecoy = a.decoy; this.#remove(a); if (!wasDecoy) missed++; } // ignoring a decoy is correct play — not a miss
      }
    });
    return missed;
  }

  clear(): void {
    this.#actors.forEach((a) => {
      a.hole.free = true;
      this.#root.remove(a.mesh);
      a.mesh.material.dispose();
    });
    this.#actors.clear();
  }

  dispose(): void {
    this.clear();
    for (const g of [this.#geo, this.#decoyGeo, this.#hornGeo, this.#eyeGeo, this.#cheekGeo, this.#maneGeo]) g.dispose();
    for (const m of [this.#pinkMat, this.#eyeMat, ...this.#maneMat]) m.dispose();
  }

  #remove(a: Actor): void {
    a.hole.free = true;
    this.#root.remove(a.mesh);
    a.mesh.material.dispose();
    this.#actors.delete(a.id);
  }
}
