import type { ITransform } from '../types/ITransform';

import type { ITextEngine, TextHandle, TextStyle } from './ITextEngine'

export class TextManager {
  #engine: ITextEngine;
  #labels = new Map<TextHandle, ITransform | undefined>();

  constructor(engine: ITextEngine) { this.#engine = engine; }

  // TODO: QUESTION: used? rename?
  show(text: string, anchor?: ITransform, style?: TextStyle): TextHandle {
    const handle = this.#engine.create(text, anchor, style);
    this.#labels.set(handle, anchor);
    return handle;
  }

  setText(handle: TextHandle, text: string) { this.#engine.setText(handle, text); }

  setVisible(handle: TextHandle, visible: boolean) { this.#engine.setVisible?.(handle, visible); }


  remove(handle: TextHandle) {
    this.#engine.destroy(handle);
    this.#labels.delete(handle);
  }

  update(_delta: number) {
    for (const [handle, anchor] of this.#labels)
      if (anchor) this.#engine.sync?.(handle, anchor);
  }

  // TODO: QUESTION: remove vs dispose? confusing API
  dispose() {
    for (const handle of this.#labels.keys()) this.#engine.destroy(handle);
    this.#labels.clear();
    this.#engine.dispose?.();
  }
}