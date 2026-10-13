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

/**
 * Extrude a side silhouette (points in Z/Y, front = +Z) into a body of given width.
 * Points are upper outline from nose→tail; underside is auto-closed near yFloor.
 */
function sideBody(upperZY, width, material, yFloor = 0.22) {
  const shape = new THREE.Shape();
  const first = upperZY[0];
  shape.moveTo(first[0], first[1]);
  for (let i = 1; i < upperZY.length; i++) shape.lineTo(upperZY[i][0], upperZY[i][1]);
  const last = upperZY[upperZY.length - 1];
  shape.lineTo(last[0], yFloor);
  shape.lineTo(first[0], yFloor);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false, curveSegments: 1 });
  // Shape XY = car Z/Y; extrude depth = width along +Z → rotate so depth becomes X.
  geo.rotateY(-Math.PI / 2);
  geo.translate(width / 2, 0, 0);
  return new THREE.Mesh(geo, material);
}

function finish(root, file) {
  return { root, file };
}

/** Lambchop family: closed sloping roof, sharp nose, hex lights — not open-top slabs. */
function buildLambchop(style) {
  const root = new THREE.Group();
  root.name = style.id;
  const chassis = new THREE.Group();
  chassis.name = "chassis";
  const W = style.width;
  const L = style.length;
  const peakY = 0.98 + (style.roofLift ?? 0);
  const cabinZ = -0.05 * L;

  // Continuous low wedge body
  chassis.add(box(2.05 * W, 0.34, 4.2 * L, paint, 0, 0.48, 0.02));
  // Sharp pointed nose (not a flat slab)
  const nose = box(1.15 * W, 0.2, 1.05 * L, paint, 0, 0.42, 2.05 * L);
  nose.rotation.x = 0.38;
  chassis.add(nose);
  const tip = box(0.55 * W, 0.12, 0.55, paint, 0, 0.34, 2.55 * L);
  tip.rotation.x = 0.55;
  chassis.add(tip);
  // Hood slopes into the windshield
  const hood = box(1.85 * W, 0.16, 1.35 * L, paint, 0, 0.62, 1.25 * L);
  hood.rotation.x = 0.16;
  chassis.add(hood);

  // Closed cabin — roof peaks just behind the windshield, then slopes to the rear
  chassis.add(box(1.55 * W, 0.42, 1.55 * L, paint, 0, 0.78, cabinZ));
  const roofFront = box(1.35 * W, 0.12, 0.85 * L, paint, 0, peakY, cabinZ + 0.25 * L);
  roofFront.rotation.x = -0.28;
  chassis.add(roofFront);
  const roofRear = box(1.25 * W, 0.1, 1.1 * L, paint, 0, peakY - 0.08, cabinZ - 0.55 * L);
  roofRear.rotation.x = -0.32;
  chassis.add(roofRear);
  // Dark glass enclosure (closed top)
  const ws = box(1.3 * W, 0.4, 0.07, glass, 0, 0.82, 0.62 * L);
  ws.name = "glass";
  ws.rotation.x = -0.55;
  chassis.add(ws);
  chassis.add(box(1.15 * W, 0.32, 0.06, glass, 0, 0.86, -0.9 * L));
  for (const s of [-1, 1]) {
    chassis.add(box(0.06, 0.32, 1.05 * L, glass, s * 0.78 * W, 0.82, cabinZ));
    // Side blades + hexagon intakes
    chassis.add(box(0.2, 0.28, 3.5 * L, paint, s * 1.08 * W, 0.4, 0));
    const intake = hexPanel(0.16, dark);
    intake.position.set(s * 1.18 * W, 0.55, -0.35);
    intake.rotation.y = s * Math.PI / 2;
    chassis.add(intake);
    chassis.add(box(0.18, 0.28, 0.7, dark, s * 1.14 * W, 0.52, -0.35));
  }

  // Hexagon headlights
  for (const s of [-1, 1]) {
    const lamp = hexPanel(0.14, head);
    lamp.position.set(s * 0.72 * W, 0.48, 2.45 * L);
    chassis.add(lamp);
    chassis.add(box(0.22, 0.18, 0.08, dark, s * 0.72 * W, 0.48, 2.4 * L));
  }
  chassis.add(box(2.0 * W, 0.05, 0.35, dark, 0, 0.22, 2.35 * L));

  // Keep Chupacabra-style Y taillights + black hex grille + twin exhausts
  chassis.add(box(1.85 * W, 0.52, 0.08, dark, 0, 0.55, -2.1 * L));
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 5; col++) {
      const hex = hexPanel(0.09, chrome);
      hex.position.set((-2 + col) * 0.28 * W, 0.38 + row * 0.15, -2.15 * L);
      chassis.add(hex);
    }
  }
  for (const s of [-1, 1]) {
    const stem = hexPanel(0.07, tail);
    stem.position.set(s * 0.16, 0.72, -2.18 * L);
    chassis.add(stem);
    chassis.add(box(0.05, 0.28, 0.04, tail, s * 0.14, 0.7, -2.16 * L));
    const arm = box(0.52, 0.05, 0.04, tail, s * 0.42, 0.8, -2.16 * L);
    arm.rotation.z = s * -0.22;
    chassis.add(arm);
    const armL = box(0.38, 0.04, 0.04, tail, s * 0.34, 0.58, -2.16 * L);
    armL.rotation.z = s * 0.32;
    chassis.add(armL);
  }
  if (style.tailBar) chassis.add(box(1.55 * W, 0.04, 0.04, tail, 0, 0.76, -2.18 * L));
  chassis.add(box(1.95 * W, 0.08, 0.5, dark, 0, 0.22, -2.2 * L));
  for (const x of style.exhausts) {
    chassis.add(cyl(0.05, 0.055, 0.14, chrome, x, 0.28, -2.35 * L, Math.PI / 2, 0, 0));
  }

  // Exposed engine cover (Minotaur) or smooth deck
  if (style.engineCover) {
    chassis.add(box(1.2 * W, 0.1, 0.85 * L, dark, 0, 0.78, -1.15 * L));
    for (let i = -2; i <= 2; i++) chassis.add(box(0.08, 0.06, 0.7 * L, chrome, i * 0.18 * W, 0.84, -1.15 * L));
  }

  if (style.wing === "race") {
    chassis.add(box(2.15 * W, 0.05, 0.38, paint, 0, 1.05, -1.65 * L));
    for (const s of [-1, 1]) chassis.add(box(0.05, 0.35, 0.22, dark, s * 0.9 * W, 0.88, -1.65 * L));
  } else if (style.wing === "lip") {
    const lip = box(1.75 * W, 0.04, 0.22, paint, 0, 0.72, -1.95 * L);
    lip.rotation.x = -0.35;
    chassis.add(lip);
  } else if (style.wing === "small") {
    const lip = box(1.45 * W, 0.035, 0.16, paint, 0, 0.7, -1.9 * L);
    lip.rotation.x = -0.28;
    chassis.add(lip);
  }

  root.add(chassis);
  const track = 0.92 * W;
  addWheels(root, track, track * 1.06, 1.35 * L, -1.45 * L, style.wheelScale ?? 0.95, 1.28);
  return finish(root, style.file);
}

