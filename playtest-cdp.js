// SOLARA CITY v3 — headless playtest over Chrome DevTools Protocol.
// Node stdlib only (global fetch + WebSocket). Spawns serve.ts, drives the
// real game with real key events, asserts the full win/lose loops, and
// captures the 4 dossier screenshots at 1280x720.
// Usage: node playtest-cdp.js [--port 8901] [--shots-only]

import { spawn, execSync } from 'node:child_process';
import { writeFileSync, existsSync, statSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const CHROME = '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell';
// NOTE: /opt/meta-chromium/chrome refuses to start here
// ("Hatch WebGL domain policy is required"); the Playwright headless
// shell is the working headless Chrome on this VM. Full Playwright
// chromium also works but takes ~15s to open its DevTools port.
const PORT = Number(process.argv.find((a, i, arr) => arr[i - 1] === '--port') || 8901);
const SHOTS_ONLY = process.argv.includes('--shots-only');
const BASE = `http://127.0.0.1:${PORT}`;
const results = [];
const consoleErrors = [];

function log(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitPort(url, timeoutMs = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (r.ok || r.status === 404) return true;
    } catch { /* retry */ }
    await sleep(300);
  }
  return false;
}

// ---- CDP client ----
class CDP {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.ready = new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
    this.ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      } else if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params.exceptionDetails;
        consoleErrors.push('EXCEPTION: ' + (d.exception?.description || d.text || JSON.stringify(d)));
      } else if (msg.method === 'Runtime.consoleAPICalled') {
        if (msg.params.type === 'error') {
          consoleErrors.push('CONSOLE.ERROR: ' + msg.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
        }
      } else if (msg.method === 'Log.entryAdded') {
        const e = msg.params.entry;
        if (e.level === 'error') consoleErrors.push('LOG.ERROR: ' + e.text + ' ' + (e.url || ''));
      }
    };
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(r.exceptionDetails));
    return r.result.value;
  }

  async key(code, key, type) {
    const vkMap = { Enter: 13, Space: 32, KeyE: 69, KeyP: 80, KeyC: 67, KeyW: 87, KeyA: 65, KeyS: 83, KeyD: 68, Escape: 27, KeyR: 82, ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39 };
    await this.send('Input.dispatchKeyEvent', {
      type, code, key, windowsVirtualKeyCode: vkMap[code] || 0, nativeVirtualKeyCode: vkMap[code] || 0,
    });
  }

  async tap(code, key) {
    await this.key(code, key, 'keyDown');
    await sleep(60);
    await this.key(code, key, 'keyUp');
  }

  async hold(code, key, ms) {
    await this.key(code, key, 'keyDown');
    await sleep(ms);
    await this.key(code, key, 'keyUp');
  }

  async shot(path, quality = 80) {
    const r = await this.send('Page.captureScreenshot', { format: 'jpeg', quality });
    writeFileSync(path, Buffer.from(r.data, 'base64'));
    return statSync(path).size;
  }
}

async function newPage(cdpPort, url) {
  const list = await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json();
  let page = list.find((t) => t.type === 'page');
  if (!page) throw new Error('no page target');
  const cdp = new CDP(page.webSocketDebuggerUrl);
  await cdp.ready;
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Log.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await cdp.send('Page.navigate', { url });
  return cdp;
}

async function waitReady(cdp, timeoutMs = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      if (await cdp.eval('window.__solaraReady === true')) return true;
    } catch { /* retry */ }
    await sleep(300);
  }
  return false;
}

async function state(cdp) {
  return cdp.eval('window.SOLARA.state()');
}

// ---- main ----
// Fresh browser profile every run, so a previous run's localStorage save
// can never leak into this run's assertions.
rmSync('/tmp/solara-v3-profile', { recursive: true, force: true });
const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: here, stdio: 'ignore' });
const chrome = spawn(CHROME, [
  '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
  '--window-size=1280,720', `--remote-debugging-port=9222`, '--user-data-dir=/tmp/solara-v3-profile',
  'about:blank',
], { stdio: 'ignore' });

