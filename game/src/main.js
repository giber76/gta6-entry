// Solara Bay — main entry. Wires every system together: renderer, city,
// player, vehicles, traffic, pedestrians, police, missions, combat, HUD and
// save. Owns the game loop and the menu / playing / paused / over / win
// state machine. No network requests: three.js is vendored, everything else
// is generated at runtime.
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { buildCity, CITY_HALF } from './city.js';
import { Player } from './player.js';
import { spawnCar, driveCar, nearestCar, carSpeedKmh } from './vehicles.js';
import { Traffic } from './traffic.js';
import { Pedestrians } from './pedestrians.js';
import { Police } from './police.js';
import { Combat } from './combat.js';
import { Missions } from './missions.js';
import { HUD } from './hud.js';
import { saveGameData, loadGameData, hasSave } from './save.js';
import { installDebugHooks } from './debug.js';

const BOUNDS = 235; // city + beach; ocean blocks further travel

const G = {
  phase: 'menu', // menu | playing | paused | over | win
  scene: null, camera: null, renderer: null,
  input: null, audio: null, hud: null,
  city: null, player: null, traffic: null, pedestrians: null,
  police: null, combat: null, missions: null,
  cars: [], parkedCars: [], missionCar: null,
  spawnCar, // handed to missions so it can place the orange coupe
  saveTimer: 0,
};

function el(id) { return document.getElementById(id); }

function init() {
  const canvas = el('game');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
  camera.position.set(0, 6, 40);
  G.renderer = renderer; G.scene = scene; G.camera = camera;
  G.input = new Input(canvas);
  G.audio = new AudioEngine();
  G.hud = new HUD();
  G.city = buildCity(scene);
  G.player = new Player(scene);
  G.traffic = new Traffic(scene);
  G.pedestrians = new Pedestrians(scene, G.city.sidewalkSpots);
  G.police = new Police(scene, G.city.colliders);
  G.combat = new Combat(scene);
  G.missions = new Missions(scene);

  // parked cars from the city's parking spots
  for (const s of G.city.parkSpots.slice(0, 24)) {
    const car = spawnCar(scene, s.x, s.z, s.heading, s.color, 'civilian');
    car.parked = true;
    G.parkedCars.push(car);
  }
  G.traffic.populate(12);
  G.pedestrians.populate(22);
  G.refreshCarList();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // menu buttons
  el('startBtn').addEventListener('click', () => { G.audio.ensure(); G.startGame(false); });
  el('continueBtn').addEventListener('click', () => { G.audio.ensure(); G.startGame(true); });
  el('resumeBtn').addEventListener('click', () => G.resume());
  el('quitBtn').addEventListener('click', () => { G.saveGame(); G.toMenu(); });
  el('retryBtn').addEventListener('click', () => G.respawn());
  el('freeRoamBtn').addEventListener('click', () => { el('winScreen').style.display = 'none'; G.phase = 'playing'; G.hud.show(); });
  if (hasSave()) el('continueBtn').style.display = 'inline-block';

  installDebugHooks(G);
  window.__solaraReady = true;
  requestAnimationFrame(loop);
}

G.refreshCarList = function () {
  G.cars.length = 0;
  for (const c of G.parkedCars) G.cars.push(c);
  for (const c of G.traffic.cars) G.cars.push(c);
  for (const c of G.police.cars) G.cars.push(c);
  if (G.missionCar && !G.cars.includes(G.missionCar)) G.cars.push(G.missionCar);
};

G.startGame = function (continueSave) {
  const save = continueSave ? loadGameData() : null;
  el('startScreen').style.display = 'none';
  el('overScreen').style.display = 'none';
  el('winScreen').style.display = 'none';
  el('pauseScreen').style.display = 'none';
  G.hud.show();
  G.phase = 'playing';
  if (save) {
    G.player.cash = save.cash || 0;
    G.player.health = save.health || 100;
    G.player.weapon = save.weapon || 'fists';
    G.player.pos.set(save.x || 0, 0, save.z || 24);
    G.missions.index = Math.min(save.missionIndex || 0, 4);
    G.hud.toast('Save loaded — welcome back to Solara Bay');
  } else {
    G.player.cash = 0;
    G.player.health = 100;
    G.player.pos.set(0, 0, 24);
    G.missions.index = 0;
  }
  G.police.clearAll();
  G.combat.clearEnemies();
  G.missions.dialogue = [];
  G.missions.start(G);
};