/** 911 Turbo S: one smooth fastback curve, frog-eye lamps, wide rounded hips, ducktail. */
function buildDeathstalker() {
  const root = new THREE.Group();
  root.name = "deathstalker";
  const c = new THREE.Group();
  c.name = "chassis";
  // Soft continuous body — not a boxy sedan stack
  c.add(
    sideBody(
      [
        [1.95, 0.32],
        [1.7, 0.48],
        [1.35, 0.58],
        [0.85, 0.62],
        [0.45, 0.72],
        [0.15, 1.05],
        [-0.25, 1.12],
        [-0.65, 1.05],
        [-1.05, 0.88],
        [-1.45, 0.62],
        [-1.85, 0.48],
        [-2.05, 0.4],
      ],
      1.75,
      paint,
      0.28,
    ),
  );
  // Frog-eye round lamps on front fender tops
  for (const s of [-1, 1]) {
    c.add(box(0.42, 0.32, 1.0, paint, s * 0.88, 0.62, 1.35));
    c.add(cyl(0.13, 0.13, 0.1, head, s * 0.82, 0.72, 1.72, Math.PI / 2, 0, 0));
    c.add(cyl(0.09, 0.09, 0.04, chrome, s * 0.82, 0.72, 1.78, Math.PI / 2, 0, 0));
  }
  // Cabin glass in the fastback line
  const ws = box(1.2, 0.36, 0.06, glass, 0, 0.92, 0.45);
  ws.name = "glass";
  ws.rotation.x = -0.48;
  c.add(ws);
  c.add(box(1.05, 0.22, 0.05, glass, 0, 0.88, -0.95));
  for (const s of [-1, 1]) c.add(box(0.05, 0.26, 0.95, glass, s * 0.78, 0.9, -0.15));
  // Wide rounded rear hips
  for (const s of [-1, 1]) {
    c.add(cyl(0.45, 0.45, 0.9, paint, s * 0.95, 0.55, -1.35, 0, 0, Math.PI / 2));
    c.add(box(0.55, 0.4, 1.1, paint, s * 0.95, 0.55, -1.4));
  }
  const duck = box(1.7, 0.07, 0.28, paint, 0, 0.82, -1.95);
  duck.rotation.x = -0.55;
  c.add(duck);
  for (const s of [-1, 1]) c.add(box(0.38, 0.12, 0.08, tail, s * 0.55, 0.52, -2.0));
  c.add(box(0.5, 0.08, 0.14, chrome, 0, 0.34, 1.85));
  root.add(c);
  addWheels(root, 0.88, 0.98, 1.25, -1.35, 0.98, 1.22);
  return finish(root, "porch-deathstalker.glb");
}

