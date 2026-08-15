// input/PointerInputSource.ts
import { InputSource } from './InputSource';
import { SelectCommand } from '../commands/SelectCommand';
import {
  Raycaster,
  Vector2,
  Vector3,
  Matrix4,
  Plane
} from 'three';

import type {
  WebGLRenderer,
  PerspectiveCamera
} from 'three';

// Desktop/non-XR fallback. A 2D pointer position is real spatial
// information, so it's ray-cast onto a ground plane rather than randomised.
export class PointerInputSource extends InputSource {
  #renderer: WebGLRenderer;
  #camera: PerspectiveCamera;
  #raycaster = new Raycaster();
  #ndc = new Vector2();
  #ground = new Plane(new Vector3(0, 0, 1), 0); // plane z = 0
  #hit = new Vector3();

  constructor(renderer: WebGLRenderer, camera: PerspectiveCamera) {
    super();
    this.#renderer = renderer;
    this.#camera = camera;
    renderer.domElement.addEventListener('pointerdown', this.#onPointerDown);
  }

  #onPointerDown = (e: PointerEvent): void => {
    if (!this.enabled || this.#renderer.xr.isPresenting) return;
    const rect = this.#renderer.domElement.getBoundingClientRect();
    this.#ndc.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    this.#raycaster.setFromCamera(this.#ndc, this.#camera);
    if (!this.#raycaster.ray.intersectPlane(this.#ground, this.#hit)) return;
    const matrixWorld = new Matrix4().makeTranslation(this.#hit.x, this.#hit.y, this.#hit.z);
    this.queue.push(new SelectCommand({ matrixWorld }));
  };

  override dispose(): void {
    this.#renderer.domElement.removeEventListener('pointerdown', this.#onPointerDown);
  }
}
