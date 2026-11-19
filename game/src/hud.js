// SOLARA CITY — HUD (fresh build v5). Cash, animated wanted stars,
// mission tracker, speedometer, minimap, steal prompt, health bar.

import { VIEW_W, VIEW_H, WORLD_W, WORLD_H, GOLD_COLOR } from './state.js';
import { MISSION_DEFS } from './missions.js';

const STAR_COLORS = ['#f1c40f', '#e67e22', '#e74c3c'];

export function drawHUD(ctx, S) {
  const p = S.player;
  // Top-left: cash panel.
  ctx.fillStyle = 'rgba(10,14,24,0.72)';
  ctx.beginPath();
  ctx.roundRect(14, 14, 250, 62, 10);
  ctx.fill();
  ctx.fillStyle = '#2ecc71';
  ctx.font = 'bold 30px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('$' + S.cash.toLocaleString('en-US'), 30, 52);
  ctx.fillStyle = '#b2bec3';
  ctx.font = '14px sans-serif';
  ctx.fillText('TOTAL DIDAPAT $' + S.earned.toLocaleString('en-US'), 30, 70);

  // Top-right: wanted stars, animated blink, color by level.
  const starColor = STAR_COLORS[Math.min(S.wanted, 3) - 1] || '#f1c40f';
  ctx.fillStyle = 'rgba(10,14,24,0.72)';
  ctx.beginPath();
  ctx.roundRect(VIEW_W - 214, 14, 200, 62, 10);
  ctx.fill();
  ctx.font = '34px sans-serif';
  ctx.textAlign = 'center';
  for (let i = 0; i < 3; i++) {
    const lit = i < S.wanted;
    const blink = lit && S.wanted >= 2 && Math.floor(S.time * 6) % 2 === 0;
    ctx.fillStyle = lit ? (blink ? '#ffffff' : starColor) : 'rgba(255,255,255,0.22)';
    const sx = VIEW_W - 168 + i * 52;
    const sy = 52 + (lit && S.wanted === 3 ? Math.sin(S.time * 9 + i) * 3 : 0);
    ctx.fillText('★', sx, sy);
  }
  ctx.fillStyle = '#b2bec3';
  ctx.font = '13px sans-serif';
  ctx.fillText(S.wanted === 0 ? 'BERSIH' : 'WANTED ' + S.wanted, VIEW_W - 114, 70);

  // Mission tracker (top-center).
  if (S.mission) {
    const m = S.mission;
    ctx.fillStyle = 'rgba(10,14,24,0.72)';
    ctx.beginPath();
    ctx.roundRect(VIEW_W / 2 - 260, 14, 520, 56, 10);
    ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 19px sans-serif';
    let line = m.name;
    if (m.kind === 0) line += m.pickupDone ? ' → antar ke titik hijau' : ' → ambil paket kuning';
    if (m.kind === 1) line += ' — ' + Math.max(0, Math.ceil(m.timer)) + 's tersisa';
    if (m.kind === 2) line += ' — bertahan ' + Math.max(0, Math.ceil(m.timer)) + 's';
    if (m.kind === 3) line += m.stolen ? ' → bawa ke garasi hijau' : ' → curi coupe emas';
    ctx.fillText(line, VIEW_W / 2, 38);
    ctx.fillStyle = '#dfe6e9';
    ctx.font = '14px sans-serif';
    const distTxt = m.targetX !== undefined
      ? 'jarak ' + Math.round(Math.hypot(m.targetX - p.x, m.targetY - p.y)) + 'm'
      : '';
    ctx.fillText(m.desc + (distTxt ? '  •  ' + distTxt : ''), VIEW_W / 2, 60);
  } else if (S.mode === 'playing') {
    ctx.fillStyle = 'rgba(10,14,24,0.72)';
    ctx.beginPath();
    ctx.roundRect(VIEW_W / 2 - 200, 14, 400, 40, 10);
    ctx.fill();
    ctx.fillStyle = '#dfe6e9';
    ctx.font = '17px sans-serif';
    ctx.fillText('Misi selesai — misi berikutnya dimulai…', VIEW_W / 2, 40);
  }

  // Bottom-left: health bar + speed.
  ctx.fillStyle = 'rgba(10,14,24,0.72)';
  ctx.beginPath();
  ctx.roundRect(14, VIEW_H - 66, 250, 52, 10);
  ctx.fill();
  ctx.fillStyle = '#636e72';
  ctx.fillRect(28, VIEW_H - 52, 150, 12);
  ctx.fillStyle = p.health > 50 ? '#2ecc71' : p.health > 25 ? '#f39c12' : '#e74c3c';
  ctx.fillRect(28, VIEW_H - 52, 150 * Math.max(0, p.health) / 100, 12);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('NYAWA ' + Math.max(0, Math.round(p.health)), 186, VIEW_H - 40);
  const spd = p.car ? Math.abs(Math.round(p.car.speed * 0.36)) : 0;
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(spd + ' km/h', 28, VIEW_H - 22);

  // Steal prompt.
  if (S.stealTarget && S.mode === 'playing' && p.onFoot) {
    const label = S.stealTarget.isGold ? 'TEKAN E — CURI COUPE EMAS ★' : 'TEKAN E — CURI MOBIL';
    ctx.font = 'bold 24px sans-serif';
    const w = ctx.measureText(label).width + 36;
    ctx.fillStyle = 'rgba(10,14,24,0.8)';
    ctx.beginPath();
    ctx.roundRect(VIEW_W / 2 - w / 2, VIEW_H - 130, w, 46, 10);
    ctx.fill();
    ctx.fillStyle = S.stealTarget.isGold ? GOLD_COLOR : '#ffd166';
    ctx.textAlign = 'center';
    ctx.fillText(label, VIEW_W / 2, VIEW_H - 100);
  }

  // Mission progress dots (bottom-right, above minimap).
  ctx.textAlign = 'right';
  ctx.font = '15px sans-serif';
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = i < S.missionIndex ? '#2ecc71' : i === S.missionIndex ? '#ffd166' : 'rgba(255,255,255,0.35)';
    ctx.fillText((i < S.missionIndex ? '● ' : '○ ') + MISSION_DEFS[i].name.split('—')[0].trim(), VIEW_W - 190, VIEW_H - 210 + i * 20);
  }

  // Minimap (bottom-right).
  const mm = 150;
  const mx = VIEW_W - mm - 16;
  const my = VIEW_H - mm - 16;
  const sc = mm / WORLD_W;
  ctx.fillStyle = 'rgba(10,14,24,0.78)';
  ctx.beginPath();
  ctx.roundRect(mx - 6, my - 6, mm + 12, mm + 12, 10);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.rect(mx, my, mm, mm);
  ctx.clip();
  ctx.fillStyle = '#2d3436';
  ctx.fillRect(mx, my, mm, mm);
  // Roads on minimap.
  ctx.fillStyle = '#636e72';
  const BLOCK = 340, ROAD = 150;
  for (let k = 0; k <= 10; k++) {
    ctx.fillRect(mx + k * BLOCK * sc, my, ROAD * sc, mm);
    ctx.fillRect(mx, my + k * BLOCK * sc, mm, ROAD * sc);
  }
  const dot = (x, y, r, color) => {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(mx + x * sc, my + y * sc, r, 0, Math.PI * 2); ctx.fill();
  };
  if (S.destPos) dot(S.destPos.x, S.destPos.y, 5, '#2ecc71');
  if (S.packagePos && S.mission && S.mission.kind === 0 && !S.mission.pickupDone) dot(S.packagePos.x, S.packagePos.y, 5, '#f39c12');
  if (S.goldCoupe && S.mission && S.mission.kind === 3 && !S.mission.stolen) dot(S.goldCoupe.x, S.goldCoupe.y, 5, GOLD_COLOR);
  for (const c of S.cops) dot(c.x, c.y, 3.5, '#74b9ff');
  dot(p.x, p.y, 5, '#fff');
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(mx + p.x * sc, my + p.y * sc, 7, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#b2bec3';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('PETA', mx, my - 10);
}