/** Open-top spyder (918): windshield, tub seats, buttresses, filled body */
function buildHellbender() {
  const root = new THREE.Group();
  root.name = "hellbender";
  const c = new THREE.Group();
  c.name = "chassis";
  c.add(box(1.9, 0.3, 4.15, paint, 0, 0.4, 0));
  c.add(box(1.7, 0.2, 3.5, paint, 0, 0.55, 0.05));
  const nose = box(1.35, 0.16, 0.8, paint, 0, 0.42, 2.1);
  nose.rotation.x = 0.18;
  c.add(nose);
  for (const s of [-1, 1]) {
    c.add(box(0.28, 0.22, 0.9, paint, s * 0.95, 0.62, 1.35));
    c.add(box(0.3, 0.24, 0.95, paint, s * 1.0, 0.64, -1.35));
    c.add(box(0.32, 0.22, 2.0, paint, s * 0.98, 0.42, 0));
    c.add(box(0.5, 0.08, 0.12, head, s * 0.55, 0.48, 2.35));
    c.add(box(0.12, 0.08, 0.18, dark, s * 1.08, 0.72, 0.5));
    const butt = box(0.12, 0.1, 1.2, paint, s * 0.65, 0.88, -0.65);
    butt.rotation.x = 0.22;
    c.add(butt);
  }
  // Open cockpit with real windshield (not a bare tub)
  c.add(box(1.25, 0.12, 1.1, dark, 0, 0.58, 0.1));
  const ws = box(1.2, 0.42, 0.07, glass, 0, 0.88, 0.7);
  ws.name = "glass";
  ws.rotation.x = -0.18;
  c.add(ws);
  c.add(box(1.15, 0.08, 0.08, dark, 0, 1.08, 0.55)); // header
  for (const s of [-1, 1]) c.add(box(0.08, 0.4, 0.08, dark, s * 0.6, 0.88, 0.65));
  c.add(box(0.48, 0.3, 0.42, dark, -0.28, 0.72, 0));
  c.add(box(0.48, 0.3, 0.42, dark, 0.28, 0.72, 0));
  c.add(box(1.45, 0.32, 1.0, paint, 0, 0.6, -0.95));
  for (const s of [-1, 1]) {
    c.add(cyl(0.055, 0.06, 0.45, chrome, s * 0.2, 0.95, -0.55, 0, 0, 0));
    c.add(cyl(0.07, 0.07, 0.05, chrome, s * 0.2, 1.18, -0.55, 0, 0, 0));
  }
  c.add(box(1.8, 0.1, 0.4, dark, 0, 0.28, -2.15));
  for (const s of [-1, 1]) c.add(box(0.35, 0.1, 0.06, tail, s * 0.55, 0.5, -2.2));
  root.add(c);
  addWheels(root, 0.88, 0.95, 1.35, -1.4, 0.9, 1.15);
  return finish(root, "porch-hellbender.glb");
}

