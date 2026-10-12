import * as THREE from "three";
import { BUILDINGS, LAKE, PATCHES, ROADS, SPAWN } from "./mapData";
import type { Collider, RoadSeg } from "./sim";
import {
  CHUNK,
  FOG,
  GROUND_HALF,
  HIT_RANGE,
  ROAD_LIFT,
  VIEW_RANGE,
  blocksProp,
  driveHeight,
  lakeLevel,
  regionAt,
  terrainHeight,
} from "./terrain";

export type World = {
  object: THREE.Group;
  colliders: Collider[];
  roads: RoadSeg[];
  /** Stream scenery and keep the sky over the car. */
  update: (x: number, z: number, dt: number) => void;
  /** Wheel height, including the thin road sheet. */
  heightAt: (x: number, z: number) => number;
};

export { FOG };

type Kind = "pine" | "round" | "bush" | "rock";

type Spot = {
  x: number;
  z: number;
  s: number;
  rot: number;
  kind: Kind;
};

type ChunkData = {
  spots: Spot[];
};

const COUNTS: Record<ReturnType<typeof regionAt>, Record<Kind, number>> = {
  town: { pine: 2, round: 1, bush: 7, rock: 1 },
  forest: { pine: 14, round: 5, bush: 10, rock: 3 },
  wild: { pine: 5, round: 3, bush: 8, rock: 3 },
};

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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

function roadGeometry(x1: number, z1: number, x2: number, z2: number, width: number) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const len = Math.hypot(dx, dz) || 1;
  const steps = Math.max(1, Math.ceil(len / 10));
  const px = (-dz / len) * (width / 2);
  const pz = (dx / len) * (width / 2);
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = x1 + dx * t;
    const z = z1 + dz * t;
    const yL = terrainHeight(x + px, z + pz) + ROAD_LIFT;
    const yR = terrainHeight(x - px, z - pz) + ROAD_LIFT;
    positions.push(x + px, yL, z + pz, x - px, yR, z - pz);
    const v = (len * t) / 12;
    uvs.push(0, v, 1, v);
  }
  for (let i = 0; i < steps; i++) {
    const a = i * 2;
    indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
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
    polygonOffsetFactor: -2,
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

function skyTexture() {
  return canvasTex((g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#2a62b8");
    sky.addColorStop(0.34, "#7eb4ea");
    sky.addColorStop(0.48, "#c5d7e6");
    sky.addColorStop(1, "#c5d7e6");
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);

    // Soft cloud puffs in the upper sky. The texture scrolls slowly.
    const rand = mulberry32(19);
    for (let i = 0; i < 46; i++) {
      const x = rand() * w;
      const y = h * (0.06 + rand() * 0.3);
      const rw = 50 + rand() * 120;
      const rh = 14 + rand() * 28;
      g.fillStyle = `rgba(255,252,248,${0.45 + rand() * 0.4})`;
      g.beginPath();
      g.ellipse(x, y, rw, rh, 0, 0, Math.PI * 2);
      g.fill();
    }

    // A faint ridge on the horizon so far hills have a skyline.
    g.fillStyle = "rgba(90, 110, 126, 0.45)";
    g.beginPath();
    const horizon = h * 0.5;
    g.moveTo(0, horizon);
    for (let x = 0; x <= w; x += 8) {
      const n =
        Math.sin(x * 0.018) * 16 +
        Math.sin(x * 0.047 + 1.2) * 9 +
        Math.sin(x * 0.1) * 4;
      g.lineTo(x, horizon - Math.max(0, n));
    }
    g.lineTo(w, horizon);
    g.fill();
  }, 1024, 512);
}

