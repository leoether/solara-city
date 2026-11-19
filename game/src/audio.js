// SOLARA CITY — audio.js
// All sound is synthesized with WebAudio. No audio files, no network.
// Engine hum, crash, gunshot, police siren, cash chime, pickup blip.

export class SynthAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenLfo = null;
    this.muted = false;
    this.sirenOn = false;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      // Engine: sawtooth through lowpass, pitch follows speed.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 420;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.0;
      this.engineOsc.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
      // Siren: triangle with slow LFO on frequency.
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 750;
      this.sirenLfo = this.ctx.createOscillator();
      this.sirenLfo.type = 'sine';
      this.sirenLfo.frequency.value = 0.9;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 320;
      this.sirenLfo.connect(lfoGain);
      lfoGain.connect(this.sirenOsc.frequency);
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0.0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      this.sirenLfo.start();
      return true;
    } catch (err) {
      return false;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.5, this.ctx.currentTime, 0.05);
    }
  }

  setEngine(speedNorm, driving) {
    if (!this.ctx || !this.engineGain) return;
    const t = this.ctx.currentTime;
    const target = driving ? 0.05 + 0.11 * speedNorm : 0.0;
    this.engineGain.gain.setTargetAtTime(target, t, 0.08);
    this.engineOsc.frequency.setTargetAtTime(52 + 165 * speedNorm, t, 0.1);
    this.engineFilter.frequency.setTargetAtTime(380 + 900 * speedNorm, t, 0.1);
  }

  setSiren(on) {
    if (!this.ctx || !this.sirenGain) return;
    if (on === this.sirenOn) return;
    this.sirenOn = on;
    this.sirenGain.gain.setTargetAtTime(on ? 0.05 : 0.0, this.ctx.currentTime, 0.2);
  }

  blip(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      gain.gain.setValueAtTime(vol || 0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch (err) {
      /* ignore */
    }
  }

  noise(dur, vol, filterFreq) {
    if (!this.ctx || this.muted) return;
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
      filter.frequency.value = filterFreq || 900;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(vol || 0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start(t);
    } catch (err) {
      /* ignore */
    }
  }

  shoot() {
    this.noise(0.09, 0.35, 2600);
    this.blip(190, 0.07, 'square', 0.12, 60);
  }

  crash(strength) {
    this.noise(0.28, Math.min(0.5, 0.2 + strength * 0.3), 500);
    this.blip(70, 0.22, 'sine', 0.25, 38);
  }

  cash() {
    this.blip(880, 0.12, 'sine', 0.2);
    setTimeout(() => this.blip(1318, 0.18, 'sine', 0.2), 90);
    setTimeout(() => this.blip(1760, 0.26, 'sine', 0.18), 190);
  }

  pickup() {
    this.blip(660, 0.1, 'triangle', 0.2, 990);
  }

  busted() {
    this.blip(392, 0.25, 'square', 0.16, 370);
    setTimeout(() => this.blip(311, 0.4, 'square', 0.16, 280), 220);
  }

  wasted() {
    this.blip(220, 0.5, 'sawtooth', 0.2, 55);
    setTimeout(() => this.blip(165, 0.7, 'sawtooth', 0.18, 40), 350);
  }

  click() {
    this.blip(520, 0.06, 'sine', 0.14);
  }

  horn() {
    this.blip(370, 0.16, 'square', 0.12);
    setTimeout(() => this.blip(466, 0.16, 'square', 0.1), 30);
  }
}