/** P1: swoopy extruded body, small dark teardrop cabin, big wing */
function buildPterodactyl() {
  const root = new THREE.Group();
  root.name = "pterodactyl";
  const c = new THREE.Group();
  c.name = "chassis";
  c.add(
    sideBody(
      [
        [2.55, 0.28],
        [2.1, 0.38],
        [1.4, 0.48],
        [0.6, 0.55],
        [0.15, 0.72],
        [-0.35, 0.78],
        [-0.9, 0.7],
        [-1.5, 0.55],
        [-2.05, 0.42],
        [-2.25, 0.35],
      ],
      1.7,
      paint,
      0.24,
    ),
  );
  for (const s of [-1, 1]) {
    c.add(box(0.4, 0.38, 0.85, dark, s * 0.95, 0.5, -0.05));
    c.add(box(0.4, 0.05, 0.1, head, s * 0.4, 0.38, 2.55));
    c.add(box(0.05, 0.38, 0.18, dark, s * 0.72, 0.95, -1.55));
  }
  c.add(sideBody([[0.55, 0.72], [0.2, 0.95], [-0.35, 0.98], [-0.7, 0.85], [-0.9, 0.7]], 0.85, dark, 0.68));
  const ws = box(0.75, 0.28, 0.06, glass, 0, 0.85, 0.45);
  ws.name = "glass";
  ws.rotation.x = -0.45;
  c.add(ws);
  c.add(box(2.05, 0.05, 0.42, paint, 0, 1.2, -1.55));
  c.add(box(1.5, 0.08, 0.35, dark, 0, 0.26, -2.15));
  for (const s of [-1, 1]) c.add(box(0.28, 0.08, 0.05, tail, s * 0.4, 0.48, -2.2));
  root.add(c);
  addWheels(root, 0.85, 0.95, 1.25, -1.4, 0.9, 1.18);
  return finish(root, "mcroar-pterodactyl.glb");
}

/** Speedtail: ~20% shorter, ~15% wider, bubble cabin, bigger wheels filling arches. */
function buildGreatWhite() {
  const root = new THREE.Group();
  root.name = "great-white";
  const c = new THREE.Group();
  c.name = "chassis";
  // Was ~7.9 long / 1.45 wide — now ~6.3 long / 1.67 wide
  c.add(
    sideBody(
      [
        [2.35, 0.3],
        [2.1, 0.45],
        [1.75, 0.55],
        [1.35, 0.58],
        [0.9, 0.6],
        [0.45, 0.65],
        [0.1, 0.9],
        [-0.3, 1.0],
        [-0.65, 0.9],
        [-1.0, 0.62],
        [-1.55, 0.5],
        [-2.1, 0.4],
        [-2.55, 0.32],
        [-2.85, 0.26],
      ],
      1.67,
      paint,
      0.22,
    ),
  );
  c.add(sideBody([[0.4, 0.72], [0.08, 1.08], [-0.35, 1.12], [-0.65, 0.95], [-0.85, 0.72]], 1.05, glass, 0.7));
  const ws = box(0.95, 0.32, 0.06, glass, 0, 0.92, 0.42);
  ws.name = "glass";
  ws.rotation.x = -0.35;
  c.add(ws);
  for (const s of [-1, 1]) {
    c.add(box(0.36, 0.05, 0.1, head, s * 0.42, 0.42, 2.2));
    c.add(box(0.2, 0.05, 0.05, tail, s * 0.28, 0.34, -2.8));
    // Wheel-arch bulges so bigger tires fill them
    c.add(box(0.28, 0.28, 0.7, paint, s * 0.92, 0.48, 1.15));
    c.add(box(0.28, 0.28, 0.7, paint, s * 0.92, 0.48, -1.25));
  }
  root.add(c);
  addWheels(root, 0.88, 0.92, 1.15, -1.35, 1.05, 1.15);
  return finish(root, "mcroar-great-white.glb");
}

