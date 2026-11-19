// SOLARA CITY — config.js
// Satu-satunya sumber konstanta tuning game: dunia, kendaraan, polisi, misi,
// ekonomi, dan rasa (shake, partikel, audio). Tidak ada logika di sini.

export const WORLD = {
  size: 4200,            // dunia persegi, piksel
  block: 300,            // jarak antar persimpangan jalan
  road: 96,              // lebar jalan
  sidewalk: 26,          // lebar trotoar di sisi jalan
};

export const PLAYER = {
  radius: 13,
  walkSpeed: 235,
  runSpeed: 330,
  health: 100,
  stealRange: 74,
  shootCooldown: 0.16,
  bulletSpeed: 780,
  bulletDamage: 34,
};

export const CAR = {
  length: 52,
  width: 26,
  accel: 520,
  brake: 760,
  reverseAccel: 300,
  maxSpeed: 560,
  maxReverse: 190,
  turnRate: 2.9,         // radian/detik pada kecepatan penuh
  grip: 3.4,             // seberapa cepat arah gerak mengikuti arah bodi
  crashDamage: 9,
  exhaustRate: 0.028,    // detik antar puff asap saat akselerasi
};

export const TRAFFIC = {
  count: 16,
  speed: 150,
  colors: ['#c94f4f', '#4f7ec9', '#e0c35a', '#7a7f8a', '#5ab08a', '#b06ab0', '#d8d8d8'],
};

export const PEDS = {
  count: 26,
  speed: 52,
  colors: ['#f2c14e', '#e07a5f', '#81b29a', '#f4f1de', '#9b5de5', '#00bbf9'],
};

export const WANTED = {
  // level -> { polisi aktif, kecepatan polisi, agresivitas }
  0: { cops: 0, copSpeed: 0,   aggression: 0 },
  1: { cops: 2, copSpeed: 430, aggression: 0.55 },
  2: { cops: 3, copSpeed: 480, aggression: 0.75 },
  3: { cops: 5, copSpeed: 540, aggression: 1.0 },
  max: 3,
};

export const MISSIONS = [
  {
    id: 1, name: 'Paket Panas', reward: 300,
    intro: 'Ambil paket di gudang utara, antar ke dermaga selatan.',
    pickup: { x: 2100, y: 300 }, drop: { x: 2100, y: 3900 },
  },
  {
    id: 2, name: 'Kabur dari Blokade', reward: 500, timeLimit: 75,
    intro: 'Bawa paket ke atap parkir timur sebelum timer habis. Polisi mengejar!',
    pickup: { x: 600, y: 600 }, drop: { x: 3900, y: 600 },
  },
  {
    id: 3, name: 'Badai Sirene', reward: 800, surviveSeconds: 45,
    intro: 'Bertahan 45 detik di wanted 3. Jangan sampai tertangkap!',
    pickup: null, drop: null,
  },
  {
    id: 4, name: 'Coupe Emas', reward: 1500,
    intro: 'Curi coupe emas dari lot terjaga di barat, bawa ke penanda tanpa tertangkap.',
    pickup: { x: 300, y: 2100 }, drop: { x: 3900, y: 3900 },
  },
];

export const ECONOMY = {
  legendTotal: 3100,     // total cash untuk SOLARA LEGEND
  bustedFine: 120,       // denda saat busted
  startCash: 0,
};

export const FEEL = {
  shakeCrash: 13,
  shakeShot: 2.5,
  shakeHardTurn: 4,
  skidMinSpeed: 300,
  speedLineMin: 380,
};

export const SAVE_KEY = 'solara-city-save-v4';
export const COLORS = {
  asphalt: '#2b2f36',
  asphaltLine: '#c8b45a',
  sidewalk: '#55595f',
  grass: '#3f7a44',
  park: '#2f6b3a',
  buildingRoof: '#8a7f72',
  water: '#2e6f8e',
  gold: '#f2c14e',
  hudPanel: 'rgba(8, 12, 20, 0.72)',
};
