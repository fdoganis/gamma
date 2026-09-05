// Pac-Man-style eyes for a normal (non-decoy) body: a white tile with a dark
// pupil, ×2, on the front of the capsule. The eye pair yaws toward the player
// (Y axis only, like the billboarded text) and the pupils slide within the
// whites — toward the player left/right, and up/down with the body's rise/sink.
// A function + an update closure, not a class (see unicorn.ts for the why).
import { Mesh, MeshBasicMaterial, BoxGeometry, Object3D, Vector3, MathUtils } from 'three';

const whiteGeo = new BoxGeometry(0.02, 0.026, 0.006);
const pupilGeo = new BoxGeometry(0.01, 0.012, 0.004);
const whiteMat = new MeshBasicMaterial({ color: 0xffffff });
const pupilMat = new MeshBasicMaterial({ color: 0x101014 });

const YAW_MAX = 0.7;   // rad — how far the eyes will swivel before they give up tracking
const PUPIL_MAX = 0.005;

const _cam = new Vector3();

export function dressGhost(body: Object3D, halfH: number) {
  const face = new Object3D(); // holds both eyes so one yaw tracks the player
  face.position.set(0, halfH * 0.55, 0);
  body.add(face);

  const pupils: Object3D[] = [];
  for (const sx of [-1, 1]) {
    const white = new Mesh(whiteGeo, whiteMat);
    white.position.set(sx * 0.013, 0, 0.044); // on the capsule's front surface
    face.add(white);
    const pupil = new Mesh(pupilGeo, pupilMat);
    pupil.position.z = 0.004;
    white.add(pupil);
    pupils.push(pupil);
  }

  return {
    update(_delta: number, ySpeed: number, camPos: Vector3): void {
      // player position in the body's local frame → yaw + horizontal pupil bias
      body.worldToLocal(_cam.copy(camPos));
      const yaw = Math.atan2(_cam.x, _cam.z);
      face.rotation.y = MathUtils.clamp(yaw, -YAW_MAX, YAW_MAX);
      const px = MathUtils.clamp(yaw * 0.006, -PUPIL_MAX, PUPIL_MAX);
      const py = MathUtils.clamp(ySpeed * 0.015, -PUPIL_MAX, PUPIL_MAX); // look up rising, down sinking
      for (const p of pupils) { p.position.x = px; p.position.y = py; }
    },
  };
}

export function disposeGhostAssets(): void {
  for (const g of [whiteGeo, pupilGeo]) g.dispose();
  for (const m of [whiteMat, pupilMat]) m.dispose();
}
