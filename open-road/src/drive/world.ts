import * as THREE from "three";
import { LAKE, ROADS, SPAWN } from "./mapData";
import type { Collider, RoadSeg } from "./sim";

export type World = {
  object: THREE.Group;
  colliders: Collider[];
  roads: RoadSeg[];
};

const BUILDINGS: { x: number; z: number; w: number; d: number; h: number; color: string }[] = [
  { x: 52, z: 42, w: 16, d: 14, h: 9, color: "#efe6d6" },
  { x: 86, z: 48, w: 14, d: 12, h: 16, color: "#f2efe6" },
  { x: 58, z: -46, w: 18, d: 12, h: 8, color: "#e7d3c0" },
  { x: -54, z: 44, w: 20, d: 14, h: 11, color: "#f7f1e4" },
  { x: -92, z: 40, w: 12, d: 16, h: 7, color: "#eadfce" },
  { x: -56, z: -48, w: 16, d: 14, h: 13, color: "#e8dcc8" },
  { x: 120, z: -36, w: 14, d: 12, h: 8, color: "#f3e9da" },
  { x: -130, z: -40, w: 18, d: 14, h: 10, color: "#efe4d4" },
];

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function distToSeg(px: number, pz: number, x1: number, z1: number, x2: number, z2: number) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const l2 = dx * dx + dz * dz || 1;
  let t = ((px - x1) * dx + (pz - z1) * dz) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), pz - (z1 + t * dz));
}

function canvasTex(draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, w: number, h: number) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d");
  if (!g) return new THREE.CanvasTexture(canvas);
  draw(g, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function noiseFill(g: CanvasRenderingContext2D, w: number, h: number, amount: number) {
  const img = g.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    img.data[i] = Math.max(0, Math.min(255, img.data[i] + n));
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n));
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n));
  }
  g.putImageData(img, 0, 0);
}

function roadGeometry(x1: number, z1: number, x2: number, z2: number, width: number, y: number) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const len = Math.hypot(dx, dz) || 1;
  const px = (-dz / len) * (width / 2);
  const pz = (dx / len) * (width / 2);
  const positions = new Float32Array([
    x1 + px, y, z1 + pz,
    x1 - px, y, z1 - pz,
    x2 - px, y, z2 - pz,
    x2 + px, y, z2 + pz,
  ]);
  const uvs = new Float32Array([0, 0, 1, 0, 1, len / 12, 0, len / 12]);
  const normals = new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geo.setIndex([0, 2, 1, 0, 3, 2]);
  return geo;
}

function roadMaterial(dirt: boolean) {
  const tex = canvasTex((g, w, h) => {
    g.fillStyle = dirt ? "#8a6240" : "#6e747c";
    g.fillRect(0, 0, w, h);
    noiseFill(g, w, h, dirt ? 22 : 16);
    if (dirt) return;
    g.fillStyle = "#ececec";
    g.fillRect(0, 0, 10, h);
    g.fillRect(w - 10, 0, 10, h);
    g.fillStyle = "#e2c64a";
    g.fillRect(w / 2 - 6, 0, 4, h);
    g.fillRect(w / 2 + 2, 0, 4, h);
    g.fillStyle = "#f4f4f4";
    for (let y = 8; y < h; y += 32) {
      g.fillRect(w * 0.25, y, 4, 16);
      g.fillRect(w * 0.75, y, 4, 16);
    }
  }, 256, 128);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return new THREE.MeshStandardMaterial({
    map: tex,
    roughness: dirt ? 0.95 : 0.86,
    metalness: 0.02,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -4,
  });
}

function facade(color: string) {
  const tex = canvasTex((g, w, h) => {
    g.fillStyle = color;
    g.fillRect(0, 0, w, h);
    for (let y = 18; y < h - 16; y += 36) {
      for (let x = 14; x < w - 16; x += 30) {
        g.fillStyle = (x + y) % 60 < 30 ? "#f3d48a" : "#243044";
        g.fillRect(x, y, 16, 22);
      }
    }
  }, 128, 160);
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.82, metalness: 0.02 });
}

function labelTexture(text: string, stripe: string) {
  return canvasTex((g, w, h) => {
    g.fillStyle = "#142033";
    g.fillRect(0, 0, w, h);
    g.fillStyle = stripe;
    g.fillRect(0, 0, w, 22);
    g.fillRect(0, h - 22, w, 22);
    g.fillStyle = "#ffffff";
    g.font = "bold 84px sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, w / 2, h / 2 + 6);
  }, 512, 256);
}

