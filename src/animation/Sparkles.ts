import { Mesh, MeshBasicMaterial, BoxGeometry, Vector3, MathUtils } from 'three';
import type { Scene, Color } from 'three';
import { easeOutQuint, easeOutBack } from './Easing';
import type { Ease } from './Easing';

type Particle = {
  mesh: Mesh;
  active: boolean;
  elapsed: number;
  duration: number;
  from: Vector3;
  to: Vector3;
  fromScale: number;
  toScale: number;
};

const PARTICLE_SIZE_m = 0.02;
const GEOMETRY = new BoxGeometry(PARTICLE_SIZE_m, PARTICLE_SIZE_m, PARTICLE_SIZE_m);
const SPREAD_m = 0.25; // metres a particle travels from/to the burst origin

export type BurstMode = 'explode' | 'converge';

// A fixed pool, reused for every burst, nothing allocated per spawn beyond a few per-burst scratch vectors
// Two groups, matching the reference: a larger set that takes on the
// spawning cone's own colour, and a smaller fixed-colour accent for glint.

type ParticleGroup = {
  particles: Particle[];
  material: MeshBasicMaterial; // shared by every particle in the group
  scale: number;
  ease: Ease;
  matchColor: boolean;           // recolour to the spawning cone each burst, or stay fixed
};


export class Sparkles {
  #scene: Scene;
  #groups: ParticleGroup[];

  constructor(scene: Scene) {
    this.#scene = scene;
    this.#groups = [
      this.#createGroup(20, 0xffffff, 0.03, easeOutQuint, true),  // matches the cone's colour
      this.#createGroup(5, 0xffe9a8, 0.05, easeOutBack, false), // fixed warm glint
    ];
  }

  #createGroup(count: number, color: number, scale: number, ease: Ease, matchColor: boolean): ParticleGroup {
    const material = new MeshBasicMaterial({ color });
    const particles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const mesh = new Mesh(GEOMETRY, material);
      mesh.scale.setScalar(0);
      this.#scene.add(mesh);
      particles.push({
        mesh, active: false, elapsed: 0, duration: 1,
        from: new Vector3(), to: new Vector3(), fromScale: 0, toScale: 0,
      });
    }
    return { particles, material, scale, ease, matchColor };
  }

  burst(origin: Vector3, color: Color, mode: BurstMode = 'converge') {
    for (const group of this.#groups) {
      if (group.matchColor) group.material.color.copy(color);
      for (const p of group.particles) this.#fire(p, origin, mode, group.scale);
    }
  }

  #fire(p: Particle, origin: Vector3, mode: BurstMode, scale: number) {
    const offset = new Vector3(
      Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1
    ).normalize().multiplyScalar(SPREAD_m * (0.5 + Math.random() * 0.5));
    const scattered = origin.clone().add(offset);

    p.from.copy(mode === 'explode' ? origin : scattered);
    p.to.copy(mode === 'explode' ? scattered : origin);
    p.fromScale = mode === 'explode' ? scale : 0;
    p.toScale = mode === 'explode' ? 0 : scale;
    p.elapsed = 0;
    p.duration = 0.6 + Math.random() * 0.3;
    p.active = true;
    p.mesh.position.copy(p.from);
    p.mesh.scale.setScalar(p.fromScale);
  }

  update(delta: number) {
    for (const group of this.#groups)
      for (const p of group.particles) this.#advance(p, group.ease, delta);
  }

  #advance(p: Particle, ease: Ease, delta: number) {
    if (!p.active) return;
    p.elapsed += delta;
    const t = Math.min(p.elapsed / p.duration, 1);
    const et = ease(t);
    p.mesh.position.lerpVectors(p.from, p.to, et);
    p.mesh.scale.setScalar(MathUtils.lerp(p.fromScale, p.toScale, et));
    if (t >= 1) { p.active = false; p.mesh.scale.setScalar(0); }
  }

  dispose() {
    for (const group of this.#groups) {
      for (const p of group.particles) this.#scene.remove(p.mesh);
      group.material.dispose();
    }
    GEOMETRY.dispose();
  }
}