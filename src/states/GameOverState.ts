import { State } from '../core/State';
import type { ITransition } from '../core/StateMachine';
import type { ITransform } from '../types/ITransform';
import type { TextManager } from '../text/TextManager';
import type { TextHandle } from '../text/ITextEngine';
import { SelectCommand } from '../commands/SelectCommand';
import { IntroState } from './IntroState';
import type { Score } from '../core/Score';


export class GameOverState extends State {
  #sm: ITransition;
  #text: TextManager;
  #score: Score;
  #message: TextHandle;

  constructor(sm: ITransition, text: TextManager, hudAnchor: ITransform, score: Score) {
    super();
    this.#sm = sm;
    this.#text = text;
    this.#score = score;
    this.#message = text.show('GAME OVER', hudAnchor, { color: '#ff3333', visible: false });
    this.#registerHandlers();
  }

  #registerHandlers() {
    this.on(SelectCommand, this.#onSelect);
  }

  #onSelect = () => { this.#sm.change(IntroState); };

  override enter() {
    this.#text.setText(this.#message, `GAME OVER  ${this.#score.value}`);
    this.#text.setVisible(this.#message, true);
  }
  override exit() { this.#text.setVisible(this.#message, false); }
}