export function createWorld(): World {
  const object = new THREE.Group();
  const colliders: Collider[] = [];

  const grassTex = canvasTex((g, w, h) => {
    g.fillStyle = "#3e7834";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 3500; i++) {
      g.fillStyle = i % 2 === 0 ? "#4c8a3c" : "#34662c";
      g.fillRect(Math.random() * w, Math.random() * h, 3, 2);
    }
  }, 512, 512);
  grassTex.wrapS = THREE.RepeatWrapping;
  grassTex.wrapT = THREE.RepeatWrapping;
  grassTex.repeat.set(64, 64);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1400, 1400),
    new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1, metalness: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  object.add(ground);

  const sand = new THREE.Mesh(
    new THREE.RingGeometry(LAKE.r - 1, LAKE.r + 18, 48),
    new THREE.MeshStandardMaterial({ color: 0xd9c48a, roughness: 1 }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(LAKE.x, 0.02, LAKE.z);
  sand.receiveShadow = true;
  object.add(sand);

  const water = new THREE.Mesh(
    new THREE.CircleGeometry(LAKE.r, 48),
    new THREE.MeshStandardMaterial({ color: 0x1d7ea0, roughness: 0.16, metalness: 0.55 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(LAKE.x, 0.04, LAKE.z);
  object.add(water);

  const asphalt = roadMaterial(false);
  const dirt = roadMaterial(true);
  const roads: RoadSeg[] = ROADS.map((road) => {
    const mesh = new THREE.Mesh(
      roadGeometry(road.x1, road.z1, road.x2, road.z2, road.width, 0.06),
      road.grip < 0.85 ? dirt : asphalt,
    );
    mesh.receiveShadow = true;
    object.add(mesh);
    return {
      x1: road.x1,
      z1: road.z1,
      x2: road.x2,
      z2: road.z2,
      half: road.width / 2,
      grip: road.grip,
    };
  });

  const checker = canvasTex((g, w, h) => {
    const n = 8;
    for (let i = 0; i < n; i++) {
      g.fillStyle = i % 2 === 0 ? "#f7f7f7" : "#161616";
      g.fillRect((i * w) / n, 0, w / n, h);
    }
  }, 128, 32);
  const start = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 16),
    new THREE.MeshStandardMaterial({ map: checker, roughness: 0.8 }),
  );
  start.rotation.x = -Math.PI / 2;
  start.position.set(SPAWN.x, 0.09, 0);
  object.add(start);

  const roofMat = new THREE.MeshStandardMaterial({ color: 0x4a433c, roughness: 0.86 });
  for (const b of BUILDINGS) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), facade(b.color));
    body.position.set(b.x, b.h / 2, b.z);
    body.castShadow = true;
    body.receiveShadow = true;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.8, 0.55, b.d + 0.8), roofMat);
    roof.position.set(b.x, b.h + 0.25, b.z);
    roof.castShadow = true;
    object.add(body, roof);
    colliders.push({ kind: "box", x: b.x, z: b.z, hx: b.w / 2, hz: b.d / 2 });
  }

  addGas(object, colliders, 155, 70);
  addBarn(object, colliders);
  addFountain(object, colliders, 88, 88);
  addSign(object, colliders, "OPEN ROAD", -46, 16, -Math.PI / 2, "#ffcc33");
  addSign(object, colliders, "TOWN", 28, 16, -Math.PI / 2, "#7ec8ff");
  addSign(object, colliders, "LAKE", 150, -110, facing(-210, 180), "#3ec6c6");
  addSign(object, colliders, "FOREST", -150, 95, facing(170, -130), "#8dce6a");
  addLamps(object, colliders);
  addUmbrellas(object);
  addMountains(object);
  addClouds(object);
  addTrees(object, colliders);

  return { object, colliders, roads };
}

function facing(nx: number, nz: number) {
  const len = Math.hypot(nx, nz) || 1;
  return Math.atan2(nx / len, nz / len);
}

function addSign(
  object: THREE.Group,
  colliders: Collider[],
  text: string,
  x: number,
  z: number,
  rotY: number,
  stripe: string,
) {
  const postMat = new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 0.8 });
  for (const dx of [-1.7, 1.7]) {
    const along = rotY;
    const px = x + Math.cos(along) * dx;
    const pz = z - Math.sin(along) * dx;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 3.1, 8), postMat);
    post.position.set(px, 1.55, pz);
    post.castShadow = true;
    object.add(post);
    colliders.push({ kind: "circle", x: px, z: pz, r: 0.34 });
  }
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(4.6, 2.15),
    new THREE.MeshStandardMaterial({ map: labelTexture(text, stripe), roughness: 0.55, side: THREE.DoubleSide }),
  );
  board.position.set(x, 2.55, z);
  board.rotation.y = rotY;
  object.add(board);
}

