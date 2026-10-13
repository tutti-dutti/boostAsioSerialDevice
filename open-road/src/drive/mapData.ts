/** Roads, lake, terrain height, highway, and spawn. The minimap uses this too. */
import { ZONE_PATCHES, TRAILS, SKYWAY, speedTrackPaths, skywayPaths } from "./mapZones";

/** Playable half-extent — large enough for the 8 km speed track corridor. */
export const WORLD_HALF = 4500;
/** Soft border near the outer rim (inner skyway / forests sit well inside). */
export const BORDER_IN = 4200;
/** Decorative mountain / forest belt around the original playable core. */
export const INNER_RIM = 1050;
/** Road/car sit this far above the terrain mesh so wheels never sink. */
export const SURFACE_LIFT = 0.1;
export const LAKE = { x: 320, z: -300, r: 48 };
/** Clear straight stretch west of town — away from crosswalks / intersections. */
export const SPAWN = { x: -180, z: 0, yaw: -Math.PI / 2 };

/**
 * Wide river crossing the northeast highway arc.
 * Cars cannot drive on the water; the highway bridge crosses above it.
 */
export const RIVER = {
  points: [
    [-280, 1050],
    [40, 960],
    [320, 860],
    [560, 740],
    [780, 560],
    [960, 300],
    [1040, -40],
  ] as [number, number][],
  /** Water surface half-width (meters). */
  halfWidth: 58,
  /** Sandy/rocky bank beyond the water. */
  bankExtra: 32,
};

/** How high the bridge deck sits above the local river banks. */
export const BRIDGE_CLEARANCE = 16;
/** Half-width of the driveable bridge deck (matches highway). */
export const BRIDGE_HALF = 15;
/** Length of each on/off ramp along the highway (long gentle slopes). */
export const BRIDGE_RAMP = 280;

export type RoadDef = {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  width: number;
  /** 1 = pavement. Lower = dirt. */
  grip: number;
  /** Drawn on the minimap as highway when true. */
  highway?: boolean;
};

/** Loose or slick ground. Wet sits on the main road. Mud and ice are off to the side. */
export const PATCHES: { name: string; x: number; z: number; hx: number; hz: number; mu: number; max: number }[] = [
  { name: "Wet", x: 90, z: 0, hx: 55, hz: 11, mu: 0.85, max: 78 },
  { name: "Mud", x: -170, z: 70, hx: 24, hz: 16, mu: 0.42, max: 22 },
  { name: "Ice", x: 210, z: -36, hx: 30, hz: 18, mu: 0.28, max: 28 },
  ...ZONE_PATCHES,
];

/** Waypoints for a smooth road ribbon (xz). Curves follow hills via heightAt. */
export type PathDef = {
  points: [number, number][];
  width: number;
  grip: number;
  highway?: boolean;
  closed?: boolean;
  /**
   * Stay on terrain even under elevated decks (underpasses / at-grade merges).
   * Ribbon + road samples ignore bridge/skyway height.
   */
  atGrade?: boolean;
};

/** Town cross + ring + dirt spur + lake spur. Widths are ~2 lanes (~7m/lane). */
export const PATHS: PathDef[] = [
  {
    points: [
      [-420, 0],
      [-220, 8],
      [-80, 0],
      [40, -6],
      [180, 4],
      [420, 0],
    ],
    width: 14,
    grip: 1,
  },
  {
    points: [
      [0, -420],
      [-6, -220],
      [0, -80],
      [6, 40],
      [-4, 180],
      [0, 420],
    ],
    width: 14,
    grip: 1,
  },
  {
    points: [
      [-260, -260],
      [-80, -250],
      [80, -245],
      [260, -260],
      [270, -80],
      [255, 80],
      [260, 260],
      [80, 270],
      [-80, 255],
      [-260, 260],
      [-270, 80],
      [-255, -80],
      [-260, -260],
    ],
    width: 12,
    grip: 1,
    closed: true,
  },
  {
    // Dirt spur → cul-de-sac turnaround (no dead end into grass).
    points: [
      [-110, 70],
      [-170, 120],
      [-240, 170],
      [-300, 210],
      [-320, 240],
      [-300, 270],
      [-270, 250],
      [-290, 220],
      [-300, 210],
    ],
    width: 8,
    grip: 0.7,
  },
  {
    // Lake spur loops back onto the town ring (no dead end).
    points: [
      [90, -70],
      [160, -140],
      [240, -210],
      [300, -260],
      [280, -280],
      [250, -270],
      [255, -250],
      [260, -260],
    ],
    width: 12,
    grip: 1,
  },
];

