import type { Command } from '../core/Command';
import { InputSource } from './InputSource';

export class InputProcessor {

  #sources: InputSource[] = []
  commands: Command[] = []

  add(source: InputSource) {
    this.#sources.push(source);
    return source;
  }


  collect() {
    this.commands.length = 0;
    for (const src of this.#sources) {
      src.poll();

      for (const cmd of src.queue) {
        this.commands.push(cmd);
      }

      src.queue.length = 0;
    }
  }


  dispose() {
    for (const src of this.#sources) {
      src.dispose();
    }
  }
}