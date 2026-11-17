// Wanted level + Solara Bay Police. Stars 0-5. Police cars spawn at the city
// edge, chase and ram the player (or pull alongside on foot and punch);
// foot officers spawn near the player at higher stars. Wanted decays one
// star at a time after the player stays out of every officer's sight.
import { mulberry32, clamp } from './util.js';
import { spawnCar } from './vehicles.js';
import { makePedMesh } from './pedestrians.js';

export class Police {
  constructor(scene, colliders) {
    this.scene = scene;
    this.colliders = colliders;
    this.wanted = 0;
    this.cars = [];
    this.officers = [];
    this.decayTimer = 0;
    this.spawnTimer = 0;
    this.rng = mulberry32(99);
    this.lastSeen = 0;
  }
  addWanted(n, reason) {
    const before = this.wanted;
    this.wanted = clamp(this.wanted + n, 0, 5);
    if (this.wanted > before) this.decayTimer = 0;
    return this.wanted;
  }
  setWanted(n) { this.wanted = clamp(n, 0, 5); this.decayTimer = 0; }
  clear() { this.wanted = 0; this.decayTimer = 0; }
  desiredUnits() { return this.wanted <= 1 ? 1 : this.wanted <= 2 ? 2 : this.wanted <= 3 ? 3 : this.wanted <= 4 ? 4 : 5; }
  update(dt, player, colliders, audio) {
    const now = performance.now() / 1000;
    // spawn / despawn to match wanted level
    this.spawnTimer -= dt;
    const wantCars = this.wanted === 0 ? 0 : Math.min(this.desiredUnits(), this.wanted + 1);
    if (this.cars.length < wantCars && this.spawnTimer <= 0) {
      this.spawnTimer = 1.2;
      this.spawnPoliceCar(player);
    }
    if (this.wanted >= 3 && this.officers.length < 2 && this.spawnTimer <= 0) {
      this.spawnTimer = 2;
      this.spawnOfficer(player);
    }
    // chase behaviour
    let anyNear = false;
    for (const car of this.cars) {
      const dx = player.pos.x - car.pos.x, dz = player.pos.z - car.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 70) anyNear = true;
      const targetHeading = Math.atan2(dx, dz);
      let dh = ((targetHeading - car.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      car.heading += clamp(dh, -2.4 * dt, 2.4 * dt);
      const targetSpeed = d > 26 ? 34 : d > 8 ? 26 : 14;
      car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.5);
      car.pos.x += Math.sin(car.heading) * car.speed * dt;
      car.pos.z += Math.cos(car.heading) * car.speed * dt;
      car.mesh.rotation.y = car.heading;
      car.lightPhase += dt * 6;
      if (car.mesh.userData.lightBar) {
        const [b1, b2] = car.mesh.userData.lightBar;
        const on = Math.sin(car.lightPhase) > 0;
        b1.material.emissiveIntensity = on ? 1.6 : 0.15;
        b2.material.emissiveIntensity = on ? 0.15 : 1.6;
      }
      // ram: damage + push when touching the player's car or body
      if (d < 3.4) {
        if (player.inCar) {
          player.inCar.speed *= 0.55;
          player.inCar.pos.x += Math.sin(car.heading) * 1.2;
          player.inCar.pos.z += Math.cos(car.heading) * 1.2;
          if (audio) audio.crash();
        } else if (player.takeDamage(6)) {
          player.pos.x += Math.sin(car.heading) * 1.5;
          player.pos.z += Math.cos(car.heading) * 1.5;
        }
        car.speed *= 0.5;
      }
      if (d > 260) this.removeCar(car);
    }
    for (const off of this.officers) {
      const dx = player.pos.x - off.pos.x, dz = player.pos.z - off.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 70) anyNear = true;
      const heading = Math.atan2(dx, dz);
      off.mesh.rotation.y = heading;
      const spd = d > 2 ? 6.5 : 0;
      off.pos.x += Math.sin(heading) * spd * dt;
      off.pos.z += Math.cos(heading) * spd * dt;
      off.phase += spd * dt * 2;
      const swing = Math.sin(off.phase) * 0.5;
      off.mesh.userData.legL.rotation.x = swing;
      off.mesh.userData.legR.rotation.x = -swing;
      if (d < 1.6 && !player.inCar && player.takeDamage(8)) { /* officer punch */ }
      if (d > 200) this.removeOfficer(off);
    }
    // decay: unseen for 12s loses a star
    if (this.wanted > 0) {
      if (anyNear) { this.decayTimer = 0; this.lastSeen = now; }
      else {
        this.decayTimer += dt;
        if (this.decayTimer > 12) { this.wanted -= 1; this.decayTimer = 0; }
      }
    }
    if (audio) audio.setSiren(this.wanted > 0 && this.cars.length > 0);
  }
  spawnPoliceCar(player) {
    const a = this.rng() * Math.PI * 2;
    const x = clamp(player.pos.x + Math.cos(a) * 90, -175, 175);
    const z = clamp(player.pos.z + Math.sin(a) * 90, -175, 175);
    const car = spawnCar(this.scene, x, z, 0, 0xffffff, 'police');
    car.parked = false;
    this.cars.push(car);
  }
  spawnOfficer(player) {
    const a = this.rng() * Math.PI * 2;
    const mesh = makePedMesh(0x1a2a4a);
    mesh.position.set(clamp(player.pos.x + Math.cos(a) * 25, -175, 175), 0, clamp(player.pos.z + Math.sin(a) * 25, -175, 175));
    this.scene.add(mesh);
    this.officers.push({ mesh, pos: mesh.position, phase: 0 });
  }
  removeCar(car) {
    this.scene.remove(car.mesh);
    const i = this.cars.indexOf(car);
    if (i >= 0) this.cars.splice(i, 1);
  }
  removeOfficer(off) {
    this.scene.remove(off.mesh);
    const i = this.officers.indexOf(off);
    if (i >= 0) this.officers.splice(i, 1);
  }
  clearAll() {
    for (const c of [...this.cars]) this.removeCar(c);
    for (const o of [...this.officers]) this.removeOfficer(o);
    this.wanted = 0;
  }
}
