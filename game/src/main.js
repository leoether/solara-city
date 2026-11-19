// SOLARA CITY — main.js
// Game orchestrator: init(), loop(dt), handleInput(), updateWanted(level).
// Boot -> start -> steal a car (E) -> drive -> 4 missions -> SOLARA LEGEND.
// Shooting, pause, busted/wasted, save/continue via localStorage.

import {
  createState, saveGame, loadGame, applySave, clearSave, hasSave,
  setWanted, addShake, showToast, showBanner, LEGEND_CASH,
  WORLD_W, WORLD_H,
} from './state.js';
import { SynthAudio } from './audio.js';
import { generateWorld, collidesWithBuildings, clampToWorld } from './world.js';
import {
  makeCar, spawnParkedCars, spawnTrafficCar, updateDrivenCar,
  updateTrafficCar, nearestParkedCar,
} from './vehicles.js';
import { syncCopsToWanted, updateCops, ramDamage, spawnCopsForWanted } from './police.js';
import {
  startMission, updateMission, failMission, tryStealGoldCoupe,
} from './missions.js';
import { render } from './render.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const state = createState();
state.camera = { x: 0, y: 0 };
const world = generateWorld(20261119);
const audio = new SynthAudio();

const input = {
  up: false, down: false, left: false, right: false,
  shoot: false, mouseX: 0, mouseY: 0, mouseDown: false,
};
const keys = new Set();
let lastTime = 0;
let shootCooldown = 0;
let trafficTimer = 0;
let pedTimer = 0;
let exhaustTimer = 0;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

function init() {
  state.cars = spawnParkedCars(world, 26);
  for (let i = 0; i < 9; i++) spawnTrafficCar(world, state.cars);
  spawnPeds(14);
  state.startedAt = performance.now();
  requestAnimationFrame(loop);
}

function spawnPeds(n) {
  const colors = ['#f39c12', '#8e44ad', '#16a085', '#c0392b', '#2c3e50', '#d35400'];
  for (let i = 0; i < n; i++) {
    const x = 120 + Math.random() * (WORLD_W - 240);
    const y = 120 + Math.random() * (WORLD_H - 240);
    state.peds.push({
      x, y, angle: Math.random() * Math.PI * 2,
      speed: 34 + Math.random() * 30,
      color: colors[Math.floor(Math.random() * colors.length)],
      turnTimer: 1 + Math.random() * 3,
    });
  }
}

function updateWanted(level) {
  setWanted(state, level);
  syncCopsToWanted(state);
  audio.setSiren(state.wanted > 0);
}

function updateCamera(dt) {
  const px = state.player.inCar && state.car ? state.car.x : state.player.x;
  const py = state.player.inCar && state.car ? state.car.y : state.player.y;
  const vw = canvas.width;
  const vh = canvas.height;
  const tx = Math.max(0, Math.min(WORLD_W - vw, px - vw / 2));
  const ty = Math.max(0, Math.min(WORLD_H - vh, py - vh / 2));
  const k = Math.min(1, dt * 5);
  state.camera.x += (tx - state.camera.x) * k;
  state.camera.y += (ty - state.camera.y) * k;
}

function spawnParticles(x, y, color, count, speed, size, life) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.4 + Math.random() * 0.8);
    state.particles.push({
      x, y,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      size: size * (0.6 + Math.random() * 0.8),
      color, life: life * (0.6 + Math.random() * 0.7),
      maxLife: life, alpha: 0.9,
    });
  }
}

function exhaustSmoke() {
  if (!state.player.inCar || !state.car) return;
  const car = state.car;
  const bx = car.x - Math.cos(car.angle) * (car.w / 2);
  const by = car.y - Math.sin(car.angle) * (car.w / 2);
  state.particles.push({
    x: bx, y: by,
    vx: -Math.cos(car.angle) * 30 + (Math.random() - 0.5) * 20,
    vy: -Math.sin(car.angle) * 30 + (Math.random() - 0.5) * 20,
    size: 5 + Math.random() * 4, color: 'rgba(120,120,120,0.8)',
    life: 0.7, maxLife: 0.7, alpha: 0.5,
  });
}

function dropSkid(car) {
  const perp = car.angle + Math.PI / 2;
  const ox = Math.cos(perp) * 9;
  const oy = Math.sin(perp) * 9;
  const bx = car.x - Math.cos(car.angle) * 14;
  const by = car.y - Math.sin(car.angle) * 14;
  state.skids.push({
    x: bx, y: by,
    x1: bx + ox, y1: by + oy, x2: bx - ox, y2: by - oy,
    life: 6,
  });
  if (state.skids.length > 220) state.skids.splice(0, state.skids.length - 220);
}

