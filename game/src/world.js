// SOLARA CITY — city generation + world drawing (fresh build v5).
// Grid city: roads every BLOCK px, buildings inside blocks, parks, trees,
// street lamps. Deterministic layout from a seeded RNG so the map is
// stable between loads. Parallax sky + distant hills drawn behind the map.

import { WORLD_W, WORLD_H, ROAD, BLOCK, mulberry32, clamp } from './state.js';

export function genCity() {
  const rng = mulberry32(20261119);
  const buildings = [];
  const trees = [];
  const lamps = [];
  const parks = [];
  const roofColors = ['#5d6d7e', '#7f8c8d', '#a569bd', '#5499c7', '#48c9b0', '#ec7063', '#f5b041', '#82e0aa'];
  const wallColors = ['#2c3e50', '#34495e', '#6c3483', '#1a5276', '#145a32', '#7b241c', '#7d6608', '#4d5656'];
  const cols = Math.floor(WORLD_W / BLOCK);
  const rows = Math.floor(WORLD_H / BLOCK);
  for (let cx = 0; cx < cols; cx++) {
    for (let cy = 0; cy < rows; cy++) {
      const bx = cx * BLOCK + ROAD;
      const by = cy * BLOCK + ROAD;
      const bw = BLOCK - ROAD;
      const bh = BLOCK - ROAD;
      if (bx + bw > WORLD_W || by + bh > WORLD_H) continue;
      // One park per ~9 blocks, otherwise 1-3 buildings.
      if (rng() < 0.11) {
        parks.push({ x: bx + 8, y: by + 8, w: bw - 16, h: bh - 16 });
        for (let t = 0; t < 7; t++) {
          trees.push({ x: bx + 16 + rng() * (bw - 32), y: by + 16 + rng() * (bh - 32), r: 12 + rng() * 10 });
        }
        continue;
      }
      const n = 1 + Math.floor(rng() * 3);
      for (let i = 0; i < n; i++) {
        const w = 46 + rng() * 70;
        const h = 40 + rng() * 66;
        const x = bx + 14 + rng() * Math.max(1, bw - w - 28);
        const y = by + 14 + rng() * Math.max(1, bh - h - 28);
        buildings.push({
          x, y, w, h, tall: 0.5 + rng() * 1.6,
          wall: wallColors[Math.floor(rng() * wallColors.length)],
          roof: roofColors[Math.floor(rng() * roofColors.length)],
          windows: Math.floor(rng() * 3),
        });
      }
      for (let t = 0; t < 3; t++) {
        trees.push({ x: bx + 12 + rng() * (bw - 24), y: by + 12 + rng() * (bh - 24), r: 10 + rng() * 9 });
      }
    }
  }
  // Street lamps along road edges.
  for (let k = 0; k <= cols; k++) {
    for (let s = 0; s < rows; s++) {
      lamps.push({ x: k * BLOCK + ROAD / 2 - 6, y: s * BLOCK + ROAD + 60 + (s % 2) * 40 });
      lamps.push({ x: s * BLOCK + ROAD + 60 + (s % 2) * 40, y: k * BLOCK + ROAD / 2 - 6 });
    }
  }
  return { buildings, trees, lamps, parks };
}

export function isOnRoad(x, y) {
  const mx = ((x % BLOCK) + BLOCK) % BLOCK;
  const my = ((y % BLOCK) + BLOCK) % BLOCK;
  return mx < ROAD || my < ROAD;
}

export function pointInBuilding(x, y, city) {
  for (const b of city.buildings) {
    if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return b;
  }
  return null;
}

// Push a circle out of buildings; returns true if a collision happened.
export function collideBuildings(x, y, r, city) {
  let hit = false;
  for (const b of city.buildings) {
    const nx = clamp(x, b.x, b.x + b.w);
    const ny = clamp(y, b.y, b.y + b.h);
    const dx = x - nx, dy = y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.01) {
        const d = Math.sqrt(d2);
        x += (dx / d) * (r - d);
        y += (dy / d) * (r - d);
      } else {
        y -= r;
      }
    }
  }
  return { hit, x, y };
}

export function randomRoadPoint(rng, margin = 120) {
  // Pick a random intersection area, then a point on the road there.
  const gx = Math.floor(rng() * (WORLD_W / BLOCK));
  const gy = Math.floor(rng() * (WORLD_H / BLOCK));
  const horiz = rng() < 0.5;
  const x = horiz
    ? margin + rng() * (WORLD_W - margin * 2)
    : gx * BLOCK + ROAD / 2 + (rng() - 0.5) * (ROAD - 40);
  const y = horiz
    ? gy * BLOCK + ROAD / 2 + (rng() - 0.5) * (ROAD - 40)
    : margin + rng() * (WORLD_H - margin * 2);
  return { x: clamp(x, 80, WORLD_W - 80), y: clamp(y, 80, WORLD_H - 80) };
}

