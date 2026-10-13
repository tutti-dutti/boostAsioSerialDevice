/**
 * Bench Fjord Razorback long-travel: dirt/grass pace, suspension travel, landing settle.
 */
import { GARAGE } from "../src/drive/garage.ts";
import { DEFAULT_SETUP, makeCar, stepCar } from "../src/drive/sim.ts";

const MPH = 2.23694;
const DT = 1 / 60;
const FLOOR = {
  throttle: 1,
  brake: 0,
  steer: 0,
  handbrake: false,
  clutch: false,
  shiftUp: false,
  shiftDown: false,
};

const razor = GARAGE.find((c) => c.id === "fjord-razorback");
const bison = GARAGE.find((c) => c.id === "headbutt-thunder-bison");
if (!razor?.tune.longTravel) {
  console.error("Razorback missing longTravel tune");
  process.exit(1);
}

function topOn(surface, tune, seconds = 40) {
  const car = makeCar();
  let peak = 0;
  for (let i = 0; i < seconds / DT; i++) {
    stepCar(car, FLOOR, surface, DT, tune, DEFAULT_SETUP);
    peak = Math.max(peak, Math.abs(car.speed));
  }
  return peak * MPH;
}

function suspTravel(tune) {
  const car = makeCar();
  const dry = { name: "Dry", grip: 1.55, max: 98, roll: 0.013 };
  // Floor, then slam loads via hard brake / throttle pulses aren't enough —
  // force compression spikes by hand after building speed.
  for (let i = 0; i < 120; i++) stepCar(car, FLOOR, dry, DT, tune, DEFAULT_SETUP);
  let peak = 0;
  let min = 9;
  for (let pulse = 0; pulse < 8; pulse++) {
    for (let i = 0; i < 4; i++) {
      car.susp[i] = 0.85;
      car.suspV[i] = -2;
    }
    // Capture the clamped long-travel ceiling on the first integrate.
    stepCar(car, FLOOR, dry, DT, tune, DEFAULT_SETUP);
    for (const s of car.susp) {
      peak = Math.max(peak, s);
      min = Math.min(min, s);
    }
    for (let i = 0; i < 90; i++) {
      stepCar(car, FLOOR, dry, DT, tune, DEFAULT_SETUP);
      for (const s of car.susp) {
        peak = Math.max(peak, s);
        min = Math.min(min, s);
      }
    }
  }
  return { peak, min };
}

function landingSettle(tune) {
  const car = makeCar();
  const dry = { name: "Dry", grip: 1.55, max: 98, roll: 0.013 };
  for (let i = 0; i < 60; i++) stepCar(car, FLOOR, dry, DT, tune, DEFAULT_SETUP);
  // Simulate hard landing compression
  for (let i = 0; i < 4; i++) {
    car.susp[i] = 0.5;
    car.suspV[i] = -8;
  }
  let crossings = 0;
  let lastSign = Math.sign(car.suspV[0] || -1);
  let settledAt = null;
  for (let i = 0; i < 180; i++) {
    stepCar(car, { ...FLOOR, throttle: 0 }, dry, DT, tune, DEFAULT_SETUP);
    const v = car.suspV[0];
    const sign = Math.sign(v) || lastSign;
    if (sign !== lastSign && Math.abs(v) > 0.05) crossings += 1;
    lastSign = sign;
    const still = car.susp.every((s, idx) => Math.abs(s - (car.susp[0])) < 0.08) &&
      car.suspV.every((sv) => Math.abs(sv) < 0.15);
    if (still && settledAt == null && i > 10) settledAt = i * DT;
  }
  return { crossings, settledAt };
}

const dry = { name: "Dry", grip: 1.55, max: 98, roll: 0.013 };
const dirt = { name: "Dirt", grip: 0.7, max: 50, roll: 0.05 };
const grass = { name: "Grass", grip: 0.92, max: 72, roll: 0.08 };

const dryTop = topOn(dry, razor.tune);
const dirtTop = topOn(dirt, razor.tune);
const grassTop = topOn(grass, razor.tune);
const bisonDirt = topOn(dirt, bison.tune);
const travelR = suspTravel(razor.tune);
const travelB = suspTravel(bison.tune);
const land = landingSettle(razor.tune);

console.log("=== Razorback pace ===");
console.log(`dry   ${dryTop.toFixed(1)} mph`);
console.log(`dirt  ${dirtTop.toFixed(1)} mph  (${((dirtTop / dryTop) * 100).toFixed(0)}% of dry)`);
console.log(`grass ${grassTop.toFixed(1)} mph  (${((grassTop / dryTop) * 100).toFixed(0)}% of dry)`);
console.log(`bison dirt ${bisonDirt.toFixed(1)} mph`);

console.log("\n=== Suspension travel ===");
console.log(`razorback peak=${travelR.peak.toFixed(3)} min=${travelR.min.toFixed(3)}`);
console.log(`bison      peak=${travelB.peak.toFixed(3)} min=${travelB.min.toFixed(3)}`);
console.log(`ratio      ${(travelR.peak / Math.max(0.01, travelB.peak)).toFixed(2)}×`);

console.log("\n=== Landing settle ===");
console.log(`velocity sign crossings=${land.crossings}  settledAt=${land.settledAt?.toFixed(2) ?? "n/a"}s`);

const checks = [
  ["longTravel flag", !!razor.tune.longTravel],
  ["raised ride look", (razor.look.ride ?? 0) >= 0.1],
  ["dirt ≥ 95% dry", dirtTop / dryTop >= 0.95],
  ["grass ≥ 95% dry", grassTop / dryTop >= 0.95],
  ["travel ~2× other truck", travelR.peak / Math.max(0.01, travelB.peak) >= 1.85],
  ["travel can exceed 0.5", travelR.peak >= 0.5],
  ["landing not wild (≤3 crossings)", land.crossings <= 3],
];

let failed = 0;
console.log("\n=== Pass/fail ===");
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed += 1;
}
process.exit(failed ? 1 : 0);
