import { InputProcessor } from './InputProcessor';
import { SpatialInputSource } from './SpatialInputSource';
import { HandSource } from './HandSource';
import { KeyboardInputSource } from './KeyboardInputSource';
import { PointerInputSource } from './PointerInputSource';
import { GamepadInputSource } from './GamepadInputSource';
import type { IXRNode, IXRHandNode } from '../types/XRTypes';

import type {
  WebGLRenderer,
  Scene,
  PerspectiveCamera
} from 'three';

export class InputManager {

  // These are exposed to be bound, see Game#bindInput() for example
  xrLeft: SpatialInputSource;
  xrRight: SpatialInputSource;
  handLeft: HandSource;
  handRight: HandSource;
  arScreen: SpatialInputSource; // mobile AR screen tap

  #processor: InputProcessor;

  constructor(renderer: WebGLRenderer, scene: Scene, camera: PerspectiveCamera) {
    this.#processor = new InputProcessor();

    const ctrlL = renderer.xr.getController(0);
    const ctrlR = renderer.xr.getController(1);
    const handL = renderer.xr.getHand(0);
    const handR = renderer.xr.getHand(1);
    scene.add(ctrlL);
    scene.add(ctrlR);
    scene.add(handL);
    scene.add(handR);

    this.xrLeft = new SpatialInputSource(ctrlL as unknown as IXRNode, 'left'); // TODO: ARCHI: QUESTION: Casts?
    this.xrRight = new SpatialInputSource(ctrlR as unknown as IXRNode, 'right');
    this.handLeft = new HandSource(handL as unknown as IXRHandNode, 'left');
    this.handRight = new HandSource(handR as unknown as IXRHandNode, 'right');

    // Screen-tap is seen as a transient input source with handedness 'none'
    // using the same controller 0 slot as xrLeft. 
    this.arScreen = new SpatialInputSource(ctrlL as unknown as IXRNode, 'none');


    // TODO: ARCHI: QUESTION: SpatialInputSource, or a SpatialControllerInputSource should own a Gamepad? 
    // Gamepad should be standalone and exposed so that we can remap the buttons?
    // We should be able to connect as many gamepads as possible (Desktop mode / couch multiplayer)
    const keyboard = new KeyboardInputSource();
    const pointer = new PointerInputSource(renderer, camera);
    const gamepadLeft = new GamepadInputSource(renderer.xr, ctrlL as unknown as IXRNode, 'left');
    const gamepadRight = new GamepadInputSource(renderer.xr, ctrlR as unknown as IXRNode, 'right');


    this.#processor.add(this.xrLeft); // TODO: ARCHI: QUESTION: Game responsibility?
    this.#processor.add(this.xrRight);
    this.#processor.add(this.handLeft);
    this.#processor.add(this.handRight);
    // Sources self-manage via 'connected'/'disconnected', no session wiring needed
    this.#processor.add(this.arScreen);
    this.#processor.add(keyboard);
    this.#processor.add(pointer);
    this.#processor.add(gamepadLeft);
    this.#processor.add(gamepadRight);
  }

  // Needed by GameLoop.processInput()
  get commands() { return this.#processor.commands; }

  collect() { this.#processor.collect(); }

  dispose() { this.#processor.dispose(); }
}