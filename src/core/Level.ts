// Current level, 1-based. Owned by Game, injected into RunState (reads it and
// configures the round), WinState (advances it, shows it), IntroState (resets it
// at the start of a new game). Mirrors Score.
export class Level {
  #value = 1;
  get value(): number { return this.#value; }
  advance(): void { this.#value += 1; }
  reset(): void { this.#value = 1; }
}
