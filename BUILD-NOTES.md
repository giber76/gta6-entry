# Solara Bay — BUILD NOTES (not part of the game)

Entry for make.fun gta6-01 "Make GTA 6". Built in this session, all game code
written by hand in this session (three.js r149 vendored as `game/vendor/three.min.js`).

> **Recording status: UNRECORDED.** This competition takes strict transcripts
> and all 8 recording slots are held by stale recordings until ~03:55 WIB
> 2026-11-18. This build was made without a recording, so it **cannot be
> submitted as-is**. The parent agent will run a **recorded rebuild** later,
> following this design and code, once a slot frees. Do not submit this commit.

## What it is

**Solara Bay** — an original open-world crime game (three.js, static files, zero
network requests). You are Marlo Vance, a driver-for-hire in a fictional
sun-soaked coastal city, working five jobs for your fixer Rico Salas.

## File list

```
main.ts                  entrypoint: copies game/ + screenshots/ to /output, writes dossier.json
serve.ts                 dev static server (kit copy)
vendor/makefun-game.ts   kit copy, unchanged
game/index.html          menus + HUD shell (start / pause / busted / win screens)
game/vendor/three.min.js three.js r149 UMD (vendored, not our source)
game/src/main.js         game loop, state machine, enter/steal, wiring
game/src/city.js         Solara Bay: road grid, buildings, beach/ocean, palms, plaza, colliders
game/src/player.js       on-foot movement + third-person orbit camera
game/src/vehicles.js     car factory + arcade driving (accel/brake/reverse/handbrake)
game/src/traffic.js      AI traffic on the road grid (turns at intersections, yields)
game/src/pedestrians.js  sidewalk walkers who scatter from fast cars / gunshots
game/src/police.js       wanted 0-5, police cars that chase/ram, foot officers, decay
game/src/missions.js     5-mission story chain, markers, dialogue, rewards
game/src/combat.js       fists, pistol raycast, muzzle flash/tracers, gang enemies
game/src/hud.js          health/cash/stars/objective/prompts/dialogue/toasts
game/src/minimap.js      2D top-down map (player, cars, police, marker, enemies)
game/src/audio.js        WebAudio synth: engine hum, siren, gunshots, pickups
game/src/save.js         localStorage save/load (cash, mission, position, health)
game/src/input.js        keyboard + mouse (pointer lock / drag)
game/src/util.js         seeded RNG, math, procedural facade/blob textures
game/src/debug.js        window.__solara hooks used by play-tests/screenshots only
screenshots/            4 real Playwright renders (1280x720 JPEG, see below)
```

## Controls

WASD move/drive · mouse look · SPACE handbrake · E enter/steal car ·
Q fists/pistol · click punch/shoot · SHIFT sprint · P/ESC pause · M mission list.

## The five missions (Marlo + Rico)

1. **Wheels for Rico** ($500) — steal the orange coupe by the plaza, drive it to
   Rico's garage at Harbor Road.
2. **Lose the Heat** ($800) — the coupe was hot; wanted jumps to 2 stars. Stay out
   of sight until the stars clear.
3. **The Package** ($1,200) — on foot to the boardwalk pier, pick up the package
   (2 Crimson Vipers ambush), deliver to Coral Junction.
4. **Viper Nest** ($1,500) — pistol issued; eliminate 3 Crimson Vipers on Marina East.
5. **The Big Score** ($3,000) — Meridian Bank: grab the cash (4 s hold), wanted
   jumps to 3, escape to the boardwalk safehouse. Win screen → free roam.

Stealing a car raises wanted by 1 **only if witnessed** (police within 90 u or a
pedestrian within 22 u). Killing a pedestrian/officer raises wanted. Wanted
decays one star per 12 s out of every officer's sight (70 u).

## Design decisions

- **Deterministic city**: seeded RNG (mulberry32) — same layout every load.
- **One job per file**, named for what it does (judge criterion 5 reads the outline).
- **Procedural everything**: building facades are canvas textures; no external
  art, audio or fonts; the game makes zero network requests.
- **Arcade, not sim**: driving is accelerate/steer/handbrake with building
  push-out collision; traffic yields to the player; police ram rather than PIT.
- **Dialogue** advances on ENTER or auto-advances after 8 s; it does not pause
  the world (keeps the game honest about danger).
- **Save** on mission completion, pause-quit and every 20 s; Continue on the
  start screen when a save exists.
