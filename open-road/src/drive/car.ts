import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export type WheelRig = {
  pivot: THREE.Group;
  spin: THREE.Group;
  front: boolean;
};

export type CarLook = {
  scale: number;
  ride: number;
  wheel: number;
  color: number;
  spoiler: boolean;
  roofLights: boolean;
  /** Smooth body with its own glass, lights, and paint. */
  realistic?: boolean;
};

export type CarVisual = {
  root: THREE.Group;
  chassis: THREE.Group;
  wheels: WheelRig[];
  tail: THREE.MeshStandardMaterial;
  head: THREE.MeshStandardMaterial;
  tailLights: THREE.MeshStandardMaterial[];
  wheelRadius: number;
  ride: number;
};

let carEnvironment: THREE.Texture | null = null;

/** One studio reflection, used only on car paint and chrome. */
export function setCarEnvironment(texture: THREE.Texture) {
  carEnvironment = texture;
}

function isWheel(name: string) {
  return name.startsWith("wheel-") && (name.includes("left") || name.includes("right"));
}

/** Top-level parts, or one nesting level if the exporter wrapped the car. */
function carParts(scene: THREE.Object3D): THREE.Object3D[] {
  const top = [...scene.children];
  if (top.some((child) => isWheel(child.name))) return top;
  const nested: THREE.Object3D[] = [];
  for (const child of top) {
    if (child.children.length > 0) nested.push(...child.children);
    else nested.push(child);
  }
  return nested.some((child) => isWheel(child.name)) ? nested : top;
}

/** Load a car GLB and dress it up as one garage vehicle. */
export async function loadCarModel(url: string, look: CarLook): Promise<CarVisual> {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(url);
  const model = gltf.scene;

  const root = new THREE.Group();
  root.name = "car";
  const chassis = new THREE.Group();
  root.add(chassis);

  model.updateMatrixWorld(true);
  const wheels: WheelRig[] = [];
  for (const child of carParts(model)) {
    if (isWheel(child.name)) {
      const front = child.name.includes("front");
      const world = new THREE.Vector3();
      child.getWorldPosition(world);
      const pivot = new THREE.Group();
      pivot.position.copy(world);
      const spin = new THREE.Group();
      child.position.set(0, 0, 0);
      child.rotation.set(0, 0, 0);
      child.scale.set(1, 1, 1);
      if (child.parent) child.parent.remove(child);
      spin.add(child);
      pivot.add(spin);
      root.add(pivot);
      pivot.scale.setScalar(look.wheel);
      wheels.push({ pivot, spin, front });
    } else {
      if (child.parent) child.parent.remove(child);
      chassis.add(child);
    }
  }
  if (wheels.length === 0) {
    throw new Error(`No wheels found in ${url}`);
  }

  let tailLights: THREE.MeshStandardMaterial[] = [];
  if (look.realistic) {
    tailLights = finishRealistic(root, look);
  } else {
    tintChassis(chassis, look.color);
    dressBody(chassis, look);
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of list) {
        if (mat instanceof THREE.MeshStandardMaterial && mat.name === "light-tail") tailLights.push(mat);
      }
    });
  }
  root.scale.setScalar(look.scale);
  root.updateMatrixWorld(true);
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
  });

  // Lift so the lowest wheel tread sits on y=0 (Kenney models vary).
  const grounded = new THREE.Box3();
  for (const wheel of wheels) grounded.expandByObject(wheel.pivot);
  if (grounded.isEmpty()) grounded.setFromObject(root);
  const autoRide = Number.isFinite(grounded.min.y) ? -grounded.min.y + look.ride : look.ride;

  const tail = new THREE.MeshStandardMaterial({
    color: 0xff1a1a,
    emissive: 0xff1a1a,
    emissiveIntensity: 0.45,
  });
  const head = new THREE.MeshStandardMaterial({
    color: 0xfff6e4,
    emissive: 0xfff1cc,
    emissiveIntensity: 1.4,
  });

  return {
    root,
    chassis,
    wheels,
    tail,
    head,
    tailLights,
    wheelRadius: measureWheel(wheels[0]?.pivot, look),
    ride: autoRide,
  };
}

function measureWheel(pivot: THREE.Object3D | undefined, look: CarLook) {
  const fallback = 0.34 * look.scale * look.wheel;
  if (!pivot) return fallback;
  const size = new THREE.Box3().setFromObject(pivot).getSize(new THREE.Vector3());
  const radius = Math.max(size.y, size.z) * 0.5;
  return radius > 0.05 ? radius : fallback;
}

