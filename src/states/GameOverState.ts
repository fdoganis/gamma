import { State } from '../core/State';
import type { ITransition } from '../core/StateMachine';
import type { ITransform } from '../types/ITransform';
import type { TextManager } from '../text/TextManager';
import type { TextHandle } from '../text/ITextEngine';
import { SelectCommand } from '../commands/SelectCommand';
import { GameIntroState } from './GameIntroState';


export class GameOverState extends State {
  #sm: ITransition;
  #text: TextManager;
  #message: TextHandle;

  constructor(sm: ITransition, text: TextManager, hudAnchor: ITransform) {
    super();
    this.#sm = sm;

    this.#text = text;
    this.#message = text.show('GAME OVER', hudAnchor, { color: '#ff3333', visible: false });
    this.#registerHandlers();

  }

  #registerHandlers() {
    this.on(SelectCommand, this.#onSelect);
  }

  #onSelect = () => { this.#sm.change(GameIntroState); };

  override enter() { this.#text.setVisible(this.#message, true); }
  override exit() { this.#text.setVisible(this.#message, false); } // TODO: QUESTION: LIFECYCLE: who cleans the cones?
}