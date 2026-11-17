// Missions + story: Marlo Vance, driver-for-hire, works five jobs for his
// fixer Rico Salas in Solara Bay. Each mission is a list of steps; a step is
// a reach marker, entering a car, losing the wanted level, or eliminating a
// number of rival "Crimson Vipers". Dialogue plays as a queue the player
// advances with ENTER. Rewards are cash, saved with the game.
import { clamp } from './util.js';

const RICO = 'RICO';
const MARLO = 'MARLO';

export const MISSION_DEFS = [
  {
    id: 'm1', name: 'Wheels for Rico', reward: 500,
    intro: [
      [RICO, 'Marlo. The client wants wheels, and my usual guy is in the hospital. There is a sunset-orange coupe parked by the plaza — take it.'],
      [MARLO, 'Take it? Rico, I am a driver, not a thief.'],
      [RICO, 'Today you are both. Bring it to my garage on Harbor Road. And try not to scratch it.'],
    ],
    steps: [
      { type: 'enterCar', text: 'Get in the orange coupe by the plaza', carAt: [8, 34] },
      { type: 'reach', text: 'Drive the coupe to Rico\'s garage', x: -90, z: -30, r: 8 },
    ],
  },
  {
    id: 'm2', name: 'Lose the Heat', reward: 800,
    intro: [
      [RICO, 'Bad news — that coupe was already hot. The Solara Bay Police just lit up your tail. Lose them before you come back.'],
      [MARLO, 'You could have mentioned that before I took it.'],
      [RICO, 'And miss your face? Get out of sight, stay out of sight, and the heat dies down.'],
    ],
    steps: [
      { type: 'loseWanted', text: 'Lose the police — stay out of sight until the stars clear' },
    ],
    onStart: (G) => { G.police.setWanted(2); },
  },
  {
    id: 'm3', name: 'The Package', reward: 1200,
    intro: [
      [RICO, 'A package is waiting on the boardwalk by the pier. Pick it up on foot — cars draw eyes down there. Deliver it to the drop at Coral Junction.'],
      [MARLO, 'What is in it?'],
      [RICO, 'Something that pays your rent. Do not open it. Do not drop it. And Marlo — the Vipers patrol the pier.'],
    ],
    steps: [
      { type: 'reach', text: 'Walk to the package on the boardwalk', x: 0, z: 186, r: 6, onArrive: (G) => { G.combat.spawnEnemy(14, 182, 60); G.combat.spawnEnemy(-14, 182, 60); } },
      { type: 'reach', text: 'Deliver the package to Coral Junction', x: 90, z: 90, r: 7 },
    ],
  },
  {
    id: 'm4', name: 'Viper Nest', reward: 1500,
    intro: [
      [RICO, 'The Crimson Vipers taxed my last three couriers. That ends tonight. Take the pistol from the glovebox and clear their corner on Marina East.'],
      [MARLO, 'Three of them, armed, and me alone. Fine. It is Tuesday.'],
      [RICO, 'Three Vipers down, then come home. Try to come home in one piece.'],
    ],
    steps: [
      { type: 'kill', text: 'Eliminate the Crimson Vipers on Marina East (0/3)', count: 3, spawnAt: [150, -30] },
    ],
    onStart: (G) => { G.player.weapon = 'pistol'; },
  },
  {
    id: 'm5', name: 'The Big Score', reward: 3000,
    intro: [
      [RICO, 'The Meridian Bank moves its weekend cash tonight, one van, one guard who naps. We take the van\'s load and we are done — Solara Bay is ours.'],
      [MARLO, 'One van. One nap. One big score. Let us go.'],
      [RICO, 'Grab the cash, then run. The whole SBPD will be on you. Get to the safehouse on the boardwalk and do not stop for anyone.'],
    ],
    steps: [
      { type: 'reach', text: 'Drive to Meridian Bank', x: -30, z: 30, r: 8 },
      { type: 'wait', text: 'Grabbing the cash… stay close', x: -30, z: 30, r: 9, seconds: 4, onStart: (G) => { G.police.setWanted(3); } },
      { type: 'reach', text: 'ESCAPE! Reach the boardwalk safehouse', x: 0, z: 186, r: 8 },
    ],
  },
];

