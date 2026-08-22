import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  AmbientLight,
  HemisphereLight,
  Group
} from 'three';
//import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { XRButton } from 'three/addons/webxr/XRButton.js';

export class RenderingManager {
  scene: Scene;
  camera: PerspectiveCamera;
  renderer: WebGLRenderer;
  anchor: Group; // extra node useful for XR placement
  //controls: OrbitControls;

  constructor() {
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.xr.enabled = true;
    document.body.appendChild(this.renderer.domElement);
    // TODO: CHECK if the following line is important, and if it should rather be written in HTML / CSS
    //this.renderer.domElement.style.touchAction = 'none'; // stop the browser's own pinch/scroll competing with taps

    const btn = XRButton.createButton(this.renderer, { requiredFeatures: ['hit-test'] });
    btn.style.backgroundColor = 'skyblue';
    document.body.appendChild(btn);

    this.scene = new Scene();
    this.anchor = new Group();
    this.scene.add(this.anchor);
    this.camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10);
    this.camera.position.set(0, 1.6, 3);

    this.scene.add(new AmbientLight(0xffffff, 1.0));
    const hemi = new HemisphereLight(0xffffff, 0xbbbbff, 3);
    hemi.position.set(0.5, 1, 0.25);
    this.scene.add(hemi);

    // this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    // this.controls.target.set(0, 1.6, 0);
    // this.controls.update();

    // XR only affects OrbitControls — self-contained here, Game is unaware
    this.renderer.xr.addEventListener('sessionstart', this.#onXRStart);
    this.renderer.xr.addEventListener('sessionend', this.#onXREnd);
    window.addEventListener('resize', this.#onResize);
  }

  render() { this.renderer.render(this.scene, this.camera); }

  #onXRStart = () => {
    //this.controls.enabled = false;
  };

  #onXREnd = () => {
    //this.controls.enabled = true;
  };

  #onResize = () => {
    if (this.renderer.xr.isPresenting) { return; }

    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  dispose() {
    this.renderer.xr.removeEventListener('sessionstart', this.#onXRStart);
    this.renderer.xr.removeEventListener('sessionend', this.#onXREnd);
    window.removeEventListener('resize', this.#onResize);
    //this.controls.dispose();
    this.renderer.dispose();
  }
}