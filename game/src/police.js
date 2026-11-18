// SOLARA CITY v3 — police: pursuit cars whose count, speed and aggression
// scale with the wanted level. They ram the player; at wanted 2+ they shoot.
// A wrecked police car (hp 0) stops and despawns.

import { WORLD, PLAYER } from './config.js';
import { angleDiff, clamp } from './random.js';
import { Car } from './vehicles.js';

export class Police {
  constructor(city) {
    this.city = city;
    this.cars = [];
    this.shootCooldown = 0;
    this.bustContactT = 0; // seconds of slow contact (drives the BUSTED rule)
  }

  wantedCount(wanted) {
    if (wanted <= 0) return 0;
    if (wanted === 1) return 1;
    if (wanted === 2) return 2;
    return 4;
  }

  _spawnOne(px, py) {
    // Spawn off-screen-ish, on a road, 500-800px away from the player.
    for (let tries = 0; tries < 10; tries++) {
      const p = this.city.randomRoadPoint(Math.random);
      const d = Math.hypot(p.x - px, p.y - py);
      if (d > 480 && d < 900) {
        const car = new Car(p.x, p.y, Math.atan2(py - p.y, px - p.x), '#1f2937', {
          police: true, hp: 100, maxSpeed: 300,
        });
        this.cars.push(car);
        return car;
      }
    }
    const p = this.city.randomRoadPoint(Math.random);
    const car = new Car(p.x, p.y, 0, '#1f2937', { police: true, hp: 100, maxSpeed: 300 });
    this.cars.push(car);
    return car;
  }

  sync(wanted, px, py) {
    const want = this.wantedCount(wanted);
    const alive = this.cars.filter((c) => !c.wrecked);
    // Remove far-away extras first.
    while (alive.length > want) {
      const far = alive.reduce((a, b) => (
        Math.hypot(a.x - px, a.y - py) > Math.hypot(b.x - px, b.y - py) ? a : b
      ));
      this.cars.splice(this.cars.indexOf(far), 1);
      const i = alive.indexOf(far);
      if (i >= 0) alive.splice(i, 1);
    }
    while (alive.length < want) {
      const c = this._spawnOne(px, py);
      alive.push(c);
    }
    // Drop wrecked cars that have sat for a while.
    this.cars = this.cars.filter((c) => !c.wrecked || (c.wreckT || 0) < 6);
  }

  // Returns events for this frame: { ram: bool, shots: [{x,y,angle}] , busted: bool }
  update(dt, wanted, player) {
    const events = { ram: false, shots: [], busted: false };
    if (wanted <= 0) {
      this.bustContactT = 0;
      return events;
    }
    const aggression = wanted === 1 ? 0.8 : wanted === 2 ? 1.0 : 1.3;
    const maxSpeed = (wanted === 3 ? 470 : wanted === 2 ? 420 : 360) * aggression;
    this.shootCooldown -= dt;
    for (const c of this.cars) {
      if (c.wrecked) {
        c.wreckT = (c.wreckT || 0) + dt;
        continue;
      }
      const dx = player.x - c.x;
      const dy = player.y - c.y;
      const d = Math.hypot(dx, dy) || 1;
      const wantAngle = Math.atan2(dy, dx);
      // Steer toward the player, faster turn when close.
      const turn = clamp(angleDiff(c.angle, wantAngle), -1, 1);
      c.angle += turn * Math.min(1, dt * (2.4 + aggression)) * 1.6;
      // Chase speed: full when far, ease right off when close so the cop
      // can actually make contact instead of orbiting the player.
      const target = d > 130 ? maxSpeed : maxSpeed * clamp(d / 160, 0.2, 0.85);
      c.speed += (target - c.speed) * Math.min(1, dt * 1.1);
      c.x += Math.cos(c.angle) * c.speed * dt;
      c.y += Math.sin(c.angle) * c.speed * dt;
      const hit = this.city.collideBuildings(c.x, c.y, 22);
      c.x = hit.x;
      c.y = hit.y;
      if (hit.hit) c.speed *= 0.55;
      c.x = clamp(c.x, 40, WORLD.size - 40);
      c.y = clamp(c.y, 40, WORLD.size - 40);
      // Ram: contact with the player (56px covers the car nose + player).
      if (d < 56) {
        events.ram = true;
        // Push the player a little.
        player.x += (dx / d) * 26 * dt * 10;
        player.y += (dy / d) * 26 * dt * 10;
      }
      // Shoot at wanted 2+ when in range.
      if (wanted >= 2 && d < 430 && d > 90 && this.shootCooldown <= 0) {
        events.shots.push({ x: c.x, y: c.y, angle: wantAngle + (Math.random() - 0.5) * 0.16 });
        this.shootCooldown = wanted === 3 ? 1.1 : 1.7;
      }
    }
    // BUSTED: a cop lingers next to a slow/stopped player. Proximity-based
    // (not contact-only): a ramming cop bounces off and circles, so pure
    // contact time never accumulates — but a cop sitting on a stopped
    // player for ~1.6s of game time is a fair bust. Driving away breaks it.
    const playerSpeed = player.inCar ? Math.abs(player.carSpeed) : 0;
    let nearSlow = false;
    for (const c of this.cars) {
      if (c.wrecked) continue;
      const d = Math.hypot(player.x - c.x, player.y - c.y);
      if (d < 130 && (player.inCar ? playerSpeed < 70 : true)) nearSlow = true;
    }
    if (nearSlow) {
      this.bustContactT += dt;
      if (this.bustContactT > 1.6) {
        events.busted = true;
        this.bustContactT = 0;
      }
    } else {
      this.bustContactT = Math.max(0, this.bustContactT - dt * 0.5);
    }
    return events;
  }

  damageNearest(x, y, radius, dmg) {
    let best = null;
    let bestD = radius * radius;
    for (const c of this.cars) {
      if (c.wrecked) continue;
      const d2 = (c.x - x) * (c.x - x) + (c.y - y) * (c.y - y);
      if (d2 < bestD) { bestD = d2; best = c; }
    }
    if (!best) return null;
    best.hp -= dmg;
    if (best.hp <= 0) {
      best.wrecked = true;
      best.speed = 0;
      best.wreckT = 0;
    }
    return best;
  }
}
