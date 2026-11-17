// Pedestrians: Solara Bay residents strolling the sidewalks. They walk a
// straight sidewalk stretch, turn around at the ends, and scatter away from
// a speeding car or a gunshot. Simple box figures with varied shirts.
import { mulberry32, pick, clamp } from './util.js';

const SHIRTS = [0xe8e8e8, 0xd84a4a, 0x4a7ad8, 0xe8c84a, 0x7ad84a, 0xd87ab8, 0x4ad8c8, 0x8a5a2a];

export function makePedMesh(shirtColor) {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: [0xc98d64, 0x8a5a3a, 0xe8b88a][Math.floor(Math.random() * 3)], roughness: 0.8 });
  const shirt = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.9 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x33363d, roughness: 0.9 });
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), skin);
  head.position.y = 1.58; head.castShadow = true; g.add(head);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.66, 0.32), shirt);
  torso.position.y = 1.05; torso.castShadow = true; g.add(torso);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.68, 0.24), pants);
  legL.position.set(-0.15, 0.34, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.15; g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.56, 0.18), shirt);
  armL.position.set(-0.38, 1.08, 0); g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.38; g.add(armR);
  g.userData = { legL, legR, armL, armR };
  return g;
}

export class Pedestrians {
  constructor(scene, sidewalkSpots) {
    this.scene = scene;
    this.spots = sidewalkSpots;
    this.peds = [];
    this.rng = mulberry32(4242);
  }
  populate(count) {
    for (let i = 0; i < count; i++) {
      const spot = pick(this.rng, this.spots);
      const mesh = makePedMesh(pick(this.rng, SHIRTS));
      mesh.position.set(spot.x + (this.rng() - 0.5) * 1.5, 0, spot.z + (this.rng() - 0.5) * 1.5);
      this.scene.add(mesh);
      const dir = this.rng() < 0.5 ? 1 : -1;
      this.peds.push({
        mesh, pos: mesh.position,
        axis: spot.axis, dir,
        speed: 1.1 + this.rng() * 0.9,
        phase: this.rng() * 6,
        panic: 0, health: 30,
      });
    }
  }
  update(dt, playerPos, playerSpeed, gunshotAt) {
    for (const p of this.peds) {
      // panic: flee from a nearby fast car or a gunshot
      let fleeX = 0, fleeZ = 0;
      const dp = Math.hypot(playerPos.x - p.pos.x, playerPos.z - p.pos.z);
      if (dp < 6 && playerSpeed > 8) p.panic = 2.5;
      if (gunshotAt && Math.hypot(gunshotAt.x - p.pos.x, gunshotAt.z - p.pos.z) < 25) p.panic = 2;
      if (p.panic > 0) {
        p.panic -= dt;
        fleeX = (p.pos.x - playerPos.x) / (dp || 1);
        fleeZ = (p.pos.z - playerPos.z) / (dp || 1);
      }
      const spd = p.panic > 0 ? 4.2 : p.speed;
      if (p.axis === 'z') p.pos.z += p.dir * spd * dt + fleeZ * spd * dt;
      else p.pos.x += p.dir * spd * dt + fleeX * spd * dt;
      if (p.axis === 'z' && (p.pos.z > 178 || p.pos.z < -178)) p.dir *= -1;
      if (p.axis === 'x' && (p.pos.x > 178 || p.pos.x < -178)) p.dir *= -1;
      p.pos.x = clamp(p.pos.x, -178, 178);
      p.pos.z = clamp(p.pos.z, -178, 178);
      const heading = p.axis === 'z' ? (p.dir > 0 ? 0 : Math.PI) : (p.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      p.mesh.rotation.y = heading;
      p.phase += spd * dt * 2.2;
      const swing = Math.sin(p.phase) * 0.5;
      const u = p.mesh.userData;
      u.legL.rotation.x = swing; u.legR.rotation.x = -swing;
      u.armL.rotation.x = -swing * 0.7; u.armR.rotation.x = swing * 0.7;
    }
  }
  nearest(x, z, range) {
    let best = null, bd = range;
    for (const p of this.peds) {
      const d = Math.hypot(p.pos.x - x, p.pos.z - z);
      if (d < bd) { best = p; bd = d; }
    }
    return best;
  }
  remove(ped) {
    this.scene.remove(ped.mesh);
    const i = this.peds.indexOf(ped);
    if (i >= 0) this.peds.splice(i, 1);
  }
}
