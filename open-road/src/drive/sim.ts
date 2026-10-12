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
  /** Peak tire/road friction coefficient. */
  grip: number;
  max: number;
  /** Rolling resistance. Pavement is near 0.013. Soft ground is higher. */
  roll: number;
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

export type Handling = "arcade" | "sim";

export type Setup = {
  auto: boolean;
  clutchNeeded: boolean;
  tc: boolean;
  abs: boolean;
  /** Arcade turns sharp at high speed. Sim slides if you push too hard. */
  handling: Handling;
};

export const DEFAULT_TUNE: Tune = { accel: 1, top: 78, offroad: 1, drive: "rwd", mass: 1400, cg: 0.5 };
export const DEFAULT_SETUP: Setup = { auto: true, clutchNeeded: false, tc: true, abs: true, handling: "arcade" };

export type StepInfo = {
  skid: number;
  pitch: number;
  roll: number;
  /** Front wheel angle in radians. Positive turns right. */
  wheel: number;
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
const GEAR_POWER = [1, 0.92, 0.8, 0.68, 0.56, 0.46];
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

const ROLL: Record<string, number> = {
  Dry: 0.013,
  Wet: 0.016,
  Dirt: 0.05,
  Mud: 0.14,
  Ice: 0.008,
  Grass: 0.08,
  Sand: 0.12,
  Water: 0.45,
};

function ground(name: string, grip: number, max: number): Surface {
  return { name, grip, max, roll: ROLL[name] ?? 0.02 };
}

export function surfaceAt(x: number, z: number, roads: RoadSeg[]): Surface {
  // Water wins over roads so a path that touches the lake cannot be driven across.
  const ld = Math.hypot(x - LAKE.x, z - LAKE.z);
  if (ld < LAKE.r) return ground("Water", 0.04, 3);

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
    if (grip < 0.85) return ground("Dirt", 0.7, 50);
    const wet = patchAt(x, z, "Wet");
    if (wet) return wet;
    return ground("Dry", 1.55, 98);
  }
  const mud = patchAt(x, z, "Mud");
  if (mud) return mud;
  const ice = patchAt(x, z, "Ice");
  if (ice) return ice;
  if (ld < LAKE.r + 16) return ground("Sand", 0.5, 28);
  // Grass is a bit less sticky than pavement, but still fast.
  return ground("Grass", 0.92, 72);
}

