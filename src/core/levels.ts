// Per-level difficulty — data, not code. Level N needs N of each color (49 taps
// at L7). `reps` is derived from the level number; only the pacing knobs vary,
// ramping harder each row. RunState reads a row in enter(); the scheduler uses
// it in place of module consts.
export type LevelConfig = {
  spawnEvery: number;    // seconds between spawn ticks
  jitter: number;        // random extra on top of spawnEvery
  maxActive: number;     // concurrent bodies (board has 8 holes)
  upMin: number;
  upMax: number;         // hold window before a body sinks
  unicornChance: number; // decoy roll per spawn tick
};

export const LEVELS: LevelConfig[] = [
  { spawnEvery: 0.90, jitter: 0.60, maxActive: 5, upMin: 0.7, upMax: 1.8, unicornChance: 0.12 },
  { spawnEvery: 0.80, jitter: 0.55, maxActive: 5, upMin: 0.7, upMax: 1.7, unicornChance: 0.14 },
  { spawnEvery: 0.72, jitter: 0.50, maxActive: 6, upMin: 0.6, upMax: 1.6, unicornChance: 0.16 },
  { spawnEvery: 0.64, jitter: 0.45, maxActive: 6, upMin: 0.6, upMax: 1.5, unicornChance: 0.18 },
  { spawnEvery: 0.56, jitter: 0.40, maxActive: 7, upMin: 0.5, upMax: 1.4, unicornChance: 0.20 },
  { spawnEvery: 0.48, jitter: 0.35, maxActive: 7, upMin: 0.5, upMax: 1.3, unicornChance: 0.22 },
  { spawnEvery: 0.40, jitter: 0.30, maxActive: 8, upMin: 0.4, upMax: 1.2, unicornChance: 0.25 },
];

export const LEVEL_COUNT = LEVELS.length;
