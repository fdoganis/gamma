# Hand-whack calibration

`HandSource`'s whack detector (`src/input/HandSource.ts`) fires on a downward
palm strike near the placed surface. Its thresholds — `SPEED_MIN_mps`,
`BAND_LOW_m` / `BAND_HIGH_m`, `COOLDOWN_ms`, `WHACK_REACH_m` — are educated
guesses until they're checked against **real Quest hand-tracking data**. This
folder is how you capture that.

Two ways, same output (a JSON of per-frame joint poses on the Mac):

| | what | where |
|---|---|---|
| **`?calib`** | guided scene in the game — target cubes, HUD directions, auto-send | `src/states/CalibState.ts` (dev-only, folds out of prod) |
| **`xr-hand-recorder.html`** | bare page — records continuously, no scene, manual send | this folder |

Use `?calib` unless it won't start.

---

## Setup (once)

- `brew install cloudflared` — anonymous HTTPS tunnel, no account. WebXR needs a
  secure context, so a plain `http://<mac-ip>:5173` from the headset won't work.
- Quest: **Settings → Movement Tracking → Hand and Body Tracking → On**. (No
  Space Setup / furniture scan needed — `?calib` places the board from your
  hand, not hit-test.)

## Run `?calib`

1. Mac, terminal 1: `npm run dev`
2. Mac, terminal 2: `npm run cloud` → copy the `https://<words>.trycloudflare.com` line
3. Quest Browser → `https://<words>.trycloudflare.com/?calib` → **START XR**
4. **Place the board:** HUD reads `HAND ON TABLE - PINCH`. Rest your hand flat
   on the tabletop and pinch — the board snaps to that height. (Don't pinch
   within ~12 s and it just keeps the default height.)
5. **Phase 1 — 12 whacks.** A green cube rises from a hole; slap it down onto
   the surface → it bursts, HUD `WHACK 1`, next cube. Vary it: hard/fast,
   slower-deliberate; flat palm, a couple karate-chops, a couple fingers-first.
   **Rest your hand on the surface between whacks** — that rest is the data
   point the old detector choked on. Slow? it auto-advances every 2.5 s, just
   keep whacking on the beat.
6. **Phase 2 — ~15 s of non-whacks.** HUD `WAVE REACH REST - DO NOT HIT` +
   countdown. Glide the hand sideways at surface height, reach across, lower it
   slowly to rest. **Don't strike.** This is the false-positive data.
7. **Phase 3.** HUD `DONE - PINCH TO SAVE`. Pinch → it POSTs the capture to the
   dev server (`SAVED - EXIT XR`), then exit XR however you like. Exiting XR
   without pinching also saves (backstop). File: `tests/fixtures/calib-<ts>.json`
   (`[record-sink] saved …` in terminal 1).

Run it 2–3 times; one file gets us going. Each session is a new file.

## Fallback: `xr-hand-recorder.html`

Open `https://<tunnel>/tests/tools/xr-hand-recorder.html`, **Enter XR**, do the
same movements freehand (no cubes, no HUD — just remember the sequence), exit,
then **Send to Mac** (or **Download** → pull off the headset with Android File
Transfer). It also prints a per-strike summary (peak downward speed, palm Y,
lowest Y ≈ your surface).

## The file

`{ ua, started, frames: [{ t, hand, phase, m:[x,y,z], w:[…], i:[…], r, hit?:[x,y,z] }] }`
— `m`/`w`/`i` = metacarpal / wrist / index-tip world positions in `local-floor`
space; `phase` = `whack` | `idle` | `done`; `hit` present on frames where a
target was whacked. From it: the real peak downstroke speed, the palm height
where it stops, the deceleration time → set the `HandSource` consts to fit the
whacks while rejecting the phase-2 motion, and add a replay spec built from the
file.

## Troubleshooting

| symptom | fix |
|---|---|
| "XR not supported" / no START XR | you opened `http://…:5173`, not the `https://…trycloudflare.com` URL |
| START XR errors | hand tracking off in Settings, or the session prompt was denied |
| `npm run cloud`: command not found | `brew install cloudflared` |
| page won't load over the tunnel | the tunnel URL changed — use the newest `npm run cloud` line |
| nothing saved on the Mac | both terminals + tunnel still up? use `xr-hand-recorder.html` → Download |
| board is too low / high | you pinched with your hand not flat on the table — reload and redo the place step |
