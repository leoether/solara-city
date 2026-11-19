// SOLARA CITY — render.js
// Semua gambar: kamera mengikuti pemain, parallax langit/bukit/pohon,
// kota (jalan, trotoar, gedung, taman, lampu), mobil, pejalan, polisi,
// partikel (asap, api, debu), skid marks, speed lines, dan pencahayaan
// radial yang mengikuti mobil pemain.

import { WORLD, COLORS } from './config.js';
import { clamp, mulberry32 } from './random.js';

export function createFx() {
  return {
    particles: [],   // {x,y,vx,vy,life,maxLife,size,color,grav}
    skids: [],       // {x,y,angle,life}
    shake: 0,
    flash: 0,
    addShake(amount) { this.shake = Math.min(22, this.shake + amount); },
    exhaust(x, y) {
      this.particles.push({ x, y, vx: (Math.random() - 0.5) * 24, vy: (Math.random() - 0.5) * 24 - 12, life: 0.7, maxLife: 0.7, size: 7, color: '150,150,150', grav: -14 });
    },
    crashSparks(x, y, n) { this.sparks(x, y, n); },
    sparks(x, y, n) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 120 + Math.random() * 260;
        this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.45, maxLife: 0.45, size: 3, color: '255,190,60', grav: 60 });
      }
    },
    explosion(x, y) {
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 60 + Math.random() * 320;
        this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.8, maxLife: 0.8, size: 5, color: i % 3 === 0 ? '255,90,40' : '255,180,60', grav: 40 });
      }
      this.addShake(16);
      this.flash = 0.25;
    },
    muzzle(x, y) {
      this.particles.push({ x, y, vx: 0, vy: 0, life: 0.08, maxLife: 0.08, size: 12, color: '255,230,120', grav: 0 });
    },
    dust(x, y) {
      this.particles.push({ x, y, vx: (Math.random() - 0.5) * 40, vy: (Math.random() - 0.5) * 40, life: 0.5, maxLife: 0.5, size: 9, color: '190,170,140', grav: 0 });
    },
    skidMark(x, y, angle) {
      this.skids.push({ x, y, angle, life: 5 });
      if (this.skids.length > 220) this.skids.shift();
    },
    step(dt) {
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += p.grav * dt;
        if (p.life <= 0) this.particles.splice(i, 1);
      }
      for (let i = this.skids.length - 1; i >= 0; i--) {
        this.skids[i].life -= dt;
        if (this.skids[i].life <= 0) this.skids.splice(i, 1);
      }
      this.shake = Math.max(0, this.shake - dt * 34);
      this.flash = Math.max(0, this.flash - dt);
    },
  };
}

export function createCamera(w, h) {
  return { x: 0, y: 0, w, h, zoom: 1 };
}

