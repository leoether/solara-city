// SOLARA CITY — vehicles: traffic AI, parked cars, player driving physics
// (fresh build v5). Car physics: arcade accel/steer, skid marks on hard
// turns, exhaust smoke, crash shake + sparks, building collision slide.

import {
  WORLD_W, WORLD_H, BLOCK, ROAD, CAR_COLORS, GOLD_COLOR,
  makeCar, clamp, angleLerp, mulberry32, dist,
} from './state.js';
import { isOnRoad, collideBuildings, randomRoadPoint } from './world.js';

const rng = mulberry32(777001);

export function spawnTraffic(S, city, n) {
  for (let i = 0; i < n; i++) {
    const p = randomRoadPoint(rng);
    const angle = (Math.random() < 0.5 ? 0 : Math.PI / 2) + (Math.random() < 0.5 ? 0 : Math.PI);
    const c = makeCar(p.x, p.y, angle, CAR_COLORS[i % CAR_COLORS.length], { isTraffic: true });
    c.speed = 60 + rng() * 60;
    c.cruise = c.speed;
    S.traffic.push(c);
  }
}

export function spawnParked(S, city, n) {
  let placed = 0;
  let guard = 0;
  while (placed < n && guard++ < n * 40) {
    const p = randomRoadPoint(rng);
    if (dist(p.x, p.y, S.player.x, S.player.y) < 260) continue;
    const angle = (Math.random() < 0.5 ? 0 : Math.PI / 2) + (Math.random() < 0.5 ? 0 : Math.PI);
    const c = makeCar(p.x, p.y, angle, CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)], { parked: true });
    S.cars.push(c);
    placed++;
  }
}

export function spawnGoldCoupe(S, city) {
  const p = randomRoadPoint(rng);
  const c = makeCar(p.x, p.y, rng() * Math.PI * 2, GOLD_COLOR, { isGold: true, parked: true });
  S.goldCoupe = c;
  S.cars.push(c);
  return c;
}

export function nearestParkedCar(S, maxD) {
  let best = null;
  let bestD = maxD;
  for (const c of S.cars) {
    if (!c.parked) continue;
    const d = dist(c.x, c.y, S.player.x, S.player.y);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

function addSmoke(S, x, y, color, n, spread, life, size) {
  for (let i = 0; i < n; i++) {
    S.particles.push({
      x: x + (Math.random() - 0.5) * spread,
      y: y + (Math.random() - 0.5) * spread,
      vx: (Math.random() - 0.5) * 30,
      vy: (Math.random() - 0.5) * 30,
      life: life * (0.6 + Math.random() * 0.6),
      maxLife: life,
      size: size * (0.7 + Math.random() * 0.6),
      color, kind: 'smoke',
    });
  }
}

export function addSparks(S, x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 90 + Math.random() * 220;
    S.particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 0.35 + Math.random() * 0.3, maxLife: 0.6,
      size: 2 + Math.random() * 3, color: Math.random() < 0.5 ? '#ffd166' : '#ff6b35',
      kind: 'spark',
    });
  }
}

