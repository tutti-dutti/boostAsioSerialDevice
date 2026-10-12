/** Engine, wind, tire squeal, horn, and bump sounds made with the Web Audio API. */

export type EngineVoice = "v8" | "v10" | "v12" | "turbo" | "ev" | "diesel" | "lambchop";

const LAMBCHOP_ENGINE = "/sounds/lambchop-engine.mp3";
/** Loud sustained section used for the driving loop. */
const LAMB_LOOP_START = 3.55;
const LAMB_LOOP_END = 4.65;
const LAMB_REV_START = 0.12;
const LAMB_REV_DUR = 2.4;

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

/** Slice a loud section and crossfade the seam so the loop has no click. */
function makeCrossfadeLoop(source: AudioBuffer, startSec: number, endSec: number, fadeSec: number) {
  const sr = source.sampleRate;
  const start = Math.max(0, Math.floor(startSec * sr));
  const end = Math.min(source.length, Math.floor(endSec * sr));
  const fade = Math.min(Math.floor(fadeSec * sr), Math.floor((end - start) / 3));
  const len = end - start;
  const out = new AudioBuffer({ length: len, numberOfChannels: source.numberOfChannels, sampleRate: sr });
  for (let c = 0; c < source.numberOfChannels; c++) {
    const src = source.getChannelData(c);
    const dst = out.getChannelData(c);
    for (let i = 0; i < len; i++) dst[i] = src[start + i] ?? 0;
    for (let i = 0; i < fade; i++) {
      const t = i / fade;
      const fromEnd = src[end - fade + i] ?? 0;
      dst[i] = dst[i] * t + fromEnd * (1 - t);
    }
  }
  return out;
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
  lambchop: {
    cyl: 12,
    base: 160,
    bright: 0.32,
    growl: 0.08,
    kinds: ["sawtooth", "sine", "triangle", "square"],
    levels: [0.0, 0.0, 0.0, 0.0],
  },
};

