/**
 * Hand-builds every garage car as its own original GLB.
 * Shared helpers only — no two cars share a body mesh.
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

const paint = new THREE.MeshStandardMaterial({ name: "paint", color: 0xffffff, metalness: 0.62, roughness: 0.24 });
const paintDark = new THREE.MeshStandardMaterial({ name: "paint-dark", color: 0x121418, metalness: 0.55, roughness: 0.35 });
const glass = new THREE.MeshStandardMaterial({
  name: "glass",
  color: 0x0a1828,
  metalness: 0.1,
  roughness: 0.04,
  transparent: true,
  opacity: 0.62,
});
const rubber = new THREE.MeshStandardMaterial({ name: "rubber", color: 0x121212, metalness: 0.04, roughness: 0.94 });
const chrome = new THREE.MeshStandardMaterial({ name: "chrome", color: 0xe8eef5, metalness: 0.75, roughness: 0.25 });
const dark = new THREE.MeshStandardMaterial({ name: "dark", color: 0x0c0e12, metalness: 0.45, roughness: 0.55 });
const head = new THREE.MeshStandardMaterial({
  name: "light-head",
  color: 0xfff6d8,
  emissive: 0xfff3c4,
  emissiveIntensity: 2.4,
  roughness: 0.22,
});
const tail = new THREE.MeshStandardMaterial({
  name: "light-tail",
  color: 0xff1a1a,
  emissive: 0xff1010,
  emissiveIntensity: 2.2,
  roughness: 0.25,
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

function wheel(front, left, x, z, scale = 1, wide = 1) {
  const pivot = new THREE.Group();
  pivot.name = `wheel-${front ? "front" : "back"}-${left ? "left" : "right"}`;
  const spin = new THREE.Group();
  const r = 0.34 * scale;
  const w = 0.26 * scale * wide;
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 20), rubber);
  tire.rotation.z = Math.PI / 2;
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, 0.04, 14), dark);
  dish.rotation.z = Math.PI / 2;
  const faceX = left ? -w * 0.52 : w * 0.52;
  dish.position.x = faceX;
  spin.add(tire, dish);
  for (let i = 0; i < 5; i++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.035, r * 0.42, 0.06), chrome);
    spoke.geometry.translate(0, r * 0.35, 0);
    spoke.rotation.x = (i / 5) * Math.PI * 2;
    spoke.position.x = faceX + (left ? -0.015 : 0.015);
    spin.add(spoke);
  }
  pivot.add(spin);
  pivot.position.set(left ? -x : x, r, z);
  return pivot;
}

function addWheels(root, trackF, trackR, zF, zR, scale = 1, rearWide = 1.15) {
  for (const left of [true, false]) {
    root.add(wheel(true, left, trackF, zF, scale, 1));
    root.add(wheel(false, left, trackR, zR, scale, rearWide));
  }
}

function hexPanel(size, material) {
  const shape = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
    const px = Math.cos(a) * size;
    const py = Math.sin(a) * size;
    if (i === 0) shape.moveTo(px, py);
    else shape.lineTo(px, py);
  }
  shape.closePath();
  return new THREE.Mesh(new THREE.ShapeGeometry(shape), material);
}

function finish(root, file) {
  return { root, file };
}

/** Lambchop wedge supercar family */
function buildLambchop(style) {
  const root = new THREE.Group();
  root.name = style.id;
  const chassis = new THREE.Group();
  chassis.name = "chassis";
  const W = style.width;
  const L = style.length;
  const roofY = 0.72 + (style.roofLift ?? 0);

  chassis.add(box(2.05 * W, 0.36, 4.15 * L, paint, 0, 0.5, 0.05));
  const hood = box(1.9 * W, 0.18, 1.55 * L, paint, 0, 0.58, 1.45 * L);
  hood.rotation.x = 0.14;
  chassis.add(hood);
  const nose = box(1.45 * W, 0.16, 0.65, paint, 0, 0.4, 2.15 * L);
  nose.rotation.x = 0.32;
  chassis.add(nose);

  // Low sloped cabin / roof
  chassis.add(box(1.35 * W, 0.22, 1.35 * L, paint, 0, roofY - 0.02, -0.1));
  const roof = box(1.15 * W, 0.1, 1.2 * L, paint, 0, roofY + 0.12, -0.2);
  roof.rotation.x = -0.22;
  chassis.add(roof);
  const windshield = box(1.2 * W, 0.38, 0.07, glass, 0, roofY + 0.02, 0.55 * L);
  windshield.name = "glass";
  windshield.rotation.x = -0.52;
  chassis.add(windshield);
  chassis.add(box(1.05 * W, 0.28, 0.06, glass, 0, roofY + 0.06, -0.8 * L));
  for (const s of [-1, 1]) {
    chassis.add(box(0.05, 0.24, 0.85, glass, s * 0.72 * W, roofY, -0.05));
    chassis.add(box(0.18, 0.26, 3.4 * L, paint, s * 1.05 * W, 0.38, 0));
    chassis.add(box(0.16, 0.3, 0.8, dark, s * 1.1 * W, 0.52, -0.3));
    chassis.add(box(0.08, 0.05, 0.14, dark, s * 0.95 * W, 0.68, 0.5));
    chassis.add(box(0.18, 0.1, 0.2, dark, s * 1.12 * W, 0.7, 0.5));
  }

  chassis.add(box(2.05 * W, 0.05, 0.4, dark, 0, 0.2, 2.2 * L));
  for (const s of [-1, 1]) {
    const lamp = box(0.42, 0.07, 0.1, head, s * 0.65 * W, 0.46, 2.25 * L);
    lamp.rotation.z = s * -0.3;
    chassis.add(lamp);
  }

  // Hex rear grille
  chassis.add(box(1.8 * W, 0.5, 0.07, dark, 0, 0.52, -2.05 * L));
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 5; col++) {
      const hex = hexPanel(0.08, chrome);
      hex.position.set((-2 + col) * 0.26 * W, 0.36 + row * 0.14, -2.1 * L);
      chassis.add(hex);
    }
  }
  // Y taillights
  for (const s of [-1, 1]) {
    chassis.add(box(0.05, 0.26, 0.04, tail, s * 0.14, 0.68, -2.12 * L));
    const arm = box(0.5, 0.05, 0.04, tail, s * 0.42, 0.78, -2.12 * L);
    arm.rotation.z = s * -0.22;
    chassis.add(arm);
    const armL = box(0.36, 0.04, 0.04, tail, s * 0.32, 0.58, -2.12 * L);
    armL.rotation.z = s * 0.32;
    chassis.add(armL);
  }
  if (style.tailBar) chassis.add(box(1.5 * W, 0.04, 0.04, tail, 0, 0.74, -2.14 * L));

  chassis.add(box(1.9 * W, 0.07, 0.5, dark, 0, 0.2, -2.15 * L));
  for (let i = -2; i <= 2; i++) chassis.add(box(0.07, 0.2, 0.4, dark, i * 0.32 * W, 0.3, -2.1 * L));
  for (const x of style.exhausts) {
    chassis.add(cyl(0.05, 0.055, 0.14, chrome, x, 0.26, -2.3 * L, Math.PI / 2, 0, 0));
  }

  if (style.wing === "race") {
    chassis.add(box(2.0 * W, 0.04, 0.32, paint, 0, 0.95, -1.7 * L));
    for (const s of [-1, 1]) chassis.add(box(0.04, 0.28, 0.18, dark, s * 0.85 * W, 0.82, -1.7 * L));
  } else if (style.wing === "lip") {
    const lip = box(1.8 * W, 0.04, 0.2, paint, 0, 0.68, -1.85 * L);
    lip.rotation.x = -0.35;
    chassis.add(lip);
  }

  root.add(chassis);
  // Wheels tucked under fenders (track inside body width)
  const track = 0.95 * W;
  addWheels(root, track, track * 1.05, 1.45 * L, -1.4 * L, style.wheelScale ?? 0.95, 1.25);
  return finish(root, style.file);
}

