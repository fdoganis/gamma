// Game.ts
import { GameLoop } from './GameLoop';
import { StateMachine } from './StateMachine';
import { RenderingManager } from '../rendering/RenderingManager';
import { InputManager } from '../input/InputManager';
import { AudioManager } from '../audio/AudioManager';

import { OscillatorSoundEngine } from '../audio/OscillatorSoundEngine';

import { World } from '../world/World';
import { SelectCommand } from '../commands/SelectCommand';
import { GameIntroState } from '../states/GameIntroState';
import { GameRunningState } from '../states/GameRunningState';
import { GameOverState } from '../states/GameOverState';
//import { pulseXRController } from '../input/XRGamepadUtils';
import { randomTransform } from '../core/Utils';
import { Haptics } from '../input/XRGamepadUtils';
import { GamePlacingState } from '../states/GamePlacingState';
import { TextManager } from '../text/TextManager';
import { VoxelTextEngine } from '../text/engines/voxel/VoxelTextEngine';

export class Game {
  #render: RenderingManager;
  #input: InputManager;
  #audio: AudioManager;
  #world: World;
  #text: TextManager
  #sm: StateMachine;
  #haptics: Haptics;


  constructor() {
    this.#render = new RenderingManager();
    this.#world = new World(this.#render.anchor);
    this.#audio = new AudioManager(this.#render.camera, new OscillatorSoundEngine()); // or: new ZzfxSoundEngine() 
    this.#haptics = new Haptics(this.#render.renderer);
    this.#input = new InputManager(this.#render.renderer, this.#render.scene, this.#render.camera);
    this.#text = new TextManager(new VoxelTextEngine(this.#render.scene, this.#render.camera));

    this.#sm = this.#buildStateMachine();


    this.#bindInput();
  }

  // GameIntroState / GameOverState 
  // NOTE: Starting in Intro means the first tap changes state instead of spawning a cone.
  #buildStateMachine(): StateMachine {
    const sm = new StateMachine();
    sm.register(GameIntroState, new GameIntroState(sm, this.#text, this.#render.hudAnchor));
    sm.register(GamePlacingState, new GamePlacingState(this.#render, sm));
    sm.register(GameRunningState, new GameRunningState(this.#world, this.#audio, this.#haptics, sm, this.#text));
    sm.register(GameOverState, new GameOverState(sm, this.#text, this.#render.hudAnchor));
    sm.start(GameIntroState);
    return sm;
  }

  #bindInput(): void {
    const { xrLeft, xrRight, handLeft, handRight, gamepadLeft, gamepadRight, gamepadPool } = this.#input;

    xrLeft.bind('select', new SelectCommand(xrLeft.node, 'left'));
    xrRight.bind('select', new SelectCommand(xrRight.node, 'right'));
    handLeft.bind('pinchend', new SelectCommand(handLeft.node, 'left'));
    handRight.bind('pinchend', new SelectCommand(handRight.node, 'right'));

    gamepadLeft.bind(3, new SelectCommand(xrLeft.node, 'left'));
    gamepadRight.bind(3, new SelectCommand(xrRight.node, 'right'));

    gamepadPool.onConnect((pad) => pad.bind(0, new SelectCommand(randomTransform())));
  }

  processInput() {
    this.#input.collect();
    for (const cmd of this.#input.commands) this.#sm.dispatch(cmd);
  }

  update(delta: number, frame?: XRFrame) {
    this.#sm.update(delta, frame);
    this.#text.update(delta); // labels are global, not owned by the active state
  }

  render() { this.#render.render(); }

  dispose() {
    this.#render.renderer.setAnimationLoop(null);
    this.#input.dispose();
    this.#world.dispose();
    this.#audio.dispose();
    this.#render.dispose();

  }

  start() {
    this.#render.renderer.setAnimationLoop(new GameLoop(this).tick);
  }
}

