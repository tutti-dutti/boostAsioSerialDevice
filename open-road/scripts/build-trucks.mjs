/**
 * Hand-builds the truck batch: each truck is its own original GLB.
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
const steel = new THREE.MeshStandardMaterial({ name: "paint", color: 0xffffff, metalness: 0.85, roughness: 0.35 });
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

function closedCab(c, opts) {
  const W = opts.width ?? 2.05;
  const cabZ = opts.cabZ ?? 0.55;
  const cabD = opts.cabD ?? 2.5;
  const roofY = opts.roofY ?? 1.68;
  const wallH = opts.wallH ?? 0.95;
  c.add(box(W, wallH, cabD, paint, 0, roofY - wallH / 2 - 0.05, cabZ));
  c.add(box(W - 0.05, 0.14, cabD - 0.05, paint, 0, roofY, cabZ));
  const ws = box(W - 0.2, 0.5, 0.08, glass, 0, roofY - 0.35, cabZ + cabD / 2 - 0.15);
  ws.name = "glass";
  ws.rotation.x = -0.28;
  c.add(ws);
  c.add(box(W - 0.25, 0.45, 0.06, glass, 0, roofY - 0.35, cabZ - cabD / 2 + 0.2));
  for (const s of [-1, 1]) {
    c.add(box(0.06, 0.42, cabD * 0.35, glass, s * (W / 2 - 0.02), roofY - 0.38, cabZ + cabD * 0.18));
    c.add(box(0.06, 0.42, cabD * 0.35, glass, s * (W / 2 - 0.02), roofY - 0.38, cabZ - cabD * 0.15));
    c.add(box(0.16, 0.12, 0.28, dark, s * (W / 2 + 0.08), roofY - 0.4, cabZ + 0.6));
  }
}

function bed(c, opts) {
  const W = opts.width ?? 2.0;
  const z = opts.z ?? -1.85;
  const d = opts.d ?? 2.1;
  const y = opts.y ?? 0.78;
  c.add(box(W, 0.12, d, paint, 0, y, z));
  for (const s of [-1, 1]) c.add(box(0.1, 0.5, d, paint, s * (W / 2 - 0.05), y + 0.28, z));
  c.add(box(W, 0.5, 0.1, paint, 0, y + 0.28, z - d / 2));
  for (const s of [-1, 1]) c.add(box(0.28, 0.2, 0.1, tail, s * 0.7, y + 0.2, z - d / 2 - 0.05));
}

function finish(root, file) {
  return { root, file };
}

/** F-150 Raptor style: wide, aggressive, FJORD grille, huge flares, desert tires */
function buildRazorback() {
  const root = new THREE.Group();
  root.name = "razorback";
  const c = new THREE.Group();
  c.name = "chassis";
  c.add(box(2.25, 0.24, 5.2, dark, 0, 0.58, -0.1));
  closedCab(c, { width: 2.2, cabZ: 0.5, cabD: 2.4, roofY: 1.72, wallH: 1.0 });
  c.add(box(2.15, 0.28, 1.5, paint, 0, 0.95, 2.2)); // hood
  // Aggressive FJORD grille
  c.add(box(2.05, 0.7, 0.14, dark, 0, 0.85, 2.95));
  addFjordLetters(c, 0.85, 3.02);
  for (const s of [-1, 1]) {
    c.add(box(0.45, 0.22, 0.12, head, s * 0.9, 1.05, 2.95));
    c.add(box(0.45, 0.4, 1.0, dark, s * 1.3, 0.9, 1.85)); // huge flares
    c.add(box(0.45, 0.4, 1.0, dark, s * 1.3, 0.9, -1.55));
  }
  bed(c, { width: 2.15, z: -1.9, d: 2.2, y: 0.82 });
  c.add(box(2.3, 0.2, 0.4, dark, 0, 0.55, 3.2));
  c.add(box(2.2, 0.18, 0.35, dark, 0, 0.55, -3.1));
  root.add(c);
  addWheels(root, 1.28, 1.9, -1.55, 0.62, 0.48); // desert-wide tires
  return finish(root, "fjord-razorback.glb");
}