- **Debug hooks** (`window.__solara`, `src/debug.js`) exist only so automated
  play-tests and the screenshot run can stage scenes; they change nothing in
  normal play.

## Play-test results (headless Chromium + SwiftShader, ~5 fps — real browsers run 60)

Play-tested 2026-11-17 with Playwright scripts (`/tmp/playtest1.py`,
`/tmp/playtest2.py`, `/tmp/playtest3.py`, `/tmp/shots.py` — not in the repo).
Zero console errors, zero failed requests in every run.

- Start screen → playing; HUD (health/cash/stars/objective/minimap/speed) renders.
- Walking on foot works; entering the mission coupe works; driving works
  (reached 144 km/h in the chase run).
- **Full mission chain completed end-to-end**: M1 $500 → M2 $1,300 → M3 $2,500
  (ambush spawned) → M4 $4,000 (3 Viper kills by pistol; enemies shot back,
  health 100→93) → M5 $7,000 → win screen → free-roam continue. Pause/resume
  works. Save file written to localStorage and reloadable.
- Wanted 3 spawns 3 police cars; they chase, ram, and damage the player
  (health 93→75 during the M5 escape).
- Screenshots are real renders of the running game, staged only through the
  debug hooks (teleport / setWanted / setMission / faceNearestEnemy).

## Bugs found and fixed during testing

1. **Player position did not follow the car** — `player.pos` stayed at the entry
   point while driving, so drive-to markers could never complete. Fixed: sync
   `player.pos` to the car each frame while driving (`src/main.js`).
2. **Foot officers punched the player through the car** (health 100→92 while
   driving at wanted 3). Fixed: officers only damage on-foot players.
3. **Sidewalk shadow acne** — light sidewalk planes showed a striped moiré from
   the 1024 shadow map. Fixed: `shadow.bias`/`normalBias` tuned and sidewalks
   no longer receive shadows.
4. **Sidewalks overlapped building faces** by 1.5 u (pedestrians clipped into
   walls). Fixed: building inset increased (margin 1.5→3.0).
5. Shadow map 2048→1024 for headless performance (still looks right; ~5 fps in
   SwiftShader vs 1 fps before — a real GPU browser is unaffected).

## What does NOT work / was cut

- **No recording** (see top): unrecorded build, needs a recorded rebuild to submit.
- **No shooting from a car** — pistol/punch are on-foot only (crosshair hidden
  while driving). Drive-by is a mission name, not a mechanic.
- **No minimap zoom/rotation** — fixed north-up view; it follows the player.
- **No car damage model / explosions** — collisions slow and bounce the car only.
- **No radio/music** — engine/siren/effects only (WebAudio synth).
- **Traffic does not avoid the player on foot perfectly** — a speeding AI car can
  still hit the player (12 damage + knockback, by design).
- **Enemy AI is simple** — Vipers advance and shoot with poor aim; no cover,
  no flanking.
- **M3 ambush Vipers persist** into later missions if not killed (they stay
  hostile in free roam; harmless to the story).
- **Headless SwiftShader runs ~5 fps** on this VM; on a real desktop GPU the
  game is light (~150 draw calls, 1024 shadow map). `dt` is clamped at 0.1 s so
  low-fps machines stay playable, just slower.

## Gate check (run 2026-11-17, after final fixes)

- `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts` — runs clean; run twice,
  byte-identical output (`diff -r` clean).
- game/: **18 files, 695,877 bytes** (cap 993 files / 48 MiB). No symlinks.
- index.html 7,101 bytes (cap 1 MiB).
- References: **no `http(s):` or protocol-relative URLs anywhere** in
  `game/index.html` or `game/src/`; only `./vendor/three.min.js` and
  `./src/*.js` relative imports, all inside game/.
- All 16 `game/src/*.js` parse as ES modules (`node --check` as `.mjs`).
- screenshots/: 4 JPEGs, 1280×720 each, 66–128 KiB (cap 256 KiB, long side
  ≤1280, short side ≥480). First by name (`1-chase.jpg`) is the cover.
- dossier.json 598,054 bytes (cap 1.5 MiB), written by `buildDossier`.

## Screenshots

1. `1-chase.jpg` — cover: police car ramming the orange coupe, 3 wanted stars,
   minimap, mission objective, speed.
2. `2-driving.jpg` — driving down a city street, traffic car ahead.
3. `3-on-foot.jpg` — Marlo on foot at an intersection, traffic car passing.
4. `4-combat.jpg` — pistol out, crosshair, Crimson Vipers, mission 4 objective.
