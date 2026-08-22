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

import type { Object3D } from 'three';

import type { ITransform } from '../types/ITransform';
import { EntityManager } from './EntityManager';

import { Sparkles } from '../animation/Sparkles';
import type { BurstMode } from '../animation/Sparkles';

type Cone = { mesh: Mesh; material: MeshPhongMaterial; axis: Vector3; speed: number };


// rad/s, mapped from the cone's own hue 
const MIN_SPIN = 0.5;
const MAX_SPIN = Math.PI * 2;

export class World {
  #em: EntityManager<Cone> = new EntityManager<Cone>();
  #sparkles: Sparkles;
  #root: Object3D;

  // CONST
  #geo: CylinderGeometry;

  // TMP
  #_pos: Vector3 = new Vector3();
  #_quat: Quaternion = new Quaternion();

  constructor(root: Object3D) {
    this.#root = root;
    this.#sparkles = new Sparkles(this.#root);

    this.#geo = new CylinderGeometry(0, 0.05, 0.2, 32);
    this.#geo.rotateX(Math.PI / 2);
  }

  spawn(transform: ITransform): { mesh: Mesh; color: Color } {
    this.#_pos.set(0, 0, -0.3).applyMatrix4(transform.matrixWorld);
    this.#_quat.setFromRotationMatrix(transform.matrixWorld);
    const material = new MeshPhongMaterial({ color: Math.random() * 0xffffff });
    const mesh = new Mesh(this.#geo, material);
    mesh.position.copy(this.#_pos);
    mesh.quaternion.copy(this.#_quat);
    this.#root.add(mesh);

    const hsl = { h: 0, s: 0, l: 0 };
    material.color.getHSL(hsl);
    const axis = new Vector3(
      Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1
    ).normalize(); // "arbitrary", a fresh random axis per cone, fixed once chosen
    const speed = MathUtils.lerp(MIN_SPIN, MAX_SPIN, hsl.h);

    this.#em.create({ mesh, material, axis, speed });
    return { mesh: mesh, color: material.color };
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
    this.#em.forEach(({ mesh, material }) => {
      this.#root.remove(mesh);
      material.dispose();
    });

    this.#em.clear();
    this.#geo.dispose();
    this.#sparkles.dispose();
  }
}