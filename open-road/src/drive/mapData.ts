/** Roads, lake, and the spot the car starts. The minimap uses this too. */

export const LAKE = { x: 320, z: -300, r: 48 };
export const SPAWN = { x: -70, z: 4, yaw: Math.PI / 2 };

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
