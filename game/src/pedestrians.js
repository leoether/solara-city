// pedestrians.js — sidewalk walkers who wander the grid and flee from danger.
import { CITY } from './config.js';
import { mulberry32, pick, range } from './random.js';

const SHIRTS = [0xe74c3c, 0x3498db, 0xf1c40f, 0x2ecc71, 0xe67e22, 0x9b59b6, 0xecf0f1, 0x1abc9c];
const SKINS = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];

export function makePedMesh(shirt, skin, isCop = false) {
  const g = new THREE.Group();
  const shirtMat = new THREE.MeshLambertMaterial({ color: isCop ? 0x1f3a93 : shirt });
  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  const pantsMat = new THREE.MeshLambertMaterial({ color: isCop ? 0x141414 : 0x2c3e50 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.85, 0.34), shirtMat);
  torso.position.y = 1.05;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skinMat);
  head.position.y = 1.72;
  g.add(head);
  if (isCop) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.28, 0.12, 10), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    cap.position.y = 1.92;
    g.add(cap);
  } else {
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x2a1a0e }));
    hair.position.y = 1.74;
    g.add(hair);
  }
  const legGeo = new THREE.BoxGeometry(0.24, 0.62, 0.26);
  const legL = new THREE.Mesh(legGeo, pantsMat);
  legL.position.set(-0.16, 0.31, 0);
  g.add(legL);
  const legR = new THREE.Mesh(legGeo, pantsMat);
  legR.position.set(0.16, 0.31, 0);
  g.add(legR);
  g.userData.legL = legL;
  g.userData.legR = legR;
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 0.9),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  g.add(shadow);
  return g;
}

export class Pedestrians {
  constructor(scene, seed = 1, count = 20) {
    this.scene = scene;
    this.rng = mulberry32(seed * 104729 + 7);
    this.peds = [];
    for (let i = 0; i < count; i += 1) {
      const road = pick(this.rng, CITY.ROADS);
      const along = range(this.rng, -125, 125);
      const horizontal = this.rng() < 0.5;
      const side = this.rng() < 0.5 ? 1 : -1;
      const mesh = makePedMesh(pick(this.rng, SHIRTS), pick(this.rng, SKINS));
      const x = horizontal ? along : road + side * (CITY.ROAD_W / 2 + 2);
      const z = horizontal ? road + side * (CITY.ROAD_W / 2 + 2) : along;
      mesh.position.set(x, 0, z);
      scene.add(mesh);
      this.peds.push({
        mesh, axis: horizontal ? 'x' : 'z', dir: this.rng() < 0.5 ? 1 : -1,
        speed: range(this.rng, 1.1, 1.9), walkPhase: this.rng() * 6,
        fleeing: false, fleeX: 0, fleeZ: 0, down: false, downTime: 0,
      });
    }
  }
  /** Step walkers. danger = {x,z,radius,active} makes nearby peds flee. */
  step(dt, danger) {
    for (const p of this.peds) {
      if (p.down) {
        p.downTime -= dt;
        if (p.downTime <= 0) {
          p.down = false;
          p.mesh.rotation.x = 0;
          p.mesh.position.y = 0;
        }
        continue;
      }
      let vx = 0;
      let vz = 0;
      if (danger && danger.active) {
        const dx = p.mesh.position.x - danger.x;
        const dz = p.mesh.position.z - danger.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < danger.radius * danger.radius) {
          p.fleeing = true;
          p.fleeX = dx;
          p.fleeZ = dz;
        }
      }
      if (p.fleeing) {
        const len = Math.hypot(p.fleeX, p.fleeZ) || 1;
        vx = (p.fleeX / len) * 4.2;
        vz = (p.fleeZ / len) * 4.2;
        if (danger && (!danger.active || (p.mesh.position.x - danger.x) ** 2 + (p.mesh.position.z - danger.z) ** 2 > danger.radius * danger.radius * 2.2)) p.fleeing = false;
      } else {
        const v = p.speed;
        if (p.axis === 'x') vx = p.dir * v;
        else vz = p.dir * v;
      }
      p.mesh.position.x += vx * dt;
      p.mesh.position.z += vz * dt;
      const heading = Math.atan2(vx, vz);
      if (vx !== 0 || vz !== 0) p.mesh.rotation.y = heading;
      // walk cycle
      p.walkPhase += dt * (p.fleeing ? 11 : 6);
      const swing = Math.sin(p.walkPhase) * 0.5;
      p.mesh.userData.legL.rotation.x = swing;
      p.mesh.userData.legR.rotation.x = -swing;
      // turn at intersections / edges, keep on sidewalks
      const along = p.axis === 'x' ? p.mesh.position.x : p.mesh.position.z;
      if (Math.abs(along) > 128) p.dir *= -1;
      else if (!p.fleeing && CITY.ROADS.some((r) => Math.abs(along - r) < 0.5) && this.rng() < 0.004) {
        p.axis = p.axis === 'x' ? 'z' : 'x';
        p.dir = this.rng() < 0.5 ? 1 : -1;
        const cross = p.axis === 'x' ? p.mesh.position.z : p.mesh.position.x;
        const snapped = CITY.ROADS.reduce((a, r) => (Math.abs(r - cross) < Math.abs(a - cross) ? r : a), CITY.ROADS[0]);
        const side = this.rng() < 0.5 ? 1 : -1;
        if (p.axis === 'x') p.mesh.position.z = snapped + side * (CITY.ROAD_W / 2 + 2);
        else p.mesh.position.x = snapped + side * (CITY.ROAD_W / 2 + 2);
      }
    }
  }
  knockDown(x, z, radius) {
    let hit = 0;
    for (const p of this.peds) {
      if (p.down) continue;
      const dx = p.mesh.position.x - x;
      const dz = p.mesh.position.z - z;
      if (dx * dx + dz * dz < radius * radius) {
        p.down = true;
        p.downTime = 6;
        p.mesh.rotation.x = -Math.PI / 2;
        p.mesh.position.y = 0.3;
        hit += 1;
      }
    }
    return hit;
  }
}
