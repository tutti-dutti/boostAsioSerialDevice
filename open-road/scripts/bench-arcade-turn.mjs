/**
 * Arcade vs Sim: hold 155 mph, yank full lock for a 90° side-road cut.
 * Usage: npx tsx scripts/bench-arcade-turn.mjs
 */
import { GARAGE } from "../src/drive/garage.ts";
import { DEFAULT_SETUP, makeCar, stepCar } from "../src/drive/sim.ts";

const MPH = 2.23694;
const DRY = { name: "Dry", grip: 1.55, max: 98, roll: 0.013 };
const DT = 1 / 60;
const TARGET_MPH = 155;
const TARGET_MS = TARGET_MPH / MPH;

const STRAIGHT = {
  throttle: 1,
  brake: 0,
  steer: 0,
  handbrake: false,
  clutch: false,
  shiftUp: false,
  shiftDown: false,
};

function runTurn(tune, handling) {
  const setup = { ...DEFAULT_SETUP, handling };
  const car = makeCar();
  // Accelerate / settle to ~155 mph
  for (let i = 0; i < 90 * 60; i++) {
    stepCar(car, STRAIGHT, DRY, DT, tune, setup);
    if (car.speed >= TARGET_MS) break;
  }
  // Trim throttle to hold speed
  for (let i = 0; i < 120; i++) {
    const err = TARGET_MS - car.speed;
    const throttle = err > 0.5 ? 1 : err > 0 ? 0.35 : 0;
    stepCar(car, { ...STRAIGHT, throttle }, DRY, DT, tune, setup);
  }
  const speedIn = car.speed * MPH;
  const yaw0 = car.yaw;
  let maxLat = 0;
  let maxYawRate = 0;
  let flipHint = 0;
  let t90 = null;
  const TURN = { ...STRAIGHT, throttle: 0.55, steer: 1 };
  for (let i = 0; i < 5 * 60; i++) {
    const info = stepCar(car, TURN, DRY, DT, tune, setup);
    maxLat = Math.max(maxLat, Math.abs(car.lat));
    maxYawRate = Math.max(maxYawRate, Math.abs(car.yawRate));
    flipHint = Math.max(flipHint, Math.abs(info.roll || 0), Math.abs(info.pitch || 0));
    const turned = Math.abs(((car.yaw - yaw0 + Math.PI) % (Math.PI * 2)) - Math.PI);
    if (t90 == null && turned >= Math.PI / 2) {
      t90 = (i + 1) * DT;
      break;
    }
  }
  const headingDelta =
    (Math.abs(((car.yaw - yaw0 + Math.PI) % (Math.PI * 2)) - Math.PI) * 180) / Math.PI;
  return {
    handling,
    speedIn,
    speedOut: car.speed * MPH,
    t90,
    headingDelta,
    maxLat,
    maxYawRate,
    flipHint,
    ok:
      t90 != null &&
      t90 < 2.5 &&
      maxLat < 1.5 &&
      Math.abs(car.speed) > 20 &&
      flipHint < 0.85,
  };
}

const cars = [
  "lambchop-minotaur",
  "baguetti-cerberus",
  "king-egg-kraken",
  "ferocity-manticore",
];

console.log("=== Arcade 155 mph → 90° side-road cut ===");
let fail = 0;
for (const id of cars) {
  const entry = GARAGE.find((c) => c.id === id);
  if (!entry) {
    console.log(`MISSING ${id}`);
    fail++;
    continue;
  }
  const arcade = runTurn(entry.tune, "arcade");
  const sim = runTurn(entry.tune, "sim");
  const mark = arcade.ok ? "PASS" : "FAIL";
  if (!arcade.ok) fail++;
  console.log(
    `${mark} ${entry.label.padEnd(26)} arcade t90=${arcade.t90?.toFixed(2) ?? "—"}s lat=${arcade.maxLat.toFixed(3)} yawR=${arcade.maxYawRate.toFixed(2)} in=${arcade.speedIn.toFixed(0)} out=${arcade.speedOut.toFixed(0)} flip=${arcade.flipHint.toFixed(2)}`,
  );
  console.log(
    `     ${"".padEnd(26)} sim    t90=${sim.t90?.toFixed(2) ?? "—"}s lat=${sim.maxLat.toFixed(3)} yawR=${sim.maxYawRate.toFixed(2)} in=${sim.speedIn.toFixed(0)} out=${sim.speedOut.toFixed(0)} (sim may slide)`,
  );
}

if (fail) {
  console.error(`\n${fail} arcade turn check(s) failed`);
  process.exit(1);
}
console.log("\nAll arcade cars planted the 90° cut.");
