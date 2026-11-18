// SOLARA CITY v3 — HUD and screens, all drawn on the canvas: cash, wanted
// stars (animated, colour by level), mission tracker, speed, minimap, toasts,
// and the boot / pause / busted / wasted / legend overlays with click buttons.

import { WANTED_COLORS, WORLD, LEGEND_CASH } from './config.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function drawHUD(ctx, G) {
  const W = G.canvas.width;
  const H = G.canvas.height;
  const now = G.time;
  // --- cash ---
  ctx.save();
  ctx.fillStyle = 'rgba(6,10,22,0.72)';
  roundRect(ctx, 14, 12, 218, 54, 10);
  ctx.fill();
  ctx.fillStyle = '#7ee787';
  ctx.font = '700 26px system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(`$${G.cash.toLocaleString('en-US')}`, 28, 40);
  ctx.fillStyle = '#9aa5b1';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(`TARGET $${LEGEND_CASH.toLocaleString('en-US')}`, 132, 26);
  ctx.fillStyle = '#2c3350';
  roundRect(ctx, 132, 36, 82, 8, 4);
  ctx.fill();
  ctx.fillStyle = '#7ee787';
  roundRect(ctx, 132, 36, 82 * Math.min(1, G.cash / LEGEND_CASH), 8, 4);
  ctx.fill();
  // --- wanted stars (top centre, animated) ---
  const stars = G.wanted;
  const col = WANTED_COLORS[stars] || '#9aa5b1';
  const blink = stars === 3 ? (Math.sin(now * 9) > 0 ? 1 : 0.45) : 1;
  ctx.globalAlpha = blink;
  ctx.fillStyle = 'rgba(6,10,22,0.72)';
  roundRect(ctx, W / 2 - 92, 12, 184, 46, 10);
  ctx.fill();
  ctx.font = '26px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < stars ? col : '#39415e';
    ctx.fillText('★', W / 2 - 64 + i * 32, 37);
  }
  ctx.textAlign = 'left';
  ctx.globalAlpha = 1;
  // --- mission tracker (under cash) ---
  const m = G.missions.current;
  ctx.fillStyle = 'rgba(6,10,22,0.72)';
  roundRect(ctx, 14, 74, 258, m ? 74 : 44, 10);
  ctx.fill();
  ctx.fillStyle = '#f5c542';
  ctx.font = '700 14px system-ui, sans-serif';
  if (m) {
    ctx.fillText(`MISI ${m.id}/4 — ${m.name}`, 26, 96);
    ctx.fillStyle = '#e6e9f2';
    ctx.font = '12px system-ui, sans-serif';
    const obj = G.missions.target ? G.missions.target.label : (m.kind === 'survive' ? 'BERTAHAN HIDUP!' : '—');
    ctx.fillText(obj, 26, 116);
    if ((m.kind === 'escape' || m.kind === 'survive') && G.missions.timeLeft > 0) {
      ctx.fillStyle = G.missions.timeLeft < 10 ? '#ff6b6b' : '#ffd23f';
      ctx.font = '700 15px system-ui, sans-serif';
      ctx.fillText(`⏱ ${Math.ceil(G.missions.timeLeft)} dtk`, 26, 136);
    }
    ctx.fillStyle = '#7ee787';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(`Hadiah +$${m.reward}`, 180, 136);
  } else {
    ctx.fillText('SEMUA MISI SELESAI', 26, 96);
    ctx.fillStyle = '#7ee787';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('SOLARA LEGEND!', 26, 116);
  }
  // --- speed (bottom right) ---
  const kmh = Math.round(G.player.speed * 0.24);
  ctx.fillStyle = 'rgba(6,10,22,0.72)';
  roundRect(ctx, W - 138, H - 62, 124, 50, 10);
  ctx.fill();
  ctx.fillStyle = '#e6e9f2';
  ctx.font = '700 24px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`${kmh}`, W - 52, H - 37);
  ctx.fillStyle = '#9aa5b1';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText('km/h', W - 24, H - 37);
  ctx.textAlign = 'left';
  // --- health bar (bottom left, above hint) ---
  ctx.fillStyle = 'rgba(6,10,22,0.72)';
  roundRect(ctx, 14, H - 62, 190, 50, 10);
  ctx.fill();
  ctx.fillStyle = '#9aa5b1';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText('NYAWA', 26, H - 46);
  ctx.fillStyle = '#2c3350';
  roundRect(ctx, 26, H - 38, 166, 10, 5);
  ctx.fill();
  ctx.fillStyle = G.player.health > 35 ? '#4ade80' : '#ff6b6b';
  roundRect(ctx, 26, H - 38, 166 * (G.player.health / 100), 10, 5);
  ctx.fill();
  // --- controls hint ---
  ctx.fillStyle = 'rgba(230,233,242,0.55)';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText('WASD nyetir/jalan · E curi mobil · Spasi tembak · P jeda', 218, H - 32);
  // --- minimap (top right) ---
  drawMinimap(ctx, G);
  // --- toasts ---
  let ty = 78;
  for (const t of G.toasts) {
    const age = now - t.t;
    if (age > t.dur) continue;
    const a = age < 0.2 ? age / 0.2 : age > t.dur - 0.4 ? (t.dur - age) / 0.4 : 1;
    ctx.globalAlpha = Math.max(0, Math.min(1, a));
    ctx.font = '700 16px system-ui, sans-serif';
    const tw = ctx.measureText(t.text).width + 28;
    ctx.fillStyle = 'rgba(6,10,22,0.78)';
    roundRect(ctx, W / 2 - tw / 2, ty, tw, 34, 9);
    ctx.fill();
    ctx.fillStyle = t.color || '#e6e9f2';
    ctx.textAlign = 'center';
    ctx.fillText(t.text, W / 2, ty + 18);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
    ty += 42;
  }
  // --- big banner (mission complete / legend flash) ---
  if (G.banner && now < G.banner.until) {
    const age = now - G.banner.t;
    const a = age < 0.25 ? age / 0.25 : age > 1.6 ? Math.max(0, (G.banner.until - now) / 0.6) : 1;
    ctx.globalAlpha = Math.max(0, Math.min(1, a));
    ctx.textAlign = 'center';
    ctx.fillStyle = G.banner.color || '#ffd23f';
    ctx.font = '800 44px system-ui, sans-serif';
    ctx.fillText(G.banner.text, W / 2, H * 0.32);
    if (G.banner.sub) {
      ctx.fillStyle = '#e6e9f2';
      ctx.font = '700 22px system-ui, sans-serif';
      ctx.fillText(G.banner.sub, W / 2, H * 0.32 + 38);
    }
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawMinimap(ctx, G) {
  const W = G.canvas.width;
  const size = 148;
  const x0 = W - size - 14;
  const y0 = 74;
  const s = size / WORLD.size;
  ctx.save();
  ctx.fillStyle = 'rgba(6,10,22,0.78)';
  roundRect(ctx, x0 - 4, y0 - 4, size + 8, size + 8, 10);
  ctx.fill();
  ctx.beginPath();
  roundRect(ctx, x0, y0, size, size, 6);
  ctx.clip();
  ctx.fillStyle = '#141a2e';
  ctx.fillRect(x0, y0, size, size);
  ctx.strokeStyle = '#2c3350';
  ctx.lineWidth = 1;
  for (const rx of G.city.roadsX) {
    ctx.beginPath();
    ctx.moveTo(x0 + rx * s, y0);
    ctx.lineTo(x0 + rx * s, y0 + size);
    ctx.stroke();
  }
  for (const ry of G.city.roadsY) {
    ctx.beginPath();
    ctx.moveTo(x0, y0 + ry * s);
    ctx.lineTo(x0 + size, y0 + ry * s);
    ctx.stroke();
  }
  // Mission target: pulsing gold diamond.
  if (G.missions.target) {
    const t = G.missions.target;
    const r = 4 + 1.6 * Math.sin(G.time * 5);
    ctx.fillStyle = '#f5c542';
    ctx.beginPath();
    ctx.arc(x0 + t.x * s, y0 + t.y * s, r + 2, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police: flashing blue/red dots.
  for (const c of G.police.cars) {
    if (c.wrecked) continue;
    ctx.fillStyle = Math.sin(G.time * 10 + c.id) > 0 ? '#3b82f6' : '#ef4444';
    ctx.beginPath();
    ctx.arc(x0 + c.x * s, y0 + c.y * s, 3.4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player: white dot with ring.
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x0 + G.player.x * s, y0 + G.player.y * s, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#22d3ee';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x0 + G.player.x * s, y0 + G.player.y * s, 6.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function overlay(ctx, W, H, alpha = 0.72) {
  ctx.fillStyle = `rgba(4,7,16,${alpha})`;
  ctx.fillRect(0, 0, W, H);
}

function title(ctx, W, text, y, size = 54, color = '#f5c542') {
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.font = `800 ${size}px system-ui, sans-serif`;
  ctx.fillText(text, W / 2, y);
  ctx.textAlign = 'left';
}

function button(ctx, G, id, label, y, w = 300, accent = false) {
  const W = G.canvas.width;
  const x = W / 2 - w / 2;
  const h = 48;
  ctx.fillStyle = accent ? '#f5c542' : 'rgba(255,255,255,0.10)';
  roundRect(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = accent ? '#f5c542' : 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, x, y, w, h, 10);
  ctx.stroke();
  ctx.fillStyle = accent ? '#11162a' : '#e6e9f2';
  ctx.font = '700 18px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, W / 2, y + 30);
  ctx.textAlign = 'left';
  G.uiButtons.push({ id, x, y, w, h });
}

function controlsBlock(ctx, W, y) {
  ctx.textAlign = 'center';
  ctx.fillStyle = '#9aa5b1';
  ctx.font = '15px system-ui, sans-serif';
  const lines = [
    'WASD / Panah — jalan & nyetir',
    'E — curi mobil (dekat mobil) / keluar mobil',
    'Spasi — tembak    ·    P / Esc — jeda',
    'Enter — mulai / lanjutkan',
  ];
  lines.forEach((l, i) => ctx.fillText(l, W / 2, y + i * 24));
  ctx.textAlign = 'left';
}

export function drawBoot(ctx, G) {
  const W = G.canvas.width;
  const H = G.canvas.height;
  G.uiButtons = [];
  overlay(ctx, W, H, 0.62);
  title(ctx, W, 'SOLARA CITY', 150, 64);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#22d3ee';
  ctx.font = '700 20px system-ui, sans-serif';
  ctx.fillText('Kota malam. Curi mobil. Selesaikan 4 misi. Jadi legenda.', W / 2, 190);
  ctx.textAlign = 'left';
  button(ctx, G, 'start', '▶  MULAI (Enter)', 250, 320, true);
  if (G.hasSave) button(ctx, G, 'continue', `↻  LANJUTKAN — $${G.saveCash.toLocaleString('en-US')} · Misi ${Math.min(4, G.saveMission + 1)}/4`, 312, 320);
  controlsBlock(ctx, W, G.hasSave ? 400 : 360);
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(230,233,242,0.5)';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('Game orisinal buatan agen — bukan GTA Rockstar. Semua aset prosedural, tanpa unduhan.', W / 2, H - 24);
  ctx.textAlign = 'left';
}

export function drawPause(ctx, G) {
  const W = G.canvas.width;
  const H = G.canvas.height;
  G.uiButtons = [];
  overlay(ctx, W, H, 0.66);
  title(ctx, W, 'JEDA', 150, 52, '#e6e9f2');
  ctx.textAlign = 'center';
  ctx.fillStyle = '#9aa5b1';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText(`Uang $${G.cash.toLocaleString('en-US')}  ·  Misi ${Math.min(4, G.missions.index + 1)}/4  ·  Wanted ${G.wanted}★`, W / 2, 196);
  ctx.textAlign = 'left';
  button(ctx, G, 'resume', '▶  LANJUTKAN (P)', 240, 300, true);
  button(ctx, G, 'restart', '↻  MULAI ULANG (R)', 302, 300);
  button(ctx, G, 'quit', 'Keluar ke Menu', 364, 300);
  controlsBlock(ctx, W, 452);
}

export function drawBusted(ctx, G) {
  const W = G.canvas.width;
  const H = G.canvas.height;
  G.uiButtons = [];
  overlay(ctx, W, H, 0.7);
  title(ctx, W, 'BUSTED!', 180, 64, '#3b82f6');
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e6e9f2';
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText(`Polisi menangkapmu. Uang hilang $${G.bustedLost.toLocaleString('en-US')}.`, W / 2, 230);
  ctx.fillStyle = '#9aa5b1';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('Kamu respawn di jalan. Misi aktif bisa diulang.', W / 2, 260);
  ctx.textAlign = 'left';
  button(ctx, G, 'respawn', '↻  RESPAWN (Enter)', 310, 300, true);
}

export function drawWasted(ctx, G) {
  const W = G.canvas.width;
  const H = G.canvas.height;
  G.uiButtons = [];
  overlay(ctx, W, H, 0.7);
  title(ctx, W, 'WASTED', 180, 64, '#ff3b30');
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e6e9f2';
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText('Kamu tumbang di jalanan Solara.', W / 2, 230);
  ctx.fillStyle = '#9aa5b1';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('Coba lagi dari checkpoint terakhir.', W / 2, 260);
  ctx.textAlign = 'left';
  button(ctx, G, 'retry', '↻  COBA LAGI (Enter)', 310, 300, true);
}

export function drawLegend(ctx, G) {
  const W = G.canvas.width;
  const H = G.canvas.height;
  G.uiButtons = [];
  overlay(ctx, W, H, 0.66);
  title(ctx, W, '★ SOLARA LEGEND ★', 150, 56);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e6e9f2';
  ctx.font = '700 22px system-ui, sans-serif';
  ctx.fillText(`$${G.cash.toLocaleString('en-US')} — semua 4 misi selesai!`, W / 2, 206);
  ctx.fillStyle = '#f5c542';
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText('Coupe emas itu sekarang milikmu. Kota ini milikmu.', W / 2, 240);
  ctx.textAlign = 'left';
  button(ctx, G, 'freeroam', '▶  JELAJAH KOTA (Enter)', 300, 320, true);
  button(ctx, G, 'again', '↻  MAIN LAGI DARI AWAL', 362, 320);
}
