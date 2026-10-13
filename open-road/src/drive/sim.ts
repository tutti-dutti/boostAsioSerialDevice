import {
  BORDER_IN,
  LAKE,
  PATCHES,
  RIVER,
  WORLD_HALF,
  bridgeHeightAt,
  elevatedHeightAt,
  inRiverWater,
  riverDistance,
} from "./mapData";

export type Drive = "fwd" | "rwd" | "awd";

export type Car = {
  x: number;
  z: number;
  /** Visual / vertical world Y (meters). */
  y: number;
  /** Vertical velocity for gravity when airborne. */
  vy: number;
  /** Seconds spent not touching the ground / deck. */
  airTime: number;
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
  /** Seconds held at a stop with S — reverse only after a short brake dwell. */
  brakeHold: number;
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
  /** Electric single-speed drivetrain (no gear shifts). */
  singleSpeed?: boolean;
  /** Sticky launch tires so instant EV torque doesn't spin away. */
  launchGrip?: boolean;
  /** Hypercar: more top-end shove and planted at very high speed. */
  hyper?: boolean;
  /** Raptor-style long-travel suspension: soft, ~2× wheel travel, soaks jumps. */
  longTravel?: boolean;
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

/** solid = always blocks. rock/shrub = trucks can roll over; cars get bumped. */
export type ColliderSoft = "solid" | "rock" | "shrub";

export type Collider =
  | {
      kind: "circle";
      x: number;
      z: number;
      r: number;
      soft?: ColliderSoft;
      /** If set, only collide when car.y is below this (e.g. pillars under a bridge). */
      maxY?: number;
    }
  | {
      kind: "box";
      x: number;
      z: number;
      hx: number;
      hz: number;
      soft?: ColliderSoft;
      maxY?: number;
    };

export const REDLINE = 7600;

const UPS = [16, 28, 41, 55, 68];
const DOWNS = [11, 22, 34, 47, 58];
const GEAR_POWER = [1, 0.92, 0.8, 0.68, 0.56, 0.46];
export function makeCar(): Car {
  return {
    x: -70,
    z: 4,
    y: 1.2,
    vy: 0,
    airTime: 0,
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
    brakeHold: 0,
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

export function surfaceAt(x: number, z: number, roads: RoadSeg[], carY = 999): Surface {
  // Bridge / skyway deck is dry pavement — only when the car is actually up on the deck.
  const deck = elevatedHeightAt(x, z);
  if (deck != null && carY > deck - 4.5) return ground("Dry", 1.55, 98);

  // Water wins over at-grade roads — lake and river are not driveable.
  const ld = Math.hypot(x - LAKE.x, z - LAKE.z);
  if (ld < LAKE.r) return ground("Water", 0.04, 3);
  if (inRiverWater(x, z)) return ground("Water", 0.04, 3);

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
  // Sand only on the actual beach ring — not a wide halo that steals grass labels.
  if (ld >= LAKE.r && ld < LAKE.r + 10) return ground("Sand", 0.5, 28);
  const river = riverDistance(x, z);
  if (river.d >= RIVER.halfWidth && river.d < river.bank) return ground("Sand", 0.5, 28);
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

export function gearLabel(car: Car, throttle: number, auto = true, singleSpeed = false) {
  if (car.reverse || car.speed < -0.6) return "R";
  if (auto && Math.abs(car.speed) < 0.45 && throttle <= 0) return "N";
  if (singleSpeed) return "D";
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
  shiftGears(car, input, setup, dtSafe, tune);

  const mass = tune.mass;
  const weight = mass * 9.81;
  const cg = tune.cg;
  const arcade = setup.handling !== "sim";
  const frontShare = tune.drive === "fwd" ? 0.58 : tune.drive === "rwd" ? 0.48 : 0.52;
  const inWater = surface.name === "Water";
  const onGrass = surface.name === "Grass";
  const loose = !inWater && !onGrass && surface.name !== "Dry" && surface.name !== "Wet";
  // Arcade: sticky tires at every speed so hard 90° turns at 150+ mph still plant.
  let gripBoost = arcade ? 4.2 : 1;
  // EV launch: glue the tires at low speed so full instant torque sticks.
  if (tune.launchGrip && !car.reverse && Math.abs(car.speed) < 32 && input.throttle > 0.4) {
    gripBoost *= arcade ? 1.25 : 1.7;
  }
  const mu = clamp(surface.grip * (loose ? Math.max(0.55, tune.offroad) : 1) * gripBoost, 0.04, arcade ? 5.5 : 3.4);
  // Turning circle ~35 ft curb-to-curb (~10.7 m diameter / ~5.3 m radius) at
  // low speed so a U-turn fits a normal two-lane road. Trucks a bit wider.
  const speedAbs = Math.abs(car.speed);
  const isTruckTurn = tune.offroad >= 1.2 || tune.mass >= 2300;
  const gripAy = (input.handbrake ? 0.45 : arcade ? 6.5 : 1.45) * mu * 9.81;
  const gripR = (speedAbs * speedAbs) / Math.max(5, gripAy);
  const baseTight = arcade ? (isTruckTurn ? 5.8 : 5.2) : isTruckTurn ? 6.4 : 5.5;
  const tightR = input.handbrake ? baseTight + 1.2 : baseTight;
  // Arcade barely widens with speed — keep sharp side-road cuts available.
  const blend = arcade ? clamp((speedAbs - 55) / 90, 0, 0.18) : clamp((speedAbs - 4) / 22, 0, 1);
  const turnR = tightR * (1 - blend) + Math.max(tightR, gripR) * blend;
  // Partial stick / smoothed keyboard steer scales lock (not just ±1).
  const steerAmt = clamp(Math.abs(input.steer), 0, 1);
  const steerSign = Math.sign(input.steer) || 0;
  // Low-speed lock is generous; trucks lose a little angle vs sports cars.
  let maxSteer = arcade ? (isTruckTurn ? 0.68 : 0.78) : isTruckTurn ? 0.52 : 0.62;
  // Sim hypercars lose lock at speed; Arcade keeps full steering angle always.
  if (!arcade && tune.hyper && speedAbs > 50) {
    maxSteer *= Math.max(0.32, 1 - (speedAbs - 50) / 140);
  }
  const delta = arcade
    ? steerSign * steerAmt * maxSteer
    : steerSign * steerAmt * Math.min(maxSteer, Math.atan2(WHEELBASE, Math.max(turnR, 2.2)));

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
  // Direction rules:
  // - S always brakes while rolling forward (never snaps straight into reverse).
  // - Reverse only after a short stop+hold (shiftGears). Then S drives reverse.
  // - W while reversing brakes to a stop, then leaves reverse.
  if (!inWater) {
    if (!car.reverse && input.brake > 0.1) {
      // Forward / coasting: S is the brake pedal.
      throttle = 0;
      brake = input.brake;
    } else if (car.speed < -0.4 && input.throttle > 0.1) {
      brake = Math.max(brake, input.throttle);
      throttle = 0;
      if (Math.abs(car.speed) < 0.55) car.reverse = false;
    } else if (car.reverse && input.throttle > 0.1) {
      // Stopped / nearly stopped in reverse + W → go forward.
      if (car.speed > -0.4) {
        car.reverse = false;
      } else {
        brake = Math.max(brake, input.throttle);
        throttle = 0;
      }
    } else if (setup.auto && car.reverse && input.brake > 0 && input.throttle < 0.1) {
      // Already in reverse: S backs up. (Entered only after brake dwell at a stop.)
      throttle = input.brake;
      brake = 0;
    }
  }
  if (car.grind > 0 || (setup.clutchNeeded && !setup.auto && input.clutch)) throttle *= 0.08;

  // Single-speed EVs keep full shove. Hypercars / 270+ mph cars keep more
  // power in tall gears so listed top speeds are reachable against aero drag.
  let gearMul = tune.singleSpeed ? 1 : (GEAR_POWER[car.gear] ?? 0.46);
  if (!tune.singleSpeed) {
    if (tune.hyper) {
      const tall = clamp((tune.top - 90) / 60, 0, 0.9);
      gearMul = gearMul + (1 - gearMul) * tall;
    } else if (tune.top > 110) {
      // Cerberus-class tops (~273 mph) need a milder tall-gear boost.
      const tall = clamp((tune.top - 100) / 70, 0, 0.6);
      gearMul = gearMul + (1 - gearMul) * tall;
    }
  }
  // Grass/dirt: trucks keep almost full speed. Cars keep most of it on grass.
  // Razorback long-travel stays even closer to full pace on trails.
  const isTruck = tune.offroad >= 1.2 || tune.mass >= 2300;
  const grassFrac = tune.longTravel ? 0.99 : isTruck ? 0.98 : 0.75;
  const dirtFrac = tune.longTravel ? 0.99 : isTruck ? 0.97 : 0;
  const speedCap = inWater
    ? 3
    : onGrass
      ? tune.top * grassFrac
      : loose
        ? isTruck
          ? tune.top * dirtFrac
          : Math.min(tune.top, surface.max * Math.max(0.55, tune.offroad))
        : tune.top;
  // Reverse: same for cars and trucks, same on road and grass. ~23 mph top,
  // about 0–15 mph in 2–3 seconds.
  const revCap = inWater ? 3 : 10.5;
  const pull = Math.abs(car.speed) / Math.max(12, car.reverse ? revCap : speedCap);
  // Launch-grip EVs keep a flatter mid-band shove so 0–60 stays brutal, then
  // taper hard near their low truck tops.
  let curve = pull < 0.6 ? 1 : Math.max(0.24, 1 - (pull - 0.6) * 1.7);
  if (tune.launchGrip && !car.reverse) {
    curve = pull < 0.45 ? 1 : Math.max(0.18, 1 - (pull - 0.45) * 1.9);
  }
  let drive: number;
  if (car.reverse) {
    // Fixed reverse shove so trucks reverse as quickly as sports cars.
    const revPush = mass * 4.2 * curve;
    drive = -throttle * revPush;
  } else {
    const push = mass * 12.5 * tune.accel * gearMul * curve;
    drive = throttle * push;
  }
  // Strong arcade brakes: sports cars ~60→0 in ~1.8–2.2s; trucks a bit longer.
  const brakeG = tune.mass >= 2400 ? 11 : arcade ? 22 : 18;
  let brakeForce = brake * mass * brakeG;
  if (tune.mass >= 2400) brakeForce = Math.min(brakeForce, mass * 11);
  if (input.handbrake) brakeForce += mass * 7;

  const frontCap = mu * frontN;
  const rearMu = mu * (input.handbrake ? 0.22 : 1);
  const rearCap = rearMu * rearN;
  if (setup.tc && throttle > 0) {
    const driveCap = frontCap * driveSplit[0] + rearCap * driveSplit[1];
    // Stronger cars may use more of the tire. The rest of the friction stays
    // for cornering, so full throttle does not spin the car around.
    // Launch-grip EVs are allowed nearly full tire for the shove.
    const use = tune.launchGrip
      ? clamp(0.92 + 0.08 * Math.min(1, tune.accel / 2), 0.9, 0.99)
      : clamp(0.72 + 0.2 * tune.accel, 0.4, 0.98);
    const limit = (driveCap * use) / Math.max(0.2, Math.abs(drive));
    if (limit < 1) drive *= limit;
  }
  if (setup.abs && brake > 0) {
    // Let brakes use most of the tire — old caps made stopping distances huge.
    const brakeCap = frontCap * 0.9 + rearCap * 0.75;
    const limit = (brakeCap * 1.1) / Math.max(1, brakeForce);
    if (limit < 1) brakeForce *= limit;
  }

  const fxDrive = clamp(
    drive,
    -(frontCap * driveSplit[0] + rearCap * driveSplit[1]),
    frontCap * driveSplit[0] + rearCap * driveSplit[1],
  );
  const fxBrakeMag = Math.min(brakeForce, frontCap * 0.88 + rearCap * 0.72);
  const brakeSign = Math.abs(car.speed) < 0.05 ? 0 : Math.sign(car.speed);
  const fxBrake = fxBrakeMag * brakeSign;
  const useFront = clamp((Math.abs(fxDrive) * driveSplit[0] + fxBrakeMag * 0.64) / Math.max(1, frontCap), 0, 1);
  const useRear = clamp((Math.abs(fxDrive) * driveSplit[1] + fxBrakeMag * 0.36) / Math.max(1, rearCap), 0, 1);
  const fyF = limitTire(tireSide(slipF, frontN, mu, useFront), Math.abs(fxDrive) * driveSplit[0] + fxBrakeMag * 0.64, frontCap);
  const fyR = limitTire(tireSide(slipR, rearN, rearMu, useRear), Math.abs(fxDrive) * driveSplit[1] + fxBrakeMag * 0.36, rearCap);
  const drag = dragForce(car.speed, mass, inWater ? 0.8 : surface.roll, !!tune.hyper);
  const fx = fxDrive - fxBrake - drag;
  const fy = fyF + fyR;

  car.ax = fx / mass;
  car.ay = fy / mass;
  car.speed += car.ax * dtSafe;
  car.lat += car.ay * dtSafe;
  if (Math.abs(input.steer) < 0.001 && throttle === 0 && brake === 0 && Math.abs(car.speed) < 0.45) {
    car.speed = 0;
    car.lat = 0;
    car.yawRate = 0;
    car.ay = 0;
  }

  // Heading follows the front wheels. A stopped car cannot pivot.
  // Arcade: high yaw ceiling + steer-led rate so 150+ mph 90° cuts still rotate.
  // Low-speed term sized for a ~30–35 ft U-turn; trucks a touch wider.
  const yawCeil = arcade ? 2.55 : 1.25;
  const yawMag = rolling && !inWater
    ? arcade
      ? Math.min(
          yawCeil,
          // ω ≈ v/R with R~5.3 m at crawl, then rises with speed for sharp cuts.
          steerAmt * Math.min(yawCeil, speedAbs / (isTruckTurn ? 6.0 : 5.3) + speedAbs * 0.011),
        )
      : Math.min(yawCeil, (speedAbs * steerAmt) / Math.max(turnR, 2.2))
    : 0;
  const yawTarget = -Math.sign(car.speed || 1) * steerSign * yawMag;
  if (!rolling || inWater) {
    car.yawRate = 0;
    car.lat = 0;
    car.ay = 0;
  } else if (steerSign === 0) {
    car.yawRate *= Math.exp(-(arcade ? 7 : 3.5) * dtSafe);
  } else {
    const follow = 1 - Math.exp(-(input.handbrake ? 2.4 : arcade ? 11 : 6) * dtSafe);
    car.yawRate += (yawTarget - car.yawRate) * follow;
  }
  car.yawRate = clamp(car.yawRate, -yawCeil, yawCeil);
  // King Egg hypercars plant harder past ~90 mph so they don't shake or fly.
  // Arcade keeps steering response — only kill sideways slide, not yaw.
  if (tune.hyper && rolling && speedAbs > 40) {
    const plantH = clamp((speedAbs - 40) / 90, 0, 1);
    if (arcade) {
      if (steerSign === 0) car.yawRate *= Math.exp(-(1.8 + 2.5 * plantH) * dtSafe);
      car.lat *= Math.exp(-(5 + 10 * plantH) * dtSafe);
    } else {
      car.yawRate *= Math.exp(-(2.5 + 5 * plantH) * dtSafe);
      car.lat *= Math.exp(-(3 + 7 * plantH) * dtSafe);
    }
  }
  car.yaw += car.yawRate * dtSafe;
  if (rolling && !inWater && !input.handbrake) {
    const stick = clamp(mu, 0.35, arcade ? 4 : 2);
    const plant = arcade ? 28 : 12;
    car.lat *= Math.exp(-(4 + plant * stick) * dtSafe);
  }

  // One reverse gear: ~20–25 mph top on any dry/grass surface.
  car.speed = clamp(car.speed, car.reverse ? -revCap : -3, speedCap);
  // Arcade: tiny lateral slip budget → no slide-out / spin / wobble in hard turns.
  const latMax = input.handbrake ? 10 : arcade ? 0.45 : tune.hyper ? 1.2 : 2.4;
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
  // Razorback long-travel: ~2× throw, soft compression, controlled one-shot rebound.
  const truckSusp = tune.mass >= 2400 || tune.longTravel;
  const restH = tune.longTravel ? 0.16 : truckSusp ? 0.09 : 0.045;
  const throwAmt = tune.longTravel ? 0.28 : truckSusp ? 0.11 : 0.055;
  const maxTravel = tune.longTravel ? 0.58 : truckSusp ? 0.28 : 0.16;
  const minTravel = tune.longTravel ? -0.12 : -0.02;
  const baseStiff = tune.longTravel ? 24 : truckSusp ? 42 : 95;
  for (let i = 0; i < 4; i++) {
    const target = restH + clamp((loads[i] - rest) / rest, -0.9, 1.5) * throwAmt;
    // Soft on the way down, firmer on rebound so landings settle once.
    const extending = car.suspV[i] > 0;
    const stiff = tune.longTravel ? (extending ? 34 : 22) : baseStiff;
    const damp = tune.longTravel ? (extending ? 30 : 11) : truckSusp ? 14 : 22;
    const spring = (target - car.susp[i]) * stiff;
    const damper = -car.suspV[i] * damp;
    car.suspV[i] += (spring + damper) * dtSafe;
    const velDecay = tune.longTravel ? (extending ? 3.2 : 1.1) : 1.8;
    car.suspV[i] *= Math.exp(-velDecay * dtSafe);
    car.susp[i] = clamp(car.susp[i] + car.suspV[i] * dtSafe, minTravel, maxTravel);
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

function shiftGears(car: Car, input: Input, setup: Setup, dt: number, tune: Tune = DEFAULT_TUNE) {
  car.grind = Math.max(0, car.grind - dt);
  // Hold S at a full stop briefly before reverse — so S brakes first.
  const wantReverse = Math.abs(car.speed) < 0.45 && input.brake > 0.4 && input.throttle < 0.1;
  if (!car.reverse && wantReverse) car.brakeHold += dt;
  else if (!car.reverse) car.brakeHold = 0;
  const reverseReady = car.brakeHold > 0.35;

  if (tune.singleSpeed) {
    car.gear = 0;
    if (car.reverse) {
      if (input.throttle > 0.2 && car.speed > -0.35) {
        car.reverse = false;
        car.brakeHold = 0;
      }
      return;
    }
    if (reverseReady) {
      car.reverse = true;
      car.brakeHold = 0;
    }
    return;
  }
  if (setup.auto) {
    // S brakes while moving. Stopped + hold S → reverse, then S backs up.
    if (car.reverse) {
      car.gear = 0;
      if (input.throttle > 0.2 && car.speed > -0.35) {
        car.reverse = false;
        car.brakeHold = 0;
      }
      return;
    }
    if (reverseReady) {
      car.reverse = true;
      car.gear = 0;
      car.brakeHold = 0;
      return;
    }
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
function dragForce(speed: number, mass: number, roll: number, hyper = false) {
  // Hypercars use a tiny frontal area so 300 mph is reachable.
  // Sports cars sit between hyper and truck CdA.
  const cdA = hyper ? 0.42 : mass > 2200 ? 1.15 : 0.52;
  const aero = 0.5 * 1.225 * cdA * speed * Math.abs(speed);
  if (Math.abs(speed) < 0.05) return 0;
  return aero + roll * mass * 9.81 * Math.sign(speed);
}

/**
 * Lake and river are not roads. A car that reaches the water is put back on
 * the bank (unless it is on the highway bridge above the river).
 * Returns true when the car was in the water this step.
 */
export function resolveWater(car: Car): boolean {
  // Only ignore water when the car is up on the bridge deck, not under it.
  const deck = bridgeHeightAt(car.x, car.z);
  if (deck != null && car.y > deck - 4.5) return false;

  const lakeDx = car.x - LAKE.x;
  const lakeDz = car.z - LAKE.z;
  const lakeDist = Math.hypot(lakeDx, lakeDz);
  const river = riverDistance(car.x, car.z);
  const inLake = lakeDist < LAKE.r;
  const inRiver = river.d < river.half;
  if (!inLake && !inRiver) return false;

  let nx: number;
  let nz: number;
  if (inRiver && (!inLake || river.d < lakeDist)) {
    // Push outward from the river centerline.
    nx = river.d > 0.4 ? (car.x - river.cx) / river.d : river.nx;
    nz = river.d > 0.4 ? (car.z - river.cz) / river.d : river.nz;
    const shore = river.half + 0.45;
    car.x = river.cx + nx * shore;
    car.z = river.cz + nz * shore;
  } else {
    nx = lakeDist > 0.4 ? lakeDx / lakeDist : -Math.sin(car.yaw);
    nz = lakeDist > 0.4 ? lakeDz / lakeDist : -Math.cos(car.yaw);
    const shore = LAKE.r + 0.35;
    car.x = LAKE.x + nx * shore;
    car.z = LAKE.z + nz * shore;
  }

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
  // One clean push — no overshoot that causes crash jitter.
  const push = Math.min(pen, 1.8);
  car.x += nx * push;
  car.z += nz * push;
  const fx = Math.sin(car.yaw);
  const fz = Math.cos(car.yaw);
  const rx = Math.cos(car.yaw);
  const rz = -Math.sin(car.yaw);
  const vx = fx * car.speed + rx * car.lat;
  const vz = fz * car.speed + rz * car.lat;
  const vn = vx * nx + vz * nz;
  if (vn >= 0) return 0;
  // Kill only the inward component and bleed a little speed — no rebound spike.
  const vx2 = (vx - nx * vn) * 0.85;
  const vz2 = (vz - nz * vn) * 0.85;
  car.speed = vx2 * fx + vz2 * fz;
  car.lat = vx2 * rx + vz2 * rz;
  car.yawRate *= 0.55;
  // Settle suspension so a bump does not kick the body into a spasm.
  for (let i = 0; i < 4; i++) {
    car.suspV[i] *= 0.35;
    car.susp[i] = clamp(car.susp[i], 0.04, 0.22);
  }
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

/**
 * Soft border: past BORDER_IN, gently turn and push the car back toward the map.
 * Reset still works anywhere. Returns true when the border is touching the car.
 */
export function resolveBorder(car: Car): boolean {
  const ax = Math.abs(car.x);
  const az = Math.abs(car.z);
  const edge = Math.max(ax, az);
  if (edge < BORDER_IN) return false;
  // Direction back toward origin.
  const len = Math.hypot(car.x, car.z) || 1;
  const nx = -car.x / len;
  const nz = -car.z / len;
  const depth = Math.min(1, (edge - BORDER_IN) / Math.max(1, WORLD_HALF - BORDER_IN));
  // Ease speed down and bias yaw toward the center.
  car.speed *= 1 - 0.55 * depth;
  car.lat *= 1 - 0.7 * depth;
  const face = Math.atan2(Math.sin(car.yaw), Math.cos(car.yaw));
  const toCenter = Math.atan2(-car.x, -car.z);
  let dyaw = toCenter - face;
  while (dyaw > Math.PI) dyaw -= Math.PI * 2;
  while (dyaw < -Math.PI) dyaw += Math.PI * 2;
  car.yaw += dyaw * 0.04 * (0.35 + depth);
  car.yawRate *= 0.5;
  // Soft push inward so we never leave WORLD_HALF.
  if (edge > WORLD_HALF - 8) {
    const pen = edge - (WORLD_HALF - 12);
    car.x += nx * pen;
    car.z += nz * pen;
  } else {
    car.x += nx * depth * 0.35;
    car.z += nz * depth * 0.35;
  }
  return true;
}

export type CollisionHit = {
  impact: number;
  /** Soft props the vehicle is driving over (for suspension / shrub bend). */
  overs: { x: number; z: number; soft: ColliderSoft; r: number }[];
};

/**
 * Extra height a truck wheel gets while climbing a small rock/shrub.
 * Returns 0 for sports cars (they don't climb rocks).
 */
export function climbBumpAt(x: number, z: number, colliders: Collider[], isTruck: boolean): number {
  if (!isTruck) return 0;
  let h = 0;
  for (const c of colliders) {
    if (c.kind !== "circle") continue;
    if (c.soft !== "rock" && c.soft !== "shrub") continue;
    const d = Math.hypot(x - c.x, z - c.z);
    const reach = c.r + 1.15;
    if (d >= reach) continue;
    const t = 1 - d / reach;
    const peak = c.soft === "rock" ? Math.min(0.62, 0.22 + c.r * 1.35) : 0.14;
    // Smooth hump: wheel rolls up, over, and down.
    h = Math.max(h, peak * Math.sin(t * Math.PI));
  }
  return h;
}

/** Push the car out of trees and buildings. Trucks climb small rocks/shrubs. */
export function resolveCollisions(car: Car, colliders: Collider[], tune: Tune = DEFAULT_TUNE): CollisionHit {
  let impact = 0;
  const overs: CollisionHit["overs"] = [];
  const radius = 1.35;
  const isTruck = tune.offroad >= 1.2 || tune.mass >= 2300;
  const fx = Math.sin(car.yaw);
  const fz = Math.cos(car.yaw);
  const rx = Math.cos(car.yaw);
  const rz = -Math.sin(car.yaw);
  const axle = 1.35;
  const track = 0.9;
  const wheelXZ = [
    { x: car.x + fx * axle - rx * track, z: car.z + fz * axle - rz * track },
    { x: car.x + fx * axle + rx * track, z: car.z + fz * axle + rz * track },
    { x: car.x - fx * axle - rx * track, z: car.z - fz * axle - rz * track },
    { x: car.x - fx * axle + rx * track, z: car.z - fz * axle + rz * track },
  ];

  // Resolve every solid in range — no hit-cap (capping let cars ghost through boulder clusters).
  for (const c of colliders) {
    if (c.maxY != null && car.y > c.maxY) continue;
    const soft = c.soft ?? "solid";
    if (c.kind === "circle") {
      const dist = Math.hypot(car.x - c.x, car.z - c.z);
      const touch = c.r + radius;
      if (dist >= touch) continue;
      // Only small rocks / bushes are drive-over. Big boulders are soft:"solid".
      if (soft === "shrub" || soft === "rock") {
        if (isTruck) {
          overs.push({ x: c.x, z: c.z, soft, r: c.r });
          const suspCeil = tune.longTravel ? 0.58 : 0.28;
          const amt = soft === "rock" ? (tune.longTravel ? 0.7 : 0.55) : 0.22;
          for (let i = 0; i < 4; i++) {
            const wd = Math.hypot(wheelXZ[i].x - c.x, wheelXZ[i].z - c.z);
            if (wd < c.r + 1.1) {
              car.susp[i] = clamp(car.susp[i] + amt * (1 - wd / (c.r + 1.1)), 0, suspCeil);
              car.suspV[i] *= tune.longTravel ? 0.55 : 0.7;
            }
          }
          continue;
        }
        if (soft === "rock") {
          impact = Math.max(impact, pushCircle(car, c.x, c.z, touch));
          car.speed *= 0.88;
          overs.push({ x: c.x, z: c.z, soft, r: c.r });
          continue;
        }
        car.speed *= 0.97;
        overs.push({ x: c.x, z: c.z, soft, r: c.r });
        continue;
      }
      impact = Math.max(impact, pushCircle(car, c.x, c.z, touch));
    } else {
      impact = Math.max(impact, pushBox(car, c, radius));
    }
  }
  return { impact, overs };
}