/** Classic 911-like fastback */
function buildDeathstalker() {
  const root = new THREE.Group();
  root.name = "deathstalker";
  const c = new THREE.Group();
  c.name = "chassis";
  c.add(box(1.75, 0.4, 3.6, paint, 0, 0.48, 0));
  // Round frog-eye fenders
  for (const s of [-1, 1]) {
    c.add(cyl(0.32, 0.32, 0.55, paint, s * 0.85, 0.48, 1.35, 0, 0, Math.PI / 2));
    c.add(cyl(0.12, 0.12, 0.08, head, s * 0.85, 0.55, 1.62, Math.PI / 2, 0, 0));
  }
  // Fastback roof curving to tail
  const cabin = box(1.45, 0.45, 1.6, paint, 0, 0.85, -0.15);
  cabin.rotation.x = -0.08;
  c.add(cabin);
  const fastback = box(1.4, 0.28, 1.2, paint, 0, 0.78, -1.2);
  fastback.rotation.x = -0.35;
  c.add(fastback);
  const ws = box(1.3, 0.4, 0.06, glass, 0, 0.85, 0.55);
  ws.name = "glass";
  ws.rotation.x = -0.45;
  c.add(ws);
  c.add(box(1.15, 0.28, 0.05, glass, 0, 0.82, -0.95));
  for (const s of [-1, 1]) c.add(box(0.05, 0.28, 0.9, glass, s * 0.75, 0.82, -0.1));
  // Wide rear hips
  c.add(box(1.95, 0.35, 0.9, paint, 0, 0.5, -1.55));
  // Ducktail
  const duck = box(1.7, 0.06, 0.28, paint, 0, 0.78, -1.95);
  duck.rotation.x = -0.55;
  c.add(duck);
  for (const s of [-1, 1]) {
    c.add(box(0.35, 0.12, 0.08, tail, s * 0.55, 0.55, -1.95));
    c.add(box(0.12, 0.08, 0.16, dark, s * 0.95, 0.7, 0.4));
  }
  c.add(box(0.5, 0.08, 0.12, chrome, 0, 0.35, 1.85));
  root.add(c);
  addWheels(root, 0.88, 0.95, 1.25, -1.35, 0.95, 1.2);
  return finish(root, "porch-deathstalker.glb");
}

