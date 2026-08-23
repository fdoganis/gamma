
import { State } from '../core/State';
import { SelectCommand } from '../commands/SelectCommand';
import type { World } from '../world/World';
import type { AudioManager } from '../audio/AudioManager';
import type { Haptics } from '../input/XRGamepadUtils';
import type { ITransition } from '../core/StateMachine';
import { GameOverState } from './GameOverState';
import type { TextManager } from '../text/TextManager';

const ROUND_SECONDS = 45;

export class GameRunningState extends State {
  #world: World;
  #audio: AudioManager;
  #haptics: Haptics;
  #transition: ITransition;
  #text: TextManager;
  #timeLeft = ROUND_SECONDS;

  constructor(world: World, audio: AudioManager, haptics: Haptics, transition: ITransition, text: TextManager) {
    super();
    this.#world = world;
    this.#audio = audio;
    this.#haptics = haptics;
    this.#transition = transition;
    this.#text = text;
    this.#registerHandlers();
  }

  #registerHandlers() {
    this.on(SelectCommand, this.#onSelect);
  }

  #onSelect = (cmd: SelectCommand) => {
    const { mesh, color } = this.#world.spawn(cmd.transform);
    const hex = `#${color.getHexString()}`;
    this.#text.show(hex, mesh, { color: hex }); // label reads its own colour
    this.#audio.playSFX('spawn', mesh); // positional
    this.#world.burstSparkles(mesh.position, color);
    this.#haptics.pulse(cmd.handedness);
  };

  override update(delta: number) {
    this.#world.update(delta);
    this.#text.update(delta);

    this.#timeLeft -= delta;
    if (this.#timeLeft <= 0) {
      this.#transition.change(GameOverState);
    }
  }

  override enter() {
    this.#timeLeft = ROUND_SECONDS;
    this.#audio.activate();
  }
  override exit() {
    this.#audio.deactivate();
  }
}
