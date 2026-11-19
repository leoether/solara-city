// SOLARA CITY — main.js
// Entrypoint game: state machine (boot/play/pause/busted/wasted/legend),
// input keyboard+mouse, loop requestAnimationFrame, save/load localStorage,
// dan hook debug window.__SOLARA untuk playtest & screenshot.

import { WORLD, PLAYER, CAR, ECONOMY, SAVE_KEY, MISSIONS } from './config.js';
import { clamp, dist, angleDiff } from './random.js';
import { buildCity, resolveBuildingCollision } from './world.js';
import { makeCar, stepPlayerCar, spawnTraffic, stepTraffic, spawnParkedCars } from './vehicles.js';
import { spawnPeds, stepPeds } from './pedestrians.js';
import { desiredCops, spawnCopNear, stepCop, checkBusted } from './police.js';
import { createMissionState, currentMission, startMission, stepMissions, wantedFor, setBanner } from './missions.js';
import { createCombat, shoot, copShoot, stepBullets } from './combat.js';
import { createAudio } from './audio.js';
import { createFx, createCamera, drawFrame } from './render.js';
import { drawHud } from './hud.js';
import { stageScene } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  game.camera.w = canvas.width;
  game.camera.h = canvas.height;
}

const game = {
  time: 0,
  screen: 'boot',
  paused: false,
  city: buildCity(20261119),
  camera: createCamera(window.innerWidth, window.innerHeight),
  fx: createFx(),
  audio: createAudio(),
  combat: createCombat(),
  missions: createMissionState(),
  traffic: [],
  peds: [],
  parked: [],
  cops: [],
  cash: 0,
  wanted: 0,
  stoleCar: false,
  hint: '',
  hintT: 0,
  hasSave: false,
  bustedCash: 0,
  checkpoint: null,
  player: {
    x: 2100, y: 2100, angle: 0, aimAngle: 0,
    health: PLAYER.health, inCar: false, car: null,
    shootHeld: false, mouseX: 0, mouseY: 0,
  },
  missionDef: null,
  copShootT: 0,
  saveT: 0,
};

game.traffic = spawnTraffic(game.city);
game.peds = spawnPeds(game.city);
game.parked = spawnParkedCars(game.city);
// Coupe emas misi 4, diparkir di lot barat.
game.goldCoupe = makeCar(300, 2100, Math.PI / 2, '#f2c14e', { parked: true, gold: true });
game.parked.push(game.goldCoupe);

const keys = {};
let mouseDown = false;

window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
  keys[e.key.toLowerCase()] = true;
  game.audio.unlock();
  handleKeyPress(e.key.toLowerCase());
});
window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
canvas.addEventListener('mousemove', (e) => {
  game.player.mouseX = e.clientX;
  game.player.mouseY = e.clientY;
});
canvas.addEventListener('mousedown', (e) => {
  if (e.button === 0) { mouseDown = true; game.audio.unlock(); }
});
window.addEventListener('mouseup', () => { mouseDown = false; });
window.addEventListener('resize', resize);
resize();

function handleKeyPress(k) {
  if (game.screen === 'boot' && (k === 'enter' || k === ' ')) { startGame(game.hasSave); return; }
  if (game.screen === 'pause' && (k === 'p' || k === 'escape')) {
    game.screen = 'play';
    return;
  }
  if (game.screen === 'busted' || game.screen === 'wasted') {
    if (k === 'enter') respawn();
    return;
  }
  if (game.screen === 'legend' && k === 'enter') { game.screen = 'play'; return; }
  if (game.screen !== 'play') return;
  if (k === 'p' || k === 'escape') { game.screen = 'pause'; game.audio.engineOff(); return; }
  if (k === 'm') {
    if (game.missions.phase === 'idle' && currentMission(game.missions)) {
      startMission(game.missions, game.audio);
      game.wanted = Math.max(game.wanted, wantedFor(game.missions, game.stoleCar));
    }
    return;
  }
  if (k === 'e') tryStealOrExit();
  if (k === 'r' && game.checkpoint) loadCheckpoint();
}

