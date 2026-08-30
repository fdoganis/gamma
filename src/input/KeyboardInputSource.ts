// input/KeyboardInputSource.ts
import { InputSource } from './InputSource';
import { SelectCommand } from '../commands/SelectCommand';
import { randomTransform } from '../core/Utils';


// Desktop fallback with no natural pose. There is nothing to aim, so each press
// emits a debugRandom SelectCommand — states that consume a hit (GameRunningState)
// treat it as "act on a random target". The transform is still filled with a
// bounded random pose so states that only change on select keep working.
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
    this.queue.push(new SelectCommand(randomTransform(), 'none', true));
  };

  override dispose(): void {
    document.removeEventListener('keydown', this.#onKeyDown);
  }
}