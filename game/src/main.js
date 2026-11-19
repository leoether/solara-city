// SOLARA CITY — game bootstrap (fresh build v5). init(), loop(dt),
// handleInput(), updateWanted(level), shooting, stealing, busted/wasted,
// save/continue, and the window.__solara debug API used by the playtest
// and screenshot scripts.

import { createState, VIEW_W, VIEW_H, WORLD_W, WORLD_H, clamp, dist, mulberry32 } from './state.js';
import { AudioSys } from './audio.js';
import { genCity, collideBuildings, isOnRoad } from './world.js';
import { spawnTraffic, spawnParked, nearestParkedCar, updateTraffic, updatePlayerCar, addSparks } from './vehicles.js';
import { spawnCops, updateCops } from './police.js';
import { startMission, updateMission, onBusted, saveGame, loadSave } from './missions.js';
import { render, drawScreen } from './render.js';
import { drawHUD } from './hud.js';
import { applyShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const S = createState();
const audio = new AudioSys();
const city = genCity();
const rng = mulberry32(31337);

let lastT = 0;
let mouse = { x: VIEW_W / 2, y: VIEW_H / 2 };

export function init() {
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;
  spawnTraffic(S, city, 14);
  spawnParked(S, city, 12);
  for (let i = 0; i < 16; i++) {
    S.peds.push({
      x: 200 + rng() * (WORLD_W - 400),
      y: 200 + rng() * (WORLD_H - 400),
      angle: rng() * Math.PI * 2,
      speed: 22 + rng() * 26,
      color: ['#ff6b6b', '#48dbfb', '#feca57', '#1dd1a1', '#ff9ff3'][i % 5],
      walkPhase: rng() * 6.28, panic: 0,
    });
  }
  S.hasSave = !!loadSave();
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) * (VIEW_W / r.width);
    mouse.y = (e.clientY - r.top) * (VIEW_H / r.height);
  });
  canvas.addEventListener('mousedown', (e) => {
    if (S.mode === 'playing') shootAt(mouse.x, mouse.y);
  });
  requestAnimationFrame(loop);
}

export function updateWanted(level) {
  S.wanted = clamp(level, 0, 3);
  spawnCops(S, city);
}

function startGame(fromSave) {
  audio.ensure();
  const save = fromSave ? loadSave() : null;
  if (save) {
    S.cash = save.cash || 0;
    S.earned = save.earned || 0;
    S.missionIndex = save.missionIndex || 0;
  } else {
    S.cash = 0; S.earned = 0; S.missionIndex = 0;
  }
  S.player.health = 100;
  S.player.onFoot = true;
  S.player.car = null;
  S.wanted = 0;
  S.cops.length = 0;
  S.mode = 'playing';
  startMission(S, city, Math.min(S.missionIndex, 3));
  S.banner = 'MISI ' + (Math.min(S.missionIndex, 3) + 1) + ' DIMULAI — CURI MOBIL DULU (E)';
  S.bannerT = 3;
}

function handleInput() {
  const k = S.keys;
  const input = {
    up: !!(k['arrowup'] || k['w']),
    down: !!(k['arrowdown'] || k['s']),
    left: !!(k['arrowleft'] || k['a']),
    right: !!(k['arrowright'] || k['d']),
  };
  const p = S.player;
  if (p.onFoot) {
    const sp = 240;
    let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    if (dx || dy) {
      const len = Math.hypot(dx, dy);
      dx /= len; dy /= len;
      p.angle = Math.atan2(dy, dx);
      const nx = clamp(p.x + dx * sp * dtGlobal, 30, WORLD_W - 30);
      const ny = clamp(p.y + dy * sp * dtGlobal, 30, WORLD_H - 30);
      const col = collideBuildings(nx, ny, 10, city);
      p.x = col.x; p.y = col.y;
    }
    if (input.up || input.down || input.left || input.right) {
      // Aim on foot toward the mouse.
      const wx = mouse.x - VIEW_W / 2 + S.cam.x;
      const wy = mouse.y - VIEW_H / 2 + S.cam.y;
      p.angle = Math.atan2(wy - p.y, wx - p.x);
    }
    audio.engine(0, false);
  } else {
    updatePlayerCar(S, dtGlobal, city, audio, input);
  }
  // Steal prompt target.
  S.stealTarget = p.onFoot ? nearestParkedCar(S, 70) : null;
}

let dtGlobal = 0.016;