/** Giant highway loop — 4 lanes each way (~3.7m × 8 ≈ 30 m). */
const HWY_R = 820;
export const HIGHWAY: PathDef = {
  points: Array.from({ length: 64 }, (_, i) => {
    const a = (i / 64) * Math.PI * 2;
    const bulge = 1 + 0.08 * Math.sin(a * 2);
    return [Math.cos(a) * HWY_R * bulge, Math.sin(a) * HWY_R * bulge] as [number, number];
  }),
  width: 30,
  grip: 1,
  highway: true,
  closed: true,
};

/**
 * On/off ramps tying the town cross to the highway.
 * Merge alongside the ring at grade (before the river bridge climb) — never
 * head-on into the elevated deck. Bridge height is only on HIGHWAY itself.
 */
export const RAMPS: PathDef[] = [
  {
    // East town → NE highway, merge northbound south of the bridge strip (same direction).
    points: [
      [420, 0],
      [510, 15],
      [600, 30],
      [680, 42],
      [740, 50],
      [780, 55],
      [810, 60],
      [825, 68],
      [828, 78],
    ],
    width: 10,
    grip: 1,
    highway: true,
    atGrade: true,
  },
  {
    // North town → NW highway, merge westbound past the bridge strip (same direction).
    points: [
      [0, 420],
      [20, 510],
      [30, 580],
      [10, 640],
      [-50, 690],
      [-110, 725],
      [-170, 750],
      [-210, 765],
    ],
    width: 10,
    grip: 1,
    highway: true,
    atGrade: true,
  },
  {
    points: [
      [-420, 0],
      [-520, -30],
      [-650, -100],
      [-740, -260],
      [-800, -420],
    ],
    width: 10,
    grip: 1,
    highway: true,
    atGrade: true,
  },
  {
    points: [
      [0, -420],
      [-40, -530],
      [-140, -660],
      [-300, -760],
      [-500, -810],
    ],
    width: 10,
    grip: 1,
    highway: true,
    atGrade: true,
  },
];

/**
 * Local road under the river bridge — stays at grade between the pillars.
 * Crosses the north span on dry bank (not through the river); does not climb onto the deck.
 */
export const BRIDGE_UNDERPASS: PathDef = {
  points: [
    [80, 680],
    [95, 740],
    [108, 790],
    [112, 830],
    [114, 860],
  ],
  width: 10,
  grip: 1,
  atGrade: true,
};

/** Trail + speed-track + skyway-ramp paths for ribbons / physics.
 * Skyway deck is elevated (see SKYWAY_SAMPLES) — ramps only get at-grade ribbons;
 * the raised deck/ramp meshes live in worldBuild.addSkyway. */
export const EXTRA_PATHS: PathDef[] = [
  BRIDGE_UNDERPASS,
  // Dirt trails stay at grade even when they pass under the skyway footprint.
  ...TRAILS.map(({ points, width, grip, closed, highway }) => ({
    points,
    width,
    grip,
    closed,
    highway,
    atGrade: true,
  })),
  ...speedTrackPaths(),
  // Skyway ramp *ribbons* stay at grade; raised ramp meshes live in addSkyway.
  ...skywayPaths().ramps.map((r) => ({ ...r, atGrade: true })),
];