function handleCrash(impact, x, y) {
  state.stats.crashes += 1;
  addShake(state, Math.min(18, 5 + impact / 30));
  spawnParticles(x, y, '#ff9a3c', 14, 260, 5, 0.6);
  spawnParticles(x, y, '#ffd76e', 8, 200, 4, 0.4);
  audio.crash(impact / 400);
  if (state.player.inCar && state.car) {
    state.health = Math.max(0, state.health - impact / 55);
    if (state.health <= 0) return doWasted();
  }
}

function doBusted() {
  if (state.mode !== 'playing') return;
  state.mode = 'busted';
  audio.busted();
  audio.setSiren(false);
  audio.setEngine(0, false);
  const lost = Math.min(state.cash, Math.max(50, Math.floor(state.cash * 0.1)));
  state.cash -= lost;
  if (state.mission && state.mission.index === 3 && state.goldCoupe && state.goldCoupe.stolen) {
    failMission(state, 'Tertangkap saat bawa coupe emas!');
    state.goldCoupe = null;
  }
  state.bustedTimer = 0;
  saveGame(state);
}

function doWasted() {
  if (state.mode !== 'playing') return;
  state.mode = 'wasted';
  audio.wasted();
  audio.setSiren(false);
  audio.setEngine(0, false);
  state.wastedTimer = 0;
  saveGame(state);
}

function respawn(afterBusted) {
  state.health = 100;
  state.player.x = 1648;
  state.player.y = 1300;
  state.player.angle = -Math.PI / 2;
  state.player.onFoot = true;
  state.player.inCar = false;
  state.player.carId = null;
  state.car = null;
  state.cops = [];
  state.bullets = [];
  state.enemyBullets = [];
  state.bustedTimer = 0;
  updateWanted(afterBusted ? Math.max(0, state.wanted - 1) : 0);
  state.mode = 'playing';
  showToast(state, afterBusted ? 'Respawn — hati-hati, polisi masih waspada.' : 'Retry dari checkpoint.');
}

function shootAt(tx, ty) {
  if (shootCooldown > 0 || state.mode !== 'playing') return;
  shootCooldown = 0.28;
  const px = state.player.inCar && state.car ? state.car.x : state.player.x;
  const py = state.player.inCar && state.car ? state.car.y : state.player.y;
  const ang = Math.atan2(ty - py, tx - px);
  state.bullets.push({
    x: px + Math.cos(ang) * 26, y: py + Math.sin(ang) * 26,
    vx: Math.cos(ang) * 780, vy: Math.sin(ang) * 780,
    life: 0.9, damage: 34,
  });
  state.stats.shots += 1;
  state.player.angle = ang;
  audio.shoot();
  addShake(state, 2);
  spawnParticles(px + Math.cos(ang) * 30, py + Math.sin(ang) * 30, '#ffe14d', 4, 160, 3, 0.25);
}

function stealNearestCar() {
  if (state.player.inCar) return false;
  const car = nearestParkedCar(state.cars, state.player.x, state.player.y, 78);
  if (!car) {
    showToast(state, 'Tidak ada mobil di dekatmu. Cari mobil parkir di tepi jalan.');
    return false;
  }
  state.cars.splice(state.cars.indexOf(car), 1);
  car.parked = false;
  state.car = car;
  state.player.inCar = true;
  state.player.onFoot = false;
  state.player.carId = car.id;
  state.stats.steals += 1;
  updateWanted(Math.max(1, state.wanted));
  audio.horn();
  showToast(state, `Mobil dicuri! Wanted ${state.wanted}★ — polisi datang!`);
  spawnParticles(car.x, car.y, '#ffffff', 6, 120, 3, 0.4);
  return true;
}

function exitCar() {
  if (!state.player.inCar || !state.car) return;
  const car = state.car;
  const px = car.x - Math.cos(car.angle + Math.PI / 2) * 40;
  const py = car.y - Math.sin(car.angle + Math.PI / 2) * 40;
  const spot = clampToWorld(px, py, 50);
  state.player.x = spot.x;
  state.player.y = spot.y;
  state.player.angle = car.angle;
  state.player.inCar = false;
  state.player.onFoot = true;
  state.player.carId = null;
  car.parked = true;
  car.speed = 0;
  state.cars.push(car);
  state.car = null;
}