export function drawWorld(ctx, S, city, camX, camY, viewW, viewH) {
  // --- Parallax sky (screen space, before camera transform) ---
  const sky = ctx.createLinearGradient(0, 0, 0, viewH);
  sky.addColorStop(0, '#1b2a4a');
  sky.addColorStop(0.45, '#f39c12');
  sky.addColorStop(0.62, '#e67e22');
  sky.addColorStop(1, '#2c1a3a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, viewW, viewH);
  // Sun glow, slow parallax.
  const sunX = viewW * 0.78 - camX * 0.02;
  const sunY = viewH * 0.2 - camY * 0.01;
  const glow = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 260);
  glow.addColorStop(0, 'rgba(255,214,120,0.95)');
  glow.addColorStop(0.25, 'rgba(255,170,60,0.55)');
  glow.addColorStop(1, 'rgba(255,140,40,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - 260, sunY - 260, 520, 520);
  // Distant hills, mid parallax.
  ctx.fillStyle = '#3d2b52';
  ctx.beginPath();
  ctx.moveTo(0, viewH);
  const hillOff = (camX * 0.08) % 900;
  for (let x = -900; x <= viewW + 900; x += 60) {
    const hx = x - hillOff;
    const hy = viewH * 0.62 + Math.sin((x + hillOff) * 0.004) * 46;
    ctx.lineTo(hx, hy);
  }
  ctx.lineTo(viewW, viewH);
  ctx.closePath();
  ctx.fill();
  // Far tree line, faster parallax.
  ctx.fillStyle = '#243b2e';
  const treeOff = (camX * 0.15) % 140;
  for (let x = -140; x < viewW + 140; x += 140) {
    const tx = x - treeOff;
    ctx.beginPath();
    ctx.arc(tx, viewH * 0.66, 34, 0, Math.PI * 2);
    ctx.arc(tx + 46, viewH * 0.66, 26, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Ground (world space) ---
  const vx0 = camX - viewW / 2 - 80, vy0 = camY - viewH / 2 - 80;
  const vx1 = camX + viewW / 2 + 80, vy1 = camY + viewH / 2 + 80;
  ctx.fillStyle = '#3a7d44';
  ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);

  // Parks.
  for (const p of city.parks) {
    if (p.x > vx1 || p.x + p.w < vx0 || p.y > vy1 || p.y + p.h < vy0) continue;
    ctx.fillStyle = '#2f9e44';
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.strokeStyle = '#74c69d';
    ctx.lineWidth = 3;
    ctx.strokeRect(p.x, p.y, p.w, p.h);
  }

  // Roads: asphalt strips + sidewalks.
  ctx.fillStyle = '#23272e';
  const cols = Math.ceil(WORLD_W / BLOCK);
  for (let k = 0; k <= cols; k++) {
    ctx.fillRect(k * BLOCK, 0, ROAD, WORLD_H);
    ctx.fillRect(0, k * BLOCK, WORLD_W, ROAD);
  }
  ctx.fillStyle = '#8d99ae';
  for (let k = 0; k <= cols; k++) {
    ctx.fillRect(k * BLOCK - 8, 0, 8, WORLD_H);
    ctx.fillRect(k * BLOCK + ROAD, 0, 8, WORLD_H);
    ctx.fillRect(0, k * BLOCK - 8, WORLD_W, 8);
    ctx.fillRect(0, k * BLOCK + ROAD, WORLD_W, 8);
  }
  // Lane markings (dashed center lines).
  ctx.fillStyle = '#f1c40f';
  ctx.save();
  ctx.setLineDash([26, 30]);
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#f1c40f';
  for (let k = 0; k <= cols; k++) {
    ctx.beginPath(); ctx.moveTo(k * BLOCK + ROAD / 2, 0); ctx.lineTo(k * BLOCK + ROAD / 2, WORLD_H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, k * BLOCK + ROAD / 2); ctx.lineTo(WORLD_W, k * BLOCK + ROAD / 2); ctx.stroke();
  }
  ctx.restore();

  // Buildings with soft shadows + windows.
  for (const b of city.buildings) {
    if (b.x > vx1 || b.x + b.w < vx0 || b.y > vy1 || b.y + b.h < vy0) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(b.x + 8, b.y + 10, b.w, b.h);
    ctx.fillStyle = b.wall;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
    ctx.fillStyle = 'rgba(255,236,160,0.85)';
    const colsW = Math.max(1, Math.floor(b.w / 26));
    const rowsW = Math.max(1, Math.floor(b.h / 26));
    for (let i = 0; i < colsW; i++) {
      for (let j = 0; j < rowsW; j++) {
        if ((i * 7 + j * 3 + b.windows) % 3 === 0) continue;
        ctx.fillRect(b.x + 10 + i * 26, b.y + 10 + j * 26, 12, 10);
      }
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
  }

  // Trees.
  for (const t of city.trees) {
    if (t.x < vx0 || t.x > vx1 || t.y < vy0 || t.y > vy1) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.arc(t.x + 4, t.y + 5, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1e7d32';
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#43a047';
    ctx.beginPath(); ctx.arc(t.x - 3, t.y - 3, t.r * 0.6, 0, Math.PI * 2); ctx.fill();
  }

  // Street lamps (glow at dusk).
  for (const l of city.lamps) {
    if (l.x < vx0 || l.x > vx1 || l.y < vy0 || l.y > vy1) continue;
    ctx.fillStyle = '#222';
    ctx.fillRect(l.x - 2, l.y - 2, 4, 4);
    const lg = ctx.createRadialGradient(l.x, l.y, 2, l.x, l.y, 26);
    lg.addColorStop(0, 'rgba(255,220,120,0.5)');
    lg.addColorStop(1, 'rgba(255,220,120,0)');
    ctx.fillStyle = lg;
    ctx.beginPath(); ctx.arc(l.x, l.y, 26, 0, Math.PI * 2); ctx.fill();
  }
}