/** A height-colored ground patch. `half` is the distance from the center to the edge. */
function groundGeometry(cx: number, cz: number, half: number, step: number) {
  const n = Math.max(1, Math.ceil((half * 2) / step));
  const row = n + 1;
  const positions = new Float32Array(row * row * 3);
  const colors = new Float32Array(row * row * 3);
  const uvs = new Float32Array(row * row * 2);
  const sandR = 0.78;
  const sandG = 0.7;
  const sandB = 0.48;
  let p = 0;
  let c = 0;
  let u = 0;
  for (let iz = 0; iz <= n; iz++) {
    for (let ix = 0; ix <= n; ix++) {
      const x = cx - half + (ix / n) * half * 2;
      const z = cz - half + (iz / n) * half * 2;
      const y = terrainHeight(x, z);
      positions[p++] = x;
      positions[p++] = y;
      positions[p++] = z;
      uvs[u++] = x / 7;
      uvs[u++] = z / 7;
      const high = THREE.MathUtils.clamp((y + 22) / 52, 0, 1);
      const speck = 0.92 + 0.08 * Math.sin(x * 0.07) * Math.cos(z * 0.06);
      let r = (0.2 + high * 0.22) * speck;
      let g = (0.38 + high * 0.12) * speck;
      let b = (0.14 + high * 0.05) * speck;
      const ld = Math.hypot(x - LAKE.x, z - LAKE.z);
      if (ld < LAKE.r + 22) {
        const t = 1 - THREE.MathUtils.smoothstep(ld, LAKE.r - 2, LAKE.r + 22);
        r += (sandR - r) * t;
        g += (sandG - g) * t;
        b += (sandB - b) * t;
      }
      colors[c++] = r;
      colors[c++] = g;
      colors[c++] = b;
    }
  }
  const index = new Uint32Array(n * n * 6);
  let k = 0;
  for (let iz = 0; iz < n; iz++) {
    for (let ix = 0; ix < n; ix++) {
      const a = iz * row + ix;
      index[k++] = a;
      index[k++] = a + row;
      index[k++] = a + 1;
      index[k++] = a + 1;
      index[k++] = a + row;
      index[k++] = a + row + 1;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  geo.computeVertexNormals();
  return geo;
}

function drapeRect(x: number, z: number, hx: number, hz: number, lift: number, sx: number, sz: number) {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let iz = 0; iz <= sz; iz++) {
    for (let ix = 0; ix <= sx; ix++) {
      const px = x - hx + (ix / sx) * hx * 2;
      const pz = z - hz + (iz / sz) * hz * 2;
      positions.push(px, terrainHeight(px, pz) + lift, pz);
      uvs.push(ix / sx, iz / sz);
    }
  }
  for (let iz = 0; iz < sz; iz++) {
    for (let ix = 0; ix < sx; ix++) {
      const a = iz * (sx + 1) + ix;
      const row = a + (sx + 1);
      indices.push(a, row, a + 1, a + 1, row, row + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

const pineTrunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 2.4, 6);
const pineLeafGeo = new THREE.ConeGeometry(1.35, 2.6, 6);
const pineTopGeo = new THREE.ConeGeometry(0.9, 1.7, 6);
const roundTrunkGeo = new THREE.CylinderGeometry(0.2, 0.28, 1.6, 6);
const roundLeafGeo = new THREE.IcosahedronGeometry(1.15, 0);
const bushGeo = new THREE.IcosahedronGeometry(0.55, 0);
const rockGeo = new THREE.DodecahedronGeometry(0.85, 0);

const trunkMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92 });
const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88 });
const bushMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
const rockMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.96 });

const trunkColor = new THREE.Color("#6b4630");
const pineColor = new THREE.Color("#2f7a34");
const pineTopColor = new THREE.Color("#3d9442");
const roundColor = new THREE.Color("#3f8f45");
const bushA = new THREE.Color("#3c7a32");
const bushB = new THREE.Color("#4e8a3c");
const rockA = new THREE.Color("#8a7b6c");
const rockB = new THREE.Color("#6d6258");

