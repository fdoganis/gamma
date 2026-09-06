// Googly Pac-Man-ghost eyes for a normal (non-decoy) body: a white eyeball
// capsule with a loose blue sphere pupil. An Object3D "face" yaws toward the
// player (Y axis, like the billboarded text); each pupil springs toward the
// direction of the player's head for eye contact, and gets a downward kick from
// the body's rise/sink so it jiggles. Function + update closure, not a class.
import {
  Mesh, MeshPhongMaterial, CapsuleGeometry, SphereGeometry, Object3D, Vector3, MathUtils,
} from 'three';

const eyeGeo = new CapsuleGeometry(0.011, 0.012, 3, 8);
const pupilGeo = new SphereGeometry(0.0065, 8, 6);
const whiteMat = new MeshPhongMaterial({ color: 0xffffff });
// void black, but wet: a tiny bright specular so the pupil always has a glint.
// Exported so the unicorn's eyes share the exact same shiny black.
export const pupilMat = new MeshPhongMaterial({ color: 0x050505, specular: 0xffffff, shininess: 320 });

// Exported so the DEV-only ?tweak panel (src/dev/tweakPanel.ts) can bind a
// lil-gui folder straight to it. yawMax/range/spring/damp/kick are read every
// frame; faceYFrac/whiteX/whiteZ are read when the face is built, so they take
// effect on the next body spawn.
export const ghostEyeKnobs = {
  yawMax: 0.8,     // how far the face can turn toward the player
  range: 0.006,    // how far the pupil can roam on the eyeball
  spring: 120,     // pull toward the target — higher = snappier
  damp: 0.78,      // <1 leaves some overshoot → the googly jiggle
  kick: 0.03,      // rise/sink acceleration → pupil impulse
  faceYFrac: 0.55, // face height as a fraction of the body half-height
  whiteX: 0.014,
  whiteZ: 0.043,
};

const _cam = new Vector3();

export function dressGhost(body: Object3D, halfH: number) {
  const k = ghostEyeKnobs;
  const face = new Object3D(); // both eyes, one yaw tracks the player
  face.position.set(0, halfH * k.faceYFrac, 0);
  body.add(face);

  const eyes = [-1, 1].map((sx) => {
    const white = new Mesh(eyeGeo, whiteMat);
    white.position.set(sx * k.whiteX, 0, k.whiteZ);
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
      face.rotation.y = MathUtils.clamp(Math.atan2(_cam.x, _cam.z), -k.yawMax, k.yawMax);
      face.updateMatrixWorld();

      face.worldToLocal(_cam.copy(camPos)); // player head in the turned face's frame
      const d = _cam.length() || 1;
      const tx = MathUtils.clamp((_cam.x / d) * 0.02, -k.range, k.range);
      const ty = MathUtils.clamp((_cam.y / d) * 0.02, -k.range, k.range);

      const kick = (ySpeed - prevYSpeed) * k.kick; // pop up → pupils lag down, then spring back
      prevYSpeed = ySpeed;

      for (const e of eyes) {
        e.vx = (e.vx + (tx - e.x) * k.spring * delta) * k.damp;
        e.vy = (e.vy + (ty - e.y - kick) * k.spring * delta) * k.damp;
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
