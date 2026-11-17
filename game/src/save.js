// Save / load for Solara Bay in localStorage: cash, mission progress,
// player position and health. Saved on mission completion, on pause-quit,
// and every 20 seconds while playing.
const KEY = 'solara-bay-save-v1';

export function saveGameData(G) {
  try {
    const data = {
      cash: G.player.cash,
      missionIndex: G.missions.index,
      health: G.player.health,
      x: G.player.pos.x,
      z: G.player.pos.z,
      weapon: G.player.weapon,
      savedAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (_) { return false; }
}

export function loadGameData() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (typeof d.cash !== 'number' || typeof d.missionIndex !== 'number') return null;
    return d;
  } catch (_) { return null; }
}

export function hasSave() { return loadGameData() !== null; }
export function clearSave() { try { localStorage.removeItem(KEY); } catch (_) {} }
