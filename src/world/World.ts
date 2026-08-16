// Owns entity lifecycle (EntityManager) and Three.js bridge (scene add/remove).
import {
  Mesh,
  MeshPhongMaterial,
  CylinderGeometry,
  Vector3,
  Quaternion,
  Scene,
  Color,
  MathUtils
} from 'three';

import type { ITransform } from '../types/ITransform';
import { EntityManager } from './EntityManager';

type Cone = { mesh: Mesh; material: MeshPhongMaterial; axis: Vector3; speed: number };


// rad/s, mapped from the cone's own hue 
const MIN_SPIN = 0.5;
const MAX_SPIN = Math.PI * 2;

export class World {
  #em: EntityManager<Cone> = new EntityManager<Cone>();
  #scene: Scene;
  #geo: CylinderGeometry;
  #pos: Vector3 = new Vector3();
  #quat: Quaternion = new Quaternion();

  constructor(scene: Scene) {
    this.#scene = scene;
    this.#geo = new CylinderGeometry(0, 0.05, 0.2, 32);
    this.#geo.rotateX(Math.PI / 2);
  }

  spawn(transform: ITransform): { mesh: Mesh; color: Color } {
    this.#pos.set(0, 0, -0.3).applyMatrix4(transform.matrixWorld);
    this.#quat.setFromRotationMatrix(transform.matrixWorld);
    const material = new MeshPhongMaterial({ color: Math.random() * 0xffffff });
    const mesh = new Mesh(this.#geo, material);
    mesh.position.copy(this.#pos);
    mesh.quaternion.copy(this.#quat);
    this.#scene.add(mesh);

    const hsl = { h: 0, s: 0, l: 0 };
    material.color.getHSL(hsl);
    const axis = new Vector3(
      Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1
    ).normalize(); // "arbitrary", a fresh random axis per cone, fixed once chosen
    const speed = MathUtils.lerp(MIN_SPIN, MAX_SPIN, hsl.h);

    this.#em.create({ mesh, material, axis, speed });
    return { mesh: mesh, color: material.color };
  }

  update(delta: number): void {
    // Velocity, not a tween, no easing involved, just angle += speed * delta.
    this.#em.forEach(({ mesh, axis, speed }) => {
      mesh.rotateOnAxis(axis, speed * delta);
    });
  }

  dispose(): void {
    this.#em.forEach(({ mesh, material }) => {
      this.#scene.remove(mesh);
      material.dispose();
    });
    this.#em.clear();
    this.#geo.dispose();
  }
}