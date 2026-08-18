
import { State } from '../core/State';
import { SelectCommand } from '../commands/SelectCommand';
import type { World } from '../world/World';
import type { AudioManager } from '../audio/AudioManager';
import type { Haptics } from '../input/XRGamepadUtils';

export class GameRunningState extends State {
  #world: World;
  #audio: AudioManager;
  #haptics: Haptics;

  constructor(world: World, audio: AudioManager, haptics: Haptics) {
    super();
    this.#world = world;
    this.#audio = audio;
    this.#haptics = haptics;
    this.#registerHandlers();
  }

  #registerHandlers() {
    this.on(SelectCommand, this.#onSelect);
  }

  #onSelect = (cmd: SelectCommand) => {
    const { mesh, color } = this.#world.spawn(cmd.transform);
    this.#audio.playSFX('spawn', mesh); // positional
    this.#world.burstSparkles(mesh.position, color);
    this.#haptics.pulse(cmd.handedness);
  };

  override update(delta: number) {
    this.#world.update(delta);
  }

  override enter() { this.#audio.activate(); }
  override exit() { this.#audio.deactivate(); }
}