export function createWorld(): World {
  const object = new THREE.Group();
  const colliders: Collider[] = [];
  const staticColliders: Collider[] = [];

  const grassTex = canvasTex((g, w, h) => {
    g.fillStyle = "#4c8a3c";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2800; i++) {
      g.fillStyle = i % 2 === 0 ? "#5c9a48" : "#3d7030";
      g.fillRect(Math.random() * w, Math.random() * h, 3, 2);
    }
  }, 256, 256);
  grassTex.wrapS = THREE.RepeatWrapping;
  grassTex.wrapT = THREE.RepeatWrapping;
  const farMat = new THREE.MeshStandardMaterial({
    map: grassTex,
    vertexColors: true,
    roughness: 1,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 2,
  });
  const nearMat = new THREE.MeshStandardMaterial({
    map: grassTex,
    vertexColors: true,
    roughness: 1,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const farGround = new THREE.Mesh(groundGeometry(0, 0, GROUND_HALF, 36), farMat);
  farGround.frustumCulled = false;
  object.add(farGround);
  let nearGround = new THREE.Mesh(groundGeometry(SPAWN.x, SPAWN.z, 400, 10), nearMat);
  nearGround.frustumCulled = false;
  object.add(nearGround);
  let nearX = SPAWN.x;
  let nearZ = SPAWN.z;

  addLake(object);

  const asphalt = roadMaterial(false);
  const dirt = roadMaterial(true);
  const roads: RoadSeg[] = ROADS.map((road) => {
    const mesh = new THREE.Mesh(roadGeometry(road.x1, road.z1, road.x2, road.z2, road.width), road.grip < 0.85 ? dirt : asphalt);
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
    new THREE.MeshStandardMaterial({ map: checker, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -4 }),
  );
  start.rotation.x = -Math.PI / 2;
  start.position.set(SPAWN.x, driveHeight(SPAWN.x, 0) + 0.04, 0);
  object.add(start);

  addBuildings(object, staticColliders);
  addGas(object, staticColliders, 155, 70);
  addBarn(object, staticColliders);
  addFountain(object, staticColliders, 78, 108);
  addSign(object, staticColliders, "OPEN ROAD", -46, 16, -Math.PI / 2, "#ffcc33");
  addSign(object, staticColliders, "TOWN", 28, 16, -Math.PI / 2, "#7ec8ff");
  addSign(object, staticColliders, "LAKE", 150, -110, facing(-210, 180), "#3ec6c6");
  addSign(object, staticColliders, "FOREST", -150, 95, facing(170, -130), "#8dce6a");
  addSign(object, staticColliders, "WET", 40, 16, -Math.PI / 2, "#7ec8ff");
  addSign(object, staticColliders, "MUD", -170, 92, 0, "#c47a3a");
  addSign(object, staticColliders, "ICE", 210, -16, -Math.PI / 2, "#d7e7f2");
  addPatches(object);
  addLamps(object, staticColliders);
  addUmbrellas(object);

  const skyTex = skyTexture();
  skyTex.wrapS = THREE.RepeatWrapping;
  skyTex.wrapT = THREE.ClampToEdgeWrapping;
  const skyAnchor = new THREE.Group();
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1700, 28, 16),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, depthWrite: false, fog: false }),
  );
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  skyAnchor.add(sky);

  const sunMat = new THREE.MeshBasicMaterial({ color: 0xfff1c2, fog: false, depthWrite: false });
  const sun = new THREE.Mesh(new THREE.SphereGeometry(46, 16, 12), sunMat);
  sun.position.set(720, 280, 340);
  sun.renderOrder = -1;
  skyAnchor.add(sun);

  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xfff8f2,
    emissive: 0xfff4ea,
    emissiveIntensity: 0.35,
    roughness: 1,
  });
  const cloudRand = mulberry32(3);
  for (let i = 0; i < 10; i++) {
    const cloud = new THREE.Group();
    const puff = 5 + Math.floor(cloudRand() * 3);
    for (let p = 0; p < puff; p++) {
      const s = 5 + cloudRand() * 6;
      const ball = new THREE.Mesh(new THREE.SphereGeometry(s, 7, 5), cloudMat);
      ball.position.set((cloudRand() - 0.5) * 22, cloudRand() * 3, (cloudRand() - 0.5) * 12);
      cloud.add(ball);
    }
    const ang = (i / 10) * Math.PI * 2 + 0.4;
    const dist = 280 + (i % 4) * 55;
    cloud.position.set(Math.cos(ang) * dist, 130 + (i % 4) * 16, Math.sin(ang) * dist);
    skyAnchor.add(cloud);
  }
  object.add(skyAnchor);

  const nature = new THREE.Group();
  object.add(nature);
  const chunks = new Map<string, ChunkData>();
  let shownX = Number.NaN;
  let shownZ = Number.NaN;

  function heightAt(x: number, z: number) {
    return driveHeight(x, z);
  }

  function refreshHits(cx: number, cz: number) {
    colliders.length = 0;
    for (const c of staticColliders) colliders.push(c);
    for (let oz = cz - HIT_RANGE; oz <= cz + HIT_RANGE; oz++) {
      for (let ox = cx - HIT_RANGE; ox <= cx + HIT_RANGE; ox++) {
        const chunk = chunks.get(`${ox},${oz}`);
        if (!chunk) continue;
        for (const spot of chunk.spots) {
          if (spot.kind === "pine" || spot.kind === "round") {
            colliders.push({ kind: "circle", x: spot.x, z: spot.z, r: 0.42 });
          } else if (spot.kind === "rock" && spot.s > 1.15) {
            colliders.push({ kind: "circle", x: spot.x, z: spot.z, r: 0.5 * spot.s });
          }
        }
      }
    }
  }

  function update(x: number, z: number, dt: number) {
    skyAnchor.position.set(x, 0, z);
    skyTex.offset.x = (skyTex.offset.x + dt * 0.0015) % 1;

    if (Math.hypot(x - nearX, z - nearZ) > 110) {
      object.remove(nearGround);
      nearGround.geometry.dispose();
      nearGround = new THREE.Mesh(groundGeometry(x, z, 400, 10), nearMat);
      nearGround.frustumCulled = false;
      object.add(nearGround);
      nearX = x;
      nearZ = z;
    }

    const cx = Math.floor(x / CHUNK);
    const cz = Math.floor(z / CHUNK);
    if (cx === shownX && cz === shownZ) return;
    shownX = cx;
    shownZ = cz;
    const visible: Spot[] = [];
    for (let oz = cz - VIEW_RANGE; oz <= cz + VIEW_RANGE; oz++) {
      for (let ox = cx - VIEW_RANGE; ox <= cx + VIEW_RANGE; ox++) {
        const key = `${ox},${oz}`;
        let chunk = chunks.get(key);
        if (!chunk) {
          chunk = buildChunk(ox, oz);
          chunks.set(key, chunk);
        }
        for (const spot of chunk.spots) visible.push(spot);
      }
    }
    fillNature(nature, visible);
    refreshHits(cx, cz);
  }

  update(SPAWN.x, SPAWN.z, 0);
  return { object, colliders, roads, update, heightAt };
}

