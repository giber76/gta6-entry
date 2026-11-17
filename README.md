# Solara Bay — an open-world crime game

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/giber76/gta6-entry/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/giber76/gta6-entry/reward.svg)](https://make.fun/bounty/gta6-01)

An original open-world crime game built for the make.fun **gta6-01 "Make GTA 6"**
bounty. You are **Marlo Vance**, a driver-for-hire in the fictional sun-soaked
coastal city of **Solara Bay**, working five jobs for your fixer **Rico Salas** —
from stealing a coupe to the big score at Meridian Bank.

Nothing here comes from any commercial game: the city, characters, story, cars
and sounds are all original, built with three.js (vendored under
`game/vendor/`) and procedural art and WebAudio sound generated at runtime.
The game makes zero network requests.

## Play

Serve `game/` with any static server and open `index.html` in a desktop browser:

```
node serve.ts   # then open http://localhost:8080
```

**Controls:** WASD move / drive · mouse look · SPACE handbrake · E enter/steal car ·
Q fists/pistol · click punch/shoot · SHIFT sprint · P/ESC pause · M mission list.

## What's in the game

- A full grid city on foot and by car: buildings, parks, parking lots, a plaza
  with a fountain, palm-lined beach and ocean
- Traffic AI cars and pedestrians on the sidewalks
- Cars to steal (wanted rises if anyone sees you), arcade driving with handbrake
- Wanted level 0–5 stars, police cars that chase and ram, foot officers, wanted decay
- 5-mission story chain with objective markers, dialogue and cash rewards
- Combat: fists + pistol, rival "Crimson Vipers" gang enemies, muzzle flash + tracers
- HUD: health, cash, wanted stars, 2D minimap, mission objective, speedometer
- Start screen, pause menu, win/lose screens, localStorage save (auto + on pause)
- Synthesized sound: engine hum, sirens, gunshots, pickups, crash thuds

## Structure

```
game/
  index.html          menus + HUD shell
  vendor/three.min.js vendored three.js r149 (not our source)
  src/
    main.js       game loop, state machine, enter/steal, wiring
    city.js       Solara Bay: roads, buildings, beach, palms, colliders
    player.js     on-foot movement + third-person camera
    vehicles.js   car factory + arcade driving physics
    traffic.js    AI traffic on the road grid
    pedestrians.js sidewalk walkers who scatter from danger
    police.js     wanted level, chases, rams, decay
    missions.js   5-mission story chain, markers, dialogue, rewards
    combat.js     fists, pistol raycast, gang enemies
    hud.js        health / cash / stars / objective / prompts
    minimap.js    2D top-down map (player, cars, police, marker)
    audio.js      WebAudio synth: engine, siren, gunshots
    save.js       localStorage save / load
    input.js      keyboard + mouse (pointer lock / drag)
    util.js       seeded RNG, math, procedural textures
    debug.js      window.__solara hooks used by play-tests
```

See `BUILD-NOTES.md` for design decisions, play-test results and what was cut.
