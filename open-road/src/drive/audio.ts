/** Engine, wind, tire squeal, horn, and bump sounds made with the Web Audio API. */

function distortionCurve(amount: number) {
  const n = 256;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * amount);
  }
  return curve;
}

function noiseBuffer(ctx: AudioContext) {
  const length = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.2;
  }
  return buffer;
}

export class EngineAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;
  private exhaustGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private skidGain: GainNode | null = null;
  private oscs: OscillatorNode[] = [];
  private lastGear = "";

  get on() {
    return this.ctx?.state === "running";
  }

  async start() {
    if (!this.ctx) this.build();
    if (this.ctx && this.ctx.state !== "running") await this.ctx.resume();
  }

  silence() {
    if (!this.ctx || !this.engineGain || !this.exhaustGain || !this.windGain || !this.skidGain) return;
    const now = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(0.0001, now, 0.03);
    this.exhaustGain.gain.setTargetAtTime(0.0001, now, 0.03);
    this.windGain.gain.setTargetAtTime(0.0001, now, 0.05);
    this.skidGain.gain.setTargetAtTime(0.0001, now, 0.03);
  }

  private build() {
    const ctx = new AudioContext();
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = 0.85;
    this.master = master;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 12;
    comp.ratio.value = 3.2;
    comp.attack.value = 0.008;
    comp.release.value = 0.18;
    master.connect(comp);
    comp.connect(ctx.destination);

    const engineGain = ctx.createGain();
    engineGain.gain.value = 0.0001;
    this.engineGain = engineGain;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 220;
    filter.Q.value = 0.55;
    this.filter = filter;

    const shaper = ctx.createWaveShaper();
    shaper.curve = distortionCurve(5);
    shaper.oversample = "2x";

    engineGain.connect(filter);
    filter.connect(shaper);
    shaper.connect(master);

    const kinds: OscillatorType[] = ["sine", "sawtooth", "square", "triangle"];
    const levels = [0.5, 0.26, 0.07, 0.035];
    for (let i = 0; i < 4; i++) {
      const osc = ctx.createOscillator();
      osc.type = kinds[i];
      const gain = ctx.createGain();
      gain.gain.value = levels[i];
      osc.connect(gain);
      gain.connect(engineGain);
      osc.start();
      this.oscs.push(osc);
    }

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer(ctx);
    noise.loop = true;
    noise.start();

    const exhaustFilter = ctx.createBiquadFilter();
    exhaustFilter.type = "bandpass";
    exhaustFilter.frequency.value = 95;
    exhaustFilter.Q.value = 0.65;
    const exhaustGain = ctx.createGain();
    exhaustGain.gain.value = 0.0001;
    this.exhaustGain = exhaustGain;
    noise.connect(exhaustFilter);
    exhaustFilter.connect(exhaustGain);
    exhaustGain.connect(master);

    const windFilter = ctx.createBiquadFilter();
    windFilter.type = "lowpass";
    windFilter.frequency.value = 500;
    const windGain = ctx.createGain();
    windGain.gain.value = 0;
    this.windGain = windGain;
    noise.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(master);

    const skidFilter = ctx.createBiquadFilter();
    skidFilter.type = "bandpass";
    skidFilter.frequency.value = 1100;
    skidFilter.Q.value = 0.7;
    const skidGain = ctx.createGain();
    skidGain.gain.value = 0;
    this.skidGain = skidGain;
    noise.connect(skidFilter);
    skidFilter.connect(skidGain);
    skidGain.connect(master);
  }

  update(opts: {
    rpm: number;
    throttle: number;
    speed: number;
    skid: number;
    gear: string;
    active: boolean;
  }) {
    if (!this.ctx || this.ctx.state !== "running") return;
    if (!this.engineGain || !this.filter || !this.exhaustGain || !this.windGain || !this.skidGain) return;
    const now = this.ctx.currentTime;
    const rpm = Math.max(700, opts.rpm);
    // 4-stroke V8 firing rate.
    const firing = (rpm * 8) / 120;
    const mults = [0.5, 1, 2, 4];
    for (let i = 0; i < this.oscs.length; i++) {
      this.oscs[i].frequency.setTargetAtTime(Math.max(20, firing * mults[i]), now, 0.045);
    }
    const audible = opts.active ? 1 : 0;
    const load = 0.35 + opts.throttle * 0.95;
    this.engineGain.gain.setTargetAtTime(audible * (0.07 + load * 0.11), now, 0.05);
    this.filter.frequency.setTargetAtTime(150 + rpm * 0.15 + opts.throttle * 620, now, 0.05);
    this.exhaustGain.gain.setTargetAtTime(
      audible * (0.04 + (rpm / 8000) * 0.16 + opts.throttle * 0.07),
      now,
      0.05,
    );
    const wind = Math.min(0.14, (opts.speed * opts.speed) / 42000);
    this.windGain.gain.setTargetAtTime(audible * wind, now, 0.12);
    this.skidGain.gain.setTargetAtTime(audible * Math.min(0.2, opts.skid * 0.26), now, 0.06);
    if (opts.active && opts.gear !== this.lastGear && this.lastGear !== "") this.blip();
    this.lastGear = opts.gear;
  }

  private blip() {
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = "square";
    osc.frequency.value = 90;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  horn() {
    if (!this.ctx || this.ctx.state !== "running" || !this.master) return;
    const now = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
    gain.connect(this.master);
    for (const freq of [466, 587]) {
      const osc = this.ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.34);
    }
  }

  impact(speed: number) {
    if (!this.ctx || this.ctx.state !== "running" || !this.master || speed < 3.5) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.18);
    const gain = this.ctx.createGain();
    const vol = Math.min(0.35, speed / 36);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.24);
  }
}
