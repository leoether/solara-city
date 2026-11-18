// SOLARA CITY v3 — pedestrians: walkers on the sidewalks who wander,
// pause, and flee from gunshots and speeding cars.

import { WORLD } from './config.js';
import { mulberry32, pick, range, clamp } from './random.js';

const SHIRT = ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c', '#ecf0f1', '#e67e22'];

export class Pedestrians {
  constructor(city) {
    this.city = city;
    this.rng = mulberry32(777);
    this.list = [];
    for (let i = 0; i < 26; i++) this.list.push(this._spawn());
  }

  _spawn() {
    const p = this.city.randomRoadPoint(this.rng);
    // Step off the road onto the sidewalk.
    const side = this.rng() < 0.5 ? -1 : 1;
    return {
      x: p.x + (p.vertical ? side * 78 : range(this.rng, -40, 40)),
      y: p.y + (p.vertical ? range(this.rng, -40, 40) : side * 78),
      angle: this.rng() * Math.PI * 2,
      speed: range(this.rng, 28, 62),
      shirt: pick(this.rng, SHIRT),
      state: 'walk', // walk | idle | flee | down
      stateT: range(this.rng, 0, 4),
      fleeX: 0,
      fleeY: 0,
    };
  }

  scare(x, y, radius = 260) {
    for (const p of this.list) {
      if (p.state === 'down') continue;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < radius) {
        p.state = 'flee';
        p.stateT = range(this.rng, 1.5, 3);
        p.fleeX = p.x - x;
        p.fleeY = p.y - y;
      }
    }
  }

  update(dt, playerPos, playerSpeed) {
    for (const p of this.list) {
      p.stateT -= dt;
      if (p.state === 'walk' && p.stateT <= 0) {
        p.state = this.rng() < 0.6 ? 'idle' : 'walk';
        p.stateT = range(this.rng, 1, 4);
        if (p.state === 'walk') p.angle = this.rng() * Math.PI * 2;
      } else if (p.state === 'idle' && p.stateT <= 0) {
        p.state = 'walk';
        p.stateT = range(this.rng, 2, 6);
        p.angle = this.rng() * Math.PI * 2;
      } else if (p.state === 'flee') {
        const len = Math.hypot(p.fleeX, p.fleeY) || 1;
        p.angle = Math.atan2(p.fleeY / len, p.fleeX / len);
        p.x += Math.cos(p.angle) * 150 * dt;
        p.y += Math.sin(p.angle) * 150 * dt;
        // Fleeing pedestrians stay inside the world.
        p.x = clamp(p.x, 30, WORLD.size - 30);
        p.y = clamp(p.y, 30, WORLD.size - 30);
        if (p.stateT <= 0) { p.state = 'walk'; p.stateT = range(this.rng, 2, 5); }
      }
      if (p.state === 'walk') {
        p.x += Math.cos(p.angle) * p.speed * dt;
        p.y += Math.sin(p.angle) * p.speed * dt;
        // Wander back toward roads; never walk through buildings.
        if (this.city.pointInBuilding(p.x, p.y)) {
          p.x -= Math.cos(p.angle) * p.speed * dt * 2;
          p.y -= Math.sin(p.angle) * p.speed * dt * 2;
          p.angle += Math.PI / 2;
        }
        if (p.x < 30 || p.x > WORLD.size - 30 || p.y < 30 || p.y > WORLD.size - 30) {
          p.angle += Math.PI;
        }
      }
      // Flee from a fast car bearing down on them.
      if (playerPos && playerSpeed > 240 && p.state !== 'flee') {
        const d = Math.hypot(p.x - playerPos.x, p.y - playerPos.y);
        if (d < 130) {
          p.state = 'flee';
          p.stateT = 1.6;
          p.fleeX = p.x - playerPos.x;
          p.fleeY = p.y - playerPos.y;
        }
      }
    }
  }
}
