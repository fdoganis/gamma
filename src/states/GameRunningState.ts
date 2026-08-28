import { State } from '../core/State';
import { SelectCommand } from '../commands/SelectCommand';
import type { World } from '../world/World';
import type { AudioManager } from '../audio/AudioManager';
import type { Haptics } from '../input/XRGamepadUtils';
import type { ITransition } from '../core/StateMachine';
import type { ITransform } from '../types/ITransform';
import { GameOverState } from './GameOverState';
import type { TextManager } from '../text/TextManager';
import type { TextHandle } from '../text/ITextEngine';

const ROUND_SECONDS = 45;

export class GameRunningState extends State {
  #world: World;
  #audio: AudioManager;
  #haptics: Haptics;
  #transition: ITransition;
  #text: TextManager;
  #timerAnchor: ITransform;
  #timeLeft = ROUND_SECONDS;
  #labels: TextHandle[] = [];
  #timerLabel: TextHandle | null = null;
  #lastShownSecond = -1;

  constructor(world: World, audio: AudioManager, haptics: Haptics, transition: ITransition, text: TextManager, timerAnchor: ITransform) {
    super();
    this.#world = world;
    this.#audio = audio;
    this.#haptics = haptics;
    this.#transition = transition;
    this.#text = text;
    this.#timerAnchor = timerAnchor;
    this.#registerHandlers();
  }

  #registerHandlers() {
    this.on(SelectCommand, this.#onSelect);
  }

  #onSelect = (cmd: SelectCommand) => {
    const { mesh, color } = this.#world.spawn();
    const hex = `#${color.getHexString()}`;
    this.#labels.push(this.#text.show(hex, mesh, { color: hex })); // label reads its own colour
    //   this.#audio.playSFX('spawn', mesh); // positional // TODO: QUESTION: why has this been removed?
    this.#world.burstSparkles(mesh.position, color);
    this.#haptics.pulse(cmd.handedness);
  };

  override update(delta: number) {
    this.#world.update(delta);

    this.#timeLeft -= delta;
    const seconds = Math.max(0, Math.ceil(this.#timeLeft));
    if (seconds !== this.#lastShownSecond) {
      this.#lastShownSecond = seconds;
      this.#text.setText(this.#timerLabel!, String(seconds));
    }

    if (this.#timeLeft <= 0) {
      this.#transition.change(GameOverState);
    }
  }

  override enter() {
    this.#timeLeft = ROUND_SECONDS;
    this.#lastShownSecond = -1;
    this.#timerLabel = this.#text.show(String(ROUND_SECONDS), this.#timerAnchor, { color: '#ffffff' });
    this.#audio.activate();
  }
  override exit() {
    this.#audio.deactivate();
    if (this.#timerLabel) { this.#text.remove(this.#timerLabel); this.#timerLabel = null; }
    for (const h of this.#labels) this.#text.remove(h); // else every round leaks the pool
    this.#labels.length = 0;
  }
}
