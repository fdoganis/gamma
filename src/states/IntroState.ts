import { State } from '../core/State';
import type { ITransition } from '../core/StateMachine';
import type { ITransform } from '../types/ITransform';
import type { TextManager } from '../text/TextManager';
import type { TextHandle } from '../text/ITextEngine';
import { SelectCommand } from '../commands/SelectCommand';
import { AnchorState } from './AnchorState';
import type { Score } from '../core/Score';
import type { Level } from '../core/Level';

export class IntroState extends State {
  #sm: ITransition;
  #text: TextManager;
  #score: Score;
  #level: Level;
  #message: TextHandle;

  constructor(sm: ITransition, text: TextManager, hudAnchor: ITransform, score: Score, level: Level) {
    super();
    this.#sm = sm;
    this.#text = text;
    this.#score = score;
    this.#level = level;
    this.#message = text.show('TAP TO START', hudAnchor, { color: '#ffffff', visible: false });
    this.#registerHandlers();
  }

  #registerHandlers() {
    // "select in intro" = start the game
    // cmd unused -> intro doesn't care where the select came from
    this.on(SelectCommand, this.#onSelect);
  }

  #onSelect = () => {
    this.#score.reset(); // new game
    this.#level.reset();
    this.#sm.change(AnchorState);
  };

  override enter() { this.#text.setVisible(this.#message, true); }
  override exit() { this.#text.setVisible(this.#message, false); }
}