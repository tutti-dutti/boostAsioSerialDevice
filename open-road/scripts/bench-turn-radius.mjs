/**
 * Measure low-speed turning circle + 25–45 mph 90° cuts.
 * Target: ~35 ft (10.7 m) curb-to-curb diameter at crawl.
 * Usage: npx tsx scripts/bench-turn-radius.mjs
 */
import { GARAGE } from "../src/drive/garage.ts";
import { DEFAULT_SETUP, makeCar, stepCar } from "../src/drive/sim.ts";

const MPH = 2.23694;
const FT = 3.28084;
const DRY = { name: "Dry", grip: 1.55, max: 98, roll: 0.013 };
const DT = 1 / 60;

function holdSpeed(car, tune, setup, targetMs, seconds = 2) {
  for (let i = 0; i < seconds * 60; i++) {
    const err = targetMs - car.speed;
    const throttle = err > 1 ? 1 : err > 0 ? 0.4 : 0;
    const brake = err < -2 ? Math.min(0.4, -err * 0.1) : 0;
    stepCar(car, { throttle, brake, steer: 0, handbrake: false, clutch: false, shiftUp: false, shiftDown: false }, DRY, DT, tune, setup);
  }
}

function turningDiameterFt(tune, handling, crawlMph = 12) {
  const setup = { ...DEFAULT_SETUP, handling };
  const car = makeCar();
  const target = crawlMph / MPH;
  for (let i = 0; i < 20 * 60; i++) {
    stepCar(car, { throttle: 1, brake: 0, steer: 0, handbrake: false, clutch: false, shiftUp: false, shiftDown: false }, DRY, DT, tune, setup);
    if (car.speed >= target) break;
  }
  holdSpeed(car, tune, setup, target, 1.5);
  let minX = car.x,
    maxX = car.x,
    minZ = car.z,
    maxZ = car.z;
  const yaw0 = car.yaw;
  for (let i = 0; i < 12 * 60; i++) {
    stepCar(
      car,
      { throttle: 0.35, brake: 0, steer: 1, handbrake: false, clutch: false, shiftUp: false, shiftDown: false },
      DRY,
      DT,
      tune,
      setup,
    );
    minX = Math.min(minX, car.x);
    maxX = Math.max(maxX, car.x);
    minZ = Math.min(minZ, car.z);
    maxZ = Math.max(maxZ, car.z);
    const turned = Math.abs(((car.yaw - yaw0 + Math.PI) % (Math.PI * 2)) - Math.PI);
    if (turned >= Math.PI * 2 - 0.15) break; // full circle-ish
  }
  const diamM = Math.max(maxX - minX, maxZ - minZ);
  return diamM * FT;
}

function ninetyAtMph(tune, handling, mph) {
  const setup = { ...DEFAULT_SETUP, handling };
  const car = makeCar();
  const target = mph / MPH;
  for (let i = 0; i < 40 * 60; i++) {
    stepCar(car, { throttle: 1, brake: 0, steer: 0, handbrake: false, clutch: false, shiftUp: false, shiftDown: false }, DRY, DT, tune, setup);
    if (car.speed >= target) break;
  }
  holdSpeed(car, tune, setup, target, 1);
  const yaw0 = car.yaw;
  for (let i = 0; i < 4 * 60; i++) {
    stepCar(
      car,
      { throttle: 0.45, brake: 0, steer: 1, handbrake: false, clutch: false, shiftUp: false, shiftDown: false },
      DRY,
      DT,
      tune,
      setup,
    );
    const turned = Math.abs(((car.yaw - yaw0 + Math.PI) % (Math.PI * 2)) - Math.PI);
    if (turned >= Math.PI / 2) return (i + 1) * DT;
  }
  return null;
}

const sports = GARAGE.find((c) => c.id === "lambchop-minotaur");
const truck = GARAGE.find((c) => c.id === "headbutt-thunder-bison") || GARAGE.find((c) => c.tune.mass >= 2300);

console.log("=== Turning circle (crawl ~12 mph, full lock) — target ~35 ft diameter ===");
for (const entry of [sports, truck].filter(Boolean)) {
  for (const handling of ["arcade", "sim"]) {
    const d = turningDiameterFt(entry.tune, handling);
    const ok = d >= 28 && d <= 42;
    console.log(`${ok ? "PASS" : "WARN"} ${entry.label.padEnd(26)} ${handling.padEnd(6)} diam=${d.toFixed(1)} ft`);
  }
}

console.log("\n=== 90° cut times at 25 / 35 / 45 mph (Arcade) — should be easy (<1.4s) ===");
let fail = 0;
for (const mph of [25, 35, 45]) {
  const t = ninetyAtMph(sports.tune, "arcade", mph);
  const ok = t != null && t < 1.4;
  if (!ok) fail++;
  console.log(`${ok ? "PASS" : "FAIL"} ${mph} mph → 90° in ${t?.toFixed(2) ?? "—"}s`);
}

if (fail) process.exit(1);
console.log("\nTurning radius checks OK.");
