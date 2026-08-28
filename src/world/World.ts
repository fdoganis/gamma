// Owns entity lifecycle (EntityManager) and Three.js bridge (scene add/remove).
import {
  Mesh,
  MeshPhongMaterial,
  CylinderGeometry,
  Vector3,
  Quaternion,
  Color,
  MathUtils
} from 'three';

import type { Object3D, PositionalAudio } from 'three';

import { EntityManager } from './EntityManager';

import { Sparkles } from '../animation/Sparkles';
import type { BurstMode } from '../animation/Sparkles';
import type { AudioManager } from '../audio/AudioManager';

// mesh typed over its own material (Mesh<TGeometry, TMaterial>) instead of
// storing material as a second field pointing at the same object.
type Cone = { mesh: Mesh<CylinderGeometry, MeshPhongMaterial>; axis: Vector3; speed: number; sfx?: PositionalAudio };

// The classic rainbow: ROYGBIV, standard hex values
// 3-digit hex where it reduces losslessly.
const PALETTE = ['#F00', '#FF7F00', '#FF0', '#0F0', '#00F', '#4B0082', '#8B00FF']; // red orange yellow green blue indigo violet


// rad/s, mapped from the cone's own hue 
const MIN_SPIN = 0.5;
const MAX_SPIN = Math.PI * 2;

export class World {
  #em: EntityManager<Cone> = new EntityManager<Cone>();
  #sparkles: Sparkles;
  #audio: AudioManager;
  #root: Object3D;

  // CONST
  #geo: CylinderGeometry;

  constructor(root: Object3D, audio: AudioManager) {
    this.#root = root;
    this.#audio = audio;
    this.#sparkles = new Sparkles(this.#root);

    this.#geo = new CylinderGeometry(0, 0.05, 0.2, 32);
    this.#geo.rotateX(Math.PI / 2);
  }

  spawn(): { mesh: Mesh<CylinderGeometry, MeshPhongMaterial>; color: Color } {
    this.#_pos.set(0, 0, -0.3).applyMatrix4(transform.matrixWorld);
    this.#_quat.setFromRotationMatrix(transform.matrixWorld);
    const material = new MeshPhongMaterial({ color: PALETTE[Math.floor(Math.random() * PALETTE.length)] });
    const mesh = new Mesh(this.#geo, material);
    mesh.position.copy(this.#_pos);
    mesh.quaternion.copy(this.#_quat);
    this.#root.add(mesh);

    // walks up through #root (anchor) too, not just this mesh
    // callers use the returned mesh as a same-frame text anchor immediately below
    mesh.updateWorldMatrix(true, false);

    const hsl = { h: 0, s: 0, l: 0 };
    material.color.getHSL(hsl);
    const axis = new Vector3(
      Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1
    ).normalize(); // "arbitrary", a fresh random axis per cone, fixed once chosen
    const speed = MathUtils.lerp(MIN_SPIN, MAX_SPIN, hsl.h);

    // TODO: QUESTION: is SFX attached to the last spawned object? can't we have multiple sounds play simultaneously?
    let sfx: PositionalAudio | undefined;
    try {
      sfx = this.#audio.attach(mesh); // permanent: same node for this cone's hit/idle sounds later
      this.#audio.trigger(sfx, 'spawn');
    } catch {
      // Audio node creation can fail in restricted/sandboxed contexts 
      // a cone should still spawn silently rather than losing the whole action.
    }

    this.#em.create({ mesh, axis, speed, sfx });
    return { mesh, color: material.color };
  }

  burstSparkles(origin: Vector3, color: Color, mode?: BurstMode): void {
    this.#sparkles.burst(origin, color, mode);
  }


  update(delta: number): void {
    // Velocity, not a tween, no easing involved, just angle += speed * delta.
    this.#em.forEach(({ mesh, axis, speed }) => {
      mesh.rotateOnAxis(axis, speed * delta);
    });

    this.#sparkles.update(delta);

  }

  dispose(): void {
    this.#em.forEach(({ mesh, sfx }) => {
      sfx?.disconnect();
      this.#root.remove(mesh);
      mesh.material.dispose();
    });

    this.#em.clear();
    this.#geo.dispose();
    this.#sparkles.dispose();
  }
}