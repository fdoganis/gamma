// The decoy's cosmetic trim — kept out of Actors so that file stays about
// spawning / pooling / lifecycle. Not a class: a decoy is just an actor with
// `decoy: true`; the only behavioural difference (a tap is a penalty, an unhit
// sink isn't a miss) lives in Actors. This module only adds meshes.
import {
  Mesh, MeshPhongMaterial, MeshBasicMaterial, CylinderGeometry, SphereGeometry,
  TubeGeometry, CatmullRomCurve3, Vector3,
} from 'three';
import type { Object3D } from 'three';

const PINK = 0xd8899b;
const MANE = ['#F00', '#FF7F00', '#FF0', '#0F0', '#00F']; // strand colors, crest → nape

// one S-curved strand, reused (and rotated) for every mane hair
const STRAND = new CatmullRomCurve3([
  new Vector3(0, 0, 0),
  new Vector3(0.012, 0.03, -0.02),
  new Vector3(-0.008, 0.055, -0.045),
  new Vector3(0.006, 0.07, -0.08),
]);

const hornGeo = new CylinderGeometry(0, 0.022, 0.07, 10); // small cone
const eyeGeo = new SphereGeometry(0.012, 8, 6);
const cheekGeo = new SphereGeometry(0.009, 6, 5);
const maneGeo = new TubeGeometry(STRAND, 12, 0.004, 5, false);
const pinkMat = new MeshPhongMaterial({ color: PINK }); // horn + cheeks
const eyeMat = new MeshPhongMaterial({ color: 0x111111 });
const maneMat = MANE.map((c) => new MeshBasicMaterial({ color: c }));

// `halfH` = the body capsule's half-height, so the trim sits relative to it.
export function dressUnicorn(body: Object3D, halfH: number): void {
  for (const sx of [-1, 1]) {
    const eye = new Mesh(eyeGeo, eyeMat);
    eye.position.set(sx * 0.016, halfH * 0.5, 0.038);
    body.add(eye);
    const cheek = new Mesh(cheekGeo, pinkMat);
    cheek.position.set(sx * 0.033, halfH * 0.3, 0.035); // faint blush under the eyes
    body.add(cheek);
  }
  const horn = new Mesh(hornGeo, pinkMat);
  horn.position.set(0, halfH + 0.02, 0.012);
  horn.rotation.x = 0.22; // ~13° toward the viewer (+Z)
  body.add(horn);
  // five S-curved rainbow strands fanned across the top-back of the head
  maneMat.forEach((mat, k) => {
    const strand = new Mesh(maneGeo, mat);
    strand.position.set((k - 2) * 0.008, halfH * 0.8, -0.006);
    strand.rotation.z = (k - 2) * 0.22;
    strand.scale.setScalar(0.95 - Math.abs(k - 2) * 0.08);
    body.add(strand);
  });
}

export function disposeUnicornAssets(): void {
  for (const g of [hornGeo, eyeGeo, cheekGeo, maneGeo]) g.dispose();
  for (const m of [pinkMat, eyeMat, ...maneMat]) m.dispose();
}
