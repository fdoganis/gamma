import { State } from '../core/State';
import type { ITransition } from '../core/StateMachine';
import type { ITransform } from '../types/ITransform';
import type { TextManager } from '../text/TextManager';
import type { TextHandle } from '../text/ITextEngine';
import { SelectCommand } from '../commands/SelectCommand';
import { IntroState } from './IntroState';

// Reached when all 7 rainbow colors are collected before the timer runs out.
// Placeholder for the "rainbow arc over the unicorn, unicorn freed, next level"
// sequence (see GNOMES.md §5.3 / §6).
export class WinState extends State {
  #sm: ITransition;
  #text: TextManager;
  #message: TextHandle;

  constructor(sm: ITransition, text: TextManager, hudAnchor: ITransform) {
    super();
    this.#sm = sm;
    this.#text = text;
    this.#message = text.show('YOU WIN', hudAnchor, { color: '#00ff88', visible: false });
    this.#registerHandlers();
  }

  #registerHandlers() {
    this.on(SelectCommand, this.#onSelect);
  }

  #onSelect = () => { this.#sm.change(IntroState); };

  override enter() { this.#text.setVisible(this.#message, true); }
  override exit() { this.#text.setVisible(this.#message, false); }
}
