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

const famous: Tune = { accel: 1.22, top: 86, offroad: 0.58, drive: "rwd", mass: 1450, cg: 0.42 };
const fastest: Tune = { accel: 1.42, top: 98, offroad: 0.5, drive: "rwd", mass: 1380, cg: 0.4 };
/** Mastodon-class truck: about 6.5s to 60 mph, top near 100 mph. */
const truck: Tune = { accel: 0.35, top: 45, offroad: 1.55, drive: "awd", mass: 2550, cg: 0.72 };
/** Faster trucks (when added): about 4.5–5s to 60. */
export const truckFast: Tune = { accel: 0.48, top: 48, offroad: 1.55, drive: "awd", mass: 2400, cg: 0.68 };

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

/**
 * Official garage list (added in batches).
 * Body style uses free CC0 Kenney Car Kit bases; colors/wings make each unique.
 * Shape references from garage.md are never shown in the game.
 */
export const GARAGE: GarageCar[] = [
  // Supercars → race / race-future
  car("Lambchop", "Chupacabra", "/models/race-future.glb", famous, {
    scale: 1.05, ride: 0.02, wheel: 1.05, color: 0xff6a00, spoiler: true, roofLights: false,
  }, "lambchop"),
  car("Lambchop", "Minotaur", "/models/race-future.glb", fastest, {
    scale: 1.08, ride: 0.02, wheel: 1.08, color: 0xff3b1f, spoiler: true, roofLights: false,
  }, "lambchop"),
  car("Lambchop", "Bonehorn", "/models/race.glb", { ...famous, accel: 1.3, top: 90 }, {
    scale: 1.04, ride: 0.02, wheel: 1.05, color: 0x22e05a, spoiler: true, roofLights: false,
  }, "lambchop"),
  // Sports → sedan-sports / hatchback-sports
  car("Shovel-A", "Thresher", "/models/sedan-sports.glb", famous, {
    scale: 1.02, ride: 0.04, wheel: 1, color: 0xe23b2f, spoiler: true, roofLights: false,
  }, "v8"),
  car("Shovel-A", "Megalodon", "/models/hatchback-sports.glb", fastest, {
    scale: 1.04, ride: 0.03, wheel: 1.05, color: 0x2f6fed, spoiler: true, roofLights: false,
  }, "v8"),
  // Truck → truck
  car("Shovel-A", "Mastodon", "/models/truck.glb", truck, {
    scale: 1.2, ride: 0.08, wheel: 1.15, color: 0x2a3328, spoiler: false, roofLights: true,
  }, "diesel"),
  // Hyper → race-future
  car("Baguetti", "Hellhound", "/models/race-future.glb", famous, {
    scale: 1.06, ride: 0.02, wheel: 1.06, color: 0x1a1c22, spoiler: true, roofLights: false,
  }, "turbo"),
  car("Baguetti", "Cerberus", "/models/race-future.glb", fastest, {
    scale: 1.1, ride: 0.01, wheel: 1.1, color: 0x8d1218, spoiler: true, roofLights: false,
  }, "turbo"),
  car("Ferocity", "Jackal", "/models/hatchback-sports.glb", famous, {
    scale: 1.0, ride: 0.04, wheel: 1, color: 0xd42323, spoiler: true, roofLights: false,
  }, "v8"),
  car("Ferocity", "Manticore", "/models/race.glb", fastest, {
    scale: 1.08, ride: 0.02, wheel: 1.08, color: 0xff5a1f, spoiler: true, roofLights: false,
  }, "v12"),
  car("Porch", "Deathstalker", "/models/sedan-sports.glb", famous, {
    scale: 0.98, ride: 0.05, wheel: 1, color: 0xc8ccd2, spoiler: false, roofLights: false,
  }, "turbo"),
  car("Porch", "Hellbender", "/models/race.glb", fastest, {
    scale: 1.06, ride: 0.02, wheel: 1.06, color: 0x1e3a5f, spoiler: true, roofLights: false,
  }, "v8"),
  car("McRoar", "Pterodactyl", "/models/race-future.glb", famous, {
    scale: 1.05, ride: 0.02, wheel: 1.05, color: 0xff8a00, spoiler: true, roofLights: false,
  }, "v8"),
  car("McRoar", "Great White", "/models/race.glb", fastest, {
    scale: 1.12, ride: 0.01, wheel: 1.02, color: 0xf0f4f8, spoiler: false, roofLights: false,
  }, "v12"),
  car("King Egg", "Leviathan", "/models/race-future.glb", famous, {
    scale: 1.07, ride: 0.02, wheel: 1.08, color: 0xb8ff2a, spoiler: true, roofLights: false,
  }, "v8"),
];

export function carById(id: string) {
  return GARAGE.find((item) => item.id === id) ?? GARAGE[0];
}
