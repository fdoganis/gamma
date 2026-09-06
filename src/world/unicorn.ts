// The decoy's cosmetic trim — kept out of Actors so that file stays about
// spawning / pooling / lifecycle. Not a class: a decoy is just an actor with
// `decoy: true`; the only behavioural difference (a tap is a penalty, an unhit
// sink isn't a miss) lives in Actors. This module adds the meshes plus a small
// update closure that swings the mane on a gravity-pulled follow-the-leader
// chain (each strand a lagged rope of tapered cone segments).
import {
  Mesh, MeshPhongMaterial, MeshBasicMaterial, CylinderGeometry, SphereGeometry,
  Vector3, MathUtils, type Object3D,
} from 'three';
import { RAINBOW } from '../core/palette';
import { pupilMat as blackEyeMat } from './ghostEyes'; // same shiny void-black as the ghost eyes

const PINK = 0xd8899b;
const MANE = RAINBOW; // 7 strands, full ROYGBIV, protruding off the back of the head

// --- mane: a follow-the-leader chain per strand -------------------------------
// The root point is pinned at the crown; every other point trails toward its
// parent along a direction that relaxes back toward the strand's rest pose and
// is bent down by gravity + the body's rise/sink inertia. A hard length
// constraint after the lerp keeps the strand from stretching. Points live in
// body-local space — the body only yaws (about Y), so local-down is world-down
// and no matrix transform is needed.
const MANE_SEGS = 5;                 // cone segments per strand
const MANE_PTS = MANE_SEGS + 1;
const MANE_SEG_m = 0.024;            // rest length of one segment → ~12cm strand
const MANE_FOLLOW = 0.35;            // chain responsiveness (higher = stiffer)
const MANE_RELAX = 0.08;             // per-frame pull back toward the rest direction
const MANE_LAG = 0.18;               // body Y-speed → downward bend on the chain
const MANE_GRAV = 0.06;              // extra downward bend per segment → a resting droop arc
const MANE_ROOT_Y_m = 0.005;         // just above the crown, behind the horn
const MANE_ROOT_Z_m = -0.012;
const MANE_TAPER = 0.78;             // tip radius = root * (1 - MANE_TAPER)
const MANE_IDLE = 0.05;              // sideways sway amplitude while holding

const _tgt = new Vector3();
const _dir = new Vector3();
const _up = new Vector3(0, 1, 0);

// a spiral unicorn horn: a low-facet tapered cone with a twist baked into its
// vertices once at load — each ring rotated about the axis by an angle that
// grows from base (0) to tip (HORN_TURNS full turns), so the facet edges wind up
// it like a barber pole.
const HORN_H_m = 0.075;
const HORN_TURNS = 2.5;
function twistedHornGeo() {
  const g = new CylinderGeometry(0.001, 0.02, HORN_H_m, 6, 8);
  const pos = g.attributes.position;
  const v = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const a = HORN_TURNS * Math.PI * 2 * (v.y / HORN_H_m + 0.5);
    const c = Math.cos(a), s = Math.sin(a);
    pos.setXYZ(i, v.x * c - v.z * s, v.y, v.x * s + v.z * c);
  }
  g.computeVertexNormals();
  return g;
}

const hornGeo = twistedHornGeo();
const eyeGeo = new SphereGeometry(0.012, 8, 6);
const cheekGeo = new SphereGeometry(0.010, 6, 5);
const segGeo = new CylinderGeometry(0.007, 0.007, 1, 5); // unit strand segment, scaled per frame
const pinkMat = new MeshPhongMaterial({ color: PINK });
const maneMat = MANE.map((c) => new MeshBasicMaterial({ color: c, toneMapped: false })); // vivid, like the rainbow arcs

type Strand = { root: Vector3; rest: Vector3; phase: number; pts: Vector3[]; segs: Mesh[] };

