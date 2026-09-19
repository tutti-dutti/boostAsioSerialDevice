/** Tiny Web Audio synth — no audio files needed */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
let lastShootAt = 0;

function ensure(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Call once on a user tap (Play button) so browsers allow sound */
export function unlockAudio() {
  const c = ensure();
  if (!c) return;
  // silent blip to unlock
  const o = c.createOscillator();
  const g = c.createGain();
  g.gain.value = 0.0001;
  o.connect(g);
  g.connect(master!);
  o.start();
  o.stop(c.currentTime + 0.01);
}

export function setMuted(m: boolean) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.35;
}

export function isMuted() {
  return muted;
}

function tone(
  freq: number,
  dur: number,
  type: OscillatorType,
  gain = 0.2,
  slideTo?: number,
) {
  if (muted) return;
  const c = ensure();
  if (!c || !master) return;
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo != null) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t0 + dur);
  }
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noiseBurst(dur: number, gain = 0.15, filterFreq = 2000) {
  if (muted) return;
  const c = ensure();
  if (!c || !master) return;
  const t0 = c.currentTime;
  const n = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = filterFreq;
  filter.Q.value = 0.8;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(master);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

/** Fun laser / pew when a friend shoots */
export function playShoot(kind: "normal" | "floppy" | "god" | "minigun" = "normal") {
  if (muted) return;
  const now = performance.now();
  // throttle so many towers don't explode the speakers
  const gap = kind === "minigun" ? 28 : 40;
  if (now - lastShootAt < gap) return;
  lastShootAt = now;

  if (kind === "minigun") {
    // rapid clicky minigun chatter
    const base = 900 + Math.random() * 400;
    tone(base, 0.035, "square", 0.09, base * 0.45);
    noiseBurst(0.025, 0.06, 2800);
    return;
  }
  if (kind === "god") {
    tone(660, 0.12, "sawtooth", 0.16, 180);
    tone(990, 0.1, "square", 0.08, 220);
    noiseBurst(0.06, 0.08, 3500);
    return;
  }
  if (kind === "floppy") {
    tone(420, 0.14, "triangle", 0.18, 160);
    tone(280, 0.1, "sine", 0.1, 120);
    return;
  }
  // classic arcade pew
  const base = 720 + Math.random() * 180;
  tone(base, 0.09, "square", 0.14, 140);
  tone(base * 1.5, 0.06, "triangle", 0.06, 200);
}

/** Soft hit when a shot lands */
export function playHit() {
  if (muted) return;
  tone(180 + Math.random() * 40, 0.05, "triangle", 0.1, 90);
  noiseBurst(0.04, 0.07, 900);
}

/** Spell boom */
export function playSpell(kind: "crumb" | "frost" | "zap") {
  if (muted) return;
  if (kind === "frost") {
    tone(880, 0.2, "sine", 0.12, 440);
    tone(1320, 0.15, "triangle", 0.08, 660);
    return;
  }
  if (kind === "zap") {
    noiseBurst(0.12, 0.2, 4000);
    tone(1200, 0.08, "sawtooth", 0.12, 200);
    return;
  }
  // crumb boom
  noiseBurst(0.18, 0.22, 400);
  tone(90, 0.2, "sine", 0.2, 40);
}
