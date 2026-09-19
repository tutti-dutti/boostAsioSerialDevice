/** Tiny Web Audio synth — no audio files needed */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
let lastShootAt = 0;
let unlockPromise: Promise<void> | null = null;

function ensure(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.35;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") {
    // Keep resume in-flight; callers that must unlock (user gesture) await unlockAudio()
    if (!unlockPromise) {
      unlockPromise = ctx
        .resume()
        .then(() => {
          unlockPromise = null;
        })
        .catch(() => {
          unlockPromise = null;
        });
    }
  }
  return ctx;
}

/** Call on a user tap (Play / Sound / etc.) so browsers allow sound */
export function unlockAudio() {
  const c = ensure();
  if (!c || !master) return;

  const kick = () => {
    if (!ctx || !master || muted) return;
    // silent blip to unlock / confirm the graph is live
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    o.connect(g);
    g.connect(master);
    o.start();
    o.stop(ctx.currentTime + 0.01);
  };

  if (c.state === "suspended") {
    void c.resume().then(kick).catch(() => {});
  } else {
    kick();
  }
}

/** Short confirmation chirp when the player turns sound on */
export function playUnmuteChirp() {
  if (muted) return;
  unlockAudio();
  tone(660, 0.08, "sine", 0.12, 880);
  tone(990, 0.1, "triangle", 0.08, 1320);
}

export function setMuted(m: boolean) {
  muted = m;
  if (!m) {
    unlockAudio();
  }
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
  if (c.state === "suspended") {
    void c.resume();
    return;
  }
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
  if (c.state === "suspended") {
    void c.resume();
    return;
  }
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
export function playShoot(
  kind: "normal" | "floppy" | "god" | "minigun" | "laser" | "freeze" | "heavy" | "dumpling" = "normal",
) {
  if (muted) return;
  const now = performance.now();
  // throttle so many towers don't explode the speakers
  const gap = kind === "minigun" || kind === "laser" ? 22 : kind === "dumpling" ? 50 : 35;
  if (now - lastShootAt < gap) return;
  lastShootAt = now;

  if (kind === "dumpling") {
    // soft plop + cartoon whoosh — dumpling toss
    const base = 280 + Math.random() * 80;
    tone(base, 0.12, "triangle", 0.16, base * 0.4);
    tone(base * 1.6, 0.08, "sine", 0.08, base * 0.7);
    noiseBurst(0.05, 0.06, 1800);
    return;
  }

  if (kind === "minigun") {
    const base = 1100 + Math.random() * 500;
    tone(base, 0.04, "square", 0.1, base * 0.35);
    tone(base * 1.8, 0.03, "sawtooth", 0.05, base * 0.5);
    noiseBurst(0.02, 0.05, 4200);
    return;
  }

  if (kind === "laser") {
    // snappy sniper zap — high pew with sparkle
    const base = 1400 + Math.random() * 400;
    tone(base, 0.11, "sawtooth", 0.14, 180);
    tone(base * 1.35, 0.08, "square", 0.07, 260);
    tone(base * 0.5, 0.06, "triangle", 0.05, 120);
    noiseBurst(0.04, 0.07, 5000);
    return;
  }

  if (kind === "god") {
    // chunky rainbow beam
    tone(880, 0.16, "sawtooth", 0.18, 160);
    tone(1320, 0.14, "square", 0.1, 220);
    tone(1760, 0.1, "triangle", 0.07, 400);
    noiseBurst(0.08, 0.1, 3800);
    return;
  }

  if (kind === "floppy") {
    // wet blorp laser
    tone(520, 0.15, "triangle", 0.16, 140);
    tone(360, 0.12, "sine", 0.1, 100);
    tone(780, 0.08, "square", 0.05, 200);
    return;
  }

  if (kind === "freeze") {
    // icy chime
    tone(980, 0.12, "sine", 0.12, 420);
    tone(1480, 0.1, "triangle", 0.08, 600);
    tone(620, 0.08, "sine", 0.06, 200);
    return;
  }

  if (kind === "heavy") {
    // thudding impact
    tone(140, 0.14, "sawtooth", 0.16, 60);
    tone(90, 0.12, "square", 0.1, 40);
    noiseBurst(0.06, 0.12, 900);
    return;
  }

  // classic cool arcade laser pew-pew
  const base = 980 + Math.random() * 320;
  tone(base, 0.12, "sawtooth", 0.15, 120);
  tone(base * 1.6, 0.09, "square", 0.08, 180);
  tone(base * 2.1, 0.05, "triangle", 0.05, 300);
  noiseBurst(0.035, 0.06, 4500);
}

/** Soft hit when a shot lands */
export function playHit() {
  if (muted) return;
  tone(240 + Math.random() * 80, 0.05, "square", 0.08, 80);
  tone(480 + Math.random() * 60, 0.04, "triangle", 0.05, 140);
  noiseBurst(0.035, 0.06, 1600);
}

/** Crunchy cookie munch when the cookie takes a bite of damage */
export function playCookieMunch(big = false) {
  if (muted) return;
  const c = ensure();
  if (!c || !master) return;
  const t0 = c.currentTime;

  // crisp crunch (noise) + chewy bite (pitch drop)
  noiseBurst(big ? 0.14 : 0.09, big ? 0.28 : 0.2, big ? 900 : 1200);
  noiseBurst(big ? 0.1 : 0.06, big ? 0.16 : 0.12, 2800);

  const bite = 220 + Math.random() * 60;
  tone(bite, big ? 0.18 : 0.12, "sawtooth", big ? 0.2 : 0.15, 70);
  tone(bite * 1.6, big ? 0.12 : 0.08, "square", 0.08, 90);
  tone(140, big ? 0.16 : 0.1, "triangle", 0.1, 55);

  // second chew for bigger bites (scheduled on the audio clock)
  if (big) {
    const delay = 0.1;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(190, t0 + delay);
    osc.frequency.exponentialRampToValueAtTime(55, t0 + delay + 0.1);
    g.gain.setValueAtTime(0.0001, t0 + delay);
    g.gain.exponentialRampToValueAtTime(0.14, t0 + delay + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + delay + 0.1);
    osc.connect(g);
    g.connect(master);
    osc.start(t0 + delay);
    osc.stop(t0 + delay + 0.12);
    noiseBurst(0.07, 0.14, 1100);
  }
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
