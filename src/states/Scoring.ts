// The scoring + feedback side of a round, split out of RunState: the streak, the
// running Score, which rainbow colors are in, the "+N" popups, and the unicorn
// penalty. RunState still owns the spawn scheduler, the countdown and the state
// transitions — it just asks Scoring "is this color collected?" / "did this hit
// win it?" and forwards misses.
import { Object3D } from 'three';
import type { Vector3 } from 'three';
import type { World } from '../world/World';
import type { RemovedActor } from '../world/Actors';
import type { RenderingManager } from '../rendering/RenderingManager';
import type { Score } from '../core/Score';
import type { TextManager } from '../text/TextManager';
import type { TextHandle } from '../text/ITextEngine';

// The 7 stolen colors of the rainbow — game data. An actor carries one; its
// index here is the actor's `tag`. Shared with RunState's spawn scheduler.
export const RAINBOW = ['#F00', '#FF7F00', '#FF0', '#0F0', '#00F', '#4B0082', '#8B00FF'];

const POINTS_PER_STREAK = 100; // k-th unbroken collect scores k * this
const TIME_BONUS_PER_S = 50;   // leftover seconds → points on a win
const PENALTY_PTS = 200;       // docked when the unicorn is tapped with no color to snatch back
const UNICORN_HEX = '#f3ead7'; // cream — popup color for a decoy hit

const POPUP_LIFE_S = 0.9;
const POPUP_RISE_MPS = 0.28;    // metres/s the "+N" drifts upward
const POPUP_BLINK_FROM_S = 0.5; // start the Pac-Man/DK blink here
const POPUP_BLINK_HZ = 8;

type Popup = { handle: TextHandle; obj: Object3D; t: number };

export class Scoring {
  #world: World;
  #text: TextManager;
  #render: RenderingManager;
  #score: Score;

  #streak = 0;
  #collected = new Set<number>(); // rainbow indices retrieved this round
  #order: number[] = [];          // same indices in collect order — the unicorn snatches the last one back
  #popups: Popup[] = [];
  #label: TextHandle | null = null;

  constructor(world: World, text: TextManager, render: RenderingManager, score: Score) {
    this.#world = world;
    this.#text = text;
    this.#render = render;
    this.#score = score;
  }

  hasColor(i: number): boolean { return this.#collected.has(i); }

  // A normal (non-unicorn) hit: bump the streak, score k*100, float a "+N"
  // popup, and light the arc the first time a color comes in. Returns true when
  // that hit completed the set (RunState then awards the time bonus and wins).
  collect(removed: RemovedActor): boolean {
    this.#streak += 1;
    const pts = this.#streak * POINTS_PER_STREAK;
    this.#score.add(pts);
    this.#text.setText(this.#label!, String(this.#score.value));
    this.#popup(removed.position, `#${removed.color.getHexString()}`, pts);

    if (!this.#collected.has(removed.tag)) {
      this.#collected.add(removed.tag);
      this.#order.push(removed.tag);
      this.#world.lightRainbow(removed.tag, RAINBOW[removed.tag]);
      return this.#collected.size === RAINBOW.length;
    }
    return false;
  }

  // Tapped the decoy. Break the streak and snatch the most-recently collected
  // color back (its arc grays and it can spawn again); with nothing to snatch,
  // dock points instead. Level-scaled harsher later.
  hitUnicorn(pos: Vector3): void {
    this.#streak = 0;
    const lost = this.#order.pop();
    if (lost !== undefined) {
      this.#collected.delete(lost);
      this.#world.unlightRainbow(lost);
      this.#popup(pos, UNICORN_HEX, -1); // "-1" arc, next to the graying arc
    } else {
      this.#score.add(-PENALTY_PTS);
      this.#text.setText(this.#label!, String(this.#score.value));
      this.#popup(pos, UNICORN_HEX, -PENALTY_PTS);
    }
  }

  missed(): void { this.#streak = 0; } // an actor sank unhit

  awardTimeBonus(timeLeft: number): void {
    this.#score.add(Math.max(0, Math.ceil(timeLeft)) * TIME_BONUS_PER_S);
  }

  update(delta: number): void {
    for (let i = this.#popups.length - 1; i >= 0; i--) {
      const p = this.#popups[i];
      p.t += delta;
      p.obj.position.y += POPUP_RISE_MPS * delta;
      if (p.t >= POPUP_BLINK_FROM_S) {
        this.#text.setVisible(p.handle, Math.floor(p.t * POPUP_BLINK_HZ) % 2 === 0);
      }
      if (p.t >= POPUP_LIFE_S) {
        this.#text.remove(p.handle);
        this.#render.anchor.remove(p.obj);
        this.#popups.splice(i, 1);
      }
    }
  }

  reset(): void {
    this.#streak = 0;
    this.#collected.clear();
    this.#order.length = 0;
    this.#label = this.#text.show(String(this.#score.value), this.#render.scoreAnchor, { color: '#ffffff' });
  }

  teardown(): void {
    if (this.#label) { this.#text.remove(this.#label); this.#label = null; }
    for (const p of this.#popups) { this.#text.remove(p.handle); this.#render.anchor.remove(p.obj); }
    this.#popups.length = 0;
  }

  // localPos is anchor-local (same space as the sparkle burst) → parent the
  // popup's carrier Object3D under the same anchor.
  #popup(localPos: Vector3, colorHex: string, pts: number): void {
    const obj = new Object3D();
    obj.position.copy(localPos);
    this.#render.anchor.add(obj);
    const handle = this.#text.show(pts < 0 ? `${pts}` : `+${pts}`, obj, { color: colorHex });
    this.#popups.push({ handle, obj, t: 0 });
  }
}