/** Flat segment list for physics / minimap (built from paths). */
export const ROADS: RoadDef[] = (() => {
  const out: RoadDef[] = [];
  const add = (path: PathDef) => {
    const pts = path.closed ? [...path.points, path.points[0]] : path.points;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, z1] = pts[i];
      const [x2, z2] = pts[i + 1];
      out.push({ x1, z1, x2, z2, width: path.width, grip: path.grip, highway: path.highway });
    }
  };
  for (const path of PATHS) add(path);
  add(HIGHWAY);
  for (const ramp of RAMPS) add(ramp);
  for (const path of EXTRA_PATHS) add(path);
  return out;
})();

/** Catmull-Rom samples along a path centerline (xz only). */
export function samplePathXZ(path: PathDef, samples: number): { x: number; z: number }[] {
  const pts = path.points;
  if (pts.length < 2) return [];
  const closed = Boolean(path.closed);
  const ring = closed ? [...pts, pts[0], pts[1]] : pts;
  const out: { x: number; z: number }[] = [];
  const segs = closed ? pts.length : pts.length - 1;
  for (let s = 0; s < samples; s++) {
    const u = s / (samples - (closed ? 0 : 1) || 1);
    const f = u * segs;
    const i = Math.min(segs - 1, Math.floor(f));
    const t = f - i;
    const p0 = ring[i];
    const p1 = ring[i + 1];
    const p2 = ring[Math.min(ring.length - 1, i + 2)];
    const pm = ring[Math.max(0, i - 1 + (closed && i === 0 ? pts.length : 0))];
    const a = closed || i > 0 ? pm : p0;
    const b = p0;
    const c = p1;
    const d = closed || i < segs - 1 ? p2 : p1;
    const t2 = t * t;
    const t3 = t2 * t;
    const x =
      0.5 *
      (2 * b[0] +
        (-a[0] + c[0]) * t +
        (2 * a[0] - 5 * b[0] + 4 * c[0] - d[0]) * t2 +
        (-a[0] + 3 * b[0] - 3 * c[0] + d[0]) * t3);
    const z =
      0.5 *
      (2 * b[1] +
        (-a[1] + c[1]) * t +
        (2 * a[1] - 5 * b[1] + 4 * c[1] - d[1]) * t2 +
        (-a[1] + 3 * b[1] - 3 * c[1] + d[1]) * t3);
    out.push({ x, z });
  }
  if (closed && out.length) out.pop();
  return out;
}

type RoadSample = { x: number; z: number; h: number; half: number; shoulder: number };

/** Closest point on a polyline (xz). */
export function closestOnPolyline(x: number, z: number, points: [number, number][]) {
  let best = { d: 1e9, x, z, t: 0, seg: 0, nx: 1, nz: 0 };
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, z1] = points[i];
    const [x2, z2] = points[i + 1];
    const dx = x2 - x1;
    const dz = z2 - z1;
    const l2 = dx * dx + dz * dz || 1;
    let t = ((x - x1) * dx + (z - z1) * dz) / l2;
    t = Math.max(0, Math.min(1, t));
    const px = x1 + t * dx;
    const pz = z1 + t * dz;
    const d = Math.hypot(x - px, z - pz);
    if (d < best.d) {
      const len = Math.hypot(dx, dz) || 1;
      best = { d, x: px, z: pz, t, seg: i, nx: -dz / len, nz: dx / len };
    }
  }
  return best;
}

export function riverDistance(x: number, z: number) {
  const hit = closestOnPolyline(x, z, RIVER.points);
  return {
    d: hit.d,
    cx: hit.x,
    cz: hit.z,
    nx: hit.nx,
    nz: hit.nz,
    half: RIVER.halfWidth,
    bank: RIVER.halfWidth + RIVER.bankExtra,
  };
}

export function inRiverWater(x: number, z: number) {
  return riverDistance(x, z).d < RIVER.halfWidth;
}

function hash2(x: number, z: number) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function smoothNoise(x: number, z: number) {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const fx = x - x0;
  const fz = z - z0;
  const u = fx * fx * (3 - 2 * fx);
  const v = fz * fz * (3 - 2 * fz);
  const a = hash2(x0, z0);
  const b = hash2(x0 + 1, z0);
  const c = hash2(x0, z0 + 1);
  const d = hash2(x0 + 1, z0 + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x: number, z: number) {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < 4; i++) {
    sum += smoothNoise(x * freq, z * freq) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.05;
  }
  return sum / norm;
}

