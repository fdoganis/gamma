// input/PointerInputSource.ts
import { InputSource } from './InputSource';
import { SelectCommand } from '../commands/SelectCommand';
import { Raycaster, Vector2, Vector3, Matrix4, Plane } from 'three';
import type { WebGLRenderer, PerspectiveCamera } from 'three';
import type { ITransform } from '../types/ITransform';

// TODO: ARCHI: QUESTION: Select command is generic, cross platform, cross device, now we need to make it explicit again?

// Desktop / non-XR fallback: click or tap the canvas.
// A 2D pointer position is real spatial information, hence raycasting a fixed plane to retrieve the z.
export class PointerInputSource extends InputSource implements ITransform {
  readonly matrixWorld = new Matrix4();

  #renderer: WebGLRenderer;
  #camera: PerspectiveCamera;
  #command: SelectCommand;
  #raycaster = new Raycaster();
  #ndc = new Vector2();
  #ground = new Plane(new Vector3(0, 0, 1), 0); // plane z = 0
  #hit = new Vector3();

  constructor(renderer: WebGLRenderer, camera: PerspectiveCamera) {
    super();
    this.#renderer = renderer;
    this.#camera = camera;
    this.#command = new SelectCommand(this);

    this.#renderer.domElement.addEventListener('pointerdown', this.#onPointerDown);
  }

  #onPointerDown = (e: PointerEvent) => {
    // Desktop mode only
    if (!this.enabled || this.#renderer.xr.isPresenting) { return; }

    const rect = this.#renderer.domElement.getBoundingClientRect();
    this.#ndc.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );

    this.#raycaster.setFromCamera(this.#ndc, this.#camera);
    if (!this.#raycaster.ray.intersectPlane(this.#ground, this.#hit)) { return; } // parallel to plane

    this.matrixWorld.makeTranslation(this.#hit.x, this.#hit.y, this.#hit.z);
    this.queue.push(this.#command);
  };

  override dispose() {
    this.#renderer.domElement.removeEventListener('pointerdown', this.#onPointerDown);
  }
}