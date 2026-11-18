// SOLARA CITY v3 — combat: bullets fired by the player (Space) and by the
// police. Simple circle hits against police cars; player bullets also scare
// pedestrians. Muzzle flashes and tracers are drawn by render.js.

import { WORLD } from './config.js';

export class Combat {
  constructor() {
    this.bullets = []; // {x, y, angle, speed, from, life, damage}
    this.cooldown = 0;
  }

  playerShoot(x, y, angle) {
    if (this.cooldown > 0) return null;
    this.cooldown = 0.22;
    const b = {
      x: x + Math.cos(angle) * 26,
      y: y + Math.sin(angle) * 26,
      angle,
      speed: 780,
      from: 'player',
      life: 0.9,
      damage: 34,
    };
    this.bullets.push(b);
    return b;
  }

  policeShoot(x, y, angle) {
    const b = {
      x: x + Math.cos(angle) * 26,
      y: y + Math.sin(angle) * 26,
      angle,
      speed: 560,
      from: 'police',
      life: 1.1,
      damage: 9,
    };
    this.bullets.push(b);
    return b;
  }

  // Returns events: { hitPolice, hitPlayer, sparks: [{x,y}] }
  update(dt, police, player, pedestrians, city) {
    const events = { hitPolice: null, hitPlayer: false, sparks: [] };
    this.cooldown = Math.max(0, this.cooldown - dt);
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.life -= dt;
      b.x += Math.cos(b.angle) * b.speed * dt;
      b.y += Math.sin(b.angle) * b.speed * dt;
      let dead = b.life <= 0;
      // Bullets that left the world are gone even if their life remains.
      if (b.x < 0 || b.y < 0 || b.x > WORLD.size || b.y > WORLD.size) dead = true;
      if (city.pointInBuilding(b.x, b.y)) {
        events.sparks.push({ x: b.x, y: b.y });
        dead = true;
      }
      if (!dead && b.from === 'player') {
        const hit = police.damageNearest(b.x, b.y, 30, b.damage);
        if (hit) {
          events.hitPolice = hit;
          events.sparks.push({ x: b.x, y: b.y });
          dead = true;
        }
      }
      if (!dead && b.from === 'police') {
        const d = Math.hypot(b.x - player.x, b.y - player.y);
        const radius = player.inCar ? 26 : 16;
        if (d < radius) {
          events.hitPlayer = true;
          events.sparks.push({ x: b.x, y: b.y });
          dead = true;
        }
      }
      if (dead) this.bullets.splice(i, 1);
    }
    return events;
  }
}
