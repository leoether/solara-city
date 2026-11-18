// SOLARA CITY v3 — entrypoint: boot screen → steal a car → 4 missions →
// SOLARA LEGEND. Wires every module together: init(), loop(dt), handleInput(),
// updateWanted(level), missions, rendering, audio, save. Written fresh for
// round 3; no code reused from earlier rounds.

import { WORLD, SAVE_KEY, MISSIONS, LEGEND_CASH, KEYS } from './config.js';
import { mulberry32, clamp } from './random.js';
import { City } from './world.js';
import { Traffic } from './vehicles.js';
import { Pedestrians } from './pedestrians.js';
import { Police } from './police.js';
import { Player } from './player.js';
import { MissionManager } from './missions.js';
import { Combat } from './combat.js';
import { SoundFX } from './audio.js';
import { Renderer } from './render.js';
import { drawHUD, drawBoot, drawPause, drawBusted, drawWasted, drawLegend } from './hud.js';
import { applyShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function fitCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
fitCanvas();
window.addEventListener('resize', fitCanvas);

const SPAWN = { x: WORLD.roadGap, y: WORLD.roadGap };

const G = {
  canvas,
  mode: 'boot', // boot | playing | paused | busted | wasted | legend
  time: 0,
  cash: 0,
  wanted: 0,
  bustedLost: 0,
  hitFlashT: 0,
  toasts: [],
  banner: null,
  uiButtons: [],
  hasSave: false,
  saveCash: 0,
  saveMission: 0,
  keys: new Set(),
  lastStealToast: -9,
  lastRamT: -9,
  exhaustT: 0,
  prevRear: null,
  city: null,
  traffic: null,
  peds: null,
  police: null,
  player: null,
  missions: null,
  combat: null,
  renderer: null,
  sound: new SoundFX(),
  api: null,
};

function refreshSaveInfo() {
  const s = loadSave();
  G.hasSave = !!s;
  G.saveCash = s ? s.cash : 0;
  G.saveMission = s ? s.missionIndex : 0;
}

function saveGame(legend = false) {
  try {
    const data = {
      v: 3,
      cash: G.cash,
      missionIndex: G.missions ? G.missions.index : 0,
      legend: !!legend,
      savedAt: Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    refreshSaveInfo();
  } catch { /* storage unavailable — game still runs */ }
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || d.v !== 3) return null;
    return d;
  } catch {
    return null;
  }
}

function toast(text, color, dur = 2.8) {
  G.toasts.push({ text, color: color || '#e6e9f2', t: G.time, dur });
  if (G.toasts.length > 4) G.toasts.shift();
}

function showBanner(text, sub, color) {
  G.banner = { text, sub: sub || '', t: G.time, until: G.time + 2.4, color: color || '#ffd23f' };
}

// Wanted level: stars, police count, siren. Police sync runs every frame.
function updateWanted(level) {
  G.wanted = clamp(level, 0, 3);
  if (G.wanted > 0 && G.mode === 'playing') G.sound.startSiren();
  else if (G.wanted === 0) G.sound.stopSiren();
}

function freshWorld() {
  G.city = new City(1337);
  G.traffic = new Traffic(G.city);
  G.peds = new Pedestrians(G.city);
  G.police = new Police(G.city);
  G.combat = new Combat();
  G.player = new Player(G.city, SPAWN.x, SPAWN.y);
  G.missions = new MissionManager(G.city, mulberry32(999));
  if (!G.renderer) G.renderer = new Renderer(canvas, G.city);
  G.renderer.city = G.city;
  G.renderer.particles.length = 0;
  G.renderer.skids.length = 0;
  G.renderer.snapTo(SPAWN.x, SPAWN.y);
}

