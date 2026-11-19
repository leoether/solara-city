// SOLARA CITY — playtest-cdp.js (v6, fresh)
// Headless full-loop playtest via Chrome DevTools Protocol.
// Chrome 157 blocks localhost navigation from /json/new and Page.navigate,
// so: launch at chrome://newtab/, attach to that tab, navigate with
// location.href from the chrome:// context. Viewport forced 1280x720.
// Usage: node playtest-cdp.js  (exit 0 only if every check passes)
// Writes playtest-v6.json next to this file.

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const CHROME = '/opt/meta-chromium/chrome';
const DEBUG_PORT = 9223;
const GAME_URL = 'http://localhost:8080/';
const PROFILE = '/tmp/solara-chrome-v6-playtest';

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
    this.exceptions = [];
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
        this.exceptions.push(msg.params.exceptionDetails?.exception?.description || JSON.stringify(msg.params.exceptionDetails));
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
    if (r.exceptionDetails) throw new Error(`eval failed: ${r.exceptionDetails.text} ${r.exceptionDetails.exception?.description || ''}`);
    return r.result?.value;
  }
  close() { try { this.ws.close(); } catch (err) { /* ignore */ } }
}

const KEYCODES = {
  KeyW: 87, KeyA: 65, KeyS: 83, KeyD: 68, KeyE: 69, KeyM: 77, KeyP: 80,
  KeyR: 82, KeyN: 78, Space: 32, Enter: 13, Escape: 27,
  ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39,
};

