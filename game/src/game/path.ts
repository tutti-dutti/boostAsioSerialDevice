import type { Vec2 } from "./types";

/** Top-down arena like Summoner's Greed */
export const W = 1000;
export const H = 560;

/**
 * Path snakes from forest gate (top) down around to cookie vault (bottom-right).
 * Designed for a straight-down camera.
 */
export const PATH: Vec2[] = [
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
];

/** Round pads beside the path (top-down placement spots) */
export const SLOT_SPOTS: Vec2[] = [
  { x: 140, y: 100 },
  { x: 150, y: 220 },
  { x: 290, y: 220 },
  { x: 290, y: 360 },
  { x: 470, y: 360 },
  { x: 470, y: 220 },
  { x: 470, y: 60 },
  { x: 690, y: 60 },
  { x: 690, y: 200 },
  { x: 690, y: 420 },
  { x: 890, y: 420 },
  { x: 890, y: 300 },
];

export const COOKIE = { x: 920, y: 220 };
export const GATE = { x: 80, y: 40 };

function lengths() {
  const cum = [0];
  let total = 0;
  for (let i = 1; i < PATH.length; i++) {
    total += Math.hypot(PATH[i].x - PATH[i - 1].x, PATH[i].y - PATH[i - 1].y);
    cum.push(total);
  }
  return { cum, total };
}

const { cum: CUM, total: PATH_LEN } = lengths();

export function pathPoint(t: number): Vec2 {
  const d = Math.max(0, Math.min(1, t)) * PATH_LEN;
  for (let i = 1; i < CUM.length; i++) {
    if (d <= CUM[i]) {
      const seg = CUM[i] - CUM[i - 1] || 1;
      const u = (d - CUM[i - 1]) / seg;
      return {
        x: PATH[i - 1].x + (PATH[i].x - PATH[i - 1].x) * u,
        y: PATH[i - 1].y + (PATH[i].y - PATH[i - 1].y) * u,
      };
    }
  }
  return { ...PATH[PATH.length - 1] };
}

/** Progress along path for a point (approx) — used for walls */
export function nearestProgress(x: number, y: number): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const p = pathPoint(t);
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  return best;
}
