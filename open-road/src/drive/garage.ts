import type { Tune } from "./sim";

export type GarageCar = {
  id: string;
  name: string;
  kind: string;
  note: string;
  model: string;
  tune: Tune;
};

/** Fictional names. The models are CC0 cars from Kenney's Car Kit. */
export const GARAGE: GarageCar[] = [
  {
    id: "comet",
    name: "Comet",
    kind: "Sports",
    note: "Fast on pavement",
    model: "/models/sedan-sports.glb",
    tune: { accel: 1.28, top: 86, offroad: 0.62 },
  },
  {
    id: "dart",
    name: "Dart",
    kind: "Sports",
    note: "Quick, slips off the road",
    model: "/models/hatchback-sports.glb",
    tune: { accel: 1.2, top: 80, offroad: 0.68 },
  },
  {
    id: "arrow",
    name: "Arrow",
    kind: "Sports",
    note: "Highest top speed",
    model: "/models/race.glb",
    tune: { accel: 1.35, top: 92, offroad: 0.55 },
  },
  {
    id: "pulse",
    name: "Pulse",
    kind: "Sports",
    note: "Light and very fast",
    model: "/models/race-future.glb",
    tune: { accel: 1.32, top: 88, offroad: 0.58 },
  },
  {
    id: "harbor",
    name: "Harbor",
    kind: "Car",
    note: "Easy everyday car",
    model: "/models/sedan.glb",
    tune: { accel: 1, top: 72, offroad: 0.95 },
  },
  {
    id: "cab",
    name: "Cab",
    kind: "Car",
    note: "Steady city car",
    model: "/models/taxi.glb",
    tune: { accel: 0.96, top: 70, offroad: 0.95 },
  },
  {
    id: "warden",
    name: "Warden",
    kind: "Car",
    note: "Cruiser with a strong engine",
    model: "/models/police.glb",
    tune: { accel: 1.08, top: 78, offroad: 0.9 },
  },
  {
    id: "ridge",
    name: "Ridge",
    kind: "SUV",
    note: "Better on dirt and grass",
    model: "/models/suv.glb",
    tune: { accel: 0.88, top: 64, offroad: 1.3 },
  },
  {
    id: "summit",
    name: "Summit",
    kind: "SUV",
    note: "Tall and grippy off-road",
    model: "/models/suv-luxury.glb",
    tune: { accel: 0.84, top: 62, offroad: 1.35 },
  },
  {
    id: "hauler",
    name: "Hauler",
    kind: "Truck",
    note: "Slow, climbs and grips",
    model: "/models/truck.glb",
    tune: { accel: 0.68, top: 50, offroad: 1.55 },
  },
  {
    id: "wagon",
    name: "Wagon",
    kind: "Truck",
    note: "Heavy, steady off-road",
    model: "/models/van.glb",
    tune: { accel: 0.74, top: 54, offroad: 1.4 },
  },
  {
    id: "boxer",
    name: "Boxer",
    kind: "Truck",
    note: "Big hauler for rough ground",
    model: "/models/delivery.glb",
    tune: { accel: 0.7, top: 52, offroad: 1.48 },
  },
];

export function carById(id: string) {
  return GARAGE.find((car) => car.id === id) ?? GARAGE[0];
}