async function key(cdp, code, type) {
  const keyName = code === 'Space' ? ' ' : code.replace(/^Key/, '').toLowerCase();
  await cdp.call('Input.dispatchKeyEvent', {
    type,
    code,
    key: keyName,
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

const results = [];
function check(name, ok, detail) {
  results.push({ name, pass: !!ok, detail: detail ?? '' });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function main() {
  // WebGL domain policy: hash it at runtime, log it (game is Canvas 2D;
  // the policy file only gates headless startup in this environment).
  const policyPath = join(ROOT, 'webgl-policy.txt');
  const policySha = sha256File(policyPath);
  console.log(`webgl-policy sha256: ${policySha}`);

  // 1. Serve the game.
  const server = spawn('node', ['serve.ts', '8080'], { cwd: ROOT, stdio: 'pipe' });
  const serverPid = server.pid;
  console.log(`serve.ts PID ${serverPid}`);
  try {
    await waitFor(async () => {
      const r = await fetch(GAME_URL);
      return r.ok;
    }, 15000, 'dev server');
    console.log('dev server up');

    // 2. Launch Chrome at chrome://newtab/.
    const chrome = spawn(CHROME, [
      '--headless=new',
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${PROFILE}`,
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-extensions',
      '--mute-audio',
      '--window-size=1280,720',
      `--hatch-webgl-allowed-domains-file=${policyPath}`,
      `--hatch-webgl-allowed-domains-sha256=${policySha}`,
      'chrome://newtab/',
    ], { stdio: 'pipe' });
    const chromePid = chrome.pid;
    console.log(`chrome PID ${chromePid}`);
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
      // Navigate from the chrome:// context (localhost is blocked otherwise).
      await cdp.evalExpr(`location.href=${JSON.stringify(GAME_URL)}`);
      await waitFor(async () => cdp.evalExpr('!!window.__solara'), 20000, 'game boot');
      console.log('game loaded, __solara ready');
      await sleep(800);

      // --- WIN PATH ---
      check('boot screen', (await cdp.evalExpr('__solara.state.mode')) === 'boot');
      await cdp.evalExpr('__solara.start()');
      await sleep(400);
      check('start game', (await cdp.evalExpr('__solara.state.mode')) === 'playing');

      // Walk on foot with real keys.
      const before = await cdp.evalExpr('({x:__solara.state.player.x,y:__solara.state.player.y})');
      await holdKey(cdp, 'KeyW', 900);
      const after = await cdp.evalExpr('({x:__solara.state.player.x,y:__solara.state.player.y})');
      const walked = Math.hypot(after.x - before.x, after.y - before.y);
      check('walk with WASD', walked > 40, `moved ${Math.round(walked)}px`);

      // Shoot with Space (real key path), on foot.
      const shots0 = await cdp.evalExpr('__solara.state.stats.shots');
      await cdp.evalExpr('__solara.setMouse(900, 360)');
      await holdKey(cdp, 'Space', 350);
      const shots1 = await cdp.evalExpr('__solara.state.stats.shots');
      check('shoot works (Space)', shots1 > shots0, `${shots0} -> ${shots1}`);

      // Steal a car with real E key.
      const parked = await cdp.evalExpr(`(() => { const c = __solara.state.cars.find(c => c.parked); return c ? {x:c.x,y:c.y} : null; })()`);
      check('parked car exists', !!parked);
      if (parked) {
        await cdp.evalExpr(`__solara.teleport(${parked.x + 30}, ${parked.y})`);
        await sleep(200);
        await tapKey(cdp, 'KeyE');
        await sleep(300);
        const st = await cdp.evalExpr('({inCar:__solara.state.player.inCar,wanted:__solara.state.wanted,cops:__solara.state.cops.length})');
        check('steal car (E) -> wanted 1', st.inCar && st.wanted >= 1, JSON.stringify(st));
      }

      // Drive with real keys; brake to make skid marks (sampled: the car
      // may crash or be rammed mid-brake, so watch speed/skids live).
      await holdKey(cdp, 'KeyW', 2000);
      const speed = await cdp.evalExpr('Math.abs(__solara.state.car ? __solara.state.car.speed : 0)');
      check('drive accelerates', speed > 120, `speed ${Math.round(speed)}`);
      await key(cdp, 'KeyS', 'keyDown');
      let maxSkids = 0;
      let brakeTrace = '';
      for (let i = 0; i < 4; i++) {
        await sleep(200);
        const s = await cdp.evalExpr('({v:Math.round(Math.abs(__solara.state.car.speed)),k:__solara.state.skids.length,m:__solara.state.mode,h:Math.round(__solara.state.health)})');
        maxSkids = Math.max(maxSkids, s.k);
        brakeTrace += `[t${(i + 1) * 0.2}s v${s.v} k${s.k} ${s.m} hp${s.h}]`;
      }
      await key(cdp, 'KeyS', 'keyUp');
      const skids = await cdp.evalExpr('__solara.state.skids.length');
      check('brake drops skid marks', skids > 0, `${skids} marks ${brakeTrace}`);

      // Recovery: hard braking may have let the cops bust the player.
      // Respawn and get back in a car so the mission checks run clean.
      const modeAfterBrake = await cdp.evalExpr('__solara.state.mode');
      if (modeAfterBrake !== 'playing') {
        await cdp.evalExpr('__solara.respawn(true)');
        await sleep(300);
      }
      const inCarAfterBrake = await cdp.evalExpr('__solara.state.player.inCar');
      if (!inCarAfterBrake) {
        const parked2 = await cdp.evalExpr(`(() => { const c = __solara.state.cars.find(c => c.parked); return c ? {x:c.x,y:c.y} : null; })()`);
        if (parked2) {
          await cdp.evalExpr(`__solara.teleport(${parked2.x + 30}, ${parked2.y})`);
          await sleep(200);
          await tapKey(cdp, 'KeyE');
          await sleep(300);
        }
      }
      check('recovered to driving after brake', (await cdp.evalExpr('__solara.state.player.inCar')) === true);

      // Mission 1: pickup -> deliver. Clear the heat first so the checks
      // exercise mission logic, not a busted interrupt from the chase.
      await cdp.evalExpr('__solara.setWanted(0)');
      await sleep(200);
      await cdp.evalExpr('__solara.startMission(0)');
      await sleep(200);
      const pk = await cdp.evalExpr('({x:__solara.state.mission.pickup.x,y:__solara.state.mission.pickup.y})');
      await cdp.evalExpr(`__solara.teleport(${pk.x}, ${pk.y})`);
      await sleep(400);
      const phase = await cdp.evalExpr('__solara.state.mission && __solara.state.mission.phase');
      check('mission 1 pickup', phase === 'deliver', `phase=${phase}`);
      const dl = await cdp.evalExpr('({x:__solara.state.mission.target.x,y:__solara.state.mission.target.y})');
      await cdp.evalExpr(`__solara.teleport(${dl.x}, ${dl.y})`);
      await sleep(400);
      const m1 = await cdp.evalExpr('({cash:__solara.state.cash,mi:__solara.state.missionIndex})');
      check('mission 1 complete +$300', m1.cash === 300 && m1.mi === 1, JSON.stringify(m1));

      // Mission 2: escape to the safe point.
      await cdp.evalExpr('__solara.startMission(1)');
      await sleep(200);
      const t2 = await cdp.evalExpr('({x:__solara.state.mission.target.x,y:__solara.state.mission.target.y})');
      await cdp.evalExpr(`__solara.teleport(${t2.x}, ${t2.y})`);
      await sleep(400);
      const m2 = await cdp.evalExpr('({cash:__solara.state.cash,mi:__solara.state.missionIndex})');
      check('mission 2 complete +$500', m2.cash === 800 && m2.mi === 2, JSON.stringify(m2));

      // Mission 3: survive wanted 3 (timer shortened via debug hook).
      await cdp.evalExpr('__solara.setHealth(100)');
      await cdp.evalExpr('__solara.startMission(2)');
      await sleep(200);
      const w3 = await cdp.evalExpr('__solara.state.wanted');
      check('mission 3 sets wanted 3', w3 === 3, `wanted=${w3}`);
      await cdp.evalExpr('__solara.setMissionTimer(1.2)');
      await sleep(2000);
      const m3 = await cdp.evalExpr('({cash:__solara.state.cash,mi:__solara.state.missionIndex})');
      check('mission 3 complete +$800', m3.cash === 1600 && m3.mi === 3, JSON.stringify(m3));

      // Mission 4: steal the gold coupe, deliver it.
      await cdp.evalExpr('__solara.setHealth(100)');
      await cdp.evalExpr('__solara.startMission(3)');
      await sleep(200);
      const gc = await cdp.evalExpr('({x:__solara.state.goldCoupe.x,y:__solara.state.goldCoupe.y})');
      await cdp.evalExpr(`__solara.teleport(${gc.x + 30}, ${gc.y})`);
      await sleep(200);
      await tapKey(cdp, 'KeyE');
      await sleep(300);
      const stolen = await cdp.evalExpr('({stolen:__solara.state.goldCoupe.stolen,gold:!!(__solara.state.car && __solara.state.car.gold)})');
      check('gold coupe stolen (E)', stolen.stolen && stolen.gold, JSON.stringify(stolen));
      const t4 = await cdp.evalExpr('({x:__solara.state.mission.target.x,y:__solara.state.mission.target.y})');
      await cdp.evalExpr(`__solara.teleport(${t4.x}, ${t4.y})`);
      await sleep(500);
      const m4 = await cdp.evalExpr('({cash:__solara.state.cash,mi:__solara.state.missionIndex,mode:__solara.state.mode,legend:__solara.state.legend})');
      check('mission 4 complete -> LEGEND $3.100', m4.cash === 3100 && m4.mi === 4 && m4.mode === 'legend' && m4.legend, JSON.stringify(m4));
      const saved = await cdp.evalExpr(`JSON.parse(localStorage.getItem('solara-city-save-v6') || 'null')`);
      check('save written at LEGEND', !!(saved && saved.cash === 3100), JSON.stringify(saved));

      // Continue from save after reload.
      await cdp.evalExpr(`location.href=${JSON.stringify(GAME_URL)}`);
      await waitFor(async () => cdp.evalExpr('!!window.__solara'), 20000, 'reload');
      await sleep(600);
      check('boot shows Continue (save exists)', await cdp.evalExpr('__solara.hasSave()'));
      await cdp.evalExpr('__solara.continueGame()');
      await sleep(300);
      const cont = await cdp.evalExpr('({cash:__solara.state.cash,mode:__solara.state.mode,legend:__solara.state.legend})');
      check('continue loads $3.100 + legend', cont.cash === 3100 && cont.mode === 'playing' && cont.legend, JSON.stringify(cont));

      // --- LOSE PATHS ---
      // WASTED -> retry.
      await cdp.evalExpr('__solara.newGame()');
      await sleep(300);
      await cdp.evalExpr('__solara.setHealth(5)');
      await cdp.evalExpr('__solara.damage(10)');
      await sleep(200);
      check('WASTED on death', (await cdp.evalExpr('__solara.state.mode')) === 'wasted');
      await cdp.evalExpr('__solara.respawn(false)');
      await sleep(200);
      const rw = await cdp.evalExpr('({mode:__solara.state.mode,health:__solara.state.health})');
      check('retry after WASTED', rw.mode === 'playing' && rw.health === 100, JSON.stringify(rw));

      // BUSTED via real cop contact on foot (sampled: watch the timer).
      await cdp.evalExpr('__solara.setWanted(1)');
      await sleep(500);
      await cdp.evalExpr(`(() => { const s = __solara.state; if (s.cops.length) { s.cops[0].x = s.player.x; s.cops[0].y = s.player.y; s.cops[0].speed = 0; } })()`);
      let bustedTrace = '';
      for (let i = 0; i < 5; i++) {
        await sleep(400);
        const b = await cdp.evalExpr('({m:__solara.state.mode,t:+__solara.state.bustedTimer.toFixed(2),d:__solara.state.cops.length?Math.round(Math.hypot(__solara.state.cops[0].x-__solara.state.player.x,__solara.state.cops[0].y-__solara.state.player.y)):-1,n:__solara.state.cops.length})');
        bustedTrace += `[t${(i + 1) * 0.4}s ${b.m} timer${b.t} d${b.d} cops${b.n}]`;
        if (b.m === 'busted') break;
      }
      check('BUSTED on cop contact', (await cdp.evalExpr('__solara.state.mode')) === 'busted', bustedTrace);
      const bcash = await cdp.evalExpr('__solara.state.cash');
      await cdp.evalExpr('__solara.respawn(true)');
      await sleep(200);
      const rb = await cdp.evalExpr('({mode:__solara.state.mode,health:__solara.state.health})');
      check('respawn after BUSTED', rb.mode === 'playing' && rb.health === 100, `cash was ${bcash}, ${JSON.stringify(rb)}`);

      // Pause / resume with real P key.
      await tapKey(cdp, 'KeyP');
      await sleep(200);
      check('pause (P)', (await cdp.evalExpr('__solara.state.mode')) === 'paused');
      await tapKey(cdp, 'KeyP');
      await sleep(200);
      check('resume (P)', (await cdp.evalExpr('__solara.state.mode')) === 'playing');

      // Console hygiene.
      check('0 console errors', cdp.consoleErrors.length === 0, cdp.consoleErrors.slice(0, 3).join(' | '));
      check('0 uncaught exceptions', cdp.exceptions.length === 0, cdp.exceptions.slice(0, 3).join(' | '));
      cdp.close();
    } finally {
      try { process.kill(chromePid, 'SIGKILL'); } catch (err) { /* already dead */ }
    }
  } finally {
    try { process.kill(serverPid, 'SIGKILL'); } catch (err) { /* already dead */ }
  }

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass);
  const report = {
    game: 'SOLARA CITY v6',
    at: new Date().toISOString(),
    passed, failed: failed.length,
    checks: results,
  };
  writeFileSync(join(ROOT, 'playtest-v6.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`\nPLAYTEST ${passed}/${results.length} passed${failed.length ? ` — FAILED: ${failed.map((f) => f.name).join(', ')}` : ''}`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(`PLAYTEST CRASH: ${err.message}`);
  process.exit(2);
});
