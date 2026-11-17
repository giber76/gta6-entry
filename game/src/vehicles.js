// Cars: boxy original vehicles built from primitives, plus arcade driving
// physics (accelerate / brake / reverse / handbrake drift) and the enter /
// steal interaction. A car is { mesh, pos, heading, speed, color, kind,
// parked, driver } — kind: 'civilian' | 'police' | 'player'.
import { clamp, pick } from './util.js';
import { resolveBuildingCollision } from './city.js';

const CAR_COLORS = [0xd84a4a, 0x4a7ad8, 0xe8c84a, 0x7ad84a, 0xd8d8d8, 0x8a4ad8, 0x4ad8c8, 0xe87a2a];

export function makeCarMesh(color, kind) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.45 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x18242e, roughness: 0.15, metalness: 0.6 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), bodyMat);
  body.position.y = 0.55; body.castShadow = true; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 2.2), glassMat);
  cabin.position.set(0, 1.12, -0.25); cabin.castShadow = true; g.add(cabin);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.14, 4.42),
    new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 }));
  trim.position.y = 0.3; g.add(trim);
  // headlights / taillights
  const hl = new THREE.MeshStandardMaterial({ color: 0xfff6c8, emissive: 0xffe9a8, emissiveIntensity: 0.7 });
  for (const sx of [-0.7, 0.7]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.08), hl);
    h.position.set(sx, 0.62, 2.22); g.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.08),
      new THREE.MeshStandardMaterial({ color: 0xd81e1e, emissive: 0x881111, emissiveIntensity: 0.6 }));
    t.position.set(sx, 0.62, -2.22); g.add(t);
  }
  // wheels
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 });
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2; w.position.set(wx, 0.38, wz); w.castShadow = true; g.add(w);
  }
  if (kind === 'police') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x2244cc, emissive: 0x2244ff, emissiveIntensity: 0.9 }));
    bar.position.set(0, 1.5, -0.25); g.add(bar);
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.4),
      new THREE.MeshStandardMaterial({ color: 0xcc2222, emissive: 0xff2222, emissiveIntensity: 0.9 }));
    bar2.position.set(0, 1.5, 0.15); g.add(bar2);
    g.userData.lightBar = [bar, bar2];
  }
  g.userData.wheels = [];
  return g;
}

export function spawnCar(scene, x, z, heading, color, kind) {
  const mesh = makeCarMesh(color, kind || 'civilian');
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  scene.add(mesh);
  return {
    mesh, pos: mesh.position, heading, speed: 0, color, kind: kind || 'civilian',
    parked: kind === 'civilian', driver: null, steer: 0, skid: 0,
    velX: 0, velZ: 0, lightPhase: 0,
  };
}

// Arcade driving step. Returns true if a building was hit hard (for crash sound).
export function driveCar(car, input, dt, colliders, bounds) {
  const fwd = input.down('KeyW') || input.down('ArrowUp');
  const back = input.down('KeyS') || input.down('ArrowDown');
  const left = input.down('KeyA') || input.down('ArrowLeft');
  const right = input.down('KeyD') || input.down('ArrowRight');
  const brake = input.down('Space');
  const maxSpeed = 42; // ~150 km/h
  const accel = fwd ? 26 : 0;
  const reverse = back ? -14 : 0;
  car.speed += (accel + reverse) * dt;
  if (!fwd && !back) car.speed -= Math.sign(car.speed) * 10 * dt;
  if (brake) car.speed -= Math.sign(car.speed) * 30 * dt;
  if (Math.abs(car.speed) < 0.4 && !fwd && !back) car.speed = 0;
  car.speed = clamp(car.speed, -16, maxSpeed);
  const steerTarget = (left ? 1 : 0) - (right ? 1 : 0);
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
  const grip = brake ? 0.55 : 1;
  const turnRate = car.steer * 1.9 * clamp(Math.abs(car.speed) / 12, 0, 1) * Math.sign(car.speed) * grip;
  car.heading += turnRate * dt;
  const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
  // forward is +heading direction in our layout: mesh faces +z when heading 0
  const nx = car.pos.x + fx * car.speed * dt;
  const nz = car.pos.z + fz * car.speed * dt;
  const hit = Math.abs(car.speed) > 8;
  car.pos.x = clamp(nx, -bounds, bounds);
  car.pos.z = clamp(nz, -bounds, bounds);
  const collided = resolveBuildingCollision(colliders, car.pos, 2.2);
  if (collided) {
    if (hit) car.speed *= -0.25;
    else car.speed *= 0.4;
  }
  car.mesh.rotation.y = car.heading;
  // wheel spin + body lean
  car.mesh.rotation.z = -car.steer * 0.06 * clamp(Math.abs(car.speed) / 20, 0, 1);
  car.mesh.position.y = Math.sin(performance.now() * 0.02) * 0.015 * clamp(Math.abs(car.speed) / 30, 0, 1);
  car.skid = brake && Math.abs(car.speed) > 10 ? 1 : 0;
  return collided && hit;
}

export function carSpeedKmh(car) { return Math.abs(car.speed) * 3.6; }

// Nearest stealable / enterable car within range of a point.
export function nearestCar(cars, x, z, range) {
  let best = null, bestD = range;
  for (const c of cars) {
    if (c.driver) continue;
    const d = Math.hypot(c.pos.x - x, c.pos.z - z);
    if (d < bestD) { best = c; bestD = d; }
  }
  return best;
}

export function randomCarColor(rng) { return pick(rng, CAR_COLORS); }
