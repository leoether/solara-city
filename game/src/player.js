// player.js — Rico, the newcomer: on-foot third-person movement + car enter/exit.
import { GAME, clamp, resolveCircleAABB } from './config.js';
import { makePedMesh } from './pedestrians.js';

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.mesh = makePedMesh(0xffffff, 0xe0ac69);
    // Rico: teal jacket, dark jeans — distinct from crowd and cops.
    this.mesh.children[0].material = new THREE.MeshLambertMaterial({ color: 0x0e7c7b });
    this.mesh.position.set(0, 0, -40);
    scene.add(this.mesh);
    this.x = 0;
    this.z = -40;
    this.heading = 0;
    this.camYaw = 0;
    this.camPitch = 0.32;
    this.health = GAME.PLAYER_HEALTH;
    this.money = 0;
    this.driving = false;
    this.car = null; // Car instance when driving
    this.walkPhase = 0;
    this.moving = false;
  }
  get speed2d() {
    return this.driving && this.car ? Math.abs(this.car.speed) : 0;
  }
  stepOnFoot(input, dt, colliders) {
    const run = input.run ? GAME.RUN_SPEED : GAME.WALK_SPEED;
    let fx = 0;
    let fz = 0;
    const sin = Math.sin(this.camYaw);
    const cos = Math.cos(this.camYaw);
    if (input.up) { fx += sin; fz += cos; }
    if (input.down) { fx -= sin; fz -= cos; }
    if (input.left) { fx += cos; fz -= sin; }
    if (input.right) { fx -= cos; fz += sin; }
    const len = Math.hypot(fx, fz);
    this.moving = len > 0;
    if (len > 0) {
      fx /= len;
      fz /= len;
      this.x += fx * run * dt;
      this.z += fz * run * dt;
      this.heading = Math.atan2(fx, fz);
      this.walkPhase += dt * (input.run ? 12 : 8);
    }
    this.x = clamp(this.x, -145, 145);
    this.z = clamp(this.z, -145, 205);
    const p = { x: this.x, z: this.z };
    for (const b of colliders) resolveCircleAABB(p, 0.6, b);
    this.x = p.x;
    this.z = p.z;
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    const swing = this.moving ? Math.sin(this.walkPhase) * 0.55 : 0;
    this.mesh.userData.legL.rotation.x = swing;
    this.mesh.userData.legR.rotation.x = -swing;
  }
  enterCar(car) {
    this.driving = true;
    this.car = car;
    this.x = car.x;
    this.z = car.z;
    this.mesh.visible = false;
  }
  exitCar() {
    if (!this.car) return;
    this.driving = false;
    // Step out to the side of the car.
    const side = Math.cos(this.car.heading);
    const sideX = Math.sin(this.car.heading);
    this.x = this.car.x + sideX * 2.2;
    this.z = this.car.z - side * 2.2;
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.visible = true;
    this.car.speed = 0;
    this.car = null;
  }
  syncFromCar() {
    if (this.driving && this.car) {
      this.x = this.car.x;
      this.z = this.car.z;
    }
  }
  takeDamage(n) {
    this.health = clamp(this.health - n, 0, GAME.PLAYER_HEALTH);
    return this.health <= 0;
  }
  heal(n) {
    this.health = clamp(this.health + n, 0, GAME.PLAYER_HEALTH);
  }
}