function shootAt(sx, sy) {
  const p = S.player;
  if (p.shootCd > 0 || p.onFoot === false) return;
  p.shootCd = 0.28;
  p.muzzle = 0.09;
  const wx = sx - VIEW_W / 2 + S.cam.x;
  const wy = sy - VIEW_H / 2 + S.cam.y;
  const a = Math.atan2(wy - p.y, wx - p.x);
  p.angle = a;
  S.bullets.push({ x: p.x + Math.cos(a) * 20, y: p.y + Math.sin(a) * 20, vx: Math.cos(a) * 720, vy: Math.sin(a) * 720, life: 0.9 });
  S.stats.shots++;
  S.shake = Math.max(S.shake, 1.5);
  audio.shoot();
}

function updateBullets(dt) {
  for (let i = S.bullets.length - 1; i >= 0; i--) {
    const b = S.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead) {
      for (const c of S.cops) {
        if (dist(b.x, b.y, c.x, c.y) < 26) {
          c.health -= 34;
          S.stats.hits++;
          addSparks(S, b.x, b.y, 8);
          S.floats.push({ x: b.x, y: b.y - 12, text: 'KENA!', life: 0.8, maxLife: 0.8, color: '#ffe14d', size: 18 });
          if (c.health <= 0) {
            addSparks(S, c.x, c.y, 30);
            S.shake = Math.max(S.shake, 10);
            audio.crash(true);
            S.cops.splice(S.cops.indexOf(c), 1);
            S.earned += 25; S.cash += 25;
            S.floats.push({ x: c.x, y: c.y - 20, text: '+$25', life: 1.2, maxLife: 1.2, color: '#2ecc71', size: 22 });
          }
          dead = true;
          break;
        }
      }
    }
    if (!dead) {
      for (const t of S.traffic) {
        if (dist(b.x, b.y, t.x, t.y) < 24) {
          t.health -= 34;
          S.stats.hits++;
          addSparks(S, b.x, b.y, 6);
          dead = true;
          break;
        }
      }
    }
    if (dead) S.bullets.splice(i, 1);
  }
}

function updateParticles(dt) {
  for (let i = S.particles.length - 1; i >= 0; i--) {
    const pt = S.particles[i];
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.life -= dt;
    if (pt.life <= 0) S.particles.splice(i, 1);
  }
  for (let i = S.skids.length - 1; i >= 0; i--) {
    S.skids[i].life -= dt;
    if (S.skids[i].life <= 0) S.skids.splice(i, 1);
  }
  for (let i = S.floats.length - 1; i >= 0; i--) {
    const f = S.floats[i];
    f.y -= 34 * dt;
    f.life -= dt;
    if (f.life <= 0) S.floats.splice(i, 1);
  }
}

function updatePeds(dt) {
  for (const ped of S.peds) {
    ped.walkPhase += dt * 6;
    // Panic + run away from fast nearby cars.
    let panic = 0;
    const cars = S.player.car ? [S.player.car] : [];
    for (const c of [...S.traffic, ...S.cops, ...cars]) {
      if (dist(ped.x, ped.y, c.x, c.y) < 90 && Math.abs(c.speed) > 120) { panic = 1; break; }
    }
    ped.panic = panic;
    const sp = ped.speed * (panic ? 3 : 1);
    ped.x += Math.cos(ped.angle) * sp * dt;
    ped.y += Math.sin(ped.angle) * sp * dt;
    if (!isOnRoad(ped.x, ped.y) && Math.random() < dt * 0.4) ped.angle += Math.PI / 2;
    if (Math.random() < dt * 0.25) ped.angle += (Math.random() - 0.5) * 1.4;
    ped.x = clamp(ped.x, 40, WORLD_W - 40);
    ped.y = clamp(ped.y, 40, WORLD_H - 40);
  }
}

function onKeyDown(e) {
  const key = e.key.toLowerCase();
  S.keys[key] = true;
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) e.preventDefault();
  if (S.mode === 'boot' && (key === 'enter' || key === ' ')) {
    startGame(!!loadSave());
    return;
  }
  if (S.mode === 'playing' && (key === 'p' || key === 'escape')) {
    S.mode = 'paused';
    return;
  }
  if (S.mode === 'paused') {
    if (key === 'p' || key === 'escape') S.mode = 'playing';
    if (key === 'r') { S.mode = 'boot'; S.hasSave = !!loadSave(); }
    return;
  }
  if ((S.mode === 'busted' || S.mode === 'wasted') && key === 'enter') {
    respawn();
    return;
  }
  if (S.mode === 'legend' && key === 'enter') {
    S.mode = 'playing';
    return;
  }
  if (S.mode !== 'playing') return;
  if (key === 'm') {
    S.muted = !S.muted;
    audio.setMuted(S.muted);
  }
  if (key === 'e') {
    const p = S.player;
    if (p.onFoot && S.stealTarget) stealCar(S.stealTarget);
    else if (!p.onFoot) exitCar();
  }
  if (key === ' ') shootAt(mouse.x, mouse.y);
}

