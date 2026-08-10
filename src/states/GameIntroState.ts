import { State } from '../core/State';
import type { ITransition } from '../core/StateMachine';
import { SelectCommand } from '../commands/SelectCommand';
import { GameRunningState } from './GameRunningState';

export class GameIntroState extends State {
  #sm: ITransition;

  constructor(sm: ITransition) {
    super();
    this.#sm = sm;
    this.#registerHandlers();
  }

  #registerHandlers() {
    // "select in intro" = start the game
    // cmd unused -> intro doesn't care where the select came from
    this.on(SelectCommand, this.#onSelect);
  }

  #onSelect = () => {
    this.#sm.change(GameRunningState);
  };

  override enter() { /* show intro UI */ }

  override exit() { /* hide intro UI */ }
}