function startGame(save) {
  freshWorld();
  G.cash = save ? save.cash : 0;
  G.wanted = 0;
  G.mode = 'playing';
  G.toasts = [];
  G.banner = null;
  G.hitFlashT = 0;
  G.bustedLost = 0;
  G.prevRear = null;
  G.player.reset(SPAWN.x, SPAWN.y);
  // A stealable car is always parked right by the spawn, so the first
  // steal never depends on traffic luck.
  G.traffic.spawnParkedAt(SPAWN.x + 96, SPAWN.y + 8, 0);
  const startIndex = save ? clamp(save.missionIndex, 0, MISSIONS.length) : 0;
  if (startIndex >= MISSIONS.length) {
    // Save with every mission done: free roam as a legend, no active mission.
    G.missions.index = MISSIONS.length;
    updateWanted(0);
  } else {
    G.missions.start(startIndex, { x: SPAWN.x, y: SPAWN.y }, G.traffic);
    updateWanted(G.missions.current ? G.missions.current.wanted || 0 : 0);
  }
  G.sound.ensure();
  G.sound.startEngine();
  const m = G.missions.current;
  if (m) toast(`Misi ${m.id}/4: ${m.name} — ${m.brief}`, '#f5c542', 4);
  if (save && save.legend) toast('Save LEGEND dimuat — selamat datang kembali, Legenda.', '#7ee787', 4);
}

function finishMission(reward) {
  G.cash += reward;
  showBanner('MISI SELESAI', `+$${reward}`, '#7ee787');
  G.sound.cash();
  saveGame(false);
  if (G.cash >= LEGEND_CASH) {
    doLegend();
    return;
  }
  const next = G.missions.index;
  G.missions.start(next, { x: G.player.x, y: G.player.y }, G.traffic);
  updateWanted(G.missions.current ? G.missions.current.wanted || 0 : G.wanted);
  const m = G.missions.current;
  if (m) toast(`Misi ${m.id}/4: ${m.name} — ${m.brief}`, '#f5c542', 4);
}

function failMission(reason) {
  showBanner('MISI GAGAL', reason || 'Coba lagi!', '#ff6b6b');
  toast(reason || 'Misi gagal — coba lagi.', '#ff6b6b');
  if (G.missions.current && G.missions.current.kind === 'gold') {
    G.traffic.cars = G.traffic.cars.filter((c) => !c.gold);
  }
  G.missions.restartCurrent({ x: G.player.x, y: G.player.y }, G.traffic);
  updateWanted(G.missions.current ? G.missions.current.wanted || 0 : 0);
}

function doBusted() {
  if (G.mode !== 'playing') return;
  G.mode = 'busted';
  const lost = G.cash > 0 ? Math.min(G.cash, Math.max(50, Math.round(G.cash * 0.1))) : 0;
  G.cash -= lost;
  G.bustedLost = lost;
  G.sound.busted();
  G.sound.stopEngine();
  G.sound.stopSiren();
  if (G.player.inCar) G.player.exitCar();
  if (G.missions.current && G.missions.current.kind === 'gold') {
    toast('Misi Coupe Emas gagal — kamu ketangkap!', '#ff6b6b', 4);
  }
}

function doRespawn() {
  G.police.cars = [];
  G.player.reset(SPAWN.x, SPAWN.y);
  G.player.health = 100;
  G.wanted = 0;
  if (G.missions.current && G.missions.current.kind === 'gold') {
    G.traffic.cars = G.traffic.cars.filter((c) => !c.gold);
  }
  G.missions.restartCurrent({ x: SPAWN.x, y: SPAWN.y }, G.traffic);
  updateWanted(G.missions.current ? G.missions.current.wanted || 0 : 0);
  G.mode = 'playing';
  G.sound.ensure();
  G.sound.startEngine();
  toast('Respawn — misi aktif diulang.', '#e6e9f2');
}

function doWasted() {
  if (G.mode !== 'playing') return;
  G.mode = 'wasted';
  G.sound.wasted();
  G.sound.stopEngine();
  G.sound.stopSiren();
  if (G.player.inCar) G.player.exitCar();
}

