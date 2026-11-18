// missions.js — four chained jobs from fixer Mama Lou, with story, markers and rewards.
import { GAME } from './config.js';

export const MISSIONS = [
  {
    id: 1,
    title: 'FIRST WHEELS',
    giver: 'Mama Lou',
    brief: 'Fresh off the bus, huh? Solara runs on wheels, kid. Jack any car and bring it to my garage.',
    objective: 'Steal any car, then drive to the garage marker',
    target: { x: -60, z: -120 },
    reward: GAME.MISSION_REWARDS[0],
    needsCar: true,
  },
  {
    id: 2,
    title: 'SUNSHINE DELIVERY',
    giver: 'Mama Lou',
    brief: 'A package is waiting at the docks. The hotel on the north strip wants it in 90 seconds. No questions.',
    objective: 'Pick up the package at the docks, then deliver it to the hotel',
    pickup: { x: 120, z: 120 },
    target: { x: 0, z: -120 },
    reward: GAME.MISSION_REWARDS[1],
    timer: 90,
  },
  {
    id: 3,
    title: 'HOT PURSUIT',
    giver: 'Mama Lou',
    brief: 'The Solara PD is onto you — three stars and climbing. Survive the heat, then vanish into the safehouse.',
    objective: 'Survive 45 seconds with a 3-star wanted level, then reach the safehouse',
    target: { x: -120, z: 60 },
    reward: GAME.MISSION_REWARDS[2],
    survive: 45,
    setWanted: 3,
  },
  {
    id: 4,
    title: 'THE GOLDEN RIDE',
    giver: 'Mama Lou',
    brief: 'One last job: the gold coupe at the plaza belongs to a man who owes me. Take it. Bring it home.',
    objective: 'Steal the gold coupe and bring it to the garage',
    goldCar: { x: 60, z: 60 },
    target: { x: -60, z: -120 },
    reward: GAME.MISSION_REWARDS[3],
    needsGold: true,
  },
];

export class MissionChain {
  constructor() {
    this.index = 0; // 0-based into MISSIONS
    this.done = false;
    this.pickedUp = false;
    this.timer = 0;
    this.surviveLeft = 0;
    this.toast = '';
    this.toastTime = 0;
  }
  get current() {
    return this.done ? null : MISSIONS[this.index];
  }
  get target() {
    const m = this.current;
    if (!m) return null;
    if (m.id === 2 && !this.pickedUp) return m.pickup;
    return m.target;
  }
  startMission() {
    const m = this.current;
    if (!m) return;
    this.pickedUp = false;
    this.timer = m.timer || 0;
    this.surviveLeft = m.survive || 0;
    this.toast = `JOB ${m.id}: ${m.title} — ${m.giver}: "${m.brief}"`;
    this.toastTime = 6;
  }
  /** Called every frame; returns 'complete' | 'failed' | null. */
  step(dt, player, police) {
    if (this.toastTime > 0) this.toastTime -= dt;
    const m = this.current;
    if (!m) return null;
    if (m.timer) {
      this.timer -= dt;
      if (this.timer <= 0) return 'failed';
    }
    if (m.survive) {
      if (police.wanted >= 3) this.surviveLeft -= dt;
      if (this.surviveLeft <= 0 && this.target) {
        // survived: now just reach the safehouse
      }
    }
    const t = this.target;
    if (!t) return null;
    const d = Math.hypot(player.x - t.x, player.z - t.z);
    if (m.id === 2 && !this.pickedUp) {
      if (d < 6) {
        this.pickedUp = true;
        this.toast = 'Package secured. Deliver it to the hotel — fast!';
        this.toastTime = 4;
      }
      return null;
    }
    if (m.id === 3 && this.surviveLeft > 0) return null; // must survive first
    if (m.id === 1 && !player.driving) return null;
    if (m.id === 4 && !(player.driving && player.car && player.car.isGold)) return null;
    if (d < 7) return 'complete';
    return null;
  }
  complete(player) {
    const m = this.current;
    player.money += m.reward;
    this.toast = `JOB DONE: ${m.title} — +$${m.reward}`;
    this.toastTime = 5;
    this.index += 1;
    if (this.index >= MISSIONS.length) {
      this.done = true;
      this.toast = 'SOLARA LEGEND — all four jobs done. The city is yours, Rico.';
      this.toastTime = 8;
    } else {
      this.startMission();
    }
    return m.reward;
  }
  fail() {
    const m = this.current;
    this.toast = `JOB FAILED: ${m.title} — Mama Lou is not happy. Try again.`;
    this.toastTime = 5;
    this.startMission();
  }
}
