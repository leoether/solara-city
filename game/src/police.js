// SOLARA CITY — police.js
// Polisi: spawn di tepi layar sesuai wanted level, mengejar pemain dengan
// steering pursuit, menabrak untuk menghentikan. Busted bila polisi menempel
// pemain (jalan kaki) atau mobil pemain berhenti total di dekatnya.

import { WANTED, CAR } from './config.js';
import { clamp, angleDiff, dist } from './random.js';
import { makeCar, stepPlayerCar } from './vehicles.js';
import { nearestRoadPoint } from './world.js';

export function makeCop(x, y, angle) {
  const car = makeCar(x, y, angle, '#1c2733', { isCop: true });
  car.lightPhase = Math.random() * Math.PI * 2;
  return car;
}

// Jumlah polisi yang harus aktif untuk level wanted tertentu.
export function desiredCops(level) {
  return (WANTED[level] || WANTED[0]).cops;
}

// Spawn polisi di jalan terdekat, agak jauh dari pemain (di luar layar).
export function spawnCopNear(city, px, py, viewR) {
  const ang = Math.random() * Math.PI * 2;
  const d = viewR + 160 + Math.random() * 260;
  const p = nearestRoadPoint(city, px + Math.cos(ang) * d, py + Math.sin(ang) * d);
  const car = makeCop(p.x, p.y, p.axis === 'h' ? 0 : Math.PI / 2);
  car.speed = 200;
  return car;
}

// Kejar pemain: steering menuju pemain, kecepatan naik per level.
export function stepCop(cop, px, py, level, dt, city, fx) {
  const cfg = WANTED[level] || WANTED[0];
  const target = Math.atan2(py - cop.y, px - cop.x);
  const diff = angleDiff(cop.angle, target);
  const maxTurn = 2.6 * dt * cfg.aggression;
  cop.angle += clamp(diff, -maxTurn, maxTurn);
  const desired = cfg.copSpeed * (0.85 + 0.15 * Math.sin(cop.lightPhase));
  const dd = dist(cop.x, cop.y, px, py);
  const want = dd > 90 ? desired : desired * 0.45;
  cop.speed += (want - cop.speed) * Math.min(1, 1.6 * dt);
  cop.vx = Math.cos(cop.angle) * cop.speed;
  cop.vy = Math.sin(cop.angle) * cop.speed;
  cop.x += cop.vx * dt;
  cop.y += cop.vy * dt;
  cop.lightPhase += dt * 7;
  // Polisi menabrak gedung: pantulkan pelan.
  const hit = city.buildings.some((b) => cop.x > b.x - 14 && cop.x < b.x + b.w + 14 && cop.y > b.y - 14 && cop.y < b.y + b.h + 14);
  if (hit) {
    cop.angle += Math.PI / 2;
    cop.speed *= 0.5;
    cop.x -= cop.vx * dt * 2;
    cop.y -= cop.vy * dt * 2;
  }
  return dd;
}

// Busted? Polisi menempel pemain jalan kaki, atau mobil pemain nyaris
// berhenti sementara polisi menempel.
export function checkBusted(cops, player) {
  for (const cop of cops) {
    const d = dist(cop.x, cop.y, player.x, player.y);
    if (!player.inCar && d < 46) return cop;
    if (player.inCar && d < 58 && Math.abs(player.car.speed) < 45) return cop;
  }
  return null;
}
