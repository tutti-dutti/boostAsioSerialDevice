/**
 * WORLD-BUILD layout: forests, trails, mud park, speed track, skyway, landmarks.
 * Kept separate from core mapData so the base town/highway stay readable.
 * (No import from mapData — avoids circular deps.)
 */

export type PathDef = {
  points: [number, number][];
  width: number;
  grip: number;
  highway?: boolean;
  closed?: boolean;
};

export type ForestZone = {
  id: string;
  x: number;
  z: number;
  r: number;
  density: number;
};

/** Dense forests — corners plus a giant pine plain east of town. */
export const FORESTS: ForestZone[] = [
  { id: "pine-northwest", x: -780, z: 720, r: 220, density: 1 },
  { id: "leafy-southeast", x: 760, z: -740, r: 210, density: 1 },
  { id: "mixed-southwest", x: -740, z: -760, r: 200, density: 0.95 },
  // Giant pine plain (open grass → packed pines + trails + clearing).
  { id: "pine-east-plain", x: 520, z: 380, r: 280, density: 1.35 },
];

export type TrailGrade = "easy" | "medium" | "hard";

export type TrailDef = PathDef & {
  grade: TrailGrade;
  name: string;
};

/** Dirt trails through forests → mud park. grip 0.7 = Dirt surface. */
export const TRAILS: TrailDef[] = [
  {
    name: "Pine Easy",
    grade: "easy",
    width: 7,
    grip: 0.7,
    // Starts on the west EW-road tip so the dirt ribbon meets pavement cleanly.
    points: [
      [-420, 0],
      [-420, 80],
      [-420, 200],
      [-520, 320],
      [-620, 480],
      [-700, 600],
      [-780, 700],
      [-820, 780],
    ],
  },
  {
    name: "Pine Medium",
    grade: "medium",
    width: 6,
    grip: 0.68,
    // Ends on Pine Easy so the trails join with no grass gap.
    points: [
      [-780, 700],
      [-860, 640],
      [-900, 540],
      [-840, 420],
      [-720, 360],
      [-600, 300],
      [-480, 220],
      [-420, 200],
    ],
  },
  {
    name: "Ridge Hard",
    grade: "hard",
    width: 5.2,
    grip: 0.65,
    points: [
      [-820, 780],
      [-900, 820],
      [-960, 760],
      [-940, 680],
      [-860, 720],
      [-780, 760],
    ],
  },
  {
    name: "Crosslink",
    grade: "easy",
    width: 7,
    grip: 0.7,
    points: [
      [-600, 300],
      [-400, 80],
      [-280, -40],
      [-200, -180],
      [-120, -320],
      [40, -420],
      [200, -520],
      [400, -620],
      [600, -700],
      [740, -740],
    ],
  },
  {
    name: "Leafy Loop",
    grade: "medium",
    width: 6,
    grip: 0.68,
    points: [
      [740, -740],
      [820, -800],
      [880, -720],
      [820, -640],
      [740, -680],
      [700, -760],
    ],
  },
  {
    name: "SW Hard",
    grade: "hard",
    width: 5,
    grip: 0.64,
    points: [
      [-740, -760],
      [-820, -820],
      [-900, -780],
      [-860, -700],
      [-780, -720],
      [-720, -800],
    ],
  },
  {
    name: "Park Spur",
    grade: "easy",
    width: 8,
    grip: 0.7,
    // Mouth on the EW road / ring so mud-park dirt meets asphalt.
    points: [
      [-200, 0],
      [-210, -40],
      [-260, -120],
      [-300, -220],
      [-280, -320],
      [-220, -380],
    ],
  },
  {
    name: "East Pine Trail",
    grade: "easy",
    width: 7,
    grip: 0.7,
    points: [
      [280, 200],
      [360, 280],
      [480, 360],
      [520, 380],
      [600, 400],
      [720, 420],
    ],
  },
  {
    name: "East Pine Loop",
    grade: "medium",
    width: 6,
    grip: 0.68,
    points: [
      [520, 380],
      [560, 320],
      [600, 360],
      [560, 440],
      [500, 420],
      [520, 380],
    ],
    closed: true,
  },
];

/** Mud park open area (SW of town, inside highway). */
export const MUD_PARK = {
  x: -240,
  z: -380,
  hx: 90,
  hz: 70,
  entrance: { x: -160, z: -300 },
};

/** Speed track: ~8 km east–west corridor north of the core map. */
export const SPEED_TRACK = {
  x0: -4000,
  z0: 2200,
  x1: 4000,
  z: 2200,
  width: 16,
};

/** Skyway ring outside the highway. */
export const SKYWAY = {
  radius: 1050,
  height: 36,
  /** ~4 lanes each way. */
  width: 32,
  pillarEvery: 36,
  /** Concrete deck thickness (meters). */
  deckThick: 2.0,
  /** Minimum ramp run for ≤6% grade to deck height. */
  rampLength: 620,
};

export type LandmarkKind = "restaurant" | "carwash" | "park" | "speed" | "forest" | "dealership";

export type Landmark = {
  id: string;
  kind: LandmarkKind;
  label: string;
  x: number;
  z: number;
  /** Parking / trigger half-extents */
  hx: number;
  hz: number;
};

/** Town dealership / garage showroom (north of the west EW road). */
export const DEALERSHIP = {
  x: -195,
  z: 48,
  /** Spawn inside, facing the south doors toward the road. */
  spawnYaw: Math.PI,
  drivewayZ0: 28,
  drivewayZ1: 0,
};

