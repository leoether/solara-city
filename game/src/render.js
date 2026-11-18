// SOLARA CITY v3 — rendering: night city with layered parallax, dynamic
// lighting around the player, particles (exhaust smoke, crash sparks, brake
// dust), skid marks, speed lines and screen shake. All 2D canvas.

import { WORLD, COLORS } from './config.js';
import { clamp } from './random.js';

export class Renderer {
  constructor(canvas, city) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.city = city;
    this.cam = { x: 0, y: 0 };
    this.shakeT = 0;
    this.shakeMag = 0;
    this.particles = [];
    this.skids = [];
    this.stars = [];
    for (let i = 0; i < 130; i++) {
      this.stars.push({
        x: Math.random() * 1400, y: Math.random() * 800,
        r: Math.random() * 1.6 + 0.4, tw: Math.random() * Math.PI * 2,
      });
    }
    this.glowSpots = [];
    for (let i = 0; i < 14; i++) {
      this.glowSpots.push({
        x: Math.random() * WORLD.size, y: Math.random() * WORLD.size,
        r: 260 + Math.random() * 320,
        hue: Math.random() < 0.5 ? '255,190,90' : '90,140,255',
      });
    }
  }

  addShake(mag) {
    this.shakeMag = Math.max(this.shakeMag, mag);
    this.shakeT = 0.45;
  }

  spawnSmoke(x, y, vx, vy) {
    if (this.particles.length > 420) return;
    this.particles.push({
      kind: 'smoke', x, y, vx: vx + (Math.random() - 0.5) * 14, vy: vy + (Math.random() - 0.5) * 14,
      life: 0.9, maxLife: 0.9, size: 5 + Math.random() * 5,
    });
  }

  spawnSparks(x, y, n = 14) {
    for (let i = 0; i < n; i++) {
      if (this.particles.length > 420) break;
      const a = Math.random() * Math.PI * 2;
      const s = 120 + Math.random() * 260;
      this.particles.push({
        kind: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 0.5, maxLife: 0.5, size: 2 + Math.random() * 2,
      });
    }
  }

  spawnDust(x, y) {
    if (this.particles.length > 420) return;
    this.particles.push({
      kind: 'dust', x, y, vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 30,
      life: 0.7, maxLife: 0.7, size: 6 + Math.random() * 6,
    });
  }

  spawnFlash(x, y) {
    if (this.particles.length > 420) return;
    this.particles.push({
      kind: 'flash', x, y, vx: 0, vy: 0, life: 0.08, maxLife: 0.08, size: 26,
    });
  }

  addSkid(x1, y1, x2, y2) {
    if (this.skids.length > 500) this.skids.shift();
    this.skids.push({ x1, y1, x2, y2, life: 6 });
  }

  updateFx(dt) {
    this.shakeT = Math.max(0, this.shakeT - dt);
    if (this.shakeT <= 0) this.shakeMag = 0;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'smoke') { p.size += 14 * dt; p.vx *= 0.96; p.vy *= 0.96; }
      if (p.kind === 'spark') { p.vx *= 0.9; p.vy *= 0.9; }
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.skids.length - 1; i >= 0; i--) {
      this.skids[i].life -= dt;
      if (this.skids[i].life <= 0) this.skids.splice(i, 1);
    }
  }

  follow(x, y, dt) {
    const tx = clamp(x, this.canvas.width / 2 - 200, WORLD.size - this.canvas.width / 2 + 200);
    const ty = clamp(y, this.canvas.height / 2 - 200, WORLD.size - this.canvas.height / 2 + 200);
    const k = Math.min(1, dt * 5);
    this.cam.x += (tx - this.cam.x) * k;
    this.cam.y += (ty - this.cam.y) * k;
  }

  snapTo(x, y) {
    this.cam.x = clamp(x, this.canvas.width / 2 - 200, WORLD.size - this.canvas.width / 2 + 200);
    this.cam.y = clamp(y, this.canvas.height / 2 - 200, WORLD.size - this.canvas.height / 2 + 200);
  }

  render(G) {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const now = G.time;
    // --- screen shake ---
    let sx = 0;
    let sy = 0;
    if (this.shakeT > 0) {
      const m = this.shakeMag * (this.shakeT / 0.45);
      sx = (Math.random() - 0.5) * m;
      sy = (Math.random() - 0.5) * m;
    }
    // --- 1. night sky + parallax stars (slowest layer) ---
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#070a18');
    sky.addColorStop(0.55, '#0a0e1e');
    sky.addColorStop(1, '#0d1126');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    for (const s of this.stars) {
      const px = (((s.x - this.cam.x * 0.12) % 1400) + 1400) % 1400 - 60;
      const py = (((s.y - this.cam.y * 0.12) % 900) + 900) % 900 - 60;
      const a = 0.35 + 0.35 * Math.sin(now * 1.7 + s.tw);
      ctx.globalAlpha = Math.max(0.08, a);
      ctx.fillStyle = '#cdd8ff';
      ctx.beginPath();
      ctx.arc(px, py, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // --- 2. far district glow blobs (parallax 0.85) ---
    ctx.save();
    for (const g of this.glowSpots) {
      const gx = W / 2 + (g.x - this.cam.x) * 0.85;
      const gy = H / 2 + (g.y - this.cam.y) * 0.85;
      if (gx < -g.r || gx > W + g.r || gy < -g.r || gy > H + g.r) continue;
      const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, g.r);
      grad.addColorStop(0, `rgba(${g.hue},0.10)`);
      grad.addColorStop(1, `rgba(${g.hue},0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(gx - g.r, gy - g.r, g.r * 2, g.r * 2);
    }
    ctx.restore();

    // --- world space ---
    ctx.save();
    ctx.translate(Math.round(W / 2 - this.cam.x + sx), Math.round(H / 2 - this.cam.y + sy));
    const vx0 = this.cam.x - W / 2 - 80;
    const vy0 = this.cam.y - H / 2 - 80;
    const vx1 = this.cam.x + W / 2 + 80;
    const vy1 = this.cam.y + H / 2 + 80;
    const inView = (x, y, m = 80) => x > vx0 - m && x < vx1 + m && y > vy0 - m && y < vy1 + m;

    // Ground.
    ctx.fillStyle = '#11162a';
    ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
    // Parks.
    for (const p of this.city.parks) {
      if (!inView(p.x + p.w / 2, p.y + p.h / 2, Math.max(p.w, p.h))) continue;
      ctx.fillStyle = COLORS.grass;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.strokeStyle = COLORS.parkPath;
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y + p.h / 2);
      ctx.lineTo(p.x + p.w, p.y + p.h / 2);
      ctx.moveTo(p.x + p.w / 2, p.y);
      ctx.lineTo(p.x + p.w / 2, p.y + p.h);
      ctx.stroke();
    }
    // Roads.
    ctx.fillStyle = COLORS.asphalt;
    for (const rx of this.city.roadsX) ctx.fillRect(rx - WORLD.roadWidth / 2, 0, WORLD.roadWidth, WORLD.size);
    for (const ry of this.city.roadsY) ctx.fillRect(0, ry - WORLD.roadWidth / 2, WORLD.size, WORLD.roadWidth);
    // Road edge lines + centre dashes.
    ctx.strokeStyle = COLORS.asphaltLine;
    ctx.lineWidth = 2;
    for (const rx of this.city.roadsX) {
      ctx.beginPath();
      ctx.moveTo(rx - WORLD.roadWidth / 2 + 3, 0);
      ctx.lineTo(rx - WORLD.roadWidth / 2 + 3, WORLD.size);
      ctx.moveTo(rx + WORLD.roadWidth / 2 - 3, 0);
      ctx.lineTo(rx + WORLD.roadWidth / 2 - 3, WORLD.size);
      ctx.stroke();
    }
    for (const ry of this.city.roadsY) {
      ctx.beginPath();
      ctx.moveTo(0, ry - WORLD.roadWidth / 2 + 3);
      ctx.lineTo(WORLD.size, ry - WORLD.roadWidth / 2 + 3);
      ctx.moveTo(0, ry + WORLD.roadWidth / 2 - 3);
      ctx.lineTo(WORLD.size, ry + WORLD.roadWidth / 2 - 3);
      ctx.stroke();
    }
    ctx.fillStyle = COLORS.roadMark;
    for (const rx of this.city.roadsX) {
      for (let y = 40; y < WORLD.size; y += 72) {
        if (y < vy0 || y > vy1) continue;
        ctx.fillRect(rx - 2, y, 4, 34);
      }
    }
    for (const ry of this.city.roadsY) {
      for (let x = 40; x < WORLD.size; x += 72) {
        if (x < vx0 || x > vx1) continue;
        ctx.fillRect(x, ry - 2, 34, 4);
      }
    }
    // Buildings: soft shadow, roof, lit windows.
    for (const b of this.city.buildings) {
      if (!inView(b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w, b.h))) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(b.x + 7, b.y + 9, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
      for (const w of b.windows) {
        ctx.fillStyle = w.lit ? (w.warm > 0.5 ? '#ffd97a' : '#9fd8ff') : COLORS.windowDark;
        ctx.fillRect(b.x + w.dx, b.y + w.dy, 13, 15);
      }
    }
    // Trees (mid layer).
    for (const t of this.city.trees) {
      if (!inView(t.x, t.y)) continue;
      ctx.fillStyle = '#0d2b18';
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1d5c33';
      ctx.beginPath();
      ctx.arc(t.x - 2, t.y - 2, t.r * 0.72, 0, Math.PI * 2);
      ctx.fill();
    }
    // Street lamps (poles + glow handled in the light pass).
    ctx.fillStyle = '#8a93a8';
    for (const l of this.city.lamps) {
      if (!inView(l.x, l.y)) continue;
      ctx.fillRect(l.x - 2, l.y - 2, 4, 4);
    }
    // Skid marks.
    ctx.strokeStyle = 'rgba(8,8,12,0.55)';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    for (const s of this.skids) {
      ctx.globalAlpha = Math.min(0.6, s.life / 6);
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // Mission marker: pulsing ring + vertical beacon.
    if (G.missions.target) {
      const t = G.missions.target;
      const pulse = 1 + 0.18 * Math.sin(now * 4);
      ctx.strokeStyle = '#f5c542';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(t.x, t.y, 44 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(245,197,66,0.25)';
      ctx.beginPath();
      ctx.arc(t.x, t.y, 44 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f5c542';
      ctx.beginPath();
      ctx.arc(t.x, t.y, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    // Particles under cars: smoke / dust.
    for (const p of this.particles) {
      if (p.kind === 'smoke' || p.kind === 'dust') {
        const a = (p.life / p.maxLife) * (p.kind === 'smoke' ? 0.4 : 0.3);
        ctx.globalAlpha = a;
        ctx.fillStyle = p.kind === 'smoke' ? '#9aa3b2' : '#b09a72';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    // Cars.
    const allCars = [...G.traffic.cars, ...G.police.cars];
    for (const c of allCars) {
      if (!inView(c.x, c.y, 90)) continue;
      this._drawCar(ctx, c, now);
    }
    // Player car is in traffic.cars already when stolen (same object).
    // Pedestrians.
    for (const p of G.peds.list) {
      if (!inView(p.x, p.y)) continue;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.state === 'down' ? '#555' : p.shirt;
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e8b98a';
      ctx.beginPath();
      ctx.arc(4, 0, 3.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // Player on foot.
    if (!G.player.inCar) {
      const pl = G.player;
      ctx.save();
      ctx.translate(pl.x, pl.y);
      ctx.rotate(pl.angle);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.ellipse(2, 3, 13, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#22d3ee';
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0e7490';
      ctx.fillRect(6, -5, 9, 10);
      ctx.restore();
    }
    // Bullets: tracers + sparks / flashes.
    for (const b of G.combat.bullets) {
      ctx.strokeStyle = b.from === 'player' ? '#ffe066' : '#ff6b6b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(b.x - Math.cos(b.angle) * 16, b.y - Math.sin(b.angle) * 16);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    for (const p of this.particles) {
      if (p.kind === 'spark') {
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.fillStyle = '#ffb703';
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      } else if (p.kind === 'flash') {
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.fillStyle = '#fff3a3';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    // Near layer: foreground canopies drift slightly faster (parallax 1.08).
    ctx.save();
    ctx.globalAlpha = 0.5;
    for (const t of this.city.trees) {
      const fx = t.x + (t.x - this.cam.x) * 0.08;
      const fy = t.y + (t.y - this.cam.y) * 0.08;
      if (!inView(fx, fy)) continue;
      ctx.fillStyle = '#0a1f12';
      ctx.beginPath();
      ctx.arc(fx, fy, t.r * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.restore(); // world space

    // --- 3. dynamic lighting (screen space) ---
    const px = W / 2 + (G.player.x - this.cam.x);
    const py = H / 2 + (G.player.y - this.cam.y);
    const light = ctx.createRadialGradient(px, py, 60, px, py, Math.max(W, H) * 0.62);
    light.addColorStop(0, 'rgba(4,6,16,0)');
    light.addColorStop(0.55, 'rgba(4,6,16,0.12)');
    light.addColorStop(1, 'rgba(3,5,14,0.55)');
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, W, H);
    // Lamp glows + headlights (additive, capped).
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    let glows = 0;
    for (const l of this.city.lamps) {
      const lx = W / 2 + (l.x - this.cam.x);
      const ly = H / 2 + (l.y - this.cam.y);
      if (lx < -40 || lx > W + 40 || ly < -40 || ly > H + 40) continue;
      if (++glows > 60) break;
      const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, 46);
      g.addColorStop(0, 'rgba(255,214,130,0.20)');
      g.addColorStop(1, 'rgba(255,214,130,0)');
      ctx.fillStyle = g;
      ctx.fillRect(lx - 46, ly - 46, 92, 92);
    }
    const car = G.player.inCar ? G.player.car : null;
    if (car) {
      const hx = px + Math.cos(car.angle) * 34;
      const hy = py + Math.sin(car.angle) * 34;
      const hg = ctx.createRadialGradient(hx, hy, 0, hx, hy, 90);
      hg.addColorStop(0, 'rgba(255,244,180,0.28)');
      hg.addColorStop(1, 'rgba(255,244,180,0)');
      ctx.fillStyle = hg;
      ctx.fillRect(hx - 90, hy - 90, 180, 180);
    }
    ctx.restore();
    // --- 4. speed lines ---
    const spd = G.player.speed;
    if (spd > 380 && G.mode === 'playing') {
      const n = Math.min(14, Math.floor((spd - 380) / 14));
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.lineWidth = 2;
      for (let i = 0; i < n; i++) {
        const edge = i % 4;
        const t = (now * 2.4 + i * 0.37) % 1;
        let x1;
        let y1;
        let x2;
        let y2;
        const len = 60 + t * 90;
        if (edge === 0) { x1 = t * W; y1 = 8; x2 = x1; y2 = 8 + len; }
        else if (edge === 1) { x1 = t * W; y1 = H - 8; x2 = x1; y2 = H - 8 - len; }
        else if (edge === 2) { x1 = 8; y1 = t * H; x2 = 8 + len; y2 = y1; }
        else { x1 = W - 8; y1 = t * H; x2 = W - 8 - len; y2 = y1; }
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      ctx.restore();
    }
    // Hit flash (red vignette, brief).
    if (G.hitFlashT > 0) {
      ctx.fillStyle = `rgba(255,40,40,${Math.min(0.3, G.hitFlashT * 0.5)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  _drawCar(ctx, c, now) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.angle);
    if (c.wrecked) ctx.globalAlpha = 0.85;
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(2, 4, 25, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    // Body.
    ctx.fillStyle = c.gold ? '#f5c542' : c.color;
    if (c.police) ctx.fillStyle = '#e8edf5';
    const w = 46;
    const h = 22;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, 6);
    ctx.fill();
    // Gold coupe: glitter trim.
    if (c.gold) {
      ctx.strokeStyle = '#fff3b0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4, 5);
      ctx.stroke();
    }
    // Cabin + windshield.
    ctx.fillStyle = c.police ? '#1f2937' : 'rgba(10,14,24,0.85)';
    ctx.beginPath();
    ctx.roundRect(-6, -8, 16, 16, 3);
    ctx.fill();
    // Police livery: doors stripe + light bar.
    if (c.police) {
      ctx.fillStyle = '#111827';
      ctx.fillRect(-14, -h / 2, 20, 4);
      ctx.fillRect(-14, h / 2 - 4, 20, 4);
      const blink = Math.sin(now * 10) > 0;
      ctx.fillStyle = blink ? '#ef4444' : '#3b82f6';
      ctx.fillRect(-2, -h / 2 - 3, 7, 5);
      ctx.fillStyle = blink ? '#3b82f6' : '#ef4444';
      ctx.fillRect(6, -h / 2 - 3, 7, 5);
    }
    // Headlights.
    ctx.fillStyle = '#fff8c4';
    ctx.fillRect(w / 2 - 3, -h / 2 + 2, 3, 5);
    ctx.fillRect(w / 2 - 3, h / 2 - 7, 3, 5);
    // Taillights.
    ctx.fillStyle = '#ff2e2e';
    ctx.fillRect(-w / 2, -h / 2 + 2, 3, 5);
    ctx.fillRect(-w / 2, h / 2 - 7, 3, 5);
    if (c.wrecked) {
      ctx.strokeStyle = 'rgba(20,20,26,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-14, -8);
      ctx.lineTo(10, 8);
      ctx.moveTo(-14, 8);
      ctx.lineTo(10, -8);
      ctx.stroke();
    }
    ctx.restore();
  }
}
