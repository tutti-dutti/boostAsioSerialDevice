import type { Vec2 } from "./types";

/** Top-down arena like Summoner's Greed */
export const W = 1000;
export const H = 560;

/** Waves per map before rotating to the next layout */
export const WAVES_PER_MAP = 30;

export type DecorKind =
  | "oak"
  | "pine"
  | "palm"
  | "bamboo"
  | "sakura"
  | "cactus"
  | "dead"
  | "bush"
  | "rock"
  | "flower"
  | "reed"
  | "mushroom"
  | "crystal"
  | "snowpine"
  | "lily"
  | "stump";

export interface MapDecor {
  kind: DecorKind;
  x: number;
  y: number;
  s: number;
}

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
  /** Off-path trees & landscaping */
  decor: MapDecor[];
  /** Theme palette used when (re)scattering decor */
  landscape: DecorKind[];
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

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Distance from point to polyline (path) */
function distToPathPoly(x: number, y: number, path: Vec2[]): number {
  let best = Infinity;
  for (let i = 1; i < path.length; i++) {
    const ax = path[i - 1].x;
    const ay = path[i - 1].y;
    const bx = path[i].x;
    const by = path[i].y;
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy || 1;
    let t = ((x - ax) * dx + (y - ay) * dy) / len2;
    t = clamp(t, 0, 1);
    const px = ax + dx * t;
    const py = ay + dy * t;
    best = Math.min(best, Math.hypot(x - px, y - py));
  }
  return best;
}

/**
 * Scatter theme landscaping off the path / cookie / gate.
 * Trees & props are cosmetic only — they must never sit in the path
 * no-place band, so friends can be deployed right on top of them.
 */
