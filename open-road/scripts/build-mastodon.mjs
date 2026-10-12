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

const TIRE_R = 0.55;
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

  // Tall lifted stance: short cab up front, long open bed behind.
  const track = 1.28;
  const frontZ = 1.75;
  const rearZ = -1.7;

  // Frame / rockers (high ground clearance)
  chassis.add(box(2.05, 0.2, 5.2, dark, 0, 0.72, 0));
  chassis.add(box(1.6, 0.1, 1.2, dark, 0, 0.55, 1.9));

  // Short crew cab (not an SUV greenhouse)
  const cab = box(2.15, 1.05, 1.85, paint, 0, 1.55, 0.85);
  cab.name = "body";
  chassis.add(cab);
  // Hood / nose
  chassis.add(box(2.1, 0.5, 1.55, paint, 0, 1.2, 2.15));
  // Cab roof
  chassis.add(box(2.05, 0.12, 1.7, paint, 0, 2.12, 0.85));

  // OPEN bed: floor, low side walls, open top, tailgate
  chassis.add(box(2.05, 0.1, 2.35, dark, 0, 1.05, -1.55));
  chassis.add(box(0.12, 0.62, 2.3, paint, -1.0, 1.35, -1.55));
  chassis.add(box(0.12, 0.62, 2.3, paint, 1.0, 1.35, -1.55));
  // Front bed wall (behind cab)
  chassis.add(box(2.0, 0.7, 0.1, paint, 0, 1.4, -0.35));
  // Tailgate
  chassis.add(box(1.95, 0.62, 0.12, paint, 0, 1.35, -2.75));
  // Bed rails (shows it's open, not a capped SUV)
  chassis.add(box(0.06, 0.08, 2.25, chrome, -0.95, 1.72, -1.55));
  chassis.add(box(0.06, 0.08, 2.25, chrome, 0.95, 1.72, -1.55));

  // Glass
  const windshield = box(1.85, 0.72, 0.08, glass, 0, 1.95, 1.7);
  windshield.name = "glass";
  windshield.rotation.x = -0.28;
  chassis.add(windshield);
  chassis.add(box(1.7, 0.55, 0.06, glass, 0, 1.95, -0.05));
  for (const side of [-1, 1]) {
    chassis.add(box(0.06, 0.5, 0.65, glass, side * 1.09, 1.85, 1.15));
    chassis.add(box(0.06, 0.5, 0.55, glass, side * 1.09, 1.85, 0.4));
  }

  // Pillars
  for (const side of [-1, 1]) {
    chassis.add(box(0.12, 0.9, 0.14, paint, side * 1.0, 1.85, 1.7));
    chassis.add(box(0.12, 0.9, 0.14, paint, side * 1.0, 1.85, 0.85));
    chassis.add(box(0.12, 0.9, 0.14, paint, side * 1.0, 1.85, 0.05));
  }

  // Big fender flares over large tires
  for (const side of [-1, 1]) {
    chassis.add(box(0.38, 0.7, 1.15, paint, side * 1.28, 1.2, frontZ));
    chassis.add(box(0.38, 0.7, 1.15, paint, side * 1.28, 1.2, rearZ));
  }

  // Huge grille + bumper
  chassis.add(box(1.95, 0.75, 0.16, dark, 0, 1.15, 2.95));
  for (let i = 0; i < 6; i++) {
    chassis.add(box(1.65, 0.05, 0.05, chrome, 0, 0.9 + i * 0.1, 3.05));
  }
  chassis.add(box(2.25, 0.28, 0.35, dark, 0, 0.72, 2.85));
  // Tow hooks
  chassis.add(box(0.12, 0.1, 0.18, chrome, -0.7, 0.62, 3.05));
  chassis.add(box(0.12, 0.1, 0.18, chrome, 0.7, 0.62, 3.05));

  // Headlights
  chassis.add(box(0.4, 0.26, 0.12, head, -0.78, 1.25, 3.0));
  chassis.add(box(0.4, 0.26, 0.12, head, 0.78, 1.25, 3.0));
  // Square taillights on tailgate
  chassis.add(box(0.32, 0.32, 0.1, tail, -0.75, 1.4, -2.85));
  chassis.add(box(0.32, 0.32, 0.1, tail, 0.75, 1.4, -2.85));

  // Roof light bar
  chassis.add(box(1.7, 0.12, 0.2, dark, 0, 2.3, 0.95));
  for (let i = -2; i <= 2; i++) {
    chassis.add(box(0.18, 0.14, 0.16, head, i * 0.3, 2.42, 0.95));
  }

  // Side mirrors
  for (const side of [-1, 1]) {
    chassis.add(box(0.1, 0.08, 0.22, dark, side * 1.2, 1.75, 1.55));
    chassis.add(box(0.28, 0.2, 0.34, dark, side * 1.42, 1.78, 1.55));
    chassis.add(box(0.05, 0.14, 0.24, chrome, side * 1.54, 1.78, 1.55));
  }

  // Dual exhaust tips under bed
  for (const x of [-0.55, 0.55]) {
    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.22, 10), chrome);
    exhaust.rotation.x = Math.PI / 2;
    exhaust.position.set(x, 0.62, -2.85);
    chassis.add(exhaust);
  }

  root.add(chassis);
  for (const left of [true, false]) {
    root.add(wheel(true, left, track, frontZ));
    root.add(wheel(false, left, track + 0.06, rearZ));
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
