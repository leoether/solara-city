// SOLARA CITY — world.js
// Kota prosedural: grid jalan, blok gedung, taman, lampu jalan, dan pantai
// di sisi selatan. Menyediakan query jalan (untuk traffic/pejalan) dan
// tabrakan sederhana terhadap gedung (AABB).

import { WORLD, COLORS } from './config.js';
import { mulberry32, pick, range } from './random.js';

const BUILDING_PALETTE = [
  '#7d7468', '#6b7f8f', '#8f6b5d', '#5d6b7a', '#9a8a6a', '#746b8f', '#84705a',
];
const ROOF_ACCENTS = ['#4a7a8a', '#8a4a4a', '#5a8a4a', '#c8a24a', '#3a3a4a'];

export function buildCity(seed = 20261119) {
  const rng = mulberry32(seed);
  const roads = [];      // {x,y,w,h} garis jalan (sumbu)
  const blocks = [];     // {x,y,w,h} blok tanah antar jalan
  const buildings = [];  // {x,y,w,h,color,roof,windows, height}
  const parks = [];      // {x,y,w,h,trees:[{x,y,r}]}
  const lamps = [];      // {x,y}
  const step = WORLD.block;
  const half = WORLD.road / 2;

  // Jalan horizontal + vertikal pada grid.
  for (let g = 0; g <= WORLD.size; g += step) {
    roads.push({ x: 0, y: g - half, w: WORLD.size, h: WORLD.road, axis: 'h' });
    roads.push({ x: g - half, y: 0, w: WORLD.road, h: WORLD.size, axis: 'v' });
  }

  // Blok di antara jalan; tiap blok berisi 1-4 gedung atau 1 taman.
  for (let bx = 0; bx < WORLD.size; bx += step) {
    for (let by = 0; by < WORLD.size; by += step) {
      const x0 = bx + half + WORLD.sidewalk;
      const y0 = by + half + WORLD.sidewalk;
      const w = step - WORLD.road - WORLD.sidewalk * 2;
      const h = step - WORLD.road - WORLD.sidewalk * 2;
      if (w <= 40 || h <= 40) continue;
      blocks.push({ x: x0, y: y0, w, h });
      const roll = rng();
      if (roll < 0.16) {
        // Taman dengan pohon acak.
        const trees = [];
        const n = 5 + Math.floor(rng() * 6);
        for (let i = 0; i < n; i++) {
          trees.push({ x: x0 + range(rng, 18, w - 18), y: y0 + range(rng, 18, h - 18), r: range(rng, 9, 16) });
        }
        parks.push({ x: x0, y: y0, w, h, trees });
      } else {
        // 1 gedung besar atau 2x2 gedung kecil.
        const split = rng() < 0.45;
        const cols = split ? 2 : 1;
        const rows = split ? 2 : 1;
        const gap = 14;
        const cw = (w - gap * (cols - 1)) / cols;
        const ch = (h - gap * (rows - 1)) / rows;
        for (let cx = 0; cx < cols; cx++) {
          for (let cy = 0; cy < rows; cy++) {
            const bw = cw * range(rng, 0.72, 0.96);
            const bh = ch * range(rng, 0.72, 0.96);
            buildings.push({
              x: x0 + cx * (cw + gap) + (cw - bw) / 2,
              y: y0 + cy * (ch + gap) + (ch - bh) / 2,
              w: bw, h: bh,
              color: pick(rng, BUILDING_PALETTE),
              roof: pick(rng, ROOF_ACCENTS),
              height: 6 + Math.floor(rng() * 22),
              winSeed: Math.floor(rng() * 1e9),
            });
          }
        }
      }
    }
  }

  // Lampu jalan di tiap persimpangan (sudut kanan atas).
  for (let gx = 0; gx <= WORLD.size; gx += step) {
    for (let gy = 0; gy <= WORLD.size; gy += step) {
      lamps.push({ x: gx + half + 8, y: gy - half - 8 });
    }
  }

  return { roads, blocks, buildings, parks, lamps, size: WORLD.size };
}

// Apakah titik berada di atas jalan (aspal)? Jalan adalah pita selebar
// WORLD.road yang berpusat pada tiap garis grid.
export function onRoad(city, x, y) {
  const step = WORLD.block;
  const half = WORLD.road / 2;
  const mx = Math.min(x % step, step - (x % step));
  const my = Math.min(y % step, step - (y % step));
  return mx <= half || my <= half;
}

// Titik jalan terdekat (dipakai spawn traffic / polisi).
export function nearestRoadPoint(city, x, y) {
  const step = WORLD.block;
  const rx = Math.round(x / step) * step;
  const ry = Math.round(y / step) * step;
  // Pilih sumbu jalan terdekat.
  const dx = Math.abs(x - rx);
  const dy = Math.abs(y - ry);
  if (dx < dy) return { x: rx, y, axis: 'v' };
  return { x, y: ry, axis: 'h' };
}

// Tabrakan lingkaran vs gedung: kembalikan gedung yang ditabrak atau null.
export function collideBuildings(city, x, y, r) {
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx, dy = y - cy;
    if (dx * dx + dy * dy < r * r) return b;
  }
  return null;
}

// Dorong lingkaran keluar dari gedung; kembalikan posisi terkoreksi.
export function resolveBuildingCollision(city, x, y, r) {
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    let dx = x - cx, dy = y - cy;
    let d = Math.hypot(dx, dy);
    if (d < r) {
      if (d < 0.001) { dx = 0; dy = -1; d = 1; }
      const push = r - d;
      x += (dx / d) * push;
      y += (dy / d) * push;
    }
  }
  const m = 20;
  x = Math.max(m, Math.min(WORLD.size - m, x));
  y = Math.max(m, Math.min(WORLD.size - m, y));
  return { x, y };
}
