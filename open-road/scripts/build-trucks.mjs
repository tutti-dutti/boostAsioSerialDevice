/**
 * Hand-builds the truck batch: each truck is its own original GLB with a
 * distinct side silhouette (not a shared cab/bed with different paint).
 * Beep Sabertooth stays in build-beep-sabertooth.mjs.
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

const paint = new THREE.MeshStandardMaterial({ name: "paint", color: 0xffffff, metalness: 0.42, roughness: 0.48 });
const glass = new THREE.MeshStandardMaterial({
  name: "glass",
  color: 0x1a2430,
  metalness: 0.1,
  roughness: 0.08,
  transparent: true,
  opacity: 0.72,
});
const rubber = new THREE.MeshStandardMaterial({ name: "rubber", color: 0x141414, metalness: 0.04, roughness: 0.94 });
const chrome = new THREE.MeshStandardMaterial({ name: "chrome", color: 0xe8eef5, metalness: 0.78, roughness: 0.28 });
const dark = new THREE.MeshStandardMaterial({ name: "dark", color: 0x101214, metalness: 0.35, roughness: 0.6 });
const steel = new THREE.MeshStandardMaterial({ name: "paint", color: 0xc8ced4, metalness: 0.92, roughness: 0.28 });
const head = new THREE.MeshStandardMaterial({
  name: "light-head",
  color: 0xfff6d8,
  emissive: 0xfff3c4,
  emissiveIntensity: 2.2,
  roughness: 0.25,
});
const tail = new THREE.MeshStandardMaterial({
  name: "light-tail",
  color: 0xff2a2a,
  emissive: 0xff1a1a,
  emissiveIntensity: 1.6,
  roughness: 0.3,
});

function box(w, h, d, material, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  return mesh;
}

function cyl(rTop, rBot, h, material, x, y, z, rx = 0, ry = 0, rz = 0) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, 16), material);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  return mesh;
}

function wheel(front, left, x, z, tireR = 0.56, tireW = 0.4) {
  const pivot = new THREE.Group();
  pivot.name = `wheel-${front ? "front" : "back"}-${left ? "left" : "right"}`;
  const spin = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(tireR, tireR, tireW, 18), rubber);
  tire.rotation.z = Math.PI / 2;
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(tireR * 0.55, tireR * 0.55, 0.05, 12), dark);
  dish.rotation.z = Math.PI / 2;
  dish.position.x = left ? -tireW * 0.52 : tireW * 0.52;
  spin.add(tire, dish);
  pivot.add(spin);
  pivot.position.set(left ? -x : x, tireR, z);
  return pivot;
}

function addWheels(root, track, zF, zR, tireR = 0.56, tireW = 0.4) {
  for (const left of [true, false]) {
    root.add(wheel(true, left, track, zF, tireR, tireW));
    root.add(wheel(false, left, track + 0.03, zR, tireR, tireW));
  }
}

/** Block letters for the FJORD grille (no real Ford mark). */
function addFjordLetters(parent, y, z) {
  const mat = chrome;
  const s = 0.07;
  const h = 0.22;
  const letters = {
    F: [
      [0, 0, 0.12, h, s],
      [0.08, h / 2 - 0.02, 0.16, s, s],
      [0.08, 0, 0.14, s, s],
    ],
    J: [
      [0.14, 0, 0.12, h, s],
      [0.04, -h / 2 + 0.02, 0.14, s, s],
    ],
    O: [
      [0, 0, 0.12, h, s],
      [0.16, 0, 0.12, h, s],
      [0.08, h / 2 - 0.02, 0.2, s, s],
      [0.08, -h / 2 + 0.02, 0.2, s, s],
    ],
    R: [
      [0, 0, 0.12, h, s],
      [0.08, h / 2 - 0.02, 0.16, s, s],
      [0.14, h / 4, 0.12, h / 2, s],
      [0.08, 0, 0.14, s, s],
      [0.12, -h / 4, 0.12, h / 2, s],
    ],
    D: [
      [0, 0, 0.12, h, s],
      [0.14, 0, 0.12, h * 0.7, s],
      [0.07, h / 2 - 0.02, 0.16, s, s],
      [0.07, -h / 2 + 0.02, 0.16, s, s],
    ],
  };
  const order = ["F", "J", "O", "R", "D"];
  let x = -0.55;
  for (const ch of order) {
    for (const [dx, dy, w, hh, d] of letters[ch]) {
      parent.add(box(w, hh, d, mat, x + dx, y + dy, z));
    }
    x += 0.24;
  }
}