function addGas(object: THREE.Group, colliders: Collider[], x: number, z: number) {
  const poleMat = new THREE.MeshStandardMaterial({ color: 0xdedede, metalness: 0.35, roughness: 0.4 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xd42323, roughness: 0.45, metalness: 0.15 });
  for (const [dx, dz] of [
    [-4.2, -3],
    [4.2, -3],
    [-4.2, 3],
    [4.2, 3],
  ] as const) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 4.2, 8), poleMat);
    pole.position.set(x + dx, 2.1, z + dz);
    pole.castShadow = true;
    object.add(pole);
    colliders.push({ kind: "circle", x: x + dx, z: z + dz, r: 0.4 });
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(10.4, 0.32, 8), roofMat);
  roof.position.set(x, 4.3, z);
  roof.castShadow = true;
  object.add(roof);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 0.7),
    new THREE.MeshStandardMaterial({ map: labelTexture("GAS", "#ffcc33"), roughness: 0.5, side: THREE.DoubleSide }),
  );
  sign.position.set(x, 3.7, z + 4.05);
  object.add(sign);
}

function addBarn(object: THREE.Group, colliders: Collider[]) {
  const wall = new THREE.MeshStandardMaterial({ color: 0x8d2d2a, roughness: 0.8 });
  const roof = new THREE.MeshStandardMaterial({ color: 0x3e2a28, roughness: 0.85 });
  const barn = new THREE.Mesh(new THREE.BoxGeometry(14, 7, 10), wall);
  barn.position.set(190, 3.5, 175);
  barn.castShadow = true;
  barn.receiveShadow = true;
  const top = new THREE.Mesh(new THREE.BoxGeometry(15, 0.5, 11), roof);
  top.position.set(190, 7.2, 175);
  top.castShadow = true;
  object.add(barn, top);
  colliders.push({ kind: "box", x: 190, z: 175, hx: 7, hz: 5 });

  const siloMat = new THREE.MeshStandardMaterial({ color: 0xc8c2b4, roughness: 0.7, metalness: 0.15 });
  const silo = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.2, 11, 16), siloMat);
  silo.position.set(206, 5.5, 188);
  silo.castShadow = true;
  object.add(silo);
  colliders.push({ kind: "circle", x: 206, z: 188, r: 2.2 });
}

function addFountain(object: THREE.Group, colliders: Collider[], x: number, z: number) {
  const stone = new THREE.MeshStandardMaterial({ color: 0xcfc6b8, roughness: 0.75 });
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.5, 0.9, 24), stone);
  basin.position.set(x, 0.45, z);
  basin.castShadow = true;
  basin.receiveShadow = true;
  const lip = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.28, 8, 24), stone);
  lip.rotation.x = Math.PI / 2;
  lip.position.set(x, 0.9, z);
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(3.6, 24),
    new THREE.MeshStandardMaterial({ color: 0x49b4d4, roughness: 0.15, metalness: 0.4 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(x, 0.82, z);
  object.add(basin, lip, water);
  colliders.push({ kind: "circle", x, z, r: 4.4 });
}

function addLamps(object: THREE.Group, colliders: Collider[]) {
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2c3138, roughness: 0.6, metalness: 0.4 });
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xffe7b0,
    emissive: 0xffcc77,
    emissiveIntensity: 0.8,
  });
  for (let x = -180; x <= 180; x += 40) {
    for (const z of [-13, 13]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 4.2, 6), poleMat);
      pole.position.set(x, 2.1, z);
      pole.castShadow = true;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), bulbMat);
      bulb.position.set(x, 4.25, z);
      object.add(pole, bulb);
      colliders.push({ kind: "circle", x, z, r: 0.28 });
    }
  }
}

function addUmbrellas(object: THREE.Group) {
  const dx = -LAKE.x;
  const dz = -LAKE.z;
  const len = Math.hypot(dx, dz) || 1;
  const sx = LAKE.x + (dx / len) * (LAKE.r + 6);
  const sz = LAKE.z + (dz / len) * (LAKE.r + 6);
  const colors = [0xf25c8e, 0xf2c14e];
  colors.forEach((color, i) => {
    const ox = sx + i * 3.2;
    const oz = sz + i * 1.4;
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.07, 1.7, 6),
      new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.5 }),
    );
    pole.position.set(ox, 0.85, oz);
    const top = new THREE.Mesh(
      new THREE.ConeGeometry(1.15, 0.38, 8),
      new THREE.MeshStandardMaterial({ color, roughness: 0.6 }),
    );
    top.position.set(ox, 1.75, oz);
    object.add(pole, top);
  });
}

