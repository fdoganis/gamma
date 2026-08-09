import { State } from '../core/State'
import { SelectCommand } from '../commands/SelectCommand';
import type { World } from '../world/World';
import type { AudioManager } from '../audio/AudioManager';

export class GameRunningState extends State {
  #world: World;
  #audio: AudioManager;

  constructor(world: World, audio: AudioManager) {
    super();
    this.#world = world;
    this.#audio = audio;
    this.#registerHandlers();
  }

  #registerHandlers() {
    this.on(SelectCommand, this.#onSelect);
  }

  #onSelect = (cmd: SelectCommand) => {
    this.#world.spawn(cmd.transform);
    this.#audio.play('spawn');
  };

  override enter() { this.#audio.activate(); }

  override exit() { this.#audio.deactivate(); }
}