/** Raw rolling hills (before road flattening / bridge). */
export function rawHeight(x: number, z: number): number {
  const n = fbm(x * 0.0042, z * 0.0042);
  const ridge = fbm(x * 0.0018 + 20, z * 0.0018 - 11);
  let h = (n - 0.45) * 22 + (ridge - 0.5) * 14;
  h += Math.sin(x * 0.006) * 3 + Math.cos(z * 0.0055) * 2.5;
  const town = Math.hypot(x, z);
  if (town < 320) h *= 0.25 + 0.75 * (town / 320);
  const ld = Math.hypot(x - LAKE.x, z - LAKE.z);
  if (ld < LAKE.r + 40) {
    const t = Math.max(0, (ld - LAKE.r) / 40);
    h = h * t - (1 - t) * 1.2;
  }
  // Carve a wide river bed with gentle banks.
  const river = riverDistance(x, z);
  if (river.d < river.bank) {
    const bed = -2.8;
    const waterEdge = river.half * 0.92;
    if (river.d < waterEdge) {
      const u = river.d / Math.max(0.1, waterEdge);
      const carve = 1 - u * u * 0.15;
      h = bed * carve + h * (1 - carve) * 0.15;
    } else {
      const u = (river.d - waterEdge) / Math.max(0.1, river.bank - waterEdge);
      const carve = 1 - u * u * (3 - 2 * u);
      h = h * (1 - carve * 0.85) + bed * carve * 0.55;
    }
  }
  return h;
}

type BridgeSample = {
  x: number;
  z: number;
  /** Absolute deck / ramp height. */
  h: number;
  /** 0 at ramp toes, 1 on the high deck. */
  lift: number;
  tx: number;
  tz: number;
};

/**
 * Dense, heavily longitudinally smoothed road centerline heights (at grade).
 * Wide averaging kills rapid bumps so roads are long gentle slopes.
 * Bridge deck height is applied separately so terrain stays low under the span.
 */
const ROAD_SAMPLES: RoadSample[] = (() => {
  const samples: RoadSample[] = [];
  const smoothSeries = (raw: number[], win: number, closed: boolean) => {
    const out = raw.slice();
    // Two passes of a wide moving average for long, gentle grades.
    for (let pass = 0; pass < 2; pass++) {
      const src = out.slice();
      for (let i = 0; i < src.length; i++) {
        let sum = 0;
        let count = 0;
        for (let k = -win; k <= win; k++) {
          let j = i + k;
          if (closed) j = (j + src.length) % src.length;
          else j = Math.max(0, Math.min(src.length - 1, j));
          // Hann-ish weight — center matters more, but still very wide.
          const w = 0.5 + 0.5 * Math.cos((k / Math.max(1, win)) * Math.PI);
          sum += src[j] * w;
          count += w;
        }
        out[i] = sum / count;
      }
    }
    return out;
  };
  const addPath = (path: PathDef) => {
    const n = path.highway ? 200 : path.closed ? 140 : 100;
    const pts = samplePathXZ(path, n);
    if (pts.length < 2) return;
    const raw = pts.map((p) => rawHeight(p.x, p.z));
    // ~80–120 m window so hills become one long slope, not waves.
    const win = path.highway ? 18 : path.closed ? 14 : 12;
    const smooth = smoothSeries(raw, win, Boolean(path.closed));
    const half = path.width * 0.5;
    const shoulder = half + (path.highway ? 18 : 14);
    for (let i = 0; i < pts.length; i++) {
      samples.push({ x: pts[i].x, z: pts[i].z, h: smooth[i], half, shoulder });
    }
  };
  for (const path of PATHS) addPath(path);
  addPath(HIGHWAY);
  // At-grade connectors (on-ramps / underpass) must not flatten or raise the
  // pavement grade — that contaminated bridge toes and created false ski-jumps.
  for (const ramp of RAMPS) if (!ramp.atGrade) addPath(ramp);
  for (const path of EXTRA_PATHS) if (!path.atGrade) addPath(path);

  // Unify heights where roads meet so intersections are one continuous surface
  // (stops seam bumps / lighter overlap patches from mismatched path grades).
  const out = samples.map((s) => ({ ...s }));
  const n = samples.length;
  for (let i = 0; i < n; i++) {
    let sum = samples[i].h;
    let w = 1;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const d = Math.hypot(samples[i].x - samples[j].x, samples[i].z - samples[j].z);
      const r = Math.max(samples[i].half, samples[j].half) + 6;
      if (d >= r) continue;
      const t = 1 - d / r;
      const ww = t * t;
      sum += samples[j].h * ww;
      w += ww;
    }
    out[i].h = sum / w;
  }
  return out;
})();

