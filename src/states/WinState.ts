import { State } from '../core/State';
import type { ITransition } from '../core/StateMachine';
import type { ITransform } from '../types/ITransform';
import type { ClassOf } from '../types/ClassOf';
import type { TextManager } from '../text/TextManager';
import type { TextHandle } from '../text/ITextEngine';
import { SelectCommand } from '../commands/SelectCommand';
import { IntroState } from './IntroState';
import { NameEntryState } from './NameEntryState';
import type { Score } from '../core/Score';
import type { Level } from '../core/Level';
import type { HiScore } from '../core/HiScore';
import { LEVEL_COUNT, l13Unlocked } from '../core/levels';
import type { AudioManager } from '../audio/AudioManager';

// Between-levels screen. Reached when every rainbow color is complete before the
// timer runs out (RunState has already advanced the Level). Tap → next level;
// after level 7 → the hidden L13 if unlocked, else name entry / Intro; after
// L13 → "RAINBOW RESTORED" → Intro. (The full wordless finale is still §5.3/§6.)
export class WinState extends State {
  #sm: ITransition;
  #text: TextManager;
  #score: Score;
  #level: Level;
  #hi: HiScore;
  #resume: ClassOf<State>; // RunState, injected to avoid an import cycle
  #audio: AudioManager;
  #message: TextHandle;

  constructor(sm: ITransition, text: TextManager, hudAnchor: ITransform, score: Score, level: Level, hi: HiScore, resume: ClassOf<State>, audio: AudioManager) {
    super();
    this.#sm = sm;
    this.#text = text;
    this.#score = score;
    this.#level = level;
    this.#hi = hi;
    this.#resume = resume;
    this.#audio = audio;
    this.#message = text.show('YOU WIN', hudAnchor, { color: '#00ff88', visible: false });
    this.#registerHandlers();
  }

  #registerHandlers() {
    this.on(SelectCommand, this.#onSelect);
  }

  #onSelect = () => {
    const v = this.#level.value;
    if (v <= LEVEL_COUNT) { this.#sm.change(this.#resume); return; }   // 1..7 → next level
    if (v === 13) { this.#sm.change(IntroState); return; }             // L13 cleared
    if (l13Unlocked()) { this.#level.set(13); this.#sm.change(this.#resume); return; } // cleared L7, L13 available
    this.#sm.change(this.#hi.beaten(this.#score.value) ? NameEntryState : IntroState);
  };

  override enter() {
    this.#audio.activate(); // RunState.exit() deactivated it; the sting needs it back
    this.#audio.playSFX('win');
    const v = this.#level.value;
    const msg =
      v <= LEVEL_COUNT ? `LEVEL ${v}` :
      v === 13 ? `RAINBOW RESTORED  ${this.#score.value}` :
      l13Unlocked() ? 'LEVEL 13' :
      `YOU WIN  ${this.#score.value}`;
    this.#text.setText(this.#message, msg);
    this.#text.setVisible(this.#message, true);
  }
  override exit() {
    this.#audio.deactivate();
    this.#text.setVisible(this.#message, false);
  }
}
