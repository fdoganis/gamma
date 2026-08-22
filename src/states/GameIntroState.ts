import { State } from '../core/State';
import type { ITransition } from '../core/StateMachine';
import { SelectCommand } from '../commands/SelectCommand';
import { GamePlacingState } from './GamePlacingState';
import { createOverlay } from '../core/Utils';

export class GameIntroState extends State {
  #sm: ITransition;
  #message = createOverlay('Tap to start');

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
    this.#sm.change(GamePlacingState);
  };

  override enter() { this.#message.style.display = 'grid'; }

  override exit() { this.#message.style.display = 'none'; }

}