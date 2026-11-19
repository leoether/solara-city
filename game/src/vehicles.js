// SOLARA CITY — vehicles.js
// Fisika mobil pemain (akselerasi, belok, drift ringan, tabrakan gedung) dan
// lalu lintas kota: mobil NPC yang mengikuti jalan grid dan menghindar.

import { CAR, TRAFFIC, WORLD } from './config.js';
import { clamp, angleDiff, mulberry32, pick, range } from './random.js';
import { onRoad, nearestRoadPoint, resolveBuildingCollision } from './world.js';

export function makeCar(x, y, angle, color, opts = {}) {
  return {
    x, y, angle, color,
    speed: 0,               // kecepatan sepanjang arah bodi
    vx: 0, vy: 0,           // kecepatan dunia (untuk drift)
    gold: !!opts.gold,
    parked: !!opts.parked,
    isPlayer: !!opts.isPlayer,
    isCop: !!opts.isCop,
    exhaust: 0,             // timer puff knalpot
    skid: 0,                // intensitas skid saat ini
  };
}

// Satu langkah fisika mobil pemain. Mengembalikan event: {crashed, strength}.
export function stepPlayerCar(car, input, dt, city, fx) {
  const prevSpeed = car.speed;
  const throttle = input.up ? 1 : input.down ? -1 : 0;
  if (input.up) car.speed += CAR.accel * dt;
  if (input.down) car.speed -= (car.speed > 8 ? CAR.brake : CAR.reverseAccel) * dt;
  // Gesekan + hambatan udara.
  car.speed -= car.speed * 0.55 * dt;
  car.speed = clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed);
  if (!input.up && !input.down && Math.abs(car.speed) < 6) car.speed = 0;

  const speedRatio = clamp(Math.abs(car.speed) / CAR.maxSpeed, 0, 1);
  const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  const dir = car.speed >= 0 ? 1 : -1;
  const turn = steer * CAR.turnRate * speedRatio * dir * dt;
  car.angle += turn;

  // Kecepatan dunia: sebagian mengikuti bodi (grip), sisanya drift.
  const fx2 = Math.cos(car.angle), fy = Math.sin(car.angle);
  const forward = car.vx * fx2 + car.vy * fy;
  const sideX = car.vx - forward * fx2;
  const sideY = car.vy - forward * fy;
  const targetForward = car.speed;
  const blend = 1 - Math.exp(-CAR.grip * dt);
  const nf = forward + (targetForward - forward) * blend;
  const damp = Math.exp(-6 * dt);
  car.vx = nf * fx2 + sideX * damp;
  car.vy = nf * fy + sideY * damp;
  car.skid = Math.min(1, Math.hypot(sideX, sideY) / 220 + (Math.abs(turn) > 0.02 && speedRatio > 0.55 ? 0.5 : 0));

  const nx = car.x + car.vx * dt;
  const ny = car.y + car.vy * dt;
  const before = { x: car.x, y: car.y };
  const fixed = resolveBuildingCollision(city, nx, ny, CAR.length * 0.45);
  car.x = fixed.x; car.y = fixed.y;
  const hitWall = (fixed.x !== nx || fixed.y !== ny);
  let crashed = false, strength = 0;
  if (hitWall && Math.abs(prevSpeed) > 130) {
    crashed = true;
    strength = Math.min(1, Math.abs(prevSpeed) / CAR.maxSpeed);
    car.speed *= 0.35;
    car.vx *= 0.3; car.vy *= 0.3;
    if (fx) fx.crashSparks(car.x, car.y, 14);
  } else if (hitWall) {
    car.speed *= 0.6; car.vx *= 0.5; car.vy *= 0.5;
  }
  // Knalpot: puff asap saat akselerasi.
  car.exhaust -= dt;
  if (input.up && car.exhaust <= 0 && Math.abs(car.speed) > 60) {
    car.exhaust = CAR.exhaustRate;
    if (fx) fx.exhaust(car.x - fx2 * 26, car.y - fy * 26);
  }
  // Skid marks saat belok tajam / rem.
  if (car.skid > 0.45 && Math.abs(car.speed) > 120 && fx) {
    fx.skidMark(car.x - fx2 * 20, car.y - fy * 20, car.angle);
  }
  return { crashed, strength, speedRatio };
}