function onKeyUp(e) {
  S.keys[e.key.toLowerCase()] = false;
}

function stealCar(car) {
  const p = S.player;
  car.parked = false;
  S.cars = S.cars.filter(c => c !== car);
  p.car = car;
  p.onFoot = false;
  car.isPlayer = true;
  S.stats.steals++;
  S.shake = Math.max(S.shake, 3);
  audio.horn();
  if (S.wanted === 0) {
    updateWanted(1);
    S.banner = 'MOBIL DICURI! WANTED LEVEL 1';
    S.bannerT = 2.4;
  }
  if (S.mission && S.mission.kind === 3 && S.goldCoupe === car) {
    // Mission 3 logic picks this up next update.
  }
}

function exitCar() {
  const p = S.player;
  if (!p.car) return;
  const car = p.car;
  car.isPlayer = false;
  car.parked = true;
  S.cars.push(car);
  p.car = null;
  p.onFoot = true;
  p.x = car.x + 46; p.y = car.y + 30;
  audio.engine(0, false);
}

function respawn() {
  const p = S.player;
  p.health = 100;
  p.onFoot = true;
  p.car = null;
  p.invuln = 3;
  p.x = WORLD_W / 2; p.y = WORLD_H / 2;
  S.wanted = 0;
  S.cops.length = 0;
  S.mode = 'playing';
  S.banner = 'KEMBALI KE KOTA — HATI-HATI!';
  S.bannerT = 2;
}

function loop(t) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
  lastT = t;
  dtGlobal = dt;
  S.time += dt;
  if (S.bannerT > 0) S.bannerT -= dt;
  if (S.flash > 0) S.flash -= dt * 2;
  const p = S.player;
  if (p.shootCd > 0) p.shootCd -= dt;
  if (p.muzzle > 0) p.muzzle -= dt;
  if (p.invuln > 0) p.invuln -= dt;

  if (S.mode === 'playing') {
    handleInput();
    updateTraffic(S, dt, city);
    updateCops(S, dt, city, audio);
    updateMission(S, dt, city, audio);
    updateBullets(dt);
    updatePeds(dt);
    // Health: wrecked car or cop damage can waste the player.
    if (p.health <= 0 && S.mode === 'playing') {
      S.mode = 'wasted';
      S.stats.deaths++;
      audio.wasted();
      audio.siren(false);
      audio.engine(0, false);
    }
  }
  updateParticles(dt);
  render(ctx, S, city);
  drawHUD(ctx, S);
  drawScreen(ctx, S);
}

// Debug / playtest API — used by playtest-cdp.js and capture-shots.js.
window.__solara = {
  state: S,
  city,
  start: (fromSave) => startGame(!!fromSave),
  stealNearest: () => {
    const c = nearestParkedCar(S, 500);
    if (c) {
      S.player.x = c.x; S.player.y = c.y;
      S.stealTarget = c;
      stealCar(c);
      return true;
    }
    return false;
  },
  teleport: (x, y) => {
    const p = S.player;
    if (p.car) { p.car.x = x; p.car.y = y; }
    p.x = x; p.y = y;
  },
  shoot: () => shootAt(VIEW_W / 2 + 200, VIEW_H / 2),
  setWanted: (n) => updateWanted(n),
  damage: (n) => { S.player.health -= n; },
  applyShot: (id) => applyShot(S, city, id),
  save: () => saveGame(S),
  load: () => loadSave(),
  pause: () => { if (S.mode === 'playing') S.mode = 'paused'; },
  resume: () => { if (S.mode === 'paused') S.mode = 'playing'; },
  respawn,
  mode: () => S.mode,
  errors: [],
};

window.addEventListener('error', (e) => window.__solara.errors.push(String(e.message || e.error)));
window.addEventListener('unhandledrejection', (e) => window.__solara.errors.push('rejection: ' + String(e.reason)));

init();
