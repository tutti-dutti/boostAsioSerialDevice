/** Engine sounds from recordings, plus wind, tire squeal, horn, and bumps. */

export type EngineVoice = "v8" | "v10" | "v12" | "turbo" | "ev" | "diesel" | "lambchop";

const ENGINE_LOOP = "/sfx/engine-loop.mp3";
const TRUCK_IDLE = "/sfx/truck-idle.mp3";
const SUPERCAR_REV = "/sfx/supercar-rev.mp3";
const SONG = "/music/paulyudin-rock-490391.mp3";

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

/** Crossfade the seam of a full buffer so looping has no click. */
function seamlessLoop(source: AudioBuffer, fadeSec = 0.35) {
  const sr = source.sampleRate;
  const fade = Math.min(Math.floor(fadeSec * sr), Math.floor(source.length / 4));
  const out = new AudioBuffer({
    length: source.length,
    numberOfChannels: source.numberOfChannels,
    sampleRate: sr,
  });
  for (let c = 0; c < source.numberOfChannels; c++) {
    const src = source.getChannelData(c);
    const dst = out.getChannelData(c);
    dst.set(src);
    for (let i = 0; i < fade; i++) {
      const t = i / fade;
      const fromEnd = src[source.length - fade + i] ?? 0;
      dst[i] = dst[i] * t + fromEnd * (1 - t);
    }
  }
  return out;
}

