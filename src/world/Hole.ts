// A socket in the gameboard: a position + its recessed-pit fixture meshes and a
// free/occupied flag. It does not know or care what rises out of it — that is the
// Actors system's job.
import {
  Mesh,
  MeshPhongMaterial,
  CylinderGeometry,
  CircleGeometry,
  RingGeometry
} from 'three';
import type { Object3D } from 'three';

// Geometry dimensions — shared with Gameboard, which builds the pooled geometry.
export const HOLE_R_m = 0.055;
export const COLLAR_R_m = 0.12;   // felt surround; ~= the cross arm, so a cross reads as one platform
export const PIT_DEPTH_m = 0.10;

// Pooled resources — built once by Gameboard, shared by every Hole, disposed by
// Gameboard. Each hole still owns its own fixture Mesh instances.
export type HoleResources = {
  collarGeo: RingGeometry;
  collarMat: MeshPhongMaterial;
  rimGeo: RingGeometry;
  rimMat: MeshPhongMaterial;
  pitGeo: CylinderGeometry;
  pitMat: MeshPhongMaterial;
  floorGeo: CircleGeometry;
  floorMat: MeshPhongMaterial;
};

export class Hole {
  readonly x: number;
  readonly z: number;
  free = true;

  #root: Object3D;
  #fixtures: Mesh[];

  constructor(root: Object3D, x: number, z: number, res: HoleResources) {
    this.#root = root;
    this.x = x;
    this.z = z;

    // Opaque collar at the surface — the "table" the pit is sunk into. It also
    // hides the pit's outer wall and occludes an actor while it is below the rim.
    const collar = new Mesh(res.collarGeo, res.collarMat);
    collar.position.set(x, 0.002, z);
    collar.receiveShadow = true;
    // Crisp dark lip just inside the collar edge.
    const rim = new Mesh(res.rimGeo, res.rimMat);
    rim.position.set(x, 0.004, z);
    // Dark, lit pit wall (BackSide): the scene lights give it a rim-bright /
    // floor-dark gradient — that gradient is the depth cue. Tapers in for perspective.
    const pit = new Mesh(res.pitGeo, res.pitMat);
    pit.position.set(x, -PIT_DEPTH_m / 2, z);
    const floor = new Mesh(res.floorGeo, res.floorMat);
    floor.position.set(x, -PIT_DEPTH_m + 0.003, z);

    this.#fixtures = [collar, rim, pit, floor];
    root.add(collar, rim, pit, floor);
  }

  dispose(): void {
    for (const f of this.#fixtures) this.#root.remove(f);
  }
}
