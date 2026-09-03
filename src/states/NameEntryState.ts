// Beat the hi-score → enter 3 initials, pinball style: three cylinders sit in
// the middle of the board with a letter on top that auto-cycles A→Z; tap one to
// lock its current letter (tap again to unlock and resume). A green cylinder
// behind the row confirms once all three are locked → HiScore.submit → Intro.
import { Mesh, MeshPhongMaterial, CylinderGeometry, Vector3 } from 'three';
import { State } from '../core/State';
import { SelectCommand } from '../commands/SelectCommand';
import { IntroState } from './IntroState';
import type { ITransition } from '../core/StateMachine';
import type { RenderingManager } from '../rendering/RenderingManager';
import type { TextManager } from '../text/TextManager';
import type { TextHandle } from '../text/ITextEngine';
import type { Score } from '../core/Score';
import type { HiScore } from '../core/HiScore';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const STEP_S = 0.32;            // seconds per cycled letter
const CYL_R = 0.045;
const CYL_H = 0.11;
const Y_m = CYL_H / 2;         // sit on the table
const SLOT_X = [-0.13, 0, 0.13]; // in the gap between the two hole crosses

const _o = new Vector3();

type Slot = { mesh: Mesh<CylinderGeometry, MeshPhongMaterial>; label: TextHandle; letter: string; locked: boolean };

export class NameEntryState extends State {
  #sm: ITransition;
  #text: TextManager;
  #render: RenderingManager;
  #score: Score;
  #hi: HiScore;

  #geo = new CylinderGeometry(CYL_R, CYL_R, CYL_H, 16);
  #slots: Slot[] = [];
  #confirm!: Mesh<CylinderGeometry, MeshPhongMaterial>;
  #ok!: TextHandle;
  #t = 0;

  constructor(sm: ITransition, text: TextManager, render: RenderingManager, score: Score, hi: HiScore) {
    super();
    this.#sm = sm;
    this.#text = text;
    this.#render = render;
    this.#score = score;
    this.#hi = hi;
    this.on(SelectCommand, this.#onSelect);
  }

  override enter() {
    this.#t = 0;
    for (let i = 0; i < 3; i++) {
      const mesh = new Mesh(this.#geo, new MeshPhongMaterial({ color: '#dddddd' }));
      mesh.position.set(SLOT_X[i], Y_m, 0);
      this.#render.anchor.add(mesh);
      this.#slots.push({ mesh, label: this.#text.show('A', mesh, { color: '#111111' }), letter: 'A', locked: false });
    }
    this.#confirm = new Mesh(this.#geo, new MeshPhongMaterial({ color: '#22cc55' }));
    this.#confirm.position.set(0, Y_m, -0.17); // green, behind the back hole row
    this.#render.anchor.add(this.#confirm);
    this.#ok = this.#text.show('OK', this.#confirm, { color: '#ffffff' });
  }

  override update(delta: number) {
    this.#t += delta;
    const ch = LETTERS[Math.floor(this.#t / STEP_S) % 26];
    for (const s of this.#slots) {
      if (s.locked) continue;
      s.letter = ch;
      this.#text.setText(s.label, ch);
    }
  }

  #onSelect = (cmd: SelectCommand) => {
    if (__DEV__ && cmd.debugRandom) {
      const s = this.#slots.find((x) => !x.locked);
      if (s) s.locked = true; else this.#confirmName();
      return;
    }
    // Pick by tap position in the board's local frame: a tap past the slot row
    // hits the confirm cylinder, otherwise the nearest of the three by X.
    _o.setFromMatrixPosition(cmd.transform.matrixWorld);
    this.#render.anchor.worldToLocal(_o);
    if (_o.z < -0.09) { this.#confirmName(); return; }
    let i = 0;
    for (let k = 1; k < 3; k++) if (Math.abs(_o.x - SLOT_X[k]) < Math.abs(_o.x - SLOT_X[i])) i = k;
    this.#slots[i].locked = !this.#slots[i].locked; // lock at the shown letter, or unlock
  };

  #confirmName() {
    if (this.#slots.some((s) => !s.locked)) return;
    this.#hi.submit(this.#score.value, this.#slots.map((s) => s.letter).join(''));
    this.#sm.change(IntroState);
  }

  override exit() {
    for (const s of this.#slots) {
      this.#text.remove(s.label);
      this.#render.anchor.remove(s.mesh);
      s.mesh.material.dispose();
    }
    this.#slots.length = 0;
    this.#render.anchor.remove(this.#confirm);
    this.#confirm.material.dispose();
    this.#text.remove(this.#ok);
  }
}
