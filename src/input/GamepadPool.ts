// TODO: rename?
import { InputProcessor } from './InputProcessor';
import { GamepadSource } from './GamepadSource';

// Desktop/couch-multiplayer: however many pads show up, no XR session required. 
// Gamepads tied to an active XR session are excluded from this
// API by default, so this is a genuinely separate pool from the controllers.
export class GamepadPool {
  #processor: InputProcessor;
  #pads = new Map<number, GamepadSource>();
  #listeners: ((pad: GamepadSource) => void)[] = [];

  constructor(processor: InputProcessor) {
    this.#processor = processor;
    window.addEventListener('gamepadconnected', this.#onConnected);
    window.addEventListener('gamepaddisconnected', this.#onDisconnected);
    // Chrome issues with gamepadconnected for pads that were already on before the page loaded
    for (const pad of navigator.getGamepads()) if (pad) this.#add(pad);
  }

  // Called once per pad, for any already connected, and for each future connection. 
  // Configure buttons here.
  onConnect(listener: (pad: GamepadSource) => void): void {
    this.#listeners.push(listener);
    for (const pad of this.#pads.values()) listener(pad);
  }

  #add(gamepad: Gamepad) {
    if (this.#pads.has(gamepad.index)) { return; }

    const source = GamepadSource.forDesktopPad(gamepad.index);
    this.#pads.set(gamepad.index, source);
    this.#processor.add(source);
  }

  #onConnected = (e: GamepadEvent) => this.#add(e.gamepad);
  #onDisconnected = (e: GamepadEvent) => {
    const source = this.#pads.get(e.gamepad.index);
    if (source) { this.#processor.remove(source); }
    this.#pads.delete(e.gamepad.index);
  };

  dispose() {
    window.removeEventListener('gamepadconnected', this.#onConnected);
    window.removeEventListener('gamepaddisconnected', this.#onDisconnected);
  }
}