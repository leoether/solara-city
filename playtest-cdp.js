// SOLARA CITY — headless full-loop playtest via Chrome CDP (fresh build v5).
// Usage: node playtest-cdp.js
// Spawns serve.ts on :8901 and /opt/meta-chromium/chrome headless, then
// drives the real game: boot -> start -> steal -> drive -> shoot -> pause
// -> missions 1-4 -> LEGEND $3.100 -> save/continue -> busted -> wasted.
// Exits 0 only when every check passes with 0 console errors.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const CHROME = '/opt/meta-chromium/chrome';
const POLICY_FILE = path.join(import.meta.dirname, 'webgl-policy.txt');
const POLICY_SHA = crypto.createHash('sha256').update(fs.readFileSync(POLICY_FILE)).digest('hex');
const CHROME_FLAGS = [
  '--headless=new', '--remote-debugging-port=9222', '--no-sandbox',
  '--disable-gpu', '--window-size=1280,720', '--autoplay-policy=no-user-gesture-required',
  `--hatch-webgl-allowed-domains-file=${POLICY_FILE}`,
  `--hatch-webgl-allowed-domains-sha256=${POLICY_SHA}`,
];
const PORT = 8901;
const URL = `http://localhost:${PORT}/`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let passed = 0;
let failed = 0;
const results = [];
function check(name, ok, detail = '') {
  results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  if (ok) passed++; else failed++;
}

async function getJson(path) {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://localhost:9222${path}`);
      if (r.ok) return await r.json();
    } catch { /* retry */ }
    await sleep(250);
  }
  throw new Error('CDP not reachable: ' + path);
}

