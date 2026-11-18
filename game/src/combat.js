// combat.js — hitscan shooting on foot, melee up close, muzzle flash + hit sparks.
export class Combat {
  constructor(scene) {
    this.scene = scene;
    this.cooldown = 0;
    this.flash = null;
    this.flashTime = 0;
    const geo = new THREE.SphereGeometry(0.22, 8, 6);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffe27a });
    this.flash = new THREE.Mesh(geo, mat);
    this.flash.visible = false;
    scene.add(this.flash);
    this.light = new THREE.PointLight(0xffd27a, 0, 12);
    scene.add(this.light);
    this.tracer = null;
  }
  step(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.flashTime = Math.max(0, this.flashTime - dt);
    if (this.flashTime <= 0) {
      this.flash.visible = false;
      this.light.intensity = 0;
    }
  }
  /** Shoot from the player toward aim point (world x,z at y~1.2). Returns what was hit. */
  shoot(player, aimX, aimZ, targets) {
    if (this.cooldown > 0) return null;
    this.cooldown = 0.28;
    const ox = player.x;
    const oz = player.z;
    const dx = aimX - ox;
    const dz = aimZ - oz;
    const len = Math.hypot(dx, dz) || 1;
    const nx = dx / len;
    const nz = dz / len;
    // muzzle flash at the gun
    const mx = ox + nx * 1.1;
    const mz = oz + nz * 1.1;
    this.flash.position.set(mx, 1.25, mz);
    this.flash.visible = true;
    this.flashTime = 0.07;
    this.light.position.set(mx, 1.4, mz);
    this.light.intensity = 2.2;
    // nearest target within a narrow cone along the shot
    let best = null;
    let bestD = 60;
    for (const t of targets) {
      const tx = t.x - ox;
      const tz = t.z - oz;
      const along = tx * nx + tz * nz;
      if (along < 0.5 || along > 60) continue;
      const perp = Math.abs(tx * nz - tz * nx);
      if (perp > 1.6) continue;
      if (along < bestD) {
        bestD = along;
        best = t;
      }
    }
    return { hit: best, dist: bestD, from: { x: mx, z: mz }, dir: { x: nx, z: nz } };
  }
  /** Melee punch: anything within 2.2m in front takes a hit. */
  punch(player, targets) {
    if (this.cooldown > 0) return null;
    this.cooldown = 0.4;
    const hx = Math.sin(player.heading);
    const hz = Math.cos(player.heading);
    let best = null;
    let bestD = 2.4;
    for (const t of targets) {
      const dx = t.x - player.x;
      const dz = t.z - player.z;
      const d = Math.hypot(dx, dz);
      if (d > 2.4) continue;
      if ((dx * hx + dz * hz) / (d || 1) < 0.3) continue;
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return best;
  }
}
