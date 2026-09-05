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

// a strand that CRESTS over the crown (rises above the capsule, arcs back) then
// cascades down the back — so it reads from the front, not swallowed by the head
const STRAND = new CatmullRomCurve3([
  new Vector3(0, 0, 0.004),
  new Vector3(0.006, 0.028, -0.008),  // up and back — the crest, above the capsule top
  new Vector3(-0.007, 0.012, -0.05),  // over the top, coming down the back
  new Vector3(0.005, -0.06, -0.085),
  new Vector3(0, -0.15, -0.095),      // tail
]);

const hornGeo = new CylinderGeometry(0, 0.022, 0.07, 10);
const eyeGeo = new SphereGeometry(0.012, 8, 6);
const cheekGeo = new SphereGeometry(0.009, 6, 5);
const maneGeo = new TubeGeometry(STRAND, 18, 0.007, 5, false); // thicker, so each strand shows
const pinkMat = new MeshPhongMaterial({ color: PINK });
const eyeMat = new MeshBasicMaterial({ color: 0x050505 }); // flat void black, same as the pits
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

  // mane sprouts from the crown just behind the horn, fanned wide so the outer
  // strands splay past the head and stay visible
  const strands = maneMat.map((mat, k) => {
    const s = new Mesh(maneGeo, mat);
    s.position.set((k - 2) * 0.006, halfH, -0.006);
    s.rotation.z = (k - 2) * 0.28;
    s.rotation.y = (k - 2) * 0.12; // splay left/right
    s.userData.baseScale = 1 - Math.abs(k - 2) * 0.06;
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
  for (const m of [pinkMat, eyeMat, ...maneMat]) m.dispose();
}
