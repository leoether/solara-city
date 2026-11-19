// SOLARA CITY — rendering (fresh build v5). Camera + screen shake, world,
// mission markers, cars, pedestrians, bullets, particles, skid marks,
// player on foot, dynamic lighting, speed lines, hit flash, mode screens.

import { VIEW_W, VIEW_H, WORLD_W, WORLD_H, GOLD_COLOR, clamp } from './state.js';
import { drawWorld } from './world.js';

function drawCar(ctx, c) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(c.angle);
  // Soft shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-c.w / 2 + 3, -c.h / 2 + 4, c.w, c.h);
  // Body.
  ctx.fillStyle = c.color;
  roundRect(ctx, -c.w / 2, -c.h / 2, c.w, c.h, 7);
  ctx.fill();
  // Cabin + windshield.
  ctx.fillStyle = 'rgba(20,30,45,0.9)';
  roundRect(ctx, -6, -c.h / 2 + 4, 16, c.h - 8, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(180,220,255,0.75)';
  ctx.fillRect(8, -c.h / 2 + 5, 4, c.h - 10);
  // Headlights / taillights.
  ctx.fillStyle = '#fff8c9';
  ctx.fillRect(c.w / 2 - 2, -c.h / 2 + 2, 3, 5);
  ctx.fillRect(c.w / 2 - 2, c.h / 2 - 7, 3, 5);
  ctx.fillStyle = c.brakeLight ? '#ff2d2d' : '#a33';
  ctx.fillRect(-c.w / 2 - 1, -c.h / 2 + 2, 3, 5);
  ctx.fillRect(-c.w / 2 - 1, c.h / 2 - 7, 3, 5);
  if (c.isGold) {
    ctx.strokeStyle = '#fff3a0';
    ctx.lineWidth = 2.5;
    roundRect(ctx, -c.w / 2, -c.h / 2, c.w, c.h, 7);
    ctx.stroke();
    ctx.fillStyle = '#fff3a0';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('★', 0, 4);
  }
  if (c.isCop) {
    // Light bar, flashing red/blue with the siren phase.
    const phase = Math.floor(c.siren * 6) % 2 === 0;
    ctx.fillStyle = phase ? '#ff2d55' : '#2d7dff';
    ctx.fillRect(-8, -c.h / 2 - 2, 7, 5);
    ctx.fillStyle = phase ? '#2d7dff' : '#ff2d55';
    ctx.fillRect(1, -c.h / 2 - 2, 7, 5);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLISI', 0, 4);
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawPed(ctx, p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(1, 2, 7, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = p.color;
  ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.arc(2, 0, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawMarker(ctx, x, y, color, label, pulse) {
  const r = 26 + Math.sin(pulse * 4) * 5;
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.25 + Math.sin(pulse * 4) * 0.08;
  ctx.beginPath(); ctx.arc(0, 0, r - 4, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.moveTo(0, -r - 26); ctx.lineTo(9, -r - 6); ctx.lineTo(-9, -r - 6);
  ctx.closePath();
  ctx.fill();
  if (label) {
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.strokeText(label, 0, -r - 32);
    ctx.fillStyle = '#fff';
    ctx.fillText(label, 0, -r - 32);
  }
  ctx.restore();
}

export function render(ctx, S, city) {
  const p = S.player;
  // Camera follows the player, clamped to the world.
  const tx = clamp(p.x, VIEW_W / 2 - 60, WORLD_W - VIEW_W / 2 + 60);
  const ty = clamp(p.y, VIEW_H / 2 - 60, WORLD_H - VIEW_H / 2 + 60);
  S.cam.x += (tx - S.cam.x) * 0.12;
  S.cam.y += (ty - S.cam.y) * 0.12;
  S.shake = Math.max(0, S.shake - 0.9);
  const shX = (Math.random() - 0.5) * S.shake * 2;
  const shY = (Math.random() - 0.5) * S.shake * 2;
  S.shakeX = shX; S.shakeY = shY;
  const camX = S.cam.x + shX;
  const camY = S.cam.y + shY;

  ctx.save();
  drawWorld(ctx, S, city, camX, camY, VIEW_W, VIEW_H);
  ctx.translate(VIEW_W / 2 - camX, VIEW_H / 2 - camY);

  // Skid marks.
  for (const s of S.skids) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle);
    ctx.fillStyle = `rgba(20,20,20,${0.5 * (s.life / s.maxLife)})`;
    ctx.fillRect(-12, -8, 24, 4);
    ctx.fillRect(-12, 4, 24, 4);
    ctx.restore();
  }

  // Mission markers.
  const m = S.mission;
  if (S.mode === 'playing' && m) {
    if (m.kind === 0 && !m.pickupDone && S.packagePos) {
      drawMarker(ctx, S.packagePos.x, S.packagePos.y, '#f39c12', 'PAKET', S.time);
    }
    if (S.destPos && (m.kind !== 0 || m.pickupDone)) {
      drawMarker(ctx, S.destPos.x, S.destPos.y, '#2ecc71', m.kind === 3 ? 'GARASI' : 'TUJUAN', S.time);
    }
    if (m.kind === 3 && !m.stolen && S.goldCoupe) {
      drawMarker(ctx, S.goldCoupe.x, S.goldCoupe.y, GOLD_COLOR, 'COUPE EMAS', S.time);
    }
    if (m.kind === 2) {
      drawMarker(ctx, p.x, p.y, '#e74c3c', 'BERTAHAN ' + Math.ceil(m.timer) + 's', S.time);
    }
  }

  // Parked cars, traffic, cops.
  for (const c of S.cars) drawCar(ctx, c);
  for (const t of S.traffic) drawCar(ctx, t);
  for (const c of S.cops) drawCar(ctx, c);

  // Pedestrians.
  for (const ped of S.peds) drawPed(ctx, ped);

  // Bullets.
  for (const b of S.bullets) {
    ctx.fillStyle = '#ffe14d';
    ctx.beginPath(); ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,225,77,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  // Player: car or on foot.
  if (p.car) {
    drawCar(ctx, p.car);
  } else if (S.mode === 'playing' || S.mode === 'paused') {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(1, 2, 9, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.invuln > 0 && Math.floor(S.time * 10) % 2 === 0 ? '#f8c471' : '#2874a6';
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f5b041';
    ctx.beginPath(); ctx.arc(3, 0, 3.5, 0, Math.PI * 2); ctx.fill();
    // Gun when firing.
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(16, 0); ctx.stroke();
    if (p.muzzle > 0) {
      ctx.fillStyle = '#ffe14d';
      ctx.beginPath(); ctx.arc(19, 0, 6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // Particles.
  for (const pt of S.particles) {
    const a = Math.max(0, pt.life / pt.maxLife);
    ctx.globalAlpha = pt.kind === 'smoke' ? a * 0.45 : a;
    ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * (pt.kind === 'smoke' ? 1 + (1 - a) : 1), 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Floating cash text.
  for (const f of S.floats) {
    ctx.globalAlpha = Math.max(0, f.life / f.maxLife);
    ctx.font = `bold ${f.size}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // --- Dynamic lighting: warm radial glow around the player ---
  const px = VIEW_W / 2 + (p.x - camX);
  const py = VIEW_H / 2 + (p.y - camY);
  const lg = ctx.createRadialGradient(px, py, 60, px, py, 480);
  lg.addColorStop(0, 'rgba(255,190,90,0.10)');
  lg.addColorStop(0.6, 'rgba(255,150,60,0.04)');
  lg.addColorStop(1, 'rgba(10,10,40,0.28)');
  ctx.fillStyle = lg;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  // Speed lines when driving fast.
  const spd = p.car ? Math.abs(p.car.speed) : 0;
  if (spd > 300) {
    const n = Math.floor((spd - 300) / 22);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r0 = 190 + Math.random() * 120;
      const x0 = VIEW_W / 2 + Math.cos(a) * r0;
      const y0 = VIEW_H / 2 + Math.sin(a) * r0;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 + Math.cos(a) * 42, y0 + Math.sin(a) * 42);
      ctx.stroke();
    }
  }

  // Hit flash.
  if (S.flash > 0) {
    ctx.fillStyle = `rgba(${S.flashColor},${Math.min(0.4, S.flash * 0.4)})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  // Vignette.
  const vg = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.42, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.85);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

export function drawScreen(ctx, S) {
  ctx.textAlign = 'center';
  if (S.mode === 'boot') {
    ctx.fillStyle = 'rgba(10,12,30,0.72)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 84px sans-serif';
    ctx.fillText('SOLARA CITY', VIEW_W / 2, 190);
    ctx.fillStyle = '#fff';
    ctx.font = '28px sans-serif';
    ctx.fillText('Curi mobil. Kabur dari polisi. Jadi legenda.', VIEW_W / 2, 240);
    ctx.font = '20px sans-serif';
    ctx.fillStyle = '#dfe6e9';
    ctx.fillText('WASD / Panah — jalan & nyetir    E — curi mobil    Klik — tembak', VIEW_W / 2, 320);
    ctx.fillText('P — pause    M — suara    4 misi, total hadiah $3.100', VIEW_W / 2, 352);
    ctx.fillStyle = '#2ecc71';
    roundRect(ctx, VIEW_W / 2 - 130, 400, 260, 62, 12);
    ctx.fill();
    ctx.fillStyle = '#06281a';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(S.hasSave ? '▶  CONTINUE' : '▶  START', VIEW_W / 2, 440);
    ctx.fillStyle = '#b2bec3';
    ctx.font = '17px sans-serif';
    ctx.fillText(S.hasSave ? 'Save ditemukan — lanjutkan dari misi terakhir.' : 'Tidak ada save — mulai dari awal.', VIEW_W / 2, 500);
  } else if (S.mode === 'paused') {
    ctx.fillStyle = 'rgba(10,12,30,0.7)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 56px sans-serif';
    ctx.fillText('PAUSE', VIEW_W / 2, 260);
    ctx.font = '22px sans-serif';
    ctx.fillStyle = '#dfe6e9';
    ctx.fillText('P / Esc — lanjut    R — restart dari save    M — suara', VIEW_W / 2, 330);
    ctx.fillText('WASD nyetir • E curi mobil • Klik tembak', VIEW_W / 2, 366);
  } else if (S.mode === 'busted') {
    ctx.fillStyle = 'rgba(20,10,60,0.78)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = '#74b9ff';
    ctx.font = 'bold 72px sans-serif';
    ctx.fillText('BUSTED!', VIEW_W / 2, 300);
    ctx.fillStyle = '#fff';
    ctx.font = '24px sans-serif';
    ctx.fillText('Polisi menangkapmu. Denda $50 — tekan Enter untuk respawn.', VIEW_W / 2, 360);
  } else if (S.mode === 'wasted') {
    ctx.fillStyle = 'rgba(60,10,10,0.8)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = '#ff7675';
    ctx.font = 'bold 72px sans-serif';
    ctx.fillText('WASTED', VIEW_W / 2, 300);
    ctx.fillStyle = '#fff';
    ctx.font = '24px sans-serif';
    ctx.fillText('Kamu tumbang. Tekan Enter untuk retry dari checkpoint.', VIEW_W / 2, 360);
  } else if (S.mode === 'legend') {
    ctx.fillStyle = 'rgba(20,20,5,0.72)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 68px sans-serif';
    ctx.fillText('★ SOLARA LEGEND ★', VIEW_W / 2, 260);
    ctx.fillStyle = '#fff';
    ctx.font = '26px sans-serif';
    ctx.fillText('Total $3.100 — semua misi selesai. Coupe emas milikmu!', VIEW_W / 2, 320);
    ctx.font = '22px sans-serif';
    ctx.fillStyle = '#ffeaa7';
    ctx.fillText('Tekan Enter untuk main bebas di kota.', VIEW_W / 2, 370);
  }
  // Banner (mission complete / pickup) — below the tracker bar.
  if (S.bannerT > 0 && S.banner) {
    ctx.globalAlpha = Math.min(1, S.bannerT);
    ctx.font = 'bold 30px sans-serif';
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.strokeText(S.banner, VIEW_W / 2, 112);
    ctx.fillStyle = '#ffd166';
    ctx.fillText(S.banner, VIEW_W / 2, 112);
    ctx.globalAlpha = 1;
  }
}
