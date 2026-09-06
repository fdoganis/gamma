// The decoy's cosmetic trim — kept out of Actors so that file stays about
// spawning / pooling / lifecycle. Not a class: a decoy is just an actor with
// `decoy: true`; the only behavioural difference (a tap is a penalty, an unhit
// sink isn't a miss) lives in Actors. This module only adds meshes + a small
// update closure that wobbles the mane and squashes/stretches it with the
// body's rise/sink speed.
import {
  Mesh, MeshPhongMaterial, MeshBasicMaterial, CylinderGeometry, SphereGeometry,
  TubeGeometry, CatmullRomCurve3, Vector3, MathUtils, type Object3D,
} from 'three';
import { RAINBOW } from '../core/palette';
import { pupilMat as blackEyeMat } from './ghostEyes'; // same shiny void-black as the ghost eyes

const PINK = 0xd8899b;
const MANE = RAINBOW; // 7 strands, full ROYGBIV, protruding off the back of the head

// a strand that sprouts up from the crown then arcs BACK and down, protruding
// well off the back of the head
const STRAND = new CatmullRomCurve3([
  new Vector3(0, 0, 0),
  new Vector3(0.004, 0.022, -0.02),   // up and back
  new Vector3(-0.005, 0.006, -0.06),  // arcing back, above/behind the head
  new Vector3(0.004, -0.05, -0.10),
  new Vector3(0, -0.13, -0.115),      // tail, well clear of the body
]);

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
const maneGeo = new TubeGeometry(STRAND, 18, 0.007, 5, false); // thicker, so each strand shows
const pinkMat = new MeshPhongMaterial({ color: PINK });
const maneMat = MANE.map((c) => new MeshBasicMaterial({ color: c }));

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

  // 7 rainbow strands from the crown, fanned wide + splayed so they stand off
  // the back of the head
  const mid = (maneMat.length - 1) / 2;
  const strands = maneMat.map((mat, k) => {
    const d = k - mid;
    const s = new Mesh(maneGeo, mat);
    s.position.set(d * 0.005, halfH, -0.012);
    s.rotation.z = d * 0.2;
    s.rotation.y = d * 0.1; // splay left/right
    s.userData.baseScale = 1 - Math.abs(d) * 0.05;
    s.userData.baseRotZ = s.rotation.z;
    s.userData.phase = k * 1.3;
    s.scale.setScalar(s.userData.baseScale);
    body.add(s);
    return s;
  });

  const _look = new Vector3();
  let t = 0;
  return {
    update(delta: number, ySpeed: number, camPos: Vector3): void {
      t += delta;
      // whole unicorn faces the player (Y axis) — horn to the front, mane behind
      body.parent!.worldToLocal(_look.copy(camPos)).sub(body.position);
      body.rotation.y = Math.atan2(_look.x, _look.z);

      const stretch = MathUtils.clamp(ySpeed * 0.18, -0.22, 0.45); // + rising, - sinking
      for (const s of strands) {
        const b = s.userData.baseScale as number;
        s.scale.y = b * (1 + stretch);
        s.scale.x = s.scale.z = b * (1 - stretch * 0.35);
        s.rotation.z = (s.userData.baseRotZ as number) + Math.sin(t * 5 + (s.userData.phase as number)) * 0.07;
      }
    },
  };
}

export function disposeUnicornAssets(): void {
  for (const g of [hornGeo, eyeGeo, cheekGeo, maneGeo]) g.dispose();
  for (const m of [pinkMat, ...maneMat]) m.dispose(); // blackEyeMat is owned + disposed by ghostEyes
}