// ---- Lalu lintas NPC ----

export function spawnTraffic(city, seed = 777) {
  const rng = mulberry32(seed);
  const cars = [];
  for (let i = 0; i < TRAFFIC.count; i++) {
    const gx = Math.floor(rng() * (WORLD.size / WORLD.block)) * WORLD.block;
    const gy = Math.floor(rng() * (WORLD.size / WORLD.block)) * WORLD.block;
    const axis = rng() < 0.5 ? 'h' : 'v';
    const off = (rng() < 0.5 ? -1 : 1) * 22;
    cars.push({
      x: axis === 'h' ? gx + range(rng, 0, WORLD.block) : gx + off,
      y: axis === 'v' ? gy + range(rng, 0, WORLD.block) : gy + off,
      angle: axis === 'h' ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2),
      color: pick(rng, TRAFFIC.colors),
      speed: TRAFFIC.speed * range(rng, 0.8, 1.15),
      wobble: rng() * Math.PI * 2,
    });
  }
  return cars;
}

// Mobil NPC jalan lurus di jalurnya; di persimpangan kadang belok.
export function stepTraffic(cars, dt, city, rngState) {
  for (const c of cars) {
    const nx = c.x + Math.cos(c.angle) * c.speed * dt;
    const ny = c.y + Math.sin(c.angle) * c.speed * dt;
    // Belok di persimpangan (titik grid) dengan peluang kecil.
    const nearX = Math.abs(((nx % WORLD.block) + WORLD.block) % WORLD.block);
    const nearY = Math.abs(((ny % WORLD.block) + WORLD.block) % WORLD.block);
    const atJunction = (nearX < 6 || nearX > WORLD.block - 6) && (nearY < 6 || nearY > WORLD.block - 6);
    if (atJunction && Math.random() < 0.012) {
      const turn = (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2;
      c.angle += turn;
    }
    // Tetap di jalan: bila keluar jalur, luruskan ke jalan terdekat.
    if (!onRoad(city, nx, ny)) {
      const p = nearestRoadPoint(city, nx, ny);
      c.x = p.x; c.y = p.y;
      c.angle = p.axis === 'h' ? (Math.cos(c.angle) >= 0 ? 0 : Math.PI) : (Math.sin(c.angle) >= 0 ? Math.PI / 2 : -Math.PI / 2);
    } else {
      c.x = nx; c.y = ny;
    }
    // Pantul di tepi dunia.
    if (c.x < 30 || c.x > WORLD.size - 30 || c.y < 30 || c.y > WORLD.size - 30) {
      c.angle += Math.PI;
      c.x = Math.max(30, Math.min(WORLD.size - 30, c.x));
      c.y = Math.max(30, Math.min(WORLD.size - 30, c.y));
    }
  }
}

// Mobil parkir yang bisa dicuri (tersebar di pinggir jalan).
export function spawnParkedCars(city, seed = 4242) {
  const rng = mulberry32(seed);
  const spots = [
    { x: 2350, y: 2100 }, { x: 900, y: 2350 }, { x: 3300, y: 900 },
    { x: 1200, y: 3300 }, { x: 3600, y: 2700 }, { x: 600, y: 1200 },
    { x: 2700, y: 600 }, { x: 1800, y: 3600 }, { x: 3900, y: 1800 },
    { x: 1500, y: 900 },
  ];
  return spots.map((s, i) => makeCar(s.x, s.y, (i % 4) * Math.PI / 2, pick(rng, TRAFFIC.colors), { parked: true }));
}