G.toMenu = function () {
  G.phase = 'menu';
  G.hud.hide();
  el('pauseScreen').style.display = 'none';
  el('startScreen').style.display = 'flex';
  if (hasSave()) el('continueBtn').style.display = 'inline-block';
};

G.pause = function () {
  if (G.phase !== 'playing') return;
  G.phase = 'paused';
  el('pauseScreen').style.display = 'flex';
  G.audio.setEngine(0, false);
  G.audio.setSiren(false);
  G.saveGame();
};

G.resume = function () {
  el('pauseScreen').style.display = 'none';
  G.phase = 'playing';
};

G.respawn = function () {
  el('overScreen').style.display = 'none';
  G.player.reset(0, 0, 24);
  G.player.pos.set(0, 0, 24);
  G.police.clearAll();
  G.combat.clearEnemies();
  G.phase = 'playing';
  G.hud.show();
  G.hud.toast('You wake up at the plaza clinic. Rico is not happy.');
};

G.onAllMissionsDone = function () {
  G.phase = 'win';
  G.hud.hide();
  el('winScreen').style.display = 'flex';
  G.saveGame();
};

G.saveGame = function () { saveGameData(G); };

// --- car enter / steal ----------------------------------------------------
G.tryEnterCar = function (force) {
  const p = G.player;
  if (p.inCar) return false;
  const car = nearestCar(G.cars, p.pos.x, p.pos.z, 4.2);
  if (!car) return false;
  const wasParked = car.parked;
  const isMissionCar = car === G.missionCar;
  // stealing: witnessed by police or a nearby pedestrian raises the heat
  if (wasParked && !isMissionCar) {
    let seen = false;
    for (const pc of G.police.cars) {
      if (Math.hypot(pc.pos.x - p.pos.x, pc.pos.z - p.pos.z) < 90) { seen = true; break; }
    }
    if (!seen) {
      const ped = G.pedestrians.nearest(p.pos.x, p.pos.z, 22);
      if (ped) seen = true;
    }
    if (seen) {
      G.police.addWanted(1, 'car-theft');
      G.hud.toast('Someone saw you steal that car! ★ Wanted level up');
    }
  }
  if (car.traffic) G.traffic.remove(car);
  car.parked = false;
  car.driver = p;
  p.inCar = car;
  p.mesh.visible = false;
  if (G.audio) G.audio.pickup();
  return true;
};

G.exitCar = function () {
  const p = G.player;
  if (!p.inCar) return false;
  const car = p.inCar;
  car.driver = null;
  car.parked = true;
  car.speed = 0;
  p.inCar = null;
  p.mesh.visible = true;
  // step out to the side of the car
  p.pos.set(car.pos.x + Math.cos(car.heading) * 2.2, 0, car.pos.z - Math.sin(car.heading) * 2.2);
  p.heading = car.heading;
  p.camYaw = car.heading;
  return true;
};

// --- main loop ------------------------------------------------------------
let lastT = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, Math.max(0.001, (now - lastT) / 1000));
  lastT = now;
  if (G.phase === 'playing') update(dt);
  G.renderer.render(G.scene, G.camera);
}

