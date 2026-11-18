// hud.js — DOM HUD (health, money, wanted stars, objective, toasts) + 2D minimap canvas.
import { CITY } from './config.js';

export class HUD {
  constructor() {
    this.el = {};
    for (const id of ['health-fill', 'health-text', 'money', 'wanted', 'objective', 'toast', 'speed', 'hint', 'mission-title', 'timer']) {
      this.el[id] = document.getElementById(id);
    }
    this.map = document.getElementById('minimap');
    this.mapCtx = this.map.getContext('2d');
  }
  update(game) {
    const p = game.player;
    const hp = Math.round(p.health);
    this.el['health-fill'].style.width = `${hp}%`;
    this.el['health-text'].textContent = `♥ ${hp}`;
    this.el['money'].textContent = `$${p.money.toLocaleString('en-US')}`;
    const stars = '★'.repeat(game.police.wanted) + '☆'.repeat(5 - game.police.wanted);
    this.el.wanted.textContent = stars;
    this.el.wanted.style.color = game.police.wanted >= 3 ? '#ff4444' : '#ffd94a';
    const m = game.missions.current;
    if (m) {
      this.el['mission-title'].textContent = `JOB ${m.id}: ${m.title}`;
      const t = game.missions.target;
      const d = t ? Math.round(Math.hypot(p.x - t.x, p.z - t.z)) : 0;
      let obj = m.objective;
      if (m.id === 2 && !game.missions.pickedUp) obj = 'Pick up the package at the docks';
      else if (m.id === 3 && game.missions.surviveLeft > 0) obj = `Survive the heat — ${Math.ceil(game.missions.surviveLeft)}s left`;
      this.el.objective.textContent = `${obj}  ·  ${d}m`;
      this.el.timer.textContent = m.timer ? `⏱ ${Math.ceil(game.missions.timer)}s` : '';
    } else if (game.missions.done) {
      this.el['mission-title'].textContent = 'SOLARA LEGEND ★';
      this.el.objective.textContent = 'All jobs done — free roam. The city is yours.';
      this.el.timer.textContent = '';
    }
    this.el.speed.textContent = p.driving ? `${Math.round(Math.abs(p.car.speed) * 3.6)} km/h` : '';
    if (game.missions.toastTime > 0) {
      this.el.toast.textContent = game.missions.toast;
      this.el.toast.style.opacity = '1';
    } else {
      this.el.toast.style.opacity = '0';
    }
    this.drawMinimap(game);
  }
  drawMinimap(game) {
    const c = this.mapCtx;
    const S = 180;
    const scale = S / 340; // world -170..170
    const toMap = (x, z) => [S / 2 + x * scale, S / 2 + z * scale];
    c.clearRect(0, 0, S, S);
    c.fillStyle = 'rgba(10, 24, 38, 0.85)';
    c.fillRect(0, 0, S, S);
    // ocean
    c.fillStyle = '#1d6fa8';
    const [, oy] = toMap(0, 150);
    c.fillRect(0, oy, S, S - oy);
    // blocks
    c.fillStyle = '#3d4a5c';
    for (const bx of [-90, -30, 30, 90]) {
      for (const bz of [-90, -30, 30, 90]) {
        const [x, y] = toMap(bx - 23, bz - 23);
        c.fillRect(x, y, 46 * scale, 46 * scale);
      }
    }
    // roads
    c.strokeStyle = '#8b98a8';
    c.lineWidth = 5;
    for (const r of CITY.ROADS) {
      const [x1] = toMap(r, 0);
      c.beginPath(); c.moveTo(x1, 0); c.lineTo(x1, S); c.stroke();
      const [, y1] = toMap(0, r);
      c.beginPath(); c.moveTo(0, y1); c.lineTo(S, y1); c.stroke();
    }
    const blip = (x, z, color, r = 4) => {
      const [mx, my] = toMap(x, z);
      c.fillStyle = color;
      c.beginPath(); c.arc(mx, my, r, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#fff';
      c.lineWidth = 1;
      c.stroke();
    };
    const t = game.missions.target;
    if (t) blip(t.x, t.z, '#ffd94a', 5);
    for (const car of game.traffic.cars) blip(car.x, car.z, '#9aa5b1', 2.5);
    for (const cop of game.police.cars) blip(cop.x, cop.z, '#ff4444', 3.5);
    for (const cop of game.police.cops) blip(cop.mesh.position.x, cop.mesh.position.z, '#ff8888', 2.5);
    if (game.goldCar) blip(game.goldCar.x, game.goldCar.z, '#ffd700', 4);
    // player arrow (rotates with heading)
    const [px, py] = toMap(game.player.x, game.player.z);
    const h = game.player.driving ? game.player.car.heading : game.player.heading;
    c.save();
    c.translate(px, py);
    c.rotate(Math.atan2(Math.sin(h), Math.cos(h)) * 0 + h * 0); // map is north-up; draw triangle pointing along heading
    c.rotate(-h + Math.PI);
    c.fillStyle = '#37e08b';
    c.beginPath();
    c.moveTo(0, -7); c.lineTo(5, 6); c.lineTo(-5, 6); c.closePath();
    c.fill();
    c.restore();
    // north + view cone
    c.fillStyle = '#fff';
    c.font = 'bold 11px sans-serif';
    c.fillText('N', 6, 14);
  }
}