export class Missions {
  constructor(scene) {
    this.scene = scene;
    this.index = 0;       // mission index, 0..4; 5 = all done
    this.step = 0;
    this.active = false;
    this.dialogue = [];   // queued [who, text]
    this.dialogueTimer = 0;
    this.kills = 0;
    this.waitTimer = 0;
    this.done = false;
    // marker: beacon cylinder + floating diamond
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.14, depthWrite: false });
    this.beacon = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 30, 16, 1, true), mat);
    this.beacon.visible = false;
    scene.add(this.beacon);
    this.diamond = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.1),
      new THREE.MeshBasicMaterial({ color: 0xffd23e }));
    this.diamond.visible = false;
    scene.add(this.diamond);
    this.markerPos = null;
  }
  get current() { return MISSION_DEFS[this.index] || null; }
  get currentStep() { const m = this.current; return m ? m.steps[this.step] : null; }
  start(G) {
    const m = this.current;
    if (!m) { this.active = false; return; }
    this.active = true;
    this.step = 0;
    this.kills = 0;
    this.waitTimer = 0;
    this.dialogue = m.intro.map(([w, t]) => ({ who: w, text: t }));
    this.dialogueTimer = 0;
    if (m.onStart) m.onStart(G);
    this.enterStep(G);
  }
  enterStep(G) {
    const s = this.currentStep;
    if (!s) { this.completeMission(G); return; }
    if (s.type === 'reach' || s.type === 'wait') {
      this.markerPos = { x: s.x, z: s.z };
      this.beacon.position.set(s.x, 15, s.z);
      this.diamond.position.set(s.x, 6, s.z);
      this.beacon.visible = true; this.diamond.visible = true;
    } else if (s.type === 'enterCar') {
      this.markerPos = { x: s.carAt[0], z: s.carAt[1] };
      this.beacon.position.set(s.carAt[0], 15, s.carAt[1]);
      this.diamond.position.set(s.carAt[0], 6, s.carAt[1]);
      this.beacon.visible = true; this.diamond.visible = true;
      // make sure the orange coupe exists there
      if (!G.missionCar) {
        G.missionCar = G.spawnCar(G.scene, s.carAt[0], s.carAt[1], Math.PI / 2, 0xe87a2a, 'civilian');
        G.cars.push(G.missionCar);
      }
    } else if (s.type === 'kill') {
      this.markerPos = { x: s.spawnAt[0], z: s.spawnAt[1] };
      this.beacon.position.set(s.spawnAt[0], 15, s.spawnAt[1]);
      this.diamond.position.set(s.spawnAt[0], 6, s.spawnAt[1]);
      this.beacon.visible = true; this.diamond.visible = true;
      for (let i = 0; i < s.count; i++) {
        G.combat.spawnEnemy(s.spawnAt[0] + (i - 1) * 6, s.spawnAt[1] + (i % 2) * 6 - 3, 60);
      }
    } else {
      this.markerPos = null;
      this.beacon.visible = false; this.diamond.visible = false;
    }
    if (s.type === 'wait' && s.onStart) s.onStart(G);
    this.waitTimer = 0;
  }
  completeMission(G) {
    const m = this.current;
    this.beacon.visible = false; this.diamond.visible = false;
    this.markerPos = null;
    if (m) {
      G.player.cash += m.reward;
      G.hud.toast(`MISSION COMPLETE: ${m.name}  +$${m.reward}`);
      if (G.audio) { G.audio.cash(); G.audio.sting(); }
      G.saveGame();
    }
    this.index += 1;
    this.step = 0;
    if (this.index >= MISSION_DEFS.length) {
      this.active = false;
      this.done = true;
      G.onAllMissionsDone();
      return;
    }
    this.start(G);
  }
  advanceStep(G) {
    this.step += 1;
    const m = this.current;
    if (m && this.step >= m.steps.length) { this.completeMission(G); return; }
    this.enterStep(G);
  }
  // Called every frame while playing. Returns nothing; uses G callbacks.
  update(dt, G) {
    if (!this.active || !this.current) return;
    // dialogue auto-advance
    if (this.dialogue.length > 0) {
      this.dialogueTimer += dt;
      if (this.dialogueTimer > 8) { this.dialogue.shift(); this.dialogueTimer = 0; }
    }
    // marker spin
    if (this.diamond.visible) {
      this.diamond.rotation.y += dt * 2;
      this.diamond.position.y = 6 + Math.sin(performance.now() * 0.003) * 0.6;
    }
    const s = this.currentStep;
    if (!s) return;
    const p = G.player.pos;
    if (s.type === 'reach') {
      const d = Math.hypot(p.x - s.x, p.z - s.z);
      if (d < s.r) {
        if (s.onArrive) s.onArrive(G);
        this.advanceStep(G);
      }
    } else if (s.type === 'enterCar') {
      if (G.player.inCar) this.advanceStep(G);
    } else if (s.type === 'loseWanted') {
      if (G.police.wanted === 0) this.advanceStep(G);
    } else if (s.type === 'kill') {
      if (this.kills >= s.count) this.advanceStep(G);
    } else if (s.type === 'wait') {
      const d = Math.hypot(p.x - s.x, p.z - s.z);
      if (d < s.r) {
        this.waitTimer += dt;
        if (this.waitTimer >= s.seconds) this.advanceStep(G);
      } else this.waitTimer = 0;
    }
  }
  registerKill() { this.kills += 1; }
  objectiveText() {
    if (this.done) return 'All missions complete — free roam. Solara Bay is yours.';
    const m = this.current;
    if (!m) return 'Free roam — explore the city.';
    const s = this.currentStep;
    let text = s ? s.text : '';
    if (s && s.type === 'kill') text = text.replace(/\(\d+\/\d+\)/, `(${Math.min(this.kills, s.count)}/${s.count})`);
    if (s && s.type === 'wait' && this.waitTimer > 0) text += ` — ${Math.ceil(s.seconds - this.waitTimer)}s`;
    return text;
  }
  missionName() {
    if (this.done) return 'FREE ROAM';
    const m = this.current;
    return m ? `MISSION ${this.index + 1}/5: ${m.name}` : 'SOLARA BAY';
  }
  listText() {
    return MISSION_DEFS.map((m, i) => {
      const mark = i < this.index ? '✓' : i === this.index ? '►' : '·';
      return `${mark} ${i + 1}. ${m.name} — $${m.reward}`;
    }).join('\n');
  }
}