/** Ram TRX: huge tall pickup, crosshair grille, hood scoop, wide flares */
function buildTyrannosaur() {
  const root = new THREE.Group();
  root.name = "tyrannosaur";
  const c = new THREE.Group();
  c.name = "chassis";
  c.add(box(2.3, 0.28, 5.4, dark, 0, 0.7, -0.1));
  closedCab(c, { width: 2.25, cabZ: 0.55, cabD: 2.55, roofY: 1.95, wallH: 1.1 });
  c.add(box(2.15, 0.32, 1.55, paint, 0, 1.1, 2.3));
  c.add(box(0.7, 0.18, 0.9, dark, 0, 1.32, 2.25)); // hood scoop
  // Crosshair grille
  c.add(box(1.95, 0.75, 0.12, dark, 0, 0.95, 3.05));
  c.add(box(1.7, 0.08, 0.08, chrome, 0, 0.95, 3.12));
  c.add(box(0.08, 0.6, 0.08, chrome, 0, 0.95, 3.12));
  for (const s of [-1, 1]) {
    c.add(box(0.5, 0.28, 0.12, head, s * 0.95, 1.05, 3.05));
    c.add(box(0.5, 0.45, 1.05, dark, s * 1.35, 1.0, 1.95));
    c.add(box(0.5, 0.45, 1.05, dark, s * 1.35, 1.0, -1.6));
  }
  bed(c, { width: 2.2, z: -1.95, d: 2.25, y: 0.95 });
  c.add(box(2.35, 0.22, 0.45, dark, 0, 0.65, 3.35));
  root.add(c);
  addWheels(root, 1.32, 2.0, -1.6, 0.64, 0.46);
  return finish(root, "headbutt-tyrannosaur.glb");
}

/** Ram 1500: calmer big pickup than TRX */
function buildThunderBison() {
  const root = new THREE.Group();
  root.name = "thunder-bison";
  const c = new THREE.Group();
  c.name = "chassis";
  c.add(box(2.15, 0.22, 5.1, dark, 0, 0.55, -0.1));
  closedCab(c, { width: 2.1, cabZ: 0.5, cabD: 2.45, roofY: 1.7, wallH: 0.95 });
  c.add(box(2.0, 0.24, 1.4, paint, 0, 0.95, 2.15));
  c.add(box(1.85, 0.55, 0.12, dark, 0, 0.82, 2.85));
  for (let i = -2; i <= 2; i++) c.add(box(1.6, 0.04, 0.05, chrome, 0, 0.82 + i * 0.08, 2.9));
  for (const s of [-1, 1]) {
    c.add(box(0.42, 0.22, 0.1, head, s * 0.85, 0.95, 2.88));
    c.add(box(0.32, 0.3, 0.85, dark, s * 1.18, 0.85, 1.8));
    c.add(box(0.32, 0.3, 0.85, dark, s * 1.18, 0.85, -1.5));
  }
  bed(c, { width: 2.05, z: -1.85, d: 2.15, y: 0.8 });
  c.add(box(2.15, 0.18, 0.35, dark, 0, 0.52, 3.1));
  root.add(c);
  addWheels(root, 1.2, 1.85, -1.5, 0.56, 0.4);
  return finish(root, "headbutt-thunder-bison.glb");
}

