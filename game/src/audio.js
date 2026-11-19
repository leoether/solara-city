// SOLARA CITY — audio.js
// Semua suara disintesis WebAudio, tanpa file audio: mesin (oscillator +
// noise), tabrakan (noise burst), tembakan (square blip), sirene polisi
// (dua nada bergantian), dan bunyi cash (arpeggio koin).

export function createAudio() {
  const state = {
    ctx: null, master: null, muted: false,
    engineOsc: null, engineGain: null, engineFilter: null,
    sirenOsc: null, sirenGain: null, sirenTimer: 0, sirenHigh: false,
    started: false,
  };

  function ensure() {
    if (state.ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      state.ctx = new AC();
      state.master = state.ctx.createGain();
      state.master.gain.value = 0.5;
      state.master.connect(state.ctx.destination);
      // Mesin: sawtooth rendah + lowpass, gain mengikuti kecepatan.
      state.engineOsc = state.ctx.createOscillator();
      state.engineOsc.type = 'sawtooth';
      state.engineOsc.frequency.value = 55;
      state.engineFilter = state.ctx.createBiquadFilter();
      state.engineFilter.type = 'lowpass';
      state.engineFilter.frequency.value = 320;
      state.engineGain = state.ctx.createGain();
      state.engineGain.gain.value = 0;
      state.engineOsc.connect(state.engineFilter);
      state.engineFilter.connect(state.engineGain);
      state.engineGain.connect(state.master);
      state.engineOsc.start();
      // Sirene: triangle yang frekuensinya digeser bergantian.
      state.sirenOsc = state.ctx.createOscillator();
      state.sirenOsc.type = 'triangle';
      state.sirenOsc.frequency.value = 700;
      state.sirenGain = state.ctx.createGain();
      state.sirenGain.gain.value = 0;
      state.sirenOsc.connect(state.sirenGain);
      state.sirenGain.connect(state.master);
      state.sirenOsc.start();
      state.started = true;
      return true;
    } catch (e) {
      return false;
    }
  }

  function noiseBurst(duration, volume, filterFreq) {
    if (!state.ctx) return;
    const len = Math.floor(state.ctx.sampleRate * duration);
    const buf = state.ctx.createBuffer(1, len, state.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = state.ctx.createBufferSource();
    src.buffer = buf;
    const filt = state.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = filterFreq;
    const g = state.ctx.createGain();
    g.gain.value = volume;
    src.connect(filt); filt.connect(g); g.connect(state.master);
    src.start();
  }

  function blip(freq, duration, type, volume, slideTo) {
    if (!state.ctx) return;
    const t = state.ctx.currentTime;
    const o = state.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + duration);
    const g = state.ctx.createGain();
    g.gain.setValueAtTime(volume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    o.connect(g); g.connect(state.master);
    o.start(t); o.stop(t + duration + 0.02);
  }

  return {
    unlock() { ensure(); if (state.ctx && state.ctx.state === 'suspended') state.ctx.resume(); },
    setMuted(m) { state.muted = m; if (state.master) state.master.gain.value = m ? 0 : 0.5; },
    isMuted() { return state.muted; },
    // rpm 0..1 dan throttle 0..1 mengatur dengung mesin.
    engine(rpm, throttle) {
      if (!state.ctx) return;
      const target = throttle > 0.05 ? 0.05 + rpm * 0.09 : 0.015;
      state.engineGain.gain.setTargetAtTime(target, state.ctx.currentTime, 0.08);
      state.engineOsc.frequency.setTargetAtTime(52 + rpm * 165 + throttle * 30, state.ctx.currentTime, 0.06);
      state.engineFilter.frequency.setTargetAtTime(280 + rpm * 900, state.ctx.currentTime, 0.1);
    },
    engineOff() {
      if (state.ctx) state.engineGain.gain.setTargetAtTime(0, state.ctx.currentTime, 0.1);
    },
    crash(strength) {
      if (!ensure()) return;
      noiseBurst(0.22, Math.min(0.5, 0.12 + strength * 0.4), 900);
      blip(90, 0.18, 'sine', 0.4, 40);
    },
    shoot() {
      if (!ensure()) return;
      blip(880, 0.09, 'square', 0.22, 180);
      noiseBurst(0.06, 0.18, 3200);
    },
    cash() {
      if (!ensure()) return;
      const notes = [1318, 1568, 2093];
      notes.forEach((f, i) => setTimeout(() => blip(f, 0.16, 'sine', 0.3), i * 85));
    },
    pickup() { if (ensure()) blip(660, 0.12, 'sine', 0.28, 990); },
    busted() {
      if (!ensure()) return;
      blip(220, 0.5, 'sawtooth', 0.3, 110);
      noiseBurst(0.4, 0.2, 500);
    },
    wasted() {
      if (!ensure()) return;
      [440, 349, 293, 220].forEach((f, i) => setTimeout(() => blip(f, 0.32, 'triangle', 0.3), i * 170));
    },
    legend() {
      if (!ensure()) return;
      [523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => blip(f, 0.3, 'triangle', 0.3), i * 120));
    },
    // Sirene: panggil tiap frame; on = ada polisi aktif.
    siren(dt, on) {
      if (!state.ctx) return;
      state.sirenTimer += dt;
      if (!on) { state.sirenGain.gain.setTargetAtTime(0, state.ctx.currentTime, 0.1); return; }
      if (state.sirenTimer > 0.42) {
        state.sirenTimer = 0;
        state.sirenHigh = !state.sirenHigh;
        state.sirenOsc.frequency.setTargetAtTime(state.sirenHigh ? 920 : 640, state.ctx.currentTime, 0.02);
      }
      state.sirenGain.gain.setTargetAtTime(0.045, state.ctx.currentTime, 0.15);
    },
  };
}
