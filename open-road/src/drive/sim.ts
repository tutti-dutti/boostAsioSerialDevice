import { LAKE, PATCHES } from "./mapData";

export type Drive = "fwd" | "rwd" | "awd";

export type Car = {
  x: number;
  z: number;
  yaw: number;
  yawRate: number;
  /** Meters per second. Negative means reverse. */
  speed: number;
  /** Sideways slide, meters per second. Positive is to the right. */
  lat: number;
  /** 0 is 1st gear. */
  gear: number;
  reverse: boolean;
  rpm: number;
  /** Spring compression at each wheel: front-left, front-right, rear-left, rear-right. */
  susp: [number, number, number, number];
  suspV: [number, number, number, number];
  ax: number;
  ay: number;
  grind: number;
};

export type Input = {
  throttle: number;
  brake: number;
  steer: number;
  handbrake: boolean;
  clutch: boolean;
  shiftUp: boolean;
  shiftDown: boolean;
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
  drive: Drive;
  mass: number;
  /** Height of the weight above the ground, in meters. */
  cg: number;
};

export type Setup = {
  auto: boolean;
  clutchNeeded: boolean;
  tc: boolean;
  abs: boolean;
};

export const DEFAULT_TUNE: Tune = { accel: 1, top: 78, offroad: 1, drive: "rwd", mass: 1400, cg: 0.5 };
export const DEFAULT_SETUP: Setup = { auto: true, clutchNeeded: false, tc: true, abs: true };

export type StepInfo = {
  skid: number;
  pitch: number;
  roll: number;
  wheels: [number, number, number, number];
};

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
export function makeCar(): Car {
  return {
    x: -70,
    z: 4,
    yaw: Math.PI / 2,
    yawRate: 0,
    speed: 0,
    lat: 0,
    gear: 0,
    reverse: false,
    rpm: 900,
    susp: [0.08, 0.08, 0.08, 0.08],
    suspV: [0, 0, 0, 0],
    ax: 0,
    ay: 0,
    grind: 0,
  };
}

export function resetCar(car: Car) {
  const next = makeCar();
  Object.assign(car, next);
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
    if (grip < 0.85) return { name: "Dirt", grip: 0.55, max: 36 };
    const wet = patchAt(x, z, "Wet");
    if (wet) return wet;
    return { name: "Dry", grip: 1.02, max: 78 };
  }
  const mud = patchAt(x, z, "Mud");
  if (mud) return mud;
  const ice = patchAt(x, z, "Ice");
  if (ice) return ice;
  const ld = Math.hypot(x - LAKE.x, z - LAKE.z);
  if (ld < LAKE.r) return { name: "Water", grip: 0.22, max: 12 };
  if (ld < LAKE.r + 16) return { name: "Sand", grip: 0.4, max: 22 };
  return { name: "Grass", grip: 0.48, max: 26 };
}

function patchAt(x: number, z: number, name: string): Surface | null {
  for (const patch of PATCHES) {
    if (patch.name !== name) continue;
    if (Math.abs(x - patch.x) <= patch.hx && Math.abs(z - patch.z) <= patch.hz) {
      return { name: patch.name, grip: patch.mu, max: patch.max };
    }
  }
  return null;
}

export function gearLabel(car: Car, throttle: number, auto = true) {
  if (car.reverse || car.speed < -0.6) return "R";
  if (auto && Math.abs(car.speed) < 0.45 && throttle <= 0) return "N";
  return String(car.gear + 1);
}

const WHEELBASE = 2.6;
const TRACK = 1.55;
const GEAR_RATIO = [3.5, 2.3, 1.65, 1.28, 1.02, 0.84];