export class EngineAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private windGain: GainNode | null = null;
  private skidGain: GainNode | null = null;

  private loopBuf: AudioBuffer | null = null;
  private truckBuf: AudioBuffer | null = null;
  private revBuf: AudioBuffer | null = null;
  private loading: Promise<void> | null = null;

  private loopA: AudioBufferSourceNode | null = null;
  private loopB: AudioBufferSourceNode | null = null;
  private loopGainA: GainNode | null = null;
  private loopGainB: GainNode | null = null;
  private loopBus: GainNode | null = null;

  private truckSrc: AudioBufferSourceNode | null = null;
  private truckGain: GainNode | null = null;

  private revGain: GainNode | null = null;
  private revUntil = 0;

  private lastGear = "";
  private lastRpm = 900;
  private lastThrottle = 0;
  private wobblePhase = 0;
  private music: HTMLAudioElement | null = null;
  private voice: EngineVoice = "v12";

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
    rpmRising: false,
  };

  get on() {
    return this.ctx?.state === "running";
  }

  private isTruck() {
    return this.voice === "diesel";
  }

  private isSupercar() {
    return this.voice === "lambchop" || this.voice === "v12";
  }

  setVoice(voice: EngineVoice) {
    this.voice = voice;
    if (this.ctx?.state === "running") {
      void this.ensureSamples().then(() => {
        this.startLoops();
        this.syncTruckLayer();
      });
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
    await this.ensureSamples();
    this.startLoops();
    this.syncTruckLayer();
  }

  /** Resume a suspended context after any user gesture. */
  async unlock() {
    if (!this.ctx) this.build();
    if (this.ctx && this.ctx.state !== "running") await this.ctx.resume();
    await this.ensureSamples();
    this.startLoops();
    this.syncTruckLayer();
  }

  silence() {
    this.music?.pause();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.loopBus?.gain.setTargetAtTime(0.0001, now, 0.03);
    this.truckGain?.gain.setTargetAtTime(0.0001, now, 0.03);
    this.revGain?.gain.setTargetAtTime(0.0001, now, 0.03);
    this.windGain?.gain.setTargetAtTime(0.0001, now, 0.05);
    this.skidGain?.gain.setTargetAtTime(0.0001, now, 0.03);
  }

  private async ensureSamples() {
    if (!this.ctx || this.ctx.state !== "running") return;
    if (this.loopBuf && this.truckBuf && this.revBuf) {
      this.debug.ready = true;
      return;
    }
    if (!this.loading) {
      this.loading = (async () => {
        const decode = async (url: string) => {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`Could not load ${url}`);
          return this.ctx!.decodeAudioData(await res.arrayBuffer());
        };
        const [engine, truck, rev] = await Promise.all([
          decode(ENGINE_LOOP),
          decode(TRUCK_IDLE),
          decode(SUPERCAR_REV),
        ]);
        this.loopBuf = seamlessLoop(engine, 0.4);
        this.truckBuf = seamlessLoop(truck, 0.2);
        this.revBuf = rev;
        this.debug.ready = true;
      })().catch((err) => {
        console.error(err);
        this.loading = null;
      });
    }
    await this.loading;
  }

  private startLoops() {
    if (!this.ctx || !this.loopBuf || !this.loopGainA || !this.loopGainB) return;
    if (this.loopA) return;
    const dur = this.loopBuf.duration;
    const make = (gain: GainNode, offset: number) => {
      const src = this.ctx!.createBufferSource();
      src.buffer = this.loopBuf;
      src.loop = true;
      src.playbackRate.value = 1;
      src.connect(gain);
      src.start(0, offset % dur);
      return src;
    };
    this.loopA = make(this.loopGainA, 0);
    this.loopB = make(this.loopGainB, dur * 0.5);
    this.debug.looping = true;
  }

  private syncTruckLayer() {
    if (!this.ctx || !this.truckBuf || !this.truckGain) return;
    if (this.isTruck()) {
      if (!this.truckSrc) {
        const src = this.ctx.createBufferSource();
        src.buffer = this.truckBuf;
        src.loop = true;
        src.playbackRate.value = 0.7;
        src.connect(this.truckGain);
        src.start();
        this.truckSrc = src;
      }
    } else if (this.truckSrc) {
      try {
        this.truckSrc.stop();
      } catch {
        /* already stopped */
      }
      this.truckSrc.disconnect();
      this.truckSrc = null;
      this.truckGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.04);
    }
  }

  private playLaunchRev() {
    if (!this.ctx || !this.revBuf || !this.revGain || !this.isSupercar()) return;
    const now = this.ctx.currentTime;
    if (now < this.revUntil) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.revBuf;
    src.connect(this.revGain);
    const dur = Math.min(this.revBuf.duration, 3.2);
    this.revGain.gain.cancelScheduledValues(now);
    this.revGain.gain.setValueAtTime(0.0001, now);
    this.revGain.gain.exponentialRampToValueAtTime(0.95, now + 0.05);
    this.revGain.gain.setValueAtTime(0.8, now + dur * 0.55);
    this.revGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    // Duck the loop briefly, then fade it back under the rev.
    if (this.loopBus) {
      this.loopBus.gain.setTargetAtTime(0.12, now, 0.04);
      this.loopBus.gain.setTargetAtTime(0.55, now + dur * 0.5, 0.2);
    }
    src.start(now, 0, dur);
    this.revUntil = now + dur - 0.25;
    this.debug.revVol = 0.9;
  }

  private build() {
    const ctx = new AudioContext();
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = 0.9;
    this.master = master;
    master.connect(ctx.destination);

    const loopBus = ctx.createGain();
    loopBus.gain.value = 0.0001;
    loopBus.connect(master);
    this.loopBus = loopBus;

    const a = ctx.createGain();
    a.gain.value = 0.55;
    a.connect(loopBus);
    this.loopGainA = a;
    const b = ctx.createGain();
    b.gain.value = 0.45;
    b.connect(loopBus);
    this.loopGainB = b;

    const truckGain = ctx.createGain();
    truckGain.gain.value = 0.0001;
    truckGain.connect(master);
    this.truckGain = truckGain;

    const revGain = ctx.createGain();
    revGain.gain.value = 0.0001;
    revGain.connect(master);
    this.revGain = revGain;

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer(ctx);
    noise.loop = true;
    noise.start();

    const windFilter = ctx.createBiquadFilter();
    windFilter.type = "bandpass";
    windFilter.frequency.value = 700;
    windFilter.Q.value = 0.5;
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
    if (!this.loopBus || !this.windGain || !this.skidGain) return;
    if (!this.loopBuf) void this.ensureSamples();
    else if (!this.loopA) this.startLoops();

    const now = this.ctx.currentTime;
    const audible = opts.active ? 1 : 0;
    const rpm = Math.max(700, opts.rpm);
    const gas = opts.throttle;
    const rpmN = Math.max(0, Math.min(1, (rpm - 850) / 6750));
    const atIdle = gas < 0.1 && rpm < 1400;
    const rpmRising = gas > 0.15 && rpm > this.lastRpm + 12;
    this.debug.rpmRising = rpmRising;
    this.wobblePhase += 0.05;

    // Idle: normal pitch, low volume. Climb to ~1.8x at redline with RPM.
    // Trucks stay deeper so they never whistle.
    let rate = this.isTruck() ? 0.72 : 1.0;
    if (!atIdle) {
      const climb = this.isTruck() ? 0.55 : 0.8;
      rate = (this.isTruck() ? 0.72 : 1.0) + rpmN * climb;
    }
    // Drop pitch briefly on upshift.
    if (opts.gear !== this.lastGear && this.lastGear !== "" && rpm < this.lastRpm - 180) {
      rate *= 0.88;
    }
    rate = Math.max(0.65, Math.min(this.isTruck() ? 1.35 : 1.8, rate));

    // Tiny wobble + dual-layer crossfade hides the loop seam.
    const wobble = 1 + Math.sin(this.wobblePhase) * 0.004 + (Math.random() - 0.5) * 0.002;
    if (this.loopA) this.loopA.playbackRate.value = rate * wobble;
    if (this.loopB) this.loopB.playbackRate.value = rate * (2 - wobble);
    const xfade = 0.5 + 0.18 * Math.sin(this.wobblePhase * 0.3);
    this.loopGainA?.gain.setTargetAtTime(xfade, now, 0.08);
    this.loopGainB?.gain.setTargetAtTime(1.05 - xfade, now, 0.08);

    const inRev = now < this.revUntil;
    const idleVol = 0.18;
    const driveVol = 0.28 + gas * 0.55 + rpmN * 0.35;
    let loopVol = audible * (atIdle ? idleVol : driveVol);
    if (inRev) loopVol = Math.min(loopVol, 0.22 + gas * 0.15);
    this.loopBus.gain.setTargetAtTime(Math.max(0.0001, loopVol), now, atIdle ? 0.1 : 0.05);

    // Truck idle under the main loop — deep bass rumble at ~0.7x.
    if (this.isTruck() && this.truckGain) {
      if (this.truckSrc) this.truckSrc.playbackRate.value = 0.7;
      const truckVol = audible * (atIdle ? 0.55 : 0.35 + gas * 0.15);
      this.truckGain.gain.setTargetAtTime(Math.max(0.0001, truckVol), now, 0.08);
    }

    // Supercar launch rev: once when flooring from a near-stop.
    if (
      audible &&
      this.isSupercar() &&
      rpmRising &&
      gas > 0.9 &&
      opts.speed < 2.8 &&
      this.lastThrottle <= 0.9
    ) {
      this.playLaunchRev();
    }

    this.windGain.gain.setTargetAtTime(audible * Math.min(0.12, Math.abs(opts.speed) / 90), now, 0.1);
    this.skidGain.gain.setTargetAtTime(audible * Math.min(0.35, opts.skid * 0.45), now, 0.04);

    this.debug.rate = rate;
    this.debug.loopVol = loopVol;
    this.debug.revVol = inRev ? 0.85 : 0;
    this.debug.looping = !!this.loopA && loopVol > 0.05;
    this.debug.idle = atIdle ? loopVol : 0;
    this.debug.mid = atIdle ? 0 : loopVol;
    this.debug.high = 0;
    this.debug.filterHz = 0;

    this.lastRpm = rpm;
    this.lastThrottle = gas;
    this.lastGear = opts.gear;
  }

  horn() {
    if (!this.ctx || !this.master || this.ctx.state !== "running") return;
    const now = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.35, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    gain.connect(this.master);
    for (const hz of [392, 494]) {
      const osc = this.ctx.createOscillator();
      osc.type = "square";
      osc.frequency.value = hz;
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.36);
    }
  }

  impact(force: number) {
    if (!this.ctx || !this.master || this.ctx.state !== "running") return;
    const now = this.ctx.currentTime;
    const amp = Math.min(0.55, 0.08 + force * 0.35);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(amp, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    gain.connect(this.master);
    const osc = this.ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.16);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 0.2);
  }
}
