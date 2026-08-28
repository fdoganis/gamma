import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  AmbientLight,
  HemisphereLight,
  DirectionalLight,
  Mesh,
  PlaneGeometry,
  ShadowMaterial,
  Group
} from 'three';
import { XRButton } from 'three/addons/webxr/XRButton.js';

export class RenderingManager {
  scene: Scene;
  camera: PerspectiveCamera;
  renderer: WebGLRenderer;
  anchor: Group; // extra node useful for XR placement
  hudAnchor: Group; // child of camera, fixed position/orientation relative to the viewer, for camera-facing text


  constructor() {
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.xr.enabled = true;
    document.body.appendChild(this.renderer.domElement);
    // TODO: CHECK if the following line is important, and if it should rather be written in HTML / CSS
    //this.renderer.domElement.style.touchAction = 'none'; // stop the browser's own pinch/scroll competing with taps

    const btn = XRButton.createButton(this.renderer, {
      requiredFeatures: ['hit-test'],
      optionalFeatures: ['hand-tracking']
    });
    btn.style.backgroundColor = 'skyblue';
    document.body.appendChild(btn);

    this.scene = new Scene();
    this.anchor = new Group();
    this.scene.add(this.anchor);
    this.camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10);
    this.camera.position.set(0, 1.6, 3);

    this.hudAnchor = new Group();
    this.hudAnchor.position.set(0, 0, -0.5); // 0.5m in front of wherever the camera looks
    this.camera.add(this.hudAnchor);
    this.renderer.shadowMap.enabled = true;

    this.scene.add(new AmbientLight(0xffffff, 1.0));
    const hemi = new HemisphereLight(0xffffff, 0xbbbbff, 3);
    hemi.position.set(0.5, 1, 0.25);
    this.scene.add(hemi);

    // Parented to anchor, not scene: 
    // light source and shadow target follow the placement
    const sun = new DirectionalLight(0xffffff, 3); // also gives Phong voxels a shading gradient
    sun.position.set(0, 1, 0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(512, 512); // small play area (±1m frustum) — this re-renders every frame, keep it cheap
    sun.shadow.camera.top = 1; sun.shadow.camera.bottom = -1;
    sun.shadow.camera.right = 1; sun.shadow.camera.left = -1;
    sun.shadow.camera.near = 0.1; sun.shadow.camera.far = 3;
    this.anchor.add(sun, sun.target);

    // Invisible: only its shadow renders, so virtual objects appear to cast a shadow
    // onto the real (passthrough) floor. Sized to comfortably cover the spawn disc.
    const catcher = new Mesh(new PlaneGeometry(2, 2), new ShadowMaterial({ opacity: 0.5 }));
    catcher.rotation.x = -Math.PI / 2;
    catcher.receiveShadow = true;
    this.anchor.add(catcher);

    this.renderer.xr.addEventListener('sessionstart', this.#onXRStart);
    this.renderer.xr.addEventListener('sessionend', this.#onXREnd);
    window.addEventListener('resize', this.#onResize);

    // matrixWorld is only ever recomputed inside render()
    // anything reading it before the first render sees identity if we don't update the martix here.
    this.scene.updateMatrixWorld(true);
  }

  render() { this.renderer.render(this.scene, this.camera); }

  #onXRStart = () => {
  };

  #onXREnd = () => {
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
    this.renderer.dispose();
  }
}