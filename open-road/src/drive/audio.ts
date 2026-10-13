/** Engine sounds from recordings, plus wind, tire squeal, horn, and bumps. */

export type EngineVoice = "v8" | "v10" | "v12" | "turbo" | "ev" | "diesel" | "lambchop";

const ENGINE_LOOP = "/sfx/engine-loop.mp3";
const TRUCK_IDLE = "/sfx/truck-idle.mp3";
const SUPERCAR_REV = "/sfx/supercar-rev.mp3";

/** Background playlist: rock → tropical house → tropical chill → rock… */
const PLAYLIST = [
  { src: "/music/paulyudin-rock-490391.mp3", id: "paulyudin-rock" },
  { src: "/music/aurec-tropical-house-580209.mp3", id: "aurec-tropical-house" },
  { src: "/music/prettyjohn1-tropical-chill-581650.mp3", id: "prettyjohn1-tropical-chill" },
] as const;
const MUSIC_VOL = 0.42;
const CROSSFADE_SEC = 2.8;

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

  /** Quiet electric motor whine (EV voice). */
  private evOsc: OscillatorNode | null = null;
  private evOsc2: OscillatorNode | null = null;
  private evGain: GainNode | null = null;
  private evFilter: BiquadFilterNode | null = null;

  private lastGear = "";
  private lastRpm = 900;
  private lastThrottle = 0;
  private wobblePhase = 0;
  private tracks: HTMLAudioElement[] = [];
  private trackIndex = 0;
  private fading = false;
  private fadeRaf = 0;
  private voice: EngineVoice = "v12";
  private onTrackTime = () => this.maybeCrossfade();
  private onTrackEnded = () => {
    if (!this.fading) this.startCrossfade();
  };

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

  private isEv() {
    return this.voice === "ev";
  }

  private isSupercar() {
    return this.voice === "lambchop" || this.voice === "v12";
  }

  setVoice(voice: EngineVoice) {
    this.voice = voice;
    if (this.ctx?.state === "running") {
      void this.ensureSamples().then(() => {
        if (this.isEv()) {
          this.stopLoops();
          this.startEvWhine();
        } else {
          this.stopEvWhine();
          this.startLoops();
        }
        this.syncTruckLayer();
      });
    }
  }

  /** Start the background playlist immediately. Call this from the Drive click. */
  playMusic() {
    if (this.tracks.length === 0) this.buildPlaylist();
    const cur = this.tracks[this.trackIndex];
    if (!cur) return;
    if (cur.paused) {
      cur.volume = MUSIC_VOL;
      const pending = cur.play();
      if (pending) pending.catch(() => undefined);
    }
  }

  private buildPlaylist() {
    for (const item of PLAYLIST) {
      const audio = new Audio(item.src);
      audio.loop = false;
      audio.preload = "auto";
      audio.volume = 0;
      audio.setAttribute("data-bgm", item.id);
      audio.addEventListener("timeupdate", this.onTrackTime);
      audio.addEventListener("ended", this.onTrackEnded);
      document.body.appendChild(audio);
      this.tracks.push(audio);
    }
  }

  private maybeCrossfade() {
    if (this.fading) return;
    const cur = this.tracks[this.trackIndex];
    if (!cur || !Number.isFinite(cur.duration) || cur.duration <= 0) return;
    if (cur.paused) return;
    if (cur.duration - cur.currentTime <= CROSSFADE_SEC) this.startCrossfade();
  }

  private startCrossfade() {
    if (this.fading || this.tracks.length < 2) return;
    const from = this.tracks[this.trackIndex];
    if (!from) return;
    this.fading = true;
    const next = (this.trackIndex + 1) % this.tracks.length;
    const to = this.tracks[next]!;
    to.currentTime = 0;
    to.volume = 0;
    const pending = to.play();
    if (pending) pending.catch(() => undefined);

    if (this.fadeRaf) cancelAnimationFrame(this.fadeRaf);
    const start = performance.now();
    const fromVol = from.volume;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / (CROSSFADE_SEC * 1000));
      // Smoothstep for a softer blend.
      const ease = t * t * (3 - 2 * t);
      from.volume = Math.max(0, fromVol * (1 - ease));
      to.volume = MUSIC_VOL * ease;
      if (t < 1) {
        this.fadeRaf = requestAnimationFrame(tick);
        return;
      }
      from.pause();
      from.currentTime = 0;
      from.volume = 0;
      to.volume = MUSIC_VOL;
      this.trackIndex = next;
      this.fading = false;
      this.fadeRaf = 0;
    };
    this.fadeRaf = requestAnimationFrame(tick);
  }

  /** Call from a click or key press so the browser allows sound. */
  async start() {
    this.playMusic();
    if (!this.ctx) this.build();
    if (this.ctx && this.ctx.state !== "running") await this.ctx.resume();
    await this.ensureSamples();
    if (this.isEv()) {
      this.startEvWhine();
    } else {
      this.startLoops();
    }
    this.syncTruckLayer();
  }

  /** Resume a suspended context after any user gesture. */
  async unlock() {
    if (!this.ctx) this.build();
    if (this.ctx && this.ctx.state !== "running") await this.ctx.resume();
    await this.ensureSamples();
    if (this.isEv()) {
      this.startEvWhine();
    } else {
      this.startLoops();
    }
    this.syncTruckLayer();
  }

  silence() {
    if (this.fadeRaf) {
      cancelAnimationFrame(this.fadeRaf);
      this.fadeRaf = 0;
    }
    this.fading = false;
    for (const track of this.tracks) {
      track.pause();
      track.volume = 0;
    }
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.loopBus?.gain.setTargetAtTime(0.0001, now, 0.03);
    this.truckGain?.gain.setTargetAtTime(0.0001, now, 0.03);
    this.revGain?.gain.setTargetAtTime(0.0001, now, 0.03);
    this.evGain?.gain.setTargetAtTime(0.0001, now, 0.03);
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
    if (this.isEv()) return;
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

  private stopLoops() {
    for (const src of [this.loopA, this.loopB]) {
      if (!src) continue;
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
      src.disconnect();
    }
    this.loopA = null;
    this.loopB = null;
    this.debug.looping = false;
    if (this.ctx && this.loopBus) {
      this.loopBus.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.04);
    }
  }

  private startEvWhine() {
    if (!this.ctx || !this.master || this.evOsc) return;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 900;
    filter.Q.value = 2.2;
    this.evFilter = filter;

    const gain = this.ctx.createGain();
    gain.gain.value = 0.0001;
    this.evGain = gain;
    filter.connect(gain);
    gain.connect(this.master);

    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 220;
    osc.connect(filter);
    osc.start();
    this.evOsc = osc;

    // Soft second partial for a fuller motor tone without sounding like an ICE.
    const osc2 = this.ctx.createOscillator();
    osc2.type = "triangle";
    osc2.frequency.value = 440;
    const partial = this.ctx.createGain();
    partial.gain.value = 0.28;
    osc2.connect(partial);
    partial.connect(filter);
    osc2.start();
    this.evOsc2 = osc2;
  }

  private stopEvWhine() {
    for (const src of [this.evOsc, this.evOsc2]) {
      if (!src) continue;
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
      src.disconnect();
    }
    this.evOsc = null;
    this.evOsc2 = null;
    this.evFilter?.disconnect();
    this.evFilter = null;
    if (this.ctx && this.evGain) {
      this.evGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.04);
      this.evGain.disconnect();
    }
    this.evGain = null;
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

    const now = this.ctx.currentTime;
    const audible = opts.active ? 1 : 0;
    const rpm = Math.max(700, opts.rpm);
    const gas = opts.throttle;
    const speedAbs = Math.abs(opts.speed);
    const rpmN = Math.max(0, Math.min(1, (rpm - 850) / 6750));
    const atIdle = gas < 0.1 && rpm < 1400;
    const rpmRising = gas > 0.15 && rpm > this.lastRpm + 12;
    this.debug.rpmRising = rpmRising;
    this.wobblePhase += 0.05;

    // Quiet electric whine: pitch follows road speed, no gear shifts / ICE loop.
    if (this.isEv()) {
      if (!this.evOsc) this.startEvWhine();
      this.loopBus.gain.setTargetAtTime(0.0001, now, 0.05);
      const speedN = Math.min(1, speedAbs / 55);
      const hz = 180 + speedN * 920 + gas * 80;
      const hz2 = hz * 2.05;
      if (this.evOsc) this.evOsc.frequency.setTargetAtTime(hz, now, 0.06);
      if (this.evOsc2) this.evOsc2.frequency.setTargetAtTime(hz2, now, 0.06);
      if (this.evFilter) this.evFilter.frequency.setTargetAtTime(700 + speedN * 1400, now, 0.08);
      const whine =
        audible *
        (0.04 + speedN * 0.1 + gas * 0.05) *
        (speedAbs < 0.4 && gas < 0.05 ? 0.35 : 1);
      this.evGain?.gain.setTargetAtTime(Math.max(0.0001, whine), now, 0.08);
      this.windGain.gain.setTargetAtTime(audible * Math.min(0.1, speedAbs / 100), now, 0.1);
      this.skidGain.gain.setTargetAtTime(audible * Math.min(0.28, opts.skid * 0.4), now, 0.04);
      this.debug.rate = hz / 400;
      this.debug.loopVol = whine;
      this.debug.revVol = 0;
      this.debug.looping = whine > 0.02;
      this.debug.idle = speedAbs < 0.5 ? whine : 0;
      this.debug.mid = speedAbs >= 0.5 ? whine : 0;
      this.debug.high = 0;
      this.debug.filterHz = hz;
      this.lastRpm = rpm;
      this.lastThrottle = gas;
      this.lastGear = opts.gear;
      return;
    }

    if (!this.loopBuf) void this.ensureSamples();
    else if (!this.loopA) this.startLoops();

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