function addMountains(object: THREE.Group) {
  const rock = new THREE.MeshStandardMaterial({ color: 0x7d6c5e, roughness: 0.95 });
  const snow = new THREE.MeshStandardMaterial({ color: 0xf3eee6, roughness: 0.75 });
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + 0.15;
    const r = 540 + (i % 4) * 28;
    const h = 80 + (i % 5) * 26;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(40 + (i % 3) * 18, h, 6), i % 3 === 0 ? snow : rock);
    cone.position.set(Math.cos(a) * r, h * 0.32, Math.sin(a) * r);
    object.add(cone);
  }
}

function addClouds(object: THREE.Group) {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xfff8f2,
    emissive: 0xfff1e2,
    emissiveIntensity: 0.25,
    roughness: 1,
  });
  const rand = mulberry32(3);
  for (let i = 0; i < 8; i++) {
    const cloud = new THREE.Group();
    const puff = 3 + Math.floor(rand() * 3);
    for (let p = 0; p < puff; p++) {
      const s = 8 + rand() * 10;
      const ball = new THREE.Mesh(new THREE.SphereGeometry(s, 8, 6), mat);
      ball.position.set((rand() - 0.5) * 22, rand() * 4, (rand() - 0.5) * 12);
      cloud.add(ball);
    }
    const ang = rand() * Math.PI * 2;
    const dist = 180 + rand() * 220;
    cloud.position.set(Math.cos(ang) * dist, 70 + rand() * 30, Math.sin(ang) * dist);
    object.add(cloud);
  }
}

function addTrees(object: THREE.Group, colliders: Collider[]) {
  const rand = mulberry32(11);
  const spots: { x: number; z: number; s: number }[] = [];
  let guard = 0;
  while (spots.length < 80 && guard < 4000) {
    guard += 1;
    let x: number;
    let z: number;
    if (rand() < 0.6) {
      x = -390 + rand() * 260;
      z = -180 + rand() * 460;
    } else {
      x = (rand() - 0.5) * 760;
      z = (rand() - 0.5) * 760;
    }
    if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 22) continue;
    if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < 22) continue;
    if (Math.hypot(x - 155, z - 70) < 12) continue;
    if (Math.hypot(x - 190, z - 175) < 16) continue;
    if (Math.hypot(x - 206, z - 188) < 6) continue;
    if (Math.hypot(x - 88, z - 88) < 8) continue;
    let blocked = false;
    for (const road of ROADS) {
      if (distToSeg(x, z, road.x1, road.z1, road.x2, road.z2) < road.width / 2 + 6) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;
    for (const b of BUILDINGS) {
      if (Math.abs(x - b.x) < b.w / 2 + 4 && Math.abs(z - b.z) < b.d / 2 + 4) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;
    spots.push({ x, z, s: 0.85 + rand() * 0.75 });
  }

  const trunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.18, 0.28, 2.4, 6),
    new THREE.MeshStandardMaterial({ color: 0x6b4630, roughness: 0.9 }),
    spots.length,
  );
  const leaves = new THREE.InstancedMesh(
    new THREE.ConeGeometry(1.35, 2.6, 7),
    new THREE.MeshStandardMaterial({ color: 0x2f7a34, roughness: 0.85 }),
    spots.length,
  );
  const tops = new THREE.InstancedMesh(
    new THREE.ConeGeometry(0.9, 1.7, 7),
    new THREE.MeshStandardMaterial({ color: 0x3d9442, roughness: 0.85 }),
    spots.length,
  );
  trunks.castShadow = false;
  leaves.castShadow = false;
  tops.castShadow = false;

  const dummy = new THREE.Object3D();
  spots.forEach((p, i) => {
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(p.s, p.s, p.s);
    dummy.position.set(p.x, 1.2 * p.s, p.z);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    dummy.position.set(p.x, 2.2 * p.s, p.z);
    dummy.updateMatrix();
    leaves.setMatrixAt(i, dummy.matrix);
    dummy.position.set(p.x, 3.15 * p.s, p.z);
    dummy.updateMatrix();
    tops.setMatrixAt(i, dummy.matrix);
    colliders.push({ kind: "circle", x: p.x, z: p.z, r: 0.45 });
  });
  object.add(trunks, leaves, tops);
}
