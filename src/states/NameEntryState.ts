// Beat the hi-score → enter 3 initials, pinball style: three cylinders sit in
// the middle of the board with a letter on top that auto-cycles A→Z (each
// staggered so all three letters differ); tap one to lock its shown letter (tap
// again to unlock and resume). A green cylinder behind the row confirms once all
// three are locked → HiScore.submit → Intro.
import { Mesh, MeshPhongMaterial, CylinderGeometry, Raycaster, Vector3 } from 'three';
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
const SPIN_RPS = 2;            // idle spin on an unlocked cylinder (juice; the label billboards)
const CYL_R = 0.045;
const CYL_H = 0.11;
const Y_m = CYL_H / 2;         // sit on the table
const SLOT_X = [-0.13, 0, 0.13]; // in the gap between the two hole crosses
const CONFIRM_Z = -0.17;      // behind the back hole row
const CONFIRM_HEX = '#22cc55';

const _o = new Vector3();
const _d = new Vector3();

type Slot = { mesh: Mesh<CylinderGeometry, MeshPhongMaterial>; label: TextHandle; letter: string; phase: number; locked: boolean };

export class NameEntryState extends State {
  #sm: ITransition;
  #text: TextManager;
  #render: RenderingManager;
  #score: Score;
  #hi: HiScore;

  #geo = new CylinderGeometry(CYL_R, CYL_R, CYL_H, 16);
  #ray = new Raycaster();
  #slots: Slot[] = [];
  #confirm!: Mesh<CylinderGeometry, MeshPhongMaterial>;
  #labels: TextHandle[] = []; // confirm caption + "NEW HI" prompt
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

  #letterAt(phase: number): string {
    return LETTERS[(Math.floor(this.#t / STEP_S) + phase) % 26];
  }

  override enter() {
    this.#t = 0;
    for (let i = 0; i < 3; i++) {
      const mesh = new Mesh(this.#geo, new MeshPhongMaterial({ color: '#dddddd' }));
      mesh.position.set(SLOT_X[i], Y_m, 0);
      this.#render.anchor.add(mesh);
      const label = this.#text.show('A', mesh, { color: '#111111' });
      this.#slots.push({ mesh, label, letter: 'A', phase: i * 7, locked: false });
    }
    this.#confirm = new Mesh(this.#geo, new MeshPhongMaterial({ color: CONFIRM_HEX }));
    this.#confirm.position.set(0, Y_m, CONFIRM_Z);
    this.#render.anchor.add(this.#confirm);
    this.#labels.push(this.#text.show('OK', this.#confirm, { color: '#ffffff' }));
    this.#labels.push(this.#text.show('NEW HI', this.#render.hudAnchor, { color: '#ffcc33' }));
  }

  override update(delta: number) {
    this.#t += delta;
    for (const s of this.#slots) {
      if (s.locked) continue;
      s.letter = this.#letterAt(s.phase);
      this.#text.setText(s.label, s.letter);
      s.mesh.rotation.y += delta * SPIN_RPS;
    }
  }

  #onSelect = (cmd: SelectCommand) => {
    if (__DEV__ && cmd.debugRandom) {
      const s = this.#slots.find((x) => !x.locked);
      if (s) s.locked = true; else this.#confirmName();
      return;
    }
    _o.setFromMatrixPosition(cmd.transform.matrixWorld);
    _d.set(0, 0, -1).transformDirection(cmd.transform.matrixWorld);
    this.#ray.set(_o, _d);
    const hit = this.#ray.intersectObjects([...this.#slots.map((s) => s.mesh), this.#confirm], false)[0]?.object;
    if (!hit) return;
    if (hit === this.#confirm) { this.#confirmName(); return; }
    const s = this.#slots.find((x) => x.mesh === hit)!;
    s.locked = !s.locked; // lock at the shown letter, or unlock to resume cycling
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
    for (const h of this.#labels) this.#text.remove(h);
    this.#labels.length = 0;
  }
}
