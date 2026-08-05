import type { State } from "./State";
import type { Vector3 } from "three";
import type { Quaternion } from "three";

// Game State contract interface
export class IGameContext {
  changeState(next: State) { }

  // TODO: don't use these methods, access directly the different parts of Game instead?

  // Audio
  // activateAudio() {}
  // deactivateAudio() {}

  // GameWorld
  spawnTarget(position: Vector3, orientation: Quaternion) { }
  // despawnTarget(target : Mesh) {}
  // clearTargets() {}
  // raycastTargets(ndc : Object) : Mesh | null  { return null; }
  // proximateTargets(radius : number) : Mesh[]  { return []; }
}