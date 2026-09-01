"use strict";

// Import only what you need, to help your bundler optimize final code size using tree shaking
// see https://developer.mozilla.org/en-US/docs/Glossary/Tree_shaking)

import { Game } from './core/Game'
const game = new Game();
game.preload(); // synth the audio buffers up front, before the loop starts
game.start();