/** Ram Power Wagon: heavy-duty, tall, front winch */
function buildMammoth() {
  const root = new THREE.Group();
  root.name = "mammoth";
  const c = new THREE.Group();
  c.name = "chassis";
  c.add(box(2.2, 0.28, 5.3, dark, 0, 0.65, -0.1));
  closedCab(c, { width: 2.15, cabZ: 0.5, cabD: 2.4, roofY: 1.88, wallH: 1.05 });
  c.add(box(2.05, 0.28, 1.45, paint, 0, 1.05, 2.2));
  c.add(box(1.9, 0.65, 0.14, dark, 0, 0.95, 2.95));
  for (let i = -2; i <= 2; i++) c.add(box(0.08, 0.5, 0.06, chrome, i * 0.28, 0.95, 3.02));
  // Front winch on bumper
  c.add(box(2.25, 0.28, 0.45, dark, 0, 0.55, 3.25));
  c.add(box(0.55, 0.28, 0.35, chrome, 0, 0.55, 3.45));
  c.add(cyl(0.12, 0.12, 0.4, dark, 0, 0.55, 3.55, 0, 0, Math.PI / 2));
  for (const s of [-1, 1]) {
    c.add(box(0.4, 0.22, 0.1, head, s * 0.9, 1.05, 2.98));
    c.add(box(0.4, 0.38, 0.95, dark, s * 1.25, 0.95, 1.85));
    c.add(box(0.4, 0.38, 0.95, dark, s * 1.25, 0.95, -1.55));
  }
  bed(c, { width: 2.1, z: -1.95, d: 2.2, y: 0.9 });
  // Roof light bar
  c.add(box(1.5, 0.1, 0.16, dark, 0, 2.05, 1.35));
  for (let i = -2; i <= 2; i++) c.add(box(0.14, 0.12, 0.12, head, i * 0.28, 2.08, 1.35));
  root.add(c);
  addWheels(root, 1.25, 1.9, -1.55, 0.62, 0.44);
  return finish(root, "headbutt-mammoth.glb");
}

/** GMC Sierra style: big square pickup, giant chrome grille */
function buildGrizzly() {
  const root = new THREE.Group();
  root.name = "grizzly";
  const c = new THREE.Group();
  c.name = "chassis";
  c.add(box(2.15, 0.22, 5.15, dark, 0, 0.55, -0.1));
  closedCab(c, { width: 2.1, cabZ: 0.55, cabD: 2.5, roofY: 1.72, wallH: 0.98 });
  c.add(box(2.0, 0.26, 1.45, paint, 0, 0.95, 2.2));
  // Giant chrome grille (square)
  c.add(box(1.95, 0.7, 0.16, chrome, 0, 0.85, 2.95));
  c.add(box(1.7, 0.5, 0.08, dark, 0, 0.85, 3.02));
  for (let row = -2; row <= 2; row++) {
    for (let col = -3; col <= 3; col++) {
      c.add(box(0.12, 0.06, 0.04, chrome, col * 0.2, 0.85 + row * 0.1, 3.05));
    }
  }
  for (const s of [-1, 1]) {
    c.add(box(0.4, 0.24, 0.1, head, s * 0.9, 1.0, 2.95));
    c.add(box(0.3, 0.28, 0.8, dark, s * 1.15, 0.85, 1.8));
    c.add(box(0.3, 0.28, 0.8, dark, s * 1.15, 0.85, -1.5));
  }
  bed(c, { width: 2.05, z: -1.9, d: 2.15, y: 0.8 });
  c.add(box(2.15, 0.18, 0.35, chrome, 0, 0.52, 3.2));
  root.add(c);
  addWheels(root, 1.18, 1.85, -1.5, 0.55, 0.4);
  return finish(root, "grr-grizzly.glb");
}

