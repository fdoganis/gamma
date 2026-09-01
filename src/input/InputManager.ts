import type { WebGLRenderer, Scene, PerspectiveCamera, Object3D } from 'three';
import { InputProcessor } from './InputProcessor';
import { SpatialInputSource } from './SpatialInputSource';
import { HandSource } from './HandSource';
import { KeyboardInputSource } from './KeyboardInputSource';
import { PointerInputSource } from './PointerInputSource';
import { GamepadSource } from './GamepadSource';
import { GamepadPool } from './GamepadPool';


export class InputManager {
  xrLeft: SpatialInputSource;
  xrRight: SpatialInputSource;
  handLeft: HandSource;
  handRight: HandSource;
  gamepadLeft: GamepadSource;
  gamepadRight: GamepadSource;
  gamepadPool: GamepadPool;

  #processor: InputProcessor;

  // `board` is the placed-surface anchor — HandSource needs its height to tell a
  // table whack from a mid-air stop.
  constructor(renderer: WebGLRenderer, scene: Scene, camera: PerspectiveCamera, board: Object3D) {
    this.#processor = new InputProcessor();

    const ctrlL = renderer.xr.getController(0);
    const ctrlR = renderer.xr.getController(1);
    const handL = renderer.xr.getHand(0);
    const handR = renderer.xr.getHand(1);
    scene.add(ctrlL, ctrlR, handL, handR);

    this.xrLeft = new SpatialInputSource(ctrlL);
    this.xrRight = new SpatialInputSource(ctrlR);
    this.handLeft = new HandSource(handL, 'left', board);
    this.handRight = new HandSource(handR, 'right', board);

    this.gamepadLeft = GamepadSource.forXRController(renderer, 'left');
    this.gamepadRight = GamepadSource.forXRController(renderer, 'right');
    this.gamepadPool = new GamepadPool(this.#processor);

    this.#processor.add(this.xrLeft);
    this.#processor.add(this.xrRight);
    this.#processor.add(this.handLeft);
    this.#processor.add(this.handRight);
    this.#processor.add(this.gamepadLeft);
    this.#processor.add(this.gamepadRight);

    if (__DEV__) {
      // Desktop-only fallbacks (mouse aim + keyboard collect). Folds to
      // `if(false)` in prod, so KeyboardInputSource / PointerInputSource
      // tree-shake out of the XR-only build.
      this.#processor.add(new KeyboardInputSource());
      this.#processor.add(new PointerInputSource(renderer, camera));
    }
  }

  get commands() { return this.#processor.commands; }
  collect() { this.#processor.collect(); }
  dispose() { this.#processor.dispose(); this.gamepadPool.dispose(); }
}