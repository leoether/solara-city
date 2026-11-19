// SOLARA CITY — playtest-cdp.js
// Playtest headless via Chrome DevTools Protocol (Node 24, WebSocket global,
// tanpa dependensi): full loop menang + jalur kalah + tembak + pause +
// save/continue, lalu 4 screenshot 1280x720. Keluar 0 bila semua lolos,
// 1 bila ada yang gagal / console error.
//
// Jalankan: node serve.ts (port 8080) di terminal lain, lalu:
//   node playtest-cdp.js [--shots-only|--test-only]

import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = 8080;
const CDP_PORT = 9223;
const URL = `http://localhost:${PORT}/`;
const SHOTS_ONLY = process.argv.includes('--shots-only');
const TEST_ONLY = process.argv.includes('--test-only');

const errors = [];
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

const chrome = spawn(process.env.CHROME_PATH || (process.env.HOME + '/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome'), [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  `--remote-debugging-port=${CDP_PORT}`,
  '--window-size=1280,720',
  '--user-data-dir=/tmp/solara-chrome-profile',
  '--autoplay-policy=no-user-gesture-required',
  'about:blank',
], { stdio: 'ignore' });

async function cdp(path) {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${CDP_PORT}${path}`);
      if (r.ok) return r.json();
    } catch (e) { /* belum siap */ }
    await sleep(250);
  }
  throw new Error('CDP tidak merespons: ' + path);
}

let ws, msgId = 0;
const pending = new Map();
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function ev(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error('evaluate gagal: ' + JSON.stringify(r.exceptionDetails).slice(0, 400));
  return r.result.value;
}
async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 88 });
  writeFileSync(`screenshots/${name}`, Buffer.from(r.data, 'base64'));
  console.log('SHOT  ' + name);
}
async function key(type, keyName, code, keyCode) {
  await send('Input.dispatchKeyEvent', { type, key: keyName, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode });
}
async function keyTap(keyName, code, keyCode) {
  await key('keyDown', keyName, code, keyCode);
  await sleep(60);
  await key('keyUp', keyName, code, keyCode);
}
async function mouseDownAt(x, y, holdMs = 350) {
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await sleep(holdMs);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
}

try {
  const targets = await cdp('/json/list');
  const page = targets.find((t) => t.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) {
      pending.get(d.id).resolve(d.result || {});
      pending.delete(d.id);
    }
    if (d.method === 'Runtime.exceptionThrown') {
      errors.push('exception: ' + JSON.stringify(d.params.exceptionDetails).slice(0, 300));
    }
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') {
      errors.push('console.error: ' + d.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 300));
    }
    if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') {
      errors.push('log.error: ' + d.params.entry.text.slice(0, 300));
    }
  };
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: URL });
  // Tunggu __SOLARA siap.
  let ready = false;
  for (let i = 0; i < 40; i++) {
    try { ready = await ev('!!window.__SOLARA'); if (ready) break; } catch (e) { /* retry */ }
    await sleep(250);
  }
  check('game boot (__SOLARA tersedia)', ready);
  if (!ready) throw new Error('game tidak boot');

  if (!SHOTS_ONLY) {
    // --- Full loop MENANG ---
    check('boot screen', (await ev('__SOLARA.state().screen')) === 'boot');
    await ev('__SOLARA.start(false)');
    await sleep(400);
    check('start -> play', (await ev('__SOLARA.state().screen')) === 'play');

    // Curi mobil: teleport ke mobil parkir (2350,2100) lalu E.
    await ev('__SOLARA.teleport(2350,2080)');
    await sleep(200);
    await ev('__SOLARA.press("e")');
    await sleep(300);
    let st = await ev('__SOLARA.state()');
    check('curi mobil (E)', st.inCar === true, JSON.stringify(st));
    check('wanted 1 sesudah curi', st.wanted === 1, 'wanted=' + st.wanted);

    // --- Jalur KALAH (awal): busted saat polisi menempel mobil berhenti ---
    await ev('__SOLARA.game.cops[0].x = __SOLARA.game.player.x; __SOLARA.game.cops[0].y = __SOLARA.game.player.y;');
    await sleep(600);
    st = await ev('__SOLARA.state()');
    check('busted saat polisi menempel', st.screen === 'busted', JSON.stringify(st));
    await ev('__SOLARA.press("enter")');
    await sleep(300);
    st = await ev('__SOLARA.state()');
    check('respawn sesudah busted', st.screen === 'play');
    // Sesudah respawn pemain jalan kaki (mobil curian pertama hilang):
    // curi mobil parkir lain di (900,2350) untuk lanjut misi.
    await ev('__SOLARA.teleport(900,2330)');
    await sleep(200);
    await ev('__SOLARA.press("e")');
    await sleep(300);
    st = await ev('__SOLARA.state()');
    check('curi mobil lagi sesudah respawn', st.inCar === true, JSON.stringify(st));

    // Misi 1: M -> pickup -> drop.
    await ev('__SOLARA.press("m")');
    await sleep(200);
    st = await ev('__SOLARA.state()');
    check('misi 1 mulai (toPickup)', st.missionPhase === 'toPickup');
    await ev('__SOLARA.teleport(2100,300)');
    await sleep(300);
    st = await ev('__SOLARA.state()');
    check('misi 1 pickup -> toDrop', st.missionPhase === 'toDrop');
    await ev('__SOLARA.teleport(2100,3900)');
    await sleep(300);
    st = await ev('__SOLARA.state()');
    check('misi 1 selesai +$300', st.cash === 300 && st.missionIndex === 1, JSON.stringify(st));

    // Misi 2: timer 75s, pickup -> drop.
    await ev('__SOLARA.press("m")');
    await sleep(200);
    await ev('__SOLARA.teleport(600,600)');
    await sleep(300);
    st = await ev('__SOLARA.state()');
    check('misi 2 pickup -> toDrop', st.missionPhase === 'toDrop');
    await ev('__SOLARA.teleport(3900,600)');
    await sleep(300);
    st = await ev('__SOLARA.state()');
    check('misi 2 selesai +$500 (total $800)', st.cash === 800 && st.missionIndex === 2, JSON.stringify(st));

    // Misi 3: survival — percepat dengan set surviveLeft kecil.
    await ev('__SOLARA.press("m")');
    await sleep(200);
    st = await ev('__SOLARA.state()');
    check('misi 3 survive mulai', st.missionPhase === 'survive');
    await ev('__SOLARA.game.missions.surviveLeft = 0.6');
    await sleep(1200);
    st = await ev('__SOLARA.state()');
    check('misi 3 selesai +$800 (total $1600)', st.cash === 1600 && st.missionIndex === 3, JSON.stringify(st));

    // Misi 4: keluar mobil, curi coupe emas, antar.
    await ev('__SOLARA.press("m")');
    await sleep(200);
    await ev('__SOLARA.press("e")'); // keluar mobil biasa
    await sleep(200);
    await ev('__SOLARA.teleport(300,2080)');
    await sleep(200);
    await ev('__SOLARA.press("e")'); // curi coupe emas
    await sleep(300);
    st = await ev('__SOLARA.state()');
    check('coupe emas dicuri (inCar)', st.inCar === true, JSON.stringify(st));
    check('misi 4 -> toDrop', st.missionPhase === 'toDrop');
    await ev('__SOLARA.teleport(3900,3900)');
    await sleep(400);
    st = await ev('__SOLARA.state()');
    check('LEGEND $3100', st.cash === 3100 && st.screen === 'legend', JSON.stringify(st));

    // Save tersimpan saat LEGEND; reload -> Continue memuat.
    const saved = await ev('__SOLARA.saveNow()');
    check('save localStorage ada', saved === true);
    await send('Page.navigate', { url: URL });
    await sleep(1500);
    check('hasSave sesudah reload', (await ev('__SOLARA.game.hasSave')) === true);
    await ev('__SOLARA.start(true)');
    await sleep(400);
    st = await ev('__SOLARA.state()');
    check('Continue memuat cash $3100', st.cash === 3100 && st.screen === 'play', JSON.stringify(st));

    // --- Jalur KALAH: wasted ---
    await ev('__SOLARA.hurt(500)');
    await sleep(300);
    st = await ev('__SOLARA.state()');
    check('WASTED saat HP 0', st.screen === 'wasted', JSON.stringify(st));
    await ev('__SOLARA.press("enter")');
    await sleep(300);
    st = await ev('__SOLARA.state()');
    check('retry sesudah WASTED', st.screen === 'play');

    // --- Tembak + pause ---
    await mouseDownAt(800, 300, 400);
    await sleep(150);
    const bullets = await ev('__SOLARA.game.combat.bullets.length + __SOLARA.game.fx.particles.length');
    check('tembakan menghasilkan peluru/partikel', bullets > 0, 'count=' + bullets);
    await keyTap('p', 'KeyP', 80);
    await sleep(200);
    check('pause (P)', (await ev('__SOLARA.state().screen')) === 'pause');
    await keyTap('p', 'KeyP', 80);
    await sleep(200);
    check('resume dari pause', (await ev('__SOLARA.state().screen')) === 'play');

    // --- Nyetir beneran: tahan W 1,5 detik, mobil harus bergerak ---
    await ev('__SOLARA.teleport(2350,2080)');
    await sleep(150);
    await ev('__SOLARA.press("e")');
    await sleep(200);
    const x0 = await ev('__SOLARA.game.player.x');
    await ev('__SOLARA.setKeys({w:true})');
    await sleep(1500);
    await ev('__SOLARA.setKeys({w:false})');
    const x1 = await ev('__SOLARA.game.player.x');
    check('mobil bergerak saat W ditahan', Math.abs(x1 - x0) > 50, `dx=${Math.round(x1 - x0)}`);
  }

  if (!TEST_ONLY) {
    // --- 4 screenshot 1280x720 ---
    mkdirSync('screenshots', { recursive: true });
    await ev('__SOLARA.stage("chase")');
    await sleep(900);
    await shot('1-chase.jpg');
    await ev('__SOLARA.stage("reward")');
    await sleep(900);
    await shot('2-reward.jpg');
    await ev('__SOLARA.stage("legend")');
    await sleep(900);
    await shot('3-legend.jpg');
    await ev('__SOLARA.stage("shootout")');
    await sleep(900);
    await shot('4-shootout.jpg');
  }

  check('0 console error / exception', errors.length === 0, errors.join(' | ').slice(0, 400));
} catch (e) {
  console.error('PLAYTEST ERROR:', e.message);
  results.push({ name: 'playtest selesai tanpa crash', ok: false, detail: e.message });
} finally {
  try { ws && ws.close(); } catch (e) { /* abaikan */ }
  chrome.kill('SIGKILL');
}

const failed = results.filter((r) => !r.ok);
console.log(`\n== ${results.length - failed.length}/${results.length} lolos ==`);
if (failed.length) { console.log('GAGAL: ' + failed.map((f) => f.name).join(', ')); process.exit(1); }
