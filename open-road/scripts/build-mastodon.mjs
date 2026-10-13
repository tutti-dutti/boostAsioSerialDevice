/**
 * Shovel-A Mastodon — lifted Silverado ZR2 style pickup.
 * Closed 4-door cab, wide bar grille, painted bed, light bar, flares, big tires.
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

const paint = new THREE.MeshStandardMaterial({ name: "paint", color: 0xffffff, metalness: 0.4, roughness: 0.45 });
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

const TIRE_R = 0.58;
const TIRE_W = 0.4;

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
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(TIRE_R * 0.55, TIRE_R * 0.55, 0.05, 14), dark);
  dish.rotation.z = Math.PI / 2;
  const faceX = left ? -TIRE_W * 0.52 : TIRE_W * 0.52;
  dish.position.x = faceX;
  spin.add(tire, dish);
  for (let i = 0; i < 5; i++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.05, TIRE_R * 0.4, 0.08), chrome);
    spoke.geometry.translate(0, TIRE_R * 0.35, 0);
    spoke.rotation.x = (i / 5) * Math.PI * 2;
    spoke.position.x = faceX;
    spin.add(spoke);
  }
  pivot.add(spin);
  pivot.position.set(left ? -x : x, TIRE_R, z);
  return pivot;
}

const root = new THREE.Group();
root.name = "mastodon";
const c = new THREE.Group();
c.name = "chassis";

// Frame / sills
c.add(box(2.0, 0.22, 5.0, dark, 0, 0.55, -0.15));

// Closed 4-door cab with solid roof
c.add(box(2.05, 0.95, 2.55, paint, 0, 1.15, 0.55)); // cabin walls
c.add(box(2.0, 0.14, 2.5, paint, 0, 1.68, 0.55)); // solid roof
// Door creases
for (const z of [0.2, 0.95]) {
  for (const s of [-1, 1]) c.add(box(0.04, 0.7, 0.04, dark, s * 1.04, 1.1, z));
}

// Glass: windshield, rear, sides (4 doors)
const ws = box(1.85, 0.55, 0.08, glass, 0, 1.35, 1.75);
ws.name = "glass";
ws.rotation.x = -0.28;
c.add(ws);
c.add(box(1.8, 0.5, 0.06, glass, 0, 1.35, -0.65));
for (const s of [-1, 1]) {
  c.add(box(0.06, 0.45, 0.85, glass, s * 1.04, 1.3, 1.05)); // front doors
  c.add(box(0.06, 0.45, 0.85, glass, s * 1.04, 1.3, 0.15)); // rear doors
}

// Hood
c.add(box(1.95, 0.22, 1.35, paint, 0, 0.95, 2.15));
c.add(box(1.7, 0.08, 0.9, dark, 0, 1.08, 2.2)); // hood vent panel

// Wide horizontal grille with thick bar
c.add(box(1.85, 0.55, 0.12, dark, 0, 0.78, 2.85));
c.add(box(1.7, 0.1, 0.14, chrome, 0, 0.78, 2.92)); // thick middle bar
for (let i = -3; i <= 3; i++) {
  if (i === 0) continue;
  c.add(box(1.55, 0.04, 0.06, chrome, 0, 0.78 + i * 0.07, 2.9));
}
for (const s of [-1, 1]) {
  c.add(box(0.42, 0.28, 0.12, head, s * 0.85, 0.85, 2.88));
  c.add(box(0.18, 0.12, 0.28, dark, s * 1.2, 1.25, 1.55)); // mirrors
}

// Painted open bed + tailgate (same body color)
c.add(box(2.0, 0.12, 2.15, paint, 0, 0.78, -1.85)); // bed floor
for (const s of [-1, 1]) {
  c.add(box(0.1, 0.55, 2.15, paint, s * 0.98, 1.05, -1.85)); // bed sides
}
c.add(box(2.0, 0.55, 0.1, paint, 0, 1.05, -2.9)); // tailgate
for (const s of [-1, 1]) {
  c.add(box(0.28, 0.22, 0.1, tail, s * 0.75, 0.95, -2.95));
}

// Fender flares
for (const s of [-1, 1]) {
  c.add(box(0.35, 0.35, 0.85, dark, s * 1.2, 0.85, 1.85));
  c.add(box(0.35, 0.35, 0.85, dark, s * 1.2, 0.85, -1.55));
}

// Roof light bar
c.add(box(1.5, 0.1, 0.16, dark, 0, 1.85, 1.4));
for (let i = -2; i <= 2; i++) {
  c.add(box(0.14, 0.12, 0.12, head, i * 0.3, 1.88, 1.4));
}

// Bumpers
c.add(box(2.1, 0.18, 0.35, dark, 0, 0.55, 3.05));
c.add(box(2.05, 0.16, 0.28, dark, 0, 0.55, -3.05));

root.add(c);
const track = 1.2;
for (const left of [true, false]) {
  root.add(wheel(true, left, track, 1.85));
  root.add(wheel(false, left, track + 0.04, -1.55));
}

mkdirSync(new URL("../public/models/", import.meta.url), { recursive: true });
const exporter = new GLTFExporter();
const glb = await exporter.parseAsync(root, { binary: true });
const file = new URL("../public/models/shovel-mastodon.glb", import.meta.url);
writeFileSync(file, Buffer.from(glb));
console.log("shovel-mastodon.glb", Buffer.from(glb).length);
