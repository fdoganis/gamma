

import {
  AmbientLight,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
  Timer,
  Vector3,
  Quaternion,
  Matrix4,
  Color,
} from 'three';

import { XRButton } from 'three/addons/webxr/XRButton.js';

import {
  OrbitControls
} from 'three/addons/controls/OrbitControls.js';


import { ActionType } from '../input/ActionType';
import { Action } from '../input/Action';
import { InputProcessor } from '../input/InputProcessor';
import { KeyboardInputSource } from '../input/KeyboardInputSource';
import { IGameContext } from './IGameContext';
import { State } from './State';
import { GameIntroState } from './GameIntroState';

import type { BufferGeometry } from 'three';
import { CylinderGeometry } from 'three';
import { MeshPhongMaterial } from 'three';
import { InstancedMesh } from 'three';


// Enum
const XRMode = {
  NONE: Symbol('none'),
  VR: Symbol('vr'),
  AR: Symbol('ar'),
  MOBILE_AR: Symbol('mobile_ar')
};

const FPS = 60;
const FRAME_s = 1 / FPS;

export class Game extends IGameContext {

  // World
  renderer: WebGLRenderer = new WebGLRenderer({ antialias: true, alpha: true });
  scene: Scene = new Scene();
  camera: PerspectiveCamera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10);

  // Input
  input: InputProcessor = new InputProcessor();

  // GameLoop
  timer: Timer = new Timer();
  elapsed: number = 0;


  controls?: OrbitControls;

  xrmode: Symbol = XRMode.NONE;

  _state: State = new GameIntroState();

  // TODO: ARCHI: move elsewhere : Game World?
  _geometry: BufferGeometry = new CylinderGeometry(0, 0.05, 0.2, 32).rotateX(Math.PI / 2);
  _material: MeshPhongMaterial = new MeshPhongMaterial({ color: 0xffffff });
  _MAX_TARGETS: number = 1024;
  _instancedMesh: InstancedMesh = new InstancedMesh(this._geometry, this._material, this._MAX_TARGETS);
  _ONE: Vector3 = new Vector3(1, 1, 1);
  __mat4: Matrix4 = new Matrix4();

  constructor() {

    super();
    this.timer.connect(document);   // allows timer to pause when tab is not visible

    this._initRenderer();
    this._initScene();

    this._initInput();


    this._initXRSession();

    window.addEventListener('resize', this._onResize);
  }

  _initRenderer() {
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.xr.enabled = true;

    document.body.appendChild(this.renderer.domElement);

    /*
    {
      'optionalFeatures': [ 'depth-sensing' ],
      'depthSensing': { 'usagePreference': [ 'gpu-optimized' ], 'dataFormatPreference': [] }
    } 
    */


    const sessionInit = {
      'optionalFeatures': ['hand-tracking']
    };

    const xrButton = XRButton.createButton(this.renderer, sessionInit);
    xrButton.style.backgroundColor = 'skyblue';
    document.body.appendChild(xrButton);
  }

  _initLights() {
    this.scene.add(new AmbientLight(0xffffff, 1.0));
    const hemiLight = new HemisphereLight(0xffffff, 0xbbbbff, 3);
    hemiLight.position.set(0.5, 1, 0.25);
    this.scene.add(hemiLight);
  }

  _initGeometry() {

    // Set up all instances with random matrices

    const matrix = new Matrix4();
    const color = new Color();

    for (let i = 0; i < this._MAX_TARGETS; i++) {

      this._instancedMesh.setMatrixAt(i, matrix);
      this._instancedMesh.setColorAt(i, color.setHex(Math.random() * 0xffffff));

    }

    // I'd like to set the number of instaces to zero but this seems to be problematic.
    // If I do so I can't change the count later on
    // Hack: setting hack to a small float value like 0.1 works, but seems fragile.
    // Bypass: set count to 1 + invisible then set flag to visible. Semantically makes sense.
    this._instancedMesh.count = 1;
    this._instancedMesh.visible = false;

    this._instancedMesh.instanceMatrix.needsUpdate = true;
    if (this._instancedMesh.instanceColor) {
      this._instancedMesh.instanceColor.needsUpdate = true;
    }


    this.scene.add(this._instancedMesh);

    //this._instancedMesh.count = 0;

  }


  _initScene() {
    this._onResize();
    this._initLights();

    this.camera.position.set(0, 1.6, 3); // Useless in XR: your head / mobile device drives the camera

    this._initGeometry();

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 1.6, 0);
    this.controls.update();
  }

  _initXRSession() {
    this.renderer.xr.addEventListener('sessionstart', () => {
      if (this.controls) this.controls.enabled = false;

      const session = this.renderer.xr.getSession();
      if (session) {

        // TODO: OPTIONAL
        // Detect which kind of session and device we are dealing with (see XRMode)
        // More exhaustive XR device detection here : 
        // https://github.com/aframevr/aframe/blob/master/src/utils/device.js
        session.addEventListener('inputsourceschange', (e) => {
          if ([...session.inputSources].length === 1
            && [...session.inputSources][0].targetRayMode === 'screen') {
            this.xrmode = XRMode.MOBILE_AR;

            // TODO: It seems, in emulators at least, that every tap triggers an 'inputsourcechange' event with 'added'
            // Once a XRMode has been defined it should stay the same until the end of the session,
            // i.e.: until 'sessionsend' has been called.
          }
        });

        if (session.environmentBlendMode !== 'opaque') {
          this.xrmode = XRMode.AR;
        }
        else {
          this.xrmode = XRMode.VR;
        }
      }

      //this.input.enterXR();
    });

    this.renderer.xr.addEventListener('sessionend', () => {
      if (this.controls) this.controls.enabled = true;
      //this.input.exitXR();
    });

  }

  _initInput() {

    // TODO: Create new InputMapper class?
    // Taking json config?
    // => InputManager
    const kb = this.input.add(new KeyboardInputSource());
    kb.bind('Space', new Action(ActionType.AIM));
    kb.bind('Escape', new Action(ActionType.GAME_OVER));
    kb.bind('Enter', new Action(ActionType.START));
    kb.bind('KeyM', new Action(ActionType.TOGGLE_AUDIO));

  }

  _onResize = () => {
    // Don't resize while in XR
    if (this.renderer.xr?.isPresenting) { return; }

    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  /**
  * Returns the query parameters as a key/value object. 
  * Example: If the query parameters are
  *
  *    abc=123&def=456&name=gman
  *
  * Then `getQuery()` will return an object like
  *
  *    {
  *      abc: '123',
  *      def: '456',
  *      name: 'gman',
  *    }
  * 
  * source: https://threejs.org/manual/#en/debugging-javascript 
  */
  getQuery() {
    return Object.fromEntries(new URLSearchParams(window.location.search).entries());
  }


  processInput() {

    this.input.collect()

    for (const action of this.input.actions) {
      if (action.type === ActionType.TOGGLE_AUDIO) {
        // TODO: this.audio.toggle();
        console.log("TOGGLE_AUDIO");
      } else {
        this._state.handleAction(this, action)
      }
    }
  }



  spawnTarget(position: Vector3, orientation: Quaternion): void {

    if (this._instancedMesh.count === 1 && this._instancedMesh.visible === false) {
      this._instancedMesh.visible = true;
    } else if (this._instancedMesh.count < this._MAX_TARGETS) {
      this._instancedMesh.count++;
    }

    this.__mat4.compose(position, orientation, this._ONE);
    this._instancedMesh.setMatrixAt(this._instancedMesh.count - 1, this.__mat4); // instancedMesh reange ; [0, count]

    this._instancedMesh.instanceMatrix.needsUpdate = true;
    if (this._instancedMesh.instanceColor) {
      this._instancedMesh.instanceColor.needsUpdate = true;
    }


  }

  update(delta: number) {
    this._state.update(this, delta);
  }


  render() {
    this.renderer.render(this.scene, this.camera);
  }


  changeState(next: State) {
    if (this._state) this._state.exit(this)
    this._state = next
    this._state.enter(this)
  }


  // GameLoop
  loop = () => {
    this.timer.update();
    this.elapsed += this.timer.getDelta();
    this.processInput();

    while (this.elapsed > FRAME_s) {
      this.update(FRAME_s);
      this.elapsed -= FRAME_s;
    }

    this.render();
  }

  start() {
    this.renderer.setAnimationLoop(this.loop);
  }
}


// TODO: ARCHI: Refactoring
// Game class keeps growing, we need to split responsibilities
// _rendering: RenderingManager : owns renderer, scene, camera, controls, lights
// _input : InputManager : owns input processor and all sources, XR session toggling?
// _audio : AudioManager : see https://github.com/mrdoob/three.js/blob/master/examples/webxr_xr_haptics.html

// Avoid new
// _states  : { intro, running, gameOver }   pre-allocated, reused
// _state   : State

// Extract GameLoop? Needs multiple inheritance for dependency inversion?
// IGameLoopHost -> processInput / update / render (thin delegation)
// IGameContext -> changeState / audio / targets (thin delegation)

// Then proceed with more input sources, text etc.