/** Raised highway bridge samples (ramps + deck) over the river. */
export const BRIDGE_SAMPLES: BridgeSample[] = (() => {
  const hwy = samplePathXZ(HIGHWAY, 280);
  if (hwy.length < 4) return [];
  const total = hwy.length;
  const wet = hwy.map((p) => riverDistance(p.x, p.z).d < RIVER.halfWidth + 40);
  // Largest contiguous wet run (handle wrap on the closed loop).
  let bestS = 0;
  let bestLen = 0;
  for (let start = 0; start < total; start++) {
    if (!wet[start]) continue;
    if (wet[(start - 1 + total) % total]) continue; // not a run start
    let len = 0;
    while (wet[(start + len) % total] && len < total) len++;
    if (len > bestLen) {
      bestLen = len;
      bestS = start;
    }
  }
  if (bestLen < 2) return [];
  const bestE = bestS + bestLen - 1;

  // Deck height from banks beside the river crossing (not the carved bed).
  let bankH = 0;
  let bankN = 0;
  for (let i = 0; i < bestLen; i++) {
    const p = hwy[(bestS + i) % total];
    const riv = riverDistance(p.x, p.z);
    bankH += rawHeight(p.x + riv.nx * (riv.half + 22), p.z + riv.nz * (riv.half + 22));
    bankN++;
  }
  const deckH = (bankN ? bankH / bankN : 2) + BRIDGE_CLEARANCE;

  // Walk backward/forward along the highway by real distance for long ramps.
  const stepBack = (from: number, dist: number) => {
    let left = dist;
    let i = from;
    while (left > 0) {
      const prev = (i - 1 + total) % total;
      const ds = Math.hypot(hwy[i].x - hwy[prev].x, hwy[i].z - hwy[prev].z);
      left -= ds;
      i = prev;
      if (i === from) break;
    }
    return i;
  };
  const stepFwd = (from: number, dist: number) => {
    let left = dist;
    let i = from;
    while (left > 0) {
      const next = (i + 1) % total;
      const ds = Math.hypot(hwy[next].x - hwy[i].x, hwy[next].z - hwy[i].z);
      left -= ds;
      i = next;
      if (i === from) break;
    }
    return i;
  };
  const toeA = stepBack(bestS, BRIDGE_RAMP);
  const toeB = stepFwd(bestE % total, BRIDGE_RAMP);

  // Collect indices from toeA → deck → toeB along the short arc.
  const indices: number[] = [];
  {
    let i = toeA;
    indices.push(i);
    let guard = 0;
    while (i !== toeB && guard < total) {
      i = (i + 1) % total;
      indices.push(i);
      guard++;
    }
  }

  // Arc-length along the bridge strip for smooth ramp profiles.
  const dist = [0];
  for (let k = 1; k < indices.length; k++) {
    const a = hwy[indices[k - 1]];
    const b = hwy[indices[k]];
    dist.push(dist[k - 1] + Math.hypot(b.x - a.x, b.z - a.z));
  }
  const totalDist = dist[dist.length - 1] || 1;
  const ramp = Math.min(BRIDGE_RAMP, totalDist * 0.35);

  const out: BridgeSample[] = [];
  for (let k = 0; k < indices.length; k++) {
    const idx = indices[k];
    const p = hwy[idx];
    const prev = hwy[(idx - 1 + total) % total];
    const next = hwy[(idx + 1) % total];
    let tx = next.x - prev.x;
    let tz = next.z - prev.z;
    const len = Math.hypot(tx, tz) || 1;
    tx /= len;
    tz /= len;
    const along = dist[k];
    let lift = 1;
    if (along < ramp) {
      const u = along / ramp;
      lift = u * u * (3 - 2 * u);
    } else if (along > totalDist - ramp) {
      const u = (totalDist - along) / ramp;
      lift = u * u * (3 - 2 * u);
    }
    // Ramp toes sit on the smoothed at-grade highway, not the river bed.
    const ground = (() => {
      // Prefer nearby ROAD_SAMPLES height if present.
      let best = rawHeight(p.x, p.z);
      let bestD = 1e9;
      for (const s of ROAD_SAMPLES) {
        const d = Math.hypot(p.x - s.x, p.z - s.z);
        if (d < bestD && d < 40) {
          bestD = d;
          best = s.h;
        }
      }
      return best;
    })();
    const base = Math.max(ground, deckH - BRIDGE_CLEARANCE);
    const h = base + (deckH - base) * lift;
    out.push({ x: p.x, z: p.z, h, lift, tx, tz });
  }
  return out;
})();