/** Jesko Absolut: very low/wide, huge wing on tall posts, big splitter, teardrop cabin */
function buildKraken() {
  // Jesko Absolut: very low/wide, huge rear wing on tall posts, big splitter,
  // teardrop cabin, white/silver paint. Boxes only (reliable GLB load).
  const silver = new THREE.MeshStandardMaterial({
    name: "paint",
    color: 0xe8ecf0,
    metalness: 0.72,
    roughness: 0.2,
  });
  const root = new THREE.Group();
  root.name = "kraken";
  const c = new THREE.Group();
  c.name = "chassis";
  // Low wide main body + stepped teardrop roof line
  c.add(box(2.3, 0.28, 4.5, silver, 0, 0.38, 0.05));
  c.add(box(2.15, 0.16, 1.7, silver, 0, 0.52, 1.55)); // hood
  const nose = box(1.7, 0.14, 0.7, silver, 0, 0.36, 2.35);
  nose.rotation.x = 0.22;
  c.add(nose);
  // Big front splitter
  c.add(box(2.25, 0.05, 0.6, silver, 0, 0.2, 2.45));
  c.add(box(2.1, 0.04, 0.22, dark, 0, 0.18, 2.7));
  // Teardrop cabin (low bubble)
  c.add(box(1.25, 0.34, 1.55, silver, 0, 0.72, -0.15));
  const canopy = box(1.05, 0.22, 1.2, glass, 0, 0.95, -0.25);
  canopy.name = "glass";
  canopy.rotation.x = -0.18;
  c.add(canopy);
  const ws = box(1.15, 0.36, 0.07, glass, 0, 0.78, 0.55);
  ws.name = "glass";
  ws.rotation.x = -0.48;
  c.add(ws);
  for (const s of [-1, 1]) {
    c.add(box(0.05, 0.28, 0.95, glass, s * 0.62, 0.82, -0.15));
    c.add(box(0.48, 0.34, 1.35, silver, s * 1.2, 0.45, -0.55)); // wide hips
    c.add(box(0.24, 0.18, 0.75, silver, s * 1.15, 0.52, 1.3));
    c.add(box(0.28, 0.22, 0.9, silver, s * 1.22, 0.52, -1.4));
    c.add(box(0.42, 0.05, 0.1, head, s * 0.7, 0.34, 2.55));
    c.add(box(0.08, 0.22, 0.04, tail, s * 0.55, 0.5, -2.2));
    // Tall wing posts
    c.add(box(0.07, 0.62, 0.2, dark, s * 0.9, 1.0, -1.65));
  }
  // Huge rear wing
  c.add(box(2.4, 0.07, 0.5, silver, 0, 1.35, -1.65));
  c.add(box(2.2, 0.04, 0.14, dark, 0, 1.4, -1.82));
  c.add(box(1.95, 0.1, 0.45, dark, 0, 0.22, -2.25));
  c.add(box(1.6, 0.28, 0.08, dark, 0, 0.48, -2.25));
  root.add(c);
  addWheels(root, 1.08, 1.18, 1.3, -1.45, 0.92, 1.3);
  return finish(root, "king-egg-kraken.glb");
}

/** Agera: short dipped nose, wraparound bubble, round tails, wide muscular */
function buildLeviathan() {
  const root = new THREE.Group();
  root.name = "leviathan";
  const c = new THREE.Group();
  c.name = "chassis";
  c.add(
    sideBody(
      [
        [2.15, 0.26],
        [1.7, 0.42],
        [1.1, 0.52],
        [0.4, 0.58],
        [-0.1, 0.78],
        [-0.55, 0.85],
        [-1.0, 0.7],
        [-1.5, 0.55],
        [-1.95, 0.42],
      ],
      2.05,
      paint,
      0.24,
    ),
  );
  for (const s of [-1, 1]) {
    c.add(box(0.4, 0.38, 1.2, paint, s * 1.1, 0.5, -0.6));
    c.add(box(0.38, 0.06, 0.1, head, s * 0.6, 0.38, 2.1));
    c.add(cyl(0.1, 0.1, 0.06, tail, s * 0.55, 0.5, -1.95, Math.PI / 2, 0, 0));
    c.add(box(0.05, 0.36, 0.18, dark, s * 0.8, 0.98, -1.35));
  }
  c.add(sideBody([[0.45, 0.7], [0.1, 1.05], [-0.45, 1.08], [-0.8, 0.9], [-1.0, 0.7]], 1.15, glass, 0.68));
  const ws = box(1.2, 0.34, 0.07, glass, 0, 0.88, 0.45);
  ws.name = "glass";
  ws.rotation.x = -0.3;
  c.add(ws);
  for (const s of [-1, 1]) c.add(box(0.07, 0.28, 0.75, glass, s * 0.65, 0.88, -0.1));
  c.add(box(2.1, 0.05, 0.38, paint, 0, 1.2, -1.35));
  c.add(box(1.8, 0.08, 0.35, dark, 0, 0.24, -1.95));
  root.add(c);
  addWheels(root, 0.95, 1.05, 1.15, -1.25, 0.95, 1.22);
  return finish(root, "king-egg-leviathan.glb");
}

