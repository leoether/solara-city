// SOLARA CITY v3 — all sound is synthesized with WebAudio. No audio files.
// Everything is guarded: if the browser has no AudioContext (or it is
// suspended before the first user gesture) every call is a silent no-op.

export class SoundFX {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = null;
    this.sirenHigh = false;
    this.enabled = true;
  }

  // Must be called from a user gesture at least once (start button / key).
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  _tone(freq, dur, type, vol, slideTo) {
    if (!this.ctx || !this.enabled) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
      gain.gain.setValueAtTime(vol || 0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch { /* silent */ }
  }

  _noise(dur, vol, lowpass) {
    if (!this.ctx || !this.enabled) return;
    try {
      const t = this.ctx.currentTime;
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass || 1200;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(vol || 0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start(t);
    } catch { /* silent */ }
  }

  click() { this._tone(660, 0.07, 'square', 0.12); }

  // Continuous engine hum; pitch follows speed. Call setEngine(speed01) per frame.
  startEngine() {
    if (!this.ctx || this.engineOsc) return;
    try {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 320;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.0;
      this.engineOsc.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
    } catch { /* silent */ }
  }

  setEngine(speed01, on) {
    if (!this.ctx || !this.engineOsc) return;
    try {
      const t = this.ctx.currentTime;
      this.engineOsc.frequency.setTargetAtTime(52 + speed01 * 165, t, 0.06);
      this.engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.05 : 0.0, t, 0.08);
      this.engineFilter.frequency.setTargetAtTime(280 + speed01 * 900, t, 0.08);
    } catch { /* silent */ }
  }

  stopEngine() {
    if (!this.engineOsc) return;
    try { this.engineOsc.stop(); } catch { /* silent */ }
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
  }

  crash(strength) {
    this._noise(0.28, 0.15 + 0.25 * Math.min(1, strength), 900);
    this._tone(70, 0.22, 'sine', 0.3, 38);
  }

  shot() {
    this._noise(0.09, 0.3, 3200);
    this._tone(190, 0.08, 'square', 0.16, 70);
  }

  policeShot() {
    this._noise(0.08, 0.16, 2600);
  }

  cash() {
    // Little two-note cash register arpeggio.
    this._tone(880, 0.1, 'triangle', 0.22);
    setTimeout(() => this._tone(1318, 0.16, 'triangle', 0.22), 90);
  }

  busted() {
    this._tone(392, 0.22, 'square', 0.18, 370);
    setTimeout(() => this._tone(311, 0.34, 'square', 0.18, 290), 200);
  }

  wasted() {
    this._tone(220, 0.5, 'sawtooth', 0.2, 55);
    setTimeout(() => this._tone(165, 0.7, 'sawtooth', 0.2, 49), 320);
  }

  legend() {
    [523, 659, 784, 1046].forEach((f, i) => {
      setTimeout(() => this._tone(f, 0.28, 'triangle', 0.22), i * 130);
    });
  }

  startSiren() {
    if (!this.ctx || this.sirenOsc) return;
    try {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 720;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0.045;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      this.sirenHigh = true;
      this.sirenTimer = setInterval(() => {
        if (!this.sirenOsc) return;
        try {
          this.sirenHigh = !this.sirenHigh;
          this.sirenOsc.frequency.setTargetAtTime(this.sirenHigh ? 720 : 540, this.ctx.currentTime, 0.05);
        } catch { /* silent */ }
      }, 420);
    } catch { /* silent */ }
  }

  stopSiren() {
    if (this.sirenTimer) clearInterval(this.sirenTimer);
    this.sirenTimer = null;
    if (!this.sirenOsc) return;
    try { this.sirenOsc.stop(); } catch { /* silent */ }
    this.sirenOsc = null;
    this.sirenGain = null;
  }
}
