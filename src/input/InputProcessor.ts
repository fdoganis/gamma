import type { Action } from "./Action";
import { InputSource } from "./InputSource";

export class InputProcessor {

  sources: InputSource[] = []
  actions: Action[] = []

  add(source: InputSource) {
    this.sources.push(source);
    return source;
  }


  collect() {
    this.actions.length = 0
    for (const source of this.sources) {
      source.poll();

      for (const action of source.queue) {
        this.actions.push(action);
      }

      source.queue.length = 0
    }
  }


  dispose() {
    for (const source of this.sources) {
      source.dispose();
    }
  }
}