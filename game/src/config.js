// SOLARA CITY v3 — config: all tuning in one place, written fresh for round 3.
// Top-down open-world crime game. Night city, 2D canvas, no external assets.

export const WORLD = {
  size: 3600,          // world is size x size px
  roadGap: 450,        // distance between road centre lines
  roadWidth: 116,
  blockPad: 26,        // sidewalk margin inside a block
};

export const SAVE_KEY = 'solara-city-save-v3';

export const PLAYER = {
  walkSpeed: 185,
  accel: 430,          // car acceleration px/s^2
  brake: 700,
  reverseMax: 190,
  maxSpeed: 540,       // regular car
  goldMaxSpeed: 640,   // gold coupe
  turnRate: 2.9,       // rad/s at full steer (scaled by speed)
  health: 100,
  radius: 15,
};

export const MISSIONS = [
  {
    id: 1, name: 'Paket Pertama', reward: 300,
    kind: 'deliver',
    brief: 'Ambil paket di titik kuning, antar ke titik hijau.',
  },
  {
    id: 2, name: 'Kabur dari Polisi', reward: 500,
    kind: 'escape',
    brief: 'Capai titik hijau sebelum timer habis. Polisi mengejarmu!',
    timeLimit: 90, wanted: 2,
  },
  {
    id: 3, name: 'Bertahan Hidup', reward: 800,
    kind: 'survive',
    brief: 'Bertahan 45 detik di wanted level 3. Jangan mati, jangan ketangkap!',
    timeLimit: 45, wanted: 3,
  },
  {
    id: 4, name: 'Coupe Emas', reward: 1500,
    kind: 'gold',
    brief: 'Curi coupe emas dari tempat terjaga, bawa ke titik hijau. Ketangkap = gagal!',
    wanted: 3,
  },
];

export const LEGEND_CASH = 3100; // 300 + 500 + 800 + 1500

export const WANTED_COLORS = {
  0: '#9aa5b1',
  1: '#ffd23f', // yellow
  2: '#ff8c1a', // orange
  3: '#ff3b30', // red
};

export const COLORS = {
  night: '#0a0e1e',
  asphalt: '#232838',
  asphaltLine: '#3a4157',
  roadMark: '#d8c95a',
  sidewalk: '#2e3448',
  grass: '#14301f',
  grassDark: '#0f2417',
  buildingRoof: '#39415e',
  buildingRoof2: '#2c3350',
  buildingRoof3: '#4a3f5e',
  windowLit: '#ffd97a',
  windowDark: '#1a2033',
  parkPath: '#3a2f22',
  gold: '#f5c542',
  policeBlue: '#3b82f6',
  policeRed: '#ef4444',
};

export const KEYS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  steal: ['KeyE'],
  shoot: ['Space'],
  pause: ['KeyP', 'Escape'],
  start: ['Enter'],
  restart: ['KeyR'],
};