function startGame(fromSave) {
  audio.ensure();
  if (fromSave) {
    const data = loadGame();
    if (data) {
      applySave(state, data);
      if (state.missionIndex < 4 && !state.mission) {
        showToast(state, `Lanjutkan — Misi ${state.missionIndex + 1}: tekan M untuk mulai.`);
      }
    }
  } else {
    state.cash = 0;
    state.missionIndex = 0;
    state.legend = false;
    state.health = 100;
    updateWanted(0);
    state.mission = null;
    state.goldCoupe = null;
  }
  state.mode = 'playing';
  audio.click();
}

function togglePause() {
  if (state.mode === 'playing') {
    state.mode = 'paused';
    state.pausedFrom = 'playing';
    audio.setEngine(0, false);
  } else if (state.mode === 'paused') {
    state.mode = 'playing';
  }
}

function handleInput() {
  input.up = keys.has('KeyW') || keys.has('ArrowUp');
  input.down = keys.has('KeyS') || keys.has('ArrowDown');
  input.left = keys.has('KeyA') || keys.has('ArrowLeft');
  input.right = keys.has('KeyD') || keys.has('ArrowRight');
}

function updatePlayerOnFoot(dt) {
  const p = state.player;
  let mx = 0;
  let my = 0;
  if (input.up) my -= 1;
  if (input.down) my += 1;
  if (input.left) mx -= 1;
  if (input.right) mx += 1;
  if (mx !== 0 || my !== 0) {
    const len = Math.hypot(mx, my);
    mx /= len;
    my /= len;
    const nx = p.x + mx * p.walkSpeed * dt;
    const ny = p.y + my * p.walkSpeed * dt;
    if (!collidesWithBuildings(world, nx, p.y, p.radius)) p.x = nx;
    if (!collidesWithBuildings(world, p.x, ny, p.radius)) p.y = ny;
    const c = clampToWorld(p.x, p.y, 30);
    p.x = c.x;
    p.y = c.y;
    p.angle = Math.atan2(my, mx);
  }
  // Aim with mouse while on foot.
  if (input.mouseDown || keys.has('Space')) {
    const wx = state.camera.x + input.mouseX;
    const wy = state.camera.y + input.mouseY;
    shootAt(wx, wy);
  }
}

function updateBullets(dt) {
  for (const b of state.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    // Hit a cop?
    for (const cop of state.cops) {
      if (Math.hypot(cop.x - b.x, cop.y - b.y) < 26) {
        b.life = 0;
        state.stats.hits += 1;
        spawnParticles(b.x, b.y, '#ff5a3c', 8, 220, 4, 0.5);
        // Knock the cop back and slow it.
        cop.speed *= 0.4;
        cop.x += b.vx * dt * 2;
        cop.y += b.vy * dt * 2;
        // A solid hit at wanted 1 can shake a cop off for a while.
        if (state.wanted === 1 && state.stats.hits % 3 === 0) {
          cop.x += Math.cos(Math.atan2(b.vy, b.vx)) * 120;
          cop.y += Math.sin(Math.atan2(b.vy, b.vx)) * 120;
        }
        break;
      }
    }
    // Hit a building?
    if (b.life > 0 && collidesWithBuildings(world, b.x, b.y, 2)) {
      b.life = 0;
      spawnParticles(b.x, b.y, '#cccccc', 4, 120, 3, 0.3);
    }
  }
  state.bullets = state.bullets.filter((b) => b.life > 0);
  for (const b of state.enemyBullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    const px = state.player.inCar && state.car ? state.car.x : state.player.x;
    const py = state.player.inCar && state.car ? state.car.y : state.player.y;
    const pr = state.player.inCar ? 24 : 14;
    if (Math.hypot(px - b.x, py - b.y) < pr) {
      b.life = 0;
      state.health -= 9;
      addShake(state, 6);
      spawnParticles(b.x, b.y, '#ff3b30', 8, 200, 4, 0.5);
      audio.blip(140, 0.12, 'square', 0.14, 70);
      if (state.health <= 0) return doWasted();
    }
    if (b.life > 0 && collidesWithBuildings(world, b.x, b.y, 2)) b.life = 0;
  }
  state.enemyBullets = state.enemyBullets.filter((b) => b.life > 0);
}

function updateParticles(dt) {
  for (const p of state.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= (1 - dt * 2);
    p.vy *= (1 - dt * 2);
    p.life -= dt;
  }
  state.particles = state.particles.filter((p) => p.life > 0);
  for (const s of state.skids) s.life -= dt;
  state.skids = state.skids.filter((s) => s.life > 0);
}

