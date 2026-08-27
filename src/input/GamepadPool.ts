// src/input/GamepadPool.ts
// TODO: rename?
import type { WebGLRenderer } from 'three';
import { InputProcessor } from './InputProcessor';
import { GamepadSource } from './GamepadSource';
import { isXRGamepad } from './XRGamepadUtils';

// Desktop/couch-multiplayer: however many pads show up, no XR session required. 
// Gamepads tied to an active XR session are excluded from this
// API by default, so this is a genuinely separate pool from the controllers —
// #add() double-checks that exclusion itself (see isXRGamepad) rather than
// trusting every browser/emulator to honour it.
export class GamepadPool {
  #processor: InputProcessor;
  #renderer: WebGLRenderer;
  #pads = new Map<number, GamepadSource>();
  #listeners: ((pad: GamepadSource) => void)[] = [];

  constructor(processor: InputProcessor, renderer: WebGLRenderer) {
    this.#processor = processor;
    this.#renderer = renderer;
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
    if (isXRGamepad(this.#renderer, gamepad)) { return; } // same trigger already bound via xrLeft/xrRight's native 'select' event

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