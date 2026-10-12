import { LAKE } from "./mapData";

export type Car = {
  x: number;
  z: number;
  yaw: number;
  /** Meters per second. Negative means reverse. */
  speed: number;
  /** Sideways slide, meters per second. */
  lat: number;
  /** 0 is 1st gear. */
  gear: number;
  rpm: number;
};

export type Input = {
  throttle: number;
  brake: number;
  steer: number;
  handbrake: boolean;
};

export type Surface = {
  name: string;
  grip: number;
  max: number;
};

export type Tune = {
  accel: number;
  top: number;
  offroad: number;
};

export const DEFAULT_TUNE: Tune = { accel: 1, top: 78, offroad: 1 };

export type RoadSeg = {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  half: number;
  grip: number;
};

export type Collider =
  | { kind: "circle"; x: number; z: number; r: number }
  | { kind: "box"; x: number; z: number; hx: number; hz: number };

export const REDLINE = 7600;

const UPS = [16, 28, 41, 55, 68];
const DOWNS = [11, 22, 34, 47, 58];
const GEAR_POWER = [1, 0.84, 0.7, 0.58, 0.48, 0.4];
const LO = [0, 12, 22, 34, 48, 60];
const HI = [18, 30, 44, 58, 72, 86];

export function makeCar(): Car {
  return { x: -70, z: 4, yaw: Math.PI / 2, speed: 0, lat: 0, gear: 0, rpm: 900 };
}

export function resetCar(car: Car) {
  car.x = -70;
  car.z = 4;
  car.yaw = Math.PI / 2;
  car.speed = 0;
  car.lat = 0;
  car.gear = 0;
  car.rpm = 900;
}

export function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function segDist(px: number, pz: number, s: RoadSeg) {
  const dx = s.x2 - s.x1;
  const dz = s.z2 - s.z1;
  const l2 = dx * dx + dz * dz || 1;
  const t = clamp(((px - s.x1) * dx + (pz - s.z1) * dz) / l2, 0, 1);
  const x = s.x1 + t * dx;
  const z = s.z1 + t * dz;
  return Math.hypot(px - x, pz - z);
}

export function surfaceAt(x: number, z: number, roads: RoadSeg[]): Surface {
  let best = Infinity;
  let grip = 1;
  let half = 0;
  for (const s of roads) {
    const d = segDist(x, z, s);
    if (d < best) {
      best = d;
      grip = s.grip;
      half = s.half;
    }
  }
  if (best <= half + 0.4) {
    if (grip < 0.85) return { name: "Dirt", grip, max: 36 };
    return { name: "Road", grip: 1, max: 78 };
  }
  const ld = Math.hypot(x - LAKE.x, z - LAKE.z);
  if (ld < LAKE.r) return { name: "Water", grip: 0.25, max: 12 };
  if (ld < LAKE.r + 16) return { name: "Sand", grip: 0.42, max: 22 };
  return { name: "Grass", grip: 0.48, max: 26 };
}

export function gearLabel(car: Car, throttle: number) {
  if (car.speed < -0.6) return "R";
  if (Math.abs(car.speed) < 0.45 && throttle <= 0) return "N";
  return String(car.gear + 1);
}

