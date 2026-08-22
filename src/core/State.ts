// core/State.ts
import type { Command } from './Command';
import type { ClassOf } from '../types/ClassOf';

export abstract class State {
  #handlers = new Map<ClassOf<Command>, (cmd: Command) => void>();

  // Cmd is already ClassOf<Command> compatible,
  // no cast needed at registration
  protected on<T extends Command>(
    Cmd: ClassOf<T>,
    fn: (cmd: T) => void
  ) {
    this.#handlers.set(Cmd, fn as (cmd: Command) => void);
  }

  handle(cmd: Command) {
    // The one unavoidable cast: lib.d.ts types Object#constructor as bare
    // Function. Safe because the map is only ever populated for the exact
    // class each handler was registered under.
    this.#handlers.get(cmd.constructor as ClassOf<Command>)?.(cmd);
  }

  enter() { }

  update(_delta: number, _frame?: XRFrame) { }

  exit() { }
}