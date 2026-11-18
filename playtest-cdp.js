// CDP playtest for SOLARA CITY — drives the real game in headless Chrome with real
// keyboard/mouse events and asserts the full loop: win (4 missions) + lose (busted,
// wasted) + shooting + save, with zero console errors. Node 22+ stdlib only.
// NOTE: SwiftShader renders at ~1 fps, and the game clamps dt to 0.05, so game time runs
// at ~0.05x real time — every wait below POLLS for a condition instead of sleeping a
// fixed amount, or a slow frame rate would false-fail the test. (Measured 2026-11-18:
// ~2 frames per 2s sample; a car accelerating from 0 needs ~20 frames to travel 8m,
// i.e. ~20s wall clock — timeouts below carry generous margin for that.)
const CHROME = `${process.env.HOME}/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell`;
const GAME_URL = 'http://127.0.0.1:8901/';
const PORT = 9333;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

async function main() {
  const { spawn } = await import('node:child_process');
  const chrome = spawn(CHROME, [
    '--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    `--remote-debugging-port=${PORT}`, '--window-size=1280,720', 'about:blank',
  ], { stdio: 'ignore' });
  const errors = [];
  try {
    let version = null;
    for (let i = 0; i < 30; i += 1) {
      try {
        version = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
        break;
      } catch { await sleep(500); }
    }
    if (!version) throw new Error('devtools endpoint never came up');
    const ws = new WebSocket(version.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let msgId = 0;
    const pending = new Map();
    let sessionId = null;
    const events = [];
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
      else if (m.method) events.push(m);
    };
    const send = (method, params = {}, sess = sessionId) => new Promise((res) => {
      const id = ++msgId;
      pending.set(id, res);
      const msg = { id, method, params };
      if (sess) msg.sessionId = sess;
      ws.send(JSON.stringify(msg));
    });
    const evalJs = async (expr) => {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
      if (r.result?.exceptionDetails) return { error: r.result.exceptionDetails.text + ' ' + (r.result.exceptionDetails.exception?.description || '') };
      return r.result?.result?.value;
    };
    const key = async (code, k, vk, type) => send('Input.dispatchKeyEvent', { type, code, key: k, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
    const tapKey = async (code, k, vk) => { await key(code, k, vk, 'keyDown'); await sleep(120); await key(code, k, vk, 'keyUp'); };
    const click = async (x, y) => {
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
      await sleep(80);
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    };
    // Poll fn() until truthy (or timeout). Returns the truthy value or null.
    const waitFor = async (fn, timeoutMs = 30000, label = '') => {
      const t0 = Date.now();
      while (Date.now() - t0 < timeoutMs) {
        try {
          const v = await fn();
          if (v) return v;
        } catch { /* keep polling */ }
        await sleep(400);
      }
      console.log(`TIMEOUT waiting for: ${label}`);
      return null;
    };
    // Hold a key until cond() is true, then release it.
    const holdUntil = async (code, k, vk, cond, timeoutMs = 30000, label = '') => {
      await key(code, k, vk, 'keyDown');
      const v = await waitFor(cond, timeoutMs, label);
      await key(code, k, vk, 'keyUp');
      return v;
    };

    const target = await send('Target.createTarget', { url: 'about:blank' }, undefined);
    const targetId = target.result.targetId;
    const attached = await send('Target.attachToTarget', { targetId, flatten: true }, undefined);
    sessionId = attached.result.sessionId;
    await send('Runtime.enable');
    await send('Log.enable');
    await send('Page.enable');
    await send('Page.navigate', { url: GAME_URL });
    await sleep(5000);

    const state = async () => evalJs(`({s:__solara.state, x:+__solara.player.x.toFixed(1), z:+__solara.player.z.toFixed(1), hp:__solara.player.health, money:__solara.player.money, wanted:__solara.police.wanted, driving:__solara.player.driving, mi:__solara.missions.index, done:__solara.missions.done, speed:__solara.player.driving?+__solara.player.car.speed.toFixed(1):0})`);
    const st0 = await state();
    check('game boots, no shot mode, title screen', st0 && st0.s === 'title', JSON.stringify(st0));

    await evalJs(`document.getElementById('start-btn').click()`);
    await sleep(1200);
    const warmed = await waitFor(async () => { const f = await evalJs(`__solara.frames||0`); return f > 60 ? f : null; }, 60000, 'game loop warm-up (60 frames)');
    check('game loop warms up (frames ticking under SwiftShader)', warmed !== null, `frames=${warmed}`);
    const st1 = await state();
    check('start button begins play, mission 1 active', st1 && st1.s === 'play' && st1.mi === 0, JSON.stringify(st1));

    // --- MISSION 1: steal a parked car with a real E keypress ---
    await evalJs(`__solara.player.x=-54; __solara.player.z=2; __solara.player.mesh.position.set(-54,0,2);`);
    await sleep(400);
    await tapKey('KeyE', 'e', 69);
    const st2 = await waitFor(async () => { const s = await state(); return s && s.driving ? s : null; }, 10000, 'driving after E');
    check('E steals the parked car, wanted rises to 1', st2 && st2.wanted === 1, JSON.stringify(st2));

    // --- driving physics with a real held W key ---
    const before = await state();
    const drove = await holdUntil('KeyW', 'w', 87, async () => {
      const s = await state();
      return s && Math.hypot(s.x - before.x, s.z - before.z) > 8 && s.speed > 3 ? s : null;
    }, 60000, 'car moves >8m'); // ~20 frames needed at ~1 fps under SwiftShader
    check('holding W drives the car (arcade physics)', !!drove, drove ? `moved to ${drove.x},${drove.z} speed ${drove.speed}` : 'car never got moving');

    // finish mission 1 by driving into the garage marker (8m out, heading north)
    await evalJs(`__solara.player.car.setPos(-60,-112,Math.PI); __solara.player.car.speed=6; __solara.player.x=-60; __solara.player.z=-112;`);
    const st4 = await holdUntil('KeyW', 'w', 87, async () => { const s = await state(); return s && s.mi === 1 ? s : null; }, 30000, 'mission 1 completes');
    check('mission 1 completes: +$300, mission 2 starts', st4 && st4.money === 300, JSON.stringify(st4));

    // --- MISSION 2: pickup then deliver (timer running) ---
    await evalJs(`__solara.player.car.setPos(116,116,Math.PI); __solara.player.car.speed=0; __solara.player.x=116; __solara.player.z=116;`);
    const picked = await waitFor(async () => (await evalJs(`__solara.missions.pickedUp`)) === true, 15000, 'pickup at docks');
    check('mission 2 pickup registers at the docks', picked === true, `pickedUp=${picked}`);
    await evalJs(`__solara.player.car.setPos(0,-112,Math.PI); __solara.player.car.speed=6; __solara.player.x=0; __solara.player.z=-112;`);
    const st5 = await holdUntil('KeyW', 'w', 87, async () => { const s = await state(); return s && s.mi === 2 ? s : null; }, 30000, 'mission 2 completes');
    check('mission 2 completes: +$500 (total $800), mission 3 starts with wanted 3', st5 && st5.money === 800 && st5.wanted === 3, JSON.stringify(st5));

    // --- MISSION 3: survival timer ticks under wanted 3 ---
    const surv0 = await evalJs(`__solara.missions.surviveLeft`);
    const ticked = await waitFor(async () => { const v = await evalJs(`__solara.missions.surviveLeft`); return v < surv0 - 1 ? v : null; }, 30000, 'survival timer ticks');
    check('mission 3 survival timer ticks down under 3 stars', ticked !== null, `${surv0} -> ${ticked}`);
    await evalJs(`__solara.missions.surviveLeft=0.5; __solara.player.car.setPos(-118,58,-Math.PI/4); __solara.player.car.speed=6; __solara.player.x=-118; __solara.player.z=58;`);
    const st6 = await holdUntil('KeyW', 'w', 87, async () => { const s = await state(); return s && s.mi === 3 ? s : null; }, 30000, 'mission 3 completes');
    const gold = await waitFor(async () => (await evalJs(`!!__solara.goldCar`)) === true, 15000, 'gold car spawns');
    check('mission 3 completes: +$800 (total $1,600), mission 4 starts, gold car spawns', st6 && st6.money === 1600 && gold === true, JSON.stringify(st6));

    // --- MISSION 4: steal the gold coupe, deliver it ---
    await evalJs(`__solara.player.exitCar(); __solara.player.x=58; __solara.player.z=58; __solara.player.mesh.position.set(58,0,58);`);
    await sleep(400);
    await tapKey('KeyE', 'e', 69);
    const st7 = await waitFor(async () => { const s = await state(); return s && s.driving ? s : null; }, 10000, 'driving gold coupe');
    check('E steals the gold coupe, heat jumps to 3', st7 && st7.wanted >= 3, JSON.stringify(st7));
    await evalJs(`__solara.player.car.setPos(-60,-112,Math.PI); __solara.player.car.speed=6; __solara.player.x=-60; __solara.player.z=-112;`);
    const st8 = await holdUntil('KeyW', 'w', 87, async () => { const s = await state(); return s && s.done === true ? s : null; }, 30000, 'mission 4 completes');
    check('mission 4 completes: SOLARA LEGEND, $3,100 total', st8 && st8.money === 3100 && st8.s === 'complete', JSON.stringify(st8));
    const saved = await evalJs(`JSON.parse(localStorage.getItem('solara-city-save-v1')||'{}')`);
    check('progress saves to localStorage', saved && saved.money === 3100 && saved.done === true, JSON.stringify(saved));

    // --- LOSE PATH 1: busted ---
    await evalJs(`document.getElementById('end-btn').click()`);
    await sleep(800);
    await evalJs(`if(__solara.player.driving) __solara.player.exitCar(); __solara.police.setWanted(3); const c=__solara.police.cops[0]; if(c){c.mesh.position.set(__solara.player.x+0.5,0,__solara.player.z); c.placed=true;}`);
    const st9 = await waitFor(async () => { const s = await state(); return s && s.s === 'busted' ? s : null; }, 40000, 'busted screen');
    check('cop contact busts the player (bail screen)', !!st9, JSON.stringify(st9));
    await evalJs(`document.getElementById('end-btn').click()`);
    await sleep(800);
    const st10 = await state();
    check('respawn after busted: back in play, wanted cleared', st10 && st10.s === 'play' && st10.wanted === 0, JSON.stringify(st10));

    // --- LOSE PATH 2: wasted ---
    await evalJs(`__solara.player.takeDamage(200)`);
    const st11 = await waitFor(async () => { const s = await state(); return s && s.s === 'wasted' ? s : null; }, 15000, 'wasted screen');
    check('lethal damage shows WASTED screen', !!st11, JSON.stringify(st11));
    await evalJs(`document.getElementById('end-btn').click()`);
    await sleep(800);

    // --- combat: real mouse click shoots ---
    const cd0 = await evalJs(`__solara.combat.cooldown`);
    await click(640, 360);
    await sleep(500);
    const cd1 = await evalJs(`__solara.combat.cooldown`);
    check('mouse click fires the gun (cooldown engaged)', cd1 > cd0, `cooldown ${cd0} -> ${cd1}`);

    // --- pause ---
    await tapKey('KeyP', 'p', 80);
    await sleep(600);
    const st12 = await state();
    check('P pauses the game', st12 && st12.s === 'pause', JSON.stringify(st12));
    await tapKey('KeyP', 'p', 80);
    await sleep(600);

    // --- console errors ---
    for (const e of events) {
      if (e.method === 'Runtime.exceptionThrown') errors.push('EXCEPTION: ' + JSON.stringify(e.params.exceptionDetails).slice(0, 400));
      if (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error') errors.push('CONSOLE.ERROR: ' + JSON.stringify(e.params.args).slice(0, 400));
      if (e.method === 'Log.entryAdded' && e.params.entry.level === 'error') errors.push('LOG.ERROR: ' + (e.params.entry.text || '').slice(0, 300));
    }
    check('zero console errors / exceptions during the whole playtest', errors.length === 0, errors.slice(0, 3).join(' | ') || 'clean');

    const failed = results.filter((r) => !r.ok).length;
    console.log(`\nPLAYTEST: ${results.length - failed}/${results.length} passed, ${failed} failed, ${errors.length} console errors`);
    require('node:fs').writeFileSync(process.env.PLAYTEST_OUT || '/tmp/solara-playtest.json', JSON.stringify({ results, errors }, null, 2));
  } finally {
    chrome.kill('SIGKILL');
  }
  process.exit(results.some((r) => !r.ok) ? 1 : 0);
}

main().catch((e) => { console.error('PLAYTEST CRASH:', e); process.exit(2); });
