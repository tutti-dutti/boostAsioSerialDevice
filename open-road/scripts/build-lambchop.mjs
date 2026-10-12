/**
 * Builds the three Lambchop supercars as original GLB files.
 * These are not copies of any real car. Each silhouette is its own shape.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";

if (typeof globalThis.FileReader === "undefined") {
  globalThis.FileReader = class {
    constructor() {
      this.result = null;
      this.onloadend = null;
    }
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((buffer) => {
        this.result = buffer;
        if (typeof this.onloadend === "function") this.onloadend();
      });
    }
  };
}

const paint = new THREE.MeshStandardMaterial({
  name: "paint",
  color: 0xffffff,
  metalness: 0.65,
  roughness: 0.22,
});
const glass = new THREE.MeshStandardMaterial({
  name: "glass",
  color: 0x17324a,
  metalness: 0.08,
  roughness: 0.04,
  transparent: true,
  opacity: 0.55,
});
const rubber = new THREE.MeshStandardMaterial({
  name: "rubber",
  color: 0x141414,
  metalness: 0.04,
  roughness: 0.92,
});
const chrome = new THREE.MeshStandardMaterial({
  name: "chrome",
  color: 0xd5dde6,
  metalness: 0.94,
  roughness: 0.16,
});
const dark = new THREE.MeshStandardMaterial({
  name: "dark",
  color: 0x121418,
  metalness: 0.4,
  roughness: 0.55,
});
const head = new THREE.MeshStandardMaterial({
  name: "light-head",
  color: 0xfff6d8,
  emissive: 0xfff3c4,
  emissiveIntensity: 2.4,
  roughness: 0.22,
});
const tail = new THREE.MeshStandardMaterial({
  name: "light-tail",
  color: 0xff2a2a,
  emissive: 0xff1a1a,
  emissiveIntensity: 1.6,
  roughness: 0.28,
});

const TIRE_R = 0.305;
const TIRE_TUBE = 0.074;
const TIRE_AXLE = 1.72;
const TIRE_OUTER = TIRE_R + TIRE_TUBE;

function sample(keys, u) {
  if (u <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (u <= keys[i][0]) {
      const [u0, v0] = keys[i - 1];
      const [u1, v1] = keys[i];
      const t = (u - u0) / (u1 - u0);
      const s = t * t * (3 - 2 * t);
      return v0 + (v1 - v0) * s;
    }
  }
  return keys[keys.length - 1][1];
}

function arch(z, axle, radius, height) {
  const d = Math.abs(z - axle);
  if (d >= radius) return 0;
  const k = 0.5 + 0.5 * Math.cos((d / radius) * Math.PI);
  return height * k;
}

function loft(stations, around, material) {
  const rings = stations.length;
  const pos = [];
  for (const station of stations) {
    const expX = 2 / station.n;
    const expTop = 2 / station.top;
    const expBot = 2 / station.bot;
    for (let j = 0; j < around; j++) {
      const ang = (j / around) * Math.PI * 2;
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      let halfW = station.rx;
      if (s < 0) {
        const down = -s;
        halfW = station.rx * (1 - (1 - station.tuck) * down ** 0.85);
      }
      const x = Math.sign(c || 1) * halfW * Math.abs(c) ** expX;
      const mid = (station.y0 + station.y1) * 0.5;
      const rad = (station.y1 - station.y0) * 0.5;
      const expY = s >= 0 ? expTop : expBot;
      let y = mid + Math.sign(s || 1) * rad * Math.abs(s) ** expY;
      if (s > 0 && station.crown > 0) {
        const shoulder = Math.exp(-((s - 0.38) ** 2) / 0.045) * Math.abs(c);
        y += station.crown * shoulder;
      }
      pos.push(x, y, station.z);
    }
  }
  const idx = [];
  for (let i = 0; i < rings - 1; i++) {
    for (let j = 0; j < around; j++) {
      const a = i * around + j;
      const b = i * around + ((j + 1) % around);
      const c = (i + 1) * around + j;
      const d = (i + 1) * around + ((j + 1) % around);
      idx.push(a, c, b, b, c, d);
    }
  }
  const nose = pos.length / 3;
  pos.push(0, (stations[0].y0 + stations[0].y1) * 0.5, stations[0].z);
  for (let j = 0; j < around; j++) idx.push(nose, (j + 1) % around, j);
  const tailCap = pos.length / 3;
  const last = stations[rings - 1];
  pos.push(0, (last.y0 + last.y1) * 0.5, last.z);
  const base = (rings - 1) * around;
  for (let j = 0; j < around; j++) idx.push(tailCap, base + ((j + 1) % around), base + j);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

function box(w, h, d, material, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(w), h, d), material);
  mesh.position.set(x, y, z);
  return mesh;
}

function wheel(front, left, spokes, x, z) {
  const pivot = new THREE.Group();
  pivot.name = `wheel-${front ? "front" : "back"}-${left ? "left" : "right"}`;
  const spin = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.TorusGeometry(TIRE_R, TIRE_TUBE, 12, 28), rubber);
  tire.rotation.y = Math.PI / 2;
  tire.scale.z = TIRE_AXLE;
  const groove = new THREE.Mesh(new THREE.TorusGeometry(TIRE_OUTER - 0.008, 0.01, 8, 24), dark);
  groove.rotation.y = Math.PI / 2;
  groove.scale.z = TIRE_AXLE * 0.28;
  const rimR = TIRE_R - 0.02;
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(rimR * 0.28, rimR * 0.28, 0.04, 16), dark);
  disc.rotation.z = Math.PI / 2;
  const lip = new THREE.Mesh(new THREE.TorusGeometry(rimR * 0.96, 0.02, 8, 28), chrome);
  lip.rotation.y = Math.PI / 2;
  const bead = new THREE.Mesh(new THREE.TorusGeometry(rimR * 0.78, 0.012, 8, 24), chrome);
  bead.rotation.y = Math.PI / 2;
  spin.add(tire, groove, disc, lip, bead);
  for (let i = 0; i < spokes; i++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.022, rimR * 0.7, 0.07), chrome);
    spoke.geometry.translate(0, rimR * 0.48, 0);
    spoke.rotation.x = (i / spokes) * Math.PI * 2;
    spin.add(spoke);
  }
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 12), chrome);
  cap.rotation.z = Math.PI / 2;
  cap.position.x = left ? -0.03 : 0.03;
  spin.add(cap);
  pivot.add(spin);
  pivot.position.set(left ? -x : x, TIRE_OUTER, z);
  return pivot;
}

function shoot(mesh, x, y, z, dir) {
  const raycaster = new THREE.Raycaster(new THREE.Vector3(x, y, z), new THREE.Vector3(0, 0, Math.sign(dir) || 1));
  const hits = raycaster.intersectObject(mesh, false);
  return hits[0] ?? null;
}

function stick(mesh, material, x, y, z, dir, w, h, d) {
  const hit = shoot(mesh, x, y, z, dir);
  if (!hit) return null;
  const lamp = box(w, h, d, material, hit.point.x, hit.point.y, hit.point.z + Math.sign(dir) * -0.02);
  return lamp;
}

function lamps(style, body, half, hw) {
  const parts = [];
  const y = style.nose + 0.1;
  const xs = [hw * 0.28, hw * 0.48];
  for (const side of [-1, 1]) {
    if (style.lamps === "pill") {
      const lamp = stick(body, head, side * hw * 0.38, y, half + 2, -1, 0.32, 0.09, 0.045);
      if (lamp) parts.push(lamp);
    } else if (style.lamps === "stack") {
      for (let i = 0; i < 3; i++) {
        const lamp = stick(body, head, side * hw * 0.4, y + i * 0.05, half + 2, -1, 0.34, 0.032, 0.04);
        if (lamp) parts.push(lamp);
      }
    } else {
      for (const x of xs) {
        const lamp = stick(body, head, side * x, y + (x > hw * 0.35 ? 0.055 : 0), half + 2, -1, 0.22, 0.04, 0.045);
        if (lamp) {
          lamp.rotation.z = side * (x > hw * 0.35 ? -0.4 : 0.15);
          parts.push(lamp);
        }
      }
    }
  }
  return parts;
}

function tailLamps(style, half, hw) {
  const parts = [];
  const z = -half - 0.02;
  const y = 0.48;
  parts.push(box(hw * 1.35, 0.055, 0.03, tail, 0, y, z));
  for (const side of [-1, 1]) {
    const x = side * hw * 0.46;
    if (style.lamps === "pill") {
      parts.push(box(0.32, 0.08, 0.03, tail, x, y + 0.02, z));
    } else if (style.lamps === "stack") {
      parts.push(box(0.36, 0.03, 0.03, tail, x, y + 0.08, z));
      parts.push(box(0.28, 0.024, 0.03, tail, x * 0.92, y + 0.13, z));
    } else {
      const blade = box(0.4, 0.07, 0.03, tail, x, y + 0.07, z);
      blade.rotation.z = side * 0.16;
      parts.push(blade);
    }
  }
  return parts;
}

function details(style, body, half, hw, frontZ, rearZ) {
  const group = new THREE.Group();
  for (const lamp of lamps(style, body, half, hw)) group.add(lamp);
  for (const lamp of tailLamps(style, half, hw)) group.add(lamp);

  const mirrorY = style.belt + 0.08;
  const mirrorZ = half * 0.02;
  for (const side of [-1, 1]) {
    group.add(box(0.14, 0.02, 0.045, dark, side * (hw + 0.02), mirrorY, mirrorZ));
    group.add(box(0.1, 0.065, 0.13, dark, side * (hw + 0.14), mirrorY + 0.015, mirrorZ));
    group.add(box(0.018, 0.045, 0.09, chrome, side * (hw + 0.19), mirrorY + 0.015, mirrorZ));
    const intake = box(0.025, 0.07, 0.28, dark, side * (hw * 1.005), 0.42, rearZ + 0.62);
    intake.rotation.y = side * -0.2;
    group.add(intake);
  }

  const mouth = shoot(body, 0, style.nose + 0.02, half + 2, -1);
  if (mouth) {
    const mouthW = hw * (0.46 + style.grille * 0.035);
    group.add(box(mouthW, 0.1, 0.04, dark, 0, mouth.point.y, mouth.point.z + 0.01));
    for (let i = 0; i < style.grille; i++) {
      group.add(box(mouthW * 0.82, 0.01, 0.012, chrome, 0, mouth.point.y - 0.04 + i * 0.016, mouth.point.z + 0.03));
    }
  }
  group.add(box(hw * 1.15, 0.022, 0.2, dark, 0, 0.09, frontZ + 0.35));

  group.add(box(hw * 0.7, 0.025, 0.36, dark, 0, style.haunch * 0.62, rearZ + 0.15));
  group.add(box(hw * 0.95, 0.05, 0.14, dark, 0, 0.16, -half + 0.1));
  const tips = style.wing === "race" ? [-0.32, -0.14, 0.14, 0.32] : [-0.22, 0.22];
  for (const x of tips) {
    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.048, 0.07, 12), chrome);
    exhaust.rotation.x = Math.PI / 2;
    exhaust.position.set(x * hw, 0.26, -half - 0.02);
    const liner = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.08, 10), dark);
    liner.rotation.x = Math.PI / 2;
    liner.position.copy(exhaust.position);
    group.add(exhaust, liner);
  }
  return group;
}

function cockpit(style, half, hw) {
  const tub = box(hw * 0.7, 0.18, half * 0.34, dark, 0, style.belt - 0.02, -half * 0.02);
  return tub;
}

function wingOf(style, half, hw) {
  const group = new THREE.Group();
  const z = -half * 0.7;
  if (style.wing === "lip") {
    const lip = box(hw * 1.7, 0.03, 0.18, paint, 0, style.haunch + 0.04, -half * 0.62);
    lip.rotation.x = -0.45;
    group.add(lip);
    return group;
  }
  const rise = style.wing === "race" ? 0.42 : 0.22;
  const y = style.haunch + rise;
  const blade = box(hw * (style.wing === "race" ? 2.2 : 1.9), 0.022, style.wing === "race" ? 0.32 : 0.2, paint, 0, y, z);
  blade.rotation.x = -0.12;
  group.add(blade);
  for (const side of [-1, 1]) {
    group.add(box(0.016, 0.12, 0.22, dark, side * hw * (style.wing === "race" ? 1.08 : 0.92), y - 0.04, z));
    group.add(box(0.02, rise * 0.72, 0.025, dark, side * hw * 0.4, style.haunch + rise * 0.28, z));
  }
  return group;
}

function glassLoft(style, half, hw) {
  const gn = 2.3;
  const section = (z, rx, y0, y1) => ({
    z,
    rx,
    y0,
    y1,
    n: gn,
    top: 2.5,
    bot: 2.2,
    tuck: 0.92,
    crown: 0,
  });
  const belt = style.belt;
  return loft(
    [
      section(half * 0.34, hw * 0.36, belt - 0.04, belt + 0.02),
      section(half * 0.12, hw * 0.58, belt - 0.02, style.roof * 0.86),
      section(-half * 0.04, hw * 0.54, belt, style.roof),
      section(-half * 0.22, hw * 0.3, belt + 0.02, style.roof * 0.7),
    ],
    28,
    glass,
  );
}

function build(style) {
  const root = new THREE.Group();
  root.name = style.id;
  const chassis = new THREE.Group();
  chassis.name = "chassis";
  const half = 2.22 * style.length;
  const hw = 1.02 * style.width;
  const frontZ = half * 0.48;
  const rearZ = -half * 0.46;
  const steps = 28;
  const stations = [];
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const z = half * (1 - 2 * u);
    const rx = hw * sample(style.widthKeys, u);
    const y1 = sample(style.heightKeys, u);
    const y0 = Math.min(y1 - 0.2, 0.1 + arch(z, frontZ, 0.55, 0.46) + arch(z, rearZ, 0.55, 0.48));
    const crown = style.crown * (arch(z, frontZ, 0.42, 1) * 0.35 + arch(z, rearZ, 0.5, 1));
    stations.push({
      z,
      rx,
      y0,
      y1,
      n: style.round,
      top: style.top,
      bot: style.bot,
      tuck: 0.6 + arch(z, frontZ, 0.5, 0.12) + arch(z, rearZ, 0.52, 0.14),
      crown,
    });
  }
  const body = loft(stations, 42, paint);
  body.name = "body";
  const cabin = glassLoft(style, half, hw);
  cabin.name = "glass";
  chassis.add(body, cabin, cockpit(style, half, hw));
  root.add(chassis);
  root.updateMatrixWorld(true);
  chassis.add(details(style, body, half, hw, frontZ, rearZ));
  chassis.add(wingOf(style, half, hw));

  const track = hw * 0.72;
  for (const left of [true, false]) {
    root.add(wheel(true, left, style.spokes, track, frontZ));
    root.add(wheel(false, left, style.spokes, track + 0.03, rearZ));
  }
  return root;
}

const widthKeys = (nose) => [
  [0, nose],
  [0.14, 0.78],
  [0.28, 1.02],
  [0.48, 1.0],
  [0.7, 1.1],
  [0.88, 1.04],
  [1, 0.96],
];

const styles = [
  {
    id: "chupacabra",
    file: "lambchop-chupacabra.glb",
    length: 1,
    width: 1,
    round: 3.4,
    top: 4.4,
    bot: 3,
    nose: 0.36,
    belt: 0.7,
    haunch: 0.98,
    roof: 1.14,
    crown: 0.05,
    wing: "sport",
    spokes: 5,
    grille: 4,
    lamps: "blade",
    widthKeys: widthKeys(0.2),
    heightKeys: [
      [0, 0.38],
      [0.2, 0.86],
      [0.42, 0.74],
      [0.72, 1.02],
      [1, 0.76],
    ],
  },
  {
    id: "minotaur",
    file: "lambchop-minotaur.glb",
    length: 1.12,
    width: 1.06,
    round: 5.2,
    top: 6.2,
    bot: 3.8,
    nose: 0.3,
    belt: 0.68,
    haunch: 1.1,
    roof: 1.06,
    crown: 0.07,
    wing: "race",
    spokes: 10,
    grille: 6,
    lamps: "stack",
    widthKeys: widthKeys(0.12),
    heightKeys: [
      [0, 0.32],
      [0.18, 0.84],
      [0.4, 0.7],
      [0.74, 1.14],
      [1, 0.84],
    ],
  },
  {
    id: "bonehorn",
    file: "lambchop-bonehorn.glb",
    length: 0.92,
    width: 0.98,
    round: 2.2,
    top: 2.8,
    bot: 2.2,
    nose: 0.42,
    belt: 0.74,
    haunch: 0.86,
    roof: 1.22,
    crown: 0.02,
    wing: "lip",
    spokes: 7,
    grille: 3,
    lamps: "pill",
    widthKeys: widthKeys(0.34),
    heightKeys: [
      [0, 0.46],
      [0.22, 0.84],
      [0.48, 0.78],
      [0.74, 0.9],
      [1, 0.68],
    ],
  },
];

mkdirSync(new URL("../public/models/", import.meta.url), { recursive: true });
for (const style of styles) {
  const model = build(style);
  let tris = 0;
  model.traverse((obj) => {
    if (obj.isMesh && obj.geometry?.index) tris += obj.geometry.index.count / 3;
  });
  const exporter = new GLTFExporter();
  const glb = await exporter.parseAsync(model, { binary: true });
  const file = new URL(`../public/models/${style.file}`, import.meta.url);
  writeFileSync(file, Buffer.from(glb));
  console.log(style.file, Buffer.from(glb).length, "tris", Math.round(tris));
}