function finish(root, file) {
  return { root, file };
}

/** F-150 Raptor: tall/mean, huge bulging fender flares, FJORD grille, desert tires */
function buildRazorback() {
  const root = new THREE.Group();
  root.name = "razorback";
  const c = new THREE.Group();
  c.name = "chassis";
  c.add(box(2.35, 0.28, 5.35, dark, 0, 0.72, -0.05));
  // Tall mean cab, short bed relative to flares
  c.add(box(2.2, 1.15, 2.35, paint, 0, 1.35, 0.55));
  c.add(box(2.15, 0.16, 2.25, paint, 0, 1.98, 0.55));
  const ws = box(2.0, 0.55, 0.08, glass, 0, 1.55, 1.65);
  ws.name = "glass";
  ws.rotation.x = -0.32;
  c.add(ws);
  c.add(box(1.95, 0.5, 0.06, glass, 0, 1.55, -0.55));
  for (const s of [-1, 1]) {
    c.add(box(0.06, 0.48, 0.85, glass, s * 1.12, 1.5, 0.85));
    c.add(box(0.06, 0.48, 0.7, glass, s * 1.12, 1.5, 0.1));
  }
  // Short aggressive hood
  c.add(box(2.1, 0.32, 1.35, paint, 0, 1.15, 2.35));
  c.add(box(2.15, 0.78, 0.16, dark, 0, 1.0, 3.05));
  addFjordLetters(c, 1.0, 3.14);
  for (const s of [-1, 1]) {
    c.add(box(0.5, 0.24, 0.12, head, s * 0.95, 1.2, 3.08));
    // Huge bulging fender flares (signature side read)
    c.add(box(0.62, 0.55, 1.15, dark, s * 1.42, 1.05, 1.95));
    c.add(box(0.62, 0.55, 1.15, dark, s * 1.42, 1.05, -1.55));
    c.add(box(0.55, 0.2, 0.9, paint, s * 1.38, 1.35, 1.95));
    c.add(box(0.55, 0.2, 0.9, paint, s * 1.38, 1.35, -1.55));
  }
  // Bed
  c.add(box(2.15, 0.14, 2.15, paint, 0, 1.0, -1.85));
  for (const s of [-1, 1]) c.add(box(0.12, 0.55, 2.15, paint, s * 1.05, 1.28, -1.85));
  c.add(box(2.15, 0.55, 0.12, paint, 0, 1.28, -2.95));
  for (const s of [-1, 1]) c.add(box(0.3, 0.2, 0.1, tail, s * 0.75, 1.15, -3.02));
  c.add(box(2.4, 0.22, 0.45, dark, 0, 0.65, 3.35));
  c.add(box(2.3, 0.2, 0.4, dark, 0, 0.65, -3.15));
  root.add(c);
  addWheels(root, 1.35, 2.0, -1.55, 0.68, 0.5);
  return finish(root, "fjord-razorback.glb");
}

