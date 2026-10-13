/**
 * Helpers for 2-player split-screen (left / right viewports).
 */
import type { Input } from "./sim";

export type SplitHud = {
  mph: number;
  gear: string;
  speedLimit: number;
  wanted: number;
  chase: boolean;
  x: number;
  z: number;
  yaw: number;
  surface: string;
};

/** P1 keyboard: WASD + Space slide. Arrows reserved for P2 when split. */
export function readP1Keys(keys: Set<string>, holds: Set<string>): Pick<Input, "throttle" | "brake" | "steer" | "handbrake"> {
  let steer = 0;
  if (keys.has("a") || holds.has("left")) steer -= 1;
  if (keys.has("d") || holds.has("right")) steer += 1;
  return {
    throttle: keys.has("w") || holds.has("throttle") ? 1 : 0,
    brake: keys.has("s") || holds.has("brake") ? 1 : 0,
    steer,
    handbrake: keys.has(" ") || holds.has("handbrake"),
  };
}

/** P2 keyboard: Arrows + Right Shift slide. */
export function readP2Keys(keys: Set<string>, codes: Set<string>): Pick<Input, "throttle" | "brake" | "steer" | "handbrake"> {
  let steer = 0;
  if (keys.has("arrowleft")) steer -= 1;
  if (keys.has("arrowright")) steer += 1;
  return {
    throttle: keys.has("arrowup") ? 1 : 0,
    brake: keys.has("arrowdown") ? 1 : 0,
    steer,
    handbrake: codes.has("ShiftRight"),
  };
}

/** Soft bump between two cars — never overlap. */
export function bumpCars(
  a: { x: number; z: number; speed: number },
  b: { x: number; z: number; speed: number },
  minSep = 3.9,
) {
  const d = Math.hypot(a.x - b.x, a.z - b.z);
  if (d >= minSep || d < 1e-4) return;
  const nx = (a.x - b.x) / d;
  const nz = (a.z - b.z) / d;
  const push = (minSep - d) * 0.5;
  a.x += nx * push;
  a.z += nz * push;
  b.x -= nx * push;
  b.z -= nz * push;
  a.speed *= 0.92;
  b.speed *= 0.92;
}