export function scatterDecor(path: Vec2[], themeId: string, kinds: DecorKind[], count = 48): MapDecor[] {
  if (!kinds.length || path.length < 2) return [];
  const rnd = mulberry32(hashStr(themeId + ":decor") ^ (count * 2654435761));
  const gate = path[0];
  const cookie = path[path.length - 1];
  const out: MapDecor[] = [];
  // Stay outside default path clearance (~56) + a little canopy room so
  // tapping a tree is a valid place spot, not a red "on path" ghost.
  const minPath = 78;
  const minPeer = 30;
  let tries = 0;
  while (out.length < count && tries < count * 50) {
    tries++;
    // Keep a 36px inset so decor centers always pass canPlaceAt edge checks (x/y ≥ 30).
    const x = 36 + rnd() * (W - 72);
    const y = 36 + rnd() * (H - 72);
    if (distToPathPoly(x, y, path) < minPath) continue;
    if (Math.hypot(x - gate.x, y - gate.y) < 58) continue;
    if (Math.hypot(x - cookie.x, y - cookie.y) < 78) continue;
    if (out.some((d) => Math.hypot(d.x - x, d.y - y) < minPeer)) continue;
    const kind = kinds[Math.floor(rnd() * kinds.length)]!;
    const s = 0.7 + rnd() * 0.65;
    out.push({ kind, x, y, s });
  }
  // Sort so taller kinds draw later (overlap nicely)
  const rank: Record<string, number> = {
    flower: 0,
    lily: 0,
    mushroom: 1,
    reed: 1,
    bush: 2,
    stump: 2,
    rock: 2,
    crystal: 3,
    cactus: 4,
    bamboo: 5,
    sakura: 6,
    palm: 6,
    oak: 7,
    pine: 7,
    snowpine: 7,
    dead: 6,
  };
  out.sort((a, b) => a.y - b.y || (rank[a.kind] ?? 5) - (rank[b.kind] ?? 5));
  return out;
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

type MapSeed = Omit<ArenaMap, "decor" | "slots"> & { slots?: Vec2[] };

function finalizeMap(seed: MapSeed): ArenaMap {
  const slots = densifySlots(seed.path, seed.slots ?? [], 0);
  const decor = scatterDecor(seed.path, seed.id, seed.landscape);
  return { ...seed, slots, decor };
}

/** Distinct base themes — 10 courses with unique paths & landscaping */
const MAP_DEFS: ArenaMap[] = (
  [
    {
      id: "forest",
      name: "Forest Snarl",
      grassA: "#8fd18a",
      grassB: "#7ec07a",
      pathColor: "#c9a66b",
      landscape: ["oak", "pine", "bush", "mushroom", "stump", "flower"],
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
    },
    {
      id: "river",
      name: "River Bend",
      grassA: "#7ec8b8",
      grassB: "#6ab5a6",
      pathColor: "#b8956a",
      landscape: ["reed", "bush", "oak", "lily", "rock", "flower"],
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
    },
    {
      id: "meadow",
      name: "Meadow Loop",
      grassA: "#b8d86a",
      grassB: "#a4c65a",
      pathColor: "#d2b48c",
      landscape: ["flower", "bush", "oak", "mushroom", "stump"],
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
    },
    {
      id: "canyon",
      name: "Canyon Run",
      grassA: "#d4b87a",
      grassB: "#c4a66a",
      pathColor: "#a87848",
      landscape: ["rock", "cactus", "dead", "bush", "stump"],
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
    },
    {
      id: "snow",
      name: "Frost Peak",
      grassA: "#d8e8f4",
      grassB: "#c0d4e8",
      pathColor: "#a8b8c8",
      landscape: ["snowpine", "rock", "crystal", "bush"],
      gate: { x: 40, y: 80 },
      cookie: { x: 960, y: 480 },
      path: [
        { x: 40, y: 80 },
        { x: 200, y: 80 },
        { x: 200, y: 240 },
        { x: 380, y: 240 },
        { x: 380, y: 80 },
        { x: 600, y: 80 },
        { x: 600, y: 320 },
        { x: 780, y: 320 },
        { x: 780, y: 140 },
        { x: 920, y: 140 },
        { x: 920, y: 360 },
        { x: 760, y: 360 },
        { x: 760, y: 500 },
        { x: 960, y: 480 },
      ],
    },
    {
      id: "bamboo",
      name: "Bamboo Grove",
      grassA: "#9ed47a",
      grassB: "#86c068",
      pathColor: "#c4a878",
      landscape: ["bamboo", "bush", "flower", "rock", "mushroom"],
      gate: { x: 500, y: 520 },
      cookie: { x: 500, y: 40 },
      path: [
        { x: 500, y: 520 },
        { x: 200, y: 520 },
        { x: 200, y: 360 },
        { x: 420, y: 360 },
        { x: 420, y: 220 },
        { x: 160, y: 220 },
        { x: 160, y: 80 },
        { x: 500, y: 80 },
        { x: 840, y: 80 },
        { x: 840, y: 220 },
        { x: 580, y: 220 },
        { x: 580, y: 360 },
        { x: 800, y: 360 },
        { x: 800, y: 500 },
        { x: 500, y: 40 },
      ],
    },
    {
      id: "desert",
      name: "Sunbake Dunes",
      grassA: "#e8d090",
      grassB: "#d8c078",
      pathColor: "#c4a060",
      landscape: ["cactus", "rock", "dead", "bush"],
      gate: { x: 40, y: 500 },
      cookie: { x: 960, y: 60 },
      path: [
        { x: 40, y: 500 },
        { x: 220, y: 500 },
        { x: 220, y: 320 },
        { x: 80, y: 320 },
        { x: 80, y: 140 },
        { x: 300, y: 140 },
        { x: 300, y: 400 },
        { x: 520, y: 400 },
        { x: 520, y: 180 },
        { x: 740, y: 180 },
        { x: 740, y: 420 },
        { x: 900, y: 420 },
        { x: 900, y: 200 },
        { x: 960, y: 60 },
      ],
    },
    {
      id: "swamp",
      name: "Misty Mire",
      grassA: "#6a9868",
      grassB: "#588858",
      pathColor: "#7a6848",
      landscape: ["reed", "dead", "mushroom", "lily", "stump", "bush"],
      gate: { x: 60, y: 100 },
      cookie: { x: 940, y: 460 },
      path: [
        { x: 60, y: 100 },
        { x: 280, y: 100 },
        { x: 280, y: 280 },
        { x: 120, y: 280 },
        { x: 120, y: 440 },
        { x: 360, y: 440 },
        { x: 360, y: 200 },
        { x: 560, y: 200 },
        { x: 560, y: 420 },
        { x: 760, y: 420 },
        { x: 760, y: 160 },
        { x: 920, y: 160 },
        { x: 920, y: 340 },
        { x: 940, y: 460 },
      ],
    },
    {
      id: "sakura",
      name: "Petal Path",
      grassA: "#d8e8a8",
      grassB: "#c8d898",
      pathColor: "#d2b090",
      landscape: ["sakura", "flower", "bush", "rock", "stump"],
      gate: { x: 40, y: 280 },
      cookie: { x: 960, y: 280 },
      path: [
        { x: 40, y: 280 },
        { x: 160, y: 160 },
        { x: 320, y: 120 },
        { x: 420, y: 260 },
        { x: 300, y: 400 },
        { x: 480, y: 480 },
        { x: 660, y: 400 },
        { x: 580, y: 240 },
        { x: 720, y: 120 },
        { x: 880, y: 160 },
        { x: 900, y: 320 },
        { x: 960, y: 280 },
      ],
    },
    {
      id: "volcano",
      name: "Ember Rim",
      grassA: "#8a6860",
      grassB: "#785850",
      pathColor: "#5a4038",
      landscape: ["rock", "dead", "crystal", "cactus", "stump"],
      gate: { x: 500, y: 40 },
      cookie: { x: 500, y: 520 },
      path: [
        { x: 500, y: 40 },
        { x: 220, y: 80 },
        { x: 100, y: 220 },
        { x: 180, y: 400 },
        { x: 360, y: 480 },
        { x: 500, y: 360 },
        { x: 640, y: 480 },
        { x: 820, y: 400 },
        { x: 900, y: 220 },
        { x: 780, y: 80 },
        { x: 500, y: 160 },
        { x: 500, y: 520 },
      ],
    },
  ] satisfies MapSeed[]
).map(finalizeMap);

export const MAPS: ArenaMap[] = MAP_DEFS;

export const COURSE_COUNT = MAP_DEFS.length;

/** Base courses players can pick (theme only — complexity still scales with wave) */
export function listCourses(): { id: string; name: string; index: number }[] {
  return MAP_DEFS.map((m, index) => ({ id: m.id, name: m.name, index }));
}

/** How many map rotations have happened (0 at waves 1–30, 1 at 31–60, …) */
export function mapTierForWave(wave: number): number {
  return Math.floor(Math.max(0, wave - 1) / WAVES_PER_MAP);
}

/** Theme cycle index (Forest → River → …) — legacy fallback */
export function mapIndexForWave(wave: number): number {
  return mapTierForWave(wave) % MAP_DEFS.length;
}

function clampCourseIndex(index: number): number {
  const n = MAP_DEFS.length;
  return ((Math.floor(index) % n) + n) % n;
}

/** Pick a random course, optionally different from the current one */
export function randomCourseIndex(exclude?: number): number {
  if (MAP_DEFS.length <= 1) return 0;
  if (exclude == null || MAP_DEFS.length < 2) {
    return Math.floor(Math.random() * MAP_DEFS.length);
  }
  const ex = clampCourseIndex(exclude);
  let i = Math.floor(Math.random() * (MAP_DEFS.length - 1));
  if (i >= ex) i += 1;
  return i;
}

export function buildMap(courseIndex: number, complexity: number): ArenaMap {
  const theme = MAP_DEFS[clampCourseIndex(courseIndex)];
  const tier = Math.max(0, Math.floor(complexity));
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
    decor: scatterDecor(path, `${theme.id}_t${tier}`, theme.landscape, 48 + tier * 4),
  };
}

