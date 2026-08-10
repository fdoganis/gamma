// input/KeyboardInputSource.ts
import { InputSource } from './InputSource';
import { SelectCommand } from '../commands/SelectCommand';
import { Matrix4, Quaternion, Vector3 } from 'three';
import type { ITransform } from '../types/ITransform';

// CONST
const UP = new Vector3(0, 1, 0);
const SCALE = new Vector3(1, 1, 1);

// Desktop fallback with no natural pose. 
// Each press gets a fresh, bounded random transform inside the default camera's view
// (RenderManager starts it at (0,1.6,3) looking at (0,1.6,0)) rather than truly unbounded
// TODO: use camera pose instead of magic numbers? It create an unneeded dpendency.
// => expose default values
export class KeyboardInputSource extends InputSource implements ITransform {
  readonly matrixWorld = new Matrix4();

  #key: string;
  #command: SelectCommand;
  #pos = new Vector3();
  #quat = new Quaternion();

  constructor(key: string = ' ') {
    super();
    this.#key = key;
    this.#command = new SelectCommand(this);
    document.addEventListener('keydown', this.#onKeyDown);
  }

  #onKeyDown = (e: KeyboardEvent) => {
    if (!this.enabled || e.repeat || e.key !== this.#key) { return; }
    e.preventDefault(); // stop Space from also scrolling the page

    this.#pos.set(
      (Math.random() - 0.5) * 1.5,
      1.2 + Math.random() * 0.6,
      -0.5 - Math.random() * 1.5
    );

    this.#quat.setFromAxisAngle(UP, Math.random() * Math.PI * 2);
    this.matrixWorld.compose(this.#pos, this.#quat, SCALE); // written in place
    this.queue.push(this.#command);
  };

  override dispose() {
    document.removeEventListener('keydown', this.#onKeyDown);
  }
}