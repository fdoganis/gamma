import { State } from '../core/State';
import type { ITransition } from '../core/StateMachine';
import type { ITransform } from '../types/ITransform';
import type { TextManager } from '../text/TextManager';
import type { TextHandle } from '../text/ITextEngine';
import { SelectCommand } from '../commands/SelectCommand';
import { GamePlacingState } from './GamePlacingState';

export class GameIntroState extends State {
  #sm: ITransition;
  #text: TextManager;
  #message: TextHandle;

  constructor(sm: ITransition, text: TextManager, hudAnchor: ITransform) {
    super();
    this.#sm = sm;

    this.#text = text;
    this.#message = text.show('TAP TO START', hudAnchor, { color: '#ffffff' });
    this.#text.setVisible(this.#message, false);
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

  override enter() { this.#text.setVisible(this.#message, true); }
  override exit() { this.#text.setVisible(this.#message, false); }
}