/** Veyron pebble: extruded egg body, arched fenders, two-tone, horseshoe, scoops */
function buildHellhound() {
  const root = new THREE.Group();
  root.name = "hellhound";
  const c = new THREE.Group();
  c.name = "chassis";
  c.add(box(1.95, 0.22, 3.9, paintDark, 0, 0.24, 0));
  c.add(
    sideBody(
      [
        [2.1, 0.35],
        [1.6, 0.55],
        [1.0, 0.7],
        [0.4, 0.82],
        [-0.1, 0.95],
        [-0.55, 1.0],
        [-1.0, 0.9],
        [-1.5, 0.7],
        [-2.0, 0.5],
        [-2.15, 0.4],
      ],
      1.75,
      paint,
      0.35,
    ),
  );
  for (const s of [-1, 1]) {
    c.add(box(0.22, 0.18, 0.8, paint, s * 0.95, 0.7, 1.25));
    c.add(box(0.24, 0.18, 0.85, paint, s * 1.0, 0.72, -1.25));
    c.add(box(0.18, 0.2, 1.5, paintDark, s * 0.98, 0.36, 0));
    c.add(box(0.36, 0.1, 0.1, head, s * 0.65, 0.48, 2.1));
    c.add(box(0.22, 0.14, 0.32, dark, s * 0.28, 1.15, -0.05));
    c.add(box(0.34, 0.1, 0.06, tail, s * 0.48, 0.52, -2.1));
  }
  const ws = box(1.05, 0.32, 0.06, glass, 0, 0.95, 0.45);
  ws.name = "glass";
  ws.rotation.x = -0.4;
  c.add(ws);
  c.add(box(0.9, 0.22, 0.05, glass, 0, 0.95, -0.55));
  c.add(box(0.78, 0.34, 0.1, chrome, 0, 0.42, 2.1));
  c.add(box(0.55, 0.22, 0.08, dark, 0, 0.42, 2.18));
  root.add(c);
  addWheels(root, 0.88, 0.95, 1.25, -1.25, 0.95, 1.12);
  return finish(root, "baguetti-hellhound.glb");
}

/** Chiron: muscular extruded body, rounded roof, bold C-band, two-tone, horseshoe */
function buildCerberus() {
  const root = new THREE.Group();
  root.name = "cerberus";
  const c = new THREE.Group();
  c.name = "chassis";
  c.add(box(2.0, 0.22, 4.0, paintDark, 0, 0.24, 0));
  c.add(
    sideBody(
      [
        [2.2, 0.38],
        [1.7, 0.55],
        [1.1, 0.65],
        [0.5, 0.78],
        [0.05, 1.05],
        [-0.45, 1.15],
        [-0.9, 1.05],
        [-1.4, 0.75],
        [-1.9, 0.55],
        [-2.2, 0.42],
      ],
      1.85,
      paint,
      0.34,
    ),
  );
  const ws = box(1.15, 0.36, 0.06, glass, 0, 1.0, 0.4);
  ws.name = "glass";
  ws.rotation.x = -0.4;
  c.add(ws);
  c.add(box(1.0, 0.26, 0.05, glass, 0, 1.0, -0.75));
  c.add(box(0.82, 0.4, 0.1, chrome, 0, 0.46, 2.15));
  c.add(box(0.58, 0.26, 0.08, dark, 0, 0.46, 2.22));
  for (const s of [-1, 1]) {
    c.add(box(0.3, 0.5, 1.5, paintDark, s * 1.02, 0.6, 0));
    c.add(box(0.38, 0.12, 0.55, paintDark, s * 0.92, 0.95, 0.7));
    c.add(box(0.38, 0.12, 0.5, paintDark, s * 0.92, 0.95, -0.9));
    c.add(box(0.28, 0.24, 0.85, paint, s * 0.98, 0.68, 1.35));
    c.add(box(0.32, 0.3, 0.95, paint, s * 1.05, 0.7, -1.4));
    c.add(box(0.4, 0.1, 0.1, head, s * 0.68, 0.48, 2.2));
  }
  c.add(box(1.75, 0.06, 0.05, tail, 0, 0.62, -2.15));
  c.add(box(1.65, 0.08, 0.38, dark, 0, 0.26, -2.2));
  root.add(c);
  addWheels(root, 0.9, 1.0, 1.3, -1.4, 0.95, 1.18);
  return finish(root, "baguetti-cerberus.glb");
}

/** F40 boxy wedge — wheels tucked inside fenders */
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
  for (const z of [1.1, 1.35, 1.6]) {
    for (const s of [-1, 1]) c.add(box(0.25, 0.04, 0.12, dark, s * 0.35, 0.66, z));
  }
  c.add(box(2.05, 0.05, 0.45, paint, 0, 1.15, -1.55));
  for (const s of [-1, 1]) {
    c.add(box(0.05, 0.4, 0.25, dark, s * 0.85, 0.95, -1.55));
    c.add(box(0.18, 0.14, 0.65, paint, s * 0.95, 0.68, 1.3));
    c.add(box(0.2, 0.16, 0.7, paint, s * 0.98, 0.7, -1.3));
    c.add(box(0.4, 0.08, 0.1, head, s * 0.55, 0.48, 2.05));
    c.add(box(0.35, 0.12, 0.06, tail, s * 0.5, 0.55, -2.0));
  }
  c.add(box(1.6, 0.08, 0.4, dark, 0, 0.28, -2.05));
  root.add(c);
  addWheels(root, 0.82, 0.88, 1.35, -1.4, 0.95, 1.15);
  return finish(root, "ferocity-jackal.glb");
}

