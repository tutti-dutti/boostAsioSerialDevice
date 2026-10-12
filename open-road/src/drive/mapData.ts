/** Roads, lake, buildings, and the spot the car starts. The minimap uses this too. */

export const LAKE = { x: 320, z: -300, r: 48 };
export const SPAWN = { x: -70, z: 4, yaw: Math.PI / 2 };

export type BuildingDef = {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  color: string;
  roof: string;
};

/** Houses and shops. The ground under each one is flattened so the walls sit flat. */
export const BUILDINGS: BuildingDef[] = [
  // Small town, northeast of the crossroads.
  { x: 34, z: 30, w: 12, d: 10, h: 7, color: "#efe6d6", roof: "#8d3a32" },
  { x: 34, z: 52, w: 11, d: 10, h: 8, color: "#f2efe6", roof: "#4a433c" },
  { x: 34, z: 76, w: 13, d: 11, h: 6.5, color: "#e7d3c0", roof: "#6e4a38" },
  { x: 56, z: 30, w: 10, d: 12, h: 9, color: "#f7f1e4", roof: "#8d3a32" },
  { x: 78, z: 32, w: 16, d: 12, h: 12, color: "#efe4d4", roof: "#3e2a28" },
  { x: 102, z: 30, w: 12, d: 10, h: 7, color: "#eadfce", roof: "#8d3a32" },
  { x: 124, z: 36, w: 11, d: 10, h: 7, color: "#f3e9da", roof: "#4a433c" },
  { x: 56, z: 56, w: 12, d: 11, h: 8, color: "#e8dcc8", roof: "#6e4a38" },
  { x: 78, z: 56, w: 11, d: 10, h: 8, color: "#efe6d6", roof: "#8d3a32" },
  { x: 102, z: 56, w: 14, d: 11, h: 7.5, color: "#f7f1e4", roof: "#4a433c" },
  { x: 56, z: 84, w: 14, d: 12, h: 9, color: "#f2efe6", roof: "#8d3a32" },
  { x: 104, z: 86, w: 13, d: 13, h: 15, color: "#e7e0d4", roof: "#3e2a28" },
  // Northwest block.
  { x: -34, z: 32, w: 12, d: 10, h: 7, color: "#efe6d6", roof: "#8d3a32" },
  { x: -56, z: 34, w: 14, d: 11, h: 8, color: "#f7f1e4", roof: "#4a433c" },
  { x: -80, z: 36, w: 12, d: 12, h: 6.5, color: "#eadfce", roof: "#6e4a38" },
  { x: -104, z: 40, w: 12, d: 11, h: 8, color: "#e8dcc8", roof: "#8d3a32" },
  { x: -38, z: 58, w: 11, d: 10, h: 9, color: "#f3e9da", roof: "#4a433c" },
  { x: -64, z: 64, w: 15, d: 12, h: 7, color: "#efe4d4", roof: "#8d3a32" },
  { x: -96, z: 66, w: 12, d: 12, h: 8, color: "#f2efe6", roof: "#3e2a28" },
  // A few houses south of the main road.
  { x: 42, z: -36, w: 13, d: 11, h: 7, color: "#efe6d6", roof: "#8d3a32" },
  { x: 70, z: -42, w: 12, d: 12, h: 8, color: "#f7f1e4", roof: "#4a433c" },
  { x: 100, z: -40, w: 11, d: 10, h: 6.5, color: "#eadfce", roof: "#6e4a38" },
  { x: -42, z: -36, w: 14, d: 11, h: 7, color: "#e8dcc8", roof: "#8d3a32" },
  { x: -74, z: -44, w: 12, d: 12, h: 9, color: "#f3e9da", roof: "#4a433c" },
  // Lonely houses out in the hills.
  { x: -560, z: 420, w: 12, d: 10, h: 6, color: "#e7d3c0", roof: "#6e4a38" },
  { x: 680, z: 220, w: 14, d: 11, h: 7, color: "#efe6d6", roof: "#8d3a32" },
  { x: 460, z: -560, w: 12, d: 12, h: 6.5, color: "#f2efe6", roof: "#4a433c" },
  { x: -220, z: -640, w: 13, d: 11, h: 7, color: "#eadfce", roof: "#6e4a38" },
];

/** Flat pads that are not houses: gas station, barn, fountain. */
export const PADS: { x: number; z: number; hx: number; hz: number }[] = [
  { x: 155, z: 70, hx: 12, hz: 9 },
  { x: 190, z: 175, hx: 9, hz: 7 },
  { x: 206, z: 188, hx: 4, hz: 4 },
  { x: 78, z: 108, hx: 7, hz: 7 },
];

export type RoadDef = {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  width: number;
  /** 1 = pavement. Lower = dirt. */
  grip: number;
};

/** Loose or slick ground. Wet sits on the main road. Mud and ice are off to the side. */
export const PATCHES: { name: string; x: number; z: number; hx: number; hz: number; mu: number; max: number }[] = [
  { name: "Wet", x: 90, z: 0, hx: 55, hz: 11, mu: 0.62, max: 70 },
  { name: "Mud", x: -170, z: 70, hx: 24, hz: 16, mu: 0.34, max: 18 },
  { name: "Ice", x: 210, z: -36, hx: 30, hz: 18, mu: 0.2, max: 24 },
];

export const ROADS: RoadDef[] = [
  { x1: -380, z1: 0, x2: 380, z2: 0, width: 18, grip: 1 },
  { x1: 0, z1: -380, x2: 0, z2: 380, width: 18, grip: 1 },
  { x1: -240, z1: -240, x2: 240, z2: -240, width: 14, grip: 1 },
  { x1: 240, z1: -240, x2: 240, z2: 240, width: 14, grip: 1 },
  { x1: 240, z1: 240, x2: -240, z2: 240, width: 14, grip: 1 },
  { x1: -240, z1: 240, x2: -240, z2: -240, width: 14, grip: 1 },
  { x1: -110, z1: 70, x2: -280, z2: 200, width: 8, grip: 0.7 },
  { x1: 90, z1: -70, x2: 300, z2: -250, width: 11, grip: 1 },
];