/** Ram TRX: huge tall pickup, crosshair grille, hood scoop, wide flares */
function buildTyrannosaur() {
  const root = new THREE.Group();
  root.name = "tyrannosaur";
  const c = new THREE.Group();
  c.name = "chassis";
  c.add(box(2.3, 0.28, 5.4, dark, 0, 0.7, -0.1));
  c.add(box(2.25, 1.2, 2.55, paint, 0, 1.4, 0.55));
  c.add(box(2.2, 0.16, 2.45, paint, 0, 2.05, 0.55));
  const ws = box(2.05, 0.55, 0.08, glass, 0, 1.65, 1.75);
  ws.name = "glass";
  ws.rotation.x = -0.28;
  c.add(ws);
  c.add(box(2.0, 0.5, 0.06, glass, 0, 1.65, -0.65));
  for (const s of [-1, 1]) {
    c.add(box(0.06, 0.5, 0.9, glass, s * 1.14, 1.6, 0.9));
    c.add(box(0.06, 0.5, 0.75, glass, s * 1.14, 1.6, 0.05));
  }
  c.add(box(2.15, 0.35, 1.55, paint, 0, 1.15, 2.35));
  c.add(box(0.7, 0.2, 0.95, dark, 0, 1.4, 2.3)); // hood scoop
  c.add(box(1.95, 0.78, 0.12, dark, 0, 1.0, 3.1));
  c.add(box(1.7, 0.08, 0.08, chrome, 0, 1.0, 3.18));
  c.add(box(0.08, 0.62, 0.08, chrome, 0, 1.0, 3.18));
  for (const s of [-1, 1]) {
    c.add(box(0.5, 0.28, 0.12, head, s * 0.95, 1.1, 3.1));
    c.add(box(0.52, 0.5, 1.1, dark, s * 1.38, 1.05, 1.95));
    c.add(box(0.52, 0.5, 1.1, dark, s * 1.38, 1.05, -1.55));
  }
  c.add(box(2.2, 0.14, 2.25, paint, 0, 1.0, -1.95));
  for (const s of [-1, 1]) c.add(box(0.12, 0.58, 2.25, paint, s * 1.08, 1.3, -1.95));
  c.add(box(2.2, 0.58, 0.12, paint, 0, 1.3, -3.1));
  for (const s of [-1, 1]) c.add(box(0.3, 0.22, 0.1, tail, s * 0.8, 1.2, -3.18));
  c.add(box(2.35, 0.22, 0.45, dark, 0, 0.65, 3.4));
  root.add(c);
  addWheels(root, 1.32, 2.05, -1.55, 0.66, 0.48);
  return finish(root, "headbutt-tyrannosaur.glb");
}

/** Ram 1500: longer hood than the others, calmer pickup */
function buildThunderBison() {
  const root = new THREE.Group();
  root.name = "thunder-bison";
  const c = new THREE.Group();
  c.name = "chassis";
  c.add(box(2.1, 0.22, 5.4, dark, 0, 0.52, 0.1));
  // Cab sits farther back — long hood is the side signature
  c.add(box(2.05, 0.95, 2.15, paint, 0, 1.2, 0.15));
  c.add(box(2.0, 0.14, 2.05, paint, 0, 1.72, 0.15));
  const ws = box(1.9, 0.48, 0.08, glass, 0, 1.4, 1.15);
  ws.name = "glass";
  ws.rotation.x = -0.26;
  c.add(ws);
  c.add(box(1.85, 0.42, 0.06, glass, 0, 1.4, -0.85));
  for (const s of [-1, 1]) {
    c.add(box(0.06, 0.42, 0.7, glass, s * 1.04, 1.35, 0.45));
    c.add(box(0.06, 0.42, 0.55, glass, s * 1.04, 1.35, -0.25));
  }
  // Extra-long hood
  c.add(box(1.95, 0.28, 2.15, paint, 0, 0.95, 2.25));
  c.add(box(1.7, 0.08, 1.6, paint, 0, 1.12, 2.35));
  c.add(box(1.8, 0.55, 0.12, dark, 0, 0.82, 3.3));
  for (let i = -2; i <= 2; i++) c.add(box(1.55, 0.04, 0.05, chrome, 0, 0.82 + i * 0.08, 3.36));
  for (const s of [-1, 1]) {
    c.add(box(0.42, 0.22, 0.1, head, s * 0.85, 0.95, 3.32));
    c.add(box(0.28, 0.28, 0.85, dark, s * 1.15, 0.82, 1.55));
    c.add(box(0.28, 0.28, 0.85, dark, s * 1.15, 0.82, -1.55));
  }
  c.add(box(2.0, 0.12, 2.2, paint, 0, 0.78, -1.95));
  for (const s of [-1, 1]) c.add(box(0.1, 0.48, 2.2, paint, s * 0.98, 1.02, -1.95));
  c.add(box(2.0, 0.48, 0.1, paint, 0, 1.02, -3.05));
  for (const s of [-1, 1]) c.add(box(0.28, 0.18, 0.08, tail, s * 0.7, 0.95, -3.12));
  c.add(box(2.1, 0.16, 0.35, dark, 0, 0.5, 3.55));
  root.add(c);
  addWheels(root, 1.18, 1.7, -1.55, 0.54, 0.38);
  return finish(root, "headbutt-thunder-bison.glb");
}