export function buildMapForWave(wave: number, courseIndex = mapIndexForWave(wave)): ArenaMap {
  return buildMap(courseIndex, mapTierForWave(wave));
}

export function mapForWave(wave: number, courseIndex?: number): ArenaMap {
  return buildMapForWave(wave, courseIndex);
}

let activeCourseIndex = 0;
let active = buildMap(0, 0);
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

export function getActiveCourseIndex(): number {
  return activeCourseIndex;
}

export function setActiveMap(index: number): ArenaMap {
  // Back-compat: treat index as a course theme at complexity 0
  return setActiveCourseMap(index, 1);
}

export function setActiveMapForWave(wave: number, courseIndex = activeCourseIndex): ArenaMap {
  return setActiveCourseMap(courseIndex, wave);
}

export function setActiveCourseMap(courseIndex: number, wave: number): ArenaMap {
  activeCourseIndex = clampCourseIndex(courseIndex);
  active = buildMap(activeCourseIndex, mapTierForWave(wave));
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
  const samples = Math.min(120, 50 + Math.floor(PATH.length));
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

/** Closest distance from a point to a line segment */
function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const abx = bx - ax;
  const aby = by - ay;
  const len2 = abx * abx + aby * aby;
  if (len2 <= 1e-6) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * abx + (py - ay) * aby) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + abx * t;
  const cy = ay + aby * t;
  return Math.hypot(px - cx, py - cy);
}

