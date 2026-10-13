/**
 * Beep Sabertooth — Jeep Gladiator style open pickup (saved jeep body).
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

const paint = new THREE.MeshStandardMaterial({ name: "paint", color: 0xffffff, metalness: 0.4, roughness: 0.5 });
const glass = new THREE.MeshStandardMaterial({
  name: "glass",
  color: 0x1a2430,
  metalness: 0.1,
  roughness: 0.08,
  transparent: true,
  opacity: 0.7,
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

const TIRE_R = 0.56;
const TIRE_W = 0.38;

function box(w, h, d, material, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  return mesh;
}

function wheel(front, left, x, z) {
  const pivot = new THREE.Group();
  pivot.name = `wheel-${front ? "front" : "back"}-${left ? "left" : "right"}`;
  const spin = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(TIRE_R, TIRE_R, TIRE_W, 18), rubber);
  tire.rotation.z = Math.PI / 2;
  spin.add(tire);
  pivot.add(spin);
  pivot.position.set(left ? -x : x, TIRE_R, z);
  return pivot;
}

const root = new THREE.Group();
root.name = "sabertooth";
const c = new THREE.Group();
c.name = "chassis";

c.add(box(1.9, 0.2, 4.6, dark, 0, 0.5, -0.1));
// Open jeep cabin (no roof) with windshield frame
c.add(box(1.85, 0.55, 1.9, paint, 0, 0.95, 0.55));
c.add(box(1.7, 0.08, 0.08, dark, 0, 1.45, 1.4)); // windshield header
const ws = box(1.65, 0.55, 0.06, glass, 0, 1.2, 1.45);
ws.name = "glass";
ws.rotation.x = -0.15;
c.add(ws);
for (const s of [-1, 1]) {
  c.add(box(0.08, 0.55, 0.08, dark, s * 0.85, 1.2, 1.4));
  c.add(box(0.1, 0.45, 1.5, paint, s * 0.95, 1.05, 0.4)); // tub sides
}
c.add(box(0.9, 0.35, 0.55, dark, -0.35, 0.95, 0.5)); // seats
c.add(box(0.9, 0.35, 0.55, dark, 0.35, 0.95, 0.5));

// Slotted Jeep grille + round headlights
c.add(box(1.6, 0.55, 0.12, dark, 0, 0.85, 2.15));
for (let i = -3; i <= 3; i++) {
  c.add(box(0.08, 0.45, 0.06, chrome, i * 0.18, 0.85, 2.22));
}
for (const s of [-1, 1]) {
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.1, 16), head);
  lamp.rotation.x = Math.PI / 2;
  lamp.position.set(s * 0.85, 0.9, 2.22);
  c.add(lamp);
  c.add(box(0.15, 0.12, 0.25, dark, s * 1.1, 1.2, 1.2));
  c.add(box(0.32, 0.28, 0.7, dark, s * 1.1, 0.75, 1.5)); // flares
  c.add(box(0.32, 0.28, 0.7, dark, s * 1.1, 0.75, -1.4));
}

// Short pickup bed
c.add(box(1.85, 0.1, 1.7, paint, 0, 0.7, -1.7));
for (const s of [-1, 1]) c.add(box(0.08, 0.45, 1.7, paint, s * 0.9, 0.95, -1.7));
c.add(box(1.85, 0.45, 0.08, paint, 0, 0.95, -2.55));
for (const s of [-1, 1]) c.add(box(0.25, 0.18, 0.08, tail, s * 0.7, 0.9, -2.6));

// Roll bar
c.add(box(1.5, 0.08, 0.08, dark, 0, 1.65, -0.2));
for (const s of [-1, 1]) c.add(box(0.08, 0.55, 0.08, dark, s * 0.75, 1.4, -0.2));

root.add(c);
for (const left of [true, false]) {
  root.add(wheel(true, left, 1.15, 1.5));
  root.add(wheel(false, left, 1.18, -1.4));
}

mkdirSync(new URL("../public/models/", import.meta.url), { recursive: true });
const exporter = new GLTFExporter();
const glb = await exporter.parseAsync(root, { binary: true });
writeFileSync(new URL("../public/models/beep-sabertooth.glb", import.meta.url), Buffer.from(glb));
console.log("beep-sabertooth.glb", Buffer.from(glb).length);
