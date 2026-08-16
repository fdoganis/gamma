
import { State } from '../core/State';
import { SelectCommand } from '../commands/SelectCommand';
import type { World } from '../world/World';
import type { AudioManager } from '../audio/AudioManager';
import type { Sparkles } from '../animation/Sparkles';
import type { Haptics } from '../input/XRGamepadUtils';

export class GameRunningState extends State {
  #world: World;
  #audio: AudioManager;
  #sparkles: Sparkles;
  #haptics: Haptics;

  constructor(world: World, audio: AudioManager, sparkles: Sparkles, haptics: Haptics) {
    super();
    this.#world = world;
    this.#audio = audio;
    this.#sparkles = sparkles;
    this.#haptics = haptics;
    this.#registerHandlers();
  }

  #registerHandlers() {
    this.on(SelectCommand, this.#onSelect);
  }

  #onSelect = (cmd: SelectCommand) => {
    const { mesh, color } = this.#world.spawn(cmd.transform);
    this.#audio.playSFX('spawn', mesh); // positional
    this.#sparkles.burst(mesh.position, color);
    this.#haptics.pulse(cmd.handedness);
  };

  override update(delta: number) {
    this.#world.update(delta);
    this.#sparkles.update(delta);
  }

  override enter() { this.#audio.activate(); }
  override exit() { this.#audio.deactivate(); }
}
