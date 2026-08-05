import type { Action } from "./Action";

export class InputSource {
  enabled: boolean = true;
  queue: Action[] = [] // queue containing the actions to execute, will be processed by InputManager

  bind(code: string, action: Action) { };

  poll() { } // needed for non event-based implementations
  dispose() { }
}