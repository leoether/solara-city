// SOLARA CITY v3 — missions. Four DIFFERENT jobs, not the same fetch four times:
//   1. deliver — pick up a package, drop it off (+$300)
//   2. escape — reach the far marker before the timer runs out, wanted 2 (+$500)
//   3. survive — stay alive 45s at wanted 3 (+$800)
//   4. gold — steal the guarded gold coupe, deliver it, busted = mission failed (+$1500)
// Rewards sum to $3,100 = SOLARA LEGEND.

import { MISSIONS } from './config.js';
import { WORLD } from './config.js';

export class MissionManager {
  constructor(city, rng) {
    this.city = city;
    this.rng = rng;
    this.index = 0;          // 0..3 active mission, 4 = all done
    this.stage = 'pickup';   // deliver: pickup -> dropoff ; gold: steal -> deliver
    this.target = null;      // {x, y, label}
    this.pickup = null;
    this.timer = 0;
    this.timeLeft = 0;
    this.goldCar = null;
    this.failed = false;
    this.completedCash = 0;
  }

  get current() {
    return this.index < MISSIONS.length ? MISSIONS[this.index] : null;
  }

  get done() {
    return this.index >= MISSIONS.length;
  }

  _farPoint(from, minDist) {
    // A road point at least minDist away from `from`.
    for (let tries = 0; tries < 40; tries++) {
      const p = this.city.randomRoadPoint(this.rng);
      if (Math.hypot(p.x - from.x, p.y - from.y) >= minDist) return { x: p.x, y: p.y };
    }
    return { x: WORLD.size - 500, y: WORLD.size - 500 };
  }

  start(index, playerPos, traffic) {
    this.index = index;
    this.stage = 'pickup';
    this.failed = false;
    this.timer = 0;
    const m = this.current;
    if (!m) { this.target = null; return; }
    if (m.kind === 'deliver') {
      this.pickup = this._farPoint(playerPos, 550);
      this.target = { ...this.pickup, label: 'AMBIL PAKET' };
    } else if (m.kind === 'escape') {
      this.timeLeft = m.timeLimit;
      this.target = { ...this._farPoint(playerPos, 1100), label: 'KABUR KE SINI' };
    } else if (m.kind === 'survive') {
      this.timeLeft = m.timeLimit;
      this.target = null; // nowhere to go — just survive
    } else if (m.kind === 'gold') {
      // Gold coupe parked in a guarded lot: pick a road point far from the player.
      const lot = this._farPoint(playerPos, 900);
      this.goldCar = traffic.spawnGoldCoupe(lot.x, lot.y);
      this.target = { x: lot.x, y: lot.y, label: 'COUPE EMAS' };
    }
  }

  restartCurrent(playerPos, traffic) {
    this.start(this.index, playerPos, traffic);
  }

  // Returns { event: 'complete'|'fail'|'pickup'|'tick', reward? } or null.
  update(dt, player, traffic) {
    const m = this.current;
    if (!m || this.failed) return null;
    this.timer += dt;
    if (m.kind === 'escape' || m.kind === 'survive') {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        if (m.kind === 'survive') return this._complete();
        return { event: 'fail', reason: 'Waktu habis! Polisi makin dekat.' };
      }
    }
    if (!this.target) return { event: 'tick' };
    const d = Math.hypot(player.x - this.target.x, player.y - this.target.y);
    const radius = 52;
    if (d > radius) return { event: 'tick' };
    if (m.kind === 'deliver') {
      if (this.stage === 'pickup') {
        this.stage = 'dropoff';
        const drop = this._farPoint({ x: this.target.x, y: this.target.y }, 750);
        this.target = { ...drop, label: 'ANTAR KE SINI' };
        return { event: 'pickup' };
      }
      return this._complete();
    }
    if (m.kind === 'escape') return this._complete();
    if (m.kind === 'gold') {
      if (this.stage === 'pickup') {
        // Reached the lot: the coupe itself is the objective; stealing it
        // is done with E by the player. The marker just guides the player.
        return { event: 'tick' };
      }
      return this._complete();
    }
    return { event: 'tick' };
  }

  // Called when the player steals a car while mission 4 is active.
  onSteal(car) {
    const m = this.current;
    if (!m || m.kind !== 'gold' || this.stage !== 'pickup') return null;
    if (car !== this.goldCar) return null;
    this.stage = 'deliver';
    const drop = this._farPoint({ x: car.x, y: car.y }, 900);
    this.target = { ...drop, label: 'BAWA COUPE KE SINI' };
    return { event: 'gold-stolen' };
  }

  _complete() {
    const m = this.current;
    const reward = m.reward;
    this.completedCash = reward;
    this.index += 1;
    this.stage = 'pickup';
    this.target = null;
    this.pickup = null;
    this.goldCar = null;
    return { event: 'complete', reward };
  }

  fail(reason) {
    this.failed = true;
    return { event: 'fail', reason };
  }
}
