import type { EngineVoice } from "./audio";
import type { CarLook } from "./car";
import type { Tune } from "./sim";

export type GarageCar = {
  id: string;
  brand: string;
  name: string;
  /** Shown in the game: brand plus name. */
  label: string;
  model: string;
  tune: Tune;
  look: CarLook;
  voice: EngineVoice;
};

/** mph ↔ m/s helpers for readable garage tuning. */
const mph = (v: number) => v / 2.23694;

const famous: Tune = { accel: 1.22, top: mph(210), offroad: 0.58, drive: "rwd", mass: 1450, cg: 0.42 };
const fastest: Tune = { accel: 1.42, top: mph(245), offroad: 0.5, drive: "rwd", mass: 1380, cg: 0.4 };
/** Third-fastest overall (~273 mph). */
const baguettiTop: Tune = { accel: 1.55, top: mph(273), offroad: 0.48, drive: "awd", mass: 1450, cg: 0.38 };
/** Second-fastest — King Egg Leviathan (~280 mph). */
const leviathan: Tune = { accel: 1.85, top: mph(280), offroad: 0.45, drive: "awd", mass: 1350, cg: 0.36, hyper: true };
/** Fastest in the game — King Egg Kraken (~310 mph). */
const kraken: Tune = { accel: 2.15, top: mph(310), offroad: 0.42, drive: "awd", mass: 1320, cg: 0.34, hyper: true };

/** Mastodon-class truck: slower on pavement, strong off-road. */
const truck: Tune = { accel: 0.35, top: mph(100), offroad: 1.55, drive: "awd", mass: 2550, cg: 0.72 };
/** Faster trucks (Raptor / TRX class). */
export const truckFast: Tune = { accel: 0.48, top: mph(110), offroad: 1.55, drive: "awd", mass: 2400, cg: 0.68 };
/** Heavy-duty / calmer trucks. */
const truckHeavy: Tune = { accel: 0.3, top: mph(95), offroad: 1.6, drive: "awd", mass: 2800, cg: 0.75 };
/** Mid-size lifted pickup. */
const truckMid: Tune = { accel: 0.4, top: mph(105), offroad: 1.5, drive: "awd", mass: 2300, cg: 0.7 };
/**
 * Rivian-style EV truck: ~1.5s 0–60 (quickest launch in the game), ~125 mph top.
 * Instant single-speed shove + sticky launch grip; highway tops stay with supercars.
 */
const swampBeast: Tune = {
  accel: 2.45,
  top: mph(125),
  offroad: 1.45,
  drive: "awd",
  mass: 2500,
  cg: 0.68,
  singleSpeed: true,
  launchGrip: true,
};

function car(
  brand: string,
  name: string,
  model: string,
  tune: Tune,
  look: CarLook,
  voice: EngineVoice,
): GarageCar {
  const id = `${brand}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return { id, brand, name, label: `${brand} ${name}`, model, tune, look, voice };
}

const look = (color: number): CarLook => ({
  scale: 1, ride: 0, wheel: 1, color, spoiler: false, roofLights: false, realistic: true,
});

/**
 * Official garage list — every car is a unique hand-built GLB (no shared hatchback).
 * Grouped by brand. Shape refs are never shown to the player.
 */
export const GARAGE: GarageCar[] = [
  // Lambchop
  car("Lambchop", "Chupacabra", "/models/lambchop-chupacabra.glb", famous, look(0xff6a00), "lambchop"),
  car("Lambchop", "Minotaur", "/models/lambchop-minotaur.glb", fastest, look(0xff3b1f), "lambchop"),
  car("Lambchop", "Bonehorn", "/models/lambchop-bonehorn.glb", { ...famous, accel: 1.3, top: mph(220) }, look(0x22e05a), "lambchop"),
  // Shovel-A
  car("Shovel-A", "Thresher", "/models/shovel-thresher.glb", famous, look(0xe23b2f), "v8"),
  car("Shovel-A", "Megalodon", "/models/shovel-megalodon.glb", fastest, look(0x2f6fed), "v8"),
  car("Shovel-A", "Mastodon", "/models/shovel-mastodon.glb", truck, look(0x8a8e92), "diesel"),
  // Baguetti
  car("Baguetti", "Hellhound", "/models/baguetti-hellhound.glb", famous, look(0xc41e2a), "turbo"),
  car("Baguetti", "Cerberus", "/models/baguetti-cerberus.glb", baguettiTop, look(0xb8c4d4), "turbo"),
  // Ferocity
  car("Ferocity", "Jackal", "/models/ferocity-jackal.glb", famous, look(0xd42323), "v8"),
  car("Ferocity", "Manticore", "/models/ferocity-manticore.glb", fastest, look(0xff2a1f), "v12"),
  // Porch
  car("Porch", "Deathstalker", "/models/porch-deathstalker.glb", famous, look(0xc8ccd2), "turbo"),
  car("Porch", "Hellbender", "/models/porch-hellbender.glb", fastest, look(0x3d6fa8), "v8"),
  // McRoar
  car("McRoar", "Pterodactyl", "/models/mcroar-pterodactyl.glb", famous, look(0xff8a00), "v8"),
  car("McRoar", "Great White", "/models/mcroar-great-white.glb", fastest, look(0xf0f4f8), "v12"),
  // King Egg — fastest brand in the game
  car("King Egg", "Leviathan", "/models/king-egg-leviathan.glb", leviathan, look(0xb8ff2a), "v8"),
  car("King Egg", "Kraken", "/models/king-egg-kraken.glb", kraken, look(0xe8ecf0), "v12"),
  // Fjord
  car("Fjord", "Razorback", "/models/fjord-razorback.glb", truckFast, look(0xc45a12), "diesel"),
  // Beep
  car("Beep", "Sabertooth", "/models/beep-sabertooth.glb", truckFast, look(0x6b7358), "diesel"),
  // Headbutt
  car("Headbutt", "Thunder Bison", "/models/headbutt-thunder-bison.glb", truck, look(0xb8bcc2), "diesel"),
  car("Headbutt", "Tyrannosaur", "/models/headbutt-tyrannosaur.glb", truckFast, look(0x1a1c20), "diesel"),
  car("Headbutt", "Mammoth", "/models/headbutt-mammoth.glb", truckHeavy, look(0x4a5a3a), "diesel"),
  // GRR
  car("GRR", "Grizzly", "/models/grr-grizzly.glb", truck, look(0xd0d4d8), "diesel"),
  // Coyota
  car("Coyota", "Tasmanian Devil", "/models/coyota-tasmanian-devil.glb", truckMid, look(0x2a4a2e), "diesel"),
  // Voltra
  car("Voltra", "Ankylosaur", "/models/voltra-ankylosaur.glb", truck, look(0xc8ced4), "ev"),
  // Bummer — army tan Hummer H1 (no bed)
  car("Bummer", "War Hippo", "/models/bummer-war-hippo.glb", truckHeavy, look(0x9a8b5c), "diesel"),
  // River Run
  car("River Run", "Swamp Beast", "/models/river-run-swamp-beast.glb", swampBeast, look(0x1e3a4a), "ev"),
];

export function carById(id: string) {
  return GARAGE.find((item) => item.id === id) ?? GARAGE[0];
}