/** Tacoma TRD Pro: mid-size, lifted, light bar */
function buildTasmanianDevil() {
  const root = new THREE.Group();
  root.name = "tasmanian-devil";
  const c = new THREE.Group();
  c.name = "chassis";
  c.add(box(1.95, 0.2, 4.7, dark, 0, 0.6, -0.05));
  closedCab(c, { width: 1.9, cabZ: 0.55, cabD: 2.15, roofY: 1.75, wallH: 0.95 });
  c.add(box(1.8, 0.22, 1.25, paint, 0, 0.98, 2.05));
  c.add(box(1.65, 0.5, 0.12, dark, 0, 0.85, 2.7));
  for (let i = -2; i <= 2; i++) c.add(box(1.4, 0.04, 0.05, chrome, 0, 0.85 + i * 0.07, 2.76));
  for (const s of [-1, 1]) {
    c.add(box(0.35, 0.2, 0.1, head, s * 0.75, 0.95, 2.72));
    c.add(box(0.3, 0.28, 0.75, dark, s * 1.08, 0.88, 1.65));
    c.add(box(0.3, 0.28, 0.75, dark, s * 1.08, 0.88, -1.35));
  }
  // Shorter mid-size bed
  bed(c, { width: 1.85, z: -1.65, d: 1.75, y: 0.82 });
  // Roof light bar
  c.add(box(1.35, 0.1, 0.14, dark, 0, 1.92, 1.25));
  for (let i = -2; i <= 2; i++) c.add(box(0.12, 0.1, 0.1, head, i * 0.26, 1.95, 1.25));
  c.add(box(1.95, 0.16, 0.32, dark, 0, 0.55, 2.95));
  root.add(c);
  addWheels(root, 1.12, 1.7, -1.35, 0.58, 0.38);
  return finish(root, "coyota-tasmanian-devil.glb");
}

/** Cybertruck: flat steel triangle wedge, light bars front & back */
function buildAnkylosaur() {
  const root = new THREE.Group();
  root.name = "ankylosaur";
  const c = new THREE.Group();
  c.name = "chassis";
  // Angular steel wedge body (no soft curves)
  c.add(box(2.2, 0.25, 5.2, steel, 0, 0.55, 0));
  const hood = box(2.05, 0.18, 2.0, steel, 0, 0.85, 1.5);
  hood.rotation.x = 0.18;
  c.add(hood);
  // Cabin prism
  const cabin = box(2.0, 0.85, 2.2, steel, 0, 1.25, -0.2);
  cabin.rotation.x = -0.08;
  c.add(cabin);
  const roof = box(1.9, 0.12, 2.0, steel, 0, 1.75, -0.35);
  roof.rotation.x = -0.12;
  c.add(roof);
  const ws = box(1.85, 0.55, 0.08, glass, 0, 1.35, 0.85);
  ws.name = "glass";
  ws.rotation.x = -0.45;
  c.add(ws);
  c.add(box(1.7, 0.4, 0.06, glass, 0, 1.4, -1.15));
  for (const s of [-1, 1]) c.add(box(0.06, 0.4, 1.2, glass, s * 1.02, 1.35, -0.2));
  // Bed as continuation of wedge
  c.add(box(2.05, 0.2, 1.8, steel, 0, 0.85, -1.9));
  for (const s of [-1, 1]) c.add(box(0.12, 0.45, 1.8, steel, s * 1.0, 1.05, -1.9));
  // Light bars front & back
  c.add(box(1.9, 0.08, 0.1, head, 0, 0.7, 2.55));
  c.add(box(1.9, 0.08, 0.1, tail, 0, 0.75, -2.85));
  c.add(box(2.15, 0.15, 0.3, dark, 0, 0.4, 2.65));
  root.add(c);
  addWheels(root, 1.15, 1.7, -1.7, 0.52, 0.36);
  return finish(root, "voltra-ankylosaur.glb");
}