/** Open-top spyder (918-inspired silhouette) */
function buildHellbender() {
  const root = new THREE.Group();
  root.name = "hellbender";
  const c = new THREE.Group();
  c.name = "chassis";
  // Long low body + raised side sills
  c.add(box(1.9, 0.28, 4.1, paint, 0, 0.4, 0));
  c.add(box(1.7, 0.18, 3.6, paint, 0, 0.55, 0.1));
  for (const s of [-1, 1]) {
    // Curvy fender volumes over each wheel
    c.add(cyl(0.42, 0.36, 0.85, paint, s * 0.95, 0.5, 1.45, 0, 0, Math.PI / 2));
    c.add(cyl(0.44, 0.4, 0.9, paint, s * 1.0, 0.52, -1.4, 0, 0, Math.PI / 2));
    c.add(box(0.28, 0.22, 2.2, paint, s * 1.05, 0.42, 0.05));
    c.add(box(0.55, 0.1, 0.14, head, s * 0.55, 0.5, 2.15));
    c.add(box(0.12, 0.08, 0.18, dark, s * 1.15, 0.72, 0.55)); // mirrors
  }
  // Open cockpit tub + seats, no roof
  c.add(box(1.25, 0.16, 1.2, dark, 0, 0.58, 0.05));
  c.add(box(1.15, 0.42, 0.08, glass, 0, 0.82, 0.7));
  c.add(box(0.08, 0.35, 0.9, dark, -0.62, 0.78, 0.05)); // windshield pillars
  c.add(box(0.08, 0.35, 0.9, dark, 0.62, 0.78, 0.05));
  c.add(box(0.48, 0.38, 0.42, dark, -0.28, 0.78, -0.1));
  c.add(box(0.48, 0.38, 0.42, dark, 0.28, 0.78, -0.1));
  // Engine cover behind seats + twin stacks pointing up
  c.add(box(1.3, 0.22, 0.7, paint, 0, 0.62, -0.85));
  for (const s of [-1, 1]) {
    c.add(cyl(0.07, 0.08, 0.7, chrome, s * 0.2, 1.05, -0.55, 0, 0, 0));
    c.add(cyl(0.09, 0.09, 0.06, chrome, s * 0.2, 1.4, -0.55, 0, 0, 0));
  }
  c.add(box(1.8, 0.1, 0.4, dark, 0, 0.28, -2.1));
  for (const s of [-1, 1]) c.add(box(0.35, 0.1, 0.06, tail, s * 0.55, 0.52, -2.15));
  root.add(c);
  addWheels(root, 0.95, 1.0, 1.4, -1.4, 0.92, 1.15);
  return finish(root, "porch-hellbender.glb");
}

