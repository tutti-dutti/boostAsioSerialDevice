import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export type WheelRig = {
  pivot: THREE.Group;
  spin: THREE.Group;
  front: boolean;
};

export type CarVisual = {
  root: THREE.Group;
  chassis: THREE.Group;
  wheels: WheelRig[];
  tail: THREE.MeshStandardMaterial;
  head: THREE.MeshStandardMaterial;
  wheelRadius: number;
};

const WHEEL_NAMES = new Set([
  "wheel-front-left",
  "wheel-front-right",
  "wheel-back-left",
  "wheel-back-right",
]);

/** Kenney's CC0 sedan-sports is about 2.5 units long. Scale it up to a real car. */
const MODEL_SCALE = 1.85;

export async function loadSportsCar(): Promise<CarVisual> {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync("/models/sedan-sports.glb");
  const model = gltf.scene;

  const root = new THREE.Group();
  root.name = "comet";
  const chassis = new THREE.Group();
  root.add(chassis);

  const wheels: WheelRig[] = [];
  for (const child of [...model.children]) {
    if (WHEEL_NAMES.has(child.name)) {
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
      wheels.push({ pivot, spin, front });
    } else {
      chassis.add(child);
    }
  }

  root.scale.setScalar(MODEL_SCALE);
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

  return { root, chassis, wheels, tail, head, wheelRadius: 0.3 * MODEL_SCALE };
}