async function main() {
  const server = spawn('node', ['serve.ts', String(PORT)], {
    cwd: import.meta.dirname, stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', (d) => process.stdout.write('[serve] ' + d));
  server.stderr.on('data', (d) => process.stdout.write('[serve:err] ' + d));
  const chrome = spawn(CHROME, [
    ...CHROME_FLAGS,
    '--user-data-dir=/tmp/solara-playtest-profile', 'chrome://newtab/',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  chrome.stderr.on('data', () => { /* chrome logs are noisy; ignore */ });

  // Wait for the game server to actually listen before navigating.
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(URL + 'health');
      if (r.ok) break;
    } catch { /* not up yet */ }
    await sleep(250);
  }

  let ws;
  try {
    await getJson('/json/version');
    // Attach to the startup tab (chrome://newtab/) — do NOT create a tab
    // via /json/new: Chrome 157 blocks that navigation with
    // ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS. Navigating FROM the
    // trusted chrome:// tab via location.href is allowed.
    const tabs = await getJson('/json/list');
    const target = tabs.find((t) => t.type === 'page');
    if (!target) throw new Error('no page target found');
    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let msgId = 0;
    const pending = new Map();
    const consoleErrors = [];
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) {
        const { resolve, reject } = pending.get(m.id);
        pending.delete(m.id);
        if (m.error) reject(new Error(JSON.stringify(m.error)));
        else resolve(m.result);
      }
      if (m.method === 'Runtime.exceptionThrown') {
        consoleErrors.push('exception: ' + JSON.stringify(m.params.exceptionDetails).slice(0, 400));
      }
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
        consoleErrors.push('console.error: ' + m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 400));
      }
      if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
        consoleErrors.push('log.error: ' + (m.params.entry.text || '') + ' ' + (m.params.entry.url || ''));
      }
    };
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++msgId;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
    const evalJs = async (expr) => {
      const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(r.exceptionDetails).slice(0, 500));
      return r.result ? r.result.value : undefined;
    };
    const key = async (type, k, code, vk) => {
      await send('Input.dispatchKeyEvent', { type, key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
    };
    const tap = async (k, code, vk) => {
      await key('keyDown', k, code, vk);
      await sleep(60);
      await key('keyUp', k, code, vk);
    };

    await send('Runtime.enable');
    await send('Page.enable');
    await send('Log.enable');
    // Navigate to the game from the trusted chrome:// tab.
    await send('Runtime.evaluate', { expression: `location.href = ${JSON.stringify(URL)}` });
    // Wait for the game module to load (server + navigation can race).
    let ready = false;
    for (let i = 0; i < 30; i++) {
      await sleep(500);
      try {
        ready = await evalJs(`!!window.__solara`);
        if (ready) break;
        // Navigation failed (chrome-error page)? Retry from this tab.
        const href = await evalJs(`location.href`).catch(() => '');
        if (href && href.startsWith('chrome-error')) {
          await evalJs(`location.href = ${JSON.stringify(URL)}`).catch(() => {});
        }
      } catch { /* not loaded yet */ }
    }
    check('game loaded (window.__solara)', ready);
    if (!ready) {
      console.log('page state:', await evalJs(`document.title + ' | ' + location.href + ' | readyState=' + document.readyState`).catch((e) => String(e)));
      console.log('console errors so far:', consoleErrors.join(' | '));
    }
    await sleep(800); // let the game boot + first frames run

    check('game object present', await evalJs(`!!window.__solara`));
    check('boot mode', (await evalJs(`window.__solara.mode()`)) === 'boot');
    check('no page errors at boot', consoleErrors.length === 0, consoleErrors.join(' | '));

    // --- WIN PATH ---
    await evalJs(`window.__solara.start(false)`);
    await sleep(400);
    check('start -> playing', (await evalJs(`window.__solara.mode()`)) === 'playing');
    check('mission 1 active', await evalJs(`window.__solara.state.mission && window.__solara.state.mission.kind === 0`));

    // Steal a car (real debug helper moves the player next to a parked car).
    check('steal car', await evalJs(`window.__solara.stealNearest()`));
    await sleep(300);
    check('in car after steal', await evalJs(`!window.__solara.state.player.onFoot && !!window.__solara.state.player.car`));
    check('wanted 1 after steal', (await evalJs(`window.__solara.state.wanted`)) === 1);
    check('cops spawned', (await evalJs(`window.__solara.state.cops.length`)) >= 1);

    // Drive forward with a real key event.
    const x0 = await evalJs(`window.__solara.state.player.x`);
    await key('keyDown', 'w', 'KeyW', 87);
    await sleep(1500);
    await key('keyUp', 'w', 'KeyW', 87);
    const speed = await evalJs(`Math.abs(window.__solara.state.player.car ? window.__solara.state.player.car.speed : 0)`);
    check('driving moves the car', speed > 40, `speed=${Math.round(speed)}`);

    // Shoot on foot: exit car first, then shoot toward the mouse.
    await tap('e', 'KeyE', 69);
    await sleep(300);
    check('exit car -> on foot', await evalJs(`window.__solara.state.player.onFoot`));
    await evalJs(`window.__solara.shoot()`);
    await sleep(150);
    check('shoot fires', (await evalJs(`window.__solara.state.stats.shots`)) >= 1);
    check('bullet exists', (await evalJs(`window.__solara.state.bullets.length`)) >= 1);

    // Pause / resume.
    await evalJs(`window.__solara.pause()`);
    check('pause works', (await evalJs(`window.__solara.mode()`)) === 'paused');
    await evalJs(`window.__solara.resume()`);
    check('resume works', (await evalJs(`window.__solara.mode()`)) === 'playing');

    // Mission 1: teleport to the package, then to the destination.
    await evalJs(`(() => { const S = window.__solara.state; window.__solara.teleport(S.packagePos.x, S.packagePos.y); })()`);
    await sleep(400);
    check('package picked up', await evalJs(`window.__solara.state.mission && window.__solara.state.mission.pickupDone === true`));
    await evalJs(`(() => { const S = window.__solara.state; window.__solara.teleport(S.destPos.x, S.destPos.y); })()`);
    await sleep(400);
    check('mission 1 complete: cash $300', (await evalJs(`window.__solara.state.cash`)) === 300, `cash=${await evalJs('window.__solara.state.cash')}`);
    check('mission 2 active', await evalJs(`window.__solara.state.mission && window.__solara.state.mission.kind === 1`));

    // Mission 2: timed escape — teleport to the destination.
    await evalJs(`(() => { const S = window.__solara.state; window.__solara.teleport(S.destPos.x, S.destPos.y); })()`);
    await sleep(400);
    check('mission 2 complete: cash $800', (await evalJs(`window.__solara.state.cash`)) === 800, `cash=${await evalJs('window.__solara.state.cash')}`);
    check('mission 3 active, wanted 3', (await evalJs(`window.__solara.state.wanted`)) === 3);

    // Mission 3: survival — fast-forward the timer.
    await evalJs(`window.__solara.state.mission.timer = 0.4`);
    await sleep(900);
    check('mission 3 complete: cash $1600', (await evalJs(`window.__solara.state.cash`)) === 1600, `cash=${await evalJs('window.__solara.state.cash')}`);
    check('mission 4 active (gold coupe)', await evalJs(`window.__solara.state.mission && window.__solara.state.mission.kind === 3 && !!window.__solara.state.goldCoupe`));

    // Mission 4: walk to the gold coupe, steal it with the real E key.
    await evalJs(`(() => { const S = window.__solara.state; const g = S.goldCoupe; window.__solara.teleport(g.x + 10, g.y); })()`);
    await sleep(400); // a frame must run so stealTarget is set
    await tap('e', 'KeyE', 69);
    await sleep(300);
    check('gold coupe stolen', await evalJs(`window.__solara.state.player.car && window.__solara.state.player.car.isGold === true`));
    await evalJs(`(() => { const S = window.__solara.state; window.__solara.teleport(S.destPos.x, S.destPos.y); })()`);
    await sleep(500);
    check('LEGEND mode', (await evalJs(`window.__solara.mode()`)) === 'legend', `mode=${await evalJs('window.__solara.mode()')}`);
    check('LEGEND total $3100', (await evalJs(`window.__solara.state.cash`)) === 3100, `cash=${await evalJs('window.__solara.state.cash')}`);

    // Save / continue.
    const saved = await evalJs(`window.__solara.load()`);
    check('save written to localStorage', !!saved && saved.cash === 3100, JSON.stringify(saved));
    await evalJs(`window.__solara.start(true)`);
    await sleep(300);
    check('continue loads save', (await evalJs(`window.__solara.state.cash`)) === 3100 && (await evalJs(`window.__solara.mode()`)) === 'playing');

    // --- LOSE PATH: wasted ---
    await evalJs(`window.__solara.damage(500)`);
    await sleep(400);
    check('wasted on death', (await evalJs(`window.__solara.mode()`)) === 'wasted');
    await tap('Enter', 'Enter', 13);
    await sleep(300);
    check('respawn after wasted', (await evalJs(`window.__solara.mode()`)) === 'playing' && (await evalJs(`window.__solara.state.player.health`)) === 100);

    // --- LOSE PATH: busted (on foot, cop touches player) ---
    await evalJs(`window.__solara.setWanted(2)`);
    await evalJs(`(() => { const S = window.__solara.state; const c = S.cops[0]; if (c) window.__solara.teleport(c.x + 5, c.y); S.player.invuln = 0; })()`);
    await sleep(1200);
    const modeNow = await evalJs(`window.__solara.mode()`);
    check('busted when caught on foot', modeNow === 'busted', `mode=${modeNow}`);
    if (modeNow === 'busted') {
      await tap('Enter', 'Enter', 13);
      await sleep(300);
      check('respawn after busted', (await evalJs(`window.__solara.mode()`)) === 'playing');
    }

    check('0 console errors total', consoleErrors.length === 0, consoleErrors.join(' | '));
    check('0 uncaught page errors', (await evalJs(`window.__solara.errors.length`)) === 0, JSON.stringify(await evalJs(`window.__solara.errors`)));
  } finally {
    if (ws) ws.close();
    chrome.kill('SIGKILL');
    server.kill('SIGKILL');
  }

  console.log('\n=== SOLARA CITY PLAYTEST ===');
  for (const r of results) console.log(r);
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('PLAYTEST CRASH:', e);
  process.exit(2);
});
