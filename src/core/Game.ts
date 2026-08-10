
import { GameLoop } from './GameLoop';
import { StateMachine } from './StateMachine';
import { RenderingManager } from '../managers/RenderingManager';
import { InputManager } from '../input/InputManager';
import { AudioManager } from '../audio/AudioManager';
import { World } from '../world/World';
import { SelectCommand } from '../commands/SelectCommand';
import { GameIntroState } from '../states/GameIntroState';
import { GameRunningState } from '../states/GameRunningState';
import { GameOverState } from '../states/GameOverState';
import { HapticsManager } from '../haptics/HapticsManager';

export class Game {
  #rendering: RenderingManager = new RenderingManager();
  #world: World = new World(this.#rendering.scene);
  #input: InputManager = new InputManager(this.#rendering.renderer, this.#rendering.scene, this.#rendering.camera);
  #audio: AudioManager = new AudioManager(this.#rendering.camera);
  #haptics = new HapticsManager(this.#rendering.renderer.xr);

  #sm!: StateMachine;

  #loop: GameLoop = new GameLoop(this);

  constructor() {
    this.#buildStateMachine();
    this.#bindInput();
  }

  #buildStateMachine() {
    this.#sm = new StateMachine();
    // Class constructors as keys, unique by identity, refactor-safe, minification-safe.
    // Transitions are closures wired here: states never import each other.
    this.#sm.register(GameIntroState, new GameIntroState(this.#sm));
    this.#sm.register(GameRunningState, new GameRunningState(this.#world, this.#audio, this.#haptics));
    this.#sm.register(GameOverState, new GameOverState(this.#sm));
    this.#sm.start(GameIntroState);
  }

  #bindInput(): void {
    const { xrLeft, xrRight, handLeft, handRight, arScreen } = this.#input;
    xrLeft.bind('select', new SelectCommand(xrLeft.node, 'left'));
    xrRight.bind('select', new SelectCommand(xrRight.node, 'right'));
    handLeft.bind('select', new SelectCommand(handLeft.node, 'left'));
    handRight.bind('select', new SelectCommand(handRight.node, 'right'));
    arScreen.bind('select', new SelectCommand(arScreen.node, 'none'));
  }

  // GPP ch.9 : three phases, no conditionals, no knowledge of what commands do
  processInput() {
    this.#input.collect();
    for (const cmd of this.#input.commands) {
      this.#sm.dispatch(cmd);
    }
  }

  update(delta: number) {
    this.#sm.update(delta);
  }

  render() {
    this.#rendering.render();
  }

  dispose() {
    this.#rendering.renderer.setAnimationLoop(null); // releases tick -> GameLoop -> GC
    this.#input.dispose();
    this.#world.dispose();  // materials + geometry disposed here
    this.#audio.dispose();
    this.#rendering.dispose();

    // TODO: dispose haptics?
  }

  start() {
    this.#rendering.renderer.setAnimationLoop(this.#loop.tick);
  }
}


/*
import { RenderingManager } from '../managers/RenderingManager';
import { InputManager } from '../managers/InputManager';
import { AudioManager } from '../audio/AudioManager';
import { StateMachine } from './StateMachine';
import { GameLoop } from './GameLoop';
import { GameIntroState } from '../states/GameIntroState';
import { GameRunningState } from '../states/GameRunningState';
import { GameOverState } from '../states/GameOverState';

import { ChangeStateCommand } from '../commands/ChangeStateCommand';
import { ToggleAudioCommand } from '../commands/ToggleAudioCommand';
import { SpawnConeCommand } from '../commands/SpawnConeCommand';

export class Game {
  rendering!: RenderingManager;
  input: InputManager;
  audio: AudioManager;

  sm: StateMachine = new StateMachine();

  #loop: GameLoop = new GameLoop(this);


  constructor() {
    this.rendering = new RenderingManager();
    this.audio = new AudioManager(this.rendering.camera);
    this.input = new InputManager(this.rendering.renderer, this.rendering.scene);

    this.#buildStateMachine();
    this.#bindInput();
  }

  #buildStateMachine() {
    this.sm.register(GameIntroState, new GameIntroState());
    this.sm.register(GameRunningState, new GameRunningState());
    this.sm.register(GameOverState, new GameOverState());

    this.sm.start(GameRunningState);
  }

  #bindInput() {
    const { keyboard: kb, xrLeft, xrRight, handLeft, handRight } = this.input;
    const audio = this.audio;
    const sm = this.sm;

    // state transitions
    kb.bind('Enter', new ChangeStateCommand(sm, GameIntroState, GameRunningState));
    kb.bind('Escape', new ChangeStateCommand(sm, GameRunningState, GameOverState));
    kb.bind('Backspace', new ChangeStateCommand(sm, GameOverState, GameIntroState));

    kb.bind('Space', new SpawnConeCommand(this.rendering, , audio);

    kb.bind('Tab', new ToggleAudioCommand(audio));

    // TODO: FIXME: ARCHI: PERF : a new command is created!
    // How to pre allocate it? Who is responsible of the lifecycle of the commands?
    // Should the input processor delete them once it has consumed them?
    xrLeft?.bind('select', new SpawnConeCommand(this.rendering, xrLeft.node, audio));
    xrRight?.bind('select', new SpawnConeCommand(this.rendering, xrRight.node, audio));
    handLeft?.bind('select', new SpawnConeCommand(this.rendering, handLeft.node, audio));
    handRight?.bind('select', new SpawnConeCommand(this.rendering, handRight.node, audio));
  }

  processInput() {
    this.input.collect();
    for (const cmd of this.input.commands) cmd.execute();
  }

  update(_delta: number) { }   // ready for StateMachine

  render() {
    this.rendering.render();
  }

  dispose() {
    this.input.dispose();
    this.audio.dispose();
    this.rendering.dispose();

    // TODO: ARCHI: LifeCycle: dispose bound commands?
    //SpawnConeCommand.disposeGeo();?
  }

  start() {
    this.rendering.renderer.setAnimationLoop(this.#loop.tick);
  }
}

*/