/** Ground / terrain height (roads at grade, river carved). No bridge deck. */
export function terrainHeightAt(x: number, z: number): number {
  let h = rawHeight(x, z);
  let wSum = 0;
  let hSum = 0;
  let minD = 1e9;
  let minHalf = 8;
  let minShoulder = 18;
  for (const s of ROAD_SAMPLES) {
    const d = Math.hypot(x - s.x, z - s.z);
    if (d >= s.shoulder) continue;
    const fall = 1 - d / s.shoulder;
    const w = fall * fall * fall; // sharper center weight → flatter pavement
    wSum += w;
    hSum += s.h * w;
    if (d < minD) {
      minD = d;
      minHalf = s.half;
      minShoulder = s.shoulder;
    }
  }
  if (wSum > 0) {
    const roadH = hSum / wSum;
    // Fully flatten under the pavement; blend only in the outer shoulder.
    const edge = minHalf * 1.02;
    const u = Math.max(0, Math.min(1, (minD - edge) / Math.max(0.2, minShoulder - edge)));
    const flatAmt = 1 - u * u * (3 - 2 * u);
    h = roadH * flatAmt + h * (1 - flatAmt);
  }
  const sd = Math.hypot(x - SPAWN.x, z - SPAWN.z);
  if (sd < 50) {
    const t = sd / 50;
    h = h * (t * t * (3 - 2 * t));
  }
  return h;
}

/**
 * Bridge deck / ramp height if (x,z) is on the bridge footprint, else null.
 * Note: the same xz under the span also matches — callers that place cars must
 * use car vertical state so vehicles under the deck stay on the ground.
 */
export function bridgeHeightAt(x: number, z: number): number | null {
  if (!BRIDGE_SAMPLES.length) return null;
  let bestD = 1e9;
  let bestH = 0;
  for (const s of BRIDGE_SAMPLES) {
    const d = Math.hypot(x - s.x, z - s.z);
    if (d < bestD) {
      bestD = d;
      bestH = s.h;
    }
  }
  const half = BRIDGE_HALF + 1.2;
  if (bestD > half) return null;
  return bestH;
}