function doRetry() {
  const save = loadSave();
  startGame(save);
  toast(save ? 'Checkpoint dimuat.' : 'Mulai dari awal.', '#e6e9f2');
}

function doLegend() {
  G.mode = 'legend';
  G.sound.legend();
  G.sound.stopEngine();
  G.sound.stopSiren();
  saveGame(true);
}

function stealCar() {
  if (G.mode !== 'playing') return;
  const p = G.player;
  if (p.inCar) {
    if (Math.abs(p.carSpeed) > 60) {
      if (G.time - G.lastStealToast > 1.5) {
        toast('Terlalu cepat untuk keluar!', '#ff6b6b');
        G.lastStealToast = G.time;
      }
      return;
    }
    p.exitCar();
    G.sound.click();
    return;
  }
  // Mission 4: the gold coupe is the objective — if it is in reach, it is
  // always the steal, even if another car happens to be a few px closer.
  // (Without this, a traffic car parked beside the lot could be stolen
  // instead and the mission would never advance.)
  let car = null;
  const m = G.missions.current;
  if (m && m.kind === 'gold' && G.missions.stage === 'pickup' && G.missions.goldCar) {
    const gc = G.missions.goldCar;
    if (!gc.wrecked && Math.hypot(gc.x - p.x, gc.y - p.y) < 120) car = gc;
  }
  if (!car) car = G.traffic.nearestStealable(p.x, p.y, 82);
  if (!car) {
    if (G.time - G.lastStealToast > 1.5) {
      toast('Tidak ada mobil di dekatmu.', '#9aa5b1');
      G.lastStealToast = G.time;
    }
    return;
  }
  p.enterCar(car);
  G.sound.click();
  if (car.gold) {
    const ev = G.missions.onSteal(car);
    if (ev) {
      toast('Coupe emas dicuri! Bawa ke titik hijau!', '#f5c542', 4);
      showBanner('COUPE EMAS DICURI', 'Bawa ke titik hijau — jangan ketangkap!', '#f5c542');
    }
  } else {
    toast('Mobil dicuri! Wanted ★ naik.', '#ffd23f');
  }
  if (G.wanted < 1) updateWanted(1);
}

function shoot() {
  if (G.mode !== 'playing') return;
  const p = G.player;
  const b = G.combat.playerShoot(p.x, p.y, p.angle);
  if (!b) return;
  G.sound.shot();
  G.renderer.spawnFlash(b.x, b.y);
  G.renderer.addShake(2);
  G.peds.scare(p.x, p.y, 300);
}

function togglePause() {
  if (G.mode === 'playing') {
    G.mode = 'paused';
    G.sound.setEngine(0, false);
  } else if (G.mode === 'paused') {
    G.mode = 'playing';
    G.sound.ensure();
    G.sound.startEngine();
  }
}

function handleButton(id) {
  G.sound.ensure();
  G.sound.click();
  if (id === 'start') startGame(null);
  else if (id === 'continue') startGame(loadSave());
  else if (id === 'resume') togglePause();
  else if (id === 'restart') startGame(null);
  else if (id === 'quit') { G.mode = 'boot'; refreshSaveInfo(); }
  else if (id === 'respawn') doRespawn();
  else if (id === 'retry') doRetry();
  else if (id === 'freeroam') { G.mode = 'playing'; updateWanted(0); G.sound.ensure(); G.sound.startEngine(); }
  else if (id === 'again') startGame(null);
}

function readInput() {
  const k = G.keys;
  const has = (list) => list.some((c) => k.has(c));
  return {
    up: has(KEYS.up),
    down: has(KEYS.down),
    left: has(KEYS.left),
    right: has(KEYS.right),
  };
}

