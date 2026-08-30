// input/PointerInputSource.ts
import { InputSource } from './InputSource';
import { SelectCommand } from '../commands/SelectCommand';
import { Raycaster, Vector2, Vector3, Matrix4 } from 'three';

import type {
  WebGLRenderer,
  PerspectiveCamera
} from 'three';

const UP = new Vector3(0, 1, 0);
const _target = new Vector3();

// Desktop / non-XR fallback. A screen click is a real aim, so it becomes a
// camera→cursor ray encoded in the command's transform: the matrix is placed at
// the camera and oriented so its local −Z is the pick direction (the same
// convention an XR controller's targetRay uses). GameRunningState reads it back
// as origin + −Z for hit-testing.
export class PointerInputSource extends InputSource {
  #renderer: WebGLRenderer;
  #camera: PerspectiveCamera;
  #raycaster = new Raycaster();
  #ndc = new Vector2();

  constructor(renderer: WebGLRenderer, camera: PerspectiveCamera) {
    super();
    this.#renderer = renderer;
    this.#camera = camera;
    renderer.domElement.addEventListener('pointerdown', this.#onPointerDown);
  }

  #onPointerDown = (e: PointerEvent) => {
    if (!this.enabled || this.#renderer.xr.isPresenting) return;
    const rect = this.#renderer.domElement.getBoundingClientRect();
    this.#ndc.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    this.#raycaster.setFromCamera(this.#ndc, this.#camera);
    const { origin, direction } = this.#raycaster.ray;
    const matrixWorld = new Matrix4()
      .lookAt(origin, _target.copy(origin).add(direction), UP)
      .setPosition(origin);
    this.queue.push(new SelectCommand({ matrixWorld }));
  };

  override dispose() {
    this.#renderer.domElement.removeEventListener('pointerdown', this.#onPointerDown);
  }
}
