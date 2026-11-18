// shots.js — deterministic screenshot scenes (?shot=<name>&seed=1).
// Each scene stages the real game state (real traffic, real police, real HUD) and steps the
// world forward a fixed number of steps, so the same seed always gives the same frame.
import { Car } from './vehicles.js';
import { clamp } from './config.js';

export const SHOT_NAMES = ['cover', 'street', 'police', 'mission'];

function stepWorld(game, steps) {
  const dt = 1 / 60;
  for (let i = 0; i < steps; i += 1) {
    game.traffic.step(dt, game.world.colliders);
    game.peds.step(dt, { x: game.player.x, z: game.player.z, radius: 10, active: false });
    game.police.step(dt, game.player, game.world.colliders);
    game.combat.step(dt);
  }
}

export function stageShot(name, game) {
  const g = game;
  g.resetWorld(1);
  const p = g.player;
  if (name === 'cover') {
    // 1-cover: high-speed chase down the main avenue — wanted 3, mission 2 live, minimap on.
    g.missions.index = 1;
    g.missions.pickedUp = true;
    g.missions.timer = 62;
    g.missions.toast = '';
    g.missions.toastTime = 0;
    g.police.setWanted(3);
    const car = new Car(g.render.scene, -40, 0, Math.PI / 2, 0xd64545);
    car.speed = 22;
    g.ownedCars.push(car);
    p.enterCar(car);
    p.camYaw = Math.PI / 2;
    g.player.money = 800;
    // police cars in pursuit: two interceptors ahead (visible, head-on) + one behind.
    // spawnedFar must be cleared or the first police.step teleports them away.
    const spots = [[-18, -3.5], [-8, 4], [-72, 0]];
    g.police.cars.forEach((pc, i) => {
      const [sx, sz] = spots[i] || [-70, 0];
      pc.setPos(sx, sz, i < 2 ? -Math.PI / 2 : Math.PI / 2);
      pc.speed = 19;
      pc.spawnedFar = false;
    });
    g.render.smoothYaw = Math.PI / 2;
    g.render.smoothPitch = 0.24;
    stepWorld(g, 40);
    p.car.speed = 22;
    g.render.follow(p, 1, true);
  } else if (name === 'street') {
    // 2-street: Rico on foot at the plaza intersection, traffic + pedestrians around.
    g.missions.index = 0;
    g.missions.toast = '';
    g.missions.toastTime = 0;
    g.police.setWanted(0);
    p.x = 6;
    p.z = 6;
    p.heading = Math.PI * 0.75;
    p.camYaw = Math.PI * 0.75;
    p.camPitch = 0.3;
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.rotation.y = p.heading;
    g.player.money = 300;
    // a couple of traffic cars passing the intersection
    g.traffic.cars[0].setPos(-30, 0, Math.PI / 2);
    g.traffic.cars[0].speed = 8;
    g.traffic.cars[1].setPos(30, 0, -Math.PI / 2);
    g.traffic.cars[1].speed = 8;
    stepWorld(g, 50);
    g.render.follow(p, 1, true);
  } else if (name === 'police') {
    // 3-police: wanted 4, Rico shooting back as cops close in.
    g.missions.index = 2;
    g.missions.surviveLeft = 28;
    g.missions.toast = 'Lose the heat — reach the safehouse!';
    g.missions.toastTime = 6;
    g.police.setWanted(4);
    p.x = -10;
    p.z = -20;
    p.heading = Math.PI / 4;
    p.camYaw = Math.PI / 4;
    p.camPitch = 0.3;
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.rotation.y = p.heading;
    g.player.money = 1300;
    g.player.health = 62;
    g.police.cars.forEach((pc, i) => {
      pc.setPos(-26 + i * 12, -34 + i * 6, Math.PI / 4);
      pc.speed = 6;
      pc.spawnedFar = false;
    });
    // one police car visible ahead, closing in on Rico
    if (g.police.cars[0]) {
      g.police.cars[0].setPos(-2, -12, -2.36);
      g.police.cars[0].speed = 5;
      g.police.cars[0].spawnedFar = false;
    }
    g.police.cops.forEach((cop, i) => {
      cop.mesh.position.set(-16 + i * 5, 0, -28 + i * 3);
      cop.placed = true;
    });
    stepWorld(g, 30);
    // muzzle flash mid-shot
    g.combat.flash.position.set(p.x + 1.2, 1.25, p.z + 1.2);
    g.combat.flash.visible = true;
    g.combat.flashTime = 10;
    g.combat.light.position.set(p.x + 1.2, 1.4, p.z + 1.2);
    g.combat.light.intensity = 2.2;
    g.render.follow(p, 1, true);
  } else {
    // 4-mission: the gold coupe delivered — all jobs done, SOLARA LEGEND.
    g.missions.index = 4;
    g.missions.done = true;
    g.missions.toast = 'JOB DONE: THE GOLDEN RIDE — +$1,500';
    g.missions.toastTime = 10;
    g.police.setWanted(1);
    const gold = g.spawnGoldCar(60, 60);
    gold.setPos(-52, -120, Math.PI / 2);
    gold.speed = 0;
    g.ownedCars.push(gold);
    p.enterCar(gold);
    p.camYaw = Math.PI / 2;
    g.player.money = 2800;
    g.updateBeacon();
    stepWorld(g, 40);
    g.render.follow(p, 1, true);
  }
  g.hud.update(g);
  g.render.draw();
}
