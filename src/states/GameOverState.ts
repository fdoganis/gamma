import { State } from '../core/State';
import type { ITransition } from '../core/StateMachine';
import { SelectCommand } from '../commands/SelectCommand';
import { GameIntroState } from './GameIntroState';
import { createOverlay } from '../core/Utils';

export class GameOverState extends State {
  #sm: ITransition;
  #message = createOverlay('Game over - tap to restart');

  constructor(sm: ITransition) {
    super();
    this.#sm = sm;
    this.#registerHandlers();
  }

  #registerHandlers() {
    this.on(SelectCommand, this.#onSelect);
  }

  #onSelect = () => { this.#sm.change(GameIntroState); };

  override enter() { this.#message.style.display = 'grid'; }

  override exit() { this.#message.style.display = 'none'; }
}