function patchAt(x: number, z: number, name: string): Surface | null {
  for (const patch of PATCHES) {
    if (patch.name !== name) continue;
    if (Math.abs(x - patch.x) <= patch.hx && Math.abs(z - patch.z) <= patch.hz) {
      return ground(patch.name, patch.mu, patch.max);
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
  const arcade = setup.handling !== "sim";
  const frontShare = tune.drive === "fwd" ? 0.58 : tune.drive === "rwd" ? 0.48 : 0.52;
  const inWater = surface.name === "Water";
  const onGrass = surface.name === "Grass";
  const loose = !inWater && !onGrass && surface.name !== "Dry" && surface.name !== "Wet";
  const gripBoost = arcade ? 1.35 : 1;
  const mu = clamp(surface.grip * (loose ? Math.max(0.55, tune.offroad) : 1) * gripBoost, 0.04, 2.2);
  // Turning radius in meters. Full lock U-turns in about 36–40 ft on dry road.
  const speedAbs = Math.abs(car.speed);
  const gripAy = (input.handbrake ? 0.45 : arcade ? 2.4 : 1.55) * mu * 9.81;
  const gripR = (speedAbs * speedAbs) / Math.max(5, gripAy);
  const tightR = input.handbrake ? 6.0 : 5.2;
  const blend = arcade ? clamp((speedAbs - 18) / 40, 0, 0.45) : clamp((speedAbs - 4) / 20, 0, 1);
  const turnR = tightR * (1 - blend) + Math.max(tightR, gripR) * blend;
  const steerSign = Math.sign(input.steer) || 0;
  const maxSteer = arcade ? 0.72 : 0.55;
  const delta = steerSign * Math.min(maxSteer, Math.atan2(WHEELBASE, Math.max(turnR, 1.4)));

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

  const frontAxle = WHEELBASE * 0.55;
  const rearAxle = WHEELBASE * 0.45;
  const rolling = Math.abs(car.speed) > 0.7;
  const vx = Math.max(Math.abs(car.speed), 0.45);
  const travel = Math.sign(car.speed || 1);
  const slipF = Math.atan2(car.lat + car.yawRate * frontAxle, vx) - (rolling && !inWater ? delta * travel : 0);
  const slipR = Math.atan2(car.lat - car.yawRate * rearAxle, vx);
  const driveSplit = tune.drive === "fwd" ? [1, 0] : tune.drive === "rwd" ? [0, 1] : [0.4, 0.6];

  let throttle = inWater ? 0 : input.throttle;
  let brake = input.brake;
  if (car.grind > 0 || (setup.clutchNeeded && !setup.auto && input.clutch)) throttle *= 0.08;

  const gearMul = GEAR_POWER[car.gear] ?? 0.46;
  // Grass/dirt: trucks keep almost full speed. Cars keep most of it on grass.
  const isTruck = tune.offroad >= 1.2 || tune.mass >= 2300;
  const grassFrac = isTruck ? 0.98 : 0.75;
  const speedCap = inWater
    ? 3
    : onGrass
      ? tune.top * grassFrac
      : loose
        ? isTruck
          ? tune.top * 0.97
          : Math.min(tune.top, surface.max * Math.max(0.55, tune.offroad))
        : tune.top;
  const pull = Math.abs(car.speed) / Math.max(12, speedCap);
  const curve = pull < 0.6 ? 1 : Math.max(0.24, 1 - (pull - 0.6) * 1.7);
  const push = mass * 12.5 * tune.accel * gearMul * curve;
  let drive = throttle * push * (car.reverse ? -1 : 1);
  // Sports cars ~60→0 in about 3s. Trucks take longer.
  const brakeG = tune.mass >= 2400 ? 6.8 : 14.5;
  let brakeForce = brake * mass * brakeG;
  if (tune.mass >= 2400) brakeForce = Math.min(brakeForce, mass * 6.8);
  if (input.handbrake) brakeForce += mass * 5.5;

  const frontCap = mu * frontN;
  const rearMu = mu * (input.handbrake ? 0.22 : 1);
  const rearCap = rearMu * rearN;
  if (setup.tc && throttle > 0) {
    const driveCap = frontCap * driveSplit[0] + rearCap * driveSplit[1];
    // Stronger cars may use more of the tire. The rest of the friction stays
    // for cornering, so full throttle does not spin the car around.
    const use = clamp(0.72 + 0.2 * tune.accel, 0.4, 0.98);
    const limit = (driveCap * use) / Math.max(0.2, Math.abs(drive));
    if (limit < 1) drive *= limit;
  }
  if (setup.abs && brake > 0) {
    const brakeCap = frontCap * 0.66 + rearCap * 0.4;
    const limit = (brakeCap * 1.05) / Math.max(1, brakeForce);
    if (limit < 1) brakeForce *= limit;
  }

  const fxDrive = clamp(
    drive,
    -(frontCap * driveSplit[0] + rearCap * driveSplit[1]),
    frontCap * driveSplit[0] + rearCap * driveSplit[1],
  );
  const fxBrakeMag = Math.min(brakeForce, frontCap * 0.64 + rearCap * 0.36);
  const brakeSign = Math.abs(car.speed) < 0.05 ? 0 : Math.sign(car.speed);
  const fxBrake = fxBrakeMag * brakeSign;
  const useFront = clamp((Math.abs(fxDrive) * driveSplit[0] + fxBrakeMag * 0.64) / Math.max(1, frontCap), 0, 1);
  const useRear = clamp((Math.abs(fxDrive) * driveSplit[1] + fxBrakeMag * 0.36) / Math.max(1, rearCap), 0, 1);
  const fyF = limitTire(tireSide(slipF, frontN, mu, useFront), Math.abs(fxDrive) * driveSplit[0] + fxBrakeMag * 0.64, frontCap);
  const fyR = limitTire(tireSide(slipR, rearN, rearMu, useRear), Math.abs(fxDrive) * driveSplit[1] + fxBrakeMag * 0.36, rearCap);
  const drag = dragForce(car.speed, mass, inWater ? 0.8 : surface.roll);
  const fx = fxDrive - fxBrake - drag;
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

  // Heading follows the front wheels. A stopped car cannot pivot.
  const yawCeil = arcade ? 2.6 : 1.9;
  const yawMag = rolling && !inWater ? Math.min(yawCeil, speedAbs / Math.max(turnR, 1.4)) : 0;
  const yawTarget = -Math.sign(car.speed || 1) * steerSign * yawMag;
  if (!rolling || inWater) {
    car.yawRate = 0;
    car.lat = 0;
    car.ay = 0;
  } else if (steerSign === 0) {
    car.yawRate *= Math.exp(-(arcade ? 6 : 4) * dtSafe);
  } else {
    const follow = 1 - Math.exp(-(input.handbrake ? 2.8 : arcade ? 14 : 10) * dtSafe);
    car.yawRate += (yawTarget - car.yawRate) * follow;
  }
  car.yawRate = clamp(car.yawRate, -yawCeil, yawCeil);
  car.yaw += car.yawRate * dtSafe;
  if (rolling && !inWater && !input.handbrake) {
    const stick = clamp(mu, 0.35, 2);
    const plant = arcade ? 18 : 12;
    car.lat *= Math.exp(-(4 + plant * stick) * dtSafe);
  }

  // One reverse gear, about 15–20 mph, and grass slows reverse the same way.
  const revCap = Math.min(8.5, speedCap);
  car.speed = clamp(car.speed, car.reverse || (setup.auto && car.speed < 0) ? -revCap : -3, speedCap);
  const latMax = input.handbrake ? 10 : arcade ? 1.6 : 2.4;
  car.lat = clamp(car.lat, -latMax, latMax);
  if (Math.abs(car.speed) < 0.35) car.lat *= Math.exp(-10 * dtSafe);

  const fxw = Math.sin(car.yaw);
  const fzw = Math.cos(car.yaw);
  const rx = Math.cos(car.yaw);
  const rz = -Math.sin(car.yaw);
  car.x += (fxw * car.speed + rx * car.lat) * dtSafe;
  car.z += (fzw * car.speed + rz * car.lat) * dtSafe;

  const loads = [fl, fr, rl, rr];
  const rest = weight / 4;
  // Sports cars are stiff and low. Trucks are softer and taller.
  const stiff = tune.mass >= 2400 ? 42 : 95;
  const damp = tune.mass >= 2400 ? 14 : 22;
  const throwAmt = tune.mass >= 2400 ? 0.11 : 0.055;
  for (let i = 0; i < 4; i++) {
    const target = (tune.mass >= 2400 ? 0.09 : 0.045) + clamp((loads[i] - rest) / rest, -0.9, 1.5) * throwAmt;
    const spring = (target - car.susp[i]) * stiff;
    const damper = -car.suspV[i] * damp;
    car.suspV[i] += (spring + damper) * dtSafe;
    car.suspV[i] *= Math.exp(-1.8 * dtSafe);
    car.susp[i] = clamp(car.susp[i] + car.suspV[i] * dtSafe, -0.02, tune.mass >= 2400 ? 0.28 : 0.16);
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
    pitch: clamp((frontComp - rearComp) * 3.4, -0.14, 0.14),
    roll: clamp((leftComp - rightComp) * 3.8, -0.16, 0.16),
    wheel: inWater ? 0 : delta,
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

/**
 * Lateral tire force from slip angle. Peaks near 7 degrees, then falls off.
 * Longitudinal use (drive or brake) takes a share of the friction circle.
 * Positive force pushes the car to its right.
 */
function tireSide(slip: number, load: number, mu: number, longUse: number) {
  const peak = 0.09;
  const s = slip / peak;
  const shape = s / (1 + 0.45 * s * s);
  const norm = shape / 0.745;
  const used = clamp(longUse, 0, 1);
  const remain = Math.sqrt(Math.max(0.22, 1 - used * used));
  return -norm * mu * remain * load;
}

/** Keep the combined tire force inside the friction circle. */
function limitTire(fy: number, fx: number, cap: number) {
  const mag = Math.hypot(fx, fy);
  if (mag <= cap || mag < 1) return fy;
  return fy * (cap / mag);
}

/**
 * Resistive force along the car, in newtons, signed with speed.
 * Aero drag is ½ ρ CdA v². Rolling resistance is Crr × weight.
 * Heavier vehicles use a larger frontal area.
 */
function dragForce(speed: number, mass: number, roll: number) {
  const cdA = mass > 2200 ? 1.15 : 0.6;
  const aero = 0.5 * 1.225 * cdA * speed * Math.abs(speed);
  if (Math.abs(speed) < 0.05) return 0;
  return aero + roll * mass * 9.81 * Math.sign(speed);
}

/**
 * The lake is not a road. A car that reaches the water is put back on the
 * bank, and the speed that was carrying it inward is removed.
 * Returns true when the car was in the water this step.
 */
export function resolveWater(car: Car): boolean {
  const dx = car.x - LAKE.x;
  const dz = car.z - LAKE.z;
  const dist = Math.hypot(dx, dz);
  if (dist >= LAKE.r) return false;

  const nx = dist > 0.4 ? dx / dist : -Math.sin(car.yaw);
  const nz = dist > 0.4 ? dz / dist : -Math.cos(car.yaw);
  const shore = LAKE.r + 0.35;
  car.x = LAKE.x + nx * shore;
  car.z = LAKE.z + nz * shore;

  const fx = Math.sin(car.yaw);
  const fz = Math.cos(car.yaw);
  const rx = Math.cos(car.yaw);
  const rz = -Math.sin(car.yaw);
  let vx = fx * car.speed + rx * car.lat;
  let vz = fz * car.speed + rz * car.lat;
  const inward = -(vx * nx + vz * nz);
  if (inward > 0) {
    vx += nx * inward;
    vz += nz * inward;
  }
  vx *= 0.35;
  vz *= 0.35;
  car.speed = vx * fx + vz * fz;
  car.lat = vx * rx + vz * rz;
  car.yawRate = 0;
  car.ax = 0;
  car.ay = 0;
  return true;
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
