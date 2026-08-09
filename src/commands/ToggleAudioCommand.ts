import { Command } from '../core/Command';
import { AudioManager } from '../audio/AudioManager';

export class ToggleAudioCommand extends Command {
  #audio!: AudioManager

  constructor(audio: AudioManager) {
    super();
    this.#audio = audio;
  }

  execute() { this.#audio.toggle() }
}