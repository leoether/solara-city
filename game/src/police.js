// SOLARA CITY — police.js
// Wanted system: police spawn count and aggression scale with the wanted
// level. Cops chase, ram, and at high wanted levels shoot. Getting caught
// on foot (or boxed in while crawling) means BUSTED.

import { WORLD_W, WORLD_H } from './state.js';

let nextCopId = 1;

export function wantedCopCount(wanted) {
  return [0, 2, 4, 6][wanted] || 0;
}

export function wantedCopSpeed(wanted) {
  return [0, 300, 360, 430][wanted] || 0;
}

export function makeCop(x, y, wanted) {
  return {
    id: nextCopId++,
    x, y,
    angle: 0,
    speed: 0,
    maxSpeed: wantedCopSpeed(wanted),
    radius: 22,
    stuckTimer: 0,
    shootCooldown: 1 + Math.random() * 2,
    ramCooldown: 0,
    sirenPhase: Math.random() * Math.PI * 2,
  };
}

export function spawnCopsForWanted(state, wanted) {
  const want = wantedCopCount(wanted);
  const px = state.player.x;
  const py = state.player.y;
  while (state.cops.length < want) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 520 + Math.random() * 320;
    let x = px + Math.cos(angle) * dist;
    let y = py + Math.sin(angle) * dist;
    x = Math.max(60, Math.min(WORLD_W - 60, x));
    y = Math.max(60, Math.min(WORLD_H - 60, y));
    state.cops.push(makeCop(x, y, wanted));
  }
  while (state.cops.length > want) state.cops.pop();
}

export function syncCopsToWanted(state) {
  const want = wantedCopCount(state.wanted);
  for (const cop of state.cops) cop.maxSpeed = wantedCopSpeed(state.wanted);
  if (state.cops.length < want) spawnCopsForWanted(state, state.wanted);
  else if (state.cops.length > want) state.cops.length = want;
}

export function updateCops(state, dt, events) {
  // events: { onRam(cop), onShot(cop, tx, ty), onBusted(cop) }
  const px = state.player.inCar && state.car ? state.car.x : state.player.x;
  const py = state.player.inCar && state.car ? state.car.y : state.player.y;
  const playerSpeed = state.player.inCar && state.car ? Math.abs(state.car.speed) : 0;
  // BUSTED: a cop holds contact with the player on foot, or pins a
  // near-stopped car. The timer is shared: it grows while ANY cop holds
  // contact and decays only when none does.
  let contact = false;
  for (const cop of state.cops) {
    const dx = px - cop.x;
    const dy = py - cop.y;
    const dist = Math.hypot(dx, dy) || 1;
    const targetAngle = Math.atan2(dy, dx);
    let diff = targetAngle - cop.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const turnRate = 3.1;
    cop.angle += Math.max(-turnRate * dt, Math.min(turnRate * dt, diff));
    // Cops overshoot less when the player is slow; they ease off at speed.
    // When a cop reaches the player it stops to make the arrest instead
    // of driving straight past.
    const desired = dist < 44 ? 0 : cop.maxSpeed * (dist > 700 ? 1 : 0.92);
    cop.speed += (desired - cop.speed) * Math.min(1, dt * 1.2);
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
    cop.x = Math.max(40, Math.min(WORLD_W - 40, cop.x));
    cop.y = Math.max(40, Math.min(WORLD_H - 40, cop.y));
    cop.sirenPhase += dt * 6;

    if (cop.ramCooldown > 0) cop.ramCooldown -= dt;
    if (dist < 46 && cop.ramCooldown <= 0) {
      cop.ramCooldown = 0.9;
      if (events.onRam) events.onRam(cop, dist);
    }
    // Cops shoot at wanted 2+ when close and the player is on foot or slow.
    if (state.wanted >= 2 && dist < 420 && dist > 60) {
      cop.shootCooldown -= dt;
      if (cop.shootCooldown <= 0) {
        cop.shootCooldown = 1.6 + Math.random() * 1.4;
        if (events.onShot) events.onShot(cop, px, py);
      }
    }
    if (state.mode !== 'busted' && state.mode !== 'wasted') {
      if (!state.player.inCar && dist < 34) contact = true;
      else if (state.player.inCar && playerSpeed < 25 && dist < 52) contact = true;
    }
  }
  if (state.mode !== 'busted' && state.mode !== 'wasted') {
    if (contact) {
      state.bustedTimer += dt;
      const threshold = state.player.inCar ? 2.2 : 1.1;
      if (state.bustedTimer > threshold && events.onBusted) events.onBusted(state.cops[0]);
    } else {
      state.bustedTimer = Math.max(0, state.bustedTimer - dt * 2);
    }
  }
}

// Player damage from a cop ram: bigger hit when the cop is fast.
export function ramDamage(cop) {
  return Math.round(6 + Math.min(14, cop.speed / 40));
}
