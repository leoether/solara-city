// SOLARA CITY — missions 1-4 (fresh build v5). Each mission is a different
// shape: delivery, timed escape, survival, and a guarded gold-coupe heist.
// Rewards: 300 / 500 / 800 / 1500 = 3100 total -> SOLARA LEGEND.

import {
  MISSION_REWARDS, LEGEND_TOTAL, SAVE_KEY, GOLD_COLOR,
  dist, clamp, mulberry32,
} from './state.js';
import { randomRoadPoint } from './world.js';
import { spawnGoldCoupe } from './vehicles.js';

const rng = mulberry32(909090);

export const MISSION_DEFS = [
  { name: 'MISI 1 — KURIR PAKET', desc: 'Ambil paket, antar ke titik hijau. +$300' },
  { name: 'MISI 2 — KABUR!', desc: 'Capai titik hijau sebelum timer habis, polisi mengejar. +$500' },
  { name: 'MISI 3 — BERTAHAN', desc: 'Bertahan 30 detik di wanted 3. Jangan tertangkap! +$800' },
  { name: 'MISI 4 — COUPE EMAS', desc: 'Curi coupe emas yang dijaga, bawa ke titik hijau. +$1500' },
];

export function startMission(S, city, idx) {
  const def = MISSION_DEFS[idx];
  if (!def) return;
  const m = { kind: idx, stage: 0, timer: 0, name: def.name, desc: def.desc };
  if (idx === 0) {
    const p = randomRoadPoint(rng);
    const d = randomRoadPoint(rng);
    S.packagePos = p;
    S.destPos = d;
    m.targetX = p.x; m.targetY = p.y;
    m.pickupDone = false;
  } else if (idx === 1) {
    const d = randomRoadPoint(rng);
    S.destPos = d;
    m.targetX = d.x; m.targetY = d.y;
    m.timer = 45;
    S.wanted = Math.max(S.wanted, 2);
  } else if (idx === 2) {
    m.timer = 30;
    S.surviveT = 0;
    S.wanted = 3;
  } else if (idx === 3) {
    const coupe = spawnGoldCoupe(S, city);
    const d = randomRoadPoint(rng);
    S.destPos = d;
    m.targetX = coupe.x; m.targetY = coupe.y;
    m.goldX = coupe.x; m.goldY = coupe.y;
    m.stolen = false;
    S.wanted = 2;
  }
  S.mission = m;
  S.missionIndex = idx;
  S.missionMsg = def.name + ' — ' + def.desc;
  S.banner = def.name;
  S.bannerT = 2.6;
}

export function saveGame(S) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: S.cash, earned: S.earned, missionIndex: S.missionIndex,
      legend: S.missionIndex >= 4, time: Date.now(),
    }));
  } catch (e) { /* storage unavailable in some embeds */ }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

export function completeMission(S, city, audio) {
  const idx = S.missionIndex;
  const reward = MISSION_REWARDS[idx] || 0;
  S.cash += reward;
  S.earned += reward;
  S.banner = 'MISI SELESAI! +$' + reward;
  S.bannerT = 3;
  S.floats.push({
    x: S.player.x, y: S.player.y - 40, text: '+$' + reward,
    life: 2, maxLife: 2, color: '#2ecc71', size: 30,
  });
  if (audio) audio.cash();
  S.mission = null;
  S.packagePos = null;
  S.destPos = null;
  S.missionIndex = idx + 1;
  // Wanted climbs with progress.
  S.wanted = clamp(S.missionIndex, 0, 3);
  if (S.missionIndex >= 4) {
    S.mode = 'legend';
    S.legendShown = true;
    if (audio) audio.legend();
    saveGame(S);
    return 'legend';
  }
  saveGame(S);
  startMission(S, city, S.missionIndex);
  return 'next';
}

export function failMission(S, city, reason) {
  S.banner = 'MISI GAGAL: ' + reason + ' — coba lagi!';
  S.bannerT = 3;
  S.mission = null;
  S.packagePos = null;
  S.destPos = null;
  // Restart the same mission after a short beat.
  startMission(S, city, S.missionIndex);
}

export function updateMission(S, dt, city, audio) {
  const m = S.mission;
  if (!m || S.mode !== 'playing') return;
  const p = S.player;
  if (m.kind === 0) {
    if (!m.pickupDone) {
      if (S.packagePos && dist(p.x, p.y, S.packagePos.x, S.packagePos.y) < 46) {
        m.pickupDone = true;
        m.targetX = S.destPos.x; m.targetY = S.destPos.y;
        S.banner = 'PAKET DIDAPAT! ANTAR KE TITIK HIJAU';
        S.bannerT = 2;
        if (audio) audio.pickup();
      }
    } else if (dist(p.x, p.y, S.destPos.x, S.destPos.y) < 52) {
      completeMission(S, city, audio);
    }
  } else if (m.kind === 1) {
    m.timer -= dt;
    if (dist(p.x, p.y, S.destPos.x, S.destPos.y) < 52) {
      completeMission(S, city, audio);
    } else if (m.timer <= 0) {
      failMission(S, city, 'WAKTU HABIS');
    }
  } else if (m.kind === 2) {
    m.timer -= dt;
    S.surviveT += dt;
    if (m.timer <= 0) {
      completeMission(S, city, audio);
    }
  } else if (m.kind === 3) {
    if (!m.stolen) {
      const coupe = S.goldCoupe;
      if (coupe && p.car === coupe) {
        m.stolen = true;
        m.targetX = S.destPos.x; m.targetY = S.destPos.y;
        S.banner = 'COUPE EMAS DIDAPAT! BAWA KE TITIK HIJAU — JANGAN KETANGKAP';
        S.bannerT = 2.6;
        S.wanted = 3;
        if (audio) audio.pickup();
      }
    } else if (dist(p.x, p.y, S.destPos.x, S.destPos.y) < 52) {
      completeMission(S, city, audio);
    }
  }
}

// Busted during the gold heist fails the mission (other missions survive).
export function onBusted(S, city) {
  const fine = Math.min(S.cash, 50);
  S.cash -= fine;
  if (S.mission && S.mission.kind === 3 && S.mission.stolen) {
    // Gold coupe is recovered by the guards: reset the heist.
    if (S.goldCoupe) {
      S.cars = S.cars.filter(c => c !== S.goldCoupe);
      S.goldCoupe = null;
    }
    S.mission = null;
    S.packagePos = null; S.destPos = null;
    startMission(S, city, 3);
  }
  S.wanted = 0;
  S.cops.length = 0;
}

export { LEGEND_TOTAL, GOLD_COLOR };
