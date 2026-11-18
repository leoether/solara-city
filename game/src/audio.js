// audio.js — all sound is synthesised with WebAudio (no audio assets): engine hum,
// two-tone siren, gunshot noise, pickup chime and mission jingle. Safe to call headless.
export class AudioSynth {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = 0;
  }
  ensure() {
    if (this.ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      // engine hum
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 320;
      this.engineOsc.connect(lp);
      lp.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);
      this.engineOsc.start();
      // siren
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'sine';
      this.sirenOsc.frequency.value = 700;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.ctx.destination);
      this.sirenOsc.start();
      return true;
    } catch {
      return false;
    }
  }
  setEngine(speed01, driving) {
    if (!this.ctx || this.muted) return;
    const target = driving ? 0.02 + speed01 * 0.05 : 0;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
    this.engineOsc.frequency.setTargetAtTime(55 + speed01 * 110, this.ctx.currentTime, 0.1);
  }
  setSiren(on, dt) {
    if (!this.ctx) return;
    if (on && !this.muted) {
      this.sirenTimer += dt;
      const f = 650 + 250 * Math.sin(this.sirenTimer * 4.5);
      this.sirenOsc.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.05);
      this.sirenGain.gain.setTargetAtTime(0.018, this.ctx.currentTime, 0.1);
    } else if (this.sirenGain) {
      this.sirenGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
    }
  }
  blip(freq, dur, type = 'sine', vol = 0.08) {
    if (!this.ctx || this.muted) return;
    try {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
      o.connect(g);
      g.connect(this.ctx.destination);
      o.start();
      o.stop(this.ctx.currentTime + dur);
    } catch { /* ignore */ }
  }
  shot() {
    if (!this.ctx || this.muted) return;
    try {
      const len = 0.12;
      const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const g = this.ctx.createGain();
      g.gain.value = 0.22;
      src.connect(g);
      g.connect(this.ctx.destination);
      src.start();
    } catch { /* ignore */ }
  }
  chime() {
    this.blip(880, 0.12);
    setTimeout(() => this.blip(1318, 0.18), 90);
  }
  jingle() {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 'triangle', 0.09), i * 110));
  }
  toggleMute() {
    this.muted = !this.muted;
    if (this.engineGain) this.engineGain.gain.value = 0;
    if (this.sirenGain) this.sirenGain.gain.value = 0;
    return this.muted;
  }
}