/** Hummer H1: super wide, flat, boxy, split windshield */
function buildWarHippo() {
  const root = new THREE.Group();
  root.name = "war-hippo";
  const c = new THREE.Group();
  c.name = "chassis";
  c.add(box(2.55, 0.3, 4.8, dark, 0, 0.65, 0));
  // Flat boxy cabin
  c.add(box(2.5, 1.1, 2.6, paint, 0, 1.3, 0.2));
  c.add(box(2.45, 0.12, 2.5, paint, 0, 1.9, 0.2));
  // Split windshield
  const wsL = box(1.05, 0.55, 0.08, glass, -0.55, 1.5, 1.45);
  wsL.name = "glass";
  wsL.rotation.x = -0.12;
  c.add(wsL);
  const wsR = box(1.05, 0.55, 0.08, glass, 0.55, 1.5, 1.45);
  wsR.name = "glass";
  wsR.rotation.x = -0.12;
  c.add(wsR);
  c.add(box(0.08, 0.55, 0.08, dark, 0, 1.5, 1.45)); // split bar
  c.add(box(2.2, 0.45, 0.06, glass, 0, 1.5, -1.0));
  for (const s of [-1, 1]) {
    c.add(box(0.06, 0.45, 1.4, glass, s * 1.27, 1.45, 0.2));
    c.add(box(0.35, 0.28, 0.12, head, s * 0.95, 1.0, 2.35));
    c.add(box(0.2, 0.15, 0.3, dark, s * 1.4, 1.55, 1.0));
  }
  // Short military bed / rear box
  c.add(box(2.45, 0.15, 1.6, paint, 0, 0.95, -1.85));
  for (const s of [-1, 1]) c.add(box(0.12, 0.55, 1.6, paint, s * 1.2, 1.2, -1.85));
  c.add(box(2.45, 0.55, 0.12, paint, 0, 1.2, -2.65));
  for (const s of [-1, 1]) c.add(box(0.3, 0.2, 0.1, tail, s * 0.9, 1.1, -2.7));
  // Hood / nose
  c.add(box(2.3, 0.35, 1.1, paint, 0, 1.0, 2.0));
  c.add(box(1.8, 0.45, 0.12, dark, 0, 0.9, 2.5));
  c.add(box(2.5, 0.25, 0.4, dark, 0, 0.55, 2.7));
  root.add(c);
  addWheels(root, 1.4, 1.65, -1.55, 0.6, 0.45);
  return finish(root, "bummer-war-hippo.glb");
}

/** Rivian R1T: smooth electric pickup, oval stadium headlights */
function buildSwampBeast() {
  const root = new THREE.Group();
  root.name = "swamp-beast";
  const c = new THREE.Group();
  c.name = "chassis";
  c.add(box(2.1, 0.22, 5.0, dark, 0, 0.5, -0.05));
  // Smooth closed cab (more rounded look via stepped volumes)
  closedCab(c, { width: 2.05, cabZ: 0.45, cabD: 2.35, roofY: 1.65, wallH: 0.9 });
  c.add(box(1.95, 0.22, 1.35, paint, 0, 0.9, 2.1));
  c.add(box(1.7, 0.12, 0.9, paint, 0, 1.05, 2.15)); // soft hood step
  // Oval "stadium" headlights (flat cylinders facing forward)
  for (const s of [-1, 1]) {
    c.add(cyl(0.18, 0.18, 0.1, head, s * 0.75, 0.82, 2.8, Math.PI / 2, 0, 0));
    c.add(box(0.5, 0.08, 0.08, head, s * 0.75, 0.82, 2.78)); // horizontal stadium stretch
    c.add(box(0.28, 0.26, 0.75, dark, s * 1.12, 0.8, 1.7));
    c.add(box(0.28, 0.26, 0.75, dark, s * 1.12, 0.8, -1.45));
  }
  c.add(box(1.6, 0.35, 0.1, dark, 0, 0.75, 2.75)); // closed lower fascia
  bed(c, { width: 2.0, z: -1.8, d: 2.0, y: 0.75 });
  // Soft rear light bar
  c.add(box(1.7, 0.08, 0.06, tail, 0, 0.95, -2.85));
  c.add(box(2.05, 0.14, 0.3, dark, 0, 0.48, 2.95));
  root.add(c);
  addWheels(root, 1.15, 1.75, -1.5, 0.54, 0.38);
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