export function stepCar(
  car: Car,
  input: Input,
  surface: Surface,
  dt: number,
  tune: Tune = DEFAULT_TUNE,
  setup: Setup = DEFAULT_SETUP,
): StepInfo {
  const dtSafe = clamp(dt, 0, 0.05);
  shiftGears(car, input, setup, dtSafe);

  const mass = tune.mass;
  const weight = mass * 9.81;
  const cg = tune.cg;
  const frontShare = tune.drive === "fwd" ? 0.58 : tune.drive === "rwd" ? 0.48 : 0.52;
  const loose = surface.name !== "Dry" && surface.name !== "Wet";
  const mu = clamp(surface.grip * (loose ? tune.offroad : 1), 0.12, 1.35);
  const steer = input.steer * (0.46 / (1 + Math.abs(car.speed) * 0.018));

  const longShift = clamp((mass * car.ax * cg) / WHEELBASE, -0.38 * weight, 0.38 * weight);
  const latShift = clamp((mass * car.ay * cg) / TRACK, -0.34 * weight, 0.34 * weight);
  let frontN = clamp(weight * frontShare - longShift, weight * 0.18, weight * 0.82);
  let rearN = weight - frontN;
  const fl = clamp(frontN * 0.5 + latShift * 0.5, weight * 0.05, weight * 0.7);
  const fr = clamp(frontN * 0.5 - latShift * 0.5, weight * 0.05, weight * 0.7);
  const rl = clamp(rearN * 0.5 + latShift * 0.5, weight * 0.05, weight * 0.7);
  const rr = clamp(rearN * 0.5 - latShift * 0.5, weight * 0.05, weight * 0.7);
  frontN = fl + fr;
  rearN = rl + rr;

  const vx = Math.max(Math.abs(car.speed), 0.8);
  const slipF = Math.atan2(car.lat + car.yawRate * WHEELBASE * 0.55, vx) - steer * Math.sign(car.speed || 1);
  const slipR = Math.atan2(car.lat - car.yawRate * WHEELBASE * 0.45, vx);
  const driveSplit = tune.drive === "fwd" ? [1, 0] : tune.drive === "rwd" ? [0, 1] : [0.4, 0.6];

  let throttle = input.throttle;
  let brake = input.brake;
  if (car.grind > 0 || (setup.clutchNeeded && !setup.auto && input.clutch)) throttle *= 0.08;

  const gearMul = GEAR_POWER[car.gear] ?? 0.4;
  const speedCap = loose ? Math.min(tune.top, surface.max * tune.offroad) : tune.top;
  const push = mass * 6.4 * tune.accel * gearMul * Math.max(0.18, 1 - Math.abs(car.speed) / (speedCap + 10));
  let drive = throttle * push * (car.reverse ? -1 : 1);
  let brakeForce = brake * mass * 10.5;
  if (input.handbrake) brakeForce += mass * 4.2;

  const frontCap = mu * frontN;
  const rearCap = mu * rearN * (input.handbrake ? 0.28 : 1);
  const wantFront = Math.abs(drive) * driveSplit[0] + brakeForce * 0.64;
  const wantRear = Math.abs(drive) * driveSplit[1] + brakeForce * 0.36;
  if (setup.tc && wantFront + wantRear > 0 && throttle > 0) {
    const driveCap = frontCap * driveSplit[0] + rearCap * driveSplit[1];
    const limit = (driveCap * 0.9) / Math.max(0.2, Math.abs(drive));
    if (limit < 1) drive *= limit;
  }
  if (setup.abs && brake > 0) {
    const brakeCap = frontCap * 0.64 + rearCap * 0.36;
    const limit = (brakeCap * 0.92) / Math.max(1, brakeForce);
    if (limit < 1) brakeForce *= limit;
  }

  const useFront = clamp((Math.abs(drive) * driveSplit[0] + brakeForce * 0.64) / Math.max(1, frontCap), 0, 1);
  const useRear = clamp((Math.abs(drive) * driveSplit[1] + brakeForce * 0.36) / Math.max(1, rearCap), 0, 1);
  const fyF = tireSide(slipF, frontN, mu, useFront);
  const fyR = tireSide(slipR, rearN, mu * (input.handbrake ? 0.28 : 1), useRear);
  const fxDrive = clamp(drive, -(frontCap * driveSplit[0] + rearCap * driveSplit[1]), frontCap * driveSplit[0] + rearCap * driveSplit[1]);
  const fxBrake = Math.min(brakeForce, frontCap * 0.64 + rearCap * 0.36) * Math.sign(car.speed || 1);
  const drag = mass * (0.1 + 0.0015 * car.speed * Math.abs(car.speed));
  const coast = Math.abs(car.speed) < 0.05 ? 0 : Math.sign(car.speed);
  const fx = fxDrive - fxBrake - drag * coast;
  const fy = fyF + fyR;

  car.ax = fx / mass;
  car.ay = fy / mass;
  car.speed += car.ax * dtSafe;
  car.lat += car.ay * dtSafe;
  if (setup.auto && !car.reverse && input.brake > 0 && input.throttle === 0 && car.speed < 0.45 && car.speed > -14) {
    car.speed -= 7 * dtSafe;
  }
  if (Math.abs(input.steer) < 0.001 && throttle === 0 && brake === 0 && Math.abs(car.speed) < 0.45) {
    car.speed = 0;
    car.lat = 0;
    car.yawRate = 0;
    car.ay = 0;
  }

  const inertia = mass * 1.85;
  const moment = -fyF * (WHEELBASE * 0.55) + fyR * (WHEELBASE * 0.45);
  car.yawRate += (moment / inertia) * dtSafe;
  if (Math.abs(input.steer) < 0.001) {
    car.yawRate *= Math.exp(-2.4 * dtSafe);
    car.lat *= Math.exp(-1.8 * dtSafe);
  }
  if (Math.abs(car.speed) < 3.2) {
    const kin = (-car.speed * Math.tan(steer)) / WHEELBASE;
    car.yawRate += (kin - car.yawRate) * (1 - Math.exp(-6 * dtSafe));
  }
  car.yawRate = clamp(car.yawRate, -2.6, 2.6);
  car.yaw += car.yawRate * dtSafe;

  const cap = car.reverse ? 16 : speedCap;
  car.speed = clamp(car.speed, car.reverse || (setup.auto && car.speed < 0) ? -16 : -4, cap);
  car.lat = clamp(car.lat, -14, 14);
  if (Math.abs(car.speed) < 0.35) car.lat *= Math.exp(-8 * dtSafe);

  const fxw = Math.sin(car.yaw);
  const fzw = Math.cos(car.yaw);
  const rx = Math.cos(car.yaw);
  const rz = -Math.sin(car.yaw);
  car.x += (fxw * car.speed + rx * car.lat) * dtSafe;
  car.z += (fzw * car.speed + rz * car.lat) * dtSafe;

  const loads = [fl, fr, rl, rr];
  const rest = weight / 4;
  for (let i = 0; i < 4; i++) {
    const target = 0.05 + clamp((loads[i] - rest) / rest, -0.8, 1.4) * 0.07;
    const spring = (target - car.susp[i]) * 70;
    const damper = -car.suspV[i] * 11;
    car.suspV[i] += (spring + damper) * dtSafe;
    car.susp[i] = clamp(car.susp[i] + car.suspV[i] * dtSafe, -0.02, 0.22);
  }

  const ratio = GEAR_RATIO[car.gear] ?? 1;
  let rpm = 850 + Math.abs(car.speed) * ratio * 145;
  if (throttle > 0.2 && Math.abs(car.speed) < 5) rpm = Math.max(rpm, 900 + throttle * 2800);
  if (input.clutch && setup.clutchNeeded && !setup.auto) rpm = 900 + throttle * 4200;
  car.rpm = clamp(rpm, 800, REDLINE + 200);

  const moving = Math.abs(car.speed) > 0.4;
  let skid = moving ? clamp((Math.abs(slipF) + Math.abs(slipR)) / 0.7, 0, 1) : 0;
  if (useFront > 0.92 || useRear > 0.92) skid = Math.max(skid, 0.45);
  const frontComp = (car.susp[0] + car.susp[1]) * 0.5;
  const rearComp = (car.susp[2] + car.susp[3]) * 0.5;
  const leftComp = (car.susp[0] + car.susp[2]) * 0.5;
  const rightComp = (car.susp[1] + car.susp[3]) * 0.5;
  return {
    skid,
    pitch: clamp((frontComp - rearComp) * 2.4, -0.12, 0.12),
    roll: clamp((leftComp - rightComp) * 2.8, -0.14, 0.14),
    wheels: [...car.susp] as [number, number, number, number],
  };
}

