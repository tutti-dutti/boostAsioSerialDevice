/** Roads, lake, terrain height, highway, and spawn. The minimap uses this too. */

export const WORLD_HALF = 1100;
export const LAKE = { x: 320, z: -300, r: 48 };
export const SPAWN = { x: -70, z: 4, yaw: Math.PI / 2 };

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
];

/** Waypoints for a smooth road ribbon (xz). Curves follow hills via heightAt. */
export type PathDef = {
  points: [number, number][];
  width: number;
  grip: number;
  highway?: boolean;
  closed?: boolean;
};

/** Town cross + ring + dirt spur + lake spur. */
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
    width: 16,
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
    width: 16,
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
    width: 14,
    grip: 1,
    closed: true,
  },
  {
    points: [
      [-110, 70],
      [-170, 120],
      [-240, 170],
      [-300, 210],
    ],
    width: 8,
    grip: 0.7,
  },
  {
    points: [
      [90, -70],
      [160, -140],
      [240, -210],
      [300, -260],
    ],
    width: 11,
    grip: 1,
  },
];

/** Giant highway loop — 4 lanes each way (~28 m wide). */
const HWY_R = 820;
export const HIGHWAY: PathDef = {
  points: Array.from({ length: 48 }, (_, i) => {
    const a = (i / 48) * Math.PI * 2;
    const bulge = 1 + 0.08 * Math.sin(a * 2);
    return [Math.cos(a) * HWY_R * bulge, Math.sin(a) * HWY_R * bulge] as [number, number];
  }),
  width: 28,
  grip: 1,
  highway: true,
  closed: true,
};

/** On/off ramps tying the highway to the town cross. */
export const RAMPS: PathDef[] = [
  {
    points: [
      [420, 0],
      [520, 20],
      [640, 80],
      [720, 200],
      [780, 380],
    ],
    width: 12,
    grip: 1,
    highway: true,
  },
  {
    points: [
      [0, 420],
      [30, 520],
      [120, 640],
      [280, 740],
      [480, 800],
    ],
    width: 12,
    grip: 1,
    highway: true,
  },
  {
    points: [
      [-420, 0],
      [-520, -30],
      [-650, -100],
      [-740, -260],
      [-800, -420],
    ],
    width: 12,
    grip: 1,
    highway: true,
  },
  {
    points: [
      [0, -420],
      [-40, -530],
      [-140, -660],
      [-300, -760],
      [-500, -810],
    ],
    width: 12,
    grip: 1,
    highway: true,
  },
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
  return out;
})();

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

function distToSeg(px: number, pz: number, x1: number, z1: number, x2: number, z2: number) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const l2 = dx * dx + dz * dz || 1;
  let t = ((px - x1) * dx + (pz - z1) * dz) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), pz - (z1 + t * dz));
}

/** Raw rolling hills (before road flattening). */
export function rawHeight(x: number, z: number): number {
  const n = fbm(x * 0.0042, z * 0.0042);
  const ridge = fbm(x * 0.0018 + 20, z * 0.0018 - 11);
  let h = (n - 0.45) * 28 + (ridge - 0.5) * 18;
  h += Math.sin(x * 0.006) * 4 + Math.cos(z * 0.0055) * 3.5;
  // Soft bowl so the town sits a bit lower.
  const town = Math.hypot(x, z);
  if (town < 320) h *= 0.35 + 0.65 * (town / 320);
  // Lake basin.
  const ld = Math.hypot(x - LAKE.x, z - LAKE.z);
  if (ld < LAKE.r + 40) {
    const t = Math.max(0, (ld - LAKE.r) / 40);
    h = h * t - (1 - t) * 1.2;
  }
  return h;
}

/** Terrain height under the car / props. Roads are flattened into a soft corridor. */
export function heightAt(x: number, z: number): number {
  let h = rawHeight(x, z);
  let nearest = 80;
  for (const road of ROADS) {
    const d = distToSeg(x, z, road.x1, road.z1, road.x2, road.z2);
    const pad = road.width * 0.5 + (road.highway ? 10 : 6);
    if (d < pad) nearest = Math.min(nearest, d);
  }
  if (nearest < 80) {
    // Pull toward a gentle average of nearby raw heights so roads stay smooth.
    const blend = Math.max(0, Math.min(1, nearest / 18));
    const flat = rawHeight(x, z) * 0.15 + (rawHeight(x + 8, z) + rawHeight(x - 8, z) + rawHeight(x, z + 8) + rawHeight(x, z - 8)) * 0.1;
    // Strong flatten in the road corridor.
    const roadBlend = Math.max(0, Math.min(1, nearest / (nearest < 14 ? 14 : 22)));
    h = flat * (1 - roadBlend * 0.85) + h * (roadBlend * 0.85);
    void blend;
  }
  // Flatten spawn pad.
  const sd = Math.hypot(x - SPAWN.x, z - SPAWN.z);
  if (sd < 40) {
    const t = sd / 40;
    h = h * t;
  }
  return h;
}

export function groundNormal(x: number, z: number): { nx: number; ny: number; nz: number } {
  const e = 1.2;
  const hx0 = heightAt(x - e, z);
  const hx1 = heightAt(x + e, z);
  const hz0 = heightAt(x, z - e);
  const hz1 = heightAt(x, z + e);
  const nx = hx0 - hx1;
  const nz = hz0 - hz1;
  const ny = e * 2;
  const len = Math.hypot(nx, ny, nz) || 1;
  return { nx: nx / len, ny: ny / len, nz: nz / len };
}
