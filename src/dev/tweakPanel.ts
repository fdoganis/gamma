// DEV-only live-tuning panel. Reached with `?tweak` (see Game.#buildStateMachine),
// which also drops the board in front of the camera and starts a round, like
// `?run`. Everything here is behind `if (__DEV__)` at the single import site, and
// lil-gui is a dynamic import — so this file, its imports of the knob objects,
// and lil-gui all tree-shake out of a production build (verified: `grep -c
// tweakPanel dist/index.html` → 0).
//
// The panel binds lil-gui controllers straight to the exported `*Knobs` objects
// in unicorn.ts / ghostEyes.ts / VoxelTextEngine.ts and to the live light
// objects on RenderingManager. Spring / per-frame knobs take effect immediately;
// geometry-time knobs (segment count, root offsets, eye/cheek/horn placement)
// need a respawn, wired to onFinishChange. "copy JSON" dumps the current values
// so a good set can be pasted back into the source defaults.
import type { RenderingManager } from '../rendering/RenderingManager';
import type { World } from '../world/World';
import { maneKnobs, hornKnobs, uniFaceKnobs, rebuildHornGeo } from '../world/unicorn';
import { ghostEyeKnobs } from '../world/ghostEyes';
import { textKnobs } from '../text/engines/voxel/VoxelTextEngine';

type Light = { color: { getHexString(): string; set(v: string): void }; intensity: number; position: { x: number; y: number; z: number } };

export async function openTweakPanel(render: RenderingManager, world: World): Promise<void> {
  const { default: GUI } = await import('lil-gui');
  const gui = new GUI({ title: 'gamma ?tweak' });
  const respawn = () => world.respawnActors();
  const rebuildHorn = () => { rebuildHornGeo(); respawn(); };

  const mane = gui.addFolder('mane');
  mane.add(maneKnobs, 'follow', 0, 1, 0.01);
  mane.add(maneKnobs, 'relax', 0, 0.5, 0.01);
  mane.add(maneKnobs, 'lag', 0, 0.6, 0.01);
  mane.add(maneKnobs, 'grav', 0, 0.2, 0.005);
  mane.add(maneKnobs, 'idle', 0, 0.2, 0.005);
  mane.add(maneKnobs, 'segs', 3, 8, 1).onFinishChange(respawn);
  mane.add(maneKnobs, 'segLen', 0.01, 0.05, 0.001).onFinishChange(respawn);
  mane.add(maneKnobs, 'taper', 0, 1, 0.02).onFinishChange(respawn);
  mane.add(maneKnobs, 'rootY', -0.05, 0.05, 0.002).onFinishChange(respawn);
  mane.add(maneKnobs, 'rootZ', -0.06, 0.02, 0.002).onFinishChange(respawn);

  const horn = gui.addFolder('horn');
  horn.add(hornKnobs, 'turns', 0, 6, 0.1).onFinishChange(rebuildHorn);
  horn.add(hornKnobs, 'height', 0.03, 0.14, 0.005).onFinishChange(rebuildHorn);
  horn.add(hornKnobs, 'baseR', 0.008, 0.04, 0.001).onFinishChange(rebuildHorn);
  horn.add(hornKnobs, 'tiltX', -0.6, 0.8, 0.02).onFinishChange(respawn);
  horn.add(hornKnobs, 'posY', -0.05, 0.08, 0.005).onFinishChange(respawn);
  horn.add(hornKnobs, 'posZ', -0.03, 0.05, 0.005).onFinishChange(respawn);

  const face = gui.addFolder('unicorn face');
  for (const key of ['eyeX', 'eyeYFrac', 'eyeZ', 'cheekX', 'cheekYFrac', 'cheekZ', 'cheekFlat'] as const)
    face.add(uniFaceKnobs, key, -0.06, 0.08, 0.002).onFinishChange(respawn);

  const eyes = gui.addFolder('ghost eyes');
  eyes.add(ghostEyeKnobs, 'yawMax', 0, 1.6, 0.05);
  eyes.add(ghostEyeKnobs, 'range', 0, 0.02, 0.001);
  eyes.add(ghostEyeKnobs, 'spring', 20, 300, 5);
  eyes.add(ghostEyeKnobs, 'damp', 0.4, 0.98, 0.01);
  eyes.add(ghostEyeKnobs, 'kick', 0, 0.1, 0.005);
  eyes.add(ghostEyeKnobs, 'faceYFrac', 0, 1, 0.02).onFinishChange(respawn);
  eyes.add(ghostEyeKnobs, 'whiteX', 0, 0.03, 0.001).onFinishChange(respawn);
  eyes.add(ghostEyeKnobs, 'whiteZ', 0.02, 0.06, 0.001).onFinishChange(respawn);

  const text = gui.addFolder('text');
  text.add(textKnobs, 'fill', 0.3, 1, 0.02);
  text.add(textKnobs, 'floatHeight', 0, 0.2, 0.005);

  const lg = render.lights;
  if (lg) {
    const lights = gui.addFolder('lights');
    const addLight = (name: string, l: Light, maxI: number) => {
      const f = lights.addFolder(name);
      const proxy = { color: '#' + l.color.getHexString() };
      f.addColor(proxy, 'color').onChange((v: string) => l.color.set(v));
      f.add(l, 'intensity', 0, maxI, 0.05);
      return f;
    };
    addLight('hemi', lg.hemi as unknown as Light, 2);
    const sun = addLight('sun', lg.sun as unknown as Light, 8);
    sun.add(lg.sun.position, 'x', -4, 4, 0.1);
    sun.add(lg.sun.position, 'y', 0, 5, 0.1);
    sun.add(lg.sun.position, 'z', -4, 4, 0.1);
    addLight('fore', lg.fore as unknown as Light, 3);
    addLight('back', lg.back as unknown as Light, 3);
  }

  const dumpLight = (l: Light) => ({
    color: '#' + l.color.getHexString(),
    intensity: +l.intensity.toFixed(2),
    pos: [l.position.x, l.position.y, l.position.z].map((n) => +n.toFixed(2)),
  });
  gui.add({
    'copy JSON': () => {
      const all: Record<string, unknown> = { maneKnobs, hornKnobs, uniFaceKnobs, ghostEyeKnobs, textKnobs };
      if (lg) all.lights = {
        hemi: dumpLight(lg.hemi as unknown as Light), sun: dumpLight(lg.sun as unknown as Light),
        fore: dumpLight(lg.fore as unknown as Light), back: dumpLight(lg.back as unknown as Light),
      };
      navigator.clipboard?.writeText(JSON.stringify(all, null, 2));
    },
  }, 'copy JSON');
}
