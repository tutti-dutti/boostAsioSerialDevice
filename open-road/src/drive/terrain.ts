import { BUILDINGS, LAKE, PADS, ROADS, SPAWN, type RoadDef } from "./mapData";

/** Playable half-size. The car stops at this edge. The ground mesh continues a little past it. */
export const WORLD_LIMIT = 1200;
/** Ground mesh extends past the wall so the edge is not a cliff in the fog. */
export const GROUND_HALF = 1500;
/** How far the road mesh sits above the ground, in meters. */
export const ROAD_LIFT = 0.12;

/** Props stream in squares of this size around the car. */
export const CHUNK = 200;
/** Chunks of trees and rocks drawn around the car (Chebyshev distance). */
export const VIEW_RANGE = 4;
/** Only nearby chunks push the car. Far trees are just scenery. */
export const HIT_RANGE = 2;

export const FOG = { color: 0xc5d7e6, near: 180, far: 880 };

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** Rolling hills. Roads follow this so they rise and fall with the ground. */
export function broadHeight(x: number, z: number) {
  return (
    Math.sin(x * 0.0082 + 0.4) * 12 +
    Math.cos(z * 0.0071 - 0.7) * 10 +
    Math.sin(x * 0.0046 + z * 0.0051) * 8 +
    Math.cos(x * 0.0125 + 1.4) * Math.sin(z * 0.011 + 0.6) * 4
  );
}

/** Smaller bumps. These fade out on roads and under buildings. */
function detailHeight(x: number, z: number) {
  return (
    Math.sin(x * 0.016 + 1.3) * Math.cos(z * 0.014 + 0.4) * 2.6 +
    Math.sin(x * 0.037 + z * 0.021) * 1.15
  );
}

export function distToSeg(px: number, pz: number, x1: number, z1: number, x2: number, z2: number) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const l2 = dx * dx + dz * dz || 1;
  let t = ((px - x1) * dx + (pz - z1) * dz) / l2;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (x1 + t * dx), pz - (z1 + t * dz));
}

export function nearestRoad(x: number, z: number): { dist: number; half: number; road: RoadDef } {
  let dist = Infinity;
  let half = 8;
  let road = ROADS[0];
  for (const next of ROADS) {
    const d = distToSeg(x, z, next.x1, next.z1, next.x2, next.z2);
    if (d < dist) {
      dist = d;
      half = next.width / 2;
      road = next;
    }
  }
  return { dist, half, road };
}

/** 1 on a road, 0 once you are well off the shoulder. */
function roadFlat(x: number, z: number) {
  const { dist, half } = nearestRoad(x, z);
  const inner = half + 1.5;
  const outer = half + 26;
  if (dist <= inner) return 1;
  if (dist >= outer) return 0;
  return 1 - smoothstep(inner, outer, dist);
}

function blendPad(h: number, x: number, z: number, cx: number, cz: number, hx: number, hz: number) {
  const dx = Math.abs(x - cx);
  const dz = Math.abs(z - cz);
  const reachX = hx + 10;
  const reachZ = hz + 10;
  if (dx >= reachX || dz >= reachZ) return h;
  const tx = 1 - smoothstep(hx, reachX, dx);
  const tz = 1 - smoothstep(hz, reachZ, dz);
  const t = tx * tz;
  if (t <= 0) return h;
  return lerp(h, broadHeight(cx, cz), t);
}

/** Water surface. The lake bed is flattened to just under this. */
export function lakeLevel() {
  return broadHeight(LAKE.x, LAKE.z) - 0.35;
}

/** Ground height in meters. Continuous, so the car does not pop between chunks. */
export function terrainHeight(x: number, z: number) {
  const flat = roadFlat(x, z);
  let h = broadHeight(x, z) + detailHeight(x, z) * (1 - flat);

  for (const b of BUILDINGS) {
    h = blendPad(h, x, z, b.x, b.z, b.w / 2 + 1.5, b.d / 2 + 1.5);
  }
  for (const p of PADS) {
    h = blendPad(h, x, z, p.x, p.z, p.hx, p.hz);
  }

  const ld = Math.hypot(x - LAKE.x, z - LAKE.z);
  const shore = LAKE.r + 28;
  if (ld < shore) {
    const t = smoothstep(shore, LAKE.r - 2, ld);
    h = lerp(h, lakeLevel() - 0.15, t);
  }
  return h;
}

/** Height the wheels sit on. Roads are a thin sheet above the ground. */
export function driveHeight(x: number, z: number) {
  const h = terrainHeight(x, z);
  const { dist, half } = nearestRoad(x, z);
  if (dist <= half + 0.35) return h + ROAD_LIFT;
  return h;
}

/** True when a tree or rock would block a road, a building, or the start. */
export function blocksProp(x: number, z: number) {
  if (Math.abs(x) > WORLD_LIMIT - 24 || Math.abs(z) > WORLD_LIMIT - 24) return true;
  if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 16) return true;
  if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < 18) return true;
  const { dist, half } = nearestRoad(x, z);
  if (dist < half + 5.5) return true;
  for (const b of BUILDINGS) {
    if (Math.abs(x - b.x) < b.w / 2 + 3.5 && Math.abs(z - b.z) < b.d / 2 + 3.5) return true;
  }
  for (const p of PADS) {
    if (Math.abs(x - p.x) < p.hx + 2 && Math.abs(z - p.z) < p.hz + 2) return true;
  }
  return false;
}

export type Region = "town" | "forest" | "wild";

export function regionAt(x: number, z: number): Region {
  if (Math.abs(x) < 170 && Math.abs(z) < 150) return "town";
  // The signed forest, plus a larger woods filling the northwest hills.
  if ((x < -100 && z > -20) || x < -360 || (z > 380 && x < 180)) return "forest";
  return "wild";
}
