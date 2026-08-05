import { InputSource } from "./InputSource"
import { Action } from "./Action"
export class KeyboardInputSource extends InputSource {
  _bindings: Map<string, Action> = new Map();

  constructor() {
    super()

    window.addEventListener('keydown', this._onKeyDown)
  }

  bind(code: string /** @type KeyboardEvent.code */, action: Action) {
    this._bindings.set(code, action);
  }

  _onKeyDown = (e: KeyboardEvent) => {
    if (!this.enabled || e.repeat) { return; }

    const action = this._bindings.get(e.code);
    if (action) {
      this.queue.push(action);
    }
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
  }
}