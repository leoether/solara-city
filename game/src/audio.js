// SOLARA CITY — WebAudio synth sound (fresh build v5).
// No audio files: every sound is synthesized with oscillators and noise.

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenOn = false;
    this.master = null;
    this.muted = false;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      // Engine: two detuned saws through a lowpass, pitch follows speed.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      const engineOsc2 = this.ctx.createOscillator();
      engineOsc2.type = 'square';
      engineOsc2.frequency.value = 28;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 420;
      this.engineOsc.connect(lp); engineOsc2.connect(lp);
      lp.connect(this.engineGain); this.engineGain.connect(this.master);
      this.engineOsc.start(); engineOsc2.start();
      this._engineOsc2 = engineOsc2;
      // Siren: triangle that wails up and down while wanted.
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 750;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
      this.sirenOsc.start();
    } catch (e) { this.ctx = null; }
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  engine(speed01, on) {
    if (!this.ctx || !this.engineOsc) return;
    const t = this.ctx.currentTime;
    const target = on ? 0.05 + speed01 * 0.075 : 0;
    this.engineGain.gain.setTargetAtTime(target, t, 0.08);
    this.engineOsc.frequency.setTargetAtTime(55 + speed01 * 165, t, 0.08);
    if (this._engineOsc2) this._engineOsc2.frequency.setTargetAtTime(28 + speed01 * 84, t, 0.08);
  }

  siren(on) {
    if (!this.ctx || !this.sirenOsc) return;
    if (on === this.sirenOn) return;
    this.sirenOn = on;
    const t = this.ctx.currentTime;
    this.sirenGain.gain.setTargetAtTime(on ? 0.035 : 0, t, 0.2);
    if (on) {
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.55;
      const lg = this.ctx.createGain(); lg.gain.value = 260;
      lfo.connect(lg); lg.connect(this.sirenOsc.frequency);
      lfo.start(); lfo.stop(t + 30);
      this._sirenLfo = lfo;
    } else if (this._sirenLfo) {
      try { this._sirenLfo.stop(); } catch (e) {}
      this._sirenLfo = null;
    }
  }

  blip(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  noise(dur, vol, filterFreq) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = filterFreq || 900;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol || 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  }

  shoot() { this.noise(0.12, 0.35, 2600); this.blip(220, 0.09, 'square', 0.12, 60); }
  crash(hard) { this.noise(hard ? 0.4 : 0.2, hard ? 0.5 : 0.25, 500); this.blip(70, 0.25, 'sine', 0.3, 35); }
  pickup() { this.blip(660, 0.1, 'sine', 0.2); setTimeout(() => this.blip(880, 0.12, 'sine', 0.2), 90); }
  cash() {
    [523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => this.blip(f, 0.16, 'triangle', 0.22), i * 85));
  }
  busted() { this.blip(440, 0.5, 'sawtooth', 0.18, 110); }
  wasted() { [330, 262, 196, 131].forEach((f, i) => setTimeout(() => this.blip(f, 0.3, 'sawtooth', 0.18), i * 160)); }
  legend() {
    [523, 659, 784, 1047, 1319].forEach((f, i) =>
      setTimeout(() => this.blip(f, 0.35, 'triangle', 0.22), i * 130));
  }
  horn() { this.blip(370, 0.18, 'square', 0.1, 370); }
}