/** Ram Power Wagon: taller/heavier than Thunder Bison, Ram crosshair, front winch */
function buildMammoth() {
  const root = new THREE.Group();
  root.name = "mammoth";
  const c = new THREE.Group();
  c.name = "chassis";
  c.add(box(2.25, 0.32, 5.35, dark, 0, 0.72, -0.05));
  // Taller heavier cab than Thunder Bison
  c.add(box(2.2, 1.2, 2.35, paint, 0, 1.45, 0.45));
  c.add(box(2.15, 0.18, 2.25, paint, 0, 2.1, 0.45));
  const ws = box(2.0, 0.55, 0.08, glass, 0, 1.7, 1.55);
  ws.name = "glass";
  ws.rotation.x = -0.24;
  c.add(ws);
  c.add(box(1.95, 0.48, 0.06, glass, 0, 1.7, -0.65));
  for (const s of [-1, 1]) {
    c.add(box(0.06, 0.48, 0.8, glass, s * 1.12, 1.65, 0.75));
    c.add(box(0.06, 0.48, 0.65, glass, s * 1.12, 1.65, -0.05));
  }
  c.add(box(2.1, 0.32, 1.5, paint, 0, 1.15, 2.25));
  // Ram crosshair grille (not Jeep slots)
  c.add(box(1.95, 0.72, 0.14, dark, 0, 1.0, 3.0));
  c.add(box(1.7, 0.08, 0.08, chrome, 0, 1.0, 3.08));
  c.add(box(0.08, 0.58, 0.08, chrome, 0, 1.0, 3.08));
  // Front winch on bumper
  c.add(box(2.3, 0.3, 0.5, dark, 0, 0.58, 3.3));
  c.add(box(0.6, 0.3, 0.38, chrome, 0, 0.58, 3.52));
  c.add(cyl(0.13, 0.13, 0.42, dark, 0, 0.58, 3.62, 0, 0, Math.PI / 2));
  for (const s of [-1, 1]) {
    c.add(box(0.42, 0.24, 0.1, head, s * 0.92, 1.1, 3.02));
    c.add(box(0.42, 0.42, 1.0, dark, s * 1.28, 1.05, 1.85));
    c.add(box(0.42, 0.42, 1.0, dark, s * 1.28, 1.05, -1.55));
  }
  c.add(box(2.15, 0.14, 2.2, paint, 0, 0.95, -1.95));
  for (const s of [-1, 1]) c.add(box(0.12, 0.58, 2.2, paint, s * 1.05, 1.25, -1.95));
  c.add(box(2.15, 0.58, 0.12, paint, 0, 1.25, -3.05));
  for (const s of [-1, 1]) c.add(box(0.3, 0.2, 0.1, tail, s * 0.75, 1.15, -3.12));
  // Roof light bar
  c.add(box(1.55, 0.12, 0.18, dark, 0, 2.25, 1.25));
  for (let i = -2; i <= 2; i++) c.add(box(0.14, 0.12, 0.12, head, i * 0.28, 2.28, 1.25));
  root.add(c);
  addWheels(root, 1.28, 1.95, -1.55, 0.64, 0.46);
  return finish(root, "headbutt-mammoth.glb");
}