function update(dt) {
  G.time += dt;
  G.hitFlashT = Math.max(0, G.hitFlashT - dt);
  G.renderer.updateFx(dt);
  if (G.mode !== 'playing') return;
  const input = readInput();
  const p = G.player;
  p.update(dt, input, G.time);
  G.traffic.update(dt, p.car);
  G.peds.update(dt, { x: p.x, y: p.y }, p.speed);
  // Police: keep count matched to wanted, then chase / shoot / bust.
  G.police.sync(G.wanted, p.x, p.y);
  const pev = G.police.update(dt, G.wanted, p);
  if (pev.ram && G.time - G.lastRamT > 0.7) {
    G.lastRamT = G.time;
    p.hurt(p.inCar ? 4 : 8, G.time);
    G.renderer.addShake(p.inCar ? 7 : 10);
    G.renderer.spawnSparks(p.x, p.y, 8);
    G.sound.crash(0.5);
    G.hitFlashT = 0.3;
  }
  for (const s of pev.shots) {
    G.combat.policeShoot(s.x, s.y, s.angle);
    G.sound.policeShot();
  }
  if (pev.busted) {
    doBusted();
    return;
  }
  // Combat: bullets vs police cars / player.
  const cev = G.combat.update(dt, G.police, p, G.peds, G.city);
  for (const s of cev.sparks) G.renderer.spawnSparks(s.x, s.y, 5);
  if (cev.hitPolice) {
    G.renderer.addShake(3);
    if (cev.hitPolice.wrecked) {
      toast('Mobil polisi hancur!', '#7ee787');
      G.renderer.spawnSparks(cev.hitPolice.x, cev.hitPolice.y, 22);
    }
    if (G.wanted < 3) updateWanted(G.wanted + 1);
  }
  if (cev.hitPlayer) {
    p.hurt(9, G.time);
    G.hitFlashT = 0.45;
    G.renderer.addShake(5);
  }
  // Crash damage from the player's own driving.
  const cs = p.crashSpeed || 0;
  if (cs > 380) {
    p.hurt(Math.min(24, Math.round((cs - 380) / 12)), G.time);
    G.renderer.addShake(16);
    G.renderer.spawnSparks(p.x, p.y, 18);
    G.sound.crash(1);
    G.hitFlashT = 0.35;
  } else if (cs > 200) {
    G.renderer.addShake(6);
    G.renderer.spawnSparks(p.x, p.y, 6);
    G.sound.crash(0.4);
  }
  if (p.health <= 0) {
    doWasted();
    return;
  }
  // Exhaust smoke + skid marks + brake dust while driving.
  if (p.inCar && p.car) {
    const spd = Math.abs(p.carSpeed);
    if (input.up && spd > 50) {
      G.exhaustT += dt;
      if (G.exhaustT > 0.06) {
        G.exhaustT = 0;
        const bx = p.car.x - Math.cos(p.car.angle) * 26;
        const by = p.car.y - Math.sin(p.car.angle) * 26;
        G.renderer.spawnSmoke(bx, by, -Math.cos(p.car.angle) * 30, -Math.sin(p.car.angle) * 30);
      }
    }
    const drifting = spd > 260 && Math.abs(p.steer) > 0.6;
    const hardBrake = input.down && spd > 300;
    if (drifting || hardBrake) {
      const rx = p.car.x - Math.cos(p.car.angle) * 18;
      const ry = p.car.y - Math.sin(p.car.angle) * 18;
      if (G.prevRear) G.renderer.addSkid(G.prevRear.x, G.prevRear.y, rx, ry);
      G.prevRear = { x: rx, y: ry };
      if (hardBrake) G.renderer.spawnDust(rx, ry);
    } else {
      G.prevRear = null;
    }
  }
  // Missions.
  const mev = G.missions.update(dt, p, G.traffic);
  if (mev) {
    if (mev.event === 'complete') finishMission(mev.reward);
    else if (mev.event === 'fail') failMission(mev.reason);
    else if (mev.event === 'pickup') {
      toast('Paket diambil! Antar ke titik hijau.', '#7ee787');
      G.sound.cash();
    }
  }
  // Siren + engine follow the live state.
  if (G.wanted > 0) G.sound.startSiren();
  else G.sound.stopSiren();
  G.sound.setEngine(p.inCar ? Math.min(1, Math.abs(p.carSpeed) / 540) : 0, p.inCar);
  G.renderer.follow(p.x, p.y, dt);
  // Toast expiry.
  G.toasts = G.toasts.filter((t) => G.time - t.t < t.dur);
}

