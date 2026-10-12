/** Engine, wind, tire squeal, horn, and bump sounds made with the Web Audio API. */

export type EngineVoice = "v8" | "v10" | "v12" | "turbo" | "ev" | "diesel";

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

const SONG = "/music/paulyudin-rock-490391.mp3";

const VOICE: Record<
  EngineVoice,
  { cyl: number; base: number; bright: number; growl: number; kinds: OscillatorType[]; levels: number[] }
> = {
  v8: {
    cyl: 8,
    base: 90,
    bright: 0.12,
    growl: 0.22,
    kinds: ["sawtooth", "triangle", "square", "sine"],
    levels: [0.55, 0.28, 0.1, 0.04],
  },
  v10: {
    cyl: 10,
    base: 130,
    bright: 0.22,
    growl: 0.14,
    kinds: ["sawtooth", "triangle", "sine", "square"],
    levels: [0.42, 0.3, 0.12, 0.06],
  },
  v12: {
    cyl: 12,
    base: 160,
    bright: 0.32,
    growl: 0.1,
    kinds: ["sawtooth", "sine", "triangle", "square"],
    levels: [0.38, 0.28, 0.16, 0.05],
  },
  turbo: {
    cyl: 8,
    base: 120,
    bright: 0.28,
    growl: 0.12,
    kinds: ["sawtooth", "triangle", "sine", "square"],
    levels: [0.4, 0.26, 0.14, 0.05],
  },
  ev: {
    cyl: 2,
    base: 220,
    bright: 0.45,
    growl: 0.02,
    kinds: ["sine", "triangle", "sine", "triangle"],
    levels: [0.35, 0.22, 0.12, 0.08],
  },
  diesel: {
    cyl: 6,
    base: 70,
    bright: 0.06,
    growl: 0.3,
    kinds: ["square", "sawtooth", "triangle", "sine"],
    levels: [0.5, 0.3, 0.12, 0.04],
  },
};

export class EngineAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;
  private exhaustGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private skidGain: GainNode | null = null;
  private whooshGain: GainNode | null = null;
  private oscs: OscillatorNode[] = [];
  private oscGains: GainNode[] = [];
  private lastGear = "";
  private music: HTMLAudioElement | null = null;
  private voice: EngineVoice = "v12";
  private lastThrottle = 0;

  get on() {
    return this.ctx?.state === "running";
  }

  setVoice(voice: EngineVoice) {
    this.voice = voice;
    this.applyVoiceMix();
  }

  /** Start the background song immediately. Call this from the Drive click. */
  playMusic() {
    if (!this.music) {
      const music = new Audio(SONG);
      music.loop = true;
      music.preload = "auto";
      music.volume = 0.42;
      music.setAttribute("data-bgm", "paulyudin-rock");
      document.body.appendChild(music);
      this.music = music;
    }
    const pending = this.music.play();
    if (pending) pending.catch(() => undefined);
  }

  async start() {
    this.playMusic();
    if (!this.ctx) this.build();
    if (this.ctx && this.ctx.state !== "running") await this.ctx.resume();
  }

  silence() {
    this.music?.pause();
    if (!this.ctx || !this.engineGain || !this.exhaustGain || !this.windGain || !this.skidGain) return;
    const now = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(0.0001, now, 0.03);
    this.exhaustGain.gain.setTargetAtTime(0.0001, now, 0.03);
    this.windGain.gain.setTargetAtTime(0.0001, now, 0.05);
    this.skidGain.gain.setTargetAtTime(0.0001, now, 0.03);
    this.whooshGain?.gain.setTargetAtTime(0.0001, now, 0.03);
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

    for (let i = 0; i < 4; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0.1;
      osc.connect(gain);
      gain.connect(engineGain);
      osc.start();
      this.oscs.push(osc);
      this.oscGains.push(gain);
    }
    this.applyVoiceMix();

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

    const whooshFilter = ctx.createBiquadFilter();
    whooshFilter.type = "bandpass";
    whooshFilter.frequency.value = 1800;
    whooshFilter.Q.value = 0.5;
    const whooshGain = ctx.createGain();
    whooshGain.gain.value = 0.0001;
    this.whooshGain = whooshGain;
    noise.connect(whooshFilter);
    whooshFilter.connect(whooshGain);
    whooshGain.connect(master);

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

  private applyVoiceMix() {
    const profile = VOICE[this.voice];
    for (let i = 0; i < this.oscs.length; i++) {
      this.oscs[i].type = profile.kinds[i];
      if (this.oscGains[i]) this.oscGains[i].gain.value = profile.levels[i];
    }
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
    const profile = VOICE[this.voice];
    const rpm = Math.max(700, opts.rpm);
    const firing = (rpm * profile.cyl) / 120;
    const mults = this.voice === "ev" ? [1, 1.5, 2.2, 3.3] : [0.5, 1, 2, 4];
    for (let i = 0; i < this.oscs.length; i++) {
      const freq = Math.max(20, profile.base * 0.35 + firing * mults[i]);
      this.oscs[i].frequency.setTargetAtTime(freq, now, 0.04);
    }
    const audible = opts.active ? 1 : 0;
    const load = 0.3 + opts.throttle * 0.95;
    const idleQuiet = this.voice === "ev" ? 0.03 : 0.07;
    this.engineGain.gain.setTargetAtTime(audible * (idleQuiet + load * 0.12), now, 0.05);
    this.filter.frequency.setTargetAtTime(
      profile.base + rpm * profile.bright + opts.throttle * 700,
      now,
      0.05,
    );
    this.exhaustGain.gain.setTargetAtTime(
      audible * (profile.growl * 0.35 + (rpm / 8000) * profile.growl + opts.throttle * 0.06),
      now,
      0.05,
    );

    if (this.whooshGain) {
      if (this.voice === "turbo") {
        const rising = opts.throttle > this.lastThrottle + 0.02 ? opts.throttle : opts.throttle * 0.35;
        this.whooshGain.gain.setTargetAtTime(audible * rising * 0.09, now, 0.04);
        if (this.lastThrottle > 0.55 && opts.throttle < 0.2) this.blowOff();
      } else if (this.voice === "ev") {
        this.whooshGain.gain.setTargetAtTime(audible * Math.min(0.08, opts.speed / 120), now, 0.08);
      } else {
        this.whooshGain.gain.setTargetAtTime(0.0001, now, 0.05);
      }
    }
    this.lastThrottle = opts.throttle;

    const wind = Math.min(0.14, (opts.speed * opts.speed) / 42000);
    this.windGain.gain.setTargetAtTime(audible * wind, now, 0.12);
    this.skidGain.gain.setTargetAtTime(audible * Math.min(0.2, opts.skid * 0.26), now, 0.06);
    if (opts.active && opts.gear !== this.lastGear && this.lastGear !== "") this.blip();
    this.lastGear = opts.gear;
  }

  private blowOff() {
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer(this.ctx);
    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 1400;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    noise.start(now);
    noise.stop(now + 0.2);
  }

  private blip() {
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = "square";
    osc.frequency.value = this.voice === "ev" ? 240 : 90;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.035, now);
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
