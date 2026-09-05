# Forking gamma to build a game

gamma is the engine. A js13k entry is a **fork** of it: your states, your art,
your `game.config.ts`, and — at the very end — the structural flattening the
byte budget needs. This is how to keep the fork getting gamma's fixes without a
merge nightmare.

## Don't fork yet

While the engine and your game are both moving, stay in **one repo** — your game
on a branch, or on `main` if gamma *is* the game for now. `game.config.ts` fork
knobs + the `__DEV__` define + tree-shaking already give you a minimal bundle
*without* a fork (`npm run pack` is ~12.5 KB with everything in). Fork only for
the final crunch, when you're deleting subsystems the config can't tree-shake
and you've stopped wanting engine changes — then the sync cost is a one-time
thing, not an ongoing tax.

## Setting up the fork

```
git clone <gamma-url> my-game
cd my-game
git remote rename origin fork      # your game's repo (push here)
git remote add gamma <gamma-url>   # the engine you pull fixes from
```

## Pulling engine fixes

`scripts/sync-from-gamma.mjs` wraps it:

```
node scripts/sync-from-gamma.mjs <gamma-url>   # first run only — adds the remote
node scripts/sync-from-gamma.mjs               # fetch + show what's new + merge gamma/main
node scripts/sync-from-gamma.mjs --pick <sha>  # take one commit instead of everything
```

Or by hand: `git fetch gamma`, then `git merge gamma/main` (everything since last
sync) or `git cherry-pick <sha>` (one fix). On a conflict, `git status` lists the
files; edit the `<<<<<<< ======= >>>>>>>` markers, `git add <file>`, then
`git commit` (merge) / `git cherry-pick --continue`.

Build + run the tests before pushing.

## Keeping merges cheap — the discipline

A conflict happens **only** where your fork edited a file gamma later also
edited. So concentrate your changes where gamma won't touch them:

| your change | put it | conflicts on merge? |
|---|---|---|
| new states, art, game entry point | **new files** (`src/game/…`, `src/art/…`) | never |
| behaviour swaps (which engine, which glyphs, …) | `game.config.ts` — add your own knobs | tiny, rare |
| tuning that must touch engine files (`core/palette.ts` values, `RenderingManager` light consts, `world/Rainbow.ts` offsets) | those files, edited in place | yes — small, ~30 s each |
| flatten the State pattern / delete `EntityManager` / inline single-use classes | one-time crunch, engine frozen | huge — **one-way door** |

The heavy flattening is a job you do **once, when you've stopped pulling from
gamma**. Doing it while you still want fixes trades ~100–150 packed bytes (per
`.doc/DECISIONS.md` D7 — roadroller already compresses repeated class shells to
almost nothing) for a permanent merge headache. Not worth it until the end.

## What gamma does to stay merge-friendly

- small, single-purpose commits → clean `cherry-pick`
- release tags (`vX.Y.Z`) → a fork can record "based on vX.Y.Z" and merge tag→tag
- the fork knobs / `__DEV__` / tree-shaking so most game-shaping needs **zero**
  engine edits