/** LaFerrari: extruded teardrop body, rising fenders, pointed nose */
function buildManticore() {
  const root = new THREE.Group();
  root.name = "manticore";
  const c = new THREE.Group();
  c.name = "chassis";
  c.add(
    sideBody(
      [
        [2.55, 0.24],
        [2.1, 0.36],
        [1.5, 0.45],
        [0.8, 0.52],
        [0.35, 0.68],
        [0.05, 0.88],
        [-0.25, 0.95],
        [-0.55, 0.88],
        [-0.85, 0.72],
        [-1.2, 0.55],
        [-1.75, 0.42],
        [-2.15, 0.35],
      ],
      1.65,
      paint,
      0.22,
    ),
  );
  for (const s of [-1, 1]) {
    c.add(box(0.28, 0.3, 0.85, paint, s * 0.9, 0.52, 1.25));
    c.add(box(0.3, 0.34, 0.95, paint, s * 0.95, 0.55, -1.2));
    c.add(box(0.34, 0.05, 0.1, head, s * 0.42, 0.36, 2.55));
    c.add(box(0.05, 0.16, 0.04, tail, s * 0.38, 0.46, -2.1));
    c.add(box(0.24, 0.16, 0.6, dark, s * 0.88, 0.42, -0.15));
  }
  const ws = box(0.85, 0.28, 0.06, glass, 0, 0.72, 0.4);
  ws.name = "glass";
  ws.rotation.x = -0.5;
  c.add(ws);
  c.add(box(0.7, 0.18, 0.05, glass, 0, 0.72, -0.55));
  for (const s of [-1, 1]) c.add(box(0.05, 0.16, 0.6, glass, s * 0.5, 0.7, -0.05));
  c.add(box(1.35, 0.04, 0.18, paint, 0, 0.68, -1.7));
  root.add(c);
  addWheels(root, 0.85, 0.92, 1.25, -1.3, 0.88, 1.12);
  return finish(root, "ferocity-manticore.glb");
}

