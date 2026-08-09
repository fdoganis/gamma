import { InputProcessor } from './InputProcessor';
import { SpatialInputSource } from './SpatialInputSource';
import { HandSource } from './HandSource';
import type { IXRNode, IXRHandNode } from '../types/XRTypes';

import type {
  WebGLRenderer,
  Scene
} from 'three';

export class InputManager {
  // Typed references retained here for binding in Game.
  // InputProcessor only ever sees the InputSource base type, no cast needed.
  // Creation (typed) is different from registration (base type).
  xrLeft: SpatialInputSource;
  xrRight: SpatialInputSource;
  handLeft: HandSource;
  handRight: HandSource;

  #processor: InputProcessor;

  constructor(renderer: WebGLRenderer, scene: Scene) {
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

    this.#processor.add(this.xrLeft); // TODO: ARCHI: QUESTION: Game repsonsibility?
    this.#processor.add(this.xrRight);
    this.#processor.add(this.handLeft);
    this.#processor.add(this.handRight);
    // Sources self-manage via 'connected'/'disconnected', no session wiring needed
  }

  get commands() { return this.#processor.commands; }

  collect() { this.#processor.collect(); }

  dispose() { this.#processor.dispose(); }
}