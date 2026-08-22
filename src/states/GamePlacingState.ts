import { Mesh, MeshBasicMaterial, RingGeometry } from 'three';
import { State } from '../core/State';
import type { ITransition } from '../core/StateMachine';
import type { RenderingManager } from '../managers/RenderingManager';
import { SelectCommand } from '../commands/SelectCommand';
import { GameRunningState } from './GameRunningState';

export class GamePlacingState extends State {
  #render: RenderingManager;
  #sm: ITransition;
  #reticle: Mesh;
  #hitTestSource: XRHitTestSource | null | undefined;
  #requested = false;

  constructor(render: RenderingManager, sm: ITransition) {
    super();
    this.#render = render;
    this.#sm = sm;
    this.#reticle = new Mesh(
      new RingGeometry(0.08, 0.1, 32).rotateX(-Math.PI / 2),
      new MeshBasicMaterial()
    );
    this.#reticle.matrixAutoUpdate = false;
    this.#reticle.visible = false;
    this.#render.scene.add(this.#reticle); // tracking-space-rooted, NOT under anchor
    this.on(SelectCommand, this.#onSelect);
  }

  #onSelect = () => {
    if (!this.#reticle.visible) return;

    this.#reticle.matrix.decompose(
      this.#render.anchor.position,
      this.#render.anchor.quaternion,
      this.#render.anchor.scale
    );

    this.#sm.change(GameRunningState);
  };

  override update(_delta: number, frame?: XRFrame) {
    if (!frame) return;

    const session = this.#render.renderer.xr.getSession();
    const refSpace = this.#render.renderer.xr.getReferenceSpace();
    if (!session || !refSpace) return;

    if (!this.#requested) {
      this.#requested = true;

      session.requestReferenceSpace('viewer')
        .then((viewerSpace: XRReferenceSpace) => {
          const hitTestPromise = session.requestHitTestSource?.({ space: viewerSpace });
          if (!hitTestPromise) {
            this.#requested = false;
            return;
          }
          return Promise.resolve(hitTestPromise);
        })
        .then((source: XRHitTestSource | undefined) => {
          if (source) {
            this.#hitTestSource = source;
          }
        })
        .catch(() => {
          this.#hitTestSource = null;
          this.#requested = false;
        });

      session.addEventListener('end', () => {
        this.#hitTestSource?.cancel();
        this.#hitTestSource = null;
        this.#requested = false;
      });

    }

    if (this.#hitTestSource) {
      const hits = frame.getHitTestResults(this.#hitTestSource);
      this.#reticle.visible = hits.length > 0;
      if (hits.length > 0) {
        this.#reticle.matrix.fromArray(hits[0].getPose(refSpace)!.transform.matrix);
      }
    }
  }

  override enter() {
    this.#reticle.visible = false;
  }

  override exit() {
    this.#reticle.visible = false;
    this.#hitTestSource?.cancel();
    this.#hitTestSource = null;
    this.#requested = false;
  }
}