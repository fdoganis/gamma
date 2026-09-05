// Googly Pac-Man-ghost eyes for a normal (non-decoy) body: a white eyeball
// capsule with a loose blue sphere pupil. An Object3D "face" yaws toward the
// player (Y axis, like the billboarded text); each pupil springs toward the
// direction of the player's head for eye contact, and gets a downward kick from
// the body's rise/sink so it jiggles. Function + update closure, not a class.
import {
  Mesh, MeshPhongMaterial, CapsuleGeometry, SphereGeometry, Object3D, Vector3, MathUtils,
} from 'three';

const eyeGeo = new CapsuleGeometry(0.011, 0.012, 3, 8);
const pupilGeo = new SphereGeometry(0.006, 8, 6);
const whiteMat = new MeshPhongMaterial({ color: 0xffffff });
const pupilMat = new MeshPhongMaterial({ color: 0x1b48d6, shininess: 60 });

const YAW_MAX = 0.8;
const RANGE = 0.006;  // how far the pupil can roam on the eyeball
const SPRING = 120;   // pull toward the target — higher = snappier
const DAMP = 0.78;    // <1 leaves some overshoot → the googly jiggle
const KICK = 0.03;    // rise/sink acceleration → pupil impulse

const _cam = new Vector3();

export function dressGhost(body: Object3D, halfH: number) {
  const face = new Object3D(); // both eyes, one yaw tracks the player
  face.position.set(0, halfH * 0.55, 0);
  body.add(face);

  const eyes = [-1, 1].map((sx) => {
    const white = new Mesh(eyeGeo, whiteMat);
    white.position.set(sx * 0.014, 0, 0.043);
    face.add(white);
    const pupil = new Mesh(pupilGeo, pupilMat);
    pupil.position.z = 0.006;
    white.add(pupil);
    return { pupil, x: 0, y: 0, vx: 0, vy: 0 };
  });

  let prevYSpeed = 0;

  return {
    update(delta: number, ySpeed: number, camPos: Vector3): void {
      body.worldToLocal(_cam.copy(camPos));
      face.rotation.y = MathUtils.clamp(Math.atan2(_cam.x, _cam.z), -YAW_MAX, YAW_MAX);
      face.updateMatrixWorld();

      face.worldToLocal(_cam.copy(camPos)); // player head in the turned face's frame
      const d = _cam.length() || 1;
      const tx = MathUtils.clamp((_cam.x / d) * 0.02, -RANGE, RANGE);
      const ty = MathUtils.clamp((_cam.y / d) * 0.02, -RANGE, RANGE);

      const kick = (ySpeed - prevYSpeed) * KICK; // pop up → pupils lag down, then spring back
      prevYSpeed = ySpeed;

      for (const e of eyes) {
        e.vx = (e.vx + (tx - e.x) * SPRING * delta) * DAMP;
        e.vy = (e.vy + (ty - e.y - kick) * SPRING * delta) * DAMP;
        e.x += e.vx * delta;
        e.y += e.vy * delta;
        e.pupil.position.x = e.x;
        e.pupil.position.y = e.y;
      }
    },
  };
}

export function disposeGhostAssets(): void {
  for (const g of [eyeGeo, pupilGeo]) g.dispose();
  for (const m of [whiteMat, pupilMat]) m.dispose();
}