function startGame(fromSave) {
  game.audio.unlock();
  if (fromSave) {
    const ok = loadSave();
    if (!ok) resetRun();
  } else {
    resetRun();
  }
  game.screen = 'play';
  setBanner(game.missions, 'Selamat datang di Solara', 'Curi mobil dengan E, tekan M untuk misi pertama.');
}

function resetRun() {
  game.cash = 0;
  game.wanted = 0;
  game.stoleCar = false;
  game.missions = createMissionState();
  game.player.x = 2100; game.player.y = 2100;
  game.player.health = PLAYER.health;
  game.player.inCar = false;
  game.player.car = null;
  game.cops.length = 0;
  game.combat.bullets.length = 0;
  saveCheckpoint();
}

function saveCheckpoint() {
  game.checkpoint = {
    cash: game.cash, missionIndex: game.missions.index,
    x: game.player.x, y: game.player.y, health: game.player.health,
  };
}

function loadCheckpoint() {
  const c = game.checkpoint;
  if (!c) return;
  game.cash = c.cash;
  game.missions.index = c.missionIndex;
  game.missions.phase = 'idle';
  game.player.x = c.x; game.player.y = c.y;
  game.player.health = c.health;
  game.player.inCar = false;
  game.player.car = null;
  game.cops.length = 0;
  game.wanted = 0;
  game.screen = 'play';
}

function respawn() {
  const fine = Math.min(game.cash, ECONOMY.bustedFine);
  game.bustedCash = fine;
  game.cash -= fine;
  game.player.health = PLAYER.health;
  game.player.x = 2100; game.player.y = 2100;
  game.player.inCar = false;
  game.player.car = null;
  game.cops.length = 0;
  game.wanted = 0;
  game.missions.phase = 'idle';
  game.screen = 'play';
  saveGame();
}

// ---- Save / load ----

function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: game.cash,
      missionIndex: game.missions.index,
      x: game.player.x, y: game.player.y,
      health: game.player.health,
      time: Date.now(),
    }));
    game.hasSave = true;
  } catch (e) { /* penyimpanan penuh / privat: lanjut tanpa save */ }
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    game.cash = s.cash || 0;
    game.missions.index = Math.min(s.missionIndex || 0, MISSIONS.length);
    game.player.x = s.x ?? 2100;
    game.player.y = s.y ?? 2100;
    game.player.health = s.health || PLAYER.health;
    game.checkpoint = { cash: game.cash, missionIndex: game.missions.index, x: game.player.x, y: game.player.y, health: game.player.health };
    return true;
  } catch (e) { return false; }
}

game.hasSave = (() => {
  try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
})();

// ---- Aksi pemain ----

function nearestStealable() {
  const P = game.player;
  let best = null, bestD = PLAYER.stealRange;
  for (const c of game.parked) {
    const d = dist(P.x, P.y, c.x, c.y);
    if (d < bestD) { best = c; bestD = d; }
  }
  return best;
}

function tryStealOrExit() {
  const P = game.player;
  if (P.inCar) {
    // Keluar mobil.
    P.inCar = false;
    const a = P.car.angle + Math.PI / 2;
    P.x = P.car.x + Math.cos(a) * 40;
    P.y = P.car.y + Math.sin(a) * 40;
    P.car.speed = 0;
    P.car.vx = 0; P.car.vy = 0;
    game.audio.engineOff();
    return;
  }
  const target = nearestStealable();
  if (target) {
    game.parked = game.parked.filter((c) => c !== target);
    target.parked = false;
    target.isPlayer = true;
    P.car = target;
    P.inCar = true;
    P.x = target.x; P.y = target.y;
    if (!game.stoleCar) {
      game.stoleCar = true;
      game.wanted = Math.max(game.wanted, 1);
      setBanner(game.missions, 'MOBIL DICURI!', 'Wanted level 1 — polisi mengejar!');
      game.audio.crash(0.4);
    }
    if (target.gold) {
      setBanner(game.missions, 'COUPE EMAS DICURI!', 'Bawa ke penanda hijau. Jangan tertangkap!');
    }
  }
}