function updatePeds(dt) {
  for (const ped of state.peds) {
    ped.turnTimer -= dt;
    if (ped.turnTimer <= 0) {
      ped.turnTimer = 1.5 + Math.random() * 3;
      ped.angle += (Math.random() - 0.5) * 2.4;
    }
    const nx = ped.x + Math.cos(ped.angle) * ped.speed * dt;
    const ny = ped.y + Math.sin(ped.angle) * ped.speed * dt;
    if (!collidesWithBuildings(world, nx, ny, 10)) {
      ped.x = nx;
      ped.y = ny;
    } else {
      ped.angle += Math.PI / 2;
    }
    const c = clampToWorld(ped.x, ped.y, 60);
    ped.x = c.x;
    ped.y = c.y;
    // Flee from the player's car.
    const px = state.player.inCar && state.car ? state.car.x : state.player.x;
    const py = state.player.inCar && state.car ? state.car.y : state.player.y;
    const d = Math.hypot(px - ped.x, py - ped.y);
    if (d < 70 && state.player.inCar) {
      ped.angle = Math.atan2(ped.y - py, ped.x - px);
      ped.x += Math.cos(ped.angle) * 120 * dt;
      ped.y += Math.sin(ped.angle) * 120 * dt;
    }
  }
}

function update(dt) {
  state.time += dt;
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 34);
  if (shootCooldown > 0) shootCooldown -= dt;
  handleInput();
  updateCamera(dt);
  updateParticles(dt);

  if (state.mode !== 'playing') {
    audio.setEngine(0, false);
    return;
  }

  // Driving / walking.
  if (state.player.inCar && state.car) {
    const res = updateDrivenCar(state.car, input, dt, world, handleCrash);
    if (res.hardTurn) dropSkid(state.car);
    // Sudden braking at speed also leaves skid marks.
    if (input.down && Math.abs(state.car.speed) > 240) dropSkid(state.car);
    if (input.down && Math.abs(state.car.speed) > 240) {
      spawnParticles(
        state.car.x - Math.cos(state.car.angle) * 16,
        state.car.y - Math.sin(state.car.angle) * 16,
        'rgba(160,150,130,0.85)', 2, 40, 6, 0.5,
      );
    }
    exhaustTimer -= dt;
    if (Math.abs(state.car.speed) > 60 && exhaustTimer <= 0) {
      exhaustTimer = 0.09;
      exhaustSmoke();
    }
    audio.setEngine(Math.min(1, Math.abs(state.car.speed) / 520), true);
    if (input.mouseDown || keys.has('Space')) {
      const wx = state.camera.x + input.mouseX;
      const wy = state.camera.y + input.mouseY;
      shootAt(wx, wy);
    }
  } else {
    updatePlayerOnFoot(dt);
    audio.setEngine(0, false);
  }

  // Traffic.
  trafficTimer -= dt;
  if (trafficTimer <= 0) {
    trafficTimer = 4;
    const moving = state.cars.filter((c) => !c.parked).length;
    if (moving < 10) spawnTrafficCar(world, state.cars);
  }
  for (const car of state.cars) {
    if (!car.parked) updateTrafficCar(car, dt, world, state.cars);
  }

  updatePeds(dt);
  updateBullets(dt);
  updateMission(state, dt, audio);

  // Police.
  syncCopsToWanted(state);
  updateCops(state, dt, {
    onRam: (cop) => {
      state.health = Math.max(0, state.health - ramDamage(cop));
      addShake(state, 10);
      audio.crash(0.4);
      spawnParticles(cop.x, cop.y, '#ff9a3c', 10, 240, 5, 0.5);
      if (state.player.inCar && state.car) {
        state.car.speed *= 0.55;
      }
      if (state.health <= 0) doWasted();
    },
    onShot: (cop, tx, ty) => {
      const ang = Math.atan2(ty - cop.y, tx - cop.x) + (Math.random() - 0.5) * 0.22;
      state.enemyBullets.push({
        x: cop.x + Math.cos(ang) * 26, y: cop.y + Math.sin(ang) * 26,
        vx: Math.cos(ang) * 620, vy: Math.sin(ang) * 620,
        life: 1.1,
      });
      audio.shoot();
    },
    onBusted: () => doBusted(),
  });
  audio.setSiren(state.wanted > 0 && state.cops.length > 0);

  // Mission 4: gold coupe guard — cops cluster near the lot until stolen.
  if (state.mission && state.mission.index === 3 && state.goldCoupe && !state.goldCoupe.stolen) {
    pedTimer -= dt;
    if (pedTimer <= 0) {
      pedTimer = 6;
      if (state.cops.length < 3) spawnCopsForWanted(state, 2);
    }
  }

  // Banner/toast expiry is time-based; nothing to do here.
  if (state.mode === 'legend') saveGame(state);
}

