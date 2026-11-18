// main.js — SOLARA CITY boot, input, state machine and game loop.
// States: title -> play <-> pause, plus busted / wasted / complete overlays.
import { CITY, clamp } from './config.js';
import { buildCity } from './world.js';
import { Car, Traffic, drivePlayerCar } from './vehicles.js';
import { Pedestrians } from './pedestrians.js';
import { Police } from './police.js';
import { Player } from './player.js';
import { MissionChain } from './missions.js';
import { Combat } from './combat.js';
import { AudioSynth } from './audio.js';
import { HUD } from './hud.js';
import { Render } from './render.js';
import { stageShot, SHOT_NAMES } from './shots.js';

const SAVE_KEY = 'solara-city-save-v1';
const PARKED_SPOTS = [
  { x: -56, z: 4, heading: Math.PI / 2, color: 0xd64545 },
  { x: 64, z: -4, heading: -Math.PI / 2, color: 0x3a7bd5 },
  { x: -4, z: 116, heading: 0, color: 0xf2c14e },
  { x: 116, z: 56, heading: Math.PI, color: 0x7ec850 },
  { x: 56, z: -116, heading: Math.PI / 2, color: 0xe8e8e8 },
  { x: -116, z: -56, heading: 0, color: 0xff8c42 },
];

class Game {
  constructor() {
    this.render = new Render(document.getElementById('app'));
    this.world = buildCity(this.render.scene, 1);
    this.player = new Player(this.render.scene);
    this.traffic = new Traffic(this.render.scene, 1);
    this.peds = new Pedestrians(this.render.scene, 1, 20);
    this.police = new Police(this.render.scene);
    this.missions = new MissionChain();
    this.combat = new Combat(this.render.scene);
    this.audio = new AudioSynth();
    this.hud = new HUD();
    this.ownedCars = [];
    this.parkedCars = [];
    this.goldCar = null;
    this.state = 'title';
    this.input = { up: false, down: false, left: false, right: false, run: false };
    this.copShootTimer = 0;
    this.titleAngle = 0;
    this.beacon = this.makeBeacon();
    this.render.scene.add(this.beacon);
    this.beacon.visible = false;
    this.shotMode = null;
    this.loadSave();
    this.bindInput();
    this.spawnParkedCars();
    this.updateBeacon();
  }

