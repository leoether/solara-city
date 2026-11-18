// vehicles.js — car meshes, arcade driving physics and traffic AI that loops the road grid.
import { CITY, GAME, clamp, angleLerp } from './config.js';
import { mulberry32, pick, range } from './random.js';
import { isOnRoad } from './world.js';

const CAR_COLORS = [0xd64545, 0x3a7bd5, 0xf2c14e, 0x7ec850, 0xe8e8e8, 0x2f3542, 0xff8c42, 0x9b59b6, 0x1abc9c];

export function makeCarMesh(color, isPolice = false) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1c2733 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.7, 4.4), bodyMat);
  body.position.y = 0.55;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.65, 2.2), glassMat);
  cabin.position.set(0, 1.15, -0.2);
  g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  for (const [wx, wz] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.42, wz);
    g.add(w);
  }
  // headlights
  const lightMat = new THREE.MeshLambertMaterial({ color: 0xfff6c9, emissive: 0x777744 });
  for (const wx of [-0.6, 0.6]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), lightMat);
    h.position.set(wx, 0.6, 2.22);
    g.add(h);
  }
  if (isPolice) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.5), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    bar.position.set(0, 1.55, -0.2);
    g.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.2, 0.45), new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0xaa0000 }));
    red.position.set(-0.3, 1.68, -0.2);
    g.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.2, 0.45), new THREE.MeshLambertMaterial({ color: 0x2244ff, emissive: 0x0000aa }));
    blue.position.set(0.3, 1.68, -0.2);
    g.add(blue);
    g.userData.lightRed = red;
    g.userData.lightBlue = blue;
  }
  // blob shadow
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 5),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  g.add(shadow);
  return g;
}

export class Car {
  constructor(scene, x, z, heading, color, isPolice = false) {
    this.mesh = makeCarMesh(color, isPolice);
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = heading;
    this.heading = heading;
    this.speed = 0;
    this.isPolice = isPolice;
    this.color = color;
    this.stuckTime = 0;
    this.lastX = x;
    this.lastZ = z;
    scene.add(this.mesh);
  }
  get x() { return this.mesh.position.x; }
  get z() { return this.mesh.position.z; }
  setPos(x, z, heading) {
    this.mesh.position.x = x;
    this.mesh.position.z = z;
    if (heading !== undefined) {
      this.heading = heading;
      this.mesh.rotation.y = heading;
    }
  }
  remove(scene) { scene.remove(this.mesh); }
}

/** Arcade driving for the player's car. input: {up,down,left,right}. */
export function drivePlayerCar(car, input, dt) {
  const forward = input.up ? 1 : 0;
  const back = input.down ? 1 : 0;
  if (forward) car.speed += GAME.CAR_ACCEL * dt;
  else if (back) car.speed -= (car.speed > 0.5 ? GAME.CAR_BRAKE : GAME.CAR_ACCEL * 0.6) * dt;
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
  car.speed = clamp(car.speed, -GAME.CAR_REVERSE, GAME.CAR_MAX_SPEED);
  const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  const steerFactor = clamp(Math.abs(car.speed) / 8, 0, 1) * (car.speed < 0 ? -1 : 1);
  car.heading += steer * 1.9 * steerFactor * dt;
  car.mesh.rotation.y = car.heading;
  car.mesh.position.x += Math.sin(car.heading) * car.speed * dt;
  car.mesh.position.z += Math.cos(car.heading) * car.speed * dt;
  // body lean
  car.mesh.rotation.z = -steer * 0.05 * clamp(Math.abs(car.speed) / 15, 0, 1);
}

/** Traffic: cars cruise the road grid, turning at intersections, slowing for the car ahead. */
export class Traffic {
  constructor(scene, seed = 1) {
    this.scene = scene;
    this.rng = mulberry32(seed * 7919 + 13);
    this.cars = [];
    for (let i = 0; i < 12; i += 1) {
      const road = pick(this.rng, CITY.ROADS);
      const along = range(this.rng, -120, 120);
      const horizontal = this.rng() < 0.5;
      const dir = this.rng() < 0.5 ? 1 : -1;
      const car = new Car(scene, horizontal ? along : road, horizontal ? road : along, horizontal ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI), pick(this.rng, CAR_COLORS));
      car.axis = horizontal ? 'x' : 'z';
      car.dir = dir;
      car.cruise = range(this.rng, 6, 10);
      car.speed = car.cruise;
      this.cars.push(car);
    }
  }
  step(dt, colliders) {
    for (const car of this.cars) {
      // car ahead on the same lane? slow down.
      let target = car.cruise;
      for (const other of this.cars) {
        if (other === car || other.axis !== car.axis || other.dir !== car.dir) continue;
        const along = car.axis === 'x' ? car.x : car.z;
        const oAlong = car.axis === 'x' ? other.x : other.z;
        const cross = car.axis === 'x' ? car.z : car.x;
        const oCross = car.axis === 'x' ? other.z : other.x;
        if (Math.abs(cross - oCross) > 4) continue;
        const gap = (oAlong - along) * car.dir;
        if (gap > 0 && gap < 10) target = Math.min(target, other.speed);
      }
      car.speed += clamp(target - car.speed, -14 * dt, 8 * dt);
      const nx = car.x + (car.axis === 'x' ? car.dir * car.speed * dt : 0);
      const nz = car.z + (car.axis === 'z' ? car.dir * car.speed * dt : 0);
      // reached the city edge or an intersection: maybe turn.
      const atEdge = car.axis === 'x' ? Math.abs(nx) > 128 : Math.abs(nz) > 128;
      const atCross = CITY.ROADS.some((r) => Math.abs((car.axis === 'x' ? nx : nz) - r) < 0.6);
      if (atEdge || (atCross && this.rng() < 0.02)) {
        if (atEdge) {
          car.dir *= -1;
          car.heading += Math.PI;
          car.mesh.rotation.y = car.heading;
        } else {
          // turn onto the crossing road
          const crossRoad = (car.axis === 'x' ? nz : nx);
          const snapped = CITY.ROADS.reduce((a, r) => (Math.abs(r - crossRoad) < Math.abs(a - crossRoad) ? r : a), CITY.ROADS[0]);
          if (car.axis === 'x') { car.setPos(car.x, snapped, 0); car.axis = 'z'; }
          else { car.setPos(snapped, car.z, 0); car.axis = 'x'; }
          car.dir = this.rng() < 0.5 ? 1 : -1;
          car.heading = car.axis === 'x' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
          car.mesh.rotation.y = car.heading;
        }
      }
      car.mesh.position.x = nx;
      car.mesh.position.z = nz;
      car.mesh.rotation.y = car.heading;
      // keep off buildings (should not happen on roads, but be safe)
      for (const b of colliders) {
        const p = { x: car.x, z: car.z };
        if (p.x > b.minX - 2 && p.x < b.maxX + 2 && p.z > b.minZ - 2 && p.z < b.maxZ + 2) {
          car.setPos(car.x, car.z, car.heading + Math.PI);
          car.dir *= -1;
          break;
        }
      }
    }
  }
}
