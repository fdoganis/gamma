// Cumulative game score. Owned by Game, injected into the states that write it
// (RunState) or show it (WinState / GameOverState); IntroState resets it at the
// start of a new game. Carries across rounds until Game Over.
export class Score {
  #value = 0;

  get value(): number { return this.#value; }
  add(n: number): void { this.#value = Math.max(0, this.#value + n); } // n < 0 for the unicorn penalty; never goes negative
  reset(): void { this.#value = 0; }
}