export function stepCar(car: Car, input: Input, surface: Surface, dt: number, tune: Tune = DEFAULT_TUNE) {
  const dtSafe = clamp(dt, 0, 0.05);
  const paved = surface.max >= 70;

  if (car.speed > 2) {
    if (car.gear < 5 && car.speed > UPS[car.gear]) car.gear += 1;
    else if (car.gear > 0 && car.speed < DOWNS[car.gear - 1]) car.gear -= 1;
  } else if (car.speed >= 0) {
    car.gear = 0;
  }

  const gearPower = GEAR_POWER[car.gear];
  const driveMul = paved ? 1 : 0.6 * tune.offroad;

  if (input.throttle > 0) {
    if (car.speed < -0.3) car.speed = Math.min(0, car.speed + 18 * dtSafe);
    else {
      const slope = Math.max(0.16, 1 - car.speed / (surface.max + 6));
      car.speed += 12.5 * gearPower * driveMul * tune.accel * slope * dtSafe;
    }
  }

  if (input.brake > 0 && input.throttle === 0) {
    if (car.speed > 0.35) car.speed = Math.max(0, car.speed - 24 * dtSafe);
    else car.speed -= 9 * dtSafe;
  }

  if (input.handbrake && car.speed > 0) {
    car.speed = Math.max(0, car.speed - 7 * dtSafe);
  }

  if (input.throttle === 0) {
    const drag = 0.8 + Math.abs(car.speed) * 0.085;
    if (car.speed > 0) car.speed = Math.max(0, car.speed - drag * dtSafe);
    else if (car.speed < 0 && input.brake === 0) car.speed = Math.min(0, car.speed + 3.2 * dtSafe);
  }

  const cap = paved ? tune.top : Math.min(tune.top, surface.max * tune.offroad);
  if (car.speed > cap) car.speed = Math.max(cap, car.speed - 20 * dtSafe);
  car.speed = clamp(car.speed, -15, cap);

  const moving = Math.abs(car.speed) > 0.15;
  if (moving) {
    const steerScale = 2.85 / (1 + Math.abs(car.speed) * 0.022);
    car.yaw -= input.steer * steerScale * Math.sign(car.speed) * dtSafe;
  }
  if (input.handbrake && Math.abs(car.speed) > 6) {
    car.yaw -= input.steer * 2.4 * Math.sign(car.speed) * dtSafe;
  }

  const gripBase = paved ? surface.grip : Math.min(1.15, surface.grip * tune.offroad);
  const grip = gripBase * (input.handbrake ? 0.28 : 1);
  car.lat -= input.steer * car.speed * 0.55 * dtSafe;
  car.lat *= Math.exp(-(2 + grip * 6) * dtSafe);
  car.lat = clamp(car.lat, -16, 16);

  const fx = Math.sin(car.yaw);
  const fz = Math.cos(car.yaw);
  const rx = Math.cos(car.yaw);
  const rz = -Math.sin(car.yaw);
  car.x += (fx * car.speed + rx * car.lat) * dtSafe;
  car.z += (fz * car.speed + rz * car.lat) * dtSafe;

  const span = HI[car.gear] - LO[car.gear];
  const t = clamp((Math.abs(car.speed) - LO[car.gear]) / span, 0, 1);
  const load = 0.74 + input.throttle * 0.26;
  let rpm = 950 + t * (REDLINE - 1200) * load;
  if (input.throttle > 0 && Math.abs(car.speed) < 6) {
    rpm = Math.max(rpm, 950 + input.throttle * 3400);
  }
  if (car.speed < -0.5) rpm = 1400 + Math.abs(car.speed) * 140;
  car.rpm = rpm;

  let skid = Math.min(1, Math.abs(car.lat) / 7);
  if (input.handbrake && Math.abs(car.speed) > 6) skid = Math.max(skid, 0.5);
  if (!moving) skid = 0;
  return { skid };
}

function separate(car: Car, nx: number, nz: number, pen: number) {
  car.x += nx * pen;
  car.z += nz * pen;
  const fx = Math.sin(car.yaw);
  const fz = Math.cos(car.yaw);
  const rx = Math.cos(car.yaw);
  const rz = -Math.sin(car.yaw);
  const vx = fx * car.speed + rx * car.lat;
  const vz = fz * car.speed + rz * car.lat;
  const vn = vx * nx + vz * nz;
  if (vn >= 0) return 0;
  const vx2 = vx - nx * vn;
  const vz2 = vz - nz * vn;
  car.speed = vx2 * fx + vz2 * fz;
  car.lat = vx2 * rx + vz2 * rz;
  return -vn;
}

function pushCircle(car: Car, cx: number, cz: number, minDist: number) {
  let dx = car.x - cx;
  let dz = car.z - cz;
  const d = Math.hypot(dx, dz);
  if (d >= minDist) return 0;
  if (d < 1e-4) {
    dx = 1;
    dz = 0;
  }
  const len = Math.hypot(dx, dz) || 1;
  return separate(car, dx / len, dz / len, minDist - d);
}

function pushBox(car: Car, box: { x: number; z: number; hx: number; hz: number }, radius: number) {
  const closestX = clamp(car.x, box.x - box.hx, box.x + box.hx);
  const closestZ = clamp(car.z, box.z - box.hz, box.z + box.hz);
  let dx = car.x - closestX;
  let dz = car.z - closestZ;
  const d = Math.hypot(dx, dz);
  if (d >= radius) return 0;
  if (d < 1e-4) {
    const left = car.x - (box.x - box.hx);
    const right = box.x + box.hx - car.x;
    const back = car.z - (box.z - box.hz);
    const front = box.z + box.hz - car.z;
    const m = Math.min(left, right, back, front);
    if (m === left) return separate(car, -1, 0, left + radius);
    if (m === right) return separate(car, 1, 0, right + radius);
    if (m === back) return separate(car, 0, -1, back + radius);
    return separate(car, 0, 1, front + radius);
  }
  return separate(car, dx / d, dz / d, radius - d);
}

/** Push the car out of trees and buildings. Returns how hard it hit, in m/s. */
export function resolveCollisions(car: Car, colliders: Collider[]) {
  let impact = 0;
  const radius = 1.5;
  for (const c of colliders) {
    if (c.kind === "circle") impact = Math.max(impact, pushCircle(car, c.x, c.z, c.r + radius));
    else impact = Math.max(impact, pushBox(car, c, radius));
  }
  const bound = 400;
  if (Math.abs(car.x) > bound || Math.abs(car.z) > bound) {
    const before = Math.abs(car.speed);
    car.x = clamp(car.x, -bound, bound);
    car.z = clamp(car.z, -bound, bound);
    car.speed *= 0.35;
    impact = Math.max(impact, before * 0.4);
  }
  return impact;
}
