/** Tiny Web Audio synth — no audio files needed */

import type { FriendDef } from "./data";
import { weaponRoleFor } from "./data";

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
  if (m) {
    silenceBgmVoices();
  } else if (bgmMode !== "off") {
    // Restart loop so unmute brings music back immediately
    const mode = bgmMode;
    bgmMode = "off";
    setBgmMode(mode);
  }
}

export function isMuted() {
  return muted;
}

export type BgmMode = "off" | "calm" | "danger";

let bgmMode: BgmMode = "off";
let bgmStep = 0;
let bgmTimer: ReturnType<typeof setInterval> | null = null;
let droneOsc: OscillatorNode | null = null;
let droneGain: GainNode | null = null;
let pulseOsc: OscillatorNode | null = null;
let pulseGain: GainNode | null = null;

function silenceBgmVoices() {
  stopDroneNodes();
  if (bgmTimer != null) {
    clearInterval(bgmTimer);
    bgmTimer = null;
  }
}

function stopDroneNodes() {
  try {
    droneOsc?.stop();
  } catch {
    /* already stopped */
  }
  try {
    pulseOsc?.stop();
  } catch {
    /* already stopped */
  }
  droneOsc = null;
  droneGain = null;
  pulseOsc = null;
  pulseGain = null;
}

function startDrone(freq: number, gain: number, type: OscillatorType = "sawtooth") {
  const c = ensure();
  if (!c || !master || muted) return;
  stopDroneNodes();
  const t0 = c.currentTime;
  droneOsc = c.createOscillator();
  droneGain = c.createGain();
  droneOsc.type = type;
  droneOsc.frequency.value = freq;
  droneGain.gain.setValueAtTime(0.0001, t0);
  droneGain.gain.linearRampToValueAtTime(gain, t0 + 0.4);
  droneOsc.connect(droneGain);
  droneGain.connect(master);
  droneOsc.start(t0);

  // Soft pulse under the drone for danger heartbeat
  if (bgmMode === "danger") {
    pulseOsc = c.createOscillator();
    pulseGain = c.createGain();
    pulseOsc.type = "sine";
    pulseOsc.frequency.value = freq * 0.5;
    pulseGain.gain.value = gain * 0.55;
    pulseOsc.connect(pulseGain);
    pulseGain.connect(master);
    pulseOsc.start(t0);
  }
}