try {
  if (!(await waitPort(`${BASE}/index.html`))) throw new Error('serve.ts did not come up');
  if (!(await waitPort('http://127.0.0.1:9222/json/version', 30000))) throw new Error('chrome did not come up');

  if (!SHOTS_ONLY) {
    const cdp = await newPage(9222, `${BASE}/index.html`);
    if (!(await waitReady(cdp))) throw new Error('game did not signal ready');
    log('boot: game loads, __solaraReady', true);
    let s = await state(cdp);
    log('boot: mode is boot', s.mode === 'boot', JSON.stringify(s.mode));

    // Start with real Enter key.
    await cdp.tap('Enter', 'Enter');
    await sleep(500);
    s = await state(cdp);
    log('start: Enter begins game, mission 1 deliver', s.mode === 'playing' && s.missionIndex === 0 && s.missionKind === 'deliver', JSON.stringify(s));

    // Walk with a real key hold.
    const before = { x: s.player.x, y: s.player.y };
    await cdp.hold('KeyW', 'w', 900);
    await sleep(200);
    s = await state(cdp);
    log('walk: W moves player on foot', Math.hypot(s.player.x - before.x, s.player.y - before.y) > 40, `moved ${Math.round(Math.hypot(s.player.x - before.x, s.player.y - before.y))}px`);

    // Steal the parked car by the spawn with a real E key.
    await cdp.eval(`window.SOLARA.teleport(${450 + 96 - 46}, ${450 + 8})`);
    await sleep(300);
    await cdp.tap('KeyE', 'e');
    await sleep(400);
    s = await state(cdp);
    log('steal: E enters car, wanted 1', s.player.inCar === true && s.wanted === 1, JSON.stringify({ inCar: s.player.inCar, wanted: s.wanted }));

    // Drive with a real key hold.
    await cdp.hold('KeyW', 'w', 2000);
    await sleep(200);
    s = await state(cdp);
    log('drive: W accelerates car', s.player.speed > 100, `speed ${s.player.speed}`);

    // Shoot with a real Space key.
    await cdp.tap('Space', ' ');
    await sleep(300);
    s = await state(cdp);
    log('shoot: Space fires a bullet', s.bullets >= 1, `bullets ${s.bullets}`);

    // Pause with a real P key, then resume.
    await cdp.tap('KeyP', 'p');
    await sleep(300);
    s = await state(cdp);
    log('pause: P pauses', s.mode === 'paused', s.mode);
    await cdp.tap('KeyP', 'p');
    await sleep(300);
    s = await state(cdp);
    log('pause: P resumes', s.mode === 'playing', s.mode);

    // Mission 1: pickup then dropoff via real target teleports.
    await cdp.eval('window.SOLARA.teleportToTarget()');
    await sleep(600);
    s = await state(cdp);
    log('mission 1: pickup flips stage to dropoff', s.missionStage === 'dropoff', s.missionStage);
    await cdp.eval('window.SOLARA.teleportToTarget()');
    await sleep(600);
    s = await state(cdp);
    log('mission 1: complete pays +$300, mission 2 escape', s.cash === 300 && s.missionIndex === 1 && s.missionKind === 'escape', JSON.stringify({ cash: s.cash, missionIndex: s.missionIndex, missionKind: s.missionKind }));

    // Mission 2: timed escape (headless rAF runs ~50% wall speed, so use
    // the raw timer and a 2s window instead of the ceiled display value).
    // Keep driving during the wait: a stationary player at wanted 2 gets
    // busted by design, which would end the run before the mission does.
    const t2 = (await state(cdp)).timeLeftRaw;
    await cdp.hold('KeyW', 'w', 2000);
    s = await state(cdp);
    log('mission 2: escape timer counts down', s.timeLeftRaw < t2 - 0.5, `timeLeftRaw ${t2} -> ${s.timeLeftRaw}`);
    await cdp.eval('window.SOLARA.teleportToTarget()');
    await sleep(600);
    s = await state(cdp);
    log('mission 2: complete pays +$500 (total $800), mission 3 survive', s.cash === 800 && s.missionIndex === 2 && s.missionKind === 'survive', JSON.stringify({ cash: s.cash, missionIndex: s.missionIndex }));

    // Mission 3: survival timer ticks; complete via API to save wall time.
    // Keep driving during the wait (wanted 3 cops bust a stationary car).
    const t3 = (await state(cdp)).timeLeftRaw;
    await cdp.hold('KeyW', 'w', 2000);
    s = await state(cdp);
    log('mission 3: survival timer counts down at wanted 3', s.timeLeftRaw < t3 - 0.5 && s.wanted === 3, `timeLeftRaw ${t3} -> ${s.timeLeftRaw}, wanted ${s.wanted}`);
    // Complete, then immediately break contact: the cops that converged
    // during survival would bust the idle player in the post-complete beat.
    await cdp.eval('window.SOLARA.completeCurrentMission(); window.SOLARA.teleportToRoad()');
    await sleep(400);
    s = await state(cdp);
    log('mission 3: complete pays +$800 (total $1600), mission 4 gold', s.cash === 1600 && s.missionIndex === 3 && s.missionKind === 'gold', JSON.stringify({ cash: s.cash, missionIndex: s.missionIndex }));

    // Mission 4: go to the lot, steal the gold coupe with real E, deliver it.
    // Stop the car first: E refuses to exit above 60 speed, and a teleported
    // car keeps its old speed (the M3 survival drive leaves it moving).
    await cdp.eval('window.SOLARA.teleportToTarget(); window.SOLARA.setCarSpeed(0);');
    await sleep(400);
    // Step out of the current car first if still driving it.
    s = await state(cdp);
    if (s.player.inCar) { await cdp.tap('KeyE', 'e'); await sleep(300); }
    await cdp.eval(`(() => { const st = window.SOLARA.state(); const t = st.target; window.SOLARA.teleport(t.x - 40, t.y); })()`);
    await sleep(300);
    await cdp.tap('KeyE', 'e');
    await sleep(400);
    s = await state(cdp);
    log('mission 4: E steals gold coupe, stage deliver', s.player.inCar === true && s.player.gold === true && s.missionStage === 'deliver', JSON.stringify({ inCar: s.player.inCar, gold: s.player.gold, stage: s.missionStage }));
    await cdp.eval('window.SOLARA.teleportToTarget()');
    await sleep(800);
    s = await state(cdp);
    log('mission 4 + LEGEND: +$1500 totals $3100, legend mode', s.cash === 3100 && s.mode === 'legend', JSON.stringify({ cash: s.cash, mode: s.mode }));

    // Save exists; reload -> boot with Continue; C continues as legend freeroam.
    const saved = await cdp.eval(`JSON.parse(localStorage.getItem('solara-city-save-v3') || 'null')`);
    log('save: localStorage holds cash 3100 + missionIndex 4', saved && saved.cash === 3100 && saved.missionIndex === 4, JSON.stringify(saved));
    await cdp.send('Page.navigate', { url: `${BASE}/index.html` });
    await sleep(1200);
    if (!(await waitReady(cdp))) throw new Error('reload did not signal ready');
    s = await state(cdp);
    log('continue: boot offers save (hasSave)', s.hasSave === true && s.mode === 'boot', JSON.stringify({ hasSave: s.hasSave, mode: s.mode }));
    await cdp.tap('KeyC', 'c');
    await sleep(500);
    s = await state(cdp);
    log('continue: C loads legend save, freeroam, cash kept', s.mode === 'playing' && s.cash === 3100 && s.missionIndex === 4, JSON.stringify({ mode: s.mode, cash: s.cash, missionIndex: s.missionIndex }));

    // Busted path: fresh start, wanted 1, cop glued to a stopped car.
    await cdp.eval('window.SOLARA.start()');
    await sleep(400);
    await cdp.eval('window.SOLARA.giveCar(); window.SOLARA.setWanted(1); window.SOLARA.setCarSpeed(0); window.SOLARA.placePoliceNear(1, 55);');
    await sleep(4000); // bust needs 1.6s game-time; headless runs ~50% speed
    s = await state(cdp);
    log('busted: glued cop busts a stopped player', s.mode === 'busted', JSON.stringify(s.mode));
    await cdp.tap('Enter', 'Enter');
    await sleep(500);
    s = await state(cdp);
    log('busted: Enter respawns, wanted 0, mission restarts', s.mode === 'playing' && s.wanted === 0 && s.missionIndex === 0, JSON.stringify({ mode: s.mode, wanted: s.wanted, missionIndex: s.missionIndex }));

    // Wasted path: lethal damage, retry from checkpoint.
    await cdp.eval('window.SOLARA.damage(200)');
    await sleep(600);
    s = await state(cdp);
    log('wasted: lethal damage shows WASTED', s.mode === 'wasted', s.mode);
    await cdp.tap('Enter', 'Enter');
    await sleep(600);
    s = await state(cdp);
    log('wasted: Enter retries from checkpoint', s.mode === 'playing', s.mode);

    const fails = results.filter((r) => !r.ok);
    console.log(`\nPLAYTEST: ${results.length - fails.length}/${results.length} passed`);
    if (consoleErrors.length) {
      console.log(`CONSOLE ERRORS (${consoleErrors.length}):`);
      for (const e of consoleErrors.slice(0, 10)) console.log('  ' + e);
    } else {
      console.log('CONSOLE ERRORS: 0');
    }
    cdp.ws.close();
    if (fails.length || consoleErrors.length) process.exitCode = 1;
  }

  // ---- screenshots (fresh page per scene) ----
  const shots = [
    ['chase', '1-chase.jpg'],
    ['reward', '2-reward.jpg'],
    ['legend', '3-legend.jpg'],
    ['shootout', '4-shootout.jpg'],
  ];
  mkdirSync(join(here, 'screenshots'), { recursive: true });
  for (const [scene, file] of shots) {
    const cdp = await newPage(9222, `${BASE}/index.html?shot=${scene}&seed=1`);
    if (!(await waitReady(cdp))) throw new Error(`shot ${scene}: game did not signal ready`);
    if (scene === 'chase') {
      // Hold W through the settle so the car is genuinely speeding (speed
      // lines, exhaust, police closing in) instead of coasting to a stop.
      await cdp.key('KeyW', 'w', 'keyDown');
      await sleep(1400);
    } else {
      await sleep(1600);
    }
    const shotFlag = await cdp.eval('window.__solaraShot');
    const size = await cdp.shot(join(here, 'screenshots', file), 80);
    if (scene === 'chase') await cdp.key('KeyW', 'w', 'keyUp');
    const ok = size <= 262144 && shotFlag === scene;
    console.log(`${ok ? 'PASS' : 'FAIL'}  shot ${scene}: ${file} ${size} bytes (cap 262144), flag=${shotFlag}`);
    if (!ok) process.exitCode = 1;
    cdp.ws.close();
    await sleep(300);
  }
  console.log('SHOTS DONE');
} catch (err) {
  console.error('PLAYTEST ERROR:', err && err.message ? err.message : err);
  process.exitCode = 1;
} finally {
  try { chrome.kill('SIGKILL'); } catch { /* ignore */ }
  try { server.kill('SIGKILL'); } catch { /* ignore */ }
}
