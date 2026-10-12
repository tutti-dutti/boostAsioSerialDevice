/**
 * Builds a boxy lifted pickup for Shovel-A Mastodon.
 * Original body, not a copy of any real truck.
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

const paint = new THREE.MeshStandardMaterial({ name: "paint", color: 0xffffff, metalness: 0.45, roughness: 0.42 });
const glass = new THREE.MeshStandardMaterial({
  name: "glass",
  color: 0x1a2430,
  metalness: 0.1,
  roughness: 0.08,
  transparent: true,
  opacity: 0.72,
});
const rubber = new THREE.MeshStandardMaterial({ name: "rubber", color: 0x141414, metalness: 0.04, roughness: 0.94 });
const chrome = new THREE.MeshStandardMaterial({ name: "chrome", color: 0xe8eef5, metalness: 0.7, roughness: 0.3 });
const dark = new THREE.MeshStandardMaterial({ name: "dark", color: 0x101214, metalness: 0.35, roughness: 0.6 });
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

const TIRE_R = 0.48;
const TIRE_W = 0.34;

function box(w, h, d, material, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  return mesh;
}

function wheel(front, left, x, z) {
  const pivot = new THREE.Group();
  pivot.name = `wheel-${front ? "front" : "back"}-${left ? "left" : "right"}`;
  const spin = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(TIRE_R, TIRE_R, TIRE_W, 20), rubber);
  tire.rotation.z = Math.PI / 2;
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(TIRE_R * 0.96, TIRE_R * 0.96, TIRE_W * 1.06, 20), dark);
  wall.rotation.z = Math.PI / 2;
  const rimR = TIRE_R * 0.58;
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(rimR, rimR, 0.04, 16), dark);
  dish.rotation.z = Math.PI / 2;
  const faceX = left ? -TIRE_W * 0.52 : TIRE_W * 0.52;
  dish.position.x = faceX;
  spin.add(tire, wall, dish);
  for (let i = 0; i < 6; i++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.05, rimR * 0.75, 0.08), chrome);
    spoke.geometry.translate(0, rimR * 0.4, 0);
    spoke.rotation.x = (i / 6) * Math.PI * 2;
    spoke.position.x = faceX + (left ? -0.02 : 0.02);
    spin.add(spoke);
  }
  const lip = new THREE.Mesh(new THREE.TorusGeometry(rimR * 0.95, 0.035, 8, 20), chrome);
  lip.rotation.y = Math.PI / 2;
  lip.position.x = faceX;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 12), chrome);
  hub.rotation.z = Math.PI / 2;
  hub.position.x = faceX + (left ? -0.02 : 0.02);
  // chunky tread blocks
  for (let i = 0; i < 16; i++) {
    const block = new THREE.Mesh(new THREE.BoxGeometry(TIRE_W * 0.7, 0.05, 0.08), rubber);
    const ang = (i / 16) * Math.PI * 2;
    block.position.set(0, Math.sin(ang) * (TIRE_R - 0.02), Math.cos(ang) * (TIRE_R - 0.02));
    block.rotation.x = ang;
    spin.add(block);
  }
  spin.add(lip, hub);
  pivot.add(spin);
  pivot.position.set(left ? -x : x, TIRE_R, z);
  return pivot;
}

function build() {
  const root = new THREE.Group();
  root.name = "mastodon";
  const chassis = new THREE.Group();
  chassis.name = "chassis";

  const track = 1.15;
  const frontZ = 1.55;
  const rearZ = -1.45;
  const ride = TIRE_R; // body sits above tire contact; chassis parts use absolute y

  // Frame / rocker
  chassis.add(box(1.9, 0.18, 4.6, dark, 0, 0.55, 0.05));
  // Skid plate
  chassis.add(box(1.5, 0.08, 1.1, dark, 0, 0.42, 1.7));

  // Cab body (boxy 4-door)
  const cab = box(2.05, 1.15, 2.15, paint, 0, 1.25, 0.55);
  cab.name = "body";
  chassis.add(cab);
  // Hood
  chassis.add(box(2.0, 0.55, 1.35, paint, 0, 0.95, 1.85));
  // Bed floor + sides + tailgate
  chassis.add(box(1.95, 0.12, 2.0, dark, 0, 0.82, -1.55));
  chassis.add(box(0.1, 0.55, 1.95, paint, -0.95, 1.1, -1.55));
  chassis.add(box(0.1, 0.55, 1.95, paint, 0.95, 1.1, -1.55));
  const gate = box(1.9, 0.55, 0.1, paint, 0, 1.1, -2.55);
  chassis.add(gate);
  // Bed rails
  chassis.add(box(1.85, 0.06, 0.08, dark, 0, 1.4, -0.65));
  chassis.add(box(1.85, 0.06, 0.08, dark, 0, 1.4, -2.45));

  // Windows: windshield, rear glass, side windows
  const windshield = box(1.7, 0.7, 0.08, glass, 0, 1.7, 1.45);
  windshield.name = "glass";
  windshield.rotation.x = -0.35;
  chassis.add(windshield);
  chassis.add(box(1.65, 0.65, 0.06, glass, 0, 1.72, -0.45));
  for (const side of [-1, 1]) {
    chassis.add(box(0.06, 0.55, 0.7, glass, side * 1.04, 1.65, 1.0));
    chassis.add(box(0.06, 0.55, 0.7, glass, side * 1.04, 1.65, 0.2));
  }

  // A/B/C pillars
  for (const side of [-1, 1]) {
    chassis.add(box(0.1, 0.85, 0.12, paint, side * 0.95, 1.55, 1.5));
    chassis.add(box(0.1, 0.85, 0.12, paint, side * 0.95, 1.55, 0.55));
    chassis.add(box(0.1, 0.85, 0.12, paint, side * 0.95, 1.55, -0.4));
  }

  // Wide fender flares
  for (const side of [-1, 1]) {
    chassis.add(box(0.28, 0.55, 0.95, paint, side * 1.15, 0.95, frontZ));
    chassis.add(box(0.28, 0.55, 0.95, paint, side * 1.15, 0.95, rearZ));
  }

  // Big flat grille + bumper
  chassis.add(box(1.7, 0.55, 0.12, dark, 0, 0.85, 2.55));
  for (let i = 0; i < 5; i++) {
    chassis.add(box(1.45, 0.04, 0.04, chrome, 0, 0.66 + i * 0.1, 2.62));
  }
  chassis.add(box(2.0, 0.22, 0.28, dark, 0, 0.55, 2.45));
  // Headlights
  chassis.add(box(0.35, 0.22, 0.1, head, -0.7, 0.95, 2.58));
  chassis.add(box(0.35, 0.22, 0.1, head, 0.7, 0.95, 2.58));
  // Square taillights on tailgate
  chassis.add(box(0.28, 0.28, 0.08, tail, -0.7, 1.15, -2.62));
  chassis.add(box(0.28, 0.28, 0.08, tail, 0.7, 1.15, -2.62));

  // Roof light bar
  chassis.add(box(1.5, 0.1, 0.16, dark, 0, 1.95, 0.7));
  for (let i = -2; i <= 2; i++) {
    chassis.add(box(0.16, 0.12, 0.14, head, i * 0.28, 2.05, 0.7));
  }

  // Side mirrors
  for (const side of [-1, 1]) {
    chassis.add(box(0.08, 0.06, 0.18, dark, side * 1.15, 1.45, 1.35));
    chassis.add(box(0.22, 0.16, 0.28, dark, side * 1.32, 1.48, 1.35));
    chassis.add(box(0.04, 0.12, 0.2, chrome, side * 1.42, 1.48, 1.35));
  }

  // Exhaust tip
  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.2, 10), chrome);
  exhaust.rotation.x = Math.PI / 2;
  exhaust.position.set(0.7, 0.48, -2.6);
  chassis.add(exhaust);

  root.add(chassis);
  for (const left of [true, false]) {
    root.add(wheel(true, left, track, frontZ));
    root.add(wheel(false, left, track + 0.05, rearZ));
  }
  return root;
}

mkdirSync(new URL("../public/models/", import.meta.url), { recursive: true });
const model = build();
const exporter = new GLTFExporter();
const glb = await exporter.parseAsync(model, { binary: true });
const file = new URL("../public/models/shovel-mastodon.glb", import.meta.url);
writeFileSync(file, Buffer.from(glb));
let tris = 0;
model.traverse((o) => {
  if (o.isMesh && o.geometry?.index) tris += o.geometry.index.count / 3;
});
console.log("shovel-mastodon.glb", Buffer.from(glb).length, "tris", Math.round(tris), "tireR", TIRE_R);
