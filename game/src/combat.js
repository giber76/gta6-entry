// Combat: fists and pistol for Marlo, plus the rival gang members who show
// up in missions. Shooting is a camera raycast against enemy / pedestrian
// hit spheres; hits spawn a muzzle flash, a tracer and a damage number.
// Enemies chase and shoot back with poor aim at range.
import { clamp } from './util.js';
import { blobTexture } from './util.js';
import { makePedMesh } from './pedestrians.js';

export class Combat {
  constructor(scene) {
    this.scene = scene;
    this.enemies = [];
    this.tracers = [];
    this.flash = null;
    this.flashMat = new THREE.SpriteMaterial({
      map: blobTexture('rgba(255,240,160,1)', 'rgba(255,120,0,0)'),
      transparent: true, depthWrite: false,
    });
    this.flash = new THREE.Sprite(this.flashMat);
    this.flash.scale.set(1.6, 1.6, 1);
    this.flash.visible = false;
    scene.add(this.flash);
    this.flashTimer = 0;
    this.gunshotAt = null;
  }
  spawnEnemy(x, z, hp) {
    const mesh = makePedMesh(0x8a1a2a); // rival "Crimson Vipers" wear dark red
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    const e = { mesh, pos: mesh.position, health: hp || 60, shootTimer: 1 + Math.random(), phase: 0, dead: false };
    this.enemies.push(e);
    return e;
  }
  removeEnemy(e) {
    this.scene.remove(e.mesh);
    const i = this.enemies.indexOf(e);
    if (i >= 0) this.enemies.splice(i, 1);
  }
  clearEnemies() { for (const e of [...this.enemies]) this.removeEnemy(e); }
  // Player punch: hits the nearest enemy/pedestrian in front within 2.2m.
  punch(player, peds, audio) {
    const fx = Math.sin(player.heading), fz = Math.cos(player.heading);
    let hit = null, bd = 2.4;
    const consider = (obj, list) => {
      const dx = obj.pos.x - player.pos.x, dz = obj.pos.z - player.pos.z;
      const d = Math.hypot(dx, dz);
      const ahead = dx * fx + dz * fz;
      if (d < bd && ahead > 0) { hit = obj; bd = d; }
    };
    for (const e of this.enemies) consider(e);
    if (!hit) for (const p of peds.peds) consider(p);
    if (hit) {
      if (this.enemies.includes(hit)) {
        hit.health -= 34;
        if (hit.health <= 0) { this.removeEnemy(hit); return 'enemy-down'; }
      } else {
        peds.remove(hit);
        return 'ped-down';
      }
      return 'hit';
    }
    return 'miss';
  }
  // Player pistol shot from the camera through the crosshair.
  shoot(camera, player, peds, police, audio) {
    const origin = camera.position.clone();
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const targets = [];
    for (const e of this.enemies) targets.push({ obj: e, r: 0.9, kind: 'enemy' });
    for (const p of peds.peds) targets.push({ obj: p, r: 0.9, kind: 'ped' });
    for (const o of police.officers) targets.push({ obj: o, r: 0.9, kind: 'officer' });
    let best = null, bestT = 120;
    const tmp = new THREE.Vector3();
    for (const t of targets) {
      tmp.set(t.obj.pos.x, t.obj.pos.y + 1.2, t.obj.pos.z).sub(origin);
      const along = tmp.dot(dir);
      if (along < 1 || along > bestT) continue;
      const perp = tmp.clone().addScaledVector(dir, -along).length();
      if (perp < t.r + along * 0.02) { best = t; bestT = along; }
    }
    // muzzle flash at the gun + a short tracer line
    this.flash.position.copy(origin).addScaledVector(dir, 1.2);
    this.flash.visible = true; this.flashTimer = 0.06;
    const end = best ? new THREE.Vector3(best.obj.pos.x, best.obj.pos.y + 1.2, best.obj.pos.z)
      : origin.clone().addScaledVector(dir, 60);
    const geo = new THREE.BufferGeometry().setFromPoints([origin.clone().addScaledVector(dir, 1.2), end]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 }));
    this.scene.add(line);
    this.tracers.push({ line, life: 0.08 });
    this.gunshotAt = { x: player.pos.x, z: player.pos.z };
    if (audio) audio.gunshot();
    if (!best) return 'miss';
    if (best.kind === 'enemy') {
      best.obj.health -= 34;
      if (best.obj.health <= 0) { this.removeEnemy(best.obj); return 'enemy-down'; }
      return 'enemy-hit';
    }
    if (best.kind === 'ped') { peds.remove(best.obj); return 'ped-down'; }
    if (best.kind === 'officer') {
      police.removeOfficer(best.obj);
      return 'officer-down';
    }
    return 'miss';
  }
  // Enemies advance on the player and shoot (inaccurately at distance).
  update(dt, player, audio) {
    for (const e of [...this.enemies]) {
      const dx = player.pos.x - e.pos.x, dz = player.pos.z - e.pos.z;
      const d = Math.hypot(dx, dz);
      const heading = Math.atan2(dx, dz);
      e.mesh.rotation.y = heading;
      if (d > 7) {
        e.pos.x += Math.sin(heading) * 4.5 * dt;
        e.pos.z += Math.cos(heading) * 4.5 * dt;
        e.phase += 4.5 * dt * 2;
        const swing = Math.sin(e.phase) * 0.5;
        e.mesh.userData.legL.rotation.x = swing;
        e.mesh.userData.legR.rotation.x = -swing;
      } else {
        e.shootTimer -= dt;
        if (e.shootTimer <= 0) {
          e.shootTimer = 1.4 + Math.random() * 1.2;
          // enemy shot: tracer from enemy to near the player
          const start = new THREE.Vector3(e.pos.x, e.pos.y + 1.3, e.pos.z);
          const end = new THREE.Vector3(player.pos.x + (Math.random() - 0.5) * 1.2, 1.2, player.pos.z + (Math.random() - 0.5) * 1.2);
          const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
          const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xff8866, transparent: true, opacity: 0.8 }));
          this.scene.add(line);
          this.tracers.push({ line, life: 0.08 });
          if (audio) audio.noise(0.1, 0.25, 1800);
          if (d < 12 && Math.random() < 0.45) player.takeDamage(7);
        }
      }
    }
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) this.flash.visible = false;
    }
    for (const t of [...this.tracers]) {
      t.life -= dt;
      if (t.life <= 0) {
        this.scene.remove(t.line);
        t.line.geometry.dispose();
        this.tracers.splice(this.tracers.indexOf(t), 1);
      }
    }
  }
}
