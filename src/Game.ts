

import {
  AmbientLight,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
  Timer
} from 'three';

import { XRButton } from 'three/addons/webxr/XRButton.js';

import {
  OrbitControls
} from 'three/addons/controls/OrbitControls.js';

// Enum
const XRMode = {
  NONE: Symbol('none'),
  VR: Symbol('vr'),
  AR: Symbol('ar'),
  MOBILE_AR: Symbol('mobile_ar')
};

const FPS = 60;
const FRAME_s = 1 / FPS;

export class Game {
  renderer: WebGLRenderer = new WebGLRenderer({ antialias: true, alpha: true });
  scene: Scene = new Scene();
  camera: PerspectiveCamera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10);

  // GameLoop
  timer: Timer = new Timer();
  elapsed: number = 0;

  controls?: OrbitControls;

  xrmode: Symbol = XRMode.NONE;

  constructor() {

    this.timer.connect(document);   // allows timer to pause when tab is not visible

    this._initRenderer();
    this._initScene();

    //this._initInput(); // TODO

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

  _initScene() {
    this._onResize();
    this._initLights();

    this.camera.position.set(0, 1.6, 3); // Useless in XR: your head / mobile device drives the camera

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 1.6, 0);
    this.controls.update();
  }

  _initXRSession() {
    this.renderer.xr.addEventListener('sessionstart', () => {
      if (this.controls) this.controls.enabled = false;

      const session = this.renderer.xr.getSession();
      if (session) {

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
    // TODO
  }

  update(delta: number) {
    // TODO
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  // simple GameLoop
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

