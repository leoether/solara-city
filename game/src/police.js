// police.js — wanted level, police car + foot-cop pursuit, busted/wasted rules.
import { clamp } from './config.js';
import { Car } from './vehicles.js';
import { makePedMesh } from './pedestrians.js';
import { CITY } from './config.js';

export class Police {
  constructor(scene) {
    this.scene = scene;
    this.wanted = 0;
    this.cars = [];
    this.cops = [];
    this.bustedTimer = 0;
    this.quietTime = 0; // seconds without crime and without police near
    this.flash = 0;
    this.spawnCooldown = 0;
  }
  addWanted(n) {
    this.wanted = clamp(this.wanted + n, 0, 5);
    this.quietTime = 0;
    this.syncUnits();
  }
  setWanted(n) {
    this.wanted = clamp(n, 0, 5);
    this.quietTime = 0;
    this.syncUnits();
  }
  clearWanted() {
    this.wanted = 0;
    this.quietTime = 0;
    this.syncUnits();
  }
  syncUnits() {
    const wantCars = Math.min(this.wanted, 4);
    const wantCops = Math.min(Math.floor(this.wanted / 2) + (this.wanted >= 3 ? 1 : 0), 4);
    while (this.cars.length < wantCars) {
      const c = new Car(this.scene, 0, 0, 0, 0xffffff, true);
      c.speed = 0;
      c.spawnedFar = true;
      this.cars.push(c);
    }
    while (this.cars.length > wantCars) this.cars.pop().remove(this.scene);
    while (this.cops.length < wantCops) {
      const mesh = makePedMesh(0x1f3a93, 0xe0ac69, true);
      this.scene.add(mesh);
      this.cops.push({ mesh, speed: 3.4 + this.wanted * 0.25, phase: Math.random() * 6 });
    }
    while (this.cops.length > wantCops) this.scene.remove(this.cops.pop().mesh);
  }
  /** Spawn a unit on a road near (x,z) but not on top of the player. */
  placeNear(unit, px, pz, dist) {
    const road = CITY.ROADS[Math.floor(Math.random() * CITY.ROADS.length)];
    const along = px + (Math.random() < 0.5 ? -1 : 1) * dist;
    if (unit.mesh) {
      unit.mesh.position.set(Math.max(-125, Math.min(125, along)), 0, road);
    } else {
      unit.setPos(Math.max(-125, Math.min(125, along)), road, 0);
    }
  }
  step(dt, player, colliders) {
    this.flash += dt;
    const px = player.x;
    const pz = player.z;
    // light bar flash
    for (const car of this.cars) {
      const on = Math.floor(this.flash * 6) % 2 === 0;
      if (car.mesh.userData.lightRed) car.mesh.userData.lightRed.material.emissive.setHex(on ? 0xff0000 : 0x220000);
      if (car.mesh.userData.lightBlue) car.mesh.userData.lightBlue.material.emissive.setHex(on ? 0x0000ff : 0x000022);
    }
    // spawn freshly-added units at a distance
    for (const car of this.cars) {
      if (car.spawnedFar) {
        car.spawnedFar = false;
        this.placeNear(car, px, pz, 55 + Math.random() * 25);
      }
    }
    for (const cop of this.cops) {
      if (!cop.placed) {
        cop.placed = true;
        this.placeNear(cop, px, pz, 30 + Math.random() * 15);
      }
    }
    // pursuit: police cars chase with road-ignoring seek + building push-out
    for (const car of this.cars) {
      const dx = px - car.x;
      const dz = pz - car.z;
      const d = Math.hypot(dx, dz) || 1;
      const wantHeading = Math.atan2(dx, dz);
      let dh = wantHeading - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      car.heading += clamp(dh, -2.4 * dt, 2.4 * dt);
      car.speed = clamp(car.speed + (16 - car.speed) * dt * 0.7, 0, 17);
      car.mesh.rotation.y = car.heading;
      car.mesh.position.x += Math.sin(car.heading) * car.speed * dt;
      car.mesh.position.z += Math.cos(car.heading) * car.speed * dt;
      for (const b of colliders) {
        const p = { x: car.x, z: car.z };
        if (p.x > b.minX - 1.5 && p.x < b.maxX + 1.5 && p.z > b.minZ - 1.5 && p.z < b.maxZ + 1.5) {
          car.mesh.position.x -= Math.sin(car.heading) * car.speed * dt * 2;
          car.mesh.position.z -= Math.cos(car.heading) * car.speed * dt * 2;
          car.heading += 0.9;
        }
      }
      // stuck? teleport back onto a road near the player
      const moved = Math.hypot(car.x - car.lastX, car.z - car.lastZ);
      if (moved < 0.4) car.stuckTime += dt;
      else car.stuckTime = 0;
      car.lastX = car.x;
      car.lastZ = car.z;
      if (car.stuckTime > 3) {
        car.stuckTime = 0;
        this.placeNear(car, px, pz, 45);
        car.speed = 8;
      }
      // ramming the player's car slows it; touching the player on foot busts
      if (!player.driving && d < 2.2) {
        this.bustedTimer += dt;
      }
    }
    // foot cops chase the player on foot
    for (const cop of this.cops) {
      const dx = px - cop.mesh.position.x;
      const dz = pz - cop.mesh.position.z;
      const d = Math.hypot(dx, dz) || 1;
      const sp = cop.speed;
      cop.mesh.position.x += (dx / d) * sp * dt;
      cop.mesh.position.z += (dz / d) * sp * dt;
      cop.mesh.rotation.y = Math.atan2(dx, dz);
      cop.phase += dt * 9;
      const swing = Math.sin(cop.phase) * 0.5;
      cop.mesh.userData.legL.rotation.x = swing;
      cop.mesh.userData.legR.rotation.x = -swing;
      if (!player.driving && d < 1.8) this.bustedTimer += dt;
    }
    if (player.driving || this.nearestPoliceDist(player) > 3) {
      if (this.bustedTimer > 0) this.bustedTimer = Math.max(0, this.bustedTimer - dt * 2);
    }
    // wanted decay when quiet and unseen
    if (this.wanted > 0) {
      const near = this.nearestPoliceDist(player);
      if (near > 55) {
        this.quietTime += dt;
        if (this.quietTime > 12) {
          this.quietTime = 0;
          this.addWanted(-1);
        }
      } else {
        this.quietTime = 0;
      }
    }
  }
  nearestPoliceDist(player) {
    let best = 1e9;
    for (const car of this.cars) best = Math.min(best, Math.hypot(car.x - player.x, car.z - player.z));
    for (const cop of this.cops) best = Math.min(best, Math.hypot(cop.mesh.position.x - player.x, cop.mesh.position.z - player.z));
    return best;
  }
  get busted() {
    return this.bustedTimer > 1.5;
  }
  resetBusted() {
    this.bustedTimer = 0;
  }
}
