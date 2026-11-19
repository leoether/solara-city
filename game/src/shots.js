// SOLARA CITY — shots.js
// Staging deterministik untuk screenshot: menempatkan game pada adegan yang
// diminta (kejar-kejaran, reward, legend, baku tembak) tanpa mengubah
// logika permainan. Dipakai skrip screenshot + playtest via window.__SOLARA.

export function stageScene(game, scene) {
  const g = game;
  const P = g.player;
  // Reset ke tengah kota, bersih dari polisi lama.
  g.cops.length = 0;
  g.combat.bullets.length = 0;
  g.fx.particles.length = 0;
  g.missions.banner = null;
  g.missions.bannerT = 0;
  g.screen = 'play';
  g.paused = false;

  if (scene === 'chase') {
    // Curi mobil + wanted 1 + 2 polisi mengejar.
    ensureCar(g, 2100, 2100, 0, '#c94f4f');
    g.wanted = 1;
    g.cash = 0;
    g.missions.index = 0;
    g.missions.phase = 'toPickup';
    spawnCopsAround(g, 2, 320);
    P.car.speed = 300;
    g.fx.addShake(3);
  } else if (scene === 'reward') {
    // Misi 1 selesai, banner +$300 tampil.
    ensureCar(g, 2100, 3800, -Math.PI / 2, '#4f7ec9');
    g.cash = 300;
    g.wanted = 0;
    g.missions.index = 1;
    g.missions.phase = 'idle';
    g.missions.banner = { text: 'MISI SELESAI  +$300', sub: 'Misi berikutnya: Kabur dari Blokade — tekan M untuk mulai.' };
    g.missions.bannerT = 4.2;
    spawnCopsAround(g, 0, 0);
  } else if (scene === 'legend') {
    // SOLARA LEGEND + coupe emas.
    ensureCar(g, 2400, 2100, 0, '#f2c14e', true);
    g.cash = 3100;
    g.wanted = 0;
    g.missions.index = 4;
    g.missions.phase = 'done';
    g.screen = 'legend';
    g.missions.banner = { text: 'SOLARA LEGEND', sub: 'Kamu menguasai kota. Total $3.100!' };
    g.missions.bannerT = 9;
  } else if (scene === 'shootout') {
    // Baku tembak intens di wanted 3, pemain jalan kaki menembak.
    P.inCar = false;
    P.car = null;
    P.x = 2100; P.y = 2100;
    P.aimAngle = Math.PI / 4;
    P.health = 62;
    g.wanted = 3;
    g.cash = 1600;
    g.missions.index = 2;
    g.missions.phase = 'survive';
    g.missions.surviveLeft = 28;
    spawnCopsAround(g, 4, 300);
    // Peluru di udara untuk kesan aksi.
    for (let i = 0; i < 4; i++) {
      g.combat.bullets.push({
        x: P.x + 40 + i * 60, y: P.y + 20 - i * 30,
        vx: 700, vy: 120, life: 0.5, fromPlayer: true,
      });
    }
    g.fx.sparks(P.x + 60, P.y + 10, 8);
    g.fx.addShake(4);
  }
  // Pusatkan kamera langsung ke pemain agar screenshot stabil.
  g.camera.x = (P.inCar ? P.car.x : P.x) - g.camera.w / 2;
  g.camera.y = (P.inCar ? P.car.y : P.y) - g.camera.h / 2;
}

function ensureCar(g, x, y, angle, color, gold) {
  const P = g.player;
  if (!P.car || P.car.gold !== !!gold) {
    P.car = { x, y, angle, color, speed: 0, vx: 0, vy: 0, gold: !!gold, exhaust: 0, skid: 0 };
  }
  P.car.x = x; P.car.y = y; P.car.angle = angle; P.car.color = color;
  P.car.speed = 0; P.car.vx = 0; P.car.vy = 0;
  P.inCar = true;
  P.x = x; P.y = y;
}

function spawnCopsAround(g, n, dist) {
  const P = g.player;
  const cx = P.inCar ? P.car.x : P.x;
  const cy = P.inCar ? P.car.y : P.y;
  for (let i = 0; i < n; i++) {
    const a = (i / Math.max(1, n)) * Math.PI * 2 + 0.6;
    const cop = {
      x: cx + Math.cos(a) * dist, y: cy + Math.sin(a) * dist,
      angle: a + Math.PI, color: '#1c2733', speed: 260,
      vx: 0, vy: 0, isCop: true, lightPhase: i * 1.3, hp: 100,
    };
    g.cops.push(cop);
  }
}
