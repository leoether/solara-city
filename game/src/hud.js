// SOLARA CITY — hud.js
// HUD di atas canvas: cash, bintang wanted beranimasi, tracker misi,
// speedometer, minimap (pemain, polisi, target), banner misi, dan semua
// layar menu (boot, pause, busted, wasted, legend).

import { ECONOMY, MISSIONS, COLORS } from './config.js';
import { fmtCash, clamp } from './random.js';

// Gambar HUD + menu sesuai screen game ('boot' | 'play' | 'pause' |
// 'busted' | 'wasted' | 'legend'). hasSave = ada save di localStorage.
export function drawHud(ctx, game) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const { player, wanted, cash, missions, time } = game;
  if (game.screen === 'boot') { drawBoot(ctx, game, W, H); return; }
  if (game.screen === 'pause') { drawPause(ctx, game, W, H); return; }
  if (game.screen === 'busted') { drawBusted(ctx, W, H, game.bustedCash); return; }
  if (game.screen === 'wasted') { drawWasted(ctx, W, H); return; }
  if (game.screen === 'legend') { drawLegend(ctx, W, H); return; }

  // --- Panel atas kiri: cash + misi ---
  panel(ctx, 16, 14, 250, 64);
  ctx.fillStyle = '#f2c14e';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(fmtCash(cash), 30, 44);
  ctx.fillStyle = '#cfd6de';
  ctx.font = '14px system-ui, sans-serif';
  const cur = MISSIONS[missions.index];
  ctx.fillText(cur ? `Misi ${cur.id}: ${cur.name}` : 'Semua misi selesai', 30, 66);
  // Progress bar ke LEGEND.
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(16, 84, 250, 6);
  ctx.fillStyle = '#f2c14e';
  ctx.fillRect(16, 84, 250 * clamp(cash / ECONOMY.legendTotal, 0, 1), 6);

  // --- Wanted stars kanan atas, berkedip + warna per level ---
  const starColors = ['', '#ffd23e', '#ff8c2e', '#ff3b30'];
  const blink = wanted > 0 && Math.sin(time * (4 + wanted * 2)) > 0;
  panel(ctx, W - 216, 14, 200, 56);
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillStyle = '#cfd6de';
  ctx.fillText('WANTED', W - 200, 34);
  for (let i = 0; i < 3; i++) {
    const active = i < wanted;
    const col = active ? starColors[wanted] : '#3a4150';
    drawStar(ctx, W - 118 + i * 34, 42, active && blink ? 15 : 12, col, active && blink);
  }

  // --- Speedometer kanan bawah (saat di mobil) ---
  if (player.inCar) {
    const kmh = Math.round(Math.abs(player.car.speed) * 0.36);
    panel(ctx, W - 150, H - 96, 134, 80);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(String(kmh), W - 40, H - 46);
    ctx.fillStyle = '#9aa4b2';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('km/h', W - 40, H - 26);
    ctx.textAlign = 'left';
    // Kesehatan mobil (proxy: kecepatan aman) — tampilkan HP pemain.
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(W - 134, H - 20, 102, 5);
    ctx.fillStyle = player.health > 40 ? '#39d353' : '#ff3b30';
    ctx.fillRect(W - 134, H - 20, 102 * clamp(player.health / 100, 0, 1), 5);
  } else {
    // HP saat jalan kaki.
    panel(ctx, W - 150, H - 96, 134, 80);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText('JALAN KAKI', W - 134, H - 60);
    ctx.fillStyle = '#9aa4b2';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('Tekan E di dekat mobil', W - 134, H - 40);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(W - 134, H - 30, 102, 5);
    ctx.fillStyle = player.health > 40 ? '#39d353' : '#ff3b30';
    ctx.fillRect(W - 134, H - 30, 102 * clamp(player.health / 100, 0, 1), 5);
  }

  // --- Tracker misi bawah kiri ---
  drawMissionTracker(ctx, game, 16, H - 118);

  // --- Minimap kanan bawah di atas speedometer ---
  drawMinimap(ctx, game, W - 216, H - 316, 200, 200);

  // --- Banner tengah ---
  if (missions.banner && missions.bannerT > 0) {
    const a = clamp(missions.bannerT, 0, 1);
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(8,12,20,0.78)';
    const bw = 560;
    ctx.fillRect(W / 2 - bw / 2, 108, bw, missions.banner.sub ? 74 : 52);
    ctx.fillStyle = '#f2c14e';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillText(missions.banner.text, W / 2, 142);
    if (missions.banner.sub) {
      ctx.fillStyle = '#e8ecf1';
      ctx.font = '15px system-ui, sans-serif';
      ctx.fillText(missions.banner.sub, W / 2, 168);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  // --- Hint kontekstual ---
  if (game.hint) {
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(8,12,20,0.72)';
    const hw = ctx.measureText(game.hint).width + 36;
    ctx.fillRect(W / 2 - hw / 2, H - 52, hw, 34);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(game.hint, W / 2, H - 29);
    ctx.textAlign = 'left';
  }

  // Timer misi 2 / survival misi 3.
  if (missions.phase === 'toPickup' || missions.phase === 'toDrop') {
    const cur2 = MISSIONS[missions.index];
    if (cur2 && cur2.id === 2) {
      ctx.textAlign = 'center';
      ctx.fillStyle = missions.timer < 15 ? '#ff3b30' : '#fff';
      ctx.font = 'bold 30px system-ui, sans-serif';
      ctx.fillText('⏱ ' + Math.ceil(missions.timer) + 's', W / 2, 210);
      ctx.textAlign = 'left';
    }
  }
  if (missions.phase === 'survive') {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff8c2e';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillText('BERTAHAN: ' + Math.ceil(missions.surviveLeft) + 's', W / 2, 210);
    ctx.textAlign = 'left';
  }
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = COLORS.hudPanel;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawStar(ctx, cx, cy, r, color, glow) {
  ctx.save();
  ctx.translate(cx, cy);
  if (glow) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
  }
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawMissionTracker(ctx, game, x, y) {
  const { missions } = game;
  panel(ctx, x, y, 300, 102);
  ctx.fillStyle = '#f2c14e';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillText('TRACKER MISI', x + 14, y + 22);
  ctx.font = '13px system-ui, sans-serif';
  MISSIONS.forEach((m, i) => {
    const done = i < missions.index;
    const active = i === missions.index && missions.phase !== 'idle';
    const waiting = i === missions.index && missions.phase === 'idle';
    ctx.fillStyle = done ? '#39d353' : active ? '#ffd23e' : '#8a94a3';
    const mark = done ? '✓' : active ? '►' : waiting ? '○' : '·';
    const label = `${mark}  M${m.id} ${m.name}  +$${m.reward}`;
    ctx.fillText(label, x + 14, y + 44 + i * 18);
  });
}

function drawMinimap(ctx, game, x, y, w, h) {
  const { city, player, cops, missions } = game;
  const scale = w / 4200;
  panel(ctx, x - 6, y - 6, w + 12, h + 12);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = '#1d2b1e';
  ctx.fillRect(x, y, w, h);
  // Jalan di minimap.
  ctx.fillStyle = '#4a4f57';
  for (let g = 0; g <= 4200; g += 300) {
    ctx.fillRect(x + g * scale - 2, y, 4, h);
    ctx.fillRect(x, y + g * scale - 2, w, 4);
  }
  // Target misi.
  const cur = MISSIONS[missions.index];
  if (cur && (missions.phase === 'toPickup' || missions.phase === 'toDrop')) {
    const pt = missions.phase === 'toPickup' ? cur.pickup : cur.drop;
    if (pt) {
      ctx.fillStyle = missions.phase === 'toPickup' ? '#f2c14e' : '#39d353';
      ctx.beginPath();
      ctx.arc(x + pt.x * scale, y + pt.y * scale, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Polisi (biru/merah berkedip).
  for (const cop of cops) {
    ctx.fillStyle = Math.sin(game.time * 8) > 0 ? '#ff3b30' : '#2f7bff';
    ctx.beginPath();
    ctx.arc(x + cop.x * scale, y + cop.y * scale, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Pemain (panah putih).
  const px = player.inCar ? player.car.x : player.x;
  const py = player.inCar ? player.car.y : player.y;
  const pa = player.inCar ? player.car.angle : player.aimAngle;
  ctx.save();
  ctx.translate(x + px * scale, y + py * scale);
  ctx.rotate(pa);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.fillStyle = '#cfd6de';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillText('SOLARA CITY', x + 2, y + h + 22);
}

// ---------- Layar menu ----------

function menuBase(ctx, W, H, title, subtitle, lines, accent, alpha) {
  ctx.fillStyle = `rgba(10,10,24,${alpha === undefined ? 0.82 : alpha})`;
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = accent || '#f2c14e';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText(title, W / 2, H / 2 - 130);
  ctx.fillStyle = '#e8ecf1';
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText(subtitle, W / 2, H / 2 - 92);
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillStyle = '#c9d1da';
  lines.forEach((ln, i) => ctx.fillText(ln, W / 2, H / 2 - 40 + i * 28));
  ctx.textAlign = 'left';
}

function drawBoot(ctx, game, W, H) {
  menuBase(ctx, W, H, 'SOLARA CITY', 'Kota matahari terbenam. Satu legenda. $3.100.',
    [
      'WASD / Panah — jalan & nyetir    •    E — curi mobil / keluar mobil',
      'Mouse — arahkan & tembak (klik / spasi)    •    Shift — lari',
      'M — mulai misi    •    P / Esc — pause    •    H — bantuan',
      '',
      game.hasSave ? '▶  Tekan ENTER untuk CONTINUE (save ditemukan)' : '▶  Tekan ENTER untuk MULAI',
      'Misi: Paket Panas → Kabur → Badai Sirene → Coupe Emas → SOLARA LEGEND',
    ], '#f2c14e');
  // Strip kota mini di bawah judul.
  ctx.fillStyle = '#2b2f36';
  ctx.fillRect(W / 2 - 260, H / 2 + 130, 520, 8);
  ctx.fillStyle = '#f2c14e';
  for (let i = 0; i < 9; i++) ctx.fillRect(W / 2 - 250 + i * 56, H / 2 + 132, 26, 4);
}

function drawPause(ctx, game, W, H) {
  menuBase(ctx, W, H, 'PAUSE', 'Istirahat sebentar, legenda.',
    [
      'P / Esc — lanjut main',
      'R — restart dari save terakhir',
      '',
      'WASD jalan/nyetir • E curi mobil • Klik/spasi tembak • M misi • Shift lari',
      `Cash: ${fmtCash(game.cash)}   •   Misi: ${game.missions.index + 1}/4`,
    ]);
}

function drawBusted(ctx, W, H, fine) {
  menuBase(ctx, W, H, 'BUSTED!', 'Polisi menangkapmu. Denda $' + (fine || 120) + '.',
    ['Tekan ENTER untuk respawn di titik aman.', 'Misi aktif bisa diulang dari awal.'], '#2f7bff');
}

function drawWasted(ctx, W, H) {
  menuBase(ctx, W, H, 'WASTED', 'Kamu tumbang di jalanan Solara.',
    ['Tekan ENTER untuk retry dari checkpoint terakhir.', 'Cash dan progres misi tersimpan.'], '#ff3b30');
}

function drawLegend(ctx, W, H) {
  menuBase(ctx, W, H, 'SOLARA LEGEND', 'Total $3.100 — kamu menguasai kota!',
    ['Coupe emas ada di garasimu. Polisi tak lagi berani mendekat.',
     'Tekan ENTER untuk terus menjelajah kota, atau R untuk main lagi dari awal.'], '#f2c14e', 0.58);
}