export function updateTraffic(S, dt, city) {
  for (const c of S.traffic) {
    // Keep to roads: steer along current axis, turn at intersections.
    const mx = ((c.x % BLOCK) + BLOCK) % BLOCK;
    const my = ((c.y % BLOCK) + BLOCK) % BLOCK;
    const nearX = mx < ROAD / 2 + 14 || mx > ROAD - 14;
    const nearY = my < ROAD / 2 + 14 || my > ROAD - 14;
    if (nearX && nearY && Math.random() < dt * 0.7) {
      // At an intersection: maybe turn 90 degrees.
      c.angle += (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2;
      c.angle = Math.round(c.angle / (Math.PI / 2)) * (Math.PI / 2);
    }
    // Slow down if a car is right ahead.
    let slow = false;
    for (const o of S.traffic) {
      if (o === c) continue;
      const d = dist(c.x, c.y, o.x, o.y);
      if (d < 70) {
        const fa = Math.atan2(o.y - c.y, o.x - c.x);
        let dd = fa - c.angle;
        while (dd > Math.PI) dd -= Math.PI * 2;
        while (dd < -Math.PI) dd += Math.PI * 2;
        if (Math.abs(dd) < 0.6) { slow = true; break; }
      }
    }
    const target = slow ? 0 : (c.cruise || 90);
    c.speed += (target - c.speed) * Math.min(1, dt * 1.5);
    c.x += Math.cos(c.angle) * c.speed * dt;
    c.y += Math.sin(c.angle) * c.speed * dt;
    c.x = clamp(c.x, 40, WORLD_W - 40);
    c.y = clamp(c.y, 40, WORLD_H - 40);
    // Nudge back onto road if drifted into a block.
    if (!isOnRoad(c.x, c.y)) {
      const px = clamp(c.x - Math.cos(c.angle) * 40, 40, WORLD_W - 40);
      const py = clamp(c.y - Math.sin(c.angle) * 40, 40, WORLD_H - 40);
      if (isOnRoad(px, py)) { c.x = px; c.y = py; }
    }
  }
}

// Player driving. Returns events: { crashed, hard } for shake/sound.
export function updatePlayerCar(S, dt, city, audio, input) {
  const p = S.player;
  const car = p.car;
  if (!car) return null;
  const up = input.up, down = input.down, left = input.left, right = input.right;
  const maxSpeed = car.isGold ? 460 : 400;
  const accel = 300;
  if (up) car.speed += accel * dt;
  else if (down) car.speed -= accel * 0.7 * dt;
  else car.speed -= Math.sign(car.speed) * 130 * dt;
  if (Math.abs(car.speed) < 6 && !up && !down) car.speed = 0;
  car.speed = clamp(car.speed, -140, maxSpeed);
  const steerPower = 2.5 * clamp(Math.abs(car.speed) / 120, 0.25, 1);
  const turning = (left ? -1 : 0) + (right ? 1 : 0);
  const prevAngle = car.angle;
  if (turning !== 0 && Math.abs(car.speed) > 12) {
    car.angle += turning * steerPower * Math.sign(car.speed) * dt;
    // Hard turn at speed -> skid marks + dust.
    if (Math.abs(car.speed) > 220) {
      const bx = car.x - Math.cos(car.angle) * 20;
      const by = car.y - Math.sin(car.angle) * 20;
      S.skids.push({ x: bx, y: by, angle: car.angle, life: 2.2, maxLife: 2.2 });
      if (S.skids.length > 220) S.skids.shift();
      addSmoke(S, bx, by, '#cfd8dc', 1, 8, 0.5, 5);
      S.shake = Math.max(S.shake, 2);
    }
  }
  car.brakeLight = !!down && car.speed > 40;
  if (car.brakeLight) {
    addSmoke(S, car.x - Math.cos(car.angle) * 22, car.y - Math.sin(car.angle) * 22, '#b0bec5', 1, 10, 0.4, 6);
  }
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const col = collideBuildings(nx, ny, 22, city);
  let crashed = false;
  if (col.hit) {
    if (Math.abs(car.speed) > 130) {
      crashed = true;
      addSparks(S, col.x, col.y, 12);
      S.shake = Math.max(S.shake, Math.min(14, Math.abs(car.speed) / 30));
      car.health -= Math.abs(car.speed) / 22;
      car.speed *= -0.25;
      if (audio) audio.crash(true);
    } else {
      car.speed *= 0.4;
    }
  }
  car.x = clamp(col.x, 30, WORLD_W - 30);
  car.y = clamp(col.y, 30, WORLD_H - 30);
  // Bump traffic cars.
  for (const t of S.traffic) {
    const d = dist(car.x, car.y, t.x, t.y);
    if (d < 44 && d > 0.01) {
      const push = (44 - d) / 2;
      const ux = (car.x - t.x) / d, uy = (car.y - t.y) / d;
      t.x -= ux * push; t.y -= uy * push;
      if (Math.abs(car.speed) > 150) {
        addSparks(S, t.x, t.y, 8);
        S.shake = Math.max(S.shake, 6);
        t.health -= 12;
        car.speed *= 0.55;
        if (audio) audio.crash(false);
      }
    }
  }
  // Exhaust smoke while accelerating.
  if (up && Math.abs(car.speed) > 30 && Math.random() < dt * 22) {
    const ex = car.x - Math.cos(car.angle) * 24;
    const ey = car.y - Math.sin(car.angle) * 24;
    addSmoke(S, ex, ey, 'rgba(120,120,120,0.8)', 1, 6, 0.7, 7);
  }
  // Sync player position to the car.
  p.x = car.x; p.y = car.y; p.angle = car.angle;
  p.speed = car.speed;
  if (audio) audio.engine(clamp(Math.abs(car.speed) / maxSpeed, 0, 1), true);
  return { crashed, turnRate: Math.abs(car.angle - prevAngle) / Math.max(dt, 0.001) };
}
