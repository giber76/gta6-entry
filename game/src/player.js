// Marlo Vance on foot: a simple articulated figure (boxes), WASD movement
// relative to the camera, sprint, and a third-person orbit camera that the
// mouse (pointer lock or drag) rotates. Handles building collision and
// keeps the player inside the city bounds.
import { clamp, angleLerp } from './util.js';
import { resolveBuildingCollision } from './city.js';

export function makePlayerMesh() {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xc98d64, roughness: 0.8 });
  const shirt = new THREE.MeshStandardMaterial({ color: 0x2e6b8a, roughness: 0.85 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.9 });
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skin);
  head.position.y = 1.62; head.castShadow = true; g.add(head);
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.14, 0.44),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a }));
  hair.position.y = 1.86; g.add(hair);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), shirt);
  torso.position.y = 1.08; torso.castShadow = true; g.add(torso);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.72, 0.26), pants);
  legL.position.set(-0.16, 0.36, 0); legL.castShadow = true; g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.16; g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.2), shirt);
  armL.position.set(-0.42, 1.12, 0); armL.castShadow = true; g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.42; g.add(armR);
  g.userData = { legL, legR, armL, armR };
  return g;
}

export class Player {
  constructor(scene) {
    this.mesh = makePlayerMesh();
    scene.add(this.mesh);
    this.pos = this.mesh.position;
    this.pos.set(0, 0, 24);
    this.heading = Math.PI; // facing the plaza / city
    this.camYaw = Math.PI;
    this.camPitch = 0.32;
    this.speed = 0;
    this.health = 100;
    this.cash = 0;
    this.weapon = 'fists'; // 'fists' | 'pistol'
    this.inCar = null;
    this.walkPhase = 0;
    this.punchCooldown = 0;
    this.shootCooldown = 0;
    this.invulnerable = 0;
  }
  reset(x, z) {
    this.pos.set(x, 0, z);
    this.health = 100;
    this.inCar = null;
    this.weapon = 'fists';
  }
  // On-foot step. Returns {moving} for animation / audio.
  stepOnFoot(input, dt, colliders, bounds) {
    const { dx, dy } = input.takeMouse();
    this.camYaw -= dx * 0.0032;
    this.camPitch = clamp(this.camPitch + dy * 0.002, -0.1, 0.9);
    const fwd = (input.down('KeyW') || input.down('ArrowUp') ? 1 : 0) - (input.down('KeyS') || input.down('ArrowDown') ? 1 : 0);
    const strafe = (input.down('KeyD') || input.down('ArrowRight') ? 1 : 0) - (input.down('KeyA') || input.down('ArrowLeft') ? 1 : 0);
    const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
    const speed = sprint ? 9.5 : 5.2;
    const mx = Math.sin(this.camYaw), mz = Math.cos(this.camYaw);
    let vx = 0, vz = 0;
    if (fwd || strafe) {
      vx = (mx * fwd + Math.cos(this.camYaw) * strafe);
      vz = (mz * fwd - Math.sin(this.camYaw) * strafe);
      const len = Math.hypot(vx, vz) || 1;
      vx = vx / len * speed; vz = vz / len * speed;
      this.heading = angleLerp(this.heading, Math.atan2(vx, vz), Math.min(1, dt * 10));
    }
    this.pos.x = clamp(this.pos.x + vx * dt, -bounds, bounds);
    this.pos.z = clamp(this.pos.z + vz * dt, -bounds, bounds);
    resolveBuildingCollision(colliders, this.pos, 0.7);
    this.mesh.rotation.y = this.heading;
    this.speed = Math.hypot(vx, vz);
    // walk-cycle swing
    this.walkPhase += this.speed * dt * 1.6;
    const swing = this.speed > 0.5 ? Math.sin(this.walkPhase) * 0.55 : 0;
    const u = this.mesh.userData;
    u.legL.rotation.x = swing; u.legR.rotation.x = -swing;
    u.armL.rotation.x = -swing * 0.8; u.armR.rotation.x = swing * 0.8;
    this.punchCooldown = Math.max(0, this.punchCooldown - dt);
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    return this.speed > 0.5;
  }
  // Third-person camera: behind the player on foot, or chase cam in a car.
  updateCamera(camera, dt) {
    let target, dist, height;
    if (this.inCar) {
      const car = this.inCar;
      const back = 9.5, up = 3.6;
      const bx = car.pos.x - Math.sin(car.heading) * back;
      const bz = car.pos.z - Math.cos(car.heading) * back;
      camera.position.x += (bx - camera.position.x) * Math.min(1, dt * 5);
      camera.position.y += ((up) - camera.position.y) * Math.min(1, dt * 5);
      camera.position.z += (bz - camera.position.z) * Math.min(1, dt * 5);
      camera.lookAt(car.pos.x + Math.sin(car.heading) * 6, 1.6, car.pos.z + Math.cos(car.heading) * 6);
      return;
    }
    dist = 7.5; height = 3.2;
    const cx = this.pos.x - Math.sin(this.camYaw) * dist * Math.cos(this.camPitch);
    const cz = this.pos.z - Math.cos(this.camYaw) * dist * Math.cos(this.camPitch);
    const cy = this.pos.y + height + Math.sin(this.camPitch) * dist;
    camera.position.x += (cx - camera.position.x) * Math.min(1, dt * 12);
    camera.position.y += (cy - camera.position.y) * Math.min(1, dt * 12);
    camera.position.z += (cz - camera.position.z) * Math.min(1, dt * 12);
    target = new THREE.Vector3(this.pos.x, 1.5, this.pos.z);
    camera.lookAt(target);
  }
  takeDamage(amount) {
    if (this.invulnerable > 0 || this.health <= 0) return false;
    this.health = Math.max(0, this.health - amount);
    this.invulnerable = 0.35;
    return true;
  }
  heal(amount) { this.health = Math.min(100, this.health + amount); }
}