function loop(t) {
  const dt = Math.min(0.05, (t - lastTime) / 1000 || 0.016);
  lastTime = t;
  update(dt);
  render(ctx, state, world, canvas.width, canvas.height);
  requestAnimationFrame(loop);
}

// ---- Input: keyboard + mouse ----
window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
    e.preventDefault();
  }
  if (e.repeat) return;
  keys.add(e.code);
  audio.ensure();
  if (e.code === 'KeyM') {
    if (state.mode === 'playing' && !state.mission && state.missionIndex < 4) {
      startMission(state, state.missionIndex);
      audio.click();
    }
  }
  if (e.code === 'KeyE') {
    if (state.mode === 'playing') {
      if (state.mission && state.mission.index === 3 && state.goldCoupe && !state.goldCoupe.stolen) {
        if (tryStealGoldCoupe(state)) {
          // Hop into the gold coupe right away.
          const gc = state.goldCoupe;
          const coupe = makeCar(gc.x, gc.y, -0.4, '#ffd700', 'coupe');
          coupe.gold = true;
          coupe.parked = false;
          state.car = coupe;
          state.player.inCar = true;
          state.player.onFoot = false;
          state.player.carId = coupe.id;
          state.stats.steals += 1;
          audio.horn();
        }
      } else if (!state.player.inCar) {
        stealNearestCar();
      } else {
        exitCar();
      }
    }
  }
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (state.mode === 'playing' || state.mode === 'paused') togglePause();
  }
  if (e.code === 'KeyR') {
    if (state.mode === 'playing' && state.player.inCar) audio.horn();
  }
  if (e.code === 'Enter') {
    if (state.mode === 'boot') startGame(hasSave());
    else if (state.mode === 'busted') respawn(true);
    else if (state.mode === 'wasted') respawn(false);
    else if (state.mode === 'legend') { state.mode = 'playing'; }
  }
  if (e.code === 'KeyN') {
    if (state.mode === 'playing' && state.mission && state.mission.index === 3) {
      // Retry mission 4 after a fail: restart it fresh.
      startMission(state, 3);
    }
  }
});

window.addEventListener('keyup', (e) => keys.delete(e.code));

canvas.addEventListener('mousemove', (e) => {
  const r = canvas.getBoundingClientRect();
  input.mouseX = e.clientX - r.left;
  input.mouseY = e.clientY - r.top;
});
canvas.addEventListener('mousedown', (e) => {
  input.mouseDown = true;
  const r = canvas.getBoundingClientRect();
  input.mouseX = e.clientX - r.left;
  input.mouseY = e.clientY - r.top;
  audio.ensure();
  if (state.mode === 'boot') {
    const save = loadGame();
    const cy = e.clientY - r.top;
    const vh = canvas.height;
    const centerY = vh / 2;
    // Panel buttons: MULAI spans ~+78..+120, LANJUTKAN ~+132..+174.
    if (save && cy > centerY + 132 && cy < centerY + 174) startGame(true);
    else startGame(false);
    return;
  }
  if (state.mode === 'playing') {
    shootAt(state.camera.x + input.mouseX, state.camera.y + input.mouseY);
  }
});
window.addEventListener('mouseup', () => { input.mouseDown = false; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// ---- Debug / automation hooks (used by the local playtest + screenshots) ----
window.__solara = {
  state,
  world,
  start: (fromSave) => startGame(!!fromSave),
  continueGame: () => startGame(true),
  newGame: () => { clearSave(); startGame(false); },
  teleport: (x, y) => {
    if (state.player.inCar && state.car) { state.car.x = x; state.car.y = y; state.car.speed = 0; }
    state.player.x = x; state.player.y = y;
  },
  stealNearestCar,
  startMission: (i) => startMission(state, i),
  setMissionTimer: (s) => { if (state.mission) state.mission.timer = s; },
  setCash: (n) => { state.cash = n; },
  setWanted: (n) => updateWanted(n),
  setHealth: (n) => { state.health = n; },
  damage: (n) => { state.health = Math.max(0, state.health - n); if (state.health <= 0) doWasted(); },
  spawnCops: (n) => { for (let i = 0; i < n; i++) spawnCopsForWanted(state, Math.max(1, state.wanted)); },
  forceBusted: () => doBusted(),
  forceWasted: () => doWasted(),
  respawn: (b) => respawn(!!b),
  togglePause,
  shootAt,
  setGoldCoupeStolen: () => { if (state.goldCoupe) state.goldCoupe.stolen = true; },
  keyDown: (code) => keys.add(code),
  keyUp: (code) => keys.delete(code),
  setMouse: (x, y) => { input.mouseX = x; input.mouseY = y; },
  clearSave,
  hasSave,
};

init();
