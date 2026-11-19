// SOLARA CITY — missions.js
// Rantai misi 1-4: tiap misi punya fase (idle -> ke pickup -> ke drop ->
// selesai), timer untuk misi 2, survival untuk misi 3, dan coupe emas
// untuk misi 4. Mengembalikan event agar main.js bisa memberi reward,
// suara, dan save.

import { MISSIONS, ECONOMY } from './config.js';
import { dist } from './random.js';

export function createMissionState() {
  return {
    index: 0,            // misi aktif (0..3); 4 = semua selesai
    phase: 'idle',       // idle | toPickup | toDrop | survive | done
    hasPackage: false,
    timer: 0,            // misi 2: detik tersisa
    surviveLeft: 0,      // misi 3: detik tersisa
    goldStolen: false,   // misi 4
    failed: false,
    banner: null,        // {text, sub, t} untuk HUD
    bannerT: 0,
  };
}

export function currentMission(ms) {
  return MISSIONS[ms.index] || null;
}

export function missionTarget(ms) {
  const m = currentMission(ms);
  if (!m) return null;
  if (ms.phase === 'toPickup') return { ...m.pickup, kind: 'pickup' };
  if (ms.phase === 'toDrop') return { ...m.drop, kind: 'drop' };
  if (ms.phase === 'survive') return null;
  return null;
}

export function startMission(ms, audio) {
  const m = currentMission(ms);
  if (!m) return;
  ms.failed = false;
  ms.hasPackage = false;
  ms.goldStolen = false;
  if (m.id === 3) {
    ms.phase = 'survive';
    ms.surviveLeft = m.surviveSeconds;
  } else {
    ms.phase = 'toPickup';
  }
  if (m.id === 2) ms.timer = m.timeLimit;
  setBanner(ms, m.name, m.intro);
  if (audio) audio.pickup();
}

export function setBanner(ms, text, sub) {
  ms.banner = { text, sub: sub || '' };
  ms.bannerT = 4.2;
}

// Dipanggil tiap frame saat bermain. player = {x, y, inCar, car}.
// events: onReward(mission, amount), onFail(reason), onWanted(level).
export function stepMissions(ms, player, dt, hooks) {
  const m = currentMission(ms);
  if (!m) return;
  if (ms.bannerT > 0) ms.bannerT -= dt;
  const px = player.x, py = player.y;

  if (ms.phase === 'toPickup' && m.pickup) {
    if (dist(px, py, m.pickup.x, m.pickup.y) < 64) {
      if (m.id === 4) {
        // Coupe emas: harus naik mobil emasnya.
        if (player.inCar && player.car && player.car.gold) {
          ms.goldStolen = true;
          ms.hasPackage = true;
          ms.phase = 'toDrop';
          setBanner(ms, 'COUPE EMAS DICURI!', 'Bawa ke penanda hijau. Jangan tertangkap!');
          if (hooks.audio) hooks.audio.pickup();
        } else {
          setBanner(ms, 'Itu coupe emasnya!', 'Tekan E di samping mobil emas untuk mencurinya.');
        }
      } else {
        ms.hasPackage = true;
        ms.phase = 'toDrop';
        setBanner(ms, 'Paket diambil', 'Antar ke penanda hijau.');
        if (hooks.audio) hooks.audio.pickup();
      }
    }
  } else if (ms.phase === 'toDrop' && m.drop) {
    if (dist(px, py, m.drop.x, m.drop.y) < 70) {
      completeMission(ms, hooks);
    }
  } else if (ms.phase === 'survive') {
    ms.surviveLeft -= dt;
    if (ms.surviveLeft <= 0) completeMission(ms, hooks);
  }

  if (m.id === 2 && (ms.phase === 'toPickup' || ms.phase === 'toDrop')) {
    ms.timer -= dt;
    if (ms.timer <= 0) {
      ms.failed = true;
      ms.phase = 'idle';
      if (hooks.onFail) hooks.onFail('Waktu habis — misi 2 gagal.');
    }
  }
}

function completeMission(ms, hooks) {
  const m = currentMission(ms);
  if (!m) return;
  ms.phase = 'done';
  ms.index += 1;
  if (hooks.onReward) hooks.onReward(m, m.reward);
  if (ms.index >= MISSIONS.length) {
    setBanner(ms, 'SOLARA LEGEND', 'Kamu menguasai kota. Total $3.100!');
    if (hooks.onLegend) hooks.onLegend();
  } else {
    const next = MISSIONS[ms.index];
    setBanner(ms, 'MISI SELESAI  +$' + m.reward, 'Misi berikutnya: ' + next.name + ' — tekan M untuk mulai.');
    ms.phase = 'idle';
  }
  if (hooks.audio) hooks.audio.cash();
}

// Wanted level mengikuti progres: curi mobil = 1, misi 2 = 2, misi 3/4 = 3.
export function wantedFor(ms, stoleCar) {
  if (ms.index >= 2) return 3;
  if (ms.index === 1) return 2;
  if (stoleCar) return 1;
  return 0;
}