/** P1-style teardrop + wing */
function buildPterodactyl() {
  const root = new THREE.Group();
  root.name = "pterodactyl";
  const c = new THREE.Group();
  c.name = "chassis";
  c.add(box(1.9, 0.3, 4.0, paint, 0, 0.42, 0));
  const cabin = box(1.1, 0.45, 1.4, paint, 0, 0.75, 0.05);
  cabin.rotation.x = -0.05;
  c.add(cabin);
  const ws = box(1.0, 0.42, 0.06, glass, 0, 0.78, 0.7);
  ws.name = "glass";
  ws.rotation.x = -0.5;
  c.add(ws);
  c.add(box(0.9, 0.3, 0.05, glass, 0, 0.8, -0.55));
  for (const s of [-1, 1]) {
    c.add(box(0.45, 0.45, 1.0, dark, s * 0.95, 0.55, -0.2)); // huge side intakes
    c.add(box(0.55, 0.06, 0.1, head, s * 0.5, 0.45, 2.05));
    c.add(box(0.05, 0.35, 0.22, dark, s * 0.7, 0.85, -1.55));
  }
  c.add(box(2.0, 0.05, 0.4, paint, 0, 1.15, -1.55)); // big wing
  c.add(box(1.6, 0.08, 0.5, dark, 0, 0.28, -2.05));
  for (const s of [-1, 1]) c.add(box(0.4, 0.08, 0.05, tail, s * 0.45, 0.55, -2.1));
  root.add(c);
  addWheels(root, 0.95, 1.05, 1.4, -1.45, 0.93, 1.2);
  return finish(root, "mcroar-pterodactyl.glb");
}

/** Long Speedtail teardrop */
function buildGreatWhite() {
  const root = new THREE.Group();
  root.name = "great-white";
  const c = new THREE.Group();
  c.name = "chassis";
  c.add(box(1.7, 0.28, 4.6, paint, 0, 0.4, -0.1));
  const nose = box(1.4, 0.22, 1.2, paint, 0, 0.42, 1.9);
  nose.rotation.x = 0.08;
  c.add(nose);
  const cabin = box(1.15, 0.4, 1.8, paint, 0, 0.7, 0.2);
  cabin.rotation.x = -0.04;
  c.add(cabin);
  const tailBody = box(1.35, 0.22, 1.6, paint, 0, 0.48, -1.7);
  tailBody.rotation.x = -0.12;
  c.add(tailBody);
  const ws = box(1.05, 0.38, 0.06, glass, 0, 0.72, 1.0);
  ws.name = "glass";
  ws.rotation.x = -0.48;
  c.add(ws);
  c.add(box(0.95, 0.25, 0.05, glass, 0, 0.7, -0.5));
  for (const s of [-1, 1]) {
    c.add(box(0.45, 0.05, 0.1, head, s * 0.5, 0.42, 2.45));
    c.add(box(0.35, 0.06, 0.05, tail, s * 0.4, 0.5, -2.45));
  }
  root.add(c);
  addWheels(root, 0.85, 0.9, 1.55, -1.7, 0.9, 1.1);
  return finish(root, "mcroar-great-white.glb");
}

