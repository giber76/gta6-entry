// Traffic: civilian AI cars cruising the road grid. Each car owns one road
// line and a direction; at intersections it sometimes turns onto the crossing
// road. Cars slow for the car ahead and stop briefly if the player blocks them.
import { mulberry32, pick, clamp } from './util.js';
import { spawnCar } from './vehicles.js';
import { ROAD_LINES } from './city.js';

export class Traffic {
  constructor(scene) {
    this.scene = scene;
    this.cars = [];
    this.rng = mulberry32(777);
  }
  populate(count, parkSpots) {
    for (let i = 0; i < count; i++) this.addCar();
  }
  addCar() {
    const rng = this.rng;
    const vertical = rng() < 0.5;
    const road = pick(rng, ROAD_LINES);
    const lane = (rng() < 0.5 ? 3.5 : -3.5);
    const along = -170 + rng() * 340;
    const dir = rng() < 0.5 ? 1 : -1;
    const car = spawnCar(this.scene,
      vertical ? road + lane : along,
      vertical ? along : road + lane,
      vertical ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2),
      pick(rng, [0xd84a4a, 0x4a7ad8, 0xe8c84a, 0x7ad84a, 0xd8d8d8, 0x8a4ad8, 0x4ad8c8]),
      'civilian');
    car.parked = false;
    car.traffic = { vertical, road, lane, dir, speed: 9 + rng() * 6, wait: 0 };
    this.cars.push(car);
    return car;
  }
  update(dt, playerPos, allCars) {
    for (const car of this.cars) {
      const t = car.traffic;
      if (!t) continue;
      // slow down for anything directly ahead
      let blocked = false;
      const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
      for (const other of allCars) {
        if (other === car) continue;
        const dx = other.pos.x - car.pos.x, dz = other.pos.z - car.pos.z;
        const ahead = dx * fx + dz * fz;
        const side = Math.abs(dx * fz - dz * fx);
        if (ahead > 0 && ahead < 9 && side < 2.4) { blocked = true; break; }
      }
      const pd = Math.hypot(playerPos.x - car.pos.x, playerPos.z - car.pos.z);
      const pAhead = (playerPos.x - car.pos.x) * fx + (playerPos.z - car.pos.z) * fz;
      if (pd < 7 && pAhead > 0) blocked = true;
      const target = blocked ? 0 : t.speed;
      car.speed += (target - car.speed) * Math.min(1, dt * 2);
      car.pos.x += Math.sin(car.heading) * car.speed * dt;
      car.pos.z += Math.cos(car.heading) * car.speed * dt;
      car.mesh.rotation.y = car.heading;
      // at a road line crossing, sometimes turn
      const along = t.vertical ? car.pos.z : car.pos.x;
      for (const line of ROAD_LINES) {
        if (Math.abs(along - line) < 0.6 && this.rng() < 0.02 && Math.abs(t.road - line) > 1) {
          // turn onto the crossing road
          const newVertical = !t.vertical;
          const newDir = this.rng() < 0.5 ? 1 : -1;
          const newLane = (newDir > 0 ? 3.5 : -3.5);
          t.vertical = newVertical; t.road = line; t.dir = newDir; t.lane = newLane;
          car.heading = newVertical ? (newDir > 0 ? 0 : Math.PI) : (newDir > 0 ? Math.PI / 2 : -Math.PI / 2);
          // snap onto the new lane
          if (newVertical) car.pos.x = line + newLane; else car.pos.z = line + newLane;
          break;
        }
      }
      // wrap around the city edge
      if (t.vertical && (car.pos.z > 178 || car.pos.z < -178)) { car.pos.z = -car.pos.z * 0.98; }
      if (!t.vertical && (car.pos.x > 178 || car.pos.x < -178)) { car.pos.x = -car.pos.x * 0.98; }
    }
  }
  // Remove a traffic car from the road (it was stolen by the player).
  remove(car) {
    const i = this.cars.indexOf(car);
    if (i >= 0) this.cars.splice(i, 1);
    if (car.traffic) car.traffic = null;
  }
  count() { return this.cars.length; }
}