function buildChunk(cx: number, cz: number): ChunkData {
  const rand = mulberry32((Math.imul(cx, 0x85ebca6b) ^ Math.imul(cz, 0xc2b2ae35)) | 0);
  const originX = cx * CHUNK;
  const originZ = cz * CHUNK;
  const midX = originX + CHUNK * 0.5;
  const midZ = originZ + CHUNK * 0.5;
  const counts = COUNTS[regionAt(midX, midZ)];
  const spots: Spot[] = [];
  const kinds: Kind[] = ["pine", "round", "bush", "rock"];
  for (const kind of kinds) {
    let placed = 0;
    let guard = 0;
    const want = counts[kind];
    while (placed < want && guard < want * 14) {
      guard += 1;
      const x = originX + rand() * CHUNK;
      const z = originZ + rand() * CHUNK;
      if (blocksProp(x, z)) continue;
      const s =
        kind === "rock" ? 0.7 + rand() * 1.3 : kind === "bush" ? 0.7 + rand() * 0.8 : 0.8 + rand() * 0.7;
      spots.push({ x, z, s, rot: rand() * Math.PI * 2, kind });
      placed += 1;
    }
  }

  return { spots };
}

function fillNature(group: THREE.Group, spots: Spot[]) {
  for (const child of [...group.children]) {
    group.remove(child);
    (child as THREE.InstancedMesh).dispose();
  }
  addKind(group, spots, "pine", pineTrunkGeo, trunkMat, trunkColor, (dummy, spot, y) => {
    dummy.scale.set(spot.s, spot.s, spot.s);
    dummy.position.set(spot.x, y + 1.2 * spot.s, spot.z);
  });
  addKind(group, spots, "pine", pineLeafGeo, leafMat, pineColor, (dummy, spot, y) => {
    dummy.scale.set(spot.s, spot.s, spot.s);
    dummy.position.set(spot.x, y + 2.2 * spot.s, spot.z);
  });
  addKind(group, spots, "pine", pineTopGeo, leafMat, pineTopColor, (dummy, spot, y) => {
    dummy.scale.set(spot.s, spot.s, spot.s);
    dummy.position.set(spot.x, y + 3.15 * spot.s, spot.z);
  });
  addKind(group, spots, "round", roundTrunkGeo, trunkMat, trunkColor, (dummy, spot, y) => {
    dummy.scale.set(spot.s, spot.s, spot.s);
    dummy.position.set(spot.x, y + 0.8 * spot.s, spot.z);
  });
  addKind(group, spots, "round", roundLeafGeo, leafMat, roundColor, (dummy, spot, y) => {
    dummy.scale.set(spot.s * 1.25, spot.s * 1.05, spot.s * 1.25);
    dummy.position.set(spot.x, y + 2.15 * spot.s, spot.z);
  });
  addKind(group, spots, "bush", bushGeo, bushMat, bushA, (dummy, spot, y) => {
    dummy.scale.set(spot.s * 1.3, spot.s * 0.85, spot.s * 1.2);
    dummy.position.set(spot.x, y + 0.35 * spot.s, spot.z);
  }, bushB);
  addKind(group, spots, "rock", rockGeo, rockMat, rockA, (dummy, spot, y) => {
    dummy.scale.set(spot.s, spot.s * 0.62, spot.s * 0.86);
    dummy.position.set(spot.x, y + 0.22 * spot.s, spot.z);
  }, rockB);
}

