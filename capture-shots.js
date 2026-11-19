// SOLARA CITY — capture-shots.js (v6, fresh)
// Takes the 4 dossier screenshots, 1280x720 JPEG, staged live in the game:
//  1. 1-chase.jpg — stealing a car, police chase at wanted 1.
//  2. 2-reward.jpg — mission complete, +$ cash banner visible.
//  3. 3-legend.jpg — SOLARA LEGEND screen with the gold coupe.
//  4. 4-shootout.jpg — shootout at wanted 3.
// Same Chrome/CDP approach as playtest-cdp.js (chrome://newtab + location.href).
// Usage: node capture-shots.js  (exit 0 only if all 4 shots are valid)
// Writes screenshots/*.jpg + shots.json next to this file.

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const CHROME = '/opt/meta-chromium/chrome';
const DEBUG_PORT = 9224;
const GAME_URL = 'http://localhost:8080/';
const PROFILE = '/tmp/solara-chrome-v6-shots';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function sha256File(p) {
  return createHash('sha256').update(readFileSync(p)).digest('hex');
}

async function httpJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function waitFor(fn, timeoutMs, label) {
  const start = Date.now();
  for (;;) {
    try {
      const v = await fn();
      if (v) return v;
    } catch (err) { /* retry */ }
    if (Date.now() - start > timeoutMs) throw new Error(`timeout waiting for ${label}`);
    await sleep(250);
  }
}

class Cdp {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 0;
    this.pending = new Map();
    this.consoleErrors = [];
    this.ready = new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        this.consoleErrors.push(msg.params.args.map((a) => a.value || a.description || '').join(' '));
      } else if (msg.method === 'Runtime.exceptionThrown') {
        this.consoleErrors.push(msg.params.exceptionDetails?.exception?.description || 'exception');
      }
    };
  }
  async call(method, params = {}) {
    await this.ready;
    const id = ++this.id;
    const p = new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
    this.ws.send(JSON.stringify({ id, method, params }));
    return p;
  }
  async evalExpr(expression) {
    const r = await this.call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(`eval failed: ${r.exceptionDetails.text}`);
    return r.result?.value;
  }
  close() { try { this.ws.close(); } catch (err) { /* ignore */ } }
}

const KEYCODES = { KeyW: 87, KeyA: 65, KeyS: 83, KeyD: 68, KeyE: 69, KeyP: 80, Space: 32 };
async function key(cdp, code, type) {
  await cdp.call('Input.dispatchKeyEvent', {
    type, code,
    key: code === 'Space' ? ' ' : code.replace(/^Key/, '').toLowerCase(),
    windowsVirtualKeyCode: KEYCODES[code] || 0,
    nativeVirtualKeyCode: KEYCODES[code] || 0,
  });
}
async function tapKey(cdp, code) {
  await key(cdp, code, 'keyDown');
  await sleep(60);
  await key(cdp, code, 'keyUp');
}
async function holdKey(cdp, code, ms) {
  await key(cdp, code, 'keyDown');
  await sleep(ms);
  await key(cdp, code, 'keyUp');
}

// Minimal JPEG dimension reader (SOF0/SOF2 marker scan).
function jpegDims(buf) {
  let i = 2;
  while (i < buf.length - 9) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    if (marker === 0xc0 || marker === 0xc2) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
    const len = buf.readUInt16BE(i + 2);
    i += 2 + len;
  }
  return null;
}

async function shoot(cdp, name, quality) {
  const path = join(ROOT, 'screenshots', name);
  for (const q of [quality, 70, 60, 50]) {
    const res = await cdp.call('Page.captureScreenshot', { format: 'jpeg', quality: q });
    const buf = Buffer.from(res.data, 'base64');
    writeFileSync(path, buf);
    const size = statSync(path).size;
    const dims = jpegDims(buf);
    console.log(`${name}: ${size} bytes, ${dims ? `${dims.width}x${dims.height}` : 'dims?'} @q${q}`);
    if (size <= 262144 && dims && dims.width === 1280 && dims.height === 720) {
      return { file: name, bytes: size, width: dims.width, height: dims.height, quality: q };
    }
  }
  throw new Error(`${name} could not be made valid (<=256KiB, 1280x720)`);
}

async function reloadGame(cdp) {
  await cdp.evalExpr(`location.href=${JSON.stringify(GAME_URL)}`);
  await waitFor(async () => cdp.evalExpr('!!window.__solara'), 20000, 'game reload');
  await sleep(700);
}