function updateWanted(dt) {
  const want = desiredCops(game.wanted);
  if (game.cops.length < want) {
    game.cops.push(spawnCopNear(game.city, game.player.x, game.player.y, 900));
  } else if (game.cops.length > want) {
    game.cops.pop();
  }
  // Polisi yang terlalu jauh di-respawn lebih dekat.
  for (let i = 0; i < game.cops.length; i++) {
    const c = game.cops[i];
    if (dist(c.x, c.y, game.player.x, game.player.y) > 1800) {
      game.cops[i] = spawnCopNear(game.city, game.player.x, game.player.y, 900);
    }
  }
}

function playerHit(dmg) {
  const P = game.player;
  P.health -= dmg;
  game.fx.addShake(6);
  if (P.health <= 0) {
    P.health = 0;
    game.audio.wasted();
    game.screen = 'wasted';
    game.audio.engineOff();
  }
}

function inputState() {
  return {
    up: !!(keys['w'] || keys['arrowup']),
    down: !!(keys['s'] || keys['arrowdown']),
    left: !!(keys['a'] || keys['arrowleft']),
    right: !!(keys['d'] || keys['arrowright']),
    run: !!keys['shift'],
  };
}

// ---- Loop utama ----

function init() { /* init(): siapkan state awal — dipanggil sekali di bawah */ }
init();

let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.05) dt = 0.05;
  if (game.screen === 'play' && !game.paused) {
    game.time += dt;
    update(dt);
  }
  drawFrame(ctx, game, game.fx, dt);
  drawHud(ctx, game);
  game.fx.step(dt);
}
requestAnimationFrame(loop);

