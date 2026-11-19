// SOLARA CITY — missions.js
// Four distinct missions, each with its own mechanic:
//  1. Paket Kilat — pick up a package, deliver it. +$300
//  2. Kabur dari Kejaran — reach the hideout before the timer ends
//     while police chase at wanted 1-2. +$500
//  3. Bertahan di Wanted 3 — survive the countdown at wanted 3,
//     aggressive police. +$800
//  4. Coupe Emas — steal the guarded gold coupe, deliver it without
//     getting busted (busted = mission failed, retry). +$1500
// Total $3,100 = SOLARA LEGEND.

import {
  MISSION_NAMES, MISSION_REWARDS,
  addCash, setWanted, showBanner, showToast, saveGame,
} from './state.js';
import { randomRoadPoint } from './world.js';

function rand() {
  return Math.random();
}

export function missionTitle(index) {
  return MISSION_NAMES[index] || 'Selesai';
}

export function startMission(state, index) {
  const m = { index, phase: 'active', timer: 0, elapsed: 0, target: null, pickup: null };
  if (index === 0) {
    m.pickup = randomRoadPoint(rand, 220);
    m.target = null;
    m.phase = 'pickup';
    showToast(state, 'Misi 1 — Ambil paket di penanda kuning!');
  } else if (index === 1) {
    m.target = randomRoadPoint(rand, 220);
    m.timer = 75;
    setWanted(state, 1);
    showToast(state, 'Misi 2 — Kabur ke tempat aman sebelum waktu habis!');
  } else if (index === 2) {
    m.timer = 45;
    setWanted(state, 3);
    showToast(state, 'Misi 3 — Bertahan 45 detik di Wanted 3!');
  } else if (index === 3) {
    // Gold coupe parked on the north-docks road (road centre, always clear).
    const gx = 2 * 400 + 48;
    const gy = 480 + rand() * 160;
    state.goldCoupe = { x: gx, y: gy, stolen: false, delivered: false };
    m.target = { x: 3248, y: 2048 };
    setWanted(state, 2);
    showToast(state, 'Misi 4 — Curi coupe emas, antar ke penanda ungu!');
  }
  state.mission = m;
  return m;
}

export function currentObjective(state) {
  const m = state.mission;
  if (!m) return null;
  if (m.index === 0) {
    return m.phase === 'pickup'
      ? { x: m.pickup.x, y: m.pickup.y, label: 'Ambil paket', color: '#f7c948' }
      : { x: m.target.x, y: m.target.y, label: 'Antar paket', color: '#2ecc71' };
  }
  if (m.index === 1) {
    return { x: m.target.x, y: m.target.y, label: 'Tempat aman', color: '#2ecc71' };
  }
  if (m.index === 2) {
    return { x: state.player.x, y: state.player.y, label: 'Bertahan!', color: '#e74c3c' };
  }
  if (m.index === 3) {
    if (!state.goldCoupe || !state.goldCoupe.stolen) {
      return { x: state.goldCoupe.x, y: state.goldCoupe.y, label: 'Coupe emas', color: '#ffd700' };
    }
    return { x: m.target.x, y: m.target.y, label: 'Antar coupe emas', color: '#9b59b6' };
  }
  return null;
}

function playerPos(state) {
  if (state.player.inCar && state.car) return { x: state.car.x, y: state.car.y };
  return { x: state.player.x, y: state.player.y };
}

function distTo(state, p) {
  const pos = playerPos(state);
  return Math.hypot(pos.x - p.x, pos.y - p.y);
}

export function completeMission(state, audio) {
  const idx = state.missionIndex;
  const reward = MISSION_REWARDS[idx];
  state.stats.missionsDone += 1;
  state.mission = null;
  state.toast = null; // the old objective toast no longer applies
  state.missionIndex = idx + 1;
  if (audio) audio.cash();
  addCash(state, reward, `${missionTitle(idx)} selesai!`);
  if (state.mode !== 'legend') {
    // Wanted eases one step after each completed job.
    setWanted(state, Math.max(0, state.wanted - 1));
  }
  saveGame(state);
}

export function failMission(state, reason) {
  const idx = state.missionIndex;
  state.mission = null;
  showBanner(state, 'MISI GAGAL', reason || `${missionTitle(idx)} gagal — coba lagi`, 3);
  showToast(state, `Tekan M untuk mengulang ${missionTitle(idx)}`);
}

export function updateMission(state, dt, audio) {
  const m = state.mission;
  if (!m || state.mode !== 'playing') return;
  m.elapsed += dt;

  if (m.index === 0) {
    if (m.phase === 'pickup') {
      if (distTo(state, m.pickup) < 64) {
        m.phase = 'deliver';
        m.target = randomRoadPoint(rand, 220);
        if (audio) audio.pickup();
        showToast(state, 'Paket diambil! Antar ke penanda hijau.');
      }
    } else if (distTo(state, m.target) < 70) {
      completeMission(state, audio);
    }
    return;
  }

  if (m.index === 1) {
    m.timer -= dt;
    // Heat rises halfway through the escape.
    if (m.timer < 40 && state.wanted < 2) setWanted(state, 2);
    if (distTo(state, m.target) < 80) {
      completeMission(state, audio);
      return;
    }
    if (m.timer <= 0) {
      failMission(state, 'Waktu habis — polisi mengepungmu.');
    }
    return;
  }

  if (m.index === 2) {
    m.timer -= dt;
    if (m.timer <= 0) {
      completeMission(state, audio);
    }
    return;
  }

  if (m.index === 3) {
    const gc = state.goldCoupe;
    if (gc && !gc.stolen) {
      if (distTo(state, gc) < 60) {
        // Steal happens on E near the coupe; the main loop sets stolen.
      }
    } else if (gc && gc.stolen && !gc.delivered) {
      if (distTo(state, m.target) < 90) {
        gc.delivered = true;
        completeMission(state, audio);
      }
    }
  }
}

// Called by the main loop when the player presses E near the gold coupe.
export function tryStealGoldCoupe(state) {
  const gc = state.goldCoupe;
  if (!gc || gc.stolen) return false;
  const pos = playerPos(state);
  if (Math.hypot(pos.x - gc.x, pos.y - gc.y) > 80) return false;
  gc.stolen = true;
  setWanted(state, 3);
  showToast(state, 'Coupe emas dicuri! Wanted 3 — kabur ke penanda ungu!');
  return true;
}
