import { State } from '../core/State';
import type { ITransition } from '../core/StateMachine';
import type { ITransform } from '../types/ITransform';
import type { ClassOf } from '../types/ClassOf';
import type { TextManager } from '../text/TextManager';
import type { TextHandle } from '../text/ITextEngine';
import { SelectCommand } from '../commands/SelectCommand';
import { IntroState } from './IntroState';
import type { Score } from '../core/Score';
import type { Level } from '../core/Level';
import { LEVEL_COUNT } from '../core/levels';
import type { AudioManager } from '../audio/AudioManager';

// Between-levels screen. Reached when every rainbow color is complete before the
// timer runs out (RunState has already advanced the Level). Tap → next level, or
// → Intro once level 7 is cleared. (The full "rainbow over the freed unicorn"
// finale is still §5.3 / §6.)
export class WinState extends State {
  #sm: ITransition;
  #text: TextManager;
  #score: Score;
  #level: Level;
  #resume: ClassOf<State>; // RunState, injected to avoid an import cycle
  #audio: AudioManager;
  #message: TextHandle;

  constructor(sm: ITransition, text: TextManager, hudAnchor: ITransform, score: Score, level: Level, resume: ClassOf<State>, audio: AudioManager) {
    super();
    this.#sm = sm;
    this.#text = text;
    this.#score = score;
    this.#level = level;
    this.#resume = resume;
    this.#audio = audio;
    this.#message = text.show('YOU WIN', hudAnchor, { color: '#00ff88', visible: false });
    this.#registerHandlers();
  }

  #registerHandlers() {
    this.on(SelectCommand, this.#onSelect);
  }

  #onSelect = () => {
    this.#sm.change(this.#level.value <= LEVEL_COUNT ? this.#resume : IntroState);
  };

  override enter() {
    this.#audio.activate(); // RunState.exit() deactivated it; the sting needs it back
    this.#audio.playSFX('win');
    const more = this.#level.value <= LEVEL_COUNT;
    this.#text.setText(this.#message, more ? `LEVEL ${this.#level.value}` : `YOU WIN  ${this.#score.value}`);
    this.#text.setVisible(this.#message, true);
  }
  override exit() {
    this.#audio.deactivate();
    this.#text.setVisible(this.#message, false);
  }
}
