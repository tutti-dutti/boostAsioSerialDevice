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
};

export type CarVisual = {
  root: THREE.Group;
  chassis: THREE.Group;
  wheels: WheelRig[];
  tail: THREE.MeshStandardMaterial;
  head: THREE.MeshStandardMaterial;
  wheelRadius: number;
  ride: number;
};

function isWheel(name: string) {
  return name.startsWith("wheel-") && (name.includes("left") || name.includes("right"));
}

/** Load a CC0 Kenney car and dress it up as one garage vehicle. */
export async function loadCarModel(url: string, look: CarLook): Promise<CarVisual> {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(url);
  const model = gltf.scene;

  const root = new THREE.Group();
  root.name = "car";
  const chassis = new THREE.Group();
  root.add(chassis);

  const wheels: WheelRig[] = [];
  for (const child of [...model.children]) {
    if (isWheel(child.name)) {
      const front = child.name.includes("front");
      const pivot = new THREE.Group();
      pivot.position.copy(child.position);
      const spin = new THREE.Group();
      child.position.set(0, 0, 0);
      child.rotation.set(0, 0, 0);
      child.scale.set(1, 1, 1);
      spin.add(child);
      pivot.add(spin);
      root.add(pivot);
      pivot.scale.setScalar(look.wheel);
      wheels.push({ pivot, spin, front });
    } else {
      chassis.add(child);
    }
  }

  tintChassis(chassis, look.color);
  dressBody(chassis, look);
  root.scale.setScalar(look.scale);
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
  });

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

  return { root, chassis, wheels, tail, head, wheelRadius: 0.3 * look.scale * look.wheel, ride: look.ride };
}

function tintChassis(chassis: THREE.Group, color: number) {
  chassis.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const tinted = materials.map((material) => {
      const next = material.clone();
      if (next instanceof THREE.MeshStandardMaterial) next.color.setHex(color);
      return next;
    });
    mesh.material = Array.isArray(mesh.material) ? tinted : tinted[0];
  });
}

function dressBody(chassis: THREE.Group, look: CarLook) {
  const box = new THREE.Box3().setFromObject(chassis);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const paint = new THREE.MeshStandardMaterial({ color: look.color, roughness: 0.45 });
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
}