function addKind(
  group: THREE.Group,
  spots: Spot[],
  kind: Kind,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  colorA: THREE.Color,
  place: (dummy: THREE.Object3D, spot: Spot, y: number) => void,
  colorB?: THREE.Color,
) {
  const list = spots.filter((spot) => spot.kind === kind);
  if (!list.length) return;
  const mesh = new THREE.InstancedMesh(geo, mat, list.length);
  mesh.frustumCulled = false;
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  list.forEach((spot, i) => {
    dummy.rotation.set(0, spot.rot, 0);
    dummy.scale.set(1, 1, 1);
    place(dummy, spot, terrainHeight(spot.x, spot.z));
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    if (colorB) color.copy(colorA).lerp(colorB, (spot.rot / Math.PI) % 1);
    else color.copy(colorA);
    mesh.setColorAt(i, color);
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  group.add(mesh);
}

function facing(nx: number, nz: number) {
  const len = Math.hypot(nx, nz) || 1;
  return Math.atan2(nx / len, nz / len);
}

function addLake(object: THREE.Group) {
  const y = lakeLevel();
  const segs = 40;
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const inner = LAKE.r - 2;
    const outer = LAKE.r + 16;
    const x0 = LAKE.x + c * inner;
    const z0 = LAKE.z + s * inner;
    const x1 = LAKE.x + c * outer;
    const z1 = LAKE.z + s * outer;
    positions.push(x0, terrainHeight(x0, z0) + 0.06, z0, x1, terrainHeight(x1, z1) + 0.06, z1);
  }
  for (let i = 0; i < segs; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const shore = new THREE.Mesh(
    new THREE.BufferGeometry(),
    new THREE.MeshStandardMaterial({ color: 0xd9c48a, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
  );
  shore.geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  shore.geometry.setIndex(indices);
  shore.geometry.computeVertexNormals();
  object.add(shore);

  const water = new THREE.Mesh(
    new THREE.CircleGeometry(LAKE.r, 40),
    new THREE.MeshStandardMaterial({ color: 0x1d7ea0, roughness: 0.16, metalness: 0.45 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(LAKE.x, y + 0.08, LAKE.z);
  object.add(water);
}

function addBuildings(object: THREE.Group, colliders: Collider[]) {
  for (const b of BUILDINGS) {
    const y = terrainHeight(b.x, b.z) - 0.3;
    const body = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), facade(b.color));
    body.position.set(b.x, y + b.h / 2, b.z);
    body.castShadow = true;
    body.receiveShadow = true;
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(b.w + 0.8, 0.55, b.d + 0.8),
      new THREE.MeshStandardMaterial({ color: b.roof, roughness: 0.86 }),
    );
    roof.position.set(b.x, y + b.h + 0.25, b.z);
    roof.castShadow = true;
    object.add(body, roof);
    colliders.push({ kind: "box", x: b.x, z: b.z, hx: b.w / 2, hz: b.d / 2 });
  }
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
  const ground = terrainHeight(x, z) - 0.25;
  const postMat = new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 0.8 });
  for (const dx of [-1.7, 1.7]) {
    const px = x + Math.cos(rotY) * dx;
    const pz = z - Math.sin(rotY) * dx;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 3.1, 8), postMat);
    post.position.set(px, ground + 1.55, pz);
    post.castShadow = true;
    object.add(post);
    colliders.push({ kind: "circle", x: px, z: pz, r: 0.34 });
  }
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(4.6, 2.15),
    new THREE.MeshStandardMaterial({ map: labelTexture(text, stripe), roughness: 0.55, side: THREE.DoubleSide }),
  );
  board.position.set(x, ground + 2.55, z);
  board.rotation.y = rotY;
  object.add(board);
}