function bgmPluck(freq: number, dur: number, type: OscillatorType, gain: number) {
  if (muted || bgmMode === "off") return;
  const c = ensure();
  if (!c || !master || c.state === "suspended") return;
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

const CALM_NOTES = [262, 294, 330, 392, 330, 294, 262, 196]; // C major walk
const DANGER_NOTES = [110, 131, 147, 165, 147, 131, 104, 98]; // low minor menace

function tickBgm() {
  if (muted || bgmMode === "off") return;
  const c = ensure();
  if (!c || c.state === "suspended") return;

  if (bgmMode === "calm") {
    const n = CALM_NOTES[bgmStep % CALM_NOTES.length]!;
    bgmPluck(n, 0.28, "triangle", 0.045);
    if (bgmStep % 4 === 0) bgmPluck(n * 0.5, 0.4, "sine", 0.03);
  } else if (bgmMode === "danger") {
    const n = DANGER_NOTES[bgmStep % DANGER_NOTES.length]!;
    bgmPluck(n, 0.18, "sawtooth", 0.07);
    bgmPluck(n * 1.5, 0.12, "square", 0.035);
    // Dissonant stab every 4th beat
    if (bgmStep % 4 === 0) {
      bgmPluck(n * 1.41, 0.22, "sawtooth", 0.055);
      noiseBurst(0.06, 0.04, 400);
    }
    // Heartbeat thump
    if (bgmStep % 2 === 0) {
      bgmPluck(55, 0.14, "sine", 0.1);
    }
  }
  bgmStep += 1;
}

/** Switch looping synth BGM — calm exploration vs danger boss theme */
export function setBgmMode(mode: BgmMode) {
  if (mode === bgmMode) return;
  bgmMode = mode;
  silenceBgmVoices();
  bgmStep = 0;
  if (mode === "off" || muted) return;

  unlockAudio();
  if (mode === "calm") {
    startDrone(98, 0.018, "sine");
    bgmTimer = setInterval(tickBgm, 420);
  } else {
    startDrone(55, 0.04, "sawtooth");
    bgmTimer = setInterval(tickBgm, 280);
  }
  tickBgm();
}

export function getBgmMode(): BgmMode {
  return bgmMode;
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

/** Distinct synth voices per weapon / ability */
export type ShootSoundKind =
  | "antiSpeed"
  | "antiStrength"
  | "balanced"
  | "floppy"
  | "god"
  | "minigun"
  | "laser"
  | "freeze"
  | "heavy"
  | "fox"
  | "poison"
  | "dumpling";

/** Pick the shoot voice for a friend from ability, flyer/legend, then weapon role */
export function shootSoundFor(def: FriendDef): ShootSoundKind {
  if (def.flies) return "laser";
  if (def.ability === "godBeam") return "god";
  if (def.ability === "floppyFin") return "floppy";
  if (def.ability === "freeze") return "freeze";
  if (def.ability === "heavyHit") return "heavy";
  if (def.ability === "foxWall") return "fox";
  if (def.ability === "poisonFart") return "poison";
  if (def.rarity === "legendary") return "minigun";
  return weaponRoleFor(def);
}

/** Fun laser / pew when a friend shoots — voice matches weapon type */
export function playShoot(kind: ShootSoundKind | "normal" = "balanced") {
  if (muted) return;
  const voice: ShootSoundKind = kind === "normal" ? "balanced" : kind;
  const now = performance.now();
  // throttle so many towers don't explode the speakers
  const gap =
    voice === "minigun" || voice === "laser" || voice === "antiSpeed"
      ? 22
      : voice === "dumpling" || voice === "poison"
        ? 50
        : voice === "heavy" || voice === "antiStrength"
          ? 45
          : 35;
  if (now - lastShootAt < gap) return;
  lastShootAt = now;

  if (voice === "dumpling") {
    // soft plop + cartoon whoosh — dumpling toss
    const base = 280 + Math.random() * 80;
    tone(base, 0.12, "triangle", 0.16, base * 0.4);
    tone(base * 1.6, 0.08, "sine", 0.08, base * 0.7);
    noiseBurst(0.05, 0.06, 1800);
    return;
  }

  if (voice === "poison") {
    // wet raspberry / toxic puff for skunk shots + farts
    const base = 160 + Math.random() * 40;
    tone(base, 0.14, "sawtooth", 0.14, 55);
    tone(base * 2.2, 0.1, "square", 0.07, 90);
    noiseBurst(0.12, 0.14, 700);
    noiseBurst(0.08, 0.08, 1600);
    return;
  }

  if (voice === "fox") {
    // sly twang — fox wall shooters
    const base = 640 + Math.random() * 120;
    tone(base, 0.1, "triangle", 0.14, 220);
    tone(base * 1.5, 0.08, "sine", 0.08, 180);
    tone(base * 0.7, 0.06, "square", 0.05, 140);
    return;
  }

  if (voice === "minigun") {
    const base = 1100 + Math.random() * 500;
    tone(base, 0.04, "square", 0.1, base * 0.35);
    tone(base * 1.8, 0.03, "sawtooth", 0.05, base * 0.5);
    noiseBurst(0.02, 0.05, 4200);
    return;
  }

  if (voice === "laser") {
    // snappy sniper zap — flyer pew with sparkle
    const base = 1400 + Math.random() * 400;
    tone(base, 0.11, "sawtooth", 0.14, 180);
    tone(base * 1.35, 0.08, "square", 0.07, 260);
    tone(base * 0.5, 0.06, "triangle", 0.05, 120);
    noiseBurst(0.04, 0.07, 5000);
    return;
  }

  if (voice === "god") {
    // chunky rainbow beam
    tone(880, 0.16, "sawtooth", 0.18, 160);
    tone(1320, 0.14, "square", 0.1, 220);
    tone(1760, 0.1, "triangle", 0.07, 400);
    noiseBurst(0.08, 0.1, 3800);
    return;
  }

  if (voice === "floppy") {
    // wet blorp laser
    tone(520, 0.15, "triangle", 0.16, 140);
    tone(360, 0.12, "sine", 0.1, 100);
    tone(780, 0.08, "square", 0.05, 200);
    return;
  }

  if (voice === "freeze") {
    // icy chime
    tone(980, 0.12, "sine", 0.12, 420);
    tone(1480, 0.1, "triangle", 0.08, 600);
    tone(620, 0.08, "sine", 0.06, 200);
    return;
  }

  if (voice === "heavy") {
    // thudding impact — heavy-hit ability
    tone(140, 0.14, "sawtooth", 0.16, 60);
    tone(90, 0.12, "square", 0.1, 40);
    noiseBurst(0.06, 0.12, 900);
    return;
  }

  if (voice === "antiSpeed") {
    // zippy peashooter — fast vs runners
    const base = 1200 + Math.random() * 380;
    tone(base, 0.07, "square", 0.12, 320);
    tone(base * 1.7, 0.05, "triangle", 0.07, 400);
    noiseBurst(0.025, 0.05, 5200);
    return;
  }

  if (voice === "antiStrength") {
    // punchy mid boom — cracks tanks
    const base = 220 + Math.random() * 80;
    tone(base, 0.11, "sawtooth", 0.15, 70);
    tone(base * 1.8, 0.07, "square", 0.08, 90);
    noiseBurst(0.05, 0.1, 1200);
    return;
  }

  // balanced — classic cool arcade laser pew-pew
  const base = 980 + Math.random() * 320;
  tone(base, 0.12, "sawtooth", 0.15, 120);
  tone(base * 1.6, 0.09, "square", 0.08, 180);
  tone(base * 2.1, 0.05, "triangle", 0.05, 300);
  noiseBurst(0.035, 0.06, 4500);
}

/** Skunk poison fart / toxic cloud burst */
export function playPoisonFart() {
  if (muted) return;
  const now = performance.now();
  if (now - lastShootAt < 80) return;
  lastShootAt = now;
  const base = 90 + Math.random() * 30;
  tone(base, 0.22, "sawtooth", 0.18, 40);
  tone(base * 1.6, 0.16, "square", 0.1, 55);
  noiseBurst(0.2, 0.2, 500);
  noiseBurst(0.14, 0.12, 1100);
}

/** Fox wall plonk when a barrier goes up */
export function playFoxWall() {
  if (muted) return;
  tone(380, 0.12, "triangle", 0.14, 160);
  tone(260, 0.14, "sine", 0.1, 90);
  noiseBurst(0.06, 0.08, 1400);
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
