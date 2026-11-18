// SOLARA CITY v3 — vehicles: traffic that follows the road grid, parked cars
// the player can steal, and the gold coupe for mission 4. Cars are simple
// top-down rectangles with headlights, drawn by render.js.

import { WORLD, PLAYER } from './config.js';
import { mulberry32, pick, range, angleDiff } from './random.js';

export const CAR_COLORS = [
  '#c0392b', '#2980b9', '#7f8c8d', '#16a085', '#8e44ad',
  '#d35400', '#2c3e50', '#bdc3c7', '#e67e22', '#27ae60',
];

let nextCarId = 1;

export class Car {
  constructor(x, y, angle, color, opts = {}) {
    this.id = nextCarId++;
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.color = color;
    this.speed = 0;
    this.maxSpeed = opts.maxSpeed || 120 + Math.random() * 90;
    this.parked = !!opts.parked;
    this.gold = !!opts.gold;
    this.police = !!opts.police;
    this.wrecked = false;
    this.hp = opts.hp || 100;
    this.w = 46;
    this.h = 22;
    this.steer = 0;
    this.vertical = !!opts.vertical;
    this.targetSpeed = this.parked ? 0 : this.maxSpeed;
    this.stuckT = 0;
  }

  get moving() {
    return !this.parked && !this.wrecked;
  }
}

export class Traffic {
  constructor(city) {
    this.city = city;
    this.rng = mulberry32(20240);
    this.cars = [];
    this._spawnInitial();
  }

  _spawnInitial() {
    for (let i = 0; i < 13; i++) this.spawnTrafficCar();
    for (let i = 0; i < 11; i++) this.spawnParkedCar();
  }

  spawnTrafficCar() {
    const p = this.city.randomRoadPoint(this.rng);
    const angle = p.vertical ? (this.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (this.rng() < 0.5 ? 0 : Math.PI);
    const car = new Car(p.x, p.y, angle, pick(this.rng, CAR_COLORS), { vertical: p.vertical });
    this.cars.push(car);
    return car;
  }

  spawnParkedCar(near) {
    let p;
    let tries = 0;
    do {
      p = this.city.randomRoadPoint(this.rng);
      tries++;
    } while (near && Math.hypot(p.x - near.x, p.y - near.y) < 500 && tries < 12);
    const angle = p.vertical ? Math.PI / 2 : 0;
    const car = new Car(p.x + (p.vertical ? 34 : 0), p.y + (p.vertical ? 0 : 34), angle, pick(this.rng, CAR_COLORS), { parked: true, vertical: p.vertical });
    this.cars.push(car);
    return car;
  }

  spawnParkedAt(x, y, angle) {
    const car = new Car(x, y, angle, pick(this.rng, CAR_COLORS), { parked: true });
    this.cars.push(car);
    return car;
  }

  spawnGoldCoupe(x, y) {
    const car = new Car(x, y, -Math.PI / 2, '#f5c542', { parked: true, gold: true, maxSpeed: PLAYER.goldMaxSpeed });
    this.cars.push(car);
    return car;
  }

  nearestStealable(x, y, maxDist = 78) {
    let best = null;
    let bestD = maxDist * maxDist;
    for (const c of this.cars) {
      if (c.police || c.wrecked) continue;
      const dx = c.x - x;
      const dy = c.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD) { bestD = d2; best = c; }
    }
    return best;
  }

  // Traffic AI: drive along the current road; at intersections sometimes turn.
  update(dt, playerCar) {
    const city = this.city;
    for (const c of this.cars) {
      if (!c.moving) continue;
      // Gentle speed control toward target speed.
      const accel = c.speed < c.targetSpeed ? 90 : -160;
      c.speed = Math.max(0, Math.min(c.maxSpeed, c.speed + accel * dt));
      // At an intersection, occasionally turn onto the crossing road.
      const onV = city.roadsX.some((rx) => Math.abs(c.x - rx) < 8);
      const onH = city.roadsY.some((ry) => Math.abs(c.y - ry) < 8);
      if (onV && onH && this.rng() < dt * 0.55) {
        const turnV = this.rng() < 0.5;
        c.angle = turnV ? (this.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (this.rng() < 0.5 ? 0 : Math.PI);
        c.vertical = turnV;
      }
      // Stay on the road: if drifting off, steer back toward the centre line.
      const p = city.nearestRoadPoint(c.x, c.y);
      if (p) {
        const want = Math.atan2(p.y - c.y, p.x - c.x);
        const diff = angleDiff(c.angle, want);
        // Only correct when the road ahead is the one we are on.
        if (Math.abs(diff) < 1.2) c.angle += diff * Math.min(1, dt * 1.4);
      }
      const nx = c.x + Math.cos(c.angle) * c.speed * dt;
      const ny = c.y + Math.sin(c.angle) * c.speed * dt;
      const hit = city.collideBuildings(nx, ny, 22);
      c.x = hit.x;
      c.y = hit.y;
      if (hit.hit) { c.speed *= 0.4; }
      // Keep inside the world.
      c.x = Math.max(40, Math.min(WORLD.size - 40, c.x));
      c.y = Math.max(40, Math.min(WORLD.size - 40, c.y));
      // Avoid piling into the player's car: slow down when close ahead.
      if (playerCar && playerCar !== c) {
        const d = Math.hypot(c.x - playerCar.x, c.y - playerCar.y);
        if (d < 90) c.speed = Math.min(c.speed, 40);
      }
    }
    // Top up traffic if some cars got wrecked or removed.
    const moving = this.cars.filter((c) => c.moving && !c.police).length;
    if (moving < 10) this.spawnTrafficCar();
  }
}