// Build one strand's chain points (draped in the rest pose) + its cone segments.
function makeStrand(body: Object3D, halfH: number, d: number, mat: MeshBasicMaterial): Strand {
  const root = new Vector3(d * 0.006, halfH + MANE_ROOT_Y_m, MANE_ROOT_Z_m);
  const rest = new Vector3(d * 0.14, -0.7, -0.72).normalize(); // down + back, fanned by strand
  const pts = Array.from({ length: MANE_PTS }, (_, i) => root.clone().addScaledVector(rest, i * MANE_SEG_m));
  const segs = Array.from({ length: MANE_SEGS }, (_, j) => {
    const m = new Mesh(segGeo, mat);
    const s = 1 - (j / MANE_SEGS) * MANE_TAPER; // taper from root to tip
    m.scale.set(s, MANE_SEG_m, s);
    body.add(m);
    return m;
  });
  return { root, rest, phase: d * 1.7, pts, segs };
}

// Advance one strand: trail each point toward its parent, then lay the cone
// segments along the resulting chain. `bend` folds gravity + rise/sink inertia
// into the downward pull; `t` drives a small idle sway.
function stepStrand(st: Strand, bend: number, t: number): void {
  st.pts[0].copy(st.root);
  for (let i = 1; i < MANE_PTS; i++) {
    const parent = st.pts[i - 1];
    const p = st.pts[i];
    _dir.copy(p).sub(parent);
    if (_dir.lengthSq() < 1e-8) _dir.copy(st.rest);
    _dir.normalize().lerp(st.rest, MANE_RELAX);
    _dir.y -= bend + (i - 1) * MANE_GRAV; // gravity accumulates toward the tip → a droop arc
    _dir.x += Math.sin(t * 4 + st.phase + i) * MANE_IDLE;
    _tgt.copy(parent).addScaledVector(_dir.normalize(), MANE_SEG_m);
    p.lerp(_tgt, MANE_FOLLOW).sub(parent).normalize().multiplyScalar(MANE_SEG_m).add(parent);
  }
  for (let j = 0; j < MANE_SEGS; j++) {
    const a = st.pts[j];
    _dir.copy(st.pts[j + 1]).sub(a);
    const len = _dir.length() || 1e-4;
    st.segs[j].position.copy(a).addScaledVector(_dir, 0.5);
    st.segs[j].quaternion.setFromUnitVectors(_up, _dir.divideScalar(len));
    st.segs[j].scale.y = len;
  }
}

// `halfH` = the body capsule's half-height, so the trim sits relative to it.
export function dressUnicorn(body: Object3D, halfH: number) {
  for (const sx of [-1, 1]) {
    const eye = new Mesh(eyeGeo, blackEyeMat);
    eye.position.set(sx * 0.016, halfH * 0.5, 0.038);
    body.add(eye);
    const cheek = new Mesh(cheekGeo, pinkMat);
    cheek.position.set(sx * 0.026, halfH * 0.32, 0.033); // sits just proud of the body — a visible spot, less than the eyes
    cheek.scale.set(1, 1, 0.55); // flattened against the face, so it reads as painted blush not a ball
    body.add(cheek);
  }
  const horn = new Mesh(hornGeo, pinkMat);
  horn.position.set(0, halfH + 0.02, 0.012);
  horn.rotation.x = 0.22; // ~13° toward the viewer (+Z)
  body.add(horn);

  // 7 rainbow strands from the crown, fanned wide off the back of the head
  const mid = (maneMat.length - 1) / 2;
  const strands = maneMat.map((mat, k) => makeStrand(body, halfH, k - mid, mat));

  const _look = new Vector3();
  let t = 0;
  return {
    update(delta: number, ySpeed: number, camPos: Vector3): void {
      t += delta;
      // whole unicorn faces the player (Y axis) — horn to the front, mane behind
      body.parent!.worldToLocal(_look.copy(camPos)).sub(body.position);
      body.rotation.y = Math.atan2(_look.x, _look.z);

      // rise/sink inertia on top of the rest-pose gravity: a fast rise bends the
      // chain further down (heavy mane lags), then it springs back through
      // MANE_RELAX as ySpeed falls off; a sink lets it trail up briefly
      const bend = MathUtils.clamp(ySpeed * MANE_LAG, -0.35, 0.9);
      for (const st of strands) stepStrand(st, bend, t);
    },
  };
}

export function disposeUnicornAssets(): void {
  for (const g of [hornGeo, eyeGeo, cheekGeo, segGeo]) g.dispose();
  for (const m of [pinkMat, ...maneMat]) m.dispose(); // blackEyeMat is owned + disposed by ghostEyes
}
