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

const PINK = 0xd8899b;
const MANE = ['#F00', '#FF7F00', '#FF0', '#0F0', '#00F']; // crest → nape

// one long S-curved strand that FLOWS DOWN the back, reused (rotated) for every hair
const STRAND = new CatmullRomCurve3([
  new Vector3(0, 0, 0),
  new Vector3(0.012, -0.045, -0.025),
  new Vector3(-0.01, -0.10, -0.04),
  new Vector3(0.006, -0.16, -0.05),
]);

const hornGeo = new CylinderGeometry(0, 0.022, 0.07, 10);
const eyeGeo = new SphereGeometry(0.012, 8, 6);
const cheekGeo = new SphereGeometry(0.009, 6, 5);
const maneGeo = new TubeGeometry(STRAND, 16, 0.005, 5, false);
const pinkMat = new MeshPhongMaterial({ color: PINK });
const eyeMat = new MeshPhongMaterial({ color: 0x111111 });
const maneMat = MANE.map((c) => new MeshBasicMaterial({ color: c }));

// `halfH` = the body capsule's half-height, so the trim sits relative to it.
export function dressUnicorn(body: Object3D, halfH: number) {
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

  // mane sprouts from the crest at the top of the head, just behind the horn,
  // and hangs the full length of the back
  const strands = maneMat.map((mat, k) => {
    const s = new Mesh(maneGeo, mat);
    s.position.set((k - 2) * 0.007, halfH * 0.95, -0.008);
    s.rotation.z = (k - 2) * 0.14;
    s.userData.baseScale = 0.95 - Math.abs(k - 2) * 0.08;
    s.userData.baseRotZ = s.rotation.z;
    s.userData.phase = k * 1.3;
    s.scale.setScalar(s.userData.baseScale);
    body.add(s);
    return s;
  });

  let t = 0;
  return {
    update(delta: number, ySpeed: number, _camPos: Vector3): void {
      t += delta;
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
  for (const m of [pinkMat, eyeMat, ...maneMat]) m.dispose();
}
