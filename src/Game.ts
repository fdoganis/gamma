

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


export class Game {
  renderer: WebGLRenderer = new WebGLRenderer({ antialias: true, alpha: true });
  scene: Scene = new Scene();
  camera: PerspectiveCamera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10);
  timer: Timer = new Timer();

  controls?: OrbitControls;

  mode: ;

  constructor() {

    this.timer.connect(document);   // allows timer to pause when tab is not visible

    this._initRenderer();
    this._initScene();

    //this._initInput();

    this._initXRSession();

    window.addEventListener('resize', this._onResize);
  }

  _initRenderer() {
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.xr.enabled = true;

    document.body.appendChild(this.renderer.domElement);
    const xrButton = XRButton.createButton(this.renderer, {});
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
        this.isAR = session.environmentBlendMode !== 'opaque';
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
    const delta = this.timer.getDelta();
    this.processInput();
    this.update(delta);
    this.render();
  }

  start() {
    this.renderer.setAnimationLoop(this.loop);
  }
}


/*

const session = renderer.xr.getSession();
if (session) {
  const isAR = session.environmentBlendMode !== 'opaque';
  console.log(isAR ? 'AR mode' : 'VR mode');
}


const session = renderer.xr.getSession();
session.inputSources.forEach(source => {
  if (source.targetRaySpace && source.targetRayMode === 'screen') {
    // Mobile AR input
  } else {
    // Headset input
  }
});


===


function getXRMode() {
  // Not in XR session
  if (!renderer.xr.isPresenting) {
    // Detect DESKTOP vs MOBILE
    const isMobile = navigator.maxTouchPoints > 0 || /mobile/i.test(navigator.userAgent);
    return isMobile ? 'MOBILE' : 'DESKTOP';
  }

  // In XR session
  const session = renderer.xr.getSession();
  const isAR = session.environmentBlendMode !== 'opaque';

  if (!isAR) {
    return 'VR';
  }

  // It's AR—check if Mobile AR or Headset AR
  const isMobileAR = session.inputSources.some(source => source.targetRayMode === 'screen');
  return isMobileAR ? 'MOBILE_AR' : 'AR';
}


===

async function detectAppleVisionPro() {
  const ua = navigator.userAgent;
  
  // Must be WebKit-based Safari (not Chrome on iPhone etc.)
  const isWebKitSafari = /AppleWebKit/.test(ua) && !/CriOS|Chrome|FxiOS/.test(ua);
  if (!isWebKitSafari) return false;

  // WebXR must exist and support immersive-vr
  if (!navigator.xr) return false;
  
  const supportsVR = await navigator.xr.isSessionSupported('immersive-vr');
  if (!supportsVR) return false;

  // The defining negative: no immersive-ar (visionOS-specific as of 2026)
  const supportsAR = await navigator.xr.isSessionSupported('immersive-ar');
  if (supportsAR) return false; // Meta Quest, etc.

  // Bonus: XRHand API should be present
  const hasHandTracking = 'XRHand' in window;

  // At this point: WebKit + immersive-vr + no immersive-ar + (optionally) XRHand
  // This combination is unique to visionOS Safari right now.
  return hasHandTracking; // or just `return true` if you want to be less strict
}

===

async function startXR() {
  const session = await navigator.xr.requestSession('immersive-vr', {
    optionalFeatures: ['hand-tracking']
  });

  session.addEventListener('inputsourceschange', () => {
    const isVisionPro = [...session.inputSources].length > 0 &&
      [...session.inputSources].every(s => s.targetRayMode === 'transient-pointer');
    
    if (isVisionPro) {
      // Adapt UI: no raycast from controllers, use gaze-based targeting
      // Don't render grip-space controller models
    }
  });
}

// More : https://github.com/aframevr/aframe/blob/master/src/utils/device.js


export function isAppleVisionPro () {
  // Safari for Apple Vision Pro presents itself as a desktop browser.
  var isMacintosh = navigator.userAgent.includes('Macintosh');
  // Discriminates between a "real" desktop browser and Safari for Vision Pro.
  var hasFiveTouchPoints = navigator.maxTouchPoints === 5;
  // isWebXRAvailable discriminates between Vision Pro and iPad / iPhone.
  // This will no longer work once WebXR ships in iOS / iPad OS.
  return isMacintosh && hasFiveTouchPoints && isWebXRAvailable;
}


=> Maybe allow user override in settings? Different buttons? Ruins the magic but...
// also how to handle physical plane in VR? Calibration? Ask user to put hands on table for a while

*/