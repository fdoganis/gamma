// input/KeyboardInputSource.ts
import { InputSource } from './InputSource';
import { SelectCommand } from '../commands/SelectCommand';
import { randomTransform } from '../core/Utils';


// Desktop fallback with no natural pose. 
// Each press gets a fresh, bounded random transform inside the default camera's view
// (RenderManager starts it at (0,1.6,3) looking at (0,1.6,0)) rather than truly unbounded
// TODO: use camera pose instead of magic numbers? It create an unneeded dpendency.
// => expose default values
export class KeyboardInputSource extends InputSource {
  #key: string;

  constructor(key: string = ' ') {
    super();
    this.#key = key;
    document.addEventListener('keydown', this.#onKeyDown);
  }

  #onKeyDown = (e: KeyboardEvent): void => {
    if (!this.enabled || e.repeat || e.key !== this.#key) return;
    e.preventDefault(); // stop Space from also scrolling the page
    this.queue.push(new SelectCommand(randomTransform()));
  };

  override dispose(): void {
    document.removeEventListener('keydown', this.#onKeyDown);
  }
}