type SynthLayer = {
  oscs: OscillatorNode[];
  gains: GainNode[];
  bus: GainNode;
  noiseGain: GainNode;
  noiseFilter: BiquadFilterNode;
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
  private bassGain: GainNode | null = null;
  private bassOscs: OscillatorNode[] = [];
  private idleLayer: SynthLayer | null = null;
  private midLayer: SynthLayer | null = null;
  private highLayer: SynthLayer | null = null;
  private lastGear = "";
  private music: HTMLAudioElement | null = null;
  private voice: EngineVoice = "v12";
  private lastThrottle = 0;
  private lambSource: AudioBuffer | null = null;
  private lambLoopBuf: AudioBuffer | null = null;
  private lambLoop: AudioBufferSourceNode | null = null;
  private lambLoopGain: GainNode | null = null;
  private lambRevGain: GainNode | null = null;
  private lambLoading: Promise<void> | null = null;
  private revUntil = 0;
  private lastRpm = 900;
  /** Latest mix values, for tests. */
  debug = {
    rate: 0,
    loopVol: 0,
    revVol: 0,
    looping: false,
    ready: false,
    idle: 0,
    mid: 0,
    high: 0,
    filterHz: 0,
  };

  get on() {
    return this.ctx?.state === "running";
  }

  setVoice(voice: EngineVoice) {
    const prev = this.voice;
    this.voice = voice;
    this.applyVoiceMix();
    if (voice === "lambchop") {
      if (this.ctx?.state === "running") void this.ensureLambchop();
    } else if (prev === "lambchop") {
      this.stopLambLoop();
    }
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

  /** Call from a click or key press so the browser allows sound. */
  async start() {
    this.playMusic();
    if (!this.ctx) this.build();
    if (this.ctx && this.ctx.state !== "running") await this.ctx.resume();
    if (this.voice === "lambchop") await this.ensureLambchop();
  }

  /** Resume a suspended context after any user gesture. */
  async unlock() {
    if (!this.ctx) this.build();
    if (this.ctx && this.ctx.state !== "running") await this.ctx.resume();
    if (this.voice === "lambchop") await this.ensureLambchop();
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
    this.bassGain?.gain.setTargetAtTime(0.0001, now, 0.03);
    this.idleLayer?.bus.gain.setTargetAtTime(0.0001, now, 0.03);
    this.midLayer?.bus.gain.setTargetAtTime(0.0001, now, 0.03);
    this.highLayer?.bus.gain.setTargetAtTime(0.0001, now, 0.03);
    this.lambLoopGain?.gain.setTargetAtTime(0.0001, now, 0.03);
    this.lambRevGain?.gain.setTargetAtTime(0.0001, now, 0.03);
  }

  private async ensureLambchop() {
    if (!this.ctx || !this.master || this.ctx.state !== "running") return;
    if (!this.lambLoopGain) {
      // Hot bus: skip the compressor so the sample stays loud and clear.
      const loopGain = this.ctx.createGain();
      loopGain.gain.value = 0.0001;
      loopGain.connect(this.ctx.destination);
      this.lambLoopGain = loopGain;
      const revGain = this.ctx.createGain();
      revGain.gain.value = 0.0001;
      revGain.connect(this.ctx.destination);
      this.lambRevGain = revGain;
    }
    if (!this.lambLoopBuf) {
      if (!this.lambLoading) {
        this.lambLoading = fetch(LAMBCHOP_ENGINE)
          .then((res) => {
            if (!res.ok) throw new Error(`Could not load ${LAMBCHOP_ENGINE}`);
            return res.arrayBuffer();
          })
          .then((raw) => this.ctx!.decodeAudioData(raw))
          .then((buffer) => {
            this.lambSource = buffer;
            this.lambLoopBuf = makeCrossfadeLoop(buffer, LAMB_LOOP_START, LAMB_LOOP_END, 0.07);
            this.debug.ready = true;
          })
          .catch((err) => {
            console.error(err);
            this.lambLoading = null;
          });
      }
      await this.lambLoading;
    }
    if (this.voice === "lambchop") this.startLambLoop();
  }

  private startLambLoop() {
    if (!this.ctx || !this.lambLoopBuf || !this.lambLoopGain || this.lambLoop) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.lambLoopBuf;
    src.loop = true;
    src.playbackRate.value = 0.85;
    src.connect(this.lambLoopGain);
    src.start();
    this.lambLoop = src;
    this.debug.looping = true;
  }

  private stopLambLoop() {
    if (this.lambLoop) {
      try {
        this.lambLoop.stop();
      } catch {
        /* already stopped */
      }
      this.lambLoop.disconnect();
      this.lambLoop = null;
    }
    this.debug.looping = false;
    if (this.ctx && this.lambLoopGain) {
      this.lambLoopGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.03);
    }
  }

  private playLaunchRev() {
    if (!this.ctx || !this.lambSource || !this.lambRevGain || !this.lambLoopGain) return;
    const now = this.ctx.currentTime;
    if (now < this.revUntil) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.lambSource;
    src.connect(this.lambRevGain);
    this.lambRevGain.gain.cancelScheduledValues(now);
    this.lambRevGain.gain.setValueAtTime(0.0001, now);
    this.lambRevGain.gain.exponentialRampToValueAtTime(0.85, now + 0.04);
    this.lambRevGain.gain.setValueAtTime(0.7, now + LAMB_REV_DUR - 0.45);
    this.lambRevGain.gain.exponentialRampToValueAtTime(0.0001, now + LAMB_REV_DUR);
    // Keep the driving loop under the rev, then hand off smoothly.
    this.lambLoopGain.gain.value = Math.max(this.lambLoopGain.gain.value, 0.32);
    src.start(now, LAMB_REV_START, LAMB_REV_DUR);
    this.revUntil = now + LAMB_REV_DUR - 0.35;
    this.debug.revVol = 0.62;
  }

  private makeLayer(
    ctx: AudioContext,
    dest: AudioNode,
    noise: AudioBufferSourceNode,
    detunes: number[],
    noiseHz: number,
  ): SynthLayer {
    const bus = ctx.createGain();
    bus.gain.value = 0.0001;
    bus.connect(dest);
    const oscs: OscillatorNode[] = [];
    const gains: GainNode[] = [];
    for (const cents of detunes) {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.detune.value = cents;
      const gain = ctx.createGain();
      gain.gain.value = 0.12;
      osc.connect(gain);
      gain.connect(bus);
      osc.start();
      oscs.push(osc);
      gains.push(gain);
    }
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value = noiseHz;
    noiseFilter.Q.value = 0.7;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.04;
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(bus);
    return { oscs, gains, bus, noiseGain, noiseFilter };
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
    filter.frequency.value = 900;
    filter.Q.value = 0.45;
    this.filter = filter;

    const shaper = ctx.createWaveShaper();
    shaper.curve = distortionCurve(3.2);
    shaper.oversample = "2x";

    engineGain.connect(filter);
    filter.connect(shaper);
    shaper.connect(master);

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer(ctx);
    noise.loop = true;
    noise.start();

    // Three RPM layers: idle rumble, mid loop, high scream — detuned saws + filtered noise.
    this.idleLayer = this.makeLayer(ctx, engineGain, noise, [-18, -7, 0, 9, 17], 180);
    this.midLayer = this.makeLayer(ctx, engineGain, noise, [-14, -5, 0, 6, 14], 520);
    this.highLayer = this.makeLayer(ctx, engineGain, noise, [-11, -4, 0, 5, 12], 1400);

    // Deep bass under everything.
    const bassGain = ctx.createGain();
    bassGain.gain.value = 0.0001;
    this.bassGain = bassGain;
    bassGain.connect(master);
    for (const cents of [-12, 0, 10]) {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.detune.value = cents;
      const g = ctx.createGain();
      g.gain.value = 0.18;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 140;
      lp.Q.value = 0.5;
      osc.connect(g);
      g.connect(lp);
      lp.connect(bassGain);
      osc.start();
      this.bassOscs.push(osc);
    }

    this.applyVoiceMix();

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
    const layers = [this.idleLayer, this.midLayer, this.highLayer];
    for (const layer of layers) {
      if (!layer) continue;
      for (let i = 0; i < layer.oscs.length; i++) {
        layer.oscs[i].type = "sawtooth";
        // Keep levels even; layer bus gains do the RPM crossfade.
        layer.gains[i].gain.value = 0.1 + profile.growl * 0.05;
      }
      layer.noiseGain.gain.value = 0.025 + profile.bright * 0.04;
    }
  }

  /** Pitch factor from RPM, hard-clamped to 0.8x–1.6x. */
  private pitchFromRpm(rpm: number) {
    const rpmN = Math.max(0, Math.min(1, (rpm - 850) / 6750));
    return 0.8 + rpmN * 0.8;
  }

  private setLayerPitch(layer: SynthLayer | null, baseHz: number, pitch: number, now: number) {
    if (!layer) return;
    const detuneMults = [0.92, 0.97, 1, 1.04, 1.09];
    for (let i = 0; i < layer.oscs.length; i++) {
      const freq = Math.max(28, baseHz * pitch * (detuneMults[i] ?? 1));
      layer.oscs[i].frequency.setTargetAtTime(freq, now, 0.035);
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
    const audible = opts.active ? 1 : 0;
    const rpm = Math.max(700, opts.rpm);

    if (this.voice === "lambchop") {
      if (this.ctx.state !== "running") void this.ctx.resume();
      if (!this.lambLoopBuf) void this.ensureLambchop();
      else if (!this.lambLoop) this.startLambLoop();

      // Pitch follows RPM every frame. Upshifts drop RPM, so pitch drops with it.
      const rpmN = Math.max(0, Math.min(1, (rpm - 850) / 6750));
      let rate = 0.75 + rpmN * 0.9;
      if (opts.gear !== this.lastGear && this.lastGear !== "" && rpm < this.lastRpm - 180) {
        rate *= 0.88;
      }
      rate = Math.max(0.68, Math.min(1.7, rate));
      if (this.lambLoop) this.lambLoop.playbackRate.value = rate;

      const inRev = now < this.revUntil;
      // Loop is always audible while active. Gas makes it louder right away.
      const loopVol = audible
        ? inRev
          ? 0.35 + opts.throttle * 0.2
          : 0.28 + opts.throttle * 0.72 + rpmN * 0.18 + Math.min(0.12, opts.speed / 100)
        : 0.0001;
      if (this.lambLoopGain) this.lambLoopGain.gain.value = Math.max(0.0001, loopVol);
      this.debug.rate = rate;
      this.debug.loopVol = loopVol;
      this.debug.revVol = inRev ? 0.7 : 0;
      this.debug.looping = !!this.lambLoop && loopVol > 0.05;

      this.engineGain.gain.setTargetAtTime(0.0001, now, 0.05);
      this.exhaustGain.gain.setTargetAtTime(0.0001, now, 0.05);
      this.whooshGain?.gain.setTargetAtTime(0.0001, now, 0.05);

      // Launch rev only when flooring from a near-stop, then blend into the loop.
      if (audible && opts.throttle > 0.9 && opts.speed < 2.8 && this.lastThrottle <= 0.9) {
        this.playLaunchRev();
      }
      this.lastRpm = rpm;
    } else {
      const profile = VOICE[this.voice];
      const rpmN = Math.max(0, Math.min(1, (rpm - 850) / 6750));
      let pitch = this.pitchFromRpm(rpm);
      if (opts.gear !== this.lastGear && this.lastGear !== "" && rpm < this.lastRpm - 180) {
        pitch *= 0.94;
      }
      pitch = Math.max(0.8, Math.min(1.6, pitch));

      // Fundamental from firing order, then pitch-scaled within 0.8–1.6.
      const firing = (rpm * profile.cyl) / 120;
      const idleBase = profile.base * 0.45 + firing * 0.22;
      const midBase = profile.base * 0.7 + firing * 0.55;
      const highBase = profile.base * 0.55 + firing * 1.05;
      this.setLayerPitch(this.idleLayer, idleBase, pitch, now);
      this.setLayerPitch(this.midLayer, midBase, pitch, now);
      this.setLayerPitch(this.highLayer, highBase, pitch, now);

      for (const osc of this.bassOscs) {
        osc.frequency.setTargetAtTime(Math.max(32, (profile.base * 0.28 + firing * 0.12) * pitch), now, 0.04);
      }

      // Smooth RPM crossfade: idle → mid → high scream.
      const idleMix = Math.max(0, 1 - rpmN * 1.6);
      const midMix = Math.max(0, 1 - Math.abs(rpmN - 0.45) * 2.4);
      const highMix = Math.max(0, (rpmN - 0.35) / 0.65);
      const gas = opts.throttle;
      // Loop is always running; gas brings volume up immediately (no gaps).
      const driven = audible * (0.22 + gas * 0.78 + rpmN * 0.15);
      const idleVol = Math.max(0.0001, driven * (0.55 * idleMix + 0.12));
      const midVol = Math.max(0.0001, driven * (0.7 * midMix + gas * 0.15));
      const highVol = Math.max(0.0001, driven * (0.85 * highMix + gas * 0.2 * rpmN));
      this.idleLayer?.bus.gain.setTargetAtTime(idleVol, now, 0.04);
      this.midLayer?.bus.gain.setTargetAtTime(midVol, now, 0.04);
      this.highLayer?.bus.gain.setTargetAtTime(highVol, now, 0.04);

      const masterEng = this.voice === "ev" ? 0.45 : this.voice === "v12" ? 0.72 : 0.62;
      this.engineGain.gain.setTargetAtTime(Math.max(0.0001, audible * masterEng), now, 0.04);
      this.bassGain?.gain.setTargetAtTime(
        Math.max(0.0001, audible * (0.14 + gas * 0.18 + rpmN * 0.08)),
        now,
        0.05,
      );

      // Low-pass keeps high RPM smooth; gas opens it a bit so it breathes.
      const filterHz =
        (this.voice === "v12" ? 700 : 600) +
        rpmN * (this.voice === "v12" ? 1400 : 1600) +
        gas * 900 -
        (this.voice === "v12" ? rpmN * rpmN * 200 : 0);
      this.filter.frequency.setTargetAtTime(filterHz, now, 0.05);
      this.debug.rate = pitch;
      this.debug.loopVol = driven;
      this.debug.looping = driven > 0.05;
      this.debug.idle = idleVol;
      this.debug.mid = midVol;
      this.debug.high = highVol;
      this.debug.filterHz = filterHz;
      this.lastRpm = rpm;

      this.exhaustGain.gain.setTargetAtTime(
        audible * (profile.growl * 0.35 + rpmN * profile.growl + gas * 0.06),
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
    }
    this.lastThrottle = opts.throttle;

    const wind = Math.min(0.14, (opts.speed * opts.speed) / 42000);
    this.windGain.gain.setTargetAtTime(audible * wind, now, 0.12);
    this.skidGain.gain.setTargetAtTime(audible * Math.min(0.2, opts.skid * 0.26), now, 0.06);
    if (opts.active && opts.gear !== this.lastGear && this.lastGear !== "" && this.voice !== "lambchop") this.blip();
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
