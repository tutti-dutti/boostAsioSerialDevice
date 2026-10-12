import type { Tune } from "./sim";
import type { CarLook } from "./car";

export type GarageCar = {
  id: string;
  brand: string;
  name: string;
  /** Shown in the game: brand plus name. */
  label: string;
  model: string;
  tune: Tune;
  look: CarLook;
};

const famous: Tune = { accel: 1.22, top: 86, offroad: 0.58, drive: "rwd", mass: 1450, cg: 0.42 };
const fastest: Tune = { accel: 1.42, top: 98, offroad: 0.5, drive: "rwd", mass: 1380, cg: 0.4 };
const truck: Tune = { accel: 0.64, top: 48, offroad: 1.6, drive: "rwd", mass: 2900, cg: 0.84 };

function car(
  brand: string,
  name: string,
  model: string,
  tune: Tune,
  look: CarLook,
): GarageCar {
  const id = `${brand}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return { id, brand, name, label: `${brand} ${name}`, model, tune, look };
}

/**
 * First 10 vehicles from the official garage list.
 * Body style is chosen from the shape guide and is never shown.
 */
export const GARAGE: GarageCar[] = [
  car("Lambchop", "Chupacabra", "/models/race-future.glb", famous, {
    scale: 1.72, ride: 0.02, wheel: 1.05, color: 0xf2c14e, spoiler: true, roofLights: false,
  }),
  car("Lambchop", "Minotaur", "/models/race-future.glb", fastest, {
    scale: 1.8, ride: 0, wheel: 1.1, color: 0xf4f4f4, spoiler: true, roofLights: false,
  }),
  car("Lambchop", "Bonehorn", "/models/race-future.glb", { ...famous, accel: 1.3, top: 90 }, {
    scale: 1.66, ride: 0.01, wheel: 1.02, color: 0x3ddc7a, spoiler: true, roofLights: false,
  }),
  car("Shovel-A", "Thresher", "/models/sedan-sports.glb", famous, {
    scale: 1.82, ride: 0.05, wheel: 1, color: 0xe23b2f, spoiler: true, roofLights: false,
  }),
  car("Shovel-A", "Megalodon", "/models/sedan-sports.glb", fastest, {
    scale: 1.74, ride: 0.01, wheel: 1.14, color: 0x2f6fed, spoiler: true, roofLights: false,
  }),
  car("Shovel-A", "Mastodon", "/models/truck.glb", truck, {
    scale: 2.15, ride: 0.2, wheel: 1.28, color: 0x2f6b3a, spoiler: false, roofLights: true,
  }),
  car("Baguetti", "Hellhound", "/models/race-future.glb", famous, {
    scale: 1.9, ride: 0.02, wheel: 1.08, color: 0x1a1c22, spoiler: false, roofLights: false,
  }),
  car("Baguetti", "Cerberus", "/models/race-future.glb", fastest, {
    scale: 1.96, ride: 0, wheel: 1.16, color: 0x8d1218, spoiler: true, roofLights: false,
  }),
  car("Ferocity", "Jackal", "/models/sedan-sports.glb", famous, {
    scale: 1.64, ride: 0.03, wheel: 1, color: 0xd42323, spoiler: true, roofLights: false,
  }),
  car("Ferocity", "Manticore", "/models/race-future.glb", fastest, {
    scale: 1.78, ride: 0, wheel: 1.08, color: 0xff5a1f, spoiler: true, roofLights: false,
  }),
];

export function carById(id: string) {
  return GARAGE.find((item) => item.id === id) ?? GARAGE[0];
}
