// SOLARA CITY — vehicles.js
// Car physics (arcade: accel, steering, drift, skid), traffic AI,
// parked-car spawning, collisions with buildings and other cars.

import { WORLD_W, WORLD_H } from './state.js';
import { ROAD, ROAD_W, collidesWithBuildings, clampToWorld } from './world.js';

let nextCarId = 1;

const CAR_COLORS = [
  '#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c',
  '#e67e22', '#ecf0f1', '#2c3e50', '#fd79a8', '#00cec9',
  '#6c5ce7', '#d63031', '#00b894', '#fdcb6e',
];

export function makeCar(x, y, angle, color, kind) {
  return {
    id: nextCarId++,
    x, y, angle,
    speed: 0,
    color: color || CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
    kind: kind || 'sedan', // sedan | taxi | truck | coupe | police
    gold: false,
    parked: true,
    w: 46, h: 22,
    drift: 0,
    brakeLight: false,
    headlight: false,
    honkCooldown: 0,
  };
}

export function spawnParkedCars(world, count) {
  const cars = [];
  let guard = 0;
  while (cars.length < count && guard++ < count * 40) {
    // Parked cars sit on a road centre line, facing along the road,
    // so driving away from the spot is always clear.
    const vertical = Math.random() < 0.5;
    let x, y, angle;
    if (vertical) {
      const bx = Math.floor(Math.random() * (WORLD_W / ROAD));
      x = bx * ROAD + ROAD_W / 2 + (Math.random() - 0.5) * 30;
      y = 120 + Math.random() * (WORLD_H - 240);
      angle = Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      const by = Math.floor(Math.random() * (WORLD_H / ROAD));
      y = by * ROAD + ROAD_W / 2 + (Math.random() - 0.5) * 30;
      x = 120 + Math.random() * (WORLD_W - 240);
      angle = Math.random() < 0.5 ? 0 : Math.PI;
    }
    const p = clampToWorld(x, y, 60);
    if (collidesWithBuildings(world, p.x, p.y, 30)) continue;
    if (cars.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < 90)) continue;
    const car = makeCar(p.x, p.y, angle, undefined, 'sedan');
    car.parked = true;
    cars.push(car);
  }
  return cars;
}

export function spawnTrafficCar(world, cars) {
  const bx = Math.floor(Math.random() * (WORLD_W / 400));
  const by = Math.floor(Math.random() * (WORLD_H / 400));
  const horizontal = Math.random() < 0.5;
  let x, y, angle;
  if (horizontal) {
    y = by * 400 + 48 + (Math.random() < 0.5 ? -14 : 14);
    x = 60 + Math.random() * (WORLD_W - 120);
    angle = y % 2 === 0 ? 0 : Math.PI;
    angle = Math.random() < 0.5 ? 0 : Math.PI;
  } else {
    x = bx * 400 + 48 + (Math.random() < 0.5 ? -14 : 14);
    y = 60 + Math.random() * (WORLD_H - 120);
    angle = Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
  }
  const kind = Math.random() < 0.12 ? 'taxi' : (Math.random() < 0.1 ? 'truck' : 'sedan');
  const car = makeCar(x, y, angle, kind === 'taxi' ? '#f7c948' : undefined, kind);
  car.parked = false;
  car.speed = 90 + Math.random() * 70;
  car.w = kind === 'truck' ? 62 : 46;
  cars.push(car);
  return car;
}

// Arcade driving: throttle accelerates, steering scales with speed,
// hard turns at speed build drift and drop skid marks (handled by caller).
export function updateDrivenCar(car, input, dt, world, onCrash) {
  const maxSpeed = car.gold ? 560 : 470;
  const maxReverse = 170;
  const accel = 340;
  const brake = 620;
  const drag = 0.55;
  const prevSpeed = car.speed;

  if (input.up) car.speed += accel * dt;
  else if (input.down) {
    if (car.speed > 8) car.speed -= brake * dt;
    else car.speed -= accel * 0.55 * dt;
  } else {
    car.speed -= car.speed * drag * dt;
  }
  if (car.speed > maxSpeed) car.speed = maxSpeed;
  if (car.speed < -maxReverse) car.speed = -maxReverse;
  if (Math.abs(car.speed) < 4 && !input.up && !input.down) car.speed = 0;

  const steerAuthority = Math.min(1, Math.abs(car.speed) / 130);
  const steerRate = 2.5 * steerAuthority * (car.speed >= 0 ? 1 : -1);
  let steering = 0;
  if (input.left) steering -= 1;
  if (input.right) steering += 1;
  const hardTurn = steering !== 0 && Math.abs(car.speed) > 300;
  car.angle += steering * steerRate * dt;
  car.drift = hardTurn ? Math.min(1, car.drift + dt * 3) : Math.max(0, car.drift - dt * 2.5);
  car.brakeLight = !!input.down && car.speed > 8;

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const hit = collidesWithBuildings(world, nx, ny, 22);
  if (hit) {
    // Crash: stop hard, bounce slightly, report impact.
    const impact = Math.abs(car.speed);
    car.speed = -car.speed * 0.18;
    car.x -= Math.cos(car.angle) * 6;
    car.y -= Math.sin(car.angle) * 6;
    if (impact > 120 && onCrash) onCrash(impact, car.x, car.y);
    return { crashed: impact > 120, impact };
  }
  const clamped = clampToWorld(nx, ny, 34);
  car.x = clamped.x;
  car.y = clamped.y;
  if ((clamped.x !== nx || clamped.y !== ny) && Math.abs(prevSpeed) > 150 && onCrash) {
    onCrash(Math.abs(prevSpeed), car.x, car.y);
  }
  return { crashed: false, impact: 0, hardTurn, speed: car.speed };
}

export function updateTrafficCar(car, dt, world, cars) {
  // Traffic cruises along its lane; slows when a car is ahead, turns at
  // intersections sometimes. Keeps to roads by construction.
  const ahead = cars.some((c) => {
    if (c === car || c.parked) return false;
    const dx = c.x - car.x;
    const dy = c.y - car.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 120 || dist < 1) return false;
    const dot = (dx * Math.cos(car.angle) + dy * Math.sin(car.angle)) / dist;
    return dot > 0.86;
  });
  const target = ahead ? 0 : (car.kind === 'truck' ? 95 : 130);
  car.speed += (target - car.speed) * Math.min(1, dt * 1.4);
  // Occasional turn at an intersection (near a road centre crossing).
  const nearX = Math.abs((car.x % 400) - 48) < 14;
  const nearY = Math.abs((car.y % 400) - 48) < 14;
  if (nearX && nearY && Math.random() < dt * 0.25) {
    const turn = (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2;
    car.angle += turn;
  }
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  const clamped = clampToWorld(car.x, car.y, 30);
  if (clamped.x !== car.x || clamped.y !== car.y) {
    car.angle += Math.PI;
    car.x = clamped.x;
    car.y = clamped.y;
  }
}

export function carDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function nearestParkedCar(cars, x, y, maxDist = 70) {
  let best = null;
  let bestD = maxDist;
  for (const c of cars) {
    if (!c.parked) continue;
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}