/** Elevated skyway deck + ramp samples (outside the highway ring). */
export const SKYWAY_SAMPLES: BridgeSample[] = (() => {
  const { deck, ramps } = skywayPaths();
  const out: BridgeSample[] = [];
  const h = SKYWAY.height + SKYWAY.deckThick * 0.5;
  const deckPts = samplePathXZ(deck, 220);
  for (let i = 0; i < deckPts.length; i++) {
    const p = deckPts[i];
    const next = deckPts[(i + 1) % deckPts.length];
    const dx = next.x - p.x;
    const dz = next.z - p.z;
    const len = Math.hypot(dx, dz) || 1;
    out.push({ x: p.x, z: p.z, h, lift: 1, tx: dx / len, tz: dz / len });
  }
  for (const ramp of ramps) {
    const n = ramp.points.length;
    for (let i = 0; i < n; i++) {
      const [x, z] = ramp.points[i];
      const t = i / Math.max(1, n - 1); // 0 = skyway end, 1 = highway
      const u = t * t * (3 - 2 * t); // gentle smoothstep (≤~6% over rampLength)
      const ground = rawHeight(x, z);
      const yh = h * (1 - u) + ground * u;
      const next = ramp.points[Math.min(n - 1, i + 1)];
      const dx = next[0] - x;
      const dz = next[1] - z;
      const len = Math.hypot(dx, dz) || 1;
      out.push({ x, z, h: yh, lift: 1 - u, tx: dx / len, tz: dz / len });
    }
  }
  return out;
})();

export function skywayHeightAt(x: number, z: number): number | null {
  if (!SKYWAY_SAMPLES.length) return null;
  let bestD = 1e9;
  let bestH = 0;
  let bestLift = 0;
  for (const s of SKYWAY_SAMPLES) {
    const d = Math.hypot(x - s.x, z - s.z);
    if (d < bestD) {
      bestD = d;
      bestH = s.h;
      bestLift = s.lift;
    }
  }
  // Wider footprint on the high deck; narrower on ramp toes.
  const half = SKYWAY.width * 0.5 + 1.5 + bestLift * 2;
  if (bestD > half) return null;
  return bestH;
}

/** Bridge or skyway elevated deck height, if any. */
export function elevatedHeightAt(x: number, z: number): number | null {
  const bridge = bridgeHeightAt(x, z);
  if (bridge != null) return bridge;
  return skywayHeightAt(x, z);
}

export function onBridge(x: number, z: number) {
  return bridgeHeightAt(x, z) != null;
}

/**
 * Driveable / ribbon surface height (includes the raised highway bridge + skyway).
 * Terrain meshes should use terrainHeightAt so the river stays visible under the span.
 */
export function heightAt(x: number, z: number): number {
  const elev = elevatedHeightAt(x, z);
  if (elev != null) return elev;
  return terrainHeightAt(x, z);
}

/**
 * Height for a car that already has a vertical position.
 * If the car is near the deck, stick to the deck; if it is clearly under the
 * span, use the ground so trucks never float on invisible bridge height.
 */
export function carSurfaceHeight(x: number, z: number, carY: number): number {
  const ground = terrainHeightAt(x, z);
  const deck = elevatedHeightAt(x, z);
  if (deck == null) return ground;
  // Near or above the deck → drive on the bridge/skyway. Well below → under the span.
  if (carY > deck - 4.5) return deck;
  return ground;
}

/** Nearest road half-width + distance at (x,z). Used to place signs off the pavement. */
export function nearestRoadClearance(x: number, z: number) {
  let best = { d: 1e9, half: 8 };
  for (const s of ROAD_SAMPLES) {
    const d = Math.hypot(x - s.x, z - s.z);
    if (d < best.d) best = { d, half: s.half };
  }
  // Also respect bridge footprint.
  for (const s of BRIDGE_SAMPLES) {
    const d = Math.hypot(x - s.x, z - s.z);
    if (d < best.d) best = { d, half: BRIDGE_HALF };
  }
  return best;
}

/** Average height under the car's four wheels. */
export function wheelHeights(x: number, z: number, yaw: number, axle = 1.35, track = 0.85) {
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const rx = Math.cos(yaw);
  const rz = -Math.sin(yaw);
  const fl = heightAt(x + fx * axle - rx * track, z + fz * axle - rz * track);
  const fr = heightAt(x + fx * axle + rx * track, z + fz * axle + rz * track);
  const rl = heightAt(x - fx * axle - rx * track, z - fz * axle - rz * track);
  const rr = heightAt(x - fx * axle + rx * track, z - fz * axle + rz * track);
  return { fl, fr, rl, rr, y: (fl + fr + rl + rr) * 0.25 };
}
