// SOLARA CITY — police AI (fresh build v5). Cops spawn on roads away from
// the player, chase with steering, ram the player car, and bust the player
// on foot. Count + speed scale with wanted level.

import { WORLD_W, WORLD_H, COP_COLOR, makeCar, clamp, dist, angleLerp, mulberry32 } from './state.js';
import { randomRoadPoint } from './world.js';
import { addSparks } from './vehicles.js';

const rng = mulberry32(424242);

export function desiredCopCount(wanted) {
  return [0, 2, 4, 6][clamp(wanted, 0, 3)] || 0;
}

export function copTopSpeed(wanted) {
  return [0, 330, 380, 440][clamp(wanted, 0, 3)] || 0;
}

export function spawnCops(S, city) {
  const want = desiredCopCount(S.wanted);
  while (S.cops.length < want) {
    const p = randomRoadPoint(rng);
    if (dist(p.x, p.y, S.player.x, S.player.y) < 500) continue;
    const c = makeCar(p.x, p.y, Math.atan2(S.player.y - p.y, S.player.x - p.x), COP_COLOR, { isCop: true });
    c.speed = 120;
    c.siren = Math.random() * 6;
    S.cops.push(c);
  }
  while (S.cops.length > want) S.cops.pop();
}

export function updateCops(S, dt, city, audio) {
  const p = S.player;
  const top = copTopSpeed(S.wanted);
  for (const c of S.cops) {
    c.siren += dt;
    // Steer toward the player with a little wobble so chases feel alive.
    const wantAngle = Math.atan2(p.y - c.y, p.x - c.x) + Math.sin(S.time * 1.7 + c.siren) * 0.12;
    c.angle = angleLerp(c.angle, wantAngle, Math.min(1, dt * 2.4));
    const d = dist(c.x, c.y, p.x, p.y);
    const target = d > 260 ? top : top * 0.85;
    c.speed += (target - c.speed) * Math.min(1, dt * 1.2);
    c.x += Math.cos(c.angle) * c.speed * dt;
    c.y += Math.sin(c.angle) * c.speed * dt;
    c.x = clamp(c.x, 30, WORLD_W - 30);
    c.y = clamp(c.y, 30, WORLD_H - 30);
    // Ram the player car.
    if (p.car && d < 46) {
      const push = (46 - d);
      const ux = (p.car.x - c.x) / Math.max(d, 0.01);
      const uy = (p.car.y - c.y) / Math.max(d, 0.01);
      p.car.x += ux * push * 0.5;
      p.car.y += uy * push * 0.5;
      p.car.speed *= 0.92;
      p.car.health -= 6 * dt * 10;
      c.speed *= 0.8;
      if (Math.random() < dt * 6) {
        addSparks(S, p.car.x, p.car.y, 5);
        S.shake = Math.max(S.shake, 5);
        if (audio) audio.crash(false);
      }
      // Car wrecked -> player is thrown out on foot, health hit.
      if (p.car.health <= 0) {
        addSparks(S, p.car.x, p.car.y, 26);
        S.shake = Math.max(S.shake, 16);
        if (audio) audio.crash(true);
        p.health -= 25;
        const wreck = p.car;
        wreck.health = 0;
        p.car = null;
        p.onFoot = true;
        p.x = wreck.x + 40; p.y = wreck.y + 40;
        p.invuln = 2;
        S.banner = 'MOBIL HANCUR! LARI!';
        S.bannerT = 2.2;
      }
    }
    // Cop catches the player on foot -> BUSTED.
    if (p.onFoot && p.invuln <= 0 && d < 34 && S.wanted > 0 && S.mode === 'playing') {
      S.mode = 'busted';
      S.stats.busts++;
      if (audio) { audio.busted(); audio.siren(false); }
    }
  }
  if (audio) audio.siren(S.wanted > 0 && S.mode === 'playing');
}
