// SOLARA CITY — pedestrians.js
// Pejalan kaki: berjalan di trotoar sepanjang jalan grid, kadang menyeberang
// di persimpangan. Mereka lari menjauh bila ada tembakan di dekatnya.

import { PEDS, WORLD } from './config.js';
import { mulberry32, pick, range, dist } from './random.js';
import { onRoad } from './world.js';

export function spawnPeds(city, seed = 31337) {
  const rng = mulberry32(seed);
  const peds = [];
  for (let i = 0; i < PEDS.count; i++) {
    const gx = Math.floor(rng() * (WORLD.size / WORLD.block)) * WORLD.block;
    const gy = Math.floor(rng() * (WORLD.size / WORLD.block)) * WORLD.block;
    const axis = rng() < 0.5 ? 'h' : 'v';
    const side = (rng() < 0.5 ? -1 : 1) * (WORLD.road / 2 + WORLD.sidewalk / 2);
    peds.push({
      x: axis === 'h' ? gx + range(rng, 0, WORLD.block) : gx + side,
      y: axis === 'v' ? gy + range(rng, 0, WORLD.block) : gy + side,
      angle: axis === 'h' ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2),
      color: pick(rng, PEDS.colors),
      speed: PEDS.speed * range(rng, 0.8, 1.3),
      panic: 0,
      bob: rng() * Math.PI * 2,
    });
  }
  return peds;
}

export function stepPeds(peds, dt, city, danger) {
  for (const p of peds) {
    p.bob += dt * 9;
    // Panik: lari menjauh dari bahaya (tembakan / mobil ngebut).
    if (danger && dist(p.x, p.y, danger.x, danger.y) < 260) p.panic = 1.6;
    let speed = p.speed;
    if (p.panic > 0) {
      p.panic -= dt;
      speed *= 2.6;
      if (danger) {
        const away = Math.atan2(p.y - danger.y, p.x - danger.x);
        p.angle += (away - p.angle) * 0.12;
      }
    }
    const nx = p.x + Math.cos(p.angle) * speed * dt;
    const ny = p.y + Math.sin(p.angle) * speed * dt;
    // Tetap di trotoar / jalan: bila menabrak gedung, putar balik.
    const blocked = city.buildings.some((b) => nx > b.x - 8 && nx < b.x + b.w + 8 && ny > b.y - 8 && ny < b.y + b.h + 8);
    if (blocked) {
      p.angle += Math.PI / 2 + (Math.random() - 0.5);
    } else {
      p.x = nx; p.y = ny;
    }
    // Belok acak di persimpangan.
    const nearX = ((p.x % WORLD.block) + WORLD.block) % WORLD.block;
    const nearY = ((p.y % WORLD.block) + WORLD.block) % WORLD.block;
    const atJunction = (nearX < 10 || nearX > WORLD.block - 10) && (nearY < 10 || nearY > WORLD.block - 10);
    if (atJunction && Math.random() < 0.01) p.angle += (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2;
    p.x = Math.max(16, Math.min(WORLD.size - 16, p.x));
    p.y = Math.max(16, Math.min(WORLD.size - 16, p.y));
  }
}
