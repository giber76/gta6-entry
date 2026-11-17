// Solara Bay itself: a sun-soaked coastal grid city built from boxes, cones and
// canvas textures. Exports buildCity(scene) -> { colliders, roads, parkSpots,
// sidewalkSpots, plaza } used by driving, traffic, pedestrians and missions.
// Layout: roads on a 60-unit grid, blocks of varied buildings between them,
// a beach and ocean along the south edge (high +z), a palm-lined plaza downtown.
import { mulberry32, pick, facadeTexture } from './util.js';

export const ROAD_LINES = [-150, -90, -30, 30, 90, 150];
export const CITY_HALF = 180;

const WALLS = ['#e8dcc8', '#d9a06b', '#b7c4ce', '#c98f7a', '#a8b89a', '#e0b84f', '#8fa8c8', '#d67f6a'];
const ROOFS = ['#5a6b7a', '#7a5a4a', '#4a5a6b', '#6b7a5a'];

export function buildCity(scene) {
  const rng = mulberry32(20261117);
  const colliders = [];   // {minX,maxX,minZ,maxZ} building footprints
  const parkSpots = [];   // {x,z,heading,color}
  const sidewalkSpots = [];
  const plaza = { x: 0, z: 0 };

  // --- sky, sun, ground -------------------------------------------------
  scene.background = new THREE.Color(0x87c5e8);
  scene.fog = new THREE.Fog(0x9fd0e8, 220, 620);
  const sun = new THREE.DirectionalLight(0xfff2d0, 1.35);
  sun.position.set(120, 180, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -220; sun.shadow.camera.right = 220;
  sun.shadow.camera.top = 220; sun.shadow.camera.bottom = -220;
  sun.shadow.camera.far = 600;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.6;
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xbfd9ff, 0.55));
  const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x8a7a5a, 0.35);
  scene.add(hemi);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 560),
    new THREE.MeshStandardMaterial({ color: 0x9a9a8e, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  scene.add(ground);

  // Grass parks tint: a few green quads under park blocks (drawn later as planes).
  // --- roads ------------------------------------------------------------
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x2e3138, roughness: 0.95 });
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xd8c84a, roughness: 0.9 });
  for (const c of ROAD_LINES) {
    const v = new THREE.Mesh(new THREE.PlaneGeometry(14, 380), roadMat);
    v.rotation.x = -Math.PI / 2; v.position.set(c, 0.02, 0); v.receiveShadow = true; scene.add(v);
    const h = new THREE.Mesh(new THREE.PlaneGeometry(380, 14), roadMat);
    h.rotation.x = -Math.PI / 2; h.position.set(0, 0.02, c); h.receiveShadow = true; scene.add(h);
    // centre dashes
    for (let t = -175; t < 180; t += 12) {
      const d1 = new THREE.Mesh(new THREE.PlaneGeometry(1, 4), lineMat);
      d1.rotation.x = -Math.PI / 2; d1.position.set(c, 0.04, t); scene.add(d1);
      const d2 = new THREE.Mesh(new THREE.PlaneGeometry(4, 1), lineMat);
      d2.rotation.x = -Math.PI / 2; d2.position.set(t, 0.04, c); scene.add(d2);
    }
    // sidewalk strips along each road
    const walkMat = new THREE.MeshStandardMaterial({ color: 0xb9b3a4, roughness: 1 });
    const w1 = new THREE.Mesh(new THREE.PlaneGeometry(3, 380), walkMat);
    w1.rotation.x = -Math.PI / 2; w1.position.set(c + 8.5, 0.03, 0); scene.add(w1);
    const w2 = new THREE.Mesh(new THREE.PlaneGeometry(3, 380), walkMat);
    w2.rotation.x = -Math.PI / 2; w2.position.set(c - 8.5, 0.03, 0); scene.add(w2);
    const w3 = new THREE.Mesh(new THREE.PlaneGeometry(380, 3), walkMat);
    w3.rotation.x = -Math.PI / 2; w3.position.set(0, 0.03, c + 8.5); scene.add(w3);
    const w4 = new THREE.Mesh(new THREE.PlaneGeometry(380, 3), walkMat);
    w4.rotation.x = -Math.PI / 2; w4.position.set(0, 0.03, c - 8.5); scene.add(w4);
  }

  // --- beach + ocean (south edge) ---------------------------------------
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(560, 70),
    new THREE.MeshStandardMaterial({ color: 0xe8d29a, roughness: 1 }));
  sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0.05, 215); sand.receiveShadow = true; scene.add(sand);
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(560, 220),
    new THREE.MeshStandardMaterial({ color: 0x1e7fa8, roughness: 0.25, metalness: 0.1 }));
  ocean.rotation.x = -Math.PI / 2; ocean.position.set(0, 0.02, 360); scene.add(ocean);
  // boardwalk
  const board = new THREE.Mesh(new THREE.PlaneGeometry(360, 8),
    new THREE.MeshStandardMaterial({ color: 0xa8763e, roughness: 1 }));
  board.rotation.x = -Math.PI / 2; board.position.set(0, 0.06, 186); board.receiveShadow = true; scene.add(board);

  // --- buildings ---------------------------------------------------------
  const blockEdges = [-178, -157, -143, -97, -83, -37, -23, 23, 37, 83, 97, 143, 157, 178];
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  for (let bx = 0; bx < blockEdges.length; bx += 2) {
    for (let bz = 0; bz < blockEdges.length; bz += 2) {
      const x0 = blockEdges[bx], x1 = blockEdges[bx + 1];
      const z0 = blockEdges[bz], z1 = blockEdges[bz + 1];
      if (z0 > 150) continue; // beach, no buildings
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const roll = rng();
      if (roll < 0.14) {
        // park block: grass + palms
        const grass = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0),
          new THREE.MeshStandardMaterial({ color: 0x5da24a, roughness: 1 }));
        grass.rotation.x = -Math.PI / 2; grass.position.set(cx, 0.04, cz); grass.receiveShadow = true; scene.add(grass);
        for (let i = 0; i < 4; i++) makePalm(scene, cx + (rng() - 0.5) * (x1 - x0 - 6), cz + (rng() - 0.5) * (z1 - z0 - 6), rng);
        continue;
      }
      if (roll < 0.24) {
        // parking lot: flat asphalt + parked cars
        const lot = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0),
          new THREE.MeshStandardMaterial({ color: 0x3a3d44, roughness: 1 }));
        lot.rotation.x = -Math.PI / 2; lot.position.set(cx, 0.04, cz); lot.receiveShadow = true; scene.add(lot);
        for (let i = 0; i < 3; i++) {
          parkSpots.push({ x: x0 + 5 + i * 7, z: cz, heading: Math.PI / 2, color: pick(rng, [0xd84a4a, 0x4a7ad8, 0xe8c84a, 0x7ad84a, 0xd8d8d8]) });
        }
        continue;
      }
      // 1-2 buildings per block
      const n = rng() < 0.5 ? 1 : 2;
      for (let i = 0; i < n; i++) {
        const w = (x1 - x0) / n - 6;
        const d = (z1 - z0) - 7;
        const bx0 = x0 + 3 + i * ((x1 - x0) / n);
        const h = 8 + rng() * rng() * 42 + (Math.abs(cx) < 40 && Math.abs(cz) < 40 ? 14 : 0);
        const wall = pick(rng, WALLS);
        const mat = new THREE.MeshStandardMaterial({ map: facadeTexture(wall, '#ffe9a8'), roughness: 0.9 });
        const b = new THREE.Mesh(boxGeo, mat);
        b.scale.set(w, h, d);
        b.position.set(bx0 + w / 2, h / 2, cz);
        b.castShadow = true; b.receiveShadow = true;
        scene.add(b);
        const roof = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: pick(rng, ROOFS), roughness: 1 }));
        roof.scale.set(w + 0.6, 0.8, d + 0.6);
        roof.position.set(bx0 + w / 2, h + 0.4, cz);
        scene.add(roof);
        // rooftop AC box on tall towers
        if (h > 26) {
          const ac = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: 0x8a8f96 }));
          ac.scale.set(3, 1.6, 3); ac.position.set(bx0 + w / 2, h + 1.6, cz); scene.add(ac);
        }
        colliders.push({ minX: bx0, maxX: bx0 + w, minZ: cz - d / 2, maxZ: cz + d / 2 });
      }
    }
  }

  // --- plaza downtown (mission landmark) --------------------------------
  const plazaMat = new THREE.MeshStandardMaterial({ color: 0xc9b48a, roughness: 1 });
  const pz = new THREE.Mesh(new THREE.CircleGeometry(16, 24), plazaMat);
  pz.rotation.x = -Math.PI / 2; pz.position.set(0, 0.05, 0); pz.receiveShadow = true; scene.add(pz);
  const fountain = new THREE.Mesh(new THREE.CylinderGeometry(5, 6, 1.2, 20),
    new THREE.MeshStandardMaterial({ color: 0x9fc8d8, roughness: 0.4 }));
  fountain.position.set(0, 0.6, 0); fountain.castShadow = true; scene.add(fountain);
  colliders.push({ minX: -6, maxX: 6, minZ: -6, maxZ: 6 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    makePalm(scene, Math.cos(a) * 13, Math.sin(a) * 13, rng);
  }

  // --- palms along the beach + streetlights ------------------------------
  for (let x = -170; x <= 170; x += 22) {
    makePalm(scene, x + (rng() - 0.5) * 6, 196 + rng() * 8, rng);
    if (rng() < 0.6) makePalm(scene, x, 178 + rng() * 4, rng);
  }
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x3a3f45, roughness: 0.6, metalness: 0.5 });
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffd23e, emissiveIntensity: 0.9 });
  for (const c of ROAD_LINES) {
    for (let t = -150; t <= 150; t += 60) {
      for (const [lx, lz] of [[c + 10, t], [c - 10, t + 30]]) {
        if (Math.abs(lz) > 175) continue;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 7, 6), poleMat);
        pole.position.set(lx, 3.5, lz); pole.castShadow = true; scene.add(pole);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), lampMat);
        lamp.position.set(lx, 7.1, lz); scene.add(lamp);
      }
    }
  }

  // --- parked cars along roads -------------------------------------------
  const carColors = [0xd84a4a, 0x4a7ad8, 0xe8c84a, 0x7ad84a, 0xd8d8d8, 0x8a4ad8, 0x4ad8c8];
  for (let i = 0; i < 26; i++) {
    const road = pick(rng, ROAD_LINES);
    const along = -165 + rng() * 330;
    const vertical = rng() < 0.5;
    const side = rng() < 0.5 ? 10.5 : -10.5;
    parkSpots.push({
      x: vertical ? road + side : along,
      z: vertical ? along : road + side,
      heading: vertical ? (side > 0 ? Math.PI : 0) : (side > 0 ? Math.PI / 2 : -Math.PI / 2),
      color: pick(rng, carColors),
    });
  }

  // --- sidewalk spots for pedestrians ------------------------------------
  for (const c of ROAD_LINES) {
    for (let t = -170; t < 175; t += 14) {
      sidewalkSpots.push({ x: c + 8.5, z: t, axis: 'z' });
      sidewalkSpots.push({ x: t, z: c + 8.5, axis: 'x' });
    }
  }

  return { colliders, roads: ROAD_LINES, parkSpots, sidewalkSpots, plaza };
}

