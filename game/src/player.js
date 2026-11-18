// SOLARA CITY v3 — the player: on foot, or driving a stolen car.
// Walk / drive physics, stealing (E), damage, and the busted/wasted timers
// live here; the state machine itself lives in main.js.

import { WORLD, PLAYER } from './config.js';
import { clamp } from './random.js';

export class Player {
  constructor(city, x, y) {
    this.city = city;
    this.x = x;
    this.y = y;
    this.angle = -Math.PI / 2; // facing up the road
    this.health = PLAYER.health;
    this.inCar = false;
    this.car = null;
    this.carSpeed = 0;
    this.steer = 0;
    this.lastHurtT = -99;
    this.time = 0;
  }

  get speed() {
    return this.inCar ? Math.abs(this.carSpeed) : 0;
  }

  reset(x, y) {
    this.x = x;
    this.y = y;
    this.angle = -Math.PI / 2;
    this.health = PLAYER.health;
    this.exitCar();
    this.carSpeed = 0;
  }

  exitCar() {
    if (this.car) {
      // Step out beside the car.
      this.x = this.car.x + Math.cos(this.car.angle + Math.PI / 2) * 40;
      this.y = this.car.y + Math.sin(this.car.angle + Math.PI / 2) * 40;
      this.angle = this.car.angle;
      this.car.parked = true;
      this.car.speed = 0;
      this.car = null;
    }
    this.inCar = false;
    this.carSpeed = 0;
  }

  enterCar(car) {
    car.parked = false;
    car.speed = 0;
    this.car = car;
    this.inCar = true;
    this.carSpeed = 0;
    this.x = car.x;
    this.y = car.y;
    this.angle = car.angle;
  }

  hurt(amount, now) {
    this.health = Math.max(0, this.health - amount);
    this.lastHurtT = now;
  }

  update(dt, input, now) {
    this.time = now;
    // Slow health regen after 8 calm seconds.
    if (now - this.lastHurtT > 8 && this.health > 0 && this.health < PLAYER.health) {
      this.health = Math.min(PLAYER.health, this.health + 2.2 * dt);
    }
    if (this.inCar && this.car) {
      this._drive(dt, input);
    } else {
      this._walk(dt, input);
    }
  }

  _walk(dt, input) {
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
      this.angle = Math.atan2(my, mx);
      const nx = this.x + mx * PLAYER.walkSpeed * dt;
      const ny = this.y + my * PLAYER.walkSpeed * dt;
      const hit = this.city.collideBuildings(nx, ny, PLAYER.radius);
      this.x = hit.x;
      this.y = hit.y;
    }
    this.x = clamp(this.x, 30, WORLD.size - 30);
    this.y = clamp(this.y, 30, WORLD.size - 30);
  }

  _drive(dt, input) {
    const car = this.car;
    const maxSpeed = car.gold ? PLAYER.goldMaxSpeed : PLAYER.maxSpeed;
    if (input.up) this.carSpeed += PLAYER.accel * dt;
    else if (input.down) {
      // Brake if moving forward, reverse if (nearly) stopped.
      if (this.carSpeed > 30) this.carSpeed -= PLAYER.brake * dt;
      else this.carSpeed -= PLAYER.accel * 0.55 * dt;
    } else {
      // Coast / drag.
      this.carSpeed -= this.carSpeed * 0.9 * dt;
      if (Math.abs(this.carSpeed) < 4) this.carSpeed = 0;
    }
    this.carSpeed = clamp(this.carSpeed, -PLAYER.reverseMax, maxSpeed);
    // Steering: only effective while moving; sharper at low speed.
    const steerInput = (input.left ? -1 : 0) + (input.right ? 1 : 0);
    const speedFactor = clamp(Math.abs(this.carSpeed) / 260, 0.25, 1);
    const dir = this.carSpeed >= 0 ? 1 : -1;
    this.steer += (steerInput - this.steer) * Math.min(1, dt * 10);
    car.angle += this.steer * PLAYER.turnRate * speedFactor * dir * dt;
    this.angle = car.angle;
    const nx = car.x + Math.cos(car.angle) * this.carSpeed * dt;
    const ny = car.y + Math.sin(car.angle) * this.carSpeed * dt;
    const hit = this.city.collideBuildings(nx, ny, 22);
    if (hit.hit) {
      // Crash: keep the impact speed for the caller (via this.crashSpeed).
      this.crashSpeed = Math.abs(this.carSpeed);
      this.carSpeed *= -0.25; // bounce back a little
    } else {
      this.crashSpeed = 0;
    }
    car.x = hit.x;
    car.y = hit.y;
    car.speed = this.carSpeed;
    this.x = car.x;
    this.y = car.y;
    car.x = clamp(car.x, 40, WORLD.size - 40);
    car.y = clamp(car.y, 40, WORLD.size - 40);
    this.x = car.x;
    this.y = car.y;
  }
}