function update(dt) {
  const P = game.player;
  const input = inputState();
  game.missionDef = currentMission(game.missions);

  // Arah bidik: mouse di layar vs posisi pemain di layar.
  const psx = P.x - game.camera.x;
  const psy = P.y - game.camera.y;
  P.aimAngle = Math.atan2(P.mouseY - psy, P.mouseX - psx);

  if (P.inCar && P.car) {
    const res = stepPlayerCar(P.car, input, dt, game.city, game.fx);
    P.x = P.car.x; P.y = P.car.y;
    P.angle = P.car.angle;
    if (res.crashed) {
      game.audio.crash(res.strength);
      game.fx.addShake(10 * res.strength + 4);
      playerHit(CAR.crashDamage * res.strength);
      if (game.screen !== 'play') return;
    }
    // Debu saat rem mendadak.
    if (input.down && Math.abs(P.car.speed) > 200 && Math.random() < 0.3) {
      game.fx.dust(P.car.x - Math.cos(P.car.angle) * 24, P.car.y - Math.sin(P.car.angle) * 24);
    }
    const rpm = Math.abs(P.car.speed) / CAR.maxSpeed;
    game.audio.engine(rpm, input.up ? 1 : 0);
    // Tembak dari mobil: klik mouse.
    if (mouseDown) {
      shoot(game.combat, P.car.x, P.car.y, P.aimAngle, game.fx, game.audio);
      game.fx.addShake(1.5);
    }
  } else {
    const speed = input.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    const len = Math.hypot(mx, my);
    if (len > 0) { mx /= len; my /= len; }
    const nx = P.x + mx * speed * dt;
    const ny = P.y + my * speed * dt;
    const fixed = resolveBuildingCollision(game.city, nx, ny, PLAYER.radius);
    P.x = fixed.x; P.y = fixed.y;
    if (len > 0) P.angle = Math.atan2(my, mx);
    game.audio.engineOff();
    if (mouseDown || keys[' ']) {
      if (shoot(game.combat, P.x, P.y, P.aimAngle, game.fx, game.audio)) game.fx.addShake(1.5);
    }
    // Hint curi mobil.
    const near = nearestStealable();
    if (near) {
      game.hint = near.gold ? 'Tekan E — curi COUPE EMAS' : 'Tekan E — curi mobil';
      game.hintT = 0.2;
    }
  }

  // Misi.
  stepMissions(game.missions, P, dt, {
    audio: game.audio,
    onReward: (m, amount) => {
      game.cash += amount;
      saveCheckpoint();
      saveGame();
    },
    onFail: (reason) => {
      setBanner(game.missions, 'MISI GAGAL', reason + ' Tekan M untuk coba lagi.');
      game.wanted = Math.max(game.wanted, 1);
    },
    onLegend: () => {
      game.screen = 'legend';
      game.audio.legend();
      saveGame();
    },
  });
  if (game.screen !== 'play') return;

  // Wanted naik mengikuti progres misi.
  game.wanted = Math.max(game.wanted, wantedFor(game.missions, game.stoleCar));
  if (game.missions.index >= MISSIONS.length) game.wanted = 0;

  // Polisi.
  updateWanted(dt);
  const px = P.inCar ? P.car.x : P.x;
  const py = P.inCar ? P.car.y : P.y;
  for (const cop of game.cops) {
    stepCop(cop, px, py, game.wanted, dt, game.city, game.fx);
    // Tabrakan polisi vs mobil pemain.
    if (P.inCar && dist(cop.x, cop.y, P.car.x, P.car.y) < 46) {
      P.car.speed *= 0.55;
      game.fx.addShake(5);
      game.audio.crash(0.3);
    }
  }
  // Polisi menembak di wanted 3.
  game.copShootT -= dt;
  if (game.wanted >= 3 && game.cops.length > 0 && game.copShootT <= 0) {
    game.copShootT = 0.9 + Math.random() * 0.8;
    const cop = game.cops[Math.floor(Math.random() * game.cops.length)];
    if (dist(cop.x, cop.y, px, py) < 520) copShoot(game.combat, cop, px, py);
  }
  game.audio.siren(dt, game.cops.length > 0);

  // Busted?
  const buster = checkBusted(game.cops, { x: px, y: py, inCar: P.inCar, car: P.car });
  if (buster) {
    game.audio.busted();
    game.screen = 'busted';
    game.audio.engineOff();
    return;
  }

  // Peluru.
  const danger = game.combat.bullets.length > 0
    ? { x: game.combat.bullets[0].x, y: game.combat.bullets[0].y }
    : null;
  stepBullets(game.combat, dt, game.city, game.cops, game.peds, P, game.fx, game.audio, playerHit);
  if (game.screen !== 'play') return;

  // Traffic + pejalan.
  stepTraffic(game.traffic, dt, game.city);
  stepPeds(game.peds, dt, game.city, danger);

  // Hint timeout.
  if (game.hintT > 0) { game.hintT -= dt; if (game.hintT <= 0) game.hint = ''; }
  else if (!nearestStealable() || P.inCar) game.hint = '';

  // Autosave berkala.
  game.saveT += dt;
  if (game.saveT > 20) { game.saveT = 0; saveGame(); }
}

// ---- Hook debug untuk playtest & screenshot (bukan cheat untuk pemain) ----
window.__SOLARA = {
  game,
  version: 'v4-fresh',
  start(fromSave) { startGame(!!fromSave); },
  stage(scene) { stageScene(game, scene); },
  state() {
    return {
      screen: game.screen,
      cash: game.cash,
      wanted: game.wanted,
      missionIndex: game.missions.index,
      missionPhase: game.missions.phase,
      health: game.player.health,
      inCar: game.player.inCar,
      cops: game.cops.length,
      bullets: game.combat.bullets.length,
      x: Math.round(game.player.x), y: Math.round(game.player.y),
      hasSave: game.hasSave,
    };
  },
  press(key) { handleKeyPress(key); },
  setKeys(k) { Object.assign(keys, k); },
  teleport(x, y) {
    game.player.x = x; game.player.y = y;
    if (game.player.inCar && game.player.car) { game.player.car.x = x; game.player.car.y = y; }
  },
  giveCash(n) { game.cash += n; },
  setWanted(n) { game.wanted = n; },
  hurt(n) { playerHit(n); },
  saveNow() { saveGame(); return !!localStorage.getItem(SAVE_KEY); },
  loadNow() { return loadSave(); },
};