function makePalm(scene, x, z, rng) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.38, 6 + rng() * 2, 6),
    new THREE.MeshStandardMaterial({ color: 0x8a6a42, roughness: 1 }));
  trunk.position.y = 3; trunk.castShadow = true; g.add(trunk);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f9e44, roughness: 1, side: THREE.DoubleSide });
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3.4, 4), leafMat);
    const a = (i / 6) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 1.2, 6.4, Math.sin(a) * 1.2);
    leaf.rotation.z = Math.cos(a) * 1.1;
    leaf.rotation.x = -Math.sin(a) * 1.1;
    leaf.castShadow = true; g.add(leaf);
  }
  const nut = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x6b4a1f }));
  nut.position.y = 6.1; g.add(nut);
  g.position.set(x, 0, z);
  scene.add(g);
}

// Point-vs-building test used by movement, driving and AI.
export function collidesWithBuildings(colliders, x, z, r) {
  for (const c of colliders) {
    if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) return c;
  }
  return null;
}
export function resolveBuildingCollision(colliders, pos, r) {
  const c = collidesWithBuildings(colliders, pos.x, pos.z, r);
  if (!c) return false;
  const pushL = (pos.x + r) - c.minX, pushR = c.maxX - (pos.x - r);
  const pushU = (pos.z + r) - c.minZ, pushD = c.maxZ - (pos.z - r);
  const m = Math.min(pushL, pushR, pushU, pushD);
  if (m === pushL) pos.x = c.minX - r;
  else if (m === pushR) pos.x = c.maxX + r;
  else if (m === pushU) pos.z = c.minZ - r;
  else pos.z = c.maxZ + r;
  return true;
}
