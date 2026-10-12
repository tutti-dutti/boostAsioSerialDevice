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
 * Body style is chosen from the shape guide and is never shown.
 */
export const GARAGE: GarageCar[] = [
  car("Lambchop", "Chupacabra", "/models/lambchop-chupacabra.glb", famous, {
    scale: 1, ride: 0.04, wheel: 1, color: 0xff6a00, spoiler: false, roofLights: false, realistic: true,
  }, "lambchop"),
  car("Lambchop", "Minotaur", "/models/lambchop-minotaur.glb", fastest, {
    scale: 1, ride: 0.04, wheel: 1, color: 0xff3b1f, spoiler: false, roofLights: false, realistic: true,
  }, "lambchop"),
  car("Lambchop", "Bonehorn", "/models/lambchop-bonehorn.glb", { ...famous, accel: 1.3, top: 90 }, {
    scale: 1, ride: 0.04, wheel: 1, color: 0x22e05a, spoiler: false, roofLights: false, realistic: true,
  }, "lambchop"),
  car("Shovel-A", "Thresher", "/models/shovel-thresher.glb", famous, {
    scale: 1, ride: 0.06, wheel: 1, color: 0xe23b2f, spoiler: true, roofLights: false, realistic: true,
  }, "v8"),
  car("Shovel-A", "Megalodon", "/models/shovel-megalodon.glb", fastest, {
    scale: 1, ride: 0.05, wheel: 1, color: 0x2f6fed, spoiler: true, roofLights: false, realistic: true,
  }, "v8"),
  car("Shovel-A", "Mastodon", "/models/shovel-mastodon.glb", truck, {
    scale: 1, ride: 0.02, wheel: 1, color: 0x2a3328, spoiler: false, roofLights: false, realistic: true,
  }, "diesel"),
  car("Baguetti", "Hellhound", "/models/baguetti-hellhound.glb", famous, {
    scale: 1, ride: 0.04, wheel: 1, color: 0x1a1c22, spoiler: false, roofLights: false, realistic: true,
  }, "turbo"),
  car("Baguetti", "Cerberus", "/models/baguetti-cerberus.glb", fastest, {
    scale: 1, ride: 0.03, wheel: 1, color: 0x8d1218, spoiler: true, roofLights: false, realistic: true,
  }, "turbo"),
  car("Ferocity", "Jackal", "/models/ferocity-jackal.glb", famous, {
    scale: 1, ride: 0.05, wheel: 1, color: 0xd42323, spoiler: true, roofLights: false, realistic: true,
  }, "v8"),
  car("Ferocity", "Manticore", "/models/ferocity-manticore.glb", fastest, {
    scale: 1, ride: 0.03, wheel: 1, color: 0xff5a1f, spoiler: true, roofLights: false, realistic: true,
  }, "v12"),
  car("Porch", "Deathstalker", "/models/porch-deathstalker.glb", famous, {
    scale: 1, ride: 0.05, wheel: 1, color: 0xc8ccd2, spoiler: false, roofLights: false, realistic: true,
  }, "turbo"),
  car("Porch", "Hellbender", "/models/porch-hellbender.glb", fastest, {
    scale: 1, ride: 0.03, wheel: 1, color: 0x1e3a5f, spoiler: true, roofLights: false, realistic: true,
  }, "v8"),
  car("McRoar", "Pterodactyl", "/models/mcroar-pterodactyl.glb", famous, {
    scale: 1, ride: 0.03, wheel: 1, color: 0xff8a00, spoiler: true, roofLights: false, realistic: true,
  }, "v8"),
  car("McRoar", "Great White", "/models/mcroar-great-white.glb", fastest, {
    scale: 1, ride: 0.02, wheel: 1, color: 0xf0f4f8, spoiler: false, roofLights: false, realistic: true,
  }, "v12"),
  car("King Egg", "Leviathan", "/models/king-egg-leviathan.glb", famous, {
    scale: 1, ride: 0.03, wheel: 1, color: 0xb8ff2a, spoiler: true, roofLights: false, realistic: true,
  }, "v8"),
];

export function carById(id: string) {
  return GARAGE.find((item) => item.id === id) ?? GARAGE[0];
}
