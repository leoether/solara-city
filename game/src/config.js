// config.js — shared constants and small geometry helpers for SOLARA CITY.
// Original open-world crime game for make.fun gta6-01. No Rockstar assets, names or maps.
export const CITY = {
  ROAD_SPACING: 60,
  ROADS: [-120, -60, 0, 60, 120],
  ROAD_W: 14,
  HALF: 150, // playable extent; roads run -120..120, beach beyond +z
  BLOCK: 46,
};

export const GAME = {
  WALK_SPEED: 6,
  RUN_SPEED: 10,
  CAR_ACCEL: 16,
  CAR_MAX_SPEED: 27,
  CAR_REVERSE: 9,
  CAR_BRAKE: 30,
  PLAYER_HEALTH: 100,
  WANTED_MAX: 5,
  MISSION_REWARDS: [300, 500, 800, 1500],
};

export function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}
export function lerp(a, b, t) {
  return a + (b - a) * t;
}
export function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
export function dist2(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}
/** Push a circle (x, z, r) out of an axis-aligned box. Returns true when pushed. */
export function resolveCircleAABB(p, r, box) {
  const cx = clamp(p.x, box.minX, box.maxX);
  const cz = clamp(p.z, box.minZ, box.maxZ);
  const dx = p.x - cx;
  const dz = p.z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return false;
  if (d2 > 1e-6) {
    const d = Math.sqrt(d2);
    p.x = cx + (dx / d) * r;
    p.z = cz + (dz / d) * r;
  } else {
    // Centre inside the box: escape along the shallowest penetration axis.
    const pl = p.x - box.minX + r;
    const pr = box.maxX - p.x + r;
    const pt = p.z - box.minZ + r;
    const pb = box.maxZ - p.z + r;
    const m = Math.min(pl, pr, pt, pb);
    if (m === pl) p.x = box.minX - r;
    else if (m === pr) p.x = box.maxX + r;
    else if (m === pt) p.z = box.minZ - r;
    else p.z = box.maxZ + r;
  }
  return true;
}
