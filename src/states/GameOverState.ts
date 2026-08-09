import { State } from '../core/State';
import type { ITransition } from '../core/StateMachine';
import { SelectCommand } from '../commands/SelectCommand';
import { GameIntroState } from './GameIntroState';

export class GameOverState extends State {
  #sm: ITransition;

  constructor(sm: ITransition) {
    super();
    this.#sm = sm;
    this.#registerHandlers();
  }

  #registerHandlers(): void {
    this.on(SelectCommand, this.#onSelect);
  }

  #onSelect = () => { this.#sm.change(GameIntroState); };

  override enter() { /* show game over UI */ }

  override exit() { /* hide game over UI */ }
}