/** GMC Sierra: tallest and boxiest truck, giant chrome grille */
function buildGrizzly() {
  const root = new THREE.Group();
  root.name = "grizzly";
  const c = new THREE.Group();
  c.name = "chassis";
  c.add(box(2.2, 0.24, 5.2, dark, 0, 0.58, -0.05));
  // Tallest boxiest cab — vertical walls, flat roof, square C-pillar
  c.add(box(2.15, 1.35, 2.55, paint, 0, 1.4, 0.5));
  c.add(box(2.1, 0.12, 2.5, paint, 0, 2.12, 0.5)); // flat high roof
  const ws = box(2.0, 0.62, 0.08, glass, 0, 1.65, 1.72);
  ws.name = "glass";
  ws.rotation.x = -0.12; // nearly upright = boxy
  c.add(ws);
  c.add(box(1.95, 0.55, 0.08, glass, 0, 1.65, -0.7));
  for (const s of [-1, 1]) {
    c.add(box(0.08, 0.55, 0.95, glass, s * 1.1, 1.6, 0.9));
    c.add(box(0.08, 0.55, 0.75, glass, s * 1.1, 1.6, 0.0));
    c.add(box(0.22, 1.1, 0.35, paint, s * 1.12, 1.4, -0.65)); // thick C-pillar
  }
  c.add(box(2.05, 0.3, 1.35, paint, 0, 1.05, 2.25));
  // Giant chrome grille
  c.add(box(2.05, 0.85, 0.2, chrome, 0, 0.95, 2.95));
  c.add(box(1.75, 0.6, 0.1, dark, 0, 0.95, 3.05));
  for (let row = -3; row <= 3; row++) {
    for (let col = -4; col <= 4; col++) {
      c.add(box(0.12, 0.06, 0.04, chrome, col * 0.18, 0.95 + row * 0.08, 3.1));
    }
  }
  for (const s of [-1, 1]) {
    c.add(box(0.42, 0.28, 0.1, head, s * 0.95, 1.15, 2.98));
    c.add(box(0.26, 0.3, 0.75, dark, s * 1.18, 0.9, 1.75));
    c.add(box(0.26, 0.3, 0.75, dark, s * 1.18, 0.9, -1.55));
  }
  c.add(box(2.1, 0.14, 2.1, paint, 0, 0.85, -1.9));
  for (const s of [-1, 1]) c.add(box(0.14, 0.65, 2.1, paint, s * 1.02, 1.18, -1.9));
  c.add(box(2.1, 0.65, 0.14, paint, 0, 1.18, -2.95));
  for (const s of [-1, 1]) c.add(box(0.3, 0.22, 0.1, tail, s * 0.75, 1.1, -3.05));
  c.add(box(2.2, 0.2, 0.4, chrome, 0, 0.55, 3.25));
  root.add(c);
  addWheels(root, 1.2, 1.85, -1.55, 0.56, 0.4);
  return finish(root, "grr-grizzly.glb");
}

