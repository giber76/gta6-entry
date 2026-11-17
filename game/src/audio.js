// All sound in Solara Bay is synthesized with WebAudio — no audio files.
// Engine hum (oscillator pitched by speed), two-tone siren, gunshot, pickup,
// crash thud and a short mission sting.
export class AudioEngine {
  constructor() {
    this.ctx = null; this.master = null; this.engineOsc = null; this.engineGain = null;
    this.sirenOn = false; this.sirenNodes = null; this.muted = false;
  }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      // Engine: sawtooth through a low-pass, pitch follows speed.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'lowpass'; filt.frequency.value = 420;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.0;
      this.engineOsc.connect(filt); filt.connect(this.engineGain); this.engineGain.connect(this.master);
      this.engineOsc.start();
    } catch (_) { this.ctx = null; }
  }
  setEngine(speedKmh, driving) {
    if (!this.ctx || !this.engineOsc) return;
    const t = this.ctx.currentTime;
    const target = driving ? 0.05 + Math.min(0.10, speedKmh / 1800) : 0.0;
    this.engineGain.gain.setTargetAtTime(target, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(55 + speedKmh * 0.9, t, 0.08);
  }
  blip(freq, dur, type, vol, when = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.25, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  }
  noise(dur, vol, filterFreq) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq || 1200;
    const g = this.ctx.createGain(); g.gain.value = vol || 0.4;
    src.connect(f); f.connect(g); g.connect(this.master); src.start(t);
  }
  gunshot() { this.noise(0.14, 0.5, 2600); this.blip(160, 0.08, 'square', 0.2); }
  punch() { this.noise(0.08, 0.35, 700); }
  pickup() { this.blip(660, 0.12, 'sine', 0.3); this.blip(990, 0.2, 'sine', 0.3, 0.1); }
  cash() { this.blip(880, 0.1, 'triangle', 0.3); this.blip(1174, 0.12, 'triangle', 0.3, 0.09); this.blip(1568, 0.22, 'triangle', 0.3, 0.18); }
  crash() { this.noise(0.25, 0.5, 500); }
  sting() { [523, 659, 784].forEach((f, i) => this.blip(f, 0.25, 'triangle', 0.25, i * 0.09)); }
  setSiren(on) {
    if (!this.ctx || on === this.sirenOn) return;
    this.sirenOn = on;
    if (!on) {
      if (this.sirenNodes) { try { this.sirenNodes.osc.stop(); } catch (_) {} this.sirenNodes = null; }
      return;
    }
    const osc = this.ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = 750;
    const lfo = this.ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 0.55;
    const lfoGain = this.ctx.createGain(); lfoGain.gain.value = 260;
    const g = this.ctx.createGain(); g.gain.value = 0.045;
    lfo.connect(lfoGain); lfoGain.connect(osc.frequency);
    osc.connect(g); g.connect(this.master);
    osc.start(); lfo.start();
    this.sirenNodes = { osc, lfo };
  }
}