// ---- input ----
window.addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  G.keys.add(e.code);
  if (e.code === 'Enter') {
    if (G.mode === 'boot') handleButton('start');
    else if (G.mode === 'paused') handleButton('resume');
    else if (G.mode === 'busted') handleButton('respawn');
    else if (G.mode === 'wasted') handleButton('retry');
    else if (G.mode === 'legend') handleButton('freeroam');
  } else if (e.code === 'KeyC' && G.mode === 'boot' && G.hasSave) {
    handleButton('continue');
  } else if (e.code === 'KeyE') {
    G.sound.ensure();
    stealCar();
  } else if (e.code === 'Space') {
    G.sound.ensure();
    shoot();
  } else if (e.code === 'KeyP' || e.code === 'Escape') {
    togglePause();
  } else if (e.code === 'KeyR' && G.mode === 'paused') {
    handleButton('restart');
  }
});
window.addEventListener('keyup', (e) => G.keys.delete(e.code));
window.addEventListener('blur', () => G.keys.clear());
canvas.addEventListener('click', (e) => {
  const r = canvas.getBoundingClientRect();
  const x = e.clientX - r.left;
  const y = e.clientY - r.top;
  for (const b of G.uiButtons || []) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
      handleButton(b.id);
      return;
    }
  }
  G.sound.ensure();
});

