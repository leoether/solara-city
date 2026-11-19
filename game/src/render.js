// SOLARA CITY — render.js
// Canvas 2D rendering: city, cars, people, particles, dynamic lighting,
// speed lines, HUD (cash, wanted stars, mission tracker, speed, health),
// minimap, and all menus (boot / pause / busted / wasted / legend).

import { WORLD_W, WORLD_H, MISSION_NAMES, LEGEND_CASH, loadGame } from './state.js';
import { ROAD, ROAD_W, drawParallax } from './world.js';
import { currentObjective } from './missions.js';

function drawCarShape(ctx, car, isPlayer) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const w = car.w || 46;
  const h = car.h || 22;
  // Soft shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.beginPath();
  ctx.ellipse(2, 4, w / 2 + 2, h / 2 + 2, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body.
  const grad = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  grad.addColorStop(0, lighten(car.color, 26));
  grad.addColorStop(0.5, car.color);
  grad.addColorStop(1, darken(car.color, 26));
  ctx.fillStyle = grad;
  roundRect(ctx, -w / 2, -h / 2, w, h, 7);
  ctx.fill();
  // Cabin + windshield.
  ctx.fillStyle = 'rgba(20,30,45,0.85)';
  roundRect(ctx, -w * 0.16, -h * 0.36, w * 0.34, h * 0.72, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(160,210,235,0.9)';
  roundRect(ctx, w * 0.18, -h * 0.34, w * 0.1, h * 0.68, 3);
  ctx.fill();
  // Headlights.
  ctx.fillStyle = '#fff8c0';
  ctx.beginPath();
  ctx.arc(w / 2 - 2, -h / 2 + 5, 3, 0, Math.PI * 2);
  ctx.arc(w / 2 - 2, h / 2 - 5, 3, 0, Math.PI * 2);
  ctx.fill();
  // Brake lights.
  if (car.brakeLight) {
    ctx.fillStyle = '#ff2a2a';
    ctx.beginPath();
    ctx.arc(-w / 2 + 2, -h / 2 + 5, 3.4, 0, Math.PI * 2);
    ctx.arc(-w / 2 + 2, h / 2 - 5, 3.4, 0, Math.PI * 2);
    ctx.fill();
  }
  if (car.gold) {
    ctx.strokeStyle = '#fff3b0';
    ctx.lineWidth = 2;
    roundRect(ctx, -w / 2, -h / 2, w, h, 7);
    ctx.stroke();
    ctx.fillStyle = '#fff3b0';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('★', 0, -h / 2 - 6);
  }
  if (isPlayer) {
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    roundRect(ctx, -w / 2 - 5, -h / 2 - 5, w + 10, h + 10, 9);
    ctx.stroke();
    ctx.setLineDash([]);
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

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function lighten(hex, amt) {
  const c = hexToRgb(hex);
  const f = (v) => Math.max(0, Math.min(255, v + amt));
  return `rgb(${f(c.r)},${f(c.g)},${f(c.b)})`;
}

function darken(hex, amt) {
  return lighten(hex, -amt);
}

function drawWorld(ctx, world, camX, camY, vw, vh) {
  // Ground.
  ctx.fillStyle = '#b8a888';
  ctx.fillRect(camX - 40, camY - 40, vw + 80, vh + 80);
  // Sidewalk blocks.
  ctx.fillStyle = '#cbbd9c';
  for (let bx = 0; bx < WORLD_W / ROAD; bx++) {
    for (let by = 0; by < WORLD_H / ROAD; by++) {
      const x = bx * ROAD + ROAD_W;
      const y = by * ROAD + ROAD_W;
      if (x + ROAD < camX - 20 || x > camX + vw + 20) continue;
      if (y + ROAD < camY - 20 || y > camY + vh + 20) continue;
      ctx.fillRect(x, y, ROAD - ROAD_W, ROAD - ROAD_W);
    }
  }
  // Parks.
  for (const p of world.parks) {
    if (p.x > camX + vw || p.y > camY + vh || p.x + p.w < camX || p.y + p.h < camY) continue;
    ctx.fillStyle = '#7fbf6a';
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = '#93cf7d';
    ctx.beginPath();
    ctx.ellipse(p.x + p.w / 2, p.y + p.h / 2, p.w * 0.32, p.h * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Roads.
  ctx.fillStyle = '#3d4450';
  for (let i = 0; i <= WORLD_W / ROAD; i++) {
    ctx.fillRect(i * ROAD, camY - 40, ROAD_W, vh + 80);
    ctx.fillRect(camX - 40, i * ROAD, vw + 80, ROAD_W);
  }
  // Lane markings.
  ctx.fillStyle = '#f5d76e';
  ctx.strokeStyle = 'rgba(245,215,110,0.9)';
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 30]);
  for (let i = 0; i <= WORLD_W / ROAD; i++) {
    const cx = i * ROAD + ROAD_W / 2;
    ctx.beginPath();
    ctx.moveTo(cx, camY - 40);
    ctx.lineTo(cx, camY + vh + 40);
    ctx.stroke();
    const cy = i * ROAD + ROAD_W / 2;
    ctx.beginPath();
    ctx.moveTo(camX - 40, cy);
    ctx.lineTo(camX + vw + 40, cy);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // Crosswalks at intersections.
  ctx.fillStyle = 'rgba(240,240,230,0.75)';
  for (let ix = 0; ix <= WORLD_W / ROAD; ix++) {
    for (let iy = 0; iy <= WORLD_H / ROAD; iy++) {
      const x = ix * ROAD;
      const y = iy * ROAD;
      if (x < camX - 120 || x > camX + vw + 20 || y < camY - 120 || y > camY + vh + 20) continue;
      for (let s = 0; s < 4; s++) {
        ctx.fillRect(x + 8 + s * 20, y + ROAD_W - 14, 12, 8);
        ctx.fillRect(x + ROAD_W - 14, y + 8 + s * 20, 8, 12);
      }
    }
  }
  // Buildings with windows + roof detail.
  for (const b of world.buildings) {
    if (b.x > camX + vw || b.y > camY + vh || b.x + b.w < camX || b.y + b.h < camY) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + 5, b.y + 7, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    if (b.windows) {
      ctx.fillStyle = 'rgba(255,240,190,0.85)';
      const cols = Math.max(1, Math.floor(b.w / 26));
      const rows = Math.max(1, Math.floor(b.h / 26));
      for (let cx = 0; cx < cols; cx++) {
        for (let cy = 0; cy < rows; cy++) {
          if ((cx * 7 + cy * 5 + b.id) % 3 === 0) continue;
          ctx.fillRect(b.x + 10 + cx * 26, b.y + 10 + cy * 26, 12, 14);
        }
      }
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
  }
  // Street lamps.
  for (const l of world.lamps) {
    if (l.x < camX - 30 || l.x > camX + vw + 30 || l.y < camY - 30 || l.y > camY + vh + 30) continue;
    ctx.fillStyle = '#5a6068';
    ctx.fillRect(l.x - 2, l.y - 2, 4, 4);
    ctx.fillStyle = 'rgba(255,240,170,0.9)';
    ctx.beginPath();
    ctx.arc(l.x, l.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Trees / palms.
  for (const t of world.trees) {
    if (t.x < camX - 40 || t.x > camX + vw + 40 || t.y < camY - 40 || t.y > camY + vh + 40) continue;
    if (t.palm) {
      ctx.strokeStyle = '#6a4a30';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(t.x, t.y);
      ctx.quadraticCurveTo(t.x + 4, t.y - t.r, t.x + 10, t.y - t.r - 6);
      ctx.stroke();
      ctx.strokeStyle = '#2f8f4f';
      ctx.lineWidth = 3;
      for (let f = 0; f < 5; f++) {
        const a = -Math.PI * (0.1 + f * 0.2);
        ctx.beginPath();
        ctx.moveTo(t.x + 10, t.y - t.r - 6);
        ctx.quadraticCurveTo(
          t.x + 10 + Math.cos(a) * 14, t.y - t.r - 6 + Math.sin(a) * 8,
          t.x + 10 + Math.cos(a) * 24, t.y - t.r - 6 + Math.sin(a) * 16,
        );
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = '#3f9142';
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#57ab5a';
      ctx.beginPath();
      ctx.arc(t.x - t.r * 0.3, t.y - t.r * 0.3, t.r * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawParticles(ctx, state) {
  for (const p of state.particles) {
    const life = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = life * (p.alpha || 0.9);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (0.5 + life * 0.5), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawSkids(ctx, state, camX, camY, vw, vh) {
  ctx.strokeStyle = 'rgba(20,20,20,0.55)';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  for (const s of state.skids) {
    if (s.x < camX - 60 || s.x > camX + vw + 60 || s.y < camY - 60 || s.y > camY + vh + 60) continue;
    ctx.globalAlpha = Math.max(0.12, s.life / 6);
    ctx.beginPath();
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawObjectiveMarker(ctx, state, camX, camY, vw, vh) {
  const obj = currentObjective(state);
  if (!obj || state.mode !== 'playing') return;
  const pulse = 1 + Math.sin(state.time * 4) * 0.15;
  const onScreen = obj.x > camX && obj.x < camX + vw && obj.y > camY && obj.y < camY + vh;
  if (onScreen) {
    ctx.save();
    ctx.translate(obj.x, obj.y);
    ctx.strokeStyle = obj.color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 34 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = obj.color;
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    // Bouncing arrow above the marker.
    const bob = Math.sin(state.time * 5) * 6;
    ctx.fillStyle = obj.color;
    ctx.beginPath();
    ctx.moveTo(0, -52 + bob);
    ctx.lineTo(-11, -70 + bob);
    ctx.lineTo(11, -70 + bob);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // Edge arrow pointing at off-screen objectives.
  if (!onScreen) {
    const px = state.player.inCar && state.car ? state.car.x : state.player.x;
    const py = state.player.inCar && state.car ? state.car.y : state.player.y;
    const ang = Math.atan2(obj.y - py, obj.x - px);
    const ex = camX + vw / 2 + Math.cos(ang) * (vw / 2 - 46);
    const ey = camY + vh / 2 + Math.sin(ang) * (vh / 2 - 46);
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(ang);
    ctx.fillStyle = obj.color;
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-10, -12);
    ctx.lineTo(-10, 12);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawPlayer(ctx, state) {
  const p = state.player;
  if (p.inCar) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(2, 4, 14, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body: teal jacket, dark jeans, cap.
  ctx.fillStyle = '#e74c3c';
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#16a085';
  ctx.beginPath();
  ctx.arc(3, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  // Gun direction nub.
  ctx.fillStyle = '#2c3e50';
  ctx.fillRect(8, -2, 10, 4);
  ctx.restore();
}

function drawCops(ctx, state, time) {
  for (const cop of state.cops) {
    ctx.save();
    ctx.translate(cop.x, cop.y);
    ctx.rotate(cop.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(2, 4, 25, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a2a4a';
    roundRect(ctx, -24, -12, 48, 24, 6);
    ctx.fill();
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(-14, -12, 28, 24);
    ctx.fillStyle = '#1a2a4a';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLICE', 0, 3);
    // Flashing light bar.
    const phase = Math.sin(cop.sirenPhase) > 0;
    ctx.fillStyle = phase ? '#ff2a2a' : '#2a7bff';
    ctx.beginPath();
    ctx.arc(-6, -8, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = phase ? '#2a7bff' : '#ff2a2a';
    ctx.beginPath();
    ctx.arc(6, -8, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawBullets(ctx, state) {
  for (const b of state.bullets) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(Math.atan2(b.vy, b.vx));
    // Bright tracer: yellow core with white-hot tip.
    ctx.fillStyle = 'rgba(255,225,77,0.55)';
    ctx.fillRect(-14, -3, 24, 6);
    ctx.fillStyle = '#fff6c8';
    ctx.fillRect(-10, -2, 18, 4);
    ctx.restore();
  }
  ctx.fillStyle = '#ff5a3c';
  for (const b of state.enemyBullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSpeedLines(ctx, state, vw, vh) {
  const speed = state.player.inCar && state.car ? Math.abs(state.car.speed) : 0;
  if (speed < 330) return;
  const intensity = Math.min(1, (speed - 330) / 220);
  ctx.strokeStyle = `rgba(255,255,255,${0.35 * intensity})`;
  ctx.lineWidth = 2;
  const cx = vw / 2;
  const cy = vh / 2;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + state.time * 0.4;
    const r1 = Math.min(vw, vh) * 0.42;
    const r2 = r1 + 60 + intensity * 70;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
    ctx.stroke();
  }
}

function drawLighting(ctx, state, vw, vh) {
  // Warm sun wash + soft radial light following the player car.
  const px = state.player.inCar && state.car ? state.car.x : state.player.x;
  const py = state.player.inCar && state.car ? state.car.y : state.player.y;
  const camX = state.camera.x;
  const camY = state.camera.y;
  const sx = px - camX;
  const sy = py - camY;
  const g = ctx.createRadialGradient(sx, sy, 60, sx, sy, 420);
  g.addColorStop(0, 'rgba(255,220,150,0.10)');
  g.addColorStop(0.6, 'rgba(255,200,120,0.04)');
  g.addColorStop(1, 'rgba(20,10,40,0.16)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, vw, vh);
  // Vignette.
  const v = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.42, vw / 2, vh / 2, Math.max(vw, vh) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(10,5,25,0.28)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, vw, vh);
}

function drawMinimap(ctx, state, vw, vh) {
  const size = 168;
  const mx = vw - size - 16;
  const my = 16;
  const scale = size / WORLD_W;
  const scaleY = size / WORLD_H;
  ctx.save();
  ctx.fillStyle = 'rgba(10,14,28,0.78)';
  roundRect(ctx, mx - 6, my - 6, size + 12, size * (WORLD_H / WORLD_W) + 12, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();
  const mh = size * (WORLD_H / WORLD_W);
  ctx.beginPath();
  ctx.rect(mx, my, size, mh);
  ctx.clip();
  ctx.fillStyle = '#2c3345';
  ctx.fillRect(mx, my, size, mh);
  ctx.strokeStyle = 'rgba(200,200,200,0.5)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= WORLD_W / ROAD; i++) {
    ctx.beginPath();
    ctx.moveTo(mx + i * ROAD * scale, my);
    ctx.lineTo(mx + i * ROAD * scale, my + mh);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(mx, my + i * ROAD * scaleY);
    ctx.lineTo(mx + size, my + i * ROAD * scaleY);
    ctx.stroke();
  }
  const obj = currentObjective(state);
  if (obj && state.mode === 'playing') {
    ctx.fillStyle = obj.color;
    ctx.beginPath();
    ctx.arc(mx + obj.x * scale, my + obj.y * scaleY, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const cop of state.cops) {
    ctx.fillStyle = '#3d8bff';
    ctx.beginPath();
    ctx.arc(mx + cop.x * scale, my + cop.y * scaleY, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  const px = state.player.inCar && state.car ? state.car.x : state.player.x;
  const py = state.player.inCar && state.car ? state.car.y : state.player.y;
  ctx.fillStyle = '#ffd700';
  ctx.beginPath();
  ctx.arc(mx + px * scale, my + py * scaleY, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

function drawHUD(ctx, state, vw, vh) {
  // Top-left: cash + health.
  ctx.save();
  ctx.fillStyle = 'rgba(10,14,28,0.72)';
  roundRect(ctx, 14, 14, 218, 64, 10);
  ctx.fill();
  ctx.fillStyle = '#2ecc71';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`$${state.cash.toLocaleString('en-US')}`, 28, 36);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(`LEGEND di $${LEGEND_CASH.toLocaleString('en-US')}`, 28, 60);
  // Health bar.
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  roundRect(ctx, 14, 86, 218, 12, 6);
  ctx.fill();
  ctx.fillStyle = state.health > 50 ? '#2ecc71' : state.health > 25 ? '#f39c12' : '#e74c3c';
  roundRect(ctx, 14, 86, 218 * Math.max(0, state.health) / 100, 12, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText(`HEALTH ${Math.max(0, Math.round(state.health))}`, 16, 106);
  // Wanted stars, top-center, animated.
  const cx = vw / 2;
  const blink = state.wanted > 0 && Math.sin(state.time * 7) > 0;
  ctx.fillStyle = 'rgba(10,14,28,0.72)';
  roundRect(ctx, cx - 108, 14, 216, 46, 10);
  ctx.fill();
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.textAlign = 'left';
  ctx.fillText('WANTED', cx - 96, 37);
  for (let i = 0; i < 3; i++) {
    const active = i < state.wanted;
    const starColor = !active ? 'rgba(255,255,255,0.22)'
      : i === 0 ? '#f7c948' : i === 1 ? '#f39c12' : '#e74c3c';
    const scale = active && blink ? 1.18 : 1;
    ctx.save();
    ctx.translate(cx - 18 + i * 34, 37);
    ctx.scale(scale, scale);
    ctx.fillStyle = starColor;
    ctx.font = '22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('★', 0, 8);
    ctx.restore();
  }
  // Mission tracker, left under health.
  if (state.mission) {
    const obj = currentObjective(state);
    ctx.fillStyle = 'rgba(10,14,28,0.72)';
    roundRect(ctx, 14, 122, 268, 62, 10);
    ctx.fill();
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText(`MISI ${state.mission.index + 1}: ${MISSION_NAMES[state.mission.index]}`, 26, 142);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '13px system-ui, sans-serif';
    if (state.mission.index === 1 || state.mission.index === 2) {
      ctx.fillText(`Waktu: ${Math.max(0, Math.ceil(state.mission.timer))} dtk`, 26, 164);
    } else if (obj) {
      ctx.fillText(obj.label, 26, 164);
    }
  } else if (state.missionIndex < 4 && state.mode === 'playing') {
    ctx.fillStyle = 'rgba(10,14,28,0.72)';
    roundRect(ctx, 14, 122, 268, 40, 10);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('Tekan M untuk mulai misi berikutnya', 26, 147);
  }
  // Speed, bottom-right.
  if (state.player.inCar && state.car) {
    const kmh = Math.round(Math.abs(state.car.speed) * 0.32);
    ctx.fillStyle = 'rgba(10,14,28,0.72)';
    roundRect(ctx, vw - 150, vh - 74, 136, 60, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${kmh}`, vw - 46, vh - 46);
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText('km/h', vw - 26, vh - 46);
  }
  // Controls hint, bottom-left.
  ctx.fillStyle = 'rgba(10,14,28,0.55)';
  roundRect(ctx, 14, vh - 40, 430, 26, 8);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('WASD gerak/nyetir · E curi mobil · Spasi/Klik tembak · M misi · P jeda · R klakson', 24, vh - 27);
  // Banner (mission reward).
  if (state.banner && state.time < state.banner.until) {
    const alpha = Math.min(1, (state.banner.until - state.time) / 0.6);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(10,14,28,0.8)';
    roundRect(ctx, vw / 2 - 230, vh * 0.3, 460, 84, 12);
    ctx.fill();
    ctx.fillStyle = '#2ecc71';
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(state.banner.title, vw / 2, vh * 0.3 + 38);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText(state.banner.sub, vw / 2, vh * 0.3 + 66);
    ctx.globalAlpha = 1;
  }
  // Toast.
  if (state.toast && state.time < state.toast.until) {
    ctx.globalAlpha = Math.min(1, (state.toast.until - state.time) / 0.5);
    ctx.fillStyle = 'rgba(10,14,28,0.85)';
    const tw = ctx.measureText(state.toast.text).width + 36;
    roundRect(ctx, vw / 2 - tw / 2, vh - 116, tw, 34, 9);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(state.toast.text, vw / 2, vh - 99);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawMenuPanel(ctx, vw, vh, lines, buttons) {
  ctx.fillStyle = 'rgba(8,10,24,0.72)';
  ctx.fillRect(0, 0, vw, vh);
  const pw = 620;
  const ph = 90 + lines.length * 30 + buttons.length * 54;
  const px = vw / 2 - pw / 2;
  const py = vh / 2 - ph / 2;
  ctx.fillStyle = 'rgba(16,20,40,0.95)';
  roundRect(ctx, px, py, pw, ph, 16);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,215,0,0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();
  let y = py + 52;
  ctx.textAlign = 'center';
  for (const line of lines) {
    ctx.fillStyle = line.color || '#fff';
    ctx.font = line.font || '16px system-ui, sans-serif';
    ctx.fillText(line.text, vw / 2, y);
    y += line.gap || 30;
  }
  y += 8;
  for (const b of buttons) {
    ctx.fillStyle = b.primary ? '#e8a33d' : 'rgba(255,255,255,0.14)';
    roundRect(ctx, vw / 2 - 170, y, 340, 42, 9);
    ctx.fill();
    ctx.fillStyle = b.primary ? '#1a1206' : '#fff';
    // Shrink long labels so they never overflow the button.
    let fontSize = 17;
    ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
    const tw = ctx.measureText(b.label).width;
    if (tw > 318) {
      fontSize = Math.max(11, Math.floor(17 * 318 / tw));
      ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
    }
    ctx.fillText(b.label, vw / 2, y + 27);
    y += 54;
  }
}

export function render(ctx, state, world, vw, vh) {
  const cam = state.camera;
  const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
  const shakeY = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
  drawParallax(ctx, cam.x, cam.y, vw, vh, state.time);
  ctx.save();
  ctx.translate(-cam.x + shakeX, -cam.y + shakeY);
  drawWorld(ctx, world, cam.x, cam.y, vw, vh);
  drawSkids(ctx, state, cam.x, cam.y, vw, vh);
  // Gold coupe (mission 4).
  if (state.goldCoupe && !state.goldCoupe.stolen) {
    drawCarShape(ctx, {
      x: state.goldCoupe.x, y: state.goldCoupe.y, angle: -0.4,
      color: '#ffd700', gold: true, w: 48, h: 23, brakeLight: false,
    }, false);
  }
  for (const car of state.cars) {
    if (car.x < cam.x - 120 || car.x > cam.x + vw + 120) continue;
    if (car.y < cam.y - 120 || car.y > cam.y + vh + 120) continue;
    drawCarShape(ctx, car, false);
  }
  if (state.car) drawCarShape(ctx, state.car, true);
  drawCops(ctx, state, state.time);
  // Pedestrians.
  for (const ped of state.peds) {
    if (ped.x < cam.x - 40 || ped.x > cam.x + vw + 40) continue;
    if (ped.y < cam.y - 40 || ped.y > cam.y + vh + 40) continue;
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.arc(ped.x + 2, ped.y + 3, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  drawPlayer(ctx, state);
  drawBullets(ctx, state);
  drawParticles(ctx, state);
  drawObjectiveMarker(ctx, state, cam.x, cam.y, vw, vh);
  ctx.restore();

  drawSpeedLines(ctx, state, vw, vh);
  drawLighting(ctx, state, vw, vh);

  if (state.mode === 'playing' || state.mode === 'paused' || state.mode === 'busted' || state.mode === 'wasted' || state.mode === 'legend') {
    drawHUD(ctx, state, vw, vh);
    drawMinimap(ctx, state, vw, vh);
  }

  if (state.mode === 'boot') {
    const save = loadGame();
    const lines = [
      { text: 'SOLARA CITY', font: 'bold 54px system-ui, sans-serif', color: '#ffd700', gap: 58 },
      { text: 'Kota terbuka di tepi pantai — curi mobil, kabur dari polisi, jadi legenda.', font: '16px system-ui, sans-serif', color: '#dfe6f2', gap: 30 },
      { text: 'WASD gerak / nyetir · E curi mobil · Spasi / Klik tembak · M misi · P jeda', font: '14px system-ui, sans-serif', color: '#9fb0c8', gap: 30 },
      { text: '4 misi · $3.100 = SOLARA LEGEND · progres tersimpan otomatis', font: '14px system-ui, sans-serif', color: '#9fb0c8', gap: 34 },
    ];
    const buttons = [{ label: '▶  MULAI', primary: true }];
    if (save) buttons.push({ label: `LANJUTKAN — $${save.cash.toLocaleString('en-US')} · Misi ${Math.min(4, save.missionIndex + 1)}/4` });
    buttons.push({ label: 'KONTROL: E curi · Spasi tembak · M misi · P jeda · R klakson' });
    drawMenuPanel(ctx, vw, vh, lines, buttons);
  } else if (state.mode === 'paused') {
    drawMenuPanel(ctx, vw, vh, [
      { text: 'JEDA', font: 'bold 40px system-ui, sans-serif', color: '#ffd700', gap: 52 },
      { text: `Cash $${state.cash.toLocaleString('en-US')} · Misi ${Math.min(4, state.missionIndex + 1)}/4 · Wanted ${state.wanted}★`, font: '15px system-ui, sans-serif', color: '#dfe6f2', gap: 34 },
    ], [
      { label: '▶  LANJUTKAN', primary: true },
      { label: '↺  MULAI ULANG' },
      { label: 'WASD gerak · E curi · Spasi tembak · M misi · P jeda' },
    ]);
  } else if (state.mode === 'busted') {
    drawMenuPanel(ctx, vw, vh, [
      { text: 'BUSTED!', font: 'bold 46px system-ui, sans-serif', color: '#e74c3c', gap: 56 },
      { text: 'Polisi menangkapmu. Sebagian cash disita — misi aktif bisa diulang.', font: '16px system-ui, sans-serif', color: '#dfe6f2', gap: 34 },
      { text: `Cash tersisa: $${state.cash.toLocaleString('en-US')}`, font: '15px system-ui, sans-serif', color: '#ffd700', gap: 34 },
    ], [
      { label: '↻  RESPAWN', primary: true },
      { label: 'Tekan Enter untuk respawn' },
    ]);
  } else if (state.mode === 'wasted') {
    drawMenuPanel(ctx, vw, vh, [
      { text: 'WASTED', font: 'bold 46px system-ui, sans-serif', color: '#e74c3c', gap: 56 },
      { text: 'Kamu tumbang. Kembali dari checkpoint terakhir.', font: '16px system-ui, sans-serif', color: '#dfe6f2', gap: 34 },
      { text: `Cash: $${state.cash.toLocaleString('en-US')} · Misi ${Math.min(4, state.missionIndex + 1)}/4`, font: '15px system-ui, sans-serif', color: '#ffd700', gap: 34 },
    ], [
      { label: '↻  COBA LAGI', primary: true },
      { label: 'Tekan Enter untuk retry' },
    ]);
  } else if (state.mode === 'legend') {
    drawMenuPanel(ctx, vw, vh, [
      { text: '★ SOLARA LEGEND ★', font: 'bold 44px system-ui, sans-serif', color: '#ffd700', gap: 56 },
      { text: 'Semua 4 misi selesai. $3.100 di tangan — kota ini milikmu.', font: '17px system-ui, sans-serif', color: '#dfe6f2', gap: 32 },
      { text: `Coupe emas di garasi · ${state.stats.missionsDone} misi · ${state.stats.steals} mobil dicuri`, font: '15px system-ui, sans-serif', color: '#9fb0c8', gap: 34 },
    ], [
      { label: '▶  MAIN LAGI DI KOTA', primary: true },
      { label: 'Progres tersimpan — Continue tersedia di boot screen' },
    ]);
  }
}
