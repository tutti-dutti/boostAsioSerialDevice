import type { Vec2 } from "./types";

/** Top-down arena like Summoner's Greed */
export const W = 1000;
export const H = 560;

/** Waves per map before rotating to the next layout */
export const WAVES_PER_MAP = 30;

export interface ArenaMap {
  id: string;
  name: string;
  path: Vec2[];
  slots: Vec2[];
  cookie: Vec2;
  gate: Vec2;
  grassA: string;
  grassB: string;
  pathColor: string;
}

/** Pack lots of pads along both sides of a path (plus any seed spots). */
function densifySlots(path: Vec2[], seed: Vec2[] = [], complexity = 0): Vec2[] {
  const minGap = Math.max(36, 46 - complexity * 2);
  const out: Vec2[] = [];

  const tooClose = (p: Vec2) => out.some((q) => Math.hypot(p.x - q.x, p.y - q.y) < minGap);
  const nearPathNode = (p: Vec2) => path.some((n) => Math.hypot(p.x - n.x, p.y - n.y) < 34);

  const add = (p: Vec2) => {
    if (p.x < 30 || p.x > W - 30 || p.y < 30 || p.y > H - 30) return;
    if (nearPathNode(p) || tooClose(p)) return;
    out.push(p);
  };

  for (const s of seed) add(s);

  const offsets = [52, 88, 124];
  if (complexity >= 1) offsets.push(158);
  if (complexity >= 3) offsets.unshift(38);
  if (complexity >= 5) offsets.push(180);

  const stepSize = Math.max(36, 48 - complexity * 2);
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const steps = Math.max(2, Math.ceil(len / stepSize));
    const nx = -(b.y - a.y) / len;
    const ny = (b.x - a.x) / len;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;
      for (const off of offsets) {
        add({ x: x + nx * off, y: y + ny * off });
        add({ x: x - nx * off, y: y - ny * off });
      }
    }
  }
  return out;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

/** Add switchbacks so higher tiers get twistier, longer paths */
function complexifyPath(base: Vec2[], complexity: number): Vec2[] {
  if (complexity <= 0) return base.map((p) => ({ ...p }));
  let path = base.map((p) => ({ ...p }));
  const rounds = Math.min(complexity, 7);
  for (let r = 0; r < rounds; r++) {
    const next: Vec2[] = [{ ...path[0] }];
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1];
      const b = path[i];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len > 85) {
        const nx = -(b.y - a.y) / len;
        const ny = (b.x - a.x) / len;
        const amp = clamp(26 + r * 9, 26, 72) * (r % 2 === 0 ? 1 : -1);
        const mid = {
          x: clamp((a.x + b.x) / 2 + nx * amp, 40, W - 40),
          y: clamp((a.y + b.y) / 2 + ny * amp, 40, H - 40),
        };
        if (complexity >= 2 && r >= 1) {
          next.push(
            {
              x: clamp(a.x + (b.x - a.x) * 0.3 + nx * amp * 0.55, 40, W - 40),
              y: clamp(a.y + (b.y - a.y) * 0.3 + ny * amp * 0.55, 40, H - 40),
            },
            mid,
            {
              x: clamp(a.x + (b.x - a.x) * 0.7 - nx * amp * 0.55, 40, W - 40),
              y: clamp(a.y + (b.y - a.y) * 0.7 - ny * amp * 0.55, 40, H - 40),
            },
          );
        } else {
          next.push(mid);
        }
      }
      next.push({ ...b });
    }
    path = next;
  }
  return path;
}

function withDenseSlots(map: ArenaMap): ArenaMap {
  return { ...map, slots: densifySlots(map.path, map.slots, 0) };
}