// ---- public API: driving hooks for the headless playtest + ?shot= staging ----
G.api = {
  version: '3.0.0',
  start: () => startGame(null),
  continueGame: () => startGame(loadSave()),
  state() {
    const m = G.missions ? G.missions.current : null;
    return {
      mode: G.mode,
      time: Math.round(G.time * 10) / 10,
      cash: G.cash,
      wanted: G.wanted,
      missionIndex: G.missions ? G.missions.index : 0,
      missionKind: m ? m.kind : null,
      missionStage: G.missions ? G.missions.stage : null,
      target: G.missions ? G.missions.target : null,
      timeLeft: G.missions ? Math.ceil(G.missions.timeLeft) : 0,
      timeLeftRaw: G.missions ? Math.round(G.missions.timeLeft * 10) / 10 : 0,
      player: {
        x: Math.round(G.player ? G.player.x : 0),
        y: Math.round(G.player ? G.player.y : 0),
        inCar: G.player ? G.player.inCar : false,
        health: G.player ? Math.round(G.player.health) : 0,
        speed: G.player ? Math.round(G.player.speed) : 0,
        gold: G.player && G.player.car ? !!G.player.car.gold : false,
      },
      police: G.police ? G.police.cars.filter((c) => !c.wrecked).length : 0,
      bullets: G.combat ? G.combat.bullets.length : 0,
      legend: G.cash >= LEGEND_CASH,
      hasSave: G.hasSave,
    };
  },
  steal: () => stealCar(),
  shoot: () => shoot(),
  pauseToggle: () => togglePause(),
  respawn: () => doRespawn(),
  retry: () => doRetry(),
  freeroam: () => { G.mode = 'playing'; updateWanted(0); },
  legend: () => doLegend(),
  teleport(x, y) {
    if (!G.player) return;
    G.player.x = x;
    G.player.y = y;
    if (G.player.inCar && G.player.car) { G.player.car.x = x; G.player.car.y = y; }
    G.renderer.snapTo(x, y);
  },
  teleportToRoad() {
    const p = G.city.randomRoadPoint(Math.random);
    this.teleport(p.x, p.y);
  },
  teleportToTarget() {
    const t = G.missions && G.missions.target;
    if (t) this.teleport(t.x, t.y);
  },
  giveCar() {
    if (!G.player || G.player.inCar) return;
    const car = G.traffic.spawnParkedAt(G.player.x + 60, G.player.y, 0);
    G.player.x = car.x - 50;
    G.player.y = car.y;
    stealCar();
  },
  enterNearestCar: () => stealCar(),
  spawnGoldNear() {
    const c = G.traffic.spawnGoldCoupe(G.player.x + 260, G.player.y + 40);
    return c.id;
  },
  setCarSpeed(v) {
    if (G.player && G.player.inCar) G.player.carSpeed = v;
  },
  setCash(n) { G.cash = n; },
  setMission(i) {
    G.missions.start(i, { x: G.player.x, y: G.player.y }, G.traffic);
    updateWanted(G.missions.current ? G.missions.current.wanted || 0 : G.wanted);
  },
  completeCurrentMission() {
    const m = G.missions.current;
    if (!m) return false;
    const reward = m.reward;
    G.missions.index += 1;
    G.missions.stage = 'pickup';
    G.missions.target = null;
    G.missions.goldCar = null;
    finishMission(reward);
    return true;
  },
  setWanted(n) { updateWanted(n); },
  setHealth(n) { if (G.player) G.player.health = n; },
  damage(n) { if (G.player) G.player.hurt(n, G.time); },
  bust: () => doBusted(),
  waste: () => doWasted(),
  placePoliceNear(n, dist) {
    if (!G.police) return;
    G.police.cars = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const p = G.city.nearestRoadPoint(G.player.x + Math.cos(a) * dist, G.player.y + Math.sin(a) * dist);
      const c = G.police._spawnOne(G.player.x, G.player.y);
      c.x = p.x;
      c.y = p.y;
      c.angle = Math.atan2(G.player.y - p.y, G.player.x - p.x);
      c.speed = 200;
    }
  },
  fireDemoShots() {
    for (let i = 0; i < 3; i++) {
      const a = G.player.angle + (i - 1) * 0.35;
      const b = G.combat.playerShoot(G.player.x, G.player.y, a);
      if (b) G.renderer.spawnFlash(b.x, b.y);
    }
    for (let i = 0; i < 2; i++) {
      const a = Math.atan2(G.player.y - (G.player.y - 200), G.player.x - (G.player.x + 200));
      G.combat.policeShoot(G.player.x + 200, G.player.y - 200 + i * 90, a + 0.2);
    }
    G.renderer.addShake(5);
  },
  showBanner: (t, s, c) => showBanner(t, s, c),
  toast: (t, c) => toast(t, c),
  save: () => saveGame(false),
  clearSave() {
    try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
    refreshSaveInfo();
  },
  shot: (name) => applyShot(G, name),
};

// ---- boot ----
refreshSaveInfo();
freshWorld();
G.mode = 'boot';

let lastTs = 0;
function loop(ts) {
  const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0.016;
  lastTs = ts;
  update(dt);
  G.renderer.render(G);
  if (G.mode === 'boot') drawBoot(ctx, G);
  else if (G.mode === 'paused') { drawHUD(ctx, G); drawPause(ctx, G); }
  else if (G.mode === 'busted') drawBusted(ctx, G);
  else if (G.mode === 'wasted') drawWasted(ctx, G);
  else if (G.mode === 'legend') { drawHUD(ctx, G); drawLegend(ctx, G); }
  else drawHUD(ctx, G);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Screenshot staging via ?shot=name (used by the playtest, never by players).
const shotName = new URLSearchParams(window.location.search).get('shot');
if (shotName) {
  setTimeout(() => {
    try {
      const ok = applyShot(G, shotName);
      window.__solaraShot = ok ? shotName : 'failed:' + shotName;
    } catch (err) {
      window.__solaraShot = 'error:' + String(err && err.message ? err.message : err);
    }
  }, 400);
}
window.SOLARA = G.api;
window.__solaraReady = true;