/** Agera-style short nose + wing */
function buildLeviathan() {
  const root = new THREE.Group();
  root.name = "leviathan";
  const c = new THREE.Group();
  c.name = "chassis";
  c.add(box(2.0, 0.32, 3.8, paint, 0, 0.42, 0));
  c.add(box(1.5, 0.2, 0.9, paint, 0, 0.45, 1.7)); // short rounded nose
  c.add(box(1.3, 0.4, 1.3, paint, 0, 0.72, -0.1));
  const ws = box(1.15, 0.38, 0.06, glass, 0, 0.75, 0.55);
  ws.name = "glass";
  ws.rotation.x = -0.5;
  c.add(ws);
  c.add(box(1.0, 0.28, 0.05, glass, 0, 0.75, -0.65));
  for (const s of [-1, 1]) {
    c.add(box(0.5, 0.06, 0.1, head, s * 0.6, 0.45, 2.1));
    c.add(cyl(0.1, 0.1, 0.06, tail, s * 0.5, 0.55, -1.95, Math.PI / 2, 0, 0));
    c.add(box(0.05, 0.35, 0.2, dark, s * 0.75, 0.9, -1.5));
  }
  c.add(box(1.95, 0.05, 0.35, paint, 0, 1.15, -1.5));
  c.add(box(1.7, 0.08, 0.4, dark, 0, 0.25, -2.0));
  root.add(c);
  addWheels(root, 1.0, 1.1, 1.3, -1.35, 0.95, 1.25);
  return finish(root, "king-egg-leviathan.glb");
}

/** Veyron pebble + horseshoe */
function buildHellhound() {
  const root = new THREE.Group();
  root.name = "hellhound";
  const c = new THREE.Group();
  c.name = "chassis";
  // Rounded pebble silhouette (stacked tapered boxes) + two-tone lower.
  c.add(box(2.05, 0.32, 4.0, paintDark, 0, 0.28, 0));
  c.add(box(1.95, 0.36, 3.7, paint, 0, 0.55, 0));
  c.add(box(1.7, 0.28, 3.2, paint, 0, 0.72, -0.05));
  for (const s of [-1, 1]) {
    c.add(cyl(0.4, 0.36, 0.8, paint, s * 0.95, 0.5, 1.35, 0, 0, Math.PI / 2));
    c.add(cyl(0.42, 0.4, 0.85, paint, s * 1.0, 0.52, -1.35, 0, 0, Math.PI / 2));
  }
  const cabin = box(1.35, 0.38, 1.4, paint, 0, 0.95, -0.05);
  c.add(cabin);
  const ws = box(1.2, 0.38, 0.06, glass, 0, 0.95, 0.6);
  ws.name = "glass";
  ws.rotation.x = -0.42;
  c.add(ws);
  c.add(box(1.05, 0.28, 0.05, glass, 0, 0.95, -0.65));
  // Horseshoe grille
  c.add(box(0.85, 0.4, 0.1, chrome, 0, 0.45, 2.05));
  c.add(box(0.65, 0.28, 0.08, dark, 0, 0.45, 2.12));
  for (const s of [-1, 1]) {
    c.add(box(0.4, 0.12, 0.1, head, s * 0.7, 0.52, 2.05));
    c.add(box(0.28, 0.2, 0.4, dark, s * 0.32, 1.15, -0.15)); // roof scoops
    c.add(box(0.4, 0.12, 0.06, tail, s * 0.55, 0.58, -2.05));
  }
  root.add(c);
  addWheels(root, 0.95, 1.05, 1.35, -1.4, 0.95, 1.2);
  return finish(root, "baguetti-hellhound.glb");
}