function shiftGears(car: Car, input: Input, setup: Setup, dt: number) {
  car.grind = Math.max(0, car.grind - dt);
  if (setup.auto) {
    car.reverse = false;
    if (car.speed > 2.2) {
      if (car.gear < 5 && car.speed > UPS[car.gear]) car.gear += 1;
      else if (car.gear > 0 && car.speed < DOWNS[car.gear - 1]) car.gear -= 1;
    } else if (car.speed >= 0) car.gear = 0;
    return;
  }
  const grind = () => {
    if (setup.clutchNeeded && !input.clutch) car.grind = 0.4;
  };
  if (input.shiftUp) {
    if (car.reverse) car.reverse = false;
    else if (car.gear < 5) car.gear += 1;
    grind();
  }
  if (input.shiftDown) {
    if (!car.reverse && car.gear === 0) car.reverse = true;
    else if (car.gear > 0) car.gear -= 1;
    grind();
  }
}

/** Lateral tire force. Positive pushes the car to its right. */
function tireSide(slip: number, load: number, mu: number, longUse: number) {
  const peak = 0.11;
  const s = clamp(slip / peak, -1.8, 1.8);
  const shape = s / (1 + 0.4 * s * s);
  const remain = Math.sqrt(Math.max(0, 1 - clamp(longUse, 0, 1) ** 2));
  return -shape * mu * remain * load * 1.15;
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