function addGas(object: THREE.Group, colliders: Collider[], x: number, z: number) {
  const ground = terrainHeight(x, z) - 0.35;
  const poleMat = new THREE.MeshStandardMaterial({ color: 0xdedede, metalness: 0.35, roughness: 0.4 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xd42323, roughness: 0.45, metalness: 0.15 });
  for (const [dx, dz] of [
    [-4.2, -3],
    [4.2, -3],
    [-4.2, 3],
    [4.2, 3],
  ] as const) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 4.2, 8), poleMat);
    pole.position.set(x + dx, ground + 2.1, z + dz);
    pole.castShadow = true;
    object.add(pole);
    colliders.push({ kind: "circle", x: x + dx, z: z + dz, r: 0.4 });
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(10.4, 0.32, 8), roofMat);
  roof.position.set(x, ground + 4.3, z);
  roof.castShadow = true;
  object.add(roof);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 0.7),
    new THREE.MeshStandardMaterial({ map: labelTexture("GAS", "#ffcc33"), roughness: 0.5, side: THREE.DoubleSide }),
  );
  sign.position.set(x, ground + 3.7, z + 4.05);
  object.add(sign);
}

function addBarn(object: THREE.Group, colliders: Collider[]) {
  const ground = terrainHeight(190, 175) - 0.3;
  const wall = new THREE.MeshStandardMaterial({ color: 0x8d2d2a, roughness: 0.8 });
  const roof = new THREE.MeshStandardMaterial({ color: 0x3e2a28, roughness: 0.85 });
  const barn = new THREE.Mesh(new THREE.BoxGeometry(14, 7, 10), wall);
  barn.position.set(190, ground + 3.5, 175);
  barn.castShadow = true;
  barn.receiveShadow = true;
  const top = new THREE.Mesh(new THREE.BoxGeometry(15, 0.5, 11), roof);
  top.position.set(190, ground + 7.2, 175);
  top.castShadow = true;
  object.add(barn, top);
  colliders.push({ kind: "box", x: 190, z: 175, hx: 7, hz: 5 });

  const siloGround = terrainHeight(206, 188) - 0.3;
  const siloMat = new THREE.MeshStandardMaterial({ color: 0xc8c2b4, roughness: 0.7, metalness: 0.15 });
  const silo = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.2, 11, 12), siloMat);
  silo.position.set(206, siloGround + 5.5, 188);
  silo.castShadow = true;
  object.add(silo);
  colliders.push({ kind: "circle", x: 206, z: 188, r: 2.2 });
}