/** Chiron C-curve */
function buildCerberus() {
  const root = new THREE.Group();
  root.name = "cerberus";
  const c = new THREE.Group();
  c.name = "chassis";
  c.add(box(2.0, 0.36, 4.1, paint, 0, 0.46, 0));
  c.add(box(1.45, 0.4, 1.55, paint, 0, 0.78, 0));
  const ws = box(1.3, 0.4, 0.06, glass, 0, 0.8, 0.7);
  ws.name = "glass";
  ws.rotation.x = -0.48;
  c.add(ws);
  c.add(box(1.15, 0.3, 0.05, glass, 0, 0.8, -0.7));
  c.add(box(0.75, 0.38, 0.08, chrome, 0, 0.42, 2.1));
  c.add(box(0.55, 0.25, 0.06, dark, 0, 0.42, 2.15));
  for (const s of [-1, 1]) {
    // Big C-shaped side curve (blocks approximating the C)
    c.add(box(0.2, 0.55, 1.8, paintDark, s * 1.05, 0.55, -0.1));
    c.add(box(0.35, 0.12, 0.5, paintDark, s * 0.95, 0.75, 0.7));
    c.add(box(0.4, 0.08, 0.1, head, s * 0.7, 0.48, 2.15));
  }
  // Thin light bar across the back
  c.add(box(1.7, 0.06, 0.05, tail, 0, 0.6, -2.1));
  c.add(box(1.6, 0.08, 0.4, dark, 0, 0.28, -2.15));
  root.add(c);
  addWheels(root, 1.0, 1.1, 1.4, -1.45, 0.96, 1.22);
  return finish(root, "baguetti-cerberus.glb");
}

/** F40 boxy wedge */
function buildJackal() {
  const root = new THREE.Group();
  root.name = "jackal";
  const c = new THREE.Group();
  c.name = "chassis";
  c.add(box(1.85, 0.35, 3.9, paint, 0, 0.45, 0));
  c.add(box(1.5, 0.22, 1.4, paint, 0, 0.55, 1.3));
  c.add(box(1.35, 0.45, 1.2, paint, 0, 0.78, -0.1));
  const ws = box(1.2, 0.4, 0.06, glass, 0, 0.8, 0.5);
  ws.name = "glass";
  ws.rotation.x = -0.42;
  c.add(ws);
  c.add(box(1.05, 0.28, 0.05, glass, 0, 0.8, -0.6));
  // Hood vents
  for (const z of [1.1, 1.35, 1.6]) {
    for (const s of [-1, 1]) c.add(box(0.25, 0.04, 0.12, dark, s * 0.35, 0.66, z));
  }
  // Huge flat rear wing
  c.add(box(2.05, 0.05, 0.45, paint, 0, 1.15, -1.55));
  for (const s of [-1, 1]) c.add(box(0.05, 0.4, 0.25, dark, s * 0.85, 0.95, -1.55));
  for (const s of [-1, 1]) {
    c.add(box(0.4, 0.08, 0.1, head, s * 0.55, 0.48, 2.05));
    c.add(box(0.35, 0.12, 0.06, tail, s * 0.5, 0.55, -2.0));
  }
  c.add(box(1.6, 0.08, 0.4, dark, 0, 0.28, -2.05));
  root.add(c);
  addWheels(root, 0.92, 1.0, 1.35, -1.4, 0.95, 1.2);
  return finish(root, "ferocity-jackal.glb");
}