/** Distinct base themes that rotate every 30 waves (then grow more complex) */
const MAP_DEFS: ArenaMap[] = [
  {
    id: "forest",
    name: "Forest Snarl",
    grassA: "#8fd18a",
    grassB: "#7ec07a",
    pathColor: "#c9a66b",
    gate: { x: 80, y: 40 },
    cookie: { x: 920, y: 220 },
    path: [
      { x: 80, y: 40 },
      { x: 80, y: 160 },
      { x: 220, y: 160 },
      { x: 220, y: 300 },
      { x: 400, y: 300 },
      { x: 400, y: 120 },
      { x: 620, y: 120 },
      { x: 620, y: 360 },
      { x: 820, y: 360 },
      { x: 820, y: 220 },
      { x: 920, y: 220 },
    ],
    slots: [
      { x: 140, y: 60 },
      { x: 140, y: 140 },
      { x: 40, y: 100 },
      { x: 40, y: 220 },
      { x: 150, y: 220 },
      { x: 220, y: 100 },
      { x: 290, y: 160 },
      { x: 290, y: 240 },
      { x: 160, y: 300 },
      { x: 290, y: 360 },
      { x: 350, y: 240 },
      { x: 350, y: 360 },
      { x: 470, y: 360 },
      { x: 470, y: 280 },
      { x: 470, y: 180 },
      { x: 470, y: 60 },
      { x: 540, y: 180 },
      { x: 560, y: 60 },
      { x: 690, y: 60 },
      { x: 690, y: 180 },
      { x: 560, y: 280 },
      { x: 690, y: 300 },
      { x: 690, y: 420 },
      { x: 760, y: 280 },
      { x: 760, y: 420 },
      { x: 890, y: 420 },
      { x: 890, y: 300 },
      { x: 890, y: 160 },
      { x: 820, y: 140 },
      { x: 960, y: 300 },
    ],
  },
  {
    id: "river",
    name: "River Bend",
    grassA: "#7ec8b8",
    grassB: "#6ab5a6",
    pathColor: "#b8956a",
    gate: { x: 60, y: 280 },
    cookie: { x: 940, y: 280 },
    path: [
      { x: 60, y: 280 },
      { x: 180, y: 280 },
      { x: 180, y: 100 },
      { x: 360, y: 100 },
      { x: 360, y: 420 },
      { x: 540, y: 420 },
      { x: 540, y: 160 },
      { x: 720, y: 160 },
      { x: 720, y: 400 },
      { x: 880, y: 400 },
      { x: 880, y: 280 },
      { x: 940, y: 280 },
    ],
    slots: [
      { x: 120, y: 200 },
      { x: 120, y: 360 },
      { x: 60, y: 180 },
      { x: 250, y: 180 },
      { x: 250, y: 60 },
      { x: 250, y: 280 },
      { x: 360, y: 40 },
      { x: 430, y: 100 },
      { x: 290, y: 420 },
      { x: 430, y: 360 },
      { x: 430, y: 480 },
      { x: 540, y: 340 },
      { x: 620, y: 420 },
      { x: 470, y: 220 },
      { x: 620, y: 100 },
      { x: 620, y: 220 },
      { x: 720, y: 80 },
      { x: 800, y: 160 },
      { x: 800, y: 260 },
      { x: 650, y: 340 },
      { x: 800, y: 400 },
      { x: 800, y: 480 },
      { x: 940, y: 400 },
      { x: 940, y: 200 },
      { x: 880, y: 200 },
      { x: 960, y: 340 },
      { x: 180, y: 40 },
      { x: 360, y: 200 },
      { x: 540, y: 60 },
      { x: 720, y: 480 },
    ],
  },
  {
    id: "meadow",
    name: "Meadow Loop",
    grassA: "#b8d86a",
    grassB: "#a4c65a",
    pathColor: "#d2b48c",
    gate: { x: 500, y: 40 },
    cookie: { x: 500, y: 500 },
    path: [
      { x: 500, y: 40 },
      { x: 780, y: 80 },
      { x: 900, y: 220 },
      { x: 840, y: 400 },
      { x: 620, y: 500 },
      { x: 380, y: 500 },
      { x: 160, y: 400 },
      { x: 100, y: 220 },
      { x: 220, y: 80 },
      { x: 420, y: 120 },
      { x: 500, y: 280 },
      { x: 500, y: 500 },
    ],
    slots: [
      { x: 500, y: 120 },
      { x: 600, y: 60 },
      { x: 400, y: 60 },
      { x: 700, y: 140 },
      { x: 820, y: 160 },
      { x: 820, y: 280 },
      { x: 920, y: 300 },
      { x: 760, y: 360 },
      { x: 700, y: 460 },
      { x: 560, y: 440 },
      { x: 440, y: 440 },
      { x: 300, y: 460 },
      { x: 200, y: 360 },
      { x: 80, y: 300 },
      { x: 160, y: 220 },
      { x: 180, y: 120 },
      { x: 300, y: 140 },
      { x: 380, y: 200 },
      { x: 580, y: 200 },
      { x: 620, y: 300 },
      { x: 420, y: 300 },
      { x: 500, y: 360 },
      { x: 740, y: 240 },
      { x: 260, y: 280 },
      { x: 900, y: 420 },
      { x: 100, y: 420 },
      { x: 860, y: 80 },
      { x: 140, y: 80 },
      { x: 640, y: 120 },
      { x: 360, y: 380 },
    ],
  },
  {
    id: "canyon",
    name: "Canyon Run",
    grassA: "#d4b87a",
    grassB: "#c4a66a",
    pathColor: "#a87848",
    gate: { x: 80, y: 500 },
    cookie: { x: 920, y: 60 },
    path: [
      { x: 80, y: 500 },
      { x: 80, y: 360 },
      { x: 260, y: 360 },
      { x: 260, y: 500 },
      { x: 460, y: 500 },
      { x: 460, y: 280 },
      { x: 680, y: 280 },
      { x: 680, y: 480 },
      { x: 860, y: 480 },
      { x: 860, y: 200 },
      { x: 680, y: 200 },
      { x: 680, y: 60 },
      { x: 920, y: 60 },
    ],
    slots: [
      { x: 40, y: 440 },
      { x: 150, y: 440 },
      { x: 150, y: 360 },
      { x: 40, y: 320 },
      { x: 200, y: 300 },
      { x: 320, y: 360 },
      { x: 320, y: 460 },
      { x: 200, y: 500 },
      { x: 400, y: 440 },
      { x: 520, y: 500 },
      { x: 400, y: 340 },
      { x: 520, y: 280 },
      { x: 400, y: 220 },
      { x: 600, y: 340 },
      { x: 760, y: 340 },
      { x: 760, y: 440 },
      { x: 600, y: 480 },
      { x: 920, y: 480 },
      { x: 920, y: 360 },
      { x: 800, y: 280 },
      { x: 920, y: 200 },
      { x: 800, y: 140 },
      { x: 600, y: 140 },
      { x: 600, y: 60 },
      { x: 760, y: 60 },
      { x: 860, y: 100 },
      { x: 960, y: 120 },
      { x: 520, y: 60 },
      { x: 320, y: 280 },
      { x: 150, y: 500 },
    ],
  },
];

