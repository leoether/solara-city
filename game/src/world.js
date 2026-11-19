// SOLARA CITY — world.js
// Procedural sun-soaked city: road grid, building blocks, parks, lamps,
// trees, plus parallax sky / hills / palms. Deterministic from a seed.

import { WORLD_W, WORLD_H } from './state.js';

export const ROAD = 400; // block pitch
export const ROAD_W = 96; // road width

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BUILDING_COLORS = [
  '#e8b48a', '#d99a6c', '#c98a7a', '#b8c4c9', '#a8b8c4',
  '#e0cfa8', '#c4a882', '#9fb8a8', '#d8a0a0', '#b0a8c8',
  '#f0d0a0', '#c0b090', '#8fb0c0', '#e8c8b0', '#a89078',
];
const ROOF_COLORS = ['#7a5a48', '#5a6a72', '#8a6a5a', '#4a5a62', '#6a5a4a'];

export function generateWorld(seed = 20261119) {
  const rand = mulberry32(seed);
  const buildings = [];
  const trees = [];
  const lamps = [];
  const parks = [];
  const hydrants = [];
  let id = 0;
  for (let bx = 0; bx < WORLD_W / ROAD; bx++) {
    for (let by = 0; by < WORLD_H / ROAD; by++) {
      const x0 = bx * ROAD + ROAD_W + 14;
      const y0 = by * ROAD + ROAD_W + 14;
      const w = ROAD - ROAD_W - 28;
      const h = ROAD - ROAD_W - 28;
      const roll = rand();
      if (roll < 0.16) {
        // Park block: grass + trees, no buildings.
        parks.push({ x: x0, y: y0, w, h });
        const n = 5 + Math.floor(rand() * 4);
        for (let i = 0; i < n; i++) {
          trees.push({
            x: x0 + 20 + rand() * (w - 40),
            y: y0 + 20 + rand() * (h - 40),
            r: 12 + rand() * 10,
            palm: rand() < 0.5,
          });
        }
        continue;
      }
      // 1-3 buildings per block.
      const count = 1 + Math.floor(rand() * 3);
      for (let i = 0; i < count; i++) {
        const bw = 90 + rand() * 110;
        const bh = 80 + rand() * 110;
        const bx0 = x0 + rand() * Math.max(1, w - bw);
        const by0 = y0 + rand() * Math.max(1, h - bh);
        buildings.push({
          id: id++,
          x: bx0, y: by0, w: bw, h: bh,
          color: BUILDING_COLORS[Math.floor(rand() * BUILDING_COLORS.length)],
          roof: ROOF_COLORS[Math.floor(rand() * ROOF_COLORS.length)],
          floors: 1 + Math.floor(rand() * 5),
          windows: rand() < 0.7,
        });
      }
      // Sidewalk trees + lamps around the block.
      for (let i = 0; i < 3; i++) {
        trees.push({
          x: x0 + rand() * w, y: y0 - 8 + rand() * 16,
          r: 10 + rand() * 8, palm: rand() < 0.6,
        });
      }
      lamps.push({ x: x0 + 8, y: y0 + 8 });
      lamps.push({ x: x0 + w - 8, y: y0 + h - 8 });
      if (rand() < 0.5) hydrants.push({ x: x0 + w - 20, y: y0 + 14 });
    }
  }
  return { buildings, trees, lamps, parks, hydrants, seed };
}

export function isOnRoad(x, y) {
  const mx = ((x % ROAD) + ROAD) % ROAD;
  const my = ((y % ROAD) + ROAD) % ROAD;
  return mx < ROAD_W || my < ROAD_W || mx > ROAD - 0 || my > ROAD - 0;
}

export function roadCenterCoord(v) {
  return Math.round(v / ROAD) * ROAD + ROAD_W / 2;
}

export function nearestRoadPoint(x, y) {
  // Snap to the nearest road centre line.
  const cx = Math.floor(x / ROAD) * ROAD + ROAD_W / 2;
  const cy = Math.floor(y / ROAD) * ROAD + ROAD_W / 2;
  const dx = Math.abs(x - cx);
  const dy = Math.abs(y - cy);
  if (dx < dy) return { x: cx, y };
  return { x, y: cy };
}