/** Tacoma TRD Pro: clearly smaller mid-size — short cab/bed, lower roof, narrow, honeycomb grille. */
function buildTasmanianDevil() {
  const root = new THREE.Group();
  root.name = "tasmanian-devil";
  const c = new THREE.Group();
  c.name = "chassis";
  c.add(box(1.7, 0.16, 4.05, dark, 0, 0.5, 0));
  // Short lower narrower cab
  c.add(box(1.65, 0.72, 1.65, paint, 0, 1.05, 0.5));
  c.add(box(1.6, 0.1, 1.55, paint, 0, 1.45, 0.5));
  const ws = box(1.5, 0.36, 0.06, glass, 0, 1.2, 1.25);
  ws.name = "glass";
  ws.rotation.x = -0.28;
  c.add(ws);
  c.add(box(1.45, 0.32, 0.05, glass, 0, 1.2, -0.25));
  for (const s of [-1, 1]) {
    c.add(box(0.05, 0.3, 0.55, glass, s * 0.84, 1.18, 0.7));
    c.add(box(0.05, 0.3, 0.4, glass, s * 0.84, 1.18, 0.1));
  }
  c.add(box(1.55, 0.2, 1.0, paint, 0, 0.85, 1.8));
  // Black honeycomb grille
  c.add(box(1.4, 0.42, 0.1, dark, 0, 0.78, 2.35));
  for (let row = -2; row <= 2; row++) {
    for (let col = -3; col <= 3; col++) {
      c.add(box(0.1, 0.05, 0.04, chrome, col * 0.16, 0.78 + row * 0.07, 2.4));
    }
  }
  for (const s of [-1, 1]) {
    c.add(box(0.28, 0.16, 0.08, head, s * 0.65, 0.88, 2.38));
    c.add(box(0.24, 0.22, 0.6, dark, s * 0.92, 0.75, 1.4));
    c.add(box(0.24, 0.22, 0.6, dark, s * 0.92, 0.75, -1.05));
  }
  // Short bed
  c.add(box(1.6, 0.08, 1.35, paint, 0, 0.72, -1.35));
  for (const s of [-1, 1]) c.add(box(0.08, 0.36, 1.35, paint, s * 0.78, 0.92, -1.35));
  c.add(box(1.6, 0.36, 0.08, paint, 0, 0.92, -2.05));
  for (const s of [-1, 1]) c.add(box(0.2, 0.14, 0.07, tail, s * 0.55, 0.88, -2.12));
  // Roof light bar
  c.add(box(1.15, 0.08, 0.12, dark, 0, 1.58, 1.0));
  for (let i = -2; i <= 2; i++) c.add(box(0.1, 0.08, 0.08, head, i * 0.2, 1.62, 1.0));
  c.add(box(1.7, 0.12, 0.28, dark, 0, 0.48, 2.55));
  root.add(c);
  addWheels(root, 0.95, 1.4, -1.1, 0.48, 0.32);
  return finish(root, "coyota-tasmanian-devil.glb");
}

