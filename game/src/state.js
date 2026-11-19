// SOLARA CITY — state.js
// Single source of truth for game state: cash, wanted level, missions,
// player/vehicle status, save/load. No rendering, no input here.

export const SAVE_KEY = 'solara-city-save-v6';
export const LEGEND_CASH = 3100;
export const MISSION_REWARDS = [300, 500, 800, 1500];
export const MISSION_NAMES = [
  'Paket Kilat',
  'Kabur dari Kejaran',
  'Bertahan di Wanted 3',
  'Coupe Emas',
];
export const WORLD_W = 3600;
export const WORLD_H = 2600;

export function createState() {
  return {
    mode: 'boot', // boot | playing | paused | busted | wasted | legend
    time: 0,
    cash: 0,
    wanted: 0,
    health: 100,
    legend: false,
    missionIndex: 0, // 0..3 active, 4 = all done
    mission: null, // active mission runtime object (see missions.js)
    banner: null, // { title, sub, until }
    toast: null, // { text, until }
    shake: 0,
    stats: { steals: 0, shots: 0, hits: 0, crashes: 0, missionsDone: 0 },
    player: {
      x: 1648, y: 1300, angle: -Math.PI / 2, speed: 0,
      onFoot: true, inCar: false, carId: null,
      walkSpeed: 230, radius: 14,
    },
    car: null, // active driven car { id, x, y, angle, speed, color, kind, gold }
    cars: [], // parked + traffic cars
    cops: [],
    peds: [],
    bullets: [],
    enemyBullets: [],
    particles: [],
    skids: [],
    pickups: [],
    goldCoupe: null, // { x, y, stolen, delivered }
    bustedTimer: 0,
    wastedTimer: 0,
    pausedFrom: null,
    muted: false,
    startedAt: 0,
  };
}

export function missionReward(index) {
  return MISSION_REWARDS[index] || 0;
}

export function totalCashForLegend() {
  return LEGEND_CASH;
}

export function saveGame(state) {
  try {
    const data = {
      v: 6,
      cash: state.cash,
      missionIndex: state.missionIndex,
      legend: state.legend,
      health: state.health,
      wanted: state.wanted,
      savedAt: Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.v !== 6) return null;
    return data;
  } catch (err) {
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (err) {
    /* storage unavailable */
  }
}

export function applySave(state, data) {
  state.cash = data.cash || 0;
  state.missionIndex = data.missionIndex || 0;
  state.legend = !!data.legend;
  state.health = data.health || 100;
  state.wanted = data.wanted || 0;
}

export function showBanner(state, title, sub, seconds = 3) {
  state.banner = { title, sub: sub || '', until: state.time + seconds };
}

export function showToast(state, text, seconds = 2.5) {
  state.toast = { text, until: state.time + seconds };
}

export function addCash(state, amount, reason) {
  state.cash += amount;
  showBanner(
    state,
    `+$${amount.toLocaleString('en-US')}`,
    reason || 'Misi selesai',
    3.2,
  );
  if (state.cash >= LEGEND_CASH && !state.legend) {
    state.legend = true;
    state.mode = 'legend';
    saveGame(state);
  }
}

export function addShake(state, amount) {
  state.shake = Math.min(26, state.shake + amount);
}

export function setWanted(state, level) {
  state.wanted = Math.max(0, Math.min(3, level));
  // A wanted change invalidates the previous steal/heat toast.
  state.toast = null;
}