/** LaFerrari curvy bubble */
function buildManticore() {
  const root = new THREE.Group();
  root.name = "manticore";
  const c = new THREE.Group();
  c.name = "chassis";
  c.add(box(1.9, 0.28, 4.0, paint, 0, 0.4, 0));
  const nose = box(1.2, 0.18, 1.0, paint, 0, 0.38, 1.85);
  nose.rotation.x = 0.15;
  c.add(nose);
  // Raised bubble cabin
  c.add(cyl(0.55, 0.65, 1.3, paint, 0, 0.72, 0, 0, 0, Math.PI / 2));
  c.add(box(1.2, 0.35, 1.2, paint, 0, 0.75, 0));
  const ws = box(1.05, 0.4, 0.06, glass, 0, 0.78, 0.55);
  ws.name = "glass";
  ws.rotation.x = -0.5;
  c.add(ws);
  c.add(box(0.95, 0.28, 0.05, glass, 0, 0.78, -0.55));
  for (const s of [-1, 1]) {
    c.add(box(0.45, 0.05, 0.12, head, s * 0.5, 0.4, 2.25));
    c.add(box(0.08, 0.25, 0.04, tail, s * 0.45, 0.55, -2.05));
    c.add(box(0.35, 0.25, 0.7, dark, s * 0.95, 0.5, -0.4));
  }
  c.add(box(1.7, 0.04, 0.25, paint, 0, 0.85, -1.7));
  root.add(c);
  addWheels(root, 0.95, 1.05, 1.4, -1.45, 0.92, 1.18);
  return finish(root, "ferocity-manticore.glb");
}

/** Corvette-style long angular */
function buildCorvette(id, file, sharp = 1) {
  const root = new THREE.Group();
  root.name = id;
  const c = new THREE.Group();
  c.name = "chassis";
  c.add(box(1.85, 0.3, 4.2, paint, 0, 0.42, 0));
  const hood = box(1.7, 0.16, 1.7, paint, 0, 0.5, 1.4);
  hood.rotation.x = 0.06 * sharp;
  c.add(hood);
  c.add(box(1.35, 0.38, 1.3, paint, 0, 0.72, -0.15));
  const ws = box(1.2, 0.36, 0.06, glass, 0, 0.75, 0.5);
  ws.name = "glass";
  ws.rotation.x = -0.48;
  c.add(ws);
  c.add(box(1.05, 0.26, 0.05, glass, 0, 0.75, -0.7));
  for (const s of [-1, 1]) {
    c.add(box(0.55, 0.05, 0.1, head, s * 0.6, 0.45, 2.2)); // thin headlights
    c.add(box(0.2, 0.25, 0.8, paint, s * 0.95, 0.45, 0.2)); // creases / haunches
    c.add(box(0.25, 0.1, 0.06, tail, s * 0.55, 0.55, -2.15));
  }
  // Quad exhausts
  for (const x of [-0.35, -0.18, 0.18, 0.35]) {
    c.add(cyl(0.04, 0.045, 0.12, chrome, x, 0.28, -2.25, Math.PI / 2, 0, 0));
  }
  if (sharp > 1) {
    const wing = box(1.7, 0.04, 0.22, paint, 0, 0.78, -1.85);
    wing.rotation.x = -0.3;
    c.add(wing);
  }
  root.add(c);
  addWheels(root, 0.92, 1.0, 1.45, -1.5, 0.95, 1.2);
  return finish(root, file);
}

