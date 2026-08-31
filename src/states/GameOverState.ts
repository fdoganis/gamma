import { State } from '../core/State';
import type { ITransition } from '../core/StateMachine';
import type { ITransform } from '../types/ITransform';
import type { TextManager } from '../text/TextManager';
import type { TextHandle } from '../text/ITextEngine';
import { SelectCommand } from '../commands/SelectCommand';
import { IntroState } from './IntroState';
import type { Score } from '../core/Score';
import type { AudioManager } from '../audio/AudioManager';


export class GameOverState extends State {
  #sm: ITransition;
  #text: TextManager;
  #score: Score;
  #audio: AudioManager;
  #message: TextHandle;

  constructor(sm: ITransition, text: TextManager, hudAnchor: ITransform, score: Score, audio: AudioManager) {
    super();
    this.#sm = sm;
    this.#text = text;
    this.#score = score;
    this.#audio = audio;
    this.#message = text.show('GAME OVER', hudAnchor, { color: '#ff3333', visible: false });
    this.#registerHandlers();
  }

  #registerHandlers() {
    this.on(SelectCommand, this.#onSelect);
  }

  #onSelect = () => { this.#sm.change(IntroState); };

  override enter() {
    this.#audio.activate(); // RunState.exit() deactivated it; the sting needs it back
    this.#audio.playSFX('over');
    this.#text.setText(this.#message, `GAME OVER  ${this.#score.value}`);
    this.#text.setVisible(this.#message, true);
  }
  override exit() {
    this.#audio.deactivate();
    this.#text.setVisible(this.#message, false);
  }
}