  makeBeacon() {
    const g = new THREE.Group();
    const cyl = new THREE.Mesh(
      new THREE.CylinderGeometry(4.5, 4.5, 60, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd94a, transparent: true, opacity: 0.15, side: THREE.DoubleSide, depthWrite: false }),
    );
    cyl.position.y = 30;
    g.add(cyl);
    const gem = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.1),
      new THREE.MeshBasicMaterial({ color: 0xffd94a }),
    );
    gem.position.y = 6;
    g.add(gem);
    g.userData.gem = gem;
    return g;
  }

  updateBeacon() {
    const t = this.missions.target;
    if (t && this.state !== 'title') {
      this.beacon.visible = true;
      this.beacon.position.set(t.x, 0, t.z);
    } else {
      this.beacon.visible = false;
    }
  }

  spawnParkedCars() {
    for (const s of PARKED_SPOTS) {
      const car = new Car(this.render.scene, s.x, s.z, s.heading, s.color);
      car.parked = true;
      this.parkedCars.push(car);
    }
  }

  spawnGoldCar(x, z) {
    if (this.goldCar) return this.goldCar;
    const car = new Car(this.render.scene, x, z, 0, 0xffd700);
    car.isGold = true;
    car.parked = true;
    this.goldCar = car;
    return car;
  }

  resetWorld(seed = 1) {
    for (const c of this.traffic.cars) c.remove(this.render.scene);
    for (const p of this.peds.peds) this.render.scene.remove(p.mesh);
    for (const c of this.police.cars) c.remove(this.render.scene);
    for (const c of this.police.cops) this.render.scene.remove(c.mesh);
    for (const c of this.ownedCars) c.remove(this.render.scene);
    for (const c of this.parkedCars) c.remove(this.render.scene);
    if (this.goldCar) { this.goldCar.remove(this.render.scene); this.goldCar = null; }
    this.traffic = new Traffic(this.render.scene, seed);
    this.peds = new Pedestrians(this.render.scene, seed, 20);
    this.police = new Police(this.render.scene);
    this.ownedCars = [];
    this.parkedCars = [];
    this.spawnParkedCars();
    this.player.health = 100;
    if (this.player.driving) this.player.exitCar();
    this.player.x = 0;
    this.player.z = -40;
    this.player.heading = 0;
    this.player.camYaw = 0;
    this.player.mesh.position.set(0, 0, -40);
    this.player.mesh.visible = true;
    this.police.resetBusted();
  }

  loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (typeof s.money === 'number') this.player.money = s.money;
      if (typeof s.missionIndex === 'number' && s.missionIndex >= 0 && s.missionIndex < 4) {
        this.missions.index = s.missionIndex;
      }
      if (s.done) this.missions.done = true;
      const btn = document.getElementById('continue-btn');
      if (this.missions.index > 0 || this.missions.done) {
        btn.classList.remove('hidden');
        document.getElementById('continue-job').textContent = this.missions.done ? '✓' : String(this.missions.index + 1);
      }
    } catch { /* fresh start */ }
  }

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        money: this.player.money,
        missionIndex: this.missions.index,
        done: this.missions.done,
      }));
    } catch { /* ignore */ }
  }

  bindInput() {
    const keyMap = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right' };
    window.addEventListener('keydown', (e) => {
      if (keyMap[e.code] !== undefined) { this.input[keyMap[e.code]] = true; e.preventDefault(); }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.input.run = true;
      if (e.code === 'KeyE') this.interact();
      if (e.code === 'KeyM') { const m = this.audio.toggleMute(); this.showHint(m ? 'Sound OFF' : 'Sound ON', 1.2); }
      if (e.code === 'KeyP' || e.code === 'Escape') this.togglePause();
    });
    window.addEventListener('keyup', (e) => {
      if (keyMap[e.code] !== undefined) this.input[keyMap[e.code]] = false;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.input.run = false;
    });
    // Mouse drag orbits the camera; a short click shoots.
    let dragging = false;
    let downX = 0;
    let downY = 0;
    let downT = 0;
    let moved = 0;
    const el = this.render.renderer.domElement;
    el.addEventListener('pointerdown', (e) => {
      dragging = true; downX = e.clientX; downY = e.clientY; downT = performance.now(); moved = 0;
      this.audio.ensure();
    });
    window.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - downX;
      const dy = e.clientY - downY;
      moved = Math.max(moved, Math.abs(dx) + Math.abs(dy));
      this.player.camYaw -= dx * 0.005;
      this.player.camPitch = clamp(this.player.camPitch + dy * 0.004, -0.1, 0.9);
      downX = e.clientX;
      downY = e.clientY;
    });
    window.addEventListener('pointerup', () => {
      if (dragging && moved < 6 && performance.now() - downT < 350 && this.state === 'play' && !this.player.driving) {
        this.shoot();
      }
      dragging = false;
    });
    document.getElementById('start-btn').addEventListener('click', () => this.startGame(false));
    document.getElementById('continue-btn').addEventListener('click', () => this.startGame(true));
    document.getElementById('resume-btn').addEventListener('click', () => this.togglePause());
    document.getElementById('end-btn').addEventListener('click', () => this.respawn());
  }

  showHint(text, seconds = 2.5) {
    const h = document.getElementById('hint');
    h.textContent = text;
    h.classList.remove('hidden');
    clearTimeout(this._hintTimer);
    this._hintTimer = setTimeout(() => h.classList.add('hidden'), seconds * 1000);
  }

  startGame(continued) {
    this.audio.ensure();
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('end-screen').classList.add('hidden');
    this.state = 'play';
    if (!continued) {
      this.player.money = 0;
      this.missions = new MissionChain();
      this.resetWorld(1);
    }
    this.missions.startMission(this.police);
    this.updateBeacon();
    this.showHint('WASD to move — find a car and press E', 4);
  }

  togglePause() {
    if (this.state === 'play') {
      this.state = 'pause';
      document.getElementById('pause-screen').classList.remove('hidden');
    } else if (this.state === 'pause') {
      this.state = 'play';
      document.getElementById('pause-screen').classList.add('hidden');
    }
  }

  nearestEnterableCar() {
    const all = [...this.parkedCars, ...this.traffic.cars];
    // The gold coupe is the job — when it is within reach, E always takes it,
    // even if a traffic car happens to be a step closer on the intersection.
    if (this.goldCar) {
      const gd = Math.hypot(this.goldCar.x - this.player.x, this.goldCar.z - this.player.z);
      if (gd < 3.6) return this.goldCar;
    }
    let best = null;
    let bestD = 3.6;
    for (const c of all) {
      const d = Math.hypot(c.x - this.player.x, c.z - this.player.z);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  interact() {
    if (this.state !== 'play') return;
    if (this.player.driving) {
      this.player.exitCar();
      this.updateBeacon();
      return;
    }
    const car = this.nearestEnterableCar();
    if (!car) return;
    this.player.enterCar(car);
    this.audio.chime();
    if (car.isGold) {
      this.police.setWanted(Math.max(this.police.wanted, 3));
      this.showHint('THE GOLD COUPE IS YOURS — LOSE THE HEAT!', 4);
    } else if (car.parked || this.traffic.cars.includes(car)) {
      this.police.addWanted(1);
      this.showHint('Car jacked! The cops noticed. (+1 ★)', 3);
    }
    if (car.parked) {
      this.parkedCars = this.parkedCars.filter((c) => c !== car);
      this.ownedCars.push(car);
      car.parked = false;
    } else if (this.traffic.cars.includes(car)) {
      this.traffic.cars = this.traffic.cars.filter((c) => c !== car);
      this.ownedCars.push(car);
    }
    this.updateBeacon();
  }

  shoot() {
    if (this.state !== 'play' || this.player.driving) return;
    this.audio.ensure();
    const dir = new THREE.Vector3();
    this.render.camera.getWorldDirection(dir);
    const aimX = this.player.x + dir.x * 30;
    const aimZ = this.player.z + dir.z * 30;
    const targets = [];
    for (const cop of this.police.cops) targets.push({ x: cop.mesh.position.x, z: cop.mesh.position.z, kind: 'cop', ref: cop });
    for (const p of this.peds.peds) {
      if (!p.down) targets.push({ x: p.mesh.position.x, z: p.mesh.position.z, kind: 'ped', ref: p });
    }
    const res = this.combat.shoot(this.player, aimX, aimZ, targets);
    if (!res) return;
    this.audio.shot();
    if (res.hit) {
      if (res.hit.kind === 'cop') {
        this.render.scene.remove(res.hit.ref.mesh);
        this.police.cops = this.police.cops.filter((c) => c !== res.hit.ref);
        this.police.addWanted(1);
        this.player.money += 25;
        this.showHint('Cop down! +$25 — but the heat is on. (+1 ★)', 3);
      } else {
        res.hit.ref.down = true;
        res.hit.ref.downTime = 6;
        res.hit.ref.mesh.rotation.x = -Math.PI / 2;
        res.hit.ref.mesh.position.y = 0.3;
        this.police.addWanted(1);
        this.showHint('Pedestrian hit! The city saw that. (+1 ★)', 3);
      }
    }
  }

  respawn() {
    document.getElementById('end-screen').classList.add('hidden');
    this.player.health = 100;
    this.police.clearWanted();
    this.police.resetBusted();
    if (this.player.driving) this.player.exitCar();
    this.player.x = 0;
    this.player.z = -40;
    this.player.mesh.position.set(0, 0, -40);
    this.player.mesh.visible = true;
    this.state = 'play';
    this.updateBeacon();
  }

  endScreen(kind) {
    this.state = kind;
    const title = document.getElementById('end-title');
    const text = document.getElementById('end-text');
    if (kind === 'busted') {
      title.textContent = 'BUSTED';
      title.style.color = '#7db8ff';
      const fine = Math.floor(this.player.money * 0.1);
      this.player.money -= fine;
      text.textContent = `The Solara PD caught you. Bail cost $${fine}. Mama Lou is already planning your comeback.`;
    } else if (kind === 'wasted') {
      title.textContent = 'WASTED';
      title.style.color = '#ff5c5c';
      const lost = Math.floor(this.player.money * 0.2);
      this.player.money -= lost;
      text.textContent = `Rico went down in the streets of Solara. The hospital patched you up for $${lost}.`;
    } else {
      title.textContent = 'SOLARA LEGEND ★';
      title.style.color = '#ffd94a';
      text.textContent = `All four jobs done. $${this.player.money.toLocaleString('en-US')} in the pocket and the whole city knows Rico's name.`;
    }
    document.getElementById('end-screen').classList.remove('hidden');
    this.save();
  }

  step(dt) {
    this.frames = (this.frames || 0) + 1;
    const p = this.player;
    if (this.state === 'title') {
      this.titleAngle += dt * 0.05;
      this.render.camera.position.set(Math.sin(this.titleAngle) * 170, 70, Math.cos(this.titleAngle) * 170);
      this.render.camera.lookAt(0, 8, 0);
      this.traffic.step(dt, this.world.colliders);
      this.peds.step(dt, null);
      this.render.draw();
      return;
    }
    if (this.state !== 'play') {
      this.render.draw();
      return;
    }
    // --- play ---
    if (p.driving && p.car) {
      drivePlayerCar(p.car, this.input, dt);
      p.syncFromCar();
      for (const b of this.world.colliders) {
        const pos = { x: p.x, z: p.z };
        if (pos.x > b.minX - 1.6 && pos.x < b.maxX + 1.6 && pos.z > b.minZ - 1.6 && pos.z < b.maxZ + 1.6) {
          p.car.speed *= -0.35;
          p.car.setPos(p.car.x - Math.sin(p.car.heading) * 2, p.car.z - Math.cos(p.car.heading) * 2, p.car.heading);
          p.syncFromCar();
        }
      }
      p.x = clamp(p.x, -145, 145);
      p.z = clamp(p.z, -145, 210);
      p.car.mesh.position.x = p.x;
      p.car.mesh.position.z = p.z;
      const hits = this.peds.knockDown(p.x, p.z, 2.6);
      if (hits > 0 && Math.abs(p.car.speed) > 8) {
        this.police.addWanted(1);
        this.showHint('You ran someone over! (+1 ★)', 3);
      }
      for (const pc of this.police.cars) {
        if (Math.hypot(pc.x - p.x, pc.z - p.z) < 3.4) {
          p.car.speed *= 0.55;
        }
      }
    } else {
      p.stepOnFoot(this.input, dt, this.world.colliders);
    }
    this.traffic.step(dt, this.world.colliders);
    const danger = {
      x: p.x, z: p.z,
      radius: p.driving ? 14 : 9,
      active: (p.driving && Math.abs(p.car ? p.car.speed : 0) > 10) || this.combat.cooldown > 0.1,
    };
    this.peds.step(dt, danger);
    this.police.step(dt, p, this.world.colliders);
    this.combat.step(dt);
    // Cops shoot when close and wanted.
    if (this.police.wanted > 0 && !p.driving) {
      this.copShootTimer -= dt;
      const near = this.police.nearestPoliceDist(p);
      if (near < 14 && this.copShootTimer <= 0) {
        this.copShootTimer = 2.2;
        if (p.takeDamage(6)) {
          this.endScreen('wasted');
          return;
        }
      }
    }
    if (this.police.busted) {
      this.endScreen('busted');
      return;
    }
    if (p.health <= 0) {
      this.endScreen('wasted');
      return;
    }
    if (this.police.wanted === 0 && p.health < 100) p.heal(2 * dt);
    const m = this.missions.current;
    if (m && m.id === 4 && !this.goldCar) this.spawnGoldCar(60, 60);
    const res = this.missions.step(dt, p, this.police);
    if (res === 'complete') {
      this.audio.jingle();
      this.missions.complete(p, this.police);
      this.save();
      if (this.missions.done) {
        this.endScreen('complete');
        return;
      }
    } else if (res === 'failed') {
      this.missions.fail(this.police);
    }
    this.updateBeacon();
    if (this.beacon.visible) {
      this.beacon.userData.gem.rotation.y += dt * 2;
      this.beacon.userData.gem.position.y = 5 + Math.sin(performance.now() / 300) * 0.6;
    }
    this.audio.setEngine(p.driving ? Math.abs(p.car.speed) / 27 : 0, p.driving);
    this.audio.setSiren(this.police.wanted > 0, dt);
    this.render.follow(p, dt);
    this.hud.update(this);
    this.render.draw();
    const hint = document.getElementById('hint');
    if (!p.driving && this.nearestEnterableCar() && this.missions.toastTime <= 0) {
      hint.textContent = 'Press E to steal this car';
      hint.classList.remove('hidden');
    } else if (p.driving && this.missions.toastTime <= 0) {
      hint.textContent = 'Press E to exit the car';
      hint.classList.remove('hidden');
    }
  }

  run() {
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      this.step(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

// ---- boot ----
const game = new Game();
// Exposed for debugging and automated playtests (read-only handle to the live game).
window.__solara = game;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot && SHOT_NAMES.includes(shot)) {
  document.getElementById('start-screen').classList.add('hidden');
  document.getElementById('hud').style.display = 'block';
  game.state = 'shot';
  stageShot(shot, game);
  // Frozen frame: keep drawing the staged scene so the screenshot is deterministic.
  const drawFrozen = () => {
    game.render.draw();
    requestAnimationFrame(drawFrozen);
  };
  requestAnimationFrame(drawFrozen);
} else {
  game.run();
}
