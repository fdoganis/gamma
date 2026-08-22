

import type { Game } from './Game';
import { Timer } from 'three';

const FPS = 60;
const FRAME_s = 1 / FPS;

export class GameLoop {
  #game!: Game;
  #timer: Timer = new Timer();
  #elapsed: number = 0;

  constructor(game: Game) {
    this.#game = game;
    this.#timer.connect(document)

  }

  tick = (_timestamp: number, frame?: XRFrame) => {
    this.#timer.update();
    this.#elapsed += this.#timer.getDelta();
    this.#game.processInput();

    while (this.#elapsed > FRAME_s) {
      this.#game.update(FRAME_s, frame);
      this.#elapsed -= FRAME_s;
    }

    this.#game.render();
  }
}