/**
 * True distance from a point to the path polyline (not just sampled progress).
 * Path stroke is ~44px wide, so half-width is ~22.
 */
export function distanceToPath(x: number, y: number): number {
  const path = PATH;
  if (!path.length) return Infinity;
  let best = Infinity;
  for (let i = 1; i < path.length; i++) {
    const d = distToSegment(x, y, path[i - 1].x, path[i - 1].y, path[i].x, path[i].y);
    if (d < best) best = d;
  }
  return best;
}

/** Path stroke half-width */
export const PATH_HALF = 22;
/** Extra air between friend edge and path edge */
export const PATH_EDGE_MARGIN = 10;
/** Default clearance when footprint unknown (typical basic friend) */
export const PATH_CLEARANCE = PATH_HALF + 24 + PATH_EDGE_MARGIN;

/** Clearance so the friend's full icon stays off the path band */
export function pathClearanceFor(footprintRadius: number): number {
  return PATH_HALF + Math.max(18, footprintRadius) + PATH_EDGE_MARGIN;
}

export function canPlaceAt(
  x: number,
  y: number,
  opts: {
    ignoreSlotId?: number;
    others?: { id: number; x: number; y: number }[];
    /** Friend token radius — larger evolves need more clearance */
    footprint?: number;
  } = {},
): boolean {
  if (x < 30 || x > W - 30 || y < 30 || y > H - 30) return false;
  const foot = opts.footprint ?? 24;
  // Hard block: never on or overlapping the path (icon edge included).
  // Map decor (trees, rocks, flowers, …) is cosmetic and never blocks placement.
  if (distanceToPath(x, y) < pathClearanceFor(foot)) return false;
  if (Math.hypot(x - COOKIE.x, y - COOKIE.y) < 52 + Math.max(0, foot - 24)) return false;
  if (Math.hypot(x - GATE.x, y - GATE.y) < 42 + Math.max(0, foot - 24)) return false;
  const spacing = Math.max(40, foot + 18);
  for (const o of opts.others || []) {
    if (opts.ignoreSlotId != null && o.id === opts.ignoreSlotId) continue;
    if (Math.hypot(o.x - x, o.y - y) < spacing) return false;
  }
  return true;
}

export function isOnPath(x: number, y: number, clearance = PATH_CLEARANCE): boolean {
  return distanceToPath(x, y) < clearance;
}
