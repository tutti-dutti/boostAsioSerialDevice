/**
 * Floor-test garage tunes: King Egg / Cerberus top speeds + Swamp Beast 0–60.
 * Usage: npx tsx scripts/bench-speeds.mjs
 */
import { GARAGE } from "../src/drive/garage.ts";
import { DEFAULT_SETUP, makeCar, stepCar } from "../src/drive/sim.ts";

const MPH = 2.23694;
const DRY = { name: "Dry", grip: 1.55, max: 98, roll: 0.013 };
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

function toMph(ms) {
  return ms * MPH;
}

function floorTop(tune, seconds = 90) {
  const car = makeCar();
  let peak = 0;
  let peakYaw = 0;
  let peakLat = 0;
  const steps = Math.ceil(seconds / DT);
  for (let i = 0; i < steps; i++) {
    stepCar(car, FLOOR, DRY, DT, tune, DEFAULT_SETUP);
    peak = Math.max(peak, Math.abs(car.speed));
    if (Math.abs(car.speed) > 40) {
      peakYaw = Math.max(peakYaw, Math.abs(car.yawRate));
      peakLat = Math.max(peakLat, Math.abs(car.lat));
    }
  }
  return { peakMph: toMph(peak), peakYaw, peakLat, gear: car.gear, reverse: car.reverse };
}

function zeroToSixty(tune, maxSeconds = 12) {
  const car = makeCar();
  const target = 60 / MPH;
  const steps = Math.ceil(maxSeconds / DT);
  for (let i = 0; i < steps; i++) {
    stepCar(car, FLOOR, DRY, DT, tune, DEFAULT_SETUP);
    if (car.speed >= target) return { t: (i + 1) * DT, mph: toMph(car.speed) };
  }
  return { t: null, mph: toMph(car.speed) };
}

const ids = [
  "king-egg-kraken",
  "king-egg-leviathan",
  "baguetti-cerberus",
  "river-run-swamp-beast",
  "ferocity-manticore",
  "lambchop-minotaur",
];

console.log("=== Top-speed floor tests (dry road, straight) ===");
const tops = [];
for (const id of ids) {
  const entry = GARAGE.find((c) => c.id === id);
  if (!entry) {
    console.log(`MISSING ${id}`);
    continue;
  }
  const r = floorTop(entry.tune);
  tops.push({ id, ...r, listed: entry.tune.top * MPH });
  console.log(
    `${entry.label.padEnd(28)} listed=${(entry.tune.top * MPH).toFixed(0)}  peak=${r.peakMph.toFixed(1)} mph  yaw=${r.peakYaw.toFixed(3)}  lat=${r.peakLat.toFixed(3)}`,
  );
}

console.log("\n=== 0–60 launch comparison ===");
const swamp = GARAGE.find((c) => c.id === "river-run-swamp-beast");
const z60 = zeroToSixty(swamp.tune);
const krakenZ = zeroToSixty(GARAGE.find((c) => c.id === "king-egg-kraken").tune);
const leviZ = zeroToSixty(GARAGE.find((c) => c.id === "king-egg-leviathan").tune);
console.log(`Swamp Beast 0–60: ${z60.t == null ? "FAIL" : z60.t.toFixed(2) + "s"}  (at ${z60.mph.toFixed(1)} mph)`);
console.log(`Kraken 0–60:      ${krakenZ.t == null ? "FAIL" : krakenZ.t.toFixed(2) + "s"}`);
console.log(`Leviathan 0–60:   ${leviZ.t == null ? "FAIL" : leviZ.t.toFixed(2) + "s"}`);

console.log("\n=== Ranking check ===");
const order = ["king-egg-kraken", "king-egg-leviathan", "baguetti-cerberus", "ferocity-manticore"];
const ranked = order.map((id) => tops.find((t) => t.id === id)).filter(Boolean);
for (let i = 0; i < ranked.length - 1; i++) {
  const ok = ranked[i].peakMph > ranked[i + 1].peakMph;
  console.log(`${ranked[i].id} ${ok ? ">" : "!>"} ${ranked[i + 1].id}  (${ranked[i].peakMph.toFixed(1)} vs ${ranked[i + 1].peakMph.toFixed(1)})`);
}

const kraken = tops.find((t) => t.id === "king-egg-kraken");
const levi = tops.find((t) => t.id === "king-egg-leviathan");
const cerb = tops.find((t) => t.id === "baguetti-cerberus");
const swampTop = tops.find((t) => t.id === "river-run-swamp-beast");

const checks = [
  ["Kraken ~310", kraken && kraken.peakMph >= 300 && kraken.peakMph <= 315],
  ["Leviathan ~280", levi && levi.peakMph >= 270 && levi.peakMph <= 285],
  ["Cerberus ~273", cerb && cerb.peakMph >= 265 && cerb.peakMph <= 278],
  ["Kraken > Leviathan", kraken && levi && kraken.peakMph > levi.peakMph],
  ["Leviathan > Cerberus", levi && cerb && levi.peakMph > cerb.peakMph],
  ["Swamp top ~125", swampTop && swampTop.peakMph >= 118 && swampTop.peakMph <= 128],
  ["Swamp 0–60 ~1.5s", z60.t != null && z60.t >= 1.2 && z60.t <= 1.75],
  ["Swamp quicker launch than Kraken", z60.t != null && krakenZ.t != null && z60.t < krakenZ.t],
  ["Swamp quicker launch than Leviathan", z60.t != null && leviZ.t != null && z60.t < leviZ.t],
  ["Kraken stable (yaw)", kraken && kraken.peakYaw < 0.35],
  ["Leviathan stable (yaw)", levi && levi.peakYaw < 0.35],
];

let failed = 0;
console.log("\n=== Pass/fail ===");
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed += 1;
}
process.exit(failed ? 1 : 0);
