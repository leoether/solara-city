// SOLARA CITY — shared game state (fresh build v5, written in this session).
// A sun-soaked open-world crime game: steal cars, dodge the law, run four
// missions and become a SOLARA LEGEND. All tuning lives here so every module
// reads the same numbers.

export const WORLD_W = 3400;
export const WORLD_H = 3400;
export const ROAD = 150; // road width in world units
export const BLOCK = 340; // city block pitch (road + block)
export const VIEW_W = 1280;
export const VIEW_H = 720;

export const MISSION_REWARDS = [300, 500, 800, 1500];
export const LEGEND_TOTAL = 3100;
export const SAVE_KEY = 'solara-city-save-v5';

export const CAR_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
  '#1abc9c', '#e67e22', '#ecf0f1', '#34495e', '#fd79a8',
];
export const COP_COLOR = '#2c3e50';
export const GOLD_COLOR = '#ffd700';

// Small deterministic RNG so the city layout is stable between loads.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist(ax, ay, bx, by) { return Math.hypot(bx - ax, by - ay); }
export function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export function makeCar(x, y, angle, color, opts = {}) {
  return {
    x, y, angle, speed: 0, color,
    isPlayer: !!opts.isPlayer, isCop: !!opts.isCop, isGold: !!opts.isGold,
    isTraffic: !!opts.isTraffic, parked: !!opts.parked,
    w: 46, h: 22, health: opts.health ?? 100,
    targetAngle: angle, siren: 0, honk: 0, brakeLight: false,
  };
}

export function makePed(x, y, rng) {
  const palette = ['#ff6b6b', '#48dbfb', '#feca57', '#1dd1a1', '#c8d64f', '#ff9ff3'];
  return {
    x, y, angle: rng() * Math.PI * 2, speed: 22 + rng() * 26,
    color: palette[Math.floor(rng() * palette.length)],
    walkPhase: rng() * 6.28, panic: 0,
  };
}

export function createState() {
  return {
    mode: 'boot', // boot | playing | paused | busted | wasted | legend
    time: 0,
    cash: 0,
    earned: 0,
    missionIndex: 0, // 0..3 active, 4 = all done
    mission: null, // { kind, stage, timer, targetX, targetY, ... }
    missionMsg: '',
    banner: '', bannerT: 0,
    player: {
      x: WORLD_W / 2, y: WORLD_H / 2, angle: -Math.PI / 2,
      speed: 0, onFoot: true, health: 100, car: null,
      shootCd: 0, muzzle: 0, invuln: 0,
    },
    cars: [], traffic: [], cops: [], peds: [],
    bullets: [], particles: [], skids: [], floats: [],
    wanted: 0, heat: 0,
    shake: 0, shakeX: 0, shakeY: 0,
    cam: { x: WORLD_W / 2, y: WORLD_H / 2 },
    keys: {},
    stats: { shots: 0, hits: 0, busts: 0, deaths: 0, steals: 0 },
    goldCoupe: null,
    packagePos: null, destPos: null,
    surviveT: 0,
    flash: 0, flashColor: '255,255,255',
    legendShown: false,
    muted: false,
  };
}
