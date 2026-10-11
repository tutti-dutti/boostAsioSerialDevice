import * as THREE from "three";

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
};

function box(
  parent: THREE.Object3D,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  material: THREE.Material,
  rotX = 0,
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.rotation.x = rotX;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function makeWheel(radius: number, width: number) {
  const pivot = new THREE.Group();
  const spin = new THREE.Group();
  pivot.add(spin);

  const tireMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.92, metalness: 0.05 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xd5d7dc, roughness: 0.28, metalness: 0.92 });
  const discMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.4, metalness: 0.7 });

  const tire = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 28), tireMat);
  tire.rotation.z = Math.PI / 2;
  tire.castShadow = true;
  spin.add(tire);

  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.62, radius * 0.62, width * 0.62, 20),
    rimMat,
  );
  rim.rotation.z = Math.PI / 2;
  spin.add(rim);

  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.38, radius * 0.38, width * 0.2, 16),
    discMat,
  );
  disc.rotation.z = Math.PI / 2;
  spin.add(disc);

  for (let i = 0; i < 5; i++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(width * 0.22, radius * 0.48, radius * 0.08), rimMat);
    const a = (i / 5) * Math.PI * 2;
    spoke.position.set(0, Math.cos(a) * radius * 0.32, Math.sin(a) * radius * 0.32);
    spoke.rotation.x = a;
    spin.add(spoke);
  }

  return { pivot, spin };
}

function plateTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const g = canvas.getContext("2d");
  if (!g) return null;
  g.fillStyle = "#f4f4f4";
  g.fillRect(0, 0, 256, 128);
  g.strokeStyle = "#222";
  g.lineWidth = 8;
  g.strokeRect(6, 6, 244, 116);
  g.fillStyle = "#1a1a1a";
  g.font = "bold 72px sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("COMET", 128, 68);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createCar(): CarVisual {
  const root = new THREE.Group();
  root.name = "comet";
  const chassis = new THREE.Group();
  root.add(chassis);

  const paint = new THREE.MeshStandardMaterial({
    color: 0xe10600,
    metalness: 0.35,
    roughness: 0.38,
  });
  const dark = new THREE.MeshStandardMaterial({ color: 0x141618, roughness: 0.55, metalness: 0.2 });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x17324a,
    roughness: 0.05,
    metalness: 0.85,
    transparent: true,
    opacity: 0.55,
  });
  const head = new THREE.MeshStandardMaterial({
    color: 0xfff6e4,
    emissive: 0xfff1cc,
    emissiveIntensity: 1.6,
    roughness: 0.25,
  });
  const tail = new THREE.MeshStandardMaterial({
    color: 0x3a0000,
    emissive: 0xff1a1a,
    emissiveIntensity: 0.55,
    roughness: 0.35,
  });

  box(chassis, 1.9, 0.34, 4.15, 0, 0.5, 0, paint);
  box(chassis, 1.72, 0.16, 1.45, 0, 0.7, 1.05, paint);
  box(chassis, 1.55, 0.22, 0.55, 0, 0.48, 1.9, paint);
  box(chassis, 1.82, 0.2, 0.95, 0, 0.64, -1.45, paint);
  box(chassis, 1.62, 0.38, 1.35, 0, 0.86, -0.15, paint);
  box(chassis, 1.48, 0.08, 1.05, 0, 1.08, -0.22, paint);
  box(chassis, 1.42, 0.42, 0.06, 0, 0.96, 0.52, glass, -0.42);
  box(chassis, 0.05, 0.28, 1.05, 0.78, 0.92, -0.15, glass);
  box(chassis, 0.05, 0.28, 1.05, -0.78, 0.92, -0.15, glass);
  box(chassis, 1.3, 0.22, 0.55, 0, 0.78, -0.85, glass, 0.35);
  box(chassis, 1.25, 0.16, 0.7, 0, 0.58, -0.2, dark);
  box(chassis, 1.7, 0.08, 0.9, 0, 0.42, 0.2, dark);
  box(chassis, 0.08, 0.22, 0.08, -0.55, 0.95, -2.02, dark);
  box(chassis, 0.08, 0.22, 0.08, 0.55, 0.95, -2.02, dark);
  box(chassis, 1.55, 0.06, 0.28, 0, 1.08, -2.02, dark);
  box(chassis, 0.18, 0.1, 0.16, 0.92, 0.82, 0.42, dark);
  box(chassis, 0.18, 0.1, 0.16, -0.92, 0.82, 0.42, dark);

  box(chassis, 0.42, 0.16, 0.12, -0.62, 0.52, 2.08, head);
  box(chassis, 0.42, 0.16, 0.12, 0.62, 0.52, 2.08, head);
  box(chassis, 0.5, 0.16, 0.1, -0.62, 0.5, -2.08, tail);
  box(chassis, 0.5, 0.16, 0.1, 0.62, 0.5, -2.08, tail);

  const plateMap = plateTexture();
  if (plateMap) {
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(0.72, 0.32),
      new THREE.MeshStandardMaterial({ map: plateMap, roughness: 0.45, metalness: 0.1 }),
    );
    plate.position.set(0, 0.5, -2.12);
    plate.rotation.y = Math.PI;
    chassis.add(plate);
  }

  const radius = 0.36;
  const spots: { x: number; z: number; front: boolean }[] = [
    { x: -0.82, z: 1.38, front: true },
    { x: 0.82, z: 1.38, front: true },
    { x: -0.82, z: -1.38, front: false },
    { x: 0.82, z: -1.38, front: false },
  ];
  const wheels: WheelRig[] = spots.map((spot) => {
    const wheel = makeWheel(radius, 0.26);
    wheel.pivot.position.set(spot.x, radius + 0.02, spot.z);
    root.add(wheel.pivot);
    return { pivot: wheel.pivot, spin: wheel.spin, front: spot.front };
  });

  return { root, chassis, wheels, tail, head };
}
