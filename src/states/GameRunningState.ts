import { State } from '../core/State';
import { SelectCommand } from '../commands/SelectCommand';
import type { World } from '../world/World';
import type { AudioManager } from '../audio/AudioManager';
import type { HapticsManager } from '../haptics/HapticsManager';

export class GameRunningState extends State {
  #world: World;
  #audio: AudioManager;
  #haptics: HapticsManager;

  constructor(world: World, audio: AudioManager, haptics: HapticsManager) {
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
    this.#world.spawn(cmd.transform);
    this.#audio.play('spawn'); // still a no-op until a real clip is loaded
    this.#audio.tone();        // audible feedback with zero assets
    this.#haptics.pulse(cmd.handedness);
  };

  override enter() { this.#audio.activate(); }
  override exit() { this.#audio.deactivate(); }
}