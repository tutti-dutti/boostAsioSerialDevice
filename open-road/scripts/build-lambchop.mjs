/**
 * Builds three Lambchop supercars: low, wide, wedge-shaped originals.
 * Covered wheels, sharp panels — not open-wheel race cars.
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

const paint = new THREE.MeshStandardMaterial({ name: "paint", color: 0xffffff, metalness: 0.7, roughness: 0.2 });
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

function wheel(front, left, x, z, scale) {
  const pivot = new THREE.Group();
  pivot.name = `wheel-${front ? "front" : "back"}-${left ? "left" : "right"}`;
  const spin = new THREE.Group();
  const r = 0.36 * scale;
  const w = (front ? 0.28 : 0.36) * scale;
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 22), rubber);
  tire.rotation.z = Math.PI / 2;
  const rimR = r * 0.58;
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(rimR, rimR, 0.04, 16), dark);
  dish.rotation.z = Math.PI / 2;
  const faceX = left ? -w * 0.52 : w * 0.52;
  dish.position.x = faceX;
  spin.add(tire, dish);
  for (let i = 0; i < 5; i++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.04, rimR * 0.75, 0.07), chrome);
    spoke.geometry.translate(0, rimR * 0.38, 0);
    spoke.rotation.x = (i / 5) * Math.PI * 2;
    spoke.position.x = faceX + (left ? -0.02 : 0.02);
    spin.add(spoke);
  }
  pivot.add(spin);
  pivot.position.set(left ? -x : x, r, z);
  return pivot;
}

function hexPanel(size, material) {
  const shape = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(a) * size;
    const y = Math.sin(a) * size;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const geo = new THREE.ShapeGeometry(shape);
  const mesh = new THREE.Mesh(geo, material);
  return mesh;
}

function buildVariant(style) {
  const root = new THREE.Group();
  root.name = style.id;
  const chassis = new THREE.Group();
  chassis.name = "chassis";

  // Low & wide: roof barely above tire tops (~0.72), track ~1.45
  const trackF = 1.35 * style.width;
  const trackR = 1.5 * style.width;
  const frontZ = 2.05 * style.length;
  const rearZ = -2.0 * style.length;
  const roofY = 0.78 + style.roofLift;

  // Wedge body: sharp nose, low cabin, wide haunches
  const body = box(2.15 * style.width, 0.38, 4.3 * style.length, paint, 0, 0.52, 0.05);
  body.name = "body";
  chassis.add(body);
  // Long hood wedge
  const hood = box(2.0 * style.width, 0.22, 1.7 * style.length, paint, 0, 0.62, 1.55 * style.length);
  hood.rotation.x = 0.12;
  chassis.add(hood);
  // Sharp nose tip
  const nose = box(1.55 * style.width, 0.18, 0.7, paint, 0, 0.42, frontZ + 0.15);
  nose.rotation.x = 0.35;
  chassis.add(nose);
  // Side blades / sharp angled skirts
  for (const side of [-1, 1]) {
    const blade = box(0.22, 0.28, 3.6 * style.length, paint, side * 1.15 * style.width, 0.4, 0);
    blade.rotation.z = side * -0.18;
    chassis.add(blade);
    // Side intake scoop
    chassis.add(box(0.2, 0.35, 0.9, dark, side * 1.2 * style.width, 0.55, -0.35));
  }
  // Cabin tub — very low
  chassis.add(box(1.55 * style.width, 0.28, 1.5, paint, 0, roofY - 0.05, -0.15));
  // Fastback roof
  const roof = box(1.35 * style.width, 0.12, 1.35, paint, 0, roofY + 0.12, -0.25);
  roof.rotation.x = -0.18;
  chassis.add(roof);

  // Windshield + side glass + rear glass
  const windshield = box(1.4 * style.width, 0.42, 0.08, glass, 0, roofY + 0.05, 0.65);
  windshield.name = "glass";
  windshield.rotation.x = -0.55;
  chassis.add(windshield);
  chassis.add(box(1.2 * style.width, 0.3, 0.06, glass, 0, roofY + 0.08, -0.85));
  for (const side of [-1, 1]) {
    const sideGlass = box(0.05, 0.28, 0.9, glass, side * 0.82 * style.width, roofY, -0.05);
    sideGlass.rotation.z = side * 0.2;
    chassis.add(sideGlass);
  }

  // Front splitter
  chassis.add(box(2.2 * style.width, 0.05, 0.45, dark, 0, 0.22, frontZ + 0.2));
  // Headlights — sharp blades
  for (const side of [-1, 1]) {
    const lamp = box(0.45, 0.08, 0.12, head, side * 0.7 * style.width, 0.48, frontZ + 0.35);
    lamp.rotation.z = side * -0.35;
    chassis.add(lamp);
  }

  // Huge black rear grille with hexagon vents
  chassis.add(box(1.9 * style.width, 0.55, 0.08, dark, 0, 0.55, rearZ - 0.05));
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 5; col++) {
      const hex = hexPanel(0.09, chrome);
      hex.position.set((-2 + col) * 0.28 * style.width, 0.38 + row * 0.16, rearZ - 0.1);
      chassis.add(hex);
    }
  }

  // Thin Y-shaped taillights
  for (const side of [-1, 1]) {
    const stem = box(0.06, 0.28, 0.05, tail, side * 0.15, 0.72, rearZ - 0.12);
    chassis.add(stem);
    const arm = box(0.55, 0.06, 0.05, tail, side * 0.45, 0.82, rearZ - 0.12);
    arm.rotation.z = side * -0.25;
    chassis.add(arm);
    const armLow = box(0.4, 0.05, 0.05, tail, side * 0.35, 0.62, rearZ - 0.12);
    armLow.rotation.z = side * 0.35;
    chassis.add(armLow);
  }
  if (style.tailBar) {
    chassis.add(box(1.6 * style.width, 0.04, 0.04, tail, 0, 0.78, rearZ - 0.14));
  }

  // Wide rear diffuser
  chassis.add(box(2.0 * style.width, 0.08, 0.55, dark, 0, 0.22, rearZ - 0.15));
  for (let i = -2; i <= 2; i++) {
    chassis.add(box(0.08, 0.22, 0.45, dark, i * 0.35 * style.width, 0.32, rearZ - 0.1));
  }

  // Center exhausts
  for (const x of style.exhausts) {
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.16, 12), chrome);
    tip.rotation.x = Math.PI / 2;
    tip.position.set(x, 0.28, rearZ - 0.35);
    chassis.add(tip);
  }

  // Wing
  if (style.wing === "race") {
    chassis.add(box(2.1 * style.width, 0.04, 0.35, paint, 0, 0.95, rearZ + 0.35));
    for (const side of [-1, 1]) {
      chassis.add(box(0.04, 0.28, 0.2, dark, side * 0.9 * style.width, 0.82, rearZ + 0.35));
    }
  } else if (style.wing === "lip") {
    const lip = box(1.9 * style.width, 0.04, 0.22, paint, 0, 0.72, rearZ + 0.2);
    lip.rotation.x = -0.4;
    chassis.add(lip);
  }

  // Mirrors
  for (const side of [-1, 1]) {
    chassis.add(box(0.08, 0.05, 0.16, dark, side * 1.05 * style.width, 0.7, 0.55));
    chassis.add(box(0.2, 0.12, 0.22, dark, side * 1.22 * style.width, 0.72, 0.55));
  }

  root.add(chassis);
  // Huge rear tires, slightly smaller fronts
  for (const left of [true, false]) {
    root.add(wheel(true, left, trackF, frontZ * 0.72, 0.95));
    root.add(wheel(false, left, trackR, rearZ * 0.72, 1.2));
  }
  return root;
}

const variants = [
  {
    id: "chupacabra",
    file: "lambchop-chupacabra.glb",
    width: 1.08,
    length: 1.02,
    roofLift: 0,
    wing: "lip",
    exhausts: [-0.18, 0.18],
    tailBar: false,
  },
  {
    id: "minotaur",
    file: "lambchop-minotaur.glb",
    width: 1.12,
    length: 1.05,
    roofLift: -0.02,
    wing: "race",
    exhausts: [-0.22, 0, 0.22],
    tailBar: true,
  },
  {
    id: "bonehorn",
    file: "lambchop-bonehorn.glb",
    width: 1.05,
    length: 0.98,
    roofLift: 0.02,
    wing: "lip",
    exhausts: [-0.14, 0.14],
    tailBar: false,
  },
];

mkdirSync(new URL("../public/models/", import.meta.url), { recursive: true });
for (const style of variants) {
  const model = buildVariant(style);
  const exporter = new GLTFExporter();
  const glb = await exporter.parseAsync(model, { binary: true });
  const file = new URL(`../public/models/${style.file}`, import.meta.url);
  writeFileSync(file, Buffer.from(glb));
  let tris = 0;
  model.traverse((o) => {
    if (o.isMesh && o.geometry?.index) tris += o.geometry.index.count / 3;
  });
  console.log(style.file, Buffer.from(glb).length, "tris", Math.round(tris));
}