async function main() {
  console.log(`webgl-policy sha256: ${sha256File(join(ROOT, 'webgl-policy.txt'))}`);
  const policyPath = join(ROOT, 'webgl-policy.txt');
  const policySha = sha256File(policyPath);
  const server = spawn('node', ['serve.ts', '8080'], { cwd: ROOT, stdio: 'pipe' });
  console.log(`serve.ts PID ${server.pid}`);
  try {
    await waitFor(async () => (await fetch(GAME_URL)).ok, 15000, 'dev server');
    const chrome = spawn(CHROME, [
      '--headless=new',
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${PROFILE}`,
      '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
      '--disable-extensions', '--mute-audio', '--window-size=1280,720',
      `--hatch-webgl-allowed-domains-file=${policyPath}`,
      `--hatch-webgl-allowed-domains-sha256=${policySha}`,
      'chrome://newtab/',
    ], { stdio: 'pipe' });
    console.log(`chrome PID ${chrome.pid}`);
    try {
      const targets = await waitFor(async () => {
        const list = await httpJson(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
        return list.filter((t) => t.type === 'page');
      }, 20000, 'chrome targets');
      const tab = targets.find((t) => t.url.startsWith('chrome://')) || targets[0];
      const cdp = new Cdp(tab.webSocketDebuggerUrl);
      await cdp.call('Page.enable');
      await cdp.call('Runtime.enable');
      await cdp.call('Emulation.setDeviceMetricsOverride', {
        width: 1280, height: 720, deviceScaleFactor: 1, mobile: false,
      });
      await cdp.evalExpr(`location.href=${JSON.stringify(GAME_URL)}`);
      await waitFor(async () => cdp.evalExpr('!!window.__solara'), 20000, 'game boot');
      await sleep(800);
      const shots = [];

      // --- Shot 1: car chase at wanted 1 ---
      await cdp.evalExpr('__solara.start()');
      await sleep(300);
      const parked = await cdp.evalExpr(`(() => { const c = __solara.state.cars.find(c => c.parked); return {x:c.x,y:c.y}; })()`);
      await cdp.evalExpr(`__solara.teleport(${parked.x + 30}, ${parked.y})`);
      await sleep(200);
      await tapKey(cdp, 'KeyE');
      await sleep(300);
      await holdKey(cdp, 'KeyW', 1400);
      // Pull two cops in close behind the car for the action shot.
      await cdp.evalExpr(`(() => { const s = __solara.state; const car = s.car; if (!car || s.cops.length < 2) return; s.cops[0].x = car.x - 190; s.cops[0].y = car.y + 70; s.cops[1].x = car.x - 230; s.cops[1].y = car.y - 60; })()`);
      await sleep(350);
      shots.push({ ...(await shoot(cdp, '1-chase.jpg', 85)), scene: 'Curi mobil + kejar-kejaran polisi (wanted 1)' });

      // --- Shot 2: mission reward banner ---
      await reloadGame(cdp);
      await cdp.evalExpr('__solara.start()');
      await sleep(300);
      await cdp.evalExpr('__solara.startMission(0)');
      await sleep(200);
      const pk = await cdp.evalExpr('({x:__solara.state.mission.pickup.x,y:__solara.state.mission.pickup.y})');
      await cdp.evalExpr(`__solara.teleport(${pk.x}, ${pk.y})`);
      await sleep(400);
      const dl = await cdp.evalExpr('({x:__solara.state.mission.target.x,y:__solara.state.mission.target.y})');
      await cdp.evalExpr(`__solara.teleport(${dl.x}, ${dl.y})`);
      await sleep(450);
      const cash2 = await cdp.evalExpr('__solara.state.cash');
      console.log(`shot 2 cash=${cash2}`);
      shots.push({ ...(await shoot(cdp, '2-reward.jpg', 85)), scene: 'Misi selesai + reward cash +$300' });

      // --- Shot 3: SOLARA LEGEND + gold coupe ---
      await reloadGame(cdp);
      await cdp.evalExpr('__solara.start()');
      await sleep(300);
      await cdp.evalExpr('__solara.startMission(0)');
      await sleep(150);
      const pk3 = await cdp.evalExpr('({x:__solara.state.mission.pickup.x,y:__solara.state.mission.pickup.y})');
      await cdp.evalExpr(`__solara.teleport(${pk3.x}, ${pk3.y})`);
      await sleep(350);
      const dl3 = await cdp.evalExpr('({x:__solara.state.mission.target.x,y:__solara.state.mission.target.y})');
      await cdp.evalExpr(`__solara.teleport(${dl3.x}, ${dl3.y})`);
      await sleep(350);
      await cdp.evalExpr('__solara.startMission(1)');
      await sleep(150);
      const t3 = await cdp.evalExpr('({x:__solara.state.mission.target.x,y:__solara.state.mission.target.y})');
      await cdp.evalExpr(`__solara.teleport(${t3.x}, ${t3.y})`);
      await sleep(350);
      await cdp.evalExpr('__solara.setHealth(100)');
      await cdp.evalExpr('__solara.startMission(2)');
      await cdp.evalExpr('__solara.setMissionTimer(0.6)');
      await sleep(1200);
      await cdp.evalExpr('__solara.setHealth(100)');
      await cdp.evalExpr('__solara.startMission(3)');
      await sleep(150);
      const gc = await cdp.evalExpr('({x:__solara.state.goldCoupe.x,y:__solara.state.goldCoupe.y})');
      await cdp.evalExpr(`__solara.teleport(${gc.x + 30}, ${gc.y})`);
      await sleep(150);
      await tapKey(cdp, 'KeyE');
      await sleep(250);
      const t4 = await cdp.evalExpr('({x:__solara.state.mission.target.x,y:__solara.state.mission.target.y})');
      await cdp.evalExpr(`__solara.teleport(${t4.x}, ${t4.y})`);
      await sleep(500);
      const mode3 = await cdp.evalExpr('__solara.state.mode');
      console.log(`shot 3 mode=${mode3}`);
      shots.push({ ...(await shoot(cdp, '3-legend.jpg', 85)), scene: 'SOLARA LEGEND + coupe emas ($3.100)' });

      // --- Shot 4: shootout at wanted 3 ---
      await reloadGame(cdp);
      await cdp.evalExpr('__solara.start()');
      await sleep(300);
      const parked4 = await cdp.evalExpr(`(() => { const c = __solara.state.cars.find(c => c.parked); return {x:c.x,y:c.y}; })()`);
      await cdp.evalExpr(`__solara.teleport(${parked4.x + 30}, ${parked4.y})`);
      await sleep(150);
      await tapKey(cdp, 'KeyE');
      await sleep(200);
      await cdp.evalExpr('__solara.setWanted(3)');
      await sleep(400);
      // Cops close in, player fires toward them.
      await cdp.evalExpr(`(() => { const s = __solara.state; const car = s.car; if (!car) return; s.cops.slice(0, 3).forEach((cop, i) => { cop.x = car.x + 260 + i * 60; cop.y = car.y - 120 + i * 110; cop.speed = 0; }); })()`);
      // One real shot (muzzle flash + sound path) plus staged tracers so
      // the burst reads clearly in the still frame.
      await cdp.evalExpr(`(() => { const s = __solara.state; const car = s.car; if (!car) return; __solara.setMouse(1050, 300); __solara.shootAt(s.camera.x + 1050, s.camera.y + 300); const bx = car.x + 40, by = car.y - 10; s.bullets.push({x: bx, y: by, vx: 700, vy: -260, life: 0.9, damage: 0}); s.bullets.push({x: bx, y: by + 8, vx: 740, vy: 120, life: 0.9, damage: 0}); })()`);
      await sleep(80);
      shots.push({ ...(await shoot(cdp, '4-shootout.jpg', 85)), scene: 'Baku tembak di wanted 3' });

      if (cdp.consoleErrors.length) {
        console.log(`console errors during capture: ${cdp.consoleErrors.slice(0, 3).join(' | ')}`);
      }
      cdp.close();

      const manifest = {
        game: 'SOLARA CITY v6',
        at: new Date().toISOString(),
        width: 1280,
        height: 720,
        shots,
      };
      writeFileSync(join(ROOT, 'shots.json'), JSON.stringify(manifest, null, 2) + '\n');
      console.log(`\nSHOTS OK: ${shots.map((s) => `${s.file} (${s.bytes}B)`).join(', ')}`);
    } finally {
      try { process.kill(chrome.pid, 'SIGKILL'); } catch (err) { /* already dead */ }
    }
  } finally {
    try { process.kill(server.pid, 'SIGKILL'); } catch (err) { /* already dead */ }
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(`CAPTURE CRASH: ${err.message}`);
  process.exit(2);
});
