// Owns entity lifecycle (EntityManager) and Three.js bridge (scene add/remove).
import {
  Mesh,
  MeshPhongMaterial,
  CylinderGeometry,
  Vector3,
  Quaternion,
  Scene
} from 'three';

import type { ITransform } from '../types/ITransform';
import { EntityManager } from './EntityManager';

type Cone = { mesh: Mesh; material: MeshPhongMaterial };

export class World {
  #em: EntityManager<Cone> = new EntityManager<Cone>();
  #scene: Scene;
  #geo: CylinderGeometry; // shared

  // TMP
  #_pos: Vector3 = new Vector3();
  #_quat: Quaternion = new Quaternion();

  constructor(scene: Scene) {
    this.#scene = scene;
    this.#geo = new CylinderGeometry(0, 0.05, 0.2, 32);
    this.#geo.rotateX(Math.PI / 2);
  }

  spawn(transform: ITransform): void {
    this.#_pos.set(0, 0, -0.3).applyMatrix4(transform.matrixWorld);
    this.#_quat.setFromRotationMatrix(transform.matrixWorld);
    const material = new MeshPhongMaterial({ color: Math.random() * 0xffffff });
    const mesh = new Mesh(this.#geo, material);
    mesh.position.copy(this.#_pos);
    mesh.quaternion.copy(this.#_quat);
    this.#scene.add(mesh);
    this.#em.create({ mesh, material });
  }

  dispose(): void {
    this.#em.forEach(({ mesh, material }) => {
      this.#scene.remove(mesh);
      material.dispose();
    });
    this.#em.clear();
    this.#geo.dispose(); // shared, dispose once here, not per mesh
  }
}