/** Lifted Mastodon pickup (keep distinct) */
function buildMastodon() {
  const root = new THREE.Group();
  root.name = "mastodon";
  const c = new THREE.Group();
  c.name = "chassis";
  const TIRE_R = 0.55;
  c.add(box(2.1, 0.35, 2.4, paint, 0, 0.95, 0.55)); // cabin
  c.add(box(2.05, 0.12, 2.0, dark, 0, 0.72, -1.55)); // bed floor
  for (const s of [-1, 1]) {
    c.add(box(0.08, 0.45, 2.0, dark, s * 1.0, 0.95, -1.55)); // bed rails
  }
  c.add(box(2.05, 0.45, 0.08, dark, 0, 0.95, -2.55)); // tailgate
  c.add(box(2.0, 0.55, 0.15, chrome, 0, 0.85, 1.85)); // grille
  for (let i = -2; i <= 2; i++) c.add(box(0.08, 0.4, 0.04, dark, i * 0.28, 0.85, 1.93));
  for (const s of [-1, 1]) {
    c.add(box(0.35, 0.18, 0.12, head, s * 0.7, 0.9, 1.95));
    c.add(box(0.3, 0.18, 0.1, tail, s * 0.7, 0.95, -2.6));
    c.add(box(0.15, 0.12, 0.25, dark, s * 1.2, 1.15, 0.9)); // mirrors
    c.add(box(0.35, 0.2, 0.7, dark, s * 1.15, 0.7, 1.1)); // flares
    c.add(box(0.35, 0.2, 0.7, dark, s * 1.15, 0.7, -1.3));
  }
  const ws = box(1.7, 0.45, 0.08, glass, 0, 1.25, 1.35);
  ws.name = "glass";
  ws.rotation.x = -0.25;
  c.add(ws);
  c.add(box(1.6, 0.4, 0.06, glass, 0, 1.25, -0.4));
  for (const s of [-1, 1]) c.add(box(0.06, 0.35, 1.0, glass, s * 1.05, 1.2, 0.4));
  // Light bar
  c.add(box(1.4, 0.08, 0.12, chrome, 0, 1.55, 0.9));
  for (let i = -2; i <= 2; i++) c.add(box(0.12, 0.1, 0.1, head, i * 0.28, 1.55, 0.9));
  c.add(box(1.9, 0.2, 4.2, dark, 0, 0.45, -0.2)); // frame
  root.add(c);
  for (const left of [true, false]) {
    for (const front of [true, false]) {
      const pivot = new THREE.Group();
      pivot.name = `wheel-${front ? "front" : "back"}-${left ? "left" : "right"}`;
      const spin = new THREE.Group();
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(TIRE_R, TIRE_R, 0.38, 18), rubber);
      tire.rotation.z = Math.PI / 2;
      spin.add(tire);
      pivot.add(spin);
      pivot.position.set(left ? -1.15 : 1.15, TIRE_R, front ? 1.35 : -1.45);
      root.add(pivot);
    }
  }
  return finish(root, "shovel-mastodon.glb");
}

const cars = [
  buildLambchop({
    id: "chupacabra",
    file: "lambchop-chupacabra.glb",
    width: 1.08,
    length: 1.0,
    roofLift: 0.02,
    wing: "lip",
    exhausts: [-0.16, 0.16],
    wheelScale: 0.92,
  }),
  buildLambchop({
    id: "minotaur",
    file: "lambchop-minotaur.glb",
    width: 1.1,
    length: 1.08,
    roofLift: 0,
    wing: "race",
    exhausts: [-0.22, 0, 0.22],
    tailBar: true,
    wheelScale: 0.94,
  }),
  buildLambchop({
    id: "bonehorn",
    file: "lambchop-bonehorn.glb",
    width: 1.06,
    length: 0.94,
    roofLift: 0.04,
    wing: "lip",
    exhausts: [-0.14, 0.14],
    wheelScale: 0.9,
  }),
  buildDeathstalker(),
  buildHellbender(),
  buildPterodactyl(),
  buildGreatWhite(),
  buildLeviathan(),
  buildHellhound(),
  buildCerberus(),
  buildJackal(),
  buildManticore(),
  buildCorvette("thresher", "shovel-thresher.glb", 1),
  buildCorvette("megalodon", "shovel-megalodon.glb", 1.3),
  buildMastodon(),
];

mkdirSync(new URL("../public/models/", import.meta.url), { recursive: true });
for (const { root, file } of cars) {
  const exporter = new GLTFExporter();
  const glb = await exporter.parseAsync(root, { binary: true });
  const path = new URL(`../public/models/${file}`, import.meta.url);
  writeFileSync(path, Buffer.from(glb));
  console.log(file, Buffer.from(glb).length);
}