/** Corvette: Thresher = mid-engine C8 (short nose, cabin forward, long rear); Megalodon = sharper ZR1. */
function buildCorvette(id, file, sharp = 1) {
  const root = new THREE.Group();
  root.name = id;
  const c = new THREE.Group();
  c.name = "chassis";
  const mid = sharp <= 1; // Thresher: mid-engine proportions
  c.add(box(1.9, 0.28, mid ? 4.2 : 4.35, paint, 0, 0.4, mid ? -0.15 : 0));
  if (mid) {
    // Short low nose, cabin pushed forward, long rear deck
    const nose = box(1.55, 0.16, 0.95, paint, 0, 0.46, 1.85);
    nose.rotation.x = 0.18;
    c.add(nose);
    c.add(box(1.7, 0.14, 0.85, paint, 0, 0.52, 1.35));
    c.add(box(1.5, 0.45, 1.25, paint, 0, 0.78, 0.35)); // cabin forward
    const roof = box(1.3, 0.1, 1.05, paint, 0, 1.02, 0.2);
    roof.rotation.x = -0.1;
    c.add(roof);
    const ws = box(1.3, 0.4, 0.07, glass, 0, 0.82, 0.95);
    ws.name = "glass";
    ws.rotation.x = -0.48;
    c.add(ws);
    c.add(box(1.15, 0.28, 0.05, glass, 0, 0.82, -0.25));
    // Long rear engine deck
    c.add(box(1.7, 0.22, 1.55, paint, 0, 0.58, -1.25));
    c.add(box(1.4, 0.08, 1.2, dark, 0, 0.72, -1.2));
    for (let i = -2; i <= 2; i++) c.add(box(0.08, 0.05, 1.0, chrome, i * 0.2, 0.76, -1.2));
    for (const s of [-1, 1]) {
      c.add(box(0.48, 0.05, 0.1, head, s * 0.6, 0.44, 2.2));
      c.add(box(0.2, 0.16, 0.55, paint, s * 0.95, 0.55, 1.45));
      // Big side intakes ahead of rear wheels
      c.add(box(0.32, 0.38, 0.85, dark, s * 1.05, 0.55, -0.55));
      c.add(box(0.1, 0.3, 0.7, chrome, s * 1.12, 0.55, -0.55));
      c.add(box(0.32, 0.36, 1.2, paint, s * 1.0, 0.55, -1.35));
      c.add(box(0.06, 0.3, 0.75, glass, s * 0.75, 0.82, 0.35));
      c.add(box(0.3, 0.1, 0.06, tail, s * 0.55, 0.52, -2.2));
    }
    const lip = box(1.65, 0.04, 0.18, paint, 0, 0.7, -2.0);
    lip.rotation.x = -0.35;
    c.add(lip);
    root.add(c);
    addWheels(root, 0.9, 0.98, 1.25, -1.55, 0.98, 1.25);
  } else {
    const hood = box(1.65, 0.14, 1.9, paint, 0, 0.5, 1.45);
    hood.rotation.x = 0.1;
    c.add(hood);
    c.add(box(0.7, 0.08, 0.9, dark, 0, 0.58, 1.5));
    c.add(box(1.4, 0.42, 1.15, paint, 0, 0.74, -0.25));
    const roof = box(1.25, 0.1, 1.0, paint, 0, 0.98, -0.35);
    roof.rotation.x = -0.12;
    c.add(roof);
    const ws = box(1.25, 0.38, 0.06, glass, 0, 0.78, 0.4);
    ws.name = "glass";
    ws.rotation.x = -0.5;
    c.add(ws);
    c.add(box(1.1, 0.28, 0.05, glass, 0, 0.78, -0.75));
    for (const s of [-1, 1]) {
      c.add(box(0.5, 0.05, 0.1, head, s * 0.65, 0.44, 2.15));
      c.add(box(0.22, 0.18, 0.7, paint, s * 0.95, 0.62, 1.3));
      c.add(box(0.28, 0.32, 1.1, paint, s * 0.98, 0.52, -0.9));
      c.add(box(0.06, 0.28, 0.7, glass, s * 0.72, 0.78, -0.2));
      c.add(box(0.28, 0.1, 0.06, tail, s * 0.55, 0.55, -2.15));
    }
    c.add(box(1.85, 0.05, 0.35, paint, 0, 1.05, -1.7));
    for (const s of [-1, 1]) c.add(box(0.05, 0.32, 0.2, dark, s * 0.75, 0.9, -1.7));
    root.add(c);
    addWheels(root, 0.88, 0.95, 1.4, -1.45, 0.95, 1.2);
  }
  for (const x of [-0.35, -0.18, 0.18, 0.35]) {
    c.add(cyl(0.04, 0.045, 0.12, chrome, x, 0.28, -2.25, Math.PI / 2, 0, 0));
  }
  return finish(root, file);
}

const cars = [
  buildLambchop({
    id: "chupacabra",
    file: "lambchop-chupacabra.glb",
    width: 1.08,
    length: 1.02,
    roofLift: 0.02,
    wing: "lip",
    exhausts: [-0.16, 0.16],
    wheelScale: 0.94,
  }),
  buildLambchop({
    id: "minotaur",
    file: "lambchop-minotaur.glb",
    width: 1.16,
    length: 1.1,
    roofLift: -0.02,
    wing: "race",
    exhausts: [-0.22, 0, 0.22],
    tailBar: true,
    engineCover: true,
    wheelScale: 0.96,
  }),
  buildLambchop({
    id: "bonehorn",
    file: "lambchop-bonehorn.glb",
    width: 1.04,
    length: 0.92,
    roofLift: 0.04,
    wing: "small",
    exhausts: [-0.14, 0.14],
    wheelScale: 0.9,
  }),
  buildDeathstalker(),
  buildHellbender(),
  buildPterodactyl(),
  buildGreatWhite(),
  buildKraken(),
  buildLeviathan(),
  buildHellhound(),
  buildCerberus(),
  buildJackal(),
  buildManticore(),
  buildCorvette("thresher", "shovel-thresher.glb", 1),
  buildCorvette("megalodon", "shovel-megalodon.glb", 1.3),
  // Mastodon: scripts/build-mastodon.mjs (Silverado ZR2)
  // Beep Sabertooth: scripts/build-beep-sabertooth.mjs (Jeep Gladiator)
];

mkdirSync(new URL("../public/models/", import.meta.url), { recursive: true });
for (const { root, file } of cars) {
  const exporter = new GLTFExporter();
  const glb = await exporter.parseAsync(root, { binary: true });
  const path = new URL(`../public/models/${file}`, import.meta.url);
  writeFileSync(path, Buffer.from(glb));
  console.log(file, Buffer.from(glb).length);
}