function addFountain(object: THREE.Group, colliders: Collider[], x: number, z: number) {
  const ground = terrainHeight(x, z) - 0.2;
  const stone = new THREE.MeshStandardMaterial({ color: 0xcfc6b8, roughness: 0.75 });
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.5, 0.9, 20), stone);
  basin.position.set(x, ground + 0.45, z);
  basin.castShadow = true;
  basin.receiveShadow = true;
  const lip = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.28, 8, 20), stone);
  lip.rotation.x = Math.PI / 2;
  lip.position.set(x, ground + 0.9, z);
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(3.6, 20),
    new THREE.MeshStandardMaterial({ color: 0x49b4d4, roughness: 0.15, metalness: 0.4 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(x, ground + 0.82, z);
  object.add(basin, lip, water);
  colliders.push({ kind: "circle", x, z, r: 4.4 });
}

function addPatches(object: THREE.Group) {
  const colors: Record<string, number> = { Wet: 0x243848, Mud: 0x5c3b22, Ice: 0xd5e6f4 };
  for (const patch of PATCHES) {
    const mesh = new THREE.Mesh(
      drapeRect(patch.x, patch.z, patch.hx, patch.hz, ROAD_LIFT + 0.04, 8, 4),
      new THREE.MeshStandardMaterial({
        color: colors[patch.name] ?? 0x888888,
        roughness: patch.name === "Mud" ? 1 : 0.18,
        metalness: patch.name === "Wet" ? 0.45 : 0.05,
        transparent: true,
        opacity: 0.82,
        polygonOffset: true,
        polygonOffsetFactor: -3,
        polygonOffsetUnits: -3,
      }),
    );
    object.add(mesh);
  }
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
      const ground = terrainHeight(x, z) - 0.25;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 4.2, 6), poleMat);
      pole.position.set(x, ground + 2.1, z);
      pole.castShadow = true;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), bulbMat);
      bulb.position.set(x, ground + 4.25, z);
      object.add(pole, bulb);
      colliders.push({ kind: "circle", x, z, r: 0.28 });
    }
  }
}

function addUmbrellas(object: THREE.Group) {
  const dx = -LAKE.x;
  const dz = -LAKE.z;
  const len = Math.hypot(dx, dz) || 1;
  const sx = LAKE.x + (dx / len) * (LAKE.r + 8);
  const sz = LAKE.z + (dz / len) * (LAKE.r + 8);
  const colors = [0xf25c8e, 0xf2c14e];
  colors.forEach((color, i) => {
    const ox = sx + i * 3.2;
    const oz = sz + i * 1.4;
    const ground = terrainHeight(ox, oz);
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.07, 1.7, 6),
      new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.5 }),
    );
    pole.position.set(ox, ground + 0.85, oz);
    const top = new THREE.Mesh(
      new THREE.ConeGeometry(1.15, 0.38, 8),
      new THREE.MeshStandardMaterial({ color, roughness: 0.6 }),
    );
    top.position.set(ox, ground + 1.75, oz);
    object.add(pole, top);
  });
}