// Gambar satu frame penuh. ctx sudah di-resize ke ukuran canvas.
export function drawFrame(ctx, game, fx, dt) {
  const { city, player, cops, traffic, peds, parked, combat, missions, wanted } = game;
  const cam = game.camera;
  const W = ctx.canvas.width, H = ctx.canvas.height;

  // Kamera: ikuti pemain dengan sedikit look-ahead arah gerak.
  const focusX = player.inCar ? player.car.x : player.x;
  const focusY = player.inCar ? player.car.y : player.y;
  const lookX = player.inCar ? player.car.vx * 0.22 : 0;
  const lookY = player.inCar ? player.car.vy * 0.22 : 0;
  cam.x += ((focusX + lookX - W / 2) - cam.x) * Math.min(1, dt * 5);
  cam.y += ((focusY + lookY - H / 2) - cam.y) * Math.min(1, dt * 5);
  cam.x = clamp(cam.x, -120, WORLD.size - W + 120);
  cam.y = clamp(cam.y, -120, WORLD.size - H + 120);

  const shx = fx.shake > 0.2 ? (Math.random() - 0.5) * fx.shake : 0;
  const shy = fx.shake > 0.2 ? (Math.random() - 0.5) * fx.shake : 0;
  const ox = -cam.x + shx, oy = -cam.y + shy;

  // --- Langit + parallax: matahari terbenam, bukit jauh, pepohonan ---
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#ff9a5c');
  sky.addColorStop(0.45, '#ff7e6b');
  sky.addColorStop(1, '#7a4a8a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  // Matahari.
  ctx.save();
  ctx.fillStyle = '#ffd98a';
  ctx.beginPath();
  ctx.arc(W * 0.78 - cam.x * 0.02, 110 - cam.y * 0.02, 46, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Bukit jauh (parallax 0.15) + baris pohon (parallax 0.35).
  drawHills(ctx, cam, 0.15, '#5a3a6e', 150);
  drawHills(ctx, cam, 0.35, '#3f5a3a', 260);
  drawTreeLine(ctx, cam, 0.55, 330);

  // --- Tanah kota ---
  ctx.save();
  ctx.translate(ox, oy);
  ctx.fillStyle = '#4a5a3a';
  ctx.fillRect(0, 0, WORLD.size, WORLD.size);

  // Blok tanah + trotoar.
  for (const b of city.blocks) {
    ctx.fillStyle = COLORS.sidewalk;
    ctx.fillRect(b.x - WORLD.sidewalk, b.y - WORLD.sidewalk, b.w + WORLD.sidewalk * 2, b.h + WORLD.sidewalk * 2);
    ctx.fillStyle = '#3d4a35';
    ctx.fillRect(b.x, b.y, b.w, b.h);
  }
  // Taman.
  for (const p of city.parks) {
    ctx.fillStyle = COLORS.park;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    for (const t of p.trees) {
      ctx.fillStyle = '#2a7a35';
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3fae4e';
      ctx.beginPath(); ctx.arc(t.x - 3, t.y - 3, t.r * 0.6, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Jalan aspal + marka.
  ctx.fillStyle = COLORS.asphalt;
  for (const r of city.roads) ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = COLORS.asphaltLine;
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 22]);
  ctx.beginPath();
  for (let g = 0; g <= WORLD.size; g += WORLD.block) {
    ctx.moveTo(0, g); ctx.lineTo(WORLD.size, g);
    ctx.moveTo(g, 0); ctx.lineTo(g, WORLD.size);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  // Zebra cross di persimpangan tengah kota.
  ctx.fillStyle = 'rgba(240,240,230,0.85)';
  for (let gx = WORLD.block; gx < WORLD.size; gx += WORLD.block * 2) {
    for (let gy = WORLD.block; gy < WORLD.size; gy += WORLD.block * 2) {
      for (let i = 0; i < 5; i++) ctx.fillRect(gx - 44 + i * 18, gy - 44, 9, 26);
    }
  }
  // Gedung: bayangan + atap + jendela.
  for (const b of city.buildings) {
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(b.x + 7, b.y + 9, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
    // Jendela dari seed gedung.
    const wrng = mulberry32(b.winSeed);
    ctx.fillStyle = 'rgba(255,230,150,0.85)';
    const cols = Math.max(2, Math.floor(b.w / 26));
    const rows = Math.max(2, Math.floor(b.h / 26));
    for (let cx = 0; cx < cols; cx++) {
      for (let cy = 0; cy < rows; cy++) {
        if (wrng() < 0.55) ctx.fillRect(b.x + 10 + cx * 24, b.y + 10 + cy * 24, 11, 13);
      }
    }
  }
  // Lampu jalan (hanya yang terlihat).
  ctx.fillStyle = '#2a2f36';
  for (const l of city.lamps) {
    if (l.x < cam.x - 20 || l.x > cam.x + W + 20 || l.y < cam.y - 20 || l.y > cam.y + H + 20) continue;
    ctx.fillRect(l.x - 2, l.y - 2, 4, 4);
    ctx.fillStyle = 'rgba(255,220,130,0.9)';
    ctx.beginPath(); ctx.arc(l.x, l.y, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a2f36';
  }
  // Skid marks.
  ctx.strokeStyle = 'rgba(15,15,15,0.5)';
  ctx.lineWidth = 5;
  for (const s of fx.skids) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle);
    ctx.globalAlpha = Math.min(1, s.life / 2);
    ctx.beginPath(); ctx.moveTo(-14, -8); ctx.lineTo(14, -8); ctx.moveTo(-14, 8); ctx.lineTo(14, 8); ctx.stroke();
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // Marker misi (pickup / drop).
  drawMissionMarker(ctx, game);

  // Mobil parkir, traffic, coupe emas.
  for (const c of parked) drawCar(ctx, c.x, c.y, c.angle, c.color, false, 0);
  for (const c of traffic) drawCar(ctx, c.x, c.y, c.angle, c.color, false, 0);
  for (const cop of cops) drawCopCar(ctx, cop);
  if (player.inCar) drawCar(ctx, player.car.x, player.car.y, player.car.angle, player.car.color, player.car.gold, player.car.skid);

  // Pejalan kaki.
  for (const p of peds) {
    const bob = Math.sin(p.bob) * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y + 8, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y + bob * 0.3, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.fillRect(p.x - 6, p.y + 4, 12, 9);
  }

  // Pemain jalan kaki.
  if (!player.inCar) {
    const bob = Math.sin(game.time * 11) * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(player.x, player.y + 10, 11, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.aimAngle);
    // Senjata.
    ctx.fillStyle = '#1c1c1c';
    ctx.fillRect(8, -2, 16, 4);
    ctx.restore();
    ctx.fillStyle = '#e8b23a';
    ctx.beginPath(); ctx.arc(player.x, player.y + bob * 0.3, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#24344d';
    ctx.fillRect(player.x - 8, player.y + 2, 16, 12);
    // Muzzle flash.
    if (combat.muzzle > 0) {
      ctx.fillStyle = 'rgba(255,230,120,0.9)';
      ctx.beginPath();
      ctx.arc(player.x + Math.cos(player.aimAngle) * 26, player.y + Math.sin(player.aimAngle) * 26, 9, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Peluru.
  ctx.fillStyle = '#ffe98a';
  for (const b of combat.bullets) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(Math.atan2(b.vy, b.vx));
    ctx.fillRect(-7, -2, 14, 4);
    ctx.restore();
  }

  // Partikel.
  for (const p of fx.particles) {
    ctx.fillStyle = `rgba(${p.color},${clamp(p.life / p.maxLife, 0, 1) * 0.75})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (1 + (1 - p.life / p.maxLife)), 0, Math.PI * 2);
    ctx.fill();
  }

  // Pencahayaan dinamis: radial mengikuti mobil pemain + gelap tepi.
  const lx = player.inCar ? player.car.x : player.x;
  const ly = player.inCar ? player.car.y : player.y;
  const glow = ctx.createRadialGradient(lx, ly, 60, lx, ly, 520);
  glow.addColorStop(0, 'rgba(255,220,150,0.10)');
  glow.addColorStop(1, 'rgba(0,0,20,0.0)');
  ctx.fillStyle = glow;
  ctx.fillRect(lx - 520, ly - 520, 1040, 1040);
  ctx.fillStyle = 'rgba(8,8,28,0.14)';
  ctx.fillRect(cam.x - 20, cam.y - 20, W + 40, H + 40);
  const vig = ctx.createRadialGradient(lx, ly, 200, lx, ly, 640);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.0)');
  ctx.fillStyle = vig;
  ctx.fillRect(lx - 640, ly - 640, 1280, 1280);

  ctx.restore();

  // Speed lines saat ngebut (di ruang layar).
  const spd = player.inCar ? Math.abs(player.car.speed) : 0;
  if (spd > 380) {
    const n = Math.floor((spd - 380) / 22);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r0 = 260 + Math.random() * 220;
      const x0 = W / 2 + Math.cos(a) * r0;
      const y0 = H / 2 + Math.sin(a) * r0;
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 + Math.cos(a) * 42, y0 + Math.sin(a) * 42);
    }
    ctx.stroke();
  }
  if (fx.flash > 0) {
    ctx.fillStyle = `rgba(255,240,200,${fx.flash * 1.6})`;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawHills(ctx, cam, factor, color, baseY) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, baseY + 40);
  const off = cam.x * factor;
  for (let x = -100; x <= ctx.canvas.width + 100; x += 90) {
    const h = 34 + 26 * Math.sin((x + off) * 0.006) + 14 * Math.sin((x + off) * 0.017 + 2);
    ctx.lineTo(x, baseY - h);
  }
  ctx.lineTo(ctx.canvas.width, baseY + 40);
  ctx.closePath();
  ctx.fill();
}

function drawTreeLine(ctx, cam, factor, baseY) {
  const off = cam.x * factor;
  ctx.fillStyle = '#24402a';
  for (let x = -60; x < ctx.canvas.width + 60; x += 46) {
    const h = 22 + 10 * Math.sin((x + off) * 0.05);
    ctx.beginPath();
    ctx.arc(x + ((off * 0.3) % 46), baseY - h / 2, h * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCar(ctx, x, y, angle, color, gold, skid) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.fillRect(-26, -12, 52, 26);
  // Bodi.
  ctx.fillStyle = gold ? '#f2c14e' : color;
  ctx.beginPath();
  ctx.roundRect(-26, -13, 52, 26, 7);
  ctx.fill();
  if (gold) {
    ctx.strokeStyle = '#fff0b0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-26, -13, 52, 26, 7);
    ctx.stroke();
  }
  // Kabin + kaca.
  ctx.fillStyle = 'rgba(20,28,38,0.9)';
  ctx.beginPath();
  ctx.roundRect(-8, -10, 18, 20, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(160,210,235,0.85)';
  ctx.fillRect(-4, -9, 9, 18);
  // Lampu depan.
  ctx.fillStyle = '#ffe9a0';
  ctx.fillRect(23, -11, 3, 5);
  ctx.fillRect(23, 6, 3, 5);
  ctx.fillStyle = '#ff5a4a';
  ctx.fillRect(-26, -11, 3, 5);
  ctx.fillRect(-26, 6, 3, 5);
  if (skid > 0.4) {
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(-26, -13, 52, 26);
  }
  ctx.restore();
}

function drawCopCar(ctx, cop) {
  drawCar(ctx, cop.x, cop.y, cop.angle, '#1c2733', false, 0);
  const on = Math.sin(cop.lightPhase) > 0;
  ctx.save();
  ctx.translate(cop.x, cop.y);
  ctx.rotate(cop.angle);
  ctx.fillStyle = on ? '#ff3b30' : '#2f7bff';
  ctx.beginPath(); ctx.arc(2, -8, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = on ? '#2f7bff' : '#ff3b30';
  ctx.beginPath(); ctx.arc(2, 8, 5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // Halo cahaya sirene.
  ctx.fillStyle = on ? 'rgba(255,60,50,0.18)' : 'rgba(60,120,255,0.18)';
  ctx.beginPath();
  ctx.arc(cop.x, cop.y, 44, 0, Math.PI * 2);
  ctx.fill();
}

function drawMissionMarker(ctx, game) {
  const { missions: m, time } = game;
  const cur = game.missionDef;
  if (!cur) return;
  let pt = null, color = '#39d353', label = '';
  if (m.phase === 'toPickup') { pt = cur.pickup; color = '#f2c14e'; label = 'AMBIL'; }
  else if (m.phase === 'toDrop') { pt = cur.drop; color = '#39d353'; label = 'ANTAR'; }
  if (!pt) return;
  const pulse = 1 + Math.sin(time * 5) * 0.14;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(pt.x, pt.y, 34 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = color + '44';
  ctx.beginPath();
  ctx.arc(pt.x, pt.y, 30 * pulse, 0, Math.PI * 2);
  ctx.fill();
  // Panah ke bawah.
  const by = pt.y - 52 + Math.sin(time * 4) * 6;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(pt.x, by + 16); ctx.lineTo(pt.x - 12, by - 6); ctx.lineTo(pt.x + 12, by - 6);
  ctx.closePath(); ctx.fill();
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.fillText(label, pt.x, pt.y + 4);
  ctx.restore();
}