function update(dt) {
  const input = G.input, p = G.player;
  // pause
  if (input.readPress('KeyP') || input.readPress('Escape')) { G.pause(); return; }
  // dialogue advance
  if (G.missions.dialogue.length > 0 && input.readPress('Enter')) {
    G.missions.dialogue.shift();
    G.missions.dialogueTimer = 0;
  }
  // mission list
  if (input.readPress('KeyM')) {
    G.hud.toast(G.missions.listText(), 5);
  }
  // weapon switch
  if (input.readPress('KeyQ') && !p.inCar) {
    p.weapon = p.weapon === 'fists' ? 'pistol' : 'fists';
    G.hud.toast(p.weapon === 'pistol' ? 'Pistol ready — click to shoot' : 'Fists — click to punch');
  }

  const dialogueOpen = G.missions.dialogue.length > 0;
  if (p.inCar) {
    const crashed = driveCar(p.inCar, input, dt, G.city.colliders, BOUNDS);
    if (crashed && G.audio) G.audio.crash();
    // the player's position IS the car's while driving (missions, police
    // and the minimap all read player.pos)
    p.pos.x = p.inCar.pos.x; p.pos.z = p.inCar.pos.z;
    if (input.readPress('KeyE')) G.exitCar();
    G.audio.setEngine(carSpeedKmh(p.inCar), true);
    // car-vs-car bumps
    for (const other of G.cars) {
      if (other === p.inCar || other.driver) continue;
      const d = Math.hypot(other.pos.x - p.inCar.pos.x, other.pos.z - p.inCar.pos.z);
      if (d < 3.6 && d > 0.01) {
        const push = (3.6 - d) / 2;
        const nx = (p.inCar.pos.x - other.pos.x) / d, nz = (p.inCar.pos.z - other.pos.z) / d;
        p.inCar.pos.x += nx * push; p.inCar.pos.z += nz * push;
        if (!other.traffic) { other.pos.x -= nx * push; other.pos.z -= nz * push; }
        p.inCar.speed *= 0.7;
        if (Math.abs(p.inCar.speed) > 12 && G.audio) G.audio.crash();
      }
    }
  } else {
    if (!dialogueOpen) p.stepOnFoot(input, dt, G.city.colliders, BOUNDS);
    else input.takeMouse();
    G.audio.setEngine(0, false);
    // enter / steal car
    const near = nearestCar(G.cars, p.pos.x, p.pos.z, 4.2);
    if (near) {
      const label = near === G.missionCar ? 'Take the orange coupe'
        : near.parked ? 'Enter car' : 'Steal car';
      G.hud.showPrompt(`Press <b>E</b> — ${label}`);
      if (input.readPress('KeyE')) G.tryEnterCar(false);
    } else G.hud.hidePrompt();
    // traffic cars can hit a pedestrian player
    for (const tc of G.traffic.cars) {
      const d = Math.hypot(tc.pos.x - p.pos.x, tc.pos.z - p.pos.z);
      if (d < 1.8 && Math.abs(tc.speed) > 3) {
        if (p.takeDamage(12)) {
          p.pos.x += Math.sin(tc.heading) * 2; p.pos.z += Math.cos(tc.heading) * 2;
          if (G.audio) G.audio.crash();
        }
      }
    }
    // combat on foot
    if (!dialogueOpen && input.consumeClick()) {
      if (p.weapon === 'pistol' && p.shootCooldown <= 0) {
        p.shootCooldown = 0.28;
        const res = G.combat.shoot(G.camera, p, G.pedestrians, G.police, G.audio);
        if (res === 'enemy-down') { G.missions.registerKill(); G.hud.toast('Viper down'); }
        if (res === 'ped-down' || res === 'officer-down') G.police.addWanted(1, 'shooting');
      } else if (p.weapon === 'fists' && p.punchCooldown <= 0) {
        p.punchCooldown = 0.45;
        const res = G.combat.punch(p, G.pedestrians, G.audio);
        if (G.audio) G.audio.punch();
        if (res === 'enemy-down') { G.missions.registerKill(); G.hud.toast('Viper down'); }
        if (res === 'ped-down') G.police.addWanted(1, 'assault');
      }
    }
  }

  // world systems
  G.traffic.update(dt, p.pos, G.cars);
  const playerSpeed = p.inCar ? Math.abs(p.inCar.speed) : p.speed;
  G.pedestrians.update(dt, p.pos, playerSpeed, G.combat.gunshotAt);
  G.combat.gunshotAt = null;
  G.combat.update(dt, p, G.audio);
  G.police.update(dt, p, G.city.colliders, G.audio);
  G.missions.update(dt, G);
  p.updateCamera(G.camera, dt);
  G.refreshCarList();
  G.hud.update(dt, G);

  // death
  if (p.health <= 0) {
    G.phase = 'over';
    G.hud.hide();
    el('overText').textContent = G.police.wanted > 0
      ? 'The Solara Bay Police caught up with you.'
      : 'You went down in the streets of Solara Bay.';
    el('overScreen').style.display = 'flex';
    G.audio.setEngine(0, false);
    G.audio.setSiren(false);
    return;
  }
  // autosave
  G.saveTimer += dt;
  if (G.saveTimer > 20) { G.saveTimer = 0; G.saveGame(); }
  input.endFrame();
}

init();