export const MAPS: ArenaMap[] = MAP_DEFS.map(withDenseSlots);

/** How many map rotations have happened (0 at waves 1–30, 1 at 31–60, …) */
export function mapTierForWave(wave: number): number {
  return Math.floor(Math.max(0, wave - 1) / WAVES_PER_MAP);
}

/** Theme cycle index (Forest → River → Meadow → Canyon → …) */
export function mapIndexForWave(wave: number): number {
  return mapTierForWave(wave) % MAP_DEFS.length;
}

export function buildMapForWave(wave: number): ArenaMap {
  const tier = mapTierForWave(wave);
  const theme = MAP_DEFS[tier % MAP_DEFS.length];
  const path = complexifyPath(theme.path, tier);
  const stars = "★".repeat(Math.min(tier, 5));
  return {
    ...theme,
    id: `${theme.id}_t${tier}`,
    name: tier === 0 ? theme.name : `${theme.name} ${stars}${tier > 5 ? `+${tier - 5}` : ""}`.trim(),
    path,
    slots: densifySlots(path, theme.slots, tier),
    gate: { ...path[0] },
    cookie: { ...path[path.length - 1] },
  };
}

export function mapForWave(wave: number): ArenaMap {
  return buildMapForWave(wave);
}

let active = buildMapForWave(1);
let CUM = [0];
let PATH_LEN = 0;

function rebuildLengths(path: Vec2[]) {
  CUM = [0];
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    total += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
    CUM.push(total);
  }
  PATH_LEN = total;
}

rebuildLengths(active.path);

/** Live layout used by gameplay + render (switched every 30 waves) */
export let PATH = active.path;
export let SLOT_SPOTS = active.slots;
export let COOKIE = active.cookie;
export let GATE = active.gate;

export function getActiveMap(): ArenaMap {
  return active;
}

export function setActiveMap(index: number): ArenaMap {
  // Back-compat: treat index as a tier into the theme cycle at complexity 0..n
  return setActiveMapForWave(index * WAVES_PER_MAP + 1);
}

export function setActiveMapForWave(wave: number): ArenaMap {
  active = buildMapForWave(wave);
  PATH = active.path;
  SLOT_SPOTS = active.slots;
  COOKIE = active.cookie;
  GATE = active.gate;
  rebuildLengths(active.path);
  return active;
}

export function pathPoint(t: number): Vec2 {
  const path = PATH;
  const d = Math.max(0, Math.min(1, t)) * PATH_LEN;
  for (let i = 1; i < CUM.length; i++) {
    if (d <= CUM[i]) {
      const seg = CUM[i] - CUM[i - 1] || 1;
      const u = (d - CUM[i - 1]) / seg;
      return {
        x: path[i - 1].x + (path[i].x - path[i - 1].x) * u,
        y: path[i - 1].y + (path[i].y - path[i - 1].y) * u,
      };
    }
  }
  return { ...path[path.length - 1] };
}

/** Progress along path for a point (approx) — used for walls */
export function nearestProgress(x: number, y: number): number {
  let best = 0;
  let bestD = Infinity;
  const samples = Math.min(80, 40 + Math.floor(PATH.length / 2));
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const p = pathPoint(t);
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  return best;
}
