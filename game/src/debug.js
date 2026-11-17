// Debug + play-test hooks for Solara Bay. Exposed as window.__solara so
// automated play-tests (and the screenshot run) can drive the game without
// a human hand: start, teleport, set wanted, jump to a mission, inspect state.
// These hooks change nothing about normal play.
export function installDebugHooks(G) {
  window.__solara = {
    version: '1.0.0',
    state: () => ({
      phase: G.phase,
      health: G.player.health,
      cash: G.player.cash,
      wanted: G.police.wanted,
      mission: G.missions.index,
      missionName: G.missions.missionName(),
      step: G.missions.step,
      objective: G.missions.objectiveText(),
      inCar: !!G.player.inCar,
      carSpeed: G.player.inCar ? Math.abs(G.player.inCar.speed) * 3.6 : 0,
      pos: [Math.round(G.player.pos.x * 10) / 10, Math.round(G.player.pos.z * 10) / 10],
      weapon: G.player.weapon,
      enemies: G.combat.enemies.length,
      traffic: G.traffic.count(),
      peds: G.pedestrians.peds.length,
      policeCars: G.police.cars.length,
      dialogue: G.missions.dialogue.length,
    }),
    startGame: () => G.startGame(false),
    teleport: (x, z) => {
      if (G.player.inCar) { G.player.inCar.pos.x = x; G.player.inCar.pos.z = z; }
      G.player.pos.x = x; G.player.pos.z = z;
      return true;
    },
    setWanted: (n) => { G.police.setWanted(n); return G.police.wanted; },
    setMission: (i) => {
      G.missions.index = Math.max(0, Math.min(i, 4));
      G.missions.dialogue = [];
      G.missions.start(G);
      return G.missions.missionName();
    },
    skipDialogue: () => { G.missions.dialogue = []; return true; },
    givePistol: () => { G.player.weapon = 'pistol'; return true; },
    addCash: (n) => { G.player.cash += n; return G.player.cash; },
    heal: () => { G.player.health = 100; return true; },
    spawnEnemyNear: (d) => {
      const a = Math.random() * Math.PI * 2;
      return G.combat.spawnEnemy(G.player.pos.x + Math.cos(a) * (d || 10), G.player.pos.z + Math.sin(a) * (d || 10), 60);
    },
    // Turn the player + camera to face the nearest enemy (play-test aiming).
    faceNearestEnemy: () => {
      let best = null, bd = 1e9;
      for (const e of G.combat.enemies) {
        const d = Math.hypot(e.pos.x - G.player.pos.x, e.pos.z - G.player.pos.z);
        if (d < bd) { best = e; bd = d; }
      }
      if (!best) return false;
      const yaw = Math.atan2(best.pos.x - G.player.pos.x, best.pos.z - G.player.pos.z);
      G.player.camYaw = yaw; G.player.heading = yaw;
      return Math.round(bd * 10) / 10;
    },
    enterNearestCar: () => G.tryEnterCar(true),
    exitCar: () => G.exitCar(),
    saveNow: () => G.saveGame(),
  };
}
