// SOLARA CITY v3 — the city: a fixed-seed procedural grid of roads, blocks,
// buildings with lit windows, parks, trees and street lamps. Night palette.
// Layout is deterministic (seed 1337) so playtests and screenshots repeat.

import { WORLD, COLORS } from './config.js';
import { mulberry32, pick, range, rangeInt } from './random.js';

export class City {
  constructor(seed = 1337) {
    this.seed = seed;
    this.rng = mulberry32(seed);
    this.roadsX = [];
    this.roadsY = [];
    for (let x = WORLD.roadGap; x < WORLD.size; x += WORLD.roadGap) this.roadsX.push(x);
    for (let y = WORLD.roadGap; y < WORLD.size; y += WORLD.roadGap) this.roadsY.push(y);
    this.buildings = [];
    this.parks = [];
    this.trees = [];
    this.lamps = [];
    this.spawn = { x: WORLD.roadGap, y: WORLD.roadGap };
    this._buildBlocks();
  }

  _buildBlocks() {
    const rng = this.rng;
    const gap = WORLD.roadGap;
    const half = WORLD.roadWidth / 2;
    // Blocks sit between roads. Each block: buildings, or a park, or a plaza.
    for (let bx = 0; bx < this.roadsX.length; bx++) {
      for (let by = 0; by < this.roadsY.length; by++) {
        const x0 = this.roadsX[bx] + half + WORLD.blockPad;
        const y0 = this.roadsY[by] + half + WORLD.blockPad;
        const x1 = (bx + 1 < this.roadsX.length ? this.roadsX[bx + 1] : WORLD.size) - half - WORLD.blockPad;
        const y1 = (by + 1 < this.roadsY.length ? this.roadsY[by + 1] : WORLD.size) - half - WORLD.blockPad;
        if (x1 - x0 < 90 || y1 - y0 < 90) continue;
        const roll = rng();
        if (roll < 0.16) {
          // Park: grass, paths, trees, benches.
          const park = { x: x0, y: y0, w: x1 - x0, h: y1 - y0, trees: [] };
          const n = rangeInt(rng, 5, 9);
          for (let i = 0; i < n; i++) {
            park.trees.push({ x: range(rng, x0 + 14, x1 - 14), y: range(rng, y0 + 14, y1 - 14), r: range(rng, 9, 15) });
          }
          this.parks.push(park);
          for (const t of park.trees) this.trees.push(t);
          continue;
        }
        // 1-3 buildings per block, varied footprint and height colour.
        const nB = roll < 0.55 ? 1 : roll < 0.85 ? 2 : 3;
        for (let i = 0; i < nB; i++) {
          const bw = range(rng, 90, Math.max(100, (x1 - x0) / nB - 18));
          const bh = range(rng, 90, Math.max(100, (y1 - y0) / nB - 18));
          const bx0 = range(rng, x0, Math.max(x0 + 1, x1 - bw));
          const by0 = range(rng, y0, Math.max(y0 + 1, y1 - bh));
          const roof = pick(rng, [COLORS.buildingRoof, COLORS.buildingRoof2, COLORS.buildingRoof3]);
          const floors = rangeInt(rng, 2, 6);
          const windows = [];
          const cols = Math.max(2, Math.floor(bw / 34));
          const rows = Math.max(1, Math.floor(bh / 34));
          for (let c = 0; c < cols; c++) {
            for (let r = 0; r < rows; r++) {
              windows.push({ dx: 12 + c * 34, dy: 12 + r * 34, lit: rng() < 0.45, warm: rng() });
            }
          }
          this.buildings.push({ x: bx0, y: by0, w: bw, h: bh, roof, floors, windows });
        }
        // A couple of street trees on the block corners.
        for (let i = 0; i < 2; i++) {
          this.trees.push({ x: range(rng, x0, x1), y: range(rng, y0, y1), r: range(rng, 8, 13) });
        }
      }
    }
    // Street lamps along every road, both sides, staggered.
    for (const rx of this.roadsX) {
      for (let y = 120; y < WORLD.size - 60; y += 300) {
        this.lamps.push({ x: rx - WORLD.roadWidth / 2 - 10, y });
        this.lamps.push({ x: rx + WORLD.roadWidth / 2 + 10, y: y + 150 });
      }
    }
    for (const ry of this.roadsY) {
      for (let x = 120; x < WORLD.size - 60; x += 300) {
        this.lamps.push({ x, y: ry - WORLD.roadWidth / 2 - 10 });
        this.lamps.push({ x: x + 150, y: ry + WORLD.roadWidth / 2 + 10 });
      }
    }
  }

  isRoad(x, y) {
    const half = WORLD.roadWidth / 2;
    for (const rx of this.roadsX) if (Math.abs(x - rx) <= half) return true;
    for (const ry of this.roadsY) if (Math.abs(y - ry) <= half) return true;
    return false;
  }

  // Nearest point on a road centre line (for spawning cars / walkers).
  nearestRoadPoint(x, y) {
    let best = null;
    let bestD = Infinity;
    for (const rx of this.roadsX) {
      const d = Math.abs(x - rx);
      if (d < bestD) { bestD = d; best = { x: rx, y, vertical: true }; }
    }
    for (const ry of this.roadsY) {
      const d = Math.abs(y - ry);
      if (d < bestD) { bestD = d; best = { x, y: ry, vertical: false }; }
    }
    return best;
  }

  randomRoadPoint(rng) {
    if (rng() < 0.5) {
      const rx = pick(rng, this.roadsX);
      return { x: rx + range(rng, -28, 28), y: range(rng, 120, WORLD.size - 120), vertical: true };
    }
    const ry = pick(rng, this.roadsY);
    return { x: range(rng, 120, WORLD.size - 120), y: ry + range(rng, -28, 28), vertical: false };
  }

  // Push a circle (x, y, r) out of buildings. Returns corrected {x, y, hit}.
  collideBuildings(x, y, r) {
    let hit = false;
    for (const b of this.buildings) {
      const cx = Math.max(b.x, Math.min(x, b.x + b.w));
      const cy = Math.max(b.y, Math.min(y, b.y + b.h));
      const dx = x - cx;
      const dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        hit = true;
        if (d2 > 0.001) {
          const d = Math.sqrt(d2);
          x = cx + (dx / d) * r;
          y = cy + (dy / d) * r;
        } else {
          // Centre inside the box: push out along the smallest axis.
          const pushL = x - b.x + r;
          const pushR = b.x + b.w - x + r;
          const pushT = y - b.y + r;
          const pushB = b.y + b.h - y + r;
          const m = Math.min(pushL, pushR, pushT, pushB);
          if (m === pushL) x = b.x - r;
          else if (m === pushR) x = b.x + b.w + r;
          else if (m === pushT) y = b.y - r;
          else y = b.y + b.h + r;
        }
      }
    }
    return { x, y, hit };
  }

  pointInBuilding(x, y) {
    for (const b of this.buildings) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return true;
    }
    return false;
  }
}