function finishRealistic(root: THREE.Group, look: CarLook) {
  const tails: THREE.MeshStandardMaterial[] = [];
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const next = list.map((material) => {
      if (material.name === "paint") {
        return new THREE.MeshPhysicalMaterial({
          name: "paint",
          color: look.color,
          metalness: 0.62,
          roughness: 0.22,
          clearcoat: 1,
          clearcoatRoughness: 0.08,
          envMap: carEnvironment ?? undefined,
          envMapIntensity: 1.15,
        });
      }
      if (!(material instanceof THREE.MeshStandardMaterial)) return material;
      if (material.name === "glass") {
        material.transparent = true;
        material.opacity = 0.72;
        material.depthWrite = false;
        material.roughness = 0.04;
        material.metalness = 0.12;
        material.color.set(0x1c3d52);
        material.envMap = carEnvironment;
        material.envMapIntensity = 0.55;
        mesh.renderOrder = 2;
      } else if (material.name === "chrome") {
        material.envMap = carEnvironment;
        material.envMapIntensity = 1.05;
      } else if (material.name === "light-tail") {
        tails.push(material);
      }
      return material;
    });
    mesh.material = Array.isArray(mesh.material) ? next : next[0];
  });
  return tails;
}

function tintChassis(chassis: THREE.Group, color: number) {
  // Kenney Car Kit uses a shared colormap atlas. Replace body paint with a
  // solid material so each garage car gets a clear unique color.
  const paint = new THREE.MeshPhysicalMaterial({
    name: "paint",
    color,
    metalness: 0.55,
    roughness: 0.28,
    clearcoat: 0.7,
    clearcoatRoughness: 0.15,
    envMap: carEnvironment ?? undefined,
    envMapIntensity: 1.0,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x1a1c20,
    metalness: 0.4,
    roughness: 0.55,
    envMap: carEnvironment ?? undefined,
    envMapIntensity: 0.5,
  });
  chassis.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const name = (mesh.name || "").toLowerCase();
    const parent = (mesh.parent?.name || "").toLowerCase();
    if (name.includes("wheel") || parent.includes("wheel")) return;
    if (name.includes("spoiler") || parent.includes("spoiler")) {
      mesh.material = paint;
      return;
    }
    // Body and misc chassis parts get paint; grill stays dark.
    if (name.includes("grill") || name.includes("grille")) {
      mesh.material = dark;
      return;
    }
    mesh.material = paint;
  });
}

function dressBody(chassis: THREE.Group, look: CarLook) {
  const box = new THREE.Box3().setFromObject(chassis);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const paint = new THREE.MeshStandardMaterial({
    color: look.color,
    roughness: 0.35,
    metalness: 0.4,
    envMap: carEnvironment ?? undefined,
    envMapIntensity: 0.8,
  });
  if (look.spoiler) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(size.x * 0.86, 0.05, 0.16), paint);
    wing.position.set(0, box.max.y + 0.04, box.min.z + size.z * 0.06);
    const uprights = new THREE.Mesh(new THREE.BoxGeometry(size.x * 0.5, 0.12, 0.04), paint);
    uprights.position.set(0, box.max.y - 0.02, box.min.z + size.z * 0.08);
    chassis.add(wing, uprights);
  }
  if (look.roofLights) {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(size.x * 0.55, 0.08, 0.12),
      new THREE.MeshStandardMaterial({ color: 0xfff1cc, emissive: 0xffb703, emissiveIntensity: 1.4 }),
    );
    bar.position.set(0, box.max.y + 0.06, (box.min.z + box.max.z) * 0.5);
    chassis.add(bar);
  }

  // Bright lamps so every Kenney base has clear headlights and taillights.
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xfff6e4,
    emissive: 0xfff1cc,
    emissiveIntensity: 1.6,
    roughness: 0.25,
  });
  const tailMat = new THREE.MeshStandardMaterial({
    name: "light-tail",
    color: 0xff1a1a,
    emissive: 0xff1a1a,
    emissiveIntensity: 1.2,
    roughness: 0.3,
  });
  for (const side of [-1, 1]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(size.x * 0.12, size.y * 0.1, 0.06), headMat);
    head.position.set(side * size.x * 0.28, box.min.y + size.y * 0.38, box.max.z + 0.01);
    chassis.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(size.x * 0.14, size.y * 0.08, 0.05), tailMat);
    tail.position.set(side * size.x * 0.3, box.min.y + size.y * 0.4, box.min.z - 0.01);
    chassis.add(tail);
  }
}
