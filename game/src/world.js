// world.js — builds the sun-soaked city of Solara: road grid, buildings, palms,
// lamps, beach + ocean, sky and light. All procedural, no external assets.
// Deterministic per seed.
import { CITY } from './config.js';
import { mulberry32, pick, range, int } from './random.js';

const BUILDING_COLORS = [0xf2d8a7, 0xe8a87c, 0xa8d8ea, 0xf7cac9, 0xc5e1a5, 0xd1c4e9, 0xffccbc, 0xb2dfdb, 0xf5f0e6, 0xf0b429];

function windowTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#e8e2d4';
  g.fillRect(0, 0, 128, 256);
  for (let y = 12; y < 244; y += 22) {
    for (let x = 10; x < 118; x += 20) {
      const lit = Math.random() < 0.28;
      g.fillStyle = lit ? '#ffe9a8' : '#2e4053';
      g.fillRect(x, y, 12, 14);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCity(scene, seed = 1) {
  const rng = mulberry32(seed);
  const colliders = []; // building AABBs {minX, maxX, minZ, maxZ}
  const group = new THREE.Group();
  scene.add(group);

  // Sky, fog and sun.
  scene.background = new THREE.Color(0x8ec9e8);
  scene.fog = new THREE.Fog(0xbfd9e8, 220, 620);
  const sun = new THREE.DirectionalLight(0xfff1cf, 1.25);
  sun.position.set(140, 200, 80);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfe3ff, 0x8a7a5a, 0.85));

  // Ground: dry warm grass/sand base.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900),
    new THREE.MeshLambertMaterial({ color: 0xbfae85 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  group.add(ground);

  // Roads: dark asphalt strips + pale sidewalks, with dashed centre lines.
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x3c3c44 });
  const walkMat = new THREE.MeshLambertMaterial({ color: 0xcfc3a5 });
  const dashMat = new THREE.MeshLambertMaterial({ color: 0xf7d774 });
  for (const r of CITY.ROADS) {
    for (const horizontal of [true, false]) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(300, CITY.ROAD_W), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(horizontal ? 0 : r, 0, horizontal ? r : 0);
      if (!horizontal) road.rotation.z = Math.PI / 2;
      group.add(road);
      const walk = new THREE.Mesh(new THREE.PlaneGeometry(300, CITY.ROAD_W + 8), walkMat);
      walk.rotation.x = -Math.PI / 2;
      walk.position.set(horizontal ? 0 : r, -0.02, horizontal ? r : 0);
      if (!horizontal) walk.rotation.z = Math.PI / 2;
      group.add(walk);
      for (let t = -140; t <= 140; t += 12) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.7), dashMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(horizontal ? t : r, 0.01, horizontal ? r : t);
        if (!horizontal) dash.rotation.z = Math.PI / 2;
        group.add(dash);
      }
    }
  }

  // Buildings: 16 blocks, 4 per block, varied heights and sun-soaked colours.
  const winTex = windowTexture();
  const mats = BUILDING_COLORS.map(
    (c) => new THREE.MeshLambertMaterial({ color: c, map: winTex }),
  );
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x5a4a3a });
  const blockCentres = [-90, -30, 30, 90];
  for (const bx of blockCentres) {
    for (const bz of blockCentres) {
      for (const ox of [-11, 11]) {
        for (const oz of [-11, 11]) {
          const w = range(rng, 15, 19);
          const d = range(rng, 15, 19);
          const h = pick(rng, [8, 10, 12, 14, 18, 22, 26, 32, 40]) * range(rng, 0.9, 1.15);
          const x = bx + ox;
          const z = bz + oz;
          const b = new THREE.Mesh(boxGeo, mats[int(rng, 0, mats.length - 1)]);
          b.scale.set(w, h, d);
          b.position.set(x, h / 2, z);
          group.add(b);
          const roof = new THREE.Mesh(boxGeo, roofMat);
          roof.scale.set(w + 0.6, 0.5, d + 0.6);
          roof.position.set(x, h + 0.25, z);
          group.add(roof);
          if (h > 20) {
            const ac = new THREE.Mesh(boxGeo, roofMat);
            ac.scale.set(3, 1.6, 3);
            ac.position.set(x + 3, h + 1.1, z - 2);
            group.add(ac);
          }
          colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
        }
      }
    }
  }

  // Landmark: the Solara Tower (tallest, gold glass) at the north-east block.
  const tower = new THREE.Mesh(
    boxGeo,
    new THREE.MeshLambertMaterial({ color: 0xf7c948, map: winTex, emissive: 0x332200 }),
  );
  tower.scale.set(20, 64, 20);
  tower.position.set(90, 32, -90);
  group.add(tower);
  colliders.push({ minX: 80, maxX: 100, minZ: -100, maxZ: -80 });

  // Palms: trunk + fronds, along roads and the beach.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6b48 });
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x3f9e4d });
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 7, 6);
  const frondGeo = new THREE.ConeGeometry(1.9, 4.0, 4);
  function palm(x, z) {
    const p = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 3.5;
    trunk.rotation.z = 0.08;
    p.add(trunk);
    for (let i = 0; i < 6; i += 1) {
      const f = new THREE.Mesh(frondGeo, frondMat);
      const a = (i / 6) * Math.PI * 2;
      f.position.set(Math.cos(a) * 1.25, 7.0, Math.sin(a) * 1.25);
      f.rotation.z = Math.cos(a) * 1.1;
      f.rotation.x = -Math.sin(a) * 1.1;
      p.add(f);
    }
    p.position.set(x, 0, z);
    group.add(p);
  }
  for (const r of CITY.ROADS) {
    for (let t = -110; t <= 110; t += 40) {
      if (Math.abs(t) < 12) continue;
      palm(r + 11, t);
      palm(t, r - 11);
    }
  }
  for (let x = -140; x <= 140; x += 18) palm(x + range(rng, -4, 4), 158 + range(rng, -3, 3));

  // Street lamps on every intersection corner.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2f3542 });
  const lampMat = new THREE.MeshLambertMaterial({ color: 0xfff6c9, emissive: 0x555533 });
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.12, 6, 6);
  const lampGeo = new THREE.SphereGeometry(0.5, 8, 6);
  for (const rx of CITY.ROADS) {
    for (const rz of CITY.ROADS) {
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(rx + 9, 3, rz + 9);
      group.add(pole);
      const lamp = new THREE.Mesh(lampGeo, lampMat);
      lamp.position.set(rx + 9, 6.2, rz + 9);
      group.add(lamp);
    }
  }

  // Beach (south) + ocean + boardwalk strip.
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(420, 60),
    new THREE.MeshLambertMaterial({ color: 0xead9a7 }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.02, 180);
  group.add(sand);
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 300),
    new THREE.MeshLambertMaterial({ color: 0x2e86c1 }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, -0.3, 360);
  group.add(ocean);
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(420, 8),
    new THREE.MeshLambertMaterial({ color: 0xa9805a }),
  );
  board.rotation.x = -Math.PI / 2;
  board.position.set(0, 0.03, 148);
  group.add(board);

  return { group, colliders, rng };
}

/** True when (x, z) is on a road surface (drivable). */
export function isOnRoad(x, z) {
  const on = (v) => CITY.ROADS.some((r) => Math.abs(v - r) <= CITY.ROAD_W / 2);
  return on(x) || on(z);
}
/** Snap a point to the nearest road centre line. */
export function nearestRoadPoint(x, z) {
  let bx = CITY.ROADS[0];
  let bz = CITY.ROADS[0];
  for (const r of CITY.ROADS) {
    if (Math.abs(x - r) < Math.abs(x - bx)) bx = r;
    if (Math.abs(z - r) < Math.abs(z - bz)) bz = r;
  }
  return Math.abs(x - bx) < Math.abs(z - bz) ? { x: bx, z } : { x, z: bz };
}
