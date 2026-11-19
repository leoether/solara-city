// SOLARA CITY — screenshot scene presets (fresh build v5).
// Each shot sets the live game state to one of the four required scenes
// (1280x720): chase, mission reward, legend + gold coupe, shootout.
// Used by capture-shots.js through window.__solara.applyShot(id).

import { MISSION_REWARDS } from './state.js';
import { spawnCops } from './police.js';

export const SHOTS = [
  { id: '1-chase', name: 'Curi mobil + kejar-kejaran polisi (wanted 1)' },
  { id: '2-reward', name: 'Misi selesai + reward cash tampil' },
  { id: '3-legend', name: 'Status SOLARA LEGEND + coupe emas' },
  { id: '4-shootout', name: 'Baku tembak intens di wanted level tinggi' },
];

export function applyShot(S, city, id) {
  const p = S.player;
  // Bring the player back to a known-good driving state first.
  S.mode = 'playing';
  S.flash = 0;
  if (id === '1-chase') {
    // Steal a car and get chased at wanted 1.
    if (p.onFoot) {
      // Find any parked car and steal it directly.
      const car = S.cars.find(c => c.parked);
      if (car) {
        p.x = car.x; p.y = car.y;
        car.parked = false;
        S.cars = S.cars.filter(c => c !== car);
        p.car = car; p.onFoot = false; car.isPlayer = true;
      }
    }
    if (p.car) p.car.speed = 330;
    S.wanted = 1;
    S.cops.length = 0;
    spawnCops(S, city);
    // Pull the cops close behind the player for a dramatic chase frame.
    S.cops.forEach((c, i) => {
      c.x = p.x - 190 - i * 90;
      c.y = p.y + (i === 0 ? -60 : 70);
      c.angle = p.angle;
      c.speed = 320;
    });
    S.banner = 'MOBIL DICURI! WANTED LEVEL 1';
    S.bannerT = 2.5;
    S.shake = 3;
    return true;
  }
  if (id === '2-reward') {
    if (p.onFoot) {
      const car = S.cars.find(c => c.parked);
      if (car) {
        p.x = car.x; p.y = car.y;
        car.parked = false;
        S.cars = S.cars.filter(c => c !== car);
        p.car = car; p.onFoot = false; car.isPlayer = true;
      }
    }
    const reward = MISSION_REWARDS[1];
    S.cash += reward;
    S.earned += reward;
    S.banner = 'MISI SELESAI! +$' + reward;
    S.bannerT = 3;
    S.floats.push({ x: p.x, y: p.y - 50, text: '+$' + reward, life: 2, maxLife: 2, color: '#2ecc71', size: 34 });
    S.missionIndex = 2;
    S.wanted = 0;
    S.cops.length = 0;
    return true;
  }
  if (id === '3-legend') {
    S.cash = 3100;
    S.earned = 3100;
    S.missionIndex = 4;
    S.mission = null;
    // Gold coupe parked right beside the player.
    if (p.onFoot) {
      const car = S.cars.find(c => c.parked);
      if (car) {
        car.color = '#ffd700';
        car.isGold = true;
        p.x = car.x; p.y = car.y;
        car.parked = false;
        S.cars = S.cars.filter(c => c !== car);
        p.car = car; p.onFoot = false; car.isPlayer = true;
        S.goldCoupe = car;
      }
    } else if (p.car) {
      p.car.color = '#ffd700';
      p.car.isGold = true;
      S.goldCoupe = p.car;
    }
    S.mode = 'legend';
    S.legendShown = true;
    S.banner = '';
    S.bannerT = 0;
    S.wanted = 0;
    S.cops.length = 0;
    return true;
  }
  if (id === '4-shootout') {
    // On foot, gun out, wanted 3, cops closing in, muzzle flash + sparks.
    if (p.car) {
      const car = p.car;
      car.isPlayer = false;
      car.parked = true;
      S.cars.push(car);
      p.car = null;
    }
    p.onFoot = true;
    p.health = 62;
    p.muzzle = 0.12;
    p.shootCd = 0;
    S.wanted = 3;
    S.cops.length = 0;
    spawnCops(S, city);
    S.cops.forEach((c, i) => {
      const a = (i / Math.max(1, S.cops.length)) * Math.PI * 2;
      c.x = p.x + Math.cos(a) * 200;
      c.y = p.y + Math.sin(a) * 200;
      c.angle = Math.atan2(p.y - c.y, p.x - c.x);
      c.speed = 60;
    });
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      S.particles.push({
        x: p.x + Math.cos(a) * (30 + Math.random() * 60),
        y: p.y + Math.sin(a) * (30 + Math.random() * 60),
        vx: 0, vy: 0, life: 0.5, maxLife: 0.5,
        size: 2 + Math.random() * 3,
        color: Math.random() < 0.5 ? '#ffd166' : '#ff6b35', kind: 'spark',
      });
    }
    S.bullets.push({ x: p.x + 24, y: p.y, vx: 720, vy: 0, life: 0.5 });
    S.shake = 5;
    S.flash = 0.25;
    S.flashColor = '255,200,60';
    S.banner = 'WANTED 3 — BAKU TEMBAK!';
    S.bannerT = 2.5;
    return true;
  }
  return false;
}