/** Cybertruck: ONE solid closed doorstop — peak over doors, flat slopes front/back, no open top. */
function buildAnkylosaur() {
  const root = new THREE.Group();
  root.name = "ankylosaur";
  const c = new THREE.Group();
  c.name = "chassis";
  const peakY = 1.9;
  const peakZ = 0.1;
  // Solid filled body volume (not separate upright side walls)
  c.add(box(2.1, 0.85, 5.2, steel, 0, 0.85, 0));
  // Flat steel sides flush with the wedge
  for (const s of [-1, 1]) {
    c.add(box(0.12, 1.4, 5.15, steel, s * 1.05, 0.95, 0));
  }
  // Front slope: peak → bumper (one straight face)
  const frontFace = box(2.05, 0.14, 2.85, steel, 0, (peakY + 0.4) * 0.5, 1.4);
  frontFace.rotation.x = 0.48;
  c.add(frontFace);
  // Rear slope: peak → tail
  const rearFace = box(2.05, 0.14, 2.7, steel, 0, (peakY + 0.4) * 0.5, -1.35);
  rearFace.rotation.x = -0.42;
  c.add(rearFace);
  // Sharp roof peak ridge above the doors
  c.add(box(2.0, 0.12, 0.55, steel, 0, peakY, peakZ));
  // Fill the triangle so there is no open top / bathtub
  c.add(box(1.95, 0.55, 1.6, steel, 0, 1.35, 0.9));
  c.add(box(1.95, 0.55, 1.5, steel, 0, 1.35, -0.85));
  // Dark windshield on the front slope
  const ws = box(1.65, 0.1, 1.35, glass, 0, 1.4, 1.05);
  ws.name = "glass";
  ws.rotation.x = 0.48;
  c.add(ws);
  const rs = box(1.45, 0.08, 1.0, glass, 0, 1.35, -0.95);
  rs.name = "glass";
  rs.rotation.x = -0.42;
  c.add(rs);
  for (const s of [-1, 1]) {
    const sideG = box(0.06, 0.45, 0.95, glass, s * 1.05, 1.4, 0.15);
    sideG.name = "glass";
    c.add(sideG);
  }
  // Full-width thin light bars
  c.add(box(2.05, 0.055, 0.07, head, 0, 0.7, 2.7));
  c.add(box(2.05, 0.055, 0.07, tail, 0, 0.75, -2.7));
  c.add(box(2.15, 0.14, 0.3, dark, 0, 0.38, 2.75));
  c.add(box(2.15, 0.14, 0.3, dark, 0, 0.38, -2.75));
  // Angular wheel arches — wheels sit inside
  for (const s of [-1, 1]) {
    c.add(box(0.22, 0.4, 0.9, dark, s * 1.12, 0.65, 1.55));
    c.add(box(0.22, 0.4, 0.9, dark, s * 1.12, 0.65, -1.55));
  }
  root.add(c);
  addWheels(root, 1.08, 1.6, -1.6, 0.48, 0.32);
  return finish(root, "voltra-ankylosaur.glb");
}

/** Hummer H1: widest vehicle in the game, low flat roof, closed box cabin. */
function buildWarHippo() {
  const root = new THREE.Group();
  root.name = "war-hippo";
  const c = new THREE.Group();
  c.name = "chassis";
  // Widest stance in the garage
  c.add(box(3.05, 0.32, 4.6, dark, 0, 0.62, 0.05));
  c.add(box(3.0, 0.95, 3.9, paint, 0, 1.2, 0.05));
  c.add(box(2.95, 0.1, 3.85, paint, 0, 1.72, 0.05)); // low flat roof
  c.add(box(2.7, 0.32, 0.95, paint, 0, 0.95, 2.35));
  const wsL = box(1.3, 0.5, 0.08, glass, -0.7, 1.38, 1.95);
  wsL.name = "glass";
  wsL.rotation.x = -0.08;
  c.add(wsL);
  const wsR = box(1.3, 0.5, 0.08, glass, 0.7, 1.38, 1.95);
  wsR.name = "glass";
  wsR.rotation.x = -0.08;
  c.add(wsR);
  c.add(box(0.1, 0.5, 0.08, dark, 0, 1.38, 1.95));
  c.add(box(2.85, 0.9, 0.12, paint, 0, 1.2, -1.95));
  c.add(box(2.5, 0.45, 0.06, glass, 0, 1.38, -1.98));
  for (const s of [-1, 1]) {
    c.add(box(0.06, 0.45, 1.6, glass, s * 1.52, 1.35, 0.3));
    c.add(box(0.06, 0.4, 1.0, glass, s * 1.52, 1.35, -1.1));
    c.add(box(0.4, 0.28, 0.12, head, s * 1.15, 0.95, 2.8));
    c.add(box(0.24, 0.16, 0.28, dark, s * 1.68, 1.5, 0.9));
    c.add(box(0.3, 0.22, 0.1, tail, s * 1.15, 1.05, -2.0));
    c.add(box(0.4, 0.08, 2.9, dark, s * 1.7, 0.55, 0));
  }
  c.add(box(2.1, 0.5, 0.12, dark, 0, 0.9, 2.85));
  c.add(box(3.0, 0.25, 0.4, dark, 0, 0.52, 2.95));
  c.add(box(3.0, 0.25, 0.35, dark, 0, 0.52, -2.15));
  root.add(c);
  addWheels(root, 1.62, 1.55, -1.4, 0.58, 0.5);
  return finish(root, "bummer-war-hippo.glb");
}

