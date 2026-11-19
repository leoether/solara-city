// SOLARA CITY — combat.js
// Tembakan pemain (mouse / spasi), peluru, tabrakan peluru vs polisi /
// pejalan / mobil, dan damage ke pemain. Semua hit memberi feedback
// (partikel + shake) lewat fx.

import { PLAYER } from './config.js';
import { dist } from './random.js';

export function createCombat() {
  return {
    bullets: [],       // {x,y,vx,vy,life,fromPlayer}
    cooldown: 0,
    muzzle: 0,
  };
}

// Tembak dari posisi pemain ke arah sudut aim. Mengembalikan true bila
// peluru benar-benar ditembakkan (cooldown habis).
export function shoot(combat, x, y, aimAngle, fx, audio) {
  if (combat.cooldown > 0) return false;
  combat.cooldown = PLAYER.shootCooldown;
  combat.muzzle = 0.07;
  const bx = x + Math.cos(aimAngle) * 22;
  const by = y + Math.sin(aimAngle) * 22;
  combat.bullets.push({
    x: bx, y: by,
    vx: Math.cos(aimAngle) * PLAYER.bulletSpeed,
    vy: Math.sin(aimAngle) * PLAYER.bulletSpeed,
    life: 0.9, fromPlayer: true,
  });
  if (fx) fx.muzzle(bx, by);
  if (audio) audio.shoot();
  return true;
}

// Polisi juga menembak sesekali saat dekat (hanya di wanted 3).
export function copShoot(combat, cop, px, py) {
  const a = Math.atan2(py - cop.y, px - cop.x) + (Math.random() - 0.5) * 0.22;
  combat.bullets.push({
    x: cop.x + Math.cos(a) * 24, y: cop.y + Math.sin(a) * 24,
    vx: Math.cos(a) * 640, vy: Math.sin(a) * 640,
    life: 0.8, fromPlayer: false,
  });
}

export function stepBullets(combat, dt, world, cops, peds, player, fx, audio, onPlayerHit) {
  if (combat.cooldown > 0) combat.cooldown -= dt;
  if (combat.muzzle > 0) combat.muzzle -= dt;
  const dead = [];
  for (let i = 0; i < combat.bullets.length; i++) {
    const b = combat.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let hit = b.life <= 0;
    if (!hit) {
      // Gedung menghentikan peluru.
      const wall = world.buildings.some((bd) => b.x > bd.x && b.x < bd.x + bd.w && b.y > bd.y && b.y < bd.y + bd.h);
      if (wall) {
        hit = true;
        if (fx) fx.sparks(b.x, b.y, 5);
      }
    }
    if (!hit && b.fromPlayer) {
      for (const cop of cops) {
        if (dist(b.x, b.y, cop.x, cop.y) < 34) {
          hit = true;
          cop.hp = (cop.hp || 100) - PLAYER.bulletDamage;
          if (fx) fx.sparks(b.x, b.y, 10);
          if (cop.hp <= 0) {
            cop.dead = true;
            if (fx) fx.explosion(cop.x, cop.y);
            if (audio) audio.crash(1);
          }
          break;
        }
      }
      if (!hit) {
        for (const p of peds) {
          if (dist(b.x, b.y, p.x, p.y) < 14) {
            hit = true;
            p.panic = 2;
            if (fx) fx.sparks(b.x, b.y, 4);
            break;
          }
        }
      }
    }
    if (!hit && !b.fromPlayer) {
      const d = player.inCar
        ? dist(b.x, b.y, player.car.x, player.car.y)
        : dist(b.x, b.y, player.x, player.y);
      const r = player.inCar ? 30 : 15;
      if (d < r) {
        hit = true;
        if (fx) fx.sparks(b.x, b.y, 6);
        if (onPlayerHit) onPlayerHit(PLAYER.bulletDamage * 0.4);
      }
    }
    if (hit) dead.push(i);
  }
  for (let i = dead.length - 1; i >= 0; i--) combat.bullets.splice(dead[i], 1);
  // Bersihkan polisi yang hancur.
  for (let i = cops.length - 1; i >= 0; i--) {
    if (cops[i].dead) cops.splice(i, 1);
  }
}