export const LANDMARKS: Landmark[] = [
  { id: "garage", kind: "dealership", label: "Garage", x: DEALERSHIP.x, z: DEALERSHIP.z, hx: 18, hz: 16 },
  { id: "pizza", kind: "restaurant", label: "Pizza Shop", x: 70, z: 28, hx: 12, hz: 10 },
  { id: "pho", kind: "restaurant", label: "Phở Shop", x: 110, z: 28, hx: 12, hz: 10 },
  { id: "banhmi", kind: "restaurant", label: "Bánh Mì Shop", x: 150, z: 28, hx: 12, hz: 10 },
  { id: "wash", kind: "carwash", label: "Car Wash", x: -100, z: 55, hx: 10, hz: 14 },
  { id: "mudpark", kind: "park", label: "Off-Road Park", x: MUD_PARK.x, z: MUD_PARK.z, hx: 20, hz: 16 },
  { id: "speed", kind: "speed", label: "Speed Track", x: SPEED_TRACK.x0, z: SPEED_TRACK.z0, hx: 18, hz: 14 },
];

/** Extra mud patches for trails + park (merged into PATCHES by mapData). */
export const ZONE_PATCHES: { name: string; x: number; z: number; hx: number; hz: number; mu: number; max: number }[] = [
  // Mud park pits
  { name: "Mud", x: -260, z: -360, hx: 28, hz: 18, mu: 0.32, max: 14 },
  { name: "Mud", x: -220, z: -400, hx: 22, hz: 20, mu: 0.28, max: 11 },
  { name: "Mud", x: -280, z: -410, hx: 18, hz: 14, mu: 0.25, max: 9 },
  // Trail mud
  { name: "Mud", x: -700, z: 600, hx: 16, hz: 12, mu: 0.35, max: 16 },
  { name: "Mud", x: -500, z: 280, hx: 14, hz: 10, mu: 0.38, max: 18 },
  { name: "Mud", x: 200, z: -520, hx: 14, hz: 10, mu: 0.36, max: 16 },
  { name: "Mud", x: 740, z: -700, hx: 16, hz: 12, mu: 0.34, max: 15 },
  { name: "Mud", x: -780, z: -740, hx: 14, hz: 11, mu: 0.33, max: 14 },
];

/** Speed track path + turnaround loops + highway connector. */
export function speedTrackPaths(): PathDef[] {
  const z = SPEED_TRACK.z0;
  const x0 = SPEED_TRACK.x0;
  const x1 = SPEED_TRACK.x1;
  const w = SPEED_TRACK.width;
  const straight: PathDef = {
    points: [
      [x0, z],
      [-2000, z],
      [0, z],
      [2000, z],
      [x1, z],
    ],
    width: w,
    grip: 1,
    highway: true,
  };
  const loop = (cx: number, cz: number, r: number): PathDef => {
    const pts: [number, number][] = [];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
    }
    return { points: pts, width: w, grip: 1, highway: true, closed: true };
  };
  // From north highway arc up to the speed corridor.
  const ramp: PathDef = {
    points: [
      [0, 820],
      [40, 1100],
      [80, 1500],
      [40, 1900],
      [0, z],
    ],
    width: 10,
    grip: 1,
    highway: true,
  };
  return [straight, loop(x0, z, 100), loop(x1, z, 100), ramp];
}

/** Match mapData HIGHWAY ring (must stay in sync — no import, avoids cycles). */
function highwayRingXZ(a: number): { x: number; z: number; rad: number } {
  const hwyR = 820;
  const bulge = 1 + 0.08 * Math.sin(a * 2);
  const rad = hwyR * bulge;
  return { x: Math.cos(a) * rad, z: Math.sin(a) * rad, rad };
}

/** Skyway closed loop + 4 ramps down to highway. */
export function skywayPaths(): { deck: PathDef; ramps: PathDef[] } {
  const r = SKYWAY.radius;
  const pts: [number, number][] = Array.from({ length: 72 }, (_, i) => {
    const a = (i / 72) * Math.PI * 2;
    const bulge = 1 + 0.04 * Math.sin(a * 3);
    return [Math.cos(a) * r * bulge, Math.sin(a) * r * bulge];
  });
  const deck: PathDef = {
    points: pts,
    width: SKYWAY.width,
    grip: 1,
    highway: true,
    closed: true,
  };
  // Four long ramps (≥300 m path, ≤~6% grade) from highway up to skyway.
  // Paths track OUTSIDE the bulged highway ring so they never cut through a lane.
  const rampLen = SKYWAY.rampLength;
  const hwyR = 820;
  const hwyHalf = 15;
  const rampHalf = 7;
  /** Clear air between highway pavement edge and ramp centerline. */
  const mergeGap = 5;
  const ramps: PathDef[] = [0, 1, 2, 3].map((i) => {
    const a0 = (i / 4) * Math.PI * 2 + 0.25;
    const sweep = rampLen / ((hwyR + r) * 0.5);
    const pts: [number, number][] = [];
    const steps = 28;
    for (let s = 0; s <= steps; s++) {
      const u = s / steps; // 0 = skyway deck, 1 = highway merge
      const ang = a0 + sweep * u;
      const skyRad = r * (1 + 0.04 * Math.sin(ang * 3));
      const hwy = highwayRingXZ(ang);
      // Stay outside the pavement: highway edge + gap + half ramp width.
      const minOutside = hwy.rad + hwyHalf + mergeGap + rampHalf;
      // Blend skyway → merge; clamp so the spiral can never cross the ring.
      const target = skyRad * (1 - u) + minOutside * u;
      const rad = u < 0.15 ? target : Math.max(target, minOutside);
      pts.push([Math.cos(ang) * rad, Math.sin(ang) * rad]);
    }
    return {
      points: pts,
      width: 14, // ≥2 lanes
      grip: 1,
      highway: true,
    };
  });
  return { deck, ramps };
}