/** Rivian R1T: modern EV pickup — blended fenders, stadium lamps + bar, no grille, short bed. */
function buildSwampBeast() {
  const root = new THREE.Group();
  root.name = "swamp-beast";
  const c = new THREE.Group();
  c.name = "chassis";
  c.add(box(2.1, 0.18, 5.0, dark, 0, 0.48, 0));
  // Smooth rounded-box body — fenders blend into sides (no tube arches)
  c.add(box(2.05, 0.9, 2.35, paint, 0, 1.12, 0.3));
  c.add(box(1.95, 0.5, 2.0, paint, 0, 1.6, 0.2));
  c.add(box(1.95, 0.1, 1.95, paint, 0, 1.88, 0.15));
  // Flat EV nose (no grille)
  c.add(box(1.95, 0.28, 1.35, paint, 0, 0.9, 2.05));
  c.add(box(1.7, 0.16, 0.9, paint, 0, 1.05, 2.2));
  const ws = box(1.8, 0.48, 0.07, glass, 0, 1.48, 1.35);
  ws.name = "glass";
  ws.rotation.x = -0.4;
  c.add(ws);
  c.add(box(1.6, 0.4, 0.06, glass, 0, 1.52, -0.75));
  for (const s of [-1, 1]) {
    c.add(box(0.05, 0.4, 0.9, glass, s * 1.02, 1.48, 0.3));
    // Blended fender volumes (boxes, not separate tubes)
    c.add(box(0.35, 0.45, 1.05, paint, s * 1.1, 0.85, 1.6));
    c.add(box(0.35, 0.45, 1.05, paint, s * 1.1, 0.85, -1.45));
  }
  // Tall vertical oval stadium headlights + thin bar
  for (const s of [-1, 1]) {
    c.add(box(0.2, 0.48, 0.1, head, s * 0.78, 0.85, 2.72));
    c.add(cyl(0.12, 0.12, 0.08, head, s * 0.78, 0.7, 2.74, Math.PI / 2, 0, 0));
    c.add(cyl(0.12, 0.12, 0.08, head, s * 0.78, 1.0, 2.74, Math.PI / 2, 0, 0));
  }
  c.add(box(1.25, 0.045, 0.06, head, 0, 0.85, 2.75));
  c.add(box(1.6, 0.28, 0.08, dark, 0, 0.65, 2.68));
  // Short sleek bed + rear light bar
  c.add(box(2.0, 0.1, 1.75, paint, 0, 0.78, -1.75));
  for (const s of [-1, 1]) c.add(box(0.1, 0.42, 1.75, paint, s * 0.98, 1.0, -1.75));
  c.add(box(2.0, 0.42, 0.1, paint, 0, 1.0, -2.65));
  c.add(box(1.85, 0.06, 0.06, tail, 0, 1.0, -2.72));
  c.add(box(2.05, 0.12, 0.28, dark, 0, 0.45, 2.9));
  root.add(c);
  addWheels(root, 1.15, 1.65, -1.45, 0.55, 0.38);
  return finish(root, "river-run-swamp-beast.glb");
}

const trucks = [
  buildRazorback(),
  buildTyrannosaur(),
  buildThunderBison(),
  buildMammoth(),
  buildGrizzly(),
  buildTasmanianDevil(),
  buildAnkylosaur(),
  buildWarHippo(),
  buildSwampBeast(),
];

mkdirSync(new URL("../public/models/", import.meta.url), { recursive: true });
for (const { root, file } of trucks) {
  const exporter = new GLTFExporter();
  const glb = await exporter.parseAsync(root, { binary: true });
  writeFileSync(new URL(`../public/models/${file}`, import.meta.url), Buffer.from(glb));
  console.log(file, Buffer.from(glb).length);
}