export function randomRoadPoint(rand, margin = 140) {
  const rx = Math.floor(rand() * (WORLD_W / ROAD));
  const ry = Math.floor(rand() * (WORLD_H / ROAD));
  const horizontal = rand() < 0.5;
  if (horizontal) {
    return {
      x: margin + rand() * (WORLD_W - margin * 2),
      y: ry * ROAD + ROAD_W / 2 + (rand() - 0.5) * 40,
    };
  }
  return {
    x: rx * ROAD + ROAD_W / 2 + (rand() - 0.5) * 40,
    y: margin + rand() * (WORLD_H - margin * 2),
  };
}

export function clampToWorld(x, y, margin = 40) {
  return {
    x: Math.max(margin, Math.min(WORLD_W - margin, x)),
    y: Math.max(margin, Math.min(WORLD_H - margin, y)),
  };
}

export function collidesWithBuildings(world, x, y, radius) {
  for (const b of world.buildings) {
    if (
      x + radius > b.x && x - radius < b.x + b.w &&
      y + radius > b.y && y - radius < b.y + b.h
    ) {
      return b;
    }
  }
  return null;
}

// Parallax backdrop: gradient sky, sun, distant hills, palm silhouettes.
// Drawn in screen space before the world, offset by camera * factor.
export function drawParallax(ctx, camX, camY, vw, vh, time) {
  const sky = ctx.createLinearGradient(0, 0, 0, vh);
  sky.addColorStop(0, '#ff9a5c');
  sky.addColorStop(0.45, '#ffb37a');
  sky.addColorStop(0.75, '#ffd9a0');
  sky.addColorStop(1, '#ffeec2');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, vw, vh);
  // Sun with slow pulse.
  const sunX = vw * 0.78 - (camX * 0.02 % (vw * 0.2));
  const sunY = vh * 0.2;
  const pulse = 1 + Math.sin(time * 0.7) * 0.03;
  const glow = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 150 * pulse);
  glow.addColorStop(0, 'rgba(255,244,200,0.95)');
  glow.addColorStop(0.35, 'rgba(255,214,140,0.55)');
  glow.addColorStop(1, 'rgba(255,214,140,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - 160, sunY - 160, 320, 320);
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath();
  ctx.arc(sunX, sunY, 44 * pulse, 0, Math.PI * 2);
  ctx.fill();
  // Far hills (slowest layer).
  ctx.fillStyle = '#c98a6a';
  ctx.beginPath();
  ctx.moveTo(0, vh * 0.62);
  for (let x = 0; x <= vw; x += 40) {
    const wx = x + camX * 0.05;
    const y = vh * 0.62 + Math.sin(wx * 0.006) * 26 + Math.sin(wx * 0.013 + 2) * 12;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(vw, vh);
  ctx.lineTo(0, vh);
  ctx.closePath();
  ctx.fill();
  // Near hills + palm silhouettes (faster layer).
  ctx.fillStyle = '#a86a52';
  ctx.beginPath();
  ctx.moveTo(0, vh * 0.74);
  for (let x = 0; x <= vw; x += 40) {
    const wx = x + camX * 0.12;
    const y = vh * 0.74 + Math.sin(wx * 0.009 + 5) * 18;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(vw, vh);
  ctx.lineTo(0, vh);
  ctx.closePath();
  ctx.fill();
  // Palm silhouettes along the bottom edge.
  ctx.strokeStyle = 'rgba(90,50,35,0.85)';
  ctx.lineWidth = 5;
  ctx.fillStyle = 'rgba(90,50,35,0.85)';
  for (let i = 0; i < 7; i++) {
    const px = ((i * 211 + 60 - camX * 0.18) % (vw + 120) + vw + 120) % (vw + 120) - 60;
    const py = vh * 0.97;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.quadraticCurveTo(px + 8, py - 46, px + 26, py - 62);
    ctx.stroke();
    for (let f = 0; f < 5; f++) {
      const a = -Math.PI * (0.15 + f * 0.18);
      ctx.beginPath();
      ctx.moveTo(px + 26, py - 62);
      ctx.quadraticCurveTo(
        px + 26 + Math.cos(a) * 26, py - 62 + Math.sin(a) * 16,
        px + 26 + Math.cos(a) * 44, py - 62 + Math.sin(a) * 30,
      );
      ctx.stroke();
    }
  }
}
