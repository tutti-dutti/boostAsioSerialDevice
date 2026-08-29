import type { Vec2 } from "./types";

export const W = 1000;
export const H = 460;

/** Path from forest edge to the giant cookie */
export const PATH: Vec2[] = [
  { x: 30, y: 230 },
  { x: 150, y: 230 },
  { x: 230, y: 130 },
  { x: 370, y: 130 },
  { x: 450, y: 300 },
  { x: 600, y: 300 },
  { x: 680, y: 150 },
  { x: 820, y: 150 },
  { x: 900, y: 250 },
  { x: 960, y: 250 },
];

export const SLOT_SPOTS: Vec2[] = [
  { x: 190, y: 210 },
  { x: 290, y: 95 },
  { x: 330, y: 210 },
  { x: 410, y: 220 },
  { x: 500, y: 350 },
  { x: 540, y: 230 },
  { x: 640, y: 210 },
  { x: 720, y: 100 },
  { x: 760, y: 230 },
  { x: 870, y: 200 },
];

export const COOKIE = { x: 960, y: 250 };

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
