// states/GameRunningState.ts — haptics field dropped, fires at bind time now
// TODO: FIXME: CHECK
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

  // Every effect lives here, one line each, all driven by cmd — nothing
  // upstream needed to know haptics was even a thing.
  #onSelect = (cmd: SelectCommand) => {
    const { position, color } = this.#world.spawn(cmd.transform);
    this.#audio.play('spawn', position);
    this.#sparkles?.burst(position, color);
    this.#haptics?.pulse(cmd.handedness);
  };

  override update(delta: number) {
    this.#world.update(delta);
    this.#sparkles?.update(delta);
  }

  override enter() { this.#audio.activate(); }

  override exit() { this.#audio.deactivate(); }
}