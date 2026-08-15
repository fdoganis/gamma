import type { WebGLRenderer, Scene, PerspectiveCamera } from 'three';
import { InputProcessor } from './InputProcessor';
import { SpatialInputSource } from './SpatialInputSource';
import { KeyboardInputSource } from './KeyboardInputSource';
import { PointerInputSource } from './PointerInputSource';
import { GamepadSource } from './GamepadSource';
import { GamepadPool } from './GamepadPool';
//import { findXRGamepad } from './XRGamepadUtils';


export class InputManager {
  xrLeft: SpatialInputSource;
  xrRight: SpatialInputSource;
  handLeft: SpatialInputSource;
  handRight: SpatialInputSource;
  gamepadLeft: GamepadSource;
  gamepadRight: GamepadSource;
  gamepadPool: GamepadPool;

  #processor: InputProcessor;

  constructor(renderer: WebGLRenderer, scene: Scene, camera: PerspectiveCamera) {
    this.#processor = new InputProcessor();

    const ctrlL = renderer.xr.getController(0);
    const ctrlR = renderer.xr.getController(1);
    const handL = renderer.xr.getHand(0);
    const handR = renderer.xr.getHand(1);
    scene.add(ctrlL, ctrlR, handL, handR);

    this.xrLeft = new SpatialInputSource(ctrlL);
    this.xrRight = new SpatialInputSource(ctrlR);
    this.handLeft = new SpatialInputSource(handL);
    this.handRight = new SpatialInputSource(handR);

    this.gamepadLeft = GamepadSource.forXRController(renderer, 'left');
    this.gamepadRight = GamepadSource.forXRController(renderer, 'right');
    this.gamepadPool = new GamepadPool(this.#processor);

    const keyboard = new KeyboardInputSource();
    const pointer = new PointerInputSource(renderer, camera);

    this.#processor.add(this.xrLeft);
    this.#processor.add(this.xrRight);
    this.#processor.add(this.handLeft);
    this.#processor.add(this.handRight);
    this.#processor.add(this.gamepadLeft);
    this.#processor.add(this.gamepadRight);
    this.#processor.add(keyboard);
    this.#processor.add(pointer);
  }

  get commands() { return this.#processor.commands; }
  collect() { this.#processor.collect(); }
  dispose() { this.#processor.dispose(); this.gamepadPool.dispose(); }
}