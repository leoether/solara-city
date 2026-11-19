// SOLARA CITY — screenshot capture (fresh build v5).
// Usage: node capture-shots.js
// Spawns serve.ts on :8901 and headless Chrome, loads the game, applies
// each shot preset from game/src/shots.js via window.__solara.applyShot,
// and saves 1280x720 screenshots to screenshots/<id>.jpg.

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
const OUT = path.join(import.meta.dirname, 'screenshots');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
  fs.mkdirSync(OUT, { recursive: true });
  const server = spawn('node', ['serve.ts', String(PORT)], {
    cwd: import.meta.dirname, stdio: ['ignore', 'pipe', 'pipe'],
  });
  const chrome = spawn(CHROME, [
    ...CHROME_FLAGS,
    '--user-data-dir=/tmp/solara-shots-profile', 'chrome://newtab/',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

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
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) {
        const { resolve, reject } = pending.get(m.id);
        pending.delete(m.id);
        if (m.error) reject(new Error(JSON.stringify(m.error)));
        else resolve(m.result);
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

    await send('Runtime.enable');
    await send('Page.enable');
    // Force a true 1280x720 viewport so the canvas renders at full size.
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    // Navigate to the game from the trusted chrome:// tab.
    await send('Runtime.evaluate', { expression: `location.href = ${JSON.stringify(URL)}` });
    // Wait for the game module to load (server + navigation can race).
    let ready = false;
    for (let i = 0; i < 30; i++) {
      await sleep(500);
      try {
        ready = await evalJs(`!!window.__solara`);
        if (ready) break;
        const href = await evalJs(`location.href`).catch(() => '');
        if (href && href.startsWith('chrome-error')) {
          await evalJs(`location.href = ${JSON.stringify(URL)}`).catch(() => {});
        }
      } catch { /* not loaded yet */ }
    }
    if (!ready) throw new Error('game did not load (window.__solara missing after 15s)');
    await sleep(800);

    const shots = ['1-chase', '2-reward', '3-legend', '4-shootout'];
    for (const id of shots) {
      // Fresh start per shot so each scene is independent.
      await evalJs(`window.__solara.start(false)`);
      await sleep(400);
      const ok = await evalJs(`window.__solara.applyShot('${id}')`);
      await sleep(700); // let particles/shake settle into a good frame
      const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 88 });
      const file = path.join(OUT, `${id}.jpg`);
      fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
      const size = fs.statSync(file).size;
      console.log(`${ok ? 'OK  ' : 'FAIL'} ${id}.jpg (${size} bytes)`);
      if (!ok) process.exitCode = 1;
    }
  } finally {
    if (ws) ws.close();
    chrome.kill('SIGKILL');
    server.kill('SIGKILL');
  }
  console.log('done — screenshots in', OUT);
}

main().catch((e) => {
  console.error('CAPTURE CRASH:', e);
  process.exit(2);
});
