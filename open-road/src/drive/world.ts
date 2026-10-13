import * as THREE from "three";
import {
  BRIDGE_HALF,
  BRIDGE_SAMPLES,
  EXTRA_PATHS,
  HIGHWAY,
  INNER_RIM,
  LAKE,
  PATCHES,
  PATHS,
  RAMPS,
  RIVER,
  ROADS,
  SPAWN,
  SURFACE_LIFT,
  WORLD_HALF,
  elevatedHeightAt,
  heightAt,
  inRiverWater,
  nearestRoadClearance,
  riverDistance,
  terrainHeightAt,
  type PathDef,
} from "./mapData";
import type { Collider, RoadSeg } from "./sim";
import {
  addCarWash,
  addCityBlocks,
  addDealership,
  addGiantForests,
  addMudPark,
  addRestaurants,
  addSkyway,
  addSpeedTrackProps,
  addTrailMarkers,
} from "./worldBuild";

export type World = {
  object: THREE.Group;
  colliders: Collider[];
  roads: RoadSeg[];
  /** Keep decoration chunks loaded around the car. */
  updateChunks: (x: number, z: number) => void;
  /** Squash shrubs the car is driving over, then spring them back. */
  flattenProps?: (overs: { x: number; z: number; soft: string; r: number }[]) => void;
};

const CHUNK = 160;
const LOAD_RADIUS = 2;
const BUILDINGS: { x: number; z: number; w: number; d: number; h: number; color: string }[] = [
  { x: 52, z: 42, w: 16, d: 14, h: 9, color: "#efe6d6" },
  { x: 86, z: 48, w: 14, d: 12, h: 16, color: "#f2efe6" },
  { x: 58, z: -46, w: 18, d: 12, h: 8, color: "#e7d3c0" },
  { x: -54, z: 44, w: 20, d: 14, h: 11, color: "#f7f1e4" },
  { x: -92, z: 40, w: 12, d: 16, h: 7, color: "#eadfce" },
  { x: -56, z: -48, w: 16, d: 14, h: 13, color: "#e8dcc8" },
  { x: 120, z: -36, w: 14, d: 12, h: 8, color: "#f3e9da" },
  { x: -130, z: -40, w: 18, d: 14, h: 10, color: "#efe4d4" },
  { x: 40, z: 70, w: 10, d: 10, h: 6, color: "#efe8dc" },
  { x: -30, z: -60, w: 12, d: 9, h: 7, color: "#e9dccb" },
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

function nearRoad(x: number, z: number, pad: number) {
  for (const road of ROADS) {
    if (distToSeg(x, z, road.x1, road.z1, road.x2, road.z2) < road.width / 2 + pad) return true;
  }
  return false;
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

function roadMaterial(dirt: boolean, highway: boolean) {
  const tex = canvasTex((g, w, h) => {
    g.fillStyle = dirt ? "#8a6240" : highway ? "#5a6068" : "#6e747c";
    g.fillRect(0, 0, w, h);
    noiseFill(g, w, h, dirt ? 22 : 14);
    if (dirt) return;
    g.fillStyle = "#ececec";
    g.fillRect(0, 0, 8, h);
    g.fillRect(w - 8, 0, 8, h);
    if (highway) {
      g.fillStyle = "#e2c64a";
      g.fillRect(w / 2 - 5, 0, 3, h);
      g.fillRect(w / 2 + 2, 0, 3, h);
      g.fillStyle = "#f4f4f4";
      for (let y = 6; y < h; y += 28) {
        g.fillRect(w * 0.2, y, 3, 14);
        g.fillRect(w * 0.35, y, 3, 14);
        g.fillRect(w * 0.65, y, 3, 14);
        g.fillRect(w * 0.8, y, 3, 14);
      }
    } else {
      g.fillStyle = "#e2c64a";
      g.fillRect(w / 2 - 5, 0, 3, h);
      g.fillRect(w / 2 + 2, 0, 3, h);
      g.fillStyle = "#f4f4f4";
      for (let y = 8; y < h; y += 32) {
        g.fillRect(w * 0.25, y, 4, 16);
        g.fillRect(w * 0.75, y, 4, 16);
      }
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
    depthWrite: true,
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

function speedLimitTexture(mph: number) {
  return canvasTex((g, w, h) => {
    g.clearRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(w, h) * 0.46;
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = 18;
    g.strokeStyle = "#111111";
    g.stroke();
    g.fillStyle = "#111111";
    g.font = "bold 52px sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("SPEED", cx, cy - 70);
    g.fillText("LIMIT", cx, cy - 28);
    g.font = "bold 140px sans-serif";
    g.fillText(String(mph), cx, cy + 55);
  }, 512, 512);
}

function addSpeedLimitSign(
  object: THREE.Group,
  colliders: Collider[],
  mph: number,
  x: number,
  z: number,
  rotY: number,
) {
  let sx = x;
  let sz = z;
  for (let attempt = 0; attempt < 8; attempt++) {
    const clear = nearestRoadClearance(sx, sz);
    const need = clear.half + 3.2;
    if (clear.d >= need) break;
    const len = Math.hypot(sx, sz) || 1;
    const push = need - clear.d + 0.5;
    sx += (sx / len) * push;
    sz += (sz / len) * push;
  }
  const y0 = terrainHeightAt(sx, sz);
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.12, 3.4, 8),
    new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.55, metalness: 0.4 }),
  );
  post.position.set(sx, y0 + 1.7, sz);
  object.add(post);
  colliders.push({ kind: "circle", x: sx, z: sz, r: 0.3 });
  const board = new THREE.Mesh(
    new THREE.CircleGeometry(0.85, 28),
    new THREE.MeshStandardMaterial({
      map: speedLimitTexture(mph),
      roughness: 0.45,
      side: THREE.DoubleSide,
    }),
  );
  board.position.set(sx, y0 + 3.55, sz);
  board.rotation.y = rotY;
  object.add(board);
}

/** Catmull-Rom sample of a 2D path. */
function samplePath(path: PathDef, samples: number): { x: number; z: number; tx: number; tz: number }[] {
  const pts = path.points;
  if (pts.length < 2) return [];
  const closed = Boolean(path.closed);
  const ring = closed ? [...pts, pts[0], pts[1]] : pts;
  const out: { x: number; z: number; tx: number; tz: number }[] = [];
  const segs = closed ? pts.length : pts.length - 1;
  for (let s = 0; s < samples; s++) {
    const u = s / (samples - (closed ? 0 : 1) || 1);
    const f = u * segs;
    const i = Math.min(segs - 1, Math.floor(f));
    const t = f - i;
    const p0 = ring[i];
    const p1 = ring[i + 1];
    const p2 = ring[Math.min(ring.length - 1, i + 2)];
    const pm = ring[Math.max(0, i - 1 + (closed && i === 0 ? pts.length : 0))];
    // Fallback simple lerp if open path ends are short.
    const a = closed || i > 0 ? pm : p0;
    const b = p0;
    const c = p1;
    const d = closed || i < segs - 1 ? p2 : p1;
    const t2 = t * t;
    const t3 = t2 * t;
    const x =
      0.5 *
      (2 * b[0] +
        (-a[0] + c[0]) * t +
        (2 * a[0] - 5 * b[0] + 4 * c[0] - d[0]) * t2 +
        (-a[0] + 3 * b[0] - 3 * c[0] + d[0]) * t3);
    const z =
      0.5 *
      (2 * b[1] +
        (-a[1] + c[1]) * t +
        (2 * a[1] - 5 * b[1] + 4 * c[1] - d[1]) * t2 +
        (-a[1] + 3 * b[1] - 3 * c[1] + d[1]) * t3);
    // Tangent from neighboring samples later; approx via derivative.
    const dx =
      0.5 *
      ((-a[0] + c[0]) +
        2 * (2 * a[0] - 5 * b[0] + 4 * c[0] - d[0]) * t +
        3 * (-a[0] + 3 * b[0] - 3 * c[0] + d[0]) * t2);
    const dz =
      0.5 *
      ((-a[1] + c[1]) +
        2 * (2 * a[1] - 5 * b[1] + 4 * c[1] - d[1]) * t +
        3 * (-a[1] + 3 * b[1] - 3 * c[1] + d[1]) * t2);
    const len = Math.hypot(dx, dz) || 1;
    out.push({ x, z, tx: dx / len, tz: dz / len });
  }
  if (closed && out.length) out.pop();
  return out;
}

function ribbonGeometry(path: PathDef, yLift: number) {
  const samples = path.highway ? 220 : path.closed ? 140 : 90;
  const pts = samplePath(path, samples);
  if (pts.length < 2) return null;
  const half = path.width / 2;
  // Shared height field (intersection-unified). atGrade stays on terrain under decks.
  // Never blur Y across elevated↔ground jumps — that floated ribbons mid-air at
  // skyway/bridge footprints and made overlapping paths disagree by meters.
  const ys = pts.map((p) => (path.atGrade ? terrainHeightAt(p.x, p.z) : heightAt(p.x, p.z)) + yLift);
  if (path.closed && ys.length > 2 && Math.abs(ys[0] - ys[ys.length - 1]) < 1.2) {
    const avg = (ys[0] + ys[ys.length - 1]) * 0.5;
    ys[0] = avg;
    ys[ys.length - 1] = avg;
  }
  {
    const src = ys.slice();
    for (let i = 0; i < ys.length; i++) {
      const i0 = path.closed ? (i - 1 + ys.length) % ys.length : Math.max(0, i - 1);
      const i1 = path.closed ? (i + 1) % ys.length : Math.min(ys.length - 1, i + 1);
      // Skip neighbors that jump onto a deck / cliff (keeps seams flat, not ramped).
      const leftOk = Math.abs(src[i] - src[i0]) < 1.2;
      const rightOk = Math.abs(src[i] - src[i1]) < 1.2;
      if (!leftOk && !rightOk) continue;
      const w0 = leftOk ? 0.15 : 0;
      const w1 = rightOk ? 0.15 : 0;
      const w = 1 - w0 - w1;
      ys[i] = src[i0] * w0 + src[i] * w + src[i1] * w1;
    }
  }
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  let dist = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const px = -p.tz * half;
    const pz = p.tx * half;
    const y = ys[i];
    pos.push(p.x + px, y, p.z + pz, p.x - px, y, p.z - pz);
    if (i > 0) {
      const prev = pts[i - 1];
      dist += Math.hypot(p.x - prev.x, p.z - prev.z);
    }
    uv.push(0, dist / 12, 1, dist / 12);
    if (i > 0) {
      const a = (i - 1) * 2;
      const b = a + 1;
      const c = i * 2;
      const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  if (path.closed && pts.length > 2) {
    // Weld the seam: match last ring Y to first, then close.
    pos[pos.length - 5] = pos[1];
    pos[pos.length - 2] = pos[4];
    const a = (pts.length - 1) * 2;
    idx.push(a, 0, a + 1, a + 1, 0, 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function buildTerrainChunk(cx: number, cz: number, grassMat: THREE.Material) {
  const segs = 24;
  const size = CHUNK;
  const geo = new THREE.PlaneGeometry(size, size, segs, segs);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const ox = cx * CHUNK + CHUNK / 2;
  const oz = cz * CHUNK + CHUNK / 2;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + ox;
    const z = pos.getZ(i) + oz;
    // Ground only — bridge deck is a separate raised ribbon so the river stays visible.
    pos.setY(i, terrainHeightAt(x, z));
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, grassMat);
  mesh.position.set(ox, 0, oz);
  mesh.receiveShadow = true;
  return mesh;
}

export function createWorld(): World {
  const object = new THREE.Group();
  const baseColliders: Collider[] = [];
  const colliders: Collider[] = [];
  const decoColliderLists = new Map<string, Collider[]>();
  const decoRoot = new THREE.Group();
  object.add(decoRoot);
  const syncColliders = () => {
    colliders.length = 0;
    colliders.push(...baseColliders);
    for (const list of decoColliderLists.values()) colliders.push(...list);
  };

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
  grassTex.repeat.set(8, 8);
  const grassMat = new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1, metalness: 0 });

  const terrainChunks = new Map<string, THREE.Object3D>();
  const decoChunks = new Map<string, THREE.Object3D>();

  const asphalt = roadMaterial(false, false);
  const asphaltHwy = roadMaterial(false, true);
  const dirtMat = roadMaterial(true, false);

  const allPaths: PathDef[] = [...PATHS, HIGHWAY, ...RAMPS, ...EXTRA_PATHS];
  // Wide gravel shoulder first, then asphalt on top so grass never pokes through.
  for (const path of allPaths) {
    if (path.grip < 0.85) continue;
    const shoulder: PathDef = { ...path, width: path.width + (path.highway ? 8 : 5) };
    const geo = ribbonGeometry(shoulder, SURFACE_LIFT * 0.35);
    if (!geo) continue;
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        color: 0x8a8678,
        roughness: 0.95,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      }),
    );
    mesh.receiveShadow = true;
    object.add(mesh);
  }
  for (const path of allPaths) {
    const geo = ribbonGeometry(path, SURFACE_LIFT);
    if (!geo) continue;
    const mat = path.grip < 0.85 ? dirtMat : path.highway ? asphaltHwy : asphalt;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    object.add(mesh);
  }

  const roads: RoadSeg[] = ROADS.map((road) => ({
    x1: road.x1,
    z1: road.z1,
    x2: road.x2,
    z2: road.z2,
    half: road.width / 2,
    grip: road.grip,
  }));

  const sand = new THREE.Mesh(
    new THREE.RingGeometry(LAKE.r - 1, LAKE.r + 18, 48),
    new THREE.MeshStandardMaterial({ color: 0xd9c48a, roughness: 1 }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(LAKE.x, heightAt(LAKE.x, LAKE.z) + 0.02, LAKE.z);
  sand.receiveShadow = true;
  object.add(sand);

  const water = new THREE.Mesh(
    new THREE.CircleGeometry(LAKE.r, 48),
    new THREE.MeshStandardMaterial({ color: 0x1d7ea0, roughness: 0.16, metalness: 0.55 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(LAKE.x, heightAt(LAKE.x, LAKE.z) + 0.04, LAKE.z);
  object.add(water);

  addRiverAndBridge(object, baseColliders);

  const checker = canvasTex((g, w, h) => {
    const n = 8;
    for (let i = 0; i < n; i++) {
      g.fillStyle = i % 2 === 0 ? "#f7f7f7" : "#161616";
      g.fillRect((i * w) / n, 0, w / n, h);
    }
  }, 128, 32);
  // Start line: road-width only (main cross is 14 m), flat on the asphalt.
  const start = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 13.5),
    new THREE.MeshStandardMaterial({
      map: checker,
      roughness: 0.8,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    }),
  );
  start.rotation.x = -Math.PI / 2;
  start.position.set(SPAWN.x, heightAt(SPAWN.x, SPAWN.z) + SURFACE_LIFT + 0.015, SPAWN.z);
  object.add(start);

  const roofMat = new THREE.MeshStandardMaterial({ color: 0x4a433c, roughness: 0.86 });
  for (const b of BUILDINGS) {
    const y0 = heightAt(b.x, b.z);
    const body = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), facade(b.color));
    body.position.set(b.x, y0 + b.h / 2, b.z);
    body.castShadow = true;
    body.receiveShadow = true;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.8, 0.55, b.d + 0.8), roofMat);
    roof.position.set(b.x, y0 + b.h + 0.25, b.z);
    roof.castShadow = true;
    object.add(body, roof);
    baseColliders.push({ kind: "box", x: b.x, z: b.z, hx: b.w / 2, hz: b.d / 2 });
  }

  addGas(object, baseColliders, 155, 70);
  addBarn(object, baseColliders);
  addFountain(object, baseColliders, 88, 88);
  addSign(object, baseColliders, "OPEN ROAD", -46, 16, -Math.PI / 2, "#ffcc33");
  addSign(object, baseColliders, "TOWN", 28, 16, -Math.PI / 2, "#7ec8ff");
  addSign(object, baseColliders, "LAKE", 150, -110, facing(-210, 180), "#3ec6c6");
  addSign(object, baseColliders, "FOREST", -150, 95, facing(170, -130), "#8dce6a");
  addSign(object, baseColliders, "HIGHWAY", 380, 20, -Math.PI / 2, "#ffcc33");
  addSign(object, baseColliders, "BRIDGE", 620, 640, facing(-200, 100), "#ffcc33");
  addSign(object, baseColliders, "RIVER", 420, 820, facing(100, -80), "#3ec6c6");
  addSign(object, baseColliders, "WET", 40, 16, -Math.PI / 2, "#7ec8ff");
  addSign(object, baseColliders, "MUD", -170, 92, 0, "#c47a3a");
  addSign(object, baseColliders, "ICE", 210, -16, -Math.PI / 2, "#d7e7f2");
  // Posted limits: city 110 / roads 130 / highway 175 / skyway 190
  addSpeedLimitSign(object, baseColliders, 110, -40, 20, -Math.PI / 2);
  addSpeedLimitSign(object, baseColliders, 110, 100, -20, Math.PI / 2);
  addSpeedLimitSign(object, baseColliders, 130, 280, 30, -Math.PI / 2);
  addSpeedLimitSign(object, baseColliders, 130, -250, 40, Math.PI);
  addSpeedLimitSign(object, baseColliders, 175, 420, 40, -Math.PI / 2);
  addSpeedLimitSign(object, baseColliders, 175, 700, 200, facing(-100, 40));
  addSpeedLimitSign(object, baseColliders, 190, 980, 80, -Math.PI / 2);
  addSpeedLimitSign(object, baseColliders, 190, -980, 40, Math.PI / 2);
  addPatches(object);
  addCrosswalks(object);
  addLamps(object, baseColliders);
  addUmbrellas(object);
  addMountains(object);
  addClouds(object);
  addCurbsAndRails(object);
  // WORLD-BUILD jobs
  addGiantForests(object, baseColliders);
  addTrailMarkers(object, baseColliders);
  addMudPark(object, baseColliders);
  addSpeedTrackProps(object, baseColliders);
  addCityBlocks(object, baseColliders);
  addSkyway(object, baseColliders);
  addRestaurants(object, baseColliders);
  addDealership(object, baseColliders);
  addCarWash(object, baseColliders);

  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 2.4, 6);
  const leafGeo = new THREE.ConeGeometry(1.35, 2.6, 7);
  const topGeo = new THREE.ConeGeometry(0.9, 1.7, 7);
  const rockGeo = new THREE.DodecahedronGeometry(0.7, 0);
  const bushGeo = new THREE.SphereGeometry(0.7, 8, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4630, roughness: 0.9 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f7a34, roughness: 0.85 });
  const topMat = new THREE.MeshStandardMaterial({ color: 0x3d9442, roughness: 0.85 });
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x7a7268, roughness: 0.95 });
  const bushMat = new THREE.MeshStandardMaterial({ color: 0x3f8a3a, roughness: 0.9 });

  function chunkKey(cx: number, cz: number) {
    return `${cx},${cz}`;
  }

  function buildDeco(cx: number, cz: number) {
    const group = new THREE.Group();
    const local: Collider[] = [];
    const rand = mulberry32((cx * 73856093) ^ (cz * 19349663) ^ 11);
    const ox = cx * CHUNK;
    const oz = cz * CHUNK;
    const spots: { x: number; z: number; s: number; kind: number }[] = [];
    let guard = 0;
    while (spots.length < 28 && guard < 500) {
      guard += 1;
      const x = ox + rand() * CHUNK;
      const z = oz + rand() * CHUNK;
      if (Math.abs(x) > WORLD_HALF || Math.abs(z) > WORLD_HALF) continue;
      if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 22) continue;
      if (riverDistance(x, z).d < RIVER.halfWidth + RIVER.bankExtra + 6) continue;
      if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < 22) continue;
      if (nearRoad(x, z, 5)) continue; // ≥5 m from road edge
      // Never decorate onto elevated deck footprints.
      if (elevatedHeightAt(x, z) != null) continue;
      let blocked = false;
      for (const b of BUILDINGS) {
        if (Math.abs(x - b.x) < b.w / 2 + 4 && Math.abs(z - b.z) < b.d / 2 + 4) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;
      spots.push({ x, z, s: 0.75 + rand() * 0.9, kind: Math.floor(rand() * 5) });
    }

    const trees = spots.filter((s) => s.kind < 3);
    const rocks = spots.filter((s) => s.kind === 3);
    const bushes = spots.filter((s) => s.kind === 4);

    const shrubRecords: { x: number; z: number; s: number; mesh: THREE.InstancedMesh; index: number; base: THREE.Matrix4 }[] =
      [];

    if (trees.length) {
      const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, trees.length);
      const leaves = new THREE.InstancedMesh(leafGeo, leafMat, trees.length);
      const tops = new THREE.InstancedMesh(topGeo, topMat, trees.length);
      const dummy = new THREE.Object3D();
      trees.forEach((p, i) => {
        const y = terrainHeightAt(p.x, p.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(p.s, p.s, p.s);
        dummy.position.set(p.x, y + 1.2 * p.s, p.z);
        dummy.updateMatrix();
        trunks.setMatrixAt(i, dummy.matrix);
        dummy.position.set(p.x, y + 2.2 * p.s, p.z);
        dummy.updateMatrix();
        leaves.setMatrixAt(i, dummy.matrix);
        dummy.position.set(p.x, y + 3.15 * p.s, p.z);
        dummy.updateMatrix();
        tops.setMatrixAt(i, dummy.matrix);
        // Trees stay solid for every vehicle.
        local.push({ kind: "circle", x: p.x, z: p.z, r: 0.45, soft: "solid" });
      });
      group.add(trunks, leaves, tops);
    }
    if (rocks.length) {
      const mesh = new THREE.InstancedMesh(rockGeo, rockMat, rocks.length);
      const dummy = new THREE.Object3D();
      rocks.forEach((p, i) => {
        // Big rocks are solid boulders (size-matched). Only small ones are climbable.
        const boulder = p.s >= 0.95;
        const scale = boulder ? p.s * 1.7 : p.s * 0.7;
        dummy.scale.set(scale, scale * (boulder ? 0.95 : 0.5), scale);
        dummy.rotation.set(rand() * 1.2, rand() * 6, rand() * 0.4);
        dummy.position.set(p.x, terrainHeightAt(p.x, p.z) + 0.28 * scale, p.z);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        local.push({
          kind: "circle",
          x: p.x,
          z: p.z,
          r: boulder ? Math.max(0.9, 0.95 * scale) : 0.38 * p.s,
          soft: boulder ? "solid" : "rock",
        });
      });
      group.add(mesh);
    }
    if (bushes.length) {
      const mesh = new THREE.InstancedMesh(bushGeo, bushMat, bushes.length);
      const dummy = new THREE.Object3D();
      bushes.forEach((p, i) => {
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(p.s * 1.2, p.s * 0.8, p.s * 1.2);
        dummy.position.set(p.x, terrainHeightAt(p.x, p.z) + 0.35 * p.s, p.z);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        local.push({ kind: "circle", x: p.x, z: p.z, r: 0.55 * p.s, soft: "shrub" });
        shrubRecords.push({ x: p.x, z: p.z, s: p.s, mesh, index: i, base: dummy.matrix.clone() });
      });
      group.add(mesh);
      (group as THREE.Group & { userData: { shrubs: typeof shrubRecords } }).userData = { shrubs: shrubRecords };
    }
    return { group, local };
  }

  let lastCx = Number.NaN;
  let lastCz = Number.NaN;

  function updateChunks(x: number, z: number) {
    const cx = Math.floor(x / CHUNK);
    const cz = Math.floor(z / CHUNK);
    if (cx === lastCx && cz === lastCz) return;
    lastCx = cx;
    lastCz = cz;
    const needed = new Set<string>();
    for (let dz = -LOAD_RADIUS; dz <= LOAD_RADIUS; dz++) {
      for (let dx = -LOAD_RADIUS; dx <= LOAD_RADIUS; dx++) {
        needed.add(chunkKey(cx + dx, cz + dz));
      }
    }
    for (const key of [...terrainChunks.keys()]) {
      if (!needed.has(key)) {
        const mesh = terrainChunks.get(key);
        if (mesh) {
          object.remove(mesh);
          (mesh as THREE.Mesh).geometry?.dispose();
        }
        terrainChunks.delete(key);
      }
    }
    for (const key of [...decoChunks.keys()]) {
      if (!needed.has(key)) {
        const g = decoChunks.get(key);
        if (g) decoRoot.remove(g);
        decoChunks.delete(key);
        decoColliderLists.delete(key);
      }
    }
    for (const key of needed) {
      if (!terrainChunks.has(key)) {
        const [sx, sz] = key.split(",").map(Number);
        const mesh = buildTerrainChunk(sx, sz, grassMat);
        terrainChunks.set(key, mesh);
        object.add(mesh);
      }
      if (!decoChunks.has(key)) {
        const [sx, sz] = key.split(",").map(Number);
        const built = buildDeco(sx, sz);
        decoChunks.set(key, built.group);
        decoColliderLists.set(key, built.local);
        decoRoot.add(built.group);
      }
    }
    syncColliders();
  }

  updateChunks(SPAWN.x, SPAWN.z);

  const flattenProps = (overs: { x: number; z: number; soft: string; r: number }[]) => {
    if (!overs.length) return;
    const dummy = new THREE.Object3D();
    for (const g of decoChunks.values()) {
      const shrubs = (g as THREE.Object3D).userData?.shrubs as
        | { x: number; z: number; s: number; mesh: THREE.InstancedMesh; index: number; base: THREE.Matrix4 }[]
        | undefined;
      if (!shrubs) continue;
      for (const shrub of shrubs) {
        let hit = false;
        for (const over of overs) {
          if (over.soft !== "shrub") continue;
          if (Math.hypot(shrub.x - over.x, shrub.z - over.z) < 1.2) {
            hit = true;
            break;
          }
        }
        dummy.position.set(shrub.x, heightAt(shrub.x, shrub.z) + 0.12 * shrub.s, shrub.z);
        dummy.rotation.set(0, 0, 0);
        if (hit) dummy.scale.set(shrub.s * 1.35, shrub.s * 0.15, shrub.s * 1.35);
        else dummy.scale.set(shrub.s * 1.2, shrub.s * 0.8, shrub.s * 1.2);
        dummy.updateMatrix();
        shrub.mesh.setMatrixAt(shrub.index, dummy.matrix);
        shrub.mesh.instanceMatrix.needsUpdate = true;
      }
    }
  };

  return { object, colliders, roads, updateChunks, flattenProps };
}

/** River water + banks, and highway bridge pillars / guardrails over the span. */
function addRiverAndBridge(object: THREE.Group, colliders: Collider[]) {
  const bankMat = new THREE.MeshStandardMaterial({ color: 0xc2b08a, roughness: 0.96 });
  const rockBankMat = new THREE.MeshStandardMaterial({ color: 0x8a8278, roughness: 0.94 });
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x1a7a9c,
    roughness: 0.14,
    metalness: 0.45,
    transparent: true,
    opacity: 0.92,
  });
  const concrete = new THREE.MeshStandardMaterial({ color: 0xb8b4aa, roughness: 0.88, metalness: 0.08 });
  const railMat = new THREE.MeshStandardMaterial({ color: 0x3a3f48, roughness: 0.55, metalness: 0.35 });

  // Bank + water ribbons along the river centerline.
  const riverPts = samplePath(
    { points: RIVER.points, width: RIVER.halfWidth * 2, grip: 1 },
    64,
  );
  if (riverPts.length > 2) {
    const bankPos: number[] = [];
    const waterPos: number[] = [];
    const bankIdx: number[] = [];
    const waterIdx: number[] = [];
    const bankHalf = RIVER.halfWidth + RIVER.bankExtra;
    const waterHalf = RIVER.halfWidth;
    for (let i = 0; i < riverPts.length; i++) {
      const p = riverPts[i];
      const px = -p.tz;
      const pz = p.tx;
      const yBank = terrainHeightAt(p.x, p.z) + 0.04;
      const yWater = -2.2;
      bankPos.push(
        p.x + px * bankHalf,
        yBank,
        p.z + pz * bankHalf,
        p.x - px * bankHalf,
        yBank,
        p.z - pz * bankHalf,
      );
      waterPos.push(
        p.x + px * waterHalf,
        yWater,
        p.z + pz * waterHalf,
        p.x - px * waterHalf,
        yWater,
        p.z - pz * waterHalf,
      );
      if (i > 0) {
        const a = (i - 1) * 2;
        bankIdx.push(a, i * 2, a + 1, a + 1, i * 2, i * 2 + 1);
        waterIdx.push(a, i * 2, a + 1, a + 1, i * 2, i * 2 + 1);
      }
    }
    const bankGeo = new THREE.BufferGeometry();
    bankGeo.setAttribute("position", new THREE.Float32BufferAttribute(bankPos, 3));
    bankGeo.setIndex(bankIdx);
    bankGeo.computeVertexNormals();
    const bankMesh = new THREE.Mesh(bankGeo, bankMat);
    bankMesh.receiveShadow = true;
    object.add(bankMesh);

    const waterGeo = new THREE.BufferGeometry();
    waterGeo.setAttribute("position", new THREE.Float32BufferAttribute(waterPos, 3));
    waterGeo.setIndex(waterIdx);
    waterGeo.computeVertexNormals();
    object.add(new THREE.Mesh(waterGeo, waterMat));

    // Rocky patches along the banks — large boulders are solid.
    // Keep them well clear of pavement (highway / underpass / ramps).
    for (let i = 4; i < riverPts.length; i += 5) {
      const p = riverPts[i];
      for (const side of [-1, 1]) {
        let x = p.x - p.tz * side * (RIVER.halfWidth + 40);
        let z = p.z + p.tx * side * (RIVER.halfWidth + 40);
        const clr = nearestRoadClearance(x, z);
        if (clr.d < clr.half + 16) {
          // Nudge farther off the roadway along the bank normal.
          const need = clr.half + 22 - clr.d;
          x -= p.tz * side * need;
          z += p.tx * side * need;
          const again = nearestRoadClearance(x, z);
          if (again.d < again.half + 14) continue;
        }
        const rr = 2.2 + (i % 3) * 0.6;
        const gy = terrainHeightAt(x, z);
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(rr, 0), rockBankMat);
        rock.position.set(x, gy + 0.6, z);
        rock.rotation.set(i * 0.2, i * 0.5, 0.1);
        rock.castShadow = true;
        object.add(rock);
        // Ground-only — skyway / bridge traffic overhead must not hit these.
        colliders.push({ kind: "circle", x, z, r: rr * 0.95, soft: "solid", maxY: gy + rr * 2.2 + 1.5 });
      }
    }
  }

  // Thick concrete deck, side barriers, and pillars every 20–30 m.
  if (BRIDGE_SAMPLES.length > 2) {
    const deckPos: number[] = [];
    const deckIdx: number[] = [];
    const half = BRIDGE_HALF;
    for (let i = 0; i < BRIDGE_SAMPLES.length; i++) {
      const s = BRIDGE_SAMPLES[i];
      const nx = -s.tz;
      const nz = s.tx;
      const y = s.h + SURFACE_LIFT;
      deckPos.push(s.x + nx * half, y, s.z + nz * half, s.x - nx * half, y, s.z - nz * half);
      if (i > 0) {
        const a = (i - 1) * 2;
        deckIdx.push(a, i * 2, a + 1, a + 1, i * 2, i * 2 + 1);
      }
    }
    const deckGeo = new THREE.BufferGeometry();
    deckGeo.setAttribute("position", new THREE.Float32BufferAttribute(deckPos, 3));
    deckGeo.setIndex(deckIdx);
    deckGeo.computeVertexNormals();
    const deckMesh = new THREE.Mesh(
      deckGeo,
      new THREE.MeshStandardMaterial({ color: 0x9a968c, roughness: 0.9, metalness: 0.05 }),
    );
    deckMesh.receiveShadow = true;
    object.add(deckMesh);

    // Deck thickness (underside slab) so the span reads as solid concrete.
    for (let i = 0; i < BRIDGE_SAMPLES.length; i += 2) {
      const s = BRIDGE_SAMPLES[i];
      if (s.lift < 0.2) continue;
      const slab = new THREE.Mesh(new THREE.BoxGeometry(half * 2 + 0.6, 1.1, 4.2), concrete);
      slab.position.set(s.x, s.h + SURFACE_LIFT - 0.55, s.z);
      slab.rotation.y = Math.atan2(s.tx, s.tz);
      // Underside only — never cast a mystery strip onto the road below.
      slab.castShadow = false;
      slab.receiveShadow = true;
      object.add(slab);
    }

    let dist = 0;
    let nextPillar = 12;
    let nextRail = 0;
    for (let i = 0; i < BRIDGE_SAMPLES.length; i++) {
      const s = BRIDGE_SAMPLES[i];
      if (i > 0) {
        const p = BRIDGE_SAMPLES[i - 1];
        dist += Math.hypot(s.x - p.x, s.z - p.z);
      }
      const nx = -s.tz;
      const nz = s.tx;

      // Continuous-looking side barriers (sparse posts + rails).
      if (s.lift > 0.12 && dist >= nextRail) {
        nextRail = dist + 4.5;
        for (const side of [-1, 1]) {
          const rx = s.x + nx * side * (half - 0.25);
          const rz = s.z + nz * side * (half - 0.25);
          const wall = new THREE.Mesh(new THREE.BoxGeometry(0.32, 1.35, 4.4), concrete);
          wall.position.set(rx, s.h + SURFACE_LIFT + 0.65, rz);
          wall.rotation.y = Math.atan2(s.tx, s.tz);
          wall.castShadow = true;
          object.add(wall);
          const cap = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 4.4), railMat);
          cap.position.set(rx, s.h + SURFACE_LIFT + 1.35, rz);
          cap.rotation.y = Math.atan2(s.tx, s.tz);
          object.add(cap);
          // One collider every so often, outside the lanes — no dense jitter wall.
          // Barriers sit on the deck edge; underpass runs the center so XZ rarely overlaps.
          if (s.lift > 0.45 && Math.floor(dist / 9) % 2 === 0) {
            colliders.push({ kind: "circle", x: rx, z: rz, r: 0.4, soft: "solid" });
          }
        }
      }

      // Pillars under the outer deck edges (not in the travel lanes), every 20–30 m.
      if (s.lift > 0.75 && dist >= nextPillar) {
        nextPillar = dist + 22 + (i % 3) * 3;
        for (const side of [-1, 1]) {
          // Sit under the barrier line / outside the 4+4 lanes (~±14), never mid-lane.
          const px = s.x + nx * side * (half - 0.6);
          const pz = s.z + nz * side * (half - 0.6);
          const ground = terrainHeightAt(px, pz);
          const bed = inRiverWater(px, pz) ? -2.6 : ground;
          const top = s.h + SURFACE_LIFT - 0.15;
          const ph = Math.max(3.5, top - bed);
          const pillar = new THREE.Mesh(new THREE.BoxGeometry(2.4, ph, 2.4), concrete);
          pillar.position.set(px, bed + ph / 2, pz);
          pillar.castShadow = true;
          pillar.receiveShadow = true;
          object.add(pillar);
          // Solid under the deck only; ignored when driving on top.
          colliders.push({
            kind: "box",
            x: px,
            z: pz,
            hx: 1.2,
            hz: 1.2,
            maxY: top - 3.2,
          });
        }
      }
    }
  }
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
  // Push the whole sign at least 3 m past the nearest road edge onto the grass.
  let sx = x;
  let sz = z;
  for (let attempt = 0; attempt < 8; attempt++) {
    const clear = nearestRoadClearance(sx, sz);
    const need = clear.half + 3.2;
    if (clear.d >= need) break;
    // Step outward from the nearest road sample direction (away from origin of road).
    const awayX = sx;
    const awayZ = sz;
    const len = Math.hypot(awayX, awayZ) || 1;
    const push = need - clear.d + 0.5;
    sx += (awayX / len) * push;
    sz += (awayZ / len) * push;
  }
  // Final safety: if still on pavement, nudge sideways relative to facing.
  {
    const clear = nearestRoadClearance(sx, sz);
    if (clear.d < clear.half + 3) {
      const sideX = Math.cos(rotY);
      const sideZ = -Math.sin(rotY);
      sx += sideX * (clear.half + 3.5 - clear.d);
      sz += sideZ * (clear.half + 3.5 - clear.d);
    }
  }

  const y0 = terrainHeightAt(sx, sz);
  const postMat = new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 0.8 });
  for (const dx of [-1.7, 1.7]) {
    const along = rotY;
    const px = sx + Math.cos(along) * dx;
    const pz = sz - Math.sin(along) * dx;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 3.1, 8), postMat);
    post.position.set(px, y0 + 1.55, pz);
    post.castShadow = true;
    object.add(post);
    colliders.push({ kind: "circle", x: px, z: pz, r: 0.34 });
  }
  // Two FrontSide faces so the text reads correctly from the road (no mirrored back).
  const map = labelTexture(text, stripe);
  const mat = new THREE.MeshStandardMaterial({ map, roughness: 0.55, side: THREE.FrontSide });
  const front = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 2.15), mat);
  front.position.set(sx, y0 + 2.55, sz);
  front.rotation.y = rotY;
  object.add(front);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 2.15), mat.clone());
  back.position.set(sx, y0 + 2.55, sz);
  back.rotation.y = rotY + Math.PI;
  object.add(back);
}

function addGas(object: THREE.Group, colliders: Collider[], x: number, z: number) {
  const y0 = heightAt(x, z);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0xdedede, metalness: 0.35, roughness: 0.4 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xd42323, roughness: 0.45, metalness: 0.15 });
  for (const [dx, dz] of [
    [-4.2, -3],
    [4.2, -3],
    [-4.2, 3],
    [4.2, 3],
  ] as const) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 4.2, 8), poleMat);
    pole.position.set(x + dx, y0 + 2.1, z + dz);
    pole.castShadow = true;
    object.add(pole);
    colliders.push({ kind: "circle", x: x + dx, z: z + dz, r: 0.4 });
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(10.4, 0.32, 8), roofMat);
  roof.position.set(x, y0 + 4.3, z);
  roof.castShadow = true;
  object.add(roof);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 0.7),
    new THREE.MeshStandardMaterial({ map: labelTexture("GAS", "#ffcc33"), roughness: 0.5, side: THREE.DoubleSide }),
  );
  sign.position.set(x, y0 + 3.7, z + 4.05);
  object.add(sign);
}

function addBarn(object: THREE.Group, colliders: Collider[]) {
  const x = 190;
  const z = 175;
  const y0 = heightAt(x, z);
  const wall = new THREE.MeshStandardMaterial({ color: 0x8d2d2a, roughness: 0.8 });
  const roof = new THREE.MeshStandardMaterial({ color: 0x3e2a28, roughness: 0.85 });
  const barn = new THREE.Mesh(new THREE.BoxGeometry(14, 7, 10), wall);
  barn.position.set(x, y0 + 3.5, z);
  barn.castShadow = true;
  barn.receiveShadow = true;
  const top = new THREE.Mesh(new THREE.BoxGeometry(15, 0.5, 11), roof);
  top.position.set(x, y0 + 7.2, z);
  top.castShadow = true;
  object.add(barn, top);
  colliders.push({ kind: "box", x, z, hx: 7, hz: 5 });

  const siloMat = new THREE.MeshStandardMaterial({ color: 0xc8c2b4, roughness: 0.7, metalness: 0.15 });
  const silo = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.2, 11, 16), siloMat);
  silo.position.set(206, heightAt(206, 188) + 5.5, 188);
  silo.castShadow = true;
  object.add(silo);
  colliders.push({ kind: "circle", x: 206, z: 188, r: 2.2 });
}

function addFountain(object: THREE.Group, colliders: Collider[], x: number, z: number) {
  const y0 = heightAt(x, z);
  const stone = new THREE.MeshStandardMaterial({ color: 0xcfc6b8, roughness: 0.75 });
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.5, 0.9, 24), stone);
  basin.position.set(x, y0 + 0.45, z);
  basin.castShadow = true;
  basin.receiveShadow = true;
  const lip = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.28, 8, 24), stone);
  lip.rotation.x = Math.PI / 2;
  lip.position.set(x, y0 + 0.9, z);
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(3.6, 24),
    new THREE.MeshStandardMaterial({ color: 0x49b4d4, roughness: 0.15, metalness: 0.4 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(x, y0 + 0.82, z);
  object.add(basin, lip, water);
  colliders.push({ kind: "circle", x, z, r: 4.4 });
}

function addPatches(object: THREE.Group) {
  // Wet is a subtle sheen — never a long dark band that looks like a shadow.
  const colors: Record<string, number> = { Wet: 0x6a7a88, Mud: 0x5c3b22, Ice: 0xd5e6f4 };
  for (const patch of PATCHES) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(patch.hx * 2, patch.hz * 2),
      new THREE.MeshStandardMaterial({
        color: colors[patch.name] ?? 0x888888,
        roughness: patch.name === "Mud" ? 1 : patch.name === "Wet" ? 0.28 : 0.18,
        metalness: patch.name === "Wet" ? 0.35 : 0.05,
        transparent: true,
        opacity: patch.name === "Wet" ? 0.45 : 0.82,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(patch.x, heightAt(patch.x, patch.z) + SURFACE_LIFT + 0.03, patch.z);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    object.add(mesh);
  }
}

function addStreetlight(
  object: THREE.Group,
  colliders: Collider[],
  x: number,
  z: number,
  towardX: number,
  towardZ: number,
) {
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x8a9098, roughness: 0.45, metalness: 0.55 });
  const armMat = new THREE.MeshStandardMaterial({ color: 0x7a8088, roughness: 0.4, metalness: 0.6 });
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xfff0c8,
    emissive: 0xffd88a,
    emissiveIntensity: 2.4,
    roughness: 0.25,
  });
  // Pole on sidewalk / shoulder (≥1 m off asphalt); arm reaches over the lane.
  let px = x;
  let pz = z;
  const len0 = Math.hypot(towardX, towardZ) || 1;
  const awayX = -towardX / len0;
  const awayZ = -towardZ / len0;
  for (let attempt = 0; attempt < 12; attempt++) {
    const clear = nearestRoadClearance(px, pz);
    if (clear.d >= clear.half + 1.25) break;
    px += awayX * 1.1;
    pz += awayZ * 1.1;
  }
  {
    const clear = nearestRoadClearance(px, pz);
    if (clear.d < clear.half + 1.0) return;
  }

  const y0 = terrainHeightAt(px, pz);
  const len = Math.hypot(towardX, towardZ) || 1;
  const tx = towardX / len;
  const tz = towardZ / len;
  const yaw = Math.atan2(tx, tz);
  const armLen = 3.2;
  const poleH = 5.5;

  const rig = new THREE.Group();
  rig.position.set(px, y0, pz);
  // Only yaw the arm toward the road — never pitch/roll the pole.
  rig.rotation.set(0, yaw, 0);

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, poleH, 10), poleMat);
  pole.position.set(0, poleH * 0.5, 0);
  pole.rotation.set(0, 0, 0);
  rig.add(pole);

  // Horizontal arm reaching over the road (+Z in local space after yaw).
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, armLen), armMat);
  arm.position.set(0, poleH - 0.15, armLen * 0.5);
  arm.rotation.set(0, 0, 0);
  rig.add(arm);

  const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), armMat);
  elbow.position.set(0, poleH - 0.12, 0.05);
  rig.add(elbow);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.38), lampMat);
  head.position.set(0, poleH - 0.35, armLen - 0.1);
  rig.add(head);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), lampMat);
  bulb.position.set(0, poleH - 0.5, armLen - 0.1);
  bulb.userData.streetLamp = true;
  rig.add(bulb);
  head.userData.streetLamp = true;

  object.add(rig);
  colliders.push({ kind: "circle", x: px, z: pz, r: 0.3, soft: "solid" });
}

function addLamps(object: THREE.Group, colliders: Collider[]) {
  // Town streetlights along the main cross — poles on the grass, lamps over the road.
  for (let x = -180; x <= 180; x += 40) {
    for (const z of [-16, 16]) {
      addStreetlight(object, colliders, x, z, 0, -Math.sign(z));
    }
  }
  // Highway lamps outside the shoulder, arm reaching inward.
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    const r = 820 * (1 + 0.08 * Math.sin(a * 2));
    const x = Math.cos(a) * (r + 18);
    const z = Math.sin(a) * (r + 18);
    addStreetlight(object, colliders, x, z, -Math.cos(a), -Math.sin(a));
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
    const y0 = heightAt(ox, oz);
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.07, 1.7, 6),
      new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.5 }),
    );
    pole.position.set(ox, y0 + 0.85, oz);
    const top = new THREE.Mesh(
      new THREE.ConeGeometry(1.15, 0.38, 8),
      new THREE.MeshStandardMaterial({ color, roughness: 0.6 }),
    );
    top.position.set(ox, y0 + 1.75, oz);
    object.add(pole, top);
  });
}

function addMountains(object: THREE.Group) {
  const rock = new THREE.MeshStandardMaterial({ color: 0x7d6c5e, roughness: 0.95 });
  const snow = new THREE.MeshStandardMaterial({ color: 0xf3eee6, roughness: 0.75 });
  const leaf = new THREE.MeshStandardMaterial({ color: 0x2a6a30, roughness: 0.9 });
  const trunk = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.92 });
  // Mountain ring around the original core map (not the outer speed-track rim).
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2 + 0.12;
    const r = INNER_RIM + 40 + (i % 4) * 35;
    const h = 100 + (i % 5) * 34;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(52 + (i % 3) * 22, h, 6), i % 3 === 0 ? snow : rock);
    cone.position.set(Math.cos(a) * r, h * 0.28, Math.sin(a) * r);
    object.add(cone);
  }
  // Thick forest belt around the core so the old edge still reads as nature.
  for (let i = 0; i < 120; i++) {
    const a = (i / 120) * Math.PI * 2;
    const r = INNER_RIM - 20 + (i % 5) * 12;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const s = 1.1 + (i % 4) * 0.25;
    const y = heightAt(x, z);
    const bole = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 2.6, 6), trunk);
    bole.position.set(x, y + 1.3 * s, z);
    bole.scale.setScalar(s);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(1.5, 3.2, 7), leaf);
    crown.position.set(x, y + 3.1 * s, z);
    crown.scale.setScalar(s);
    object.add(bole, crown);
  }
}

function addClouds(object: THREE.Group) {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xfff8f2,
    emissive: 0xfff1e2,
    emissiveIntensity: 0.08,
    roughness: 1,
    depthWrite: false,
  });
  const rand = mulberry32(3);
  for (let i = 0; i < 10; i++) {
    const cloud = new THREE.Group();
    const puff = 3 + Math.floor(rand() * 2);
    for (let p = 0; p < puff; p++) {
      const s = 6 + rand() * 8;
      const ball = new THREE.Mesh(new THREE.SphereGeometry(s, 8, 6), mat);
      ball.position.set((rand() - 0.5) * 20, rand() * 3, (rand() - 0.5) * 10);
      cloud.add(ball);
    }
    const ang = rand() * Math.PI * 2;
    const dist = 350 + rand() * 550;
    cloud.position.set(Math.cos(ang) * dist, 140 + rand() * 40, Math.sin(ang) * dist);
    object.add(cloud);
  }
}

/** Continuous sidewalk/curb ribbon offset to one side of a path. */
function edgeStripGeometry(path: PathDef, side: 1 | -1, stripWidth: number, yLift: number) {
  const samples = path.closed ? 140 : 90;
  const pts = samplePath(path, samples);
  if (pts.length < 2) return null;
  const half = path.width / 2;
  // Outer edge of pavement → outward strip sitting on the ground.
  const inner = half + 0.05;
  const outer = half + stripWidth;
  // Match ribbonGeometry: atGrade stays on terrain; never blur across deck jumps.
  const ys = pts.map((p) => {
    const nx = -p.tz * side;
    const nz = p.tx * side;
    const mx = p.x + nx * ((inner + outer) * 0.5);
    const mz = p.z + nz * ((inner + outer) * 0.5);
    return (path.atGrade ? terrainHeightAt(mx, mz) : heightAt(mx, mz)) + yLift;
  });
  {
    const src = ys.slice();
    for (let i = 0; i < ys.length; i++) {
      const i0 = path.closed ? (i - 1 + ys.length) % ys.length : Math.max(0, i - 1);
      const i1 = path.closed ? (i + 1) % ys.length : Math.min(ys.length - 1, i + 1);
      const leftOk = Math.abs(src[i] - src[i0]) < 1.2;
      const rightOk = Math.abs(src[i] - src[i1]) < 1.2;
      if (!leftOk && !rightOk) continue;
      const w0 = leftOk ? 0.15 : 0;
      const w1 = rightOk ? 0.15 : 0;
      const w = 1 - w0 - w1;
      ys[i] = src[i0] * w0 + src[i] * w + src[i1] * w1;
    }
  }
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  let dist = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const nx = -p.tz * side;
    const nz = p.tx * side;
    const y = ys[i];
    pos.push(p.x + nx * inner, y, p.z + nz * inner, p.x + nx * outer, y, p.z + nz * outer);
    if (i > 0) dist += Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z);
    uv.push(0, dist / 8, 1, dist / 8);
    if (i > 0) {
      const a = (i - 1) * 2;
      const b = a + 1;
      const c = i * 2;
      const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  if (path.closed && pts.length > 2) {
    pos[pos.length - 5] = pos[1];
    pos[pos.length - 2] = pos[4];
    const a = (pts.length - 1) * 2;
    idx.push(a, 0, a + 1, a + 1, 0, 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** Zebra crosswalk flat on the asphalt, exactly road-width (inset slightly). */
function addCrosswalk(
  object: THREE.Group,
  cx: number,
  cz: number,
  /** Radians: 0 = bars run east-west (crossing N–S traffic). */
  yaw: number,
  roadWidth: number,
) {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xf4f4f4,
    roughness: 0.78,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });
  const barLen = roadWidth - 1.2; // stay inside pavement edges
  const barW = 0.48;
  const gap = 0.55;
  const bars = 6;
  const depth = bars * gap;
  const y = heightAt(cx, cz) + SURFACE_LIFT + 0.02;
  const group = new THREE.Group();
  group.position.set(cx, y, cz);
  group.rotation.set(0, yaw, 0);
  for (let i = 0; i < bars; i++) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(barLen, 0.03, barW), mat);
    stripe.position.set(0, 0, -depth * 0.5 + gap * 0.5 + i * gap);
    group.add(stripe);
  }
  object.add(group);
}

function addCrosswalks(object: THREE.Group) {
  // Main town cross — one zebra on each leg, on the road only.
  const w = 14;
  addCrosswalk(object, 0, 14, 0, w); // north leg (cross N–S traffic)
  addCrosswalk(object, 0, -14, 0, w); // south
  addCrosswalk(object, 14, 0, Math.PI / 2, w); // east
  addCrosswalk(object, -14, 0, Math.PI / 2, w); // west
  // Ring-road crossings near the cross tips.
  addCrosswalk(object, 0, 40, 0, w);
  addCrosswalk(object, 0, -40, 0, w);
  addCrosswalk(object, 40, 0, Math.PI / 2, w);
  addCrosswalk(object, -40, 0, Math.PI / 2, w);
}

function addCurbsAndRails(object: THREE.Group) {
  const curbMat = new THREE.MeshStandardMaterial({
    color: 0xb8b4aa,
    roughness: 0.85,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const railMat = new THREE.MeshStandardMaterial({ color: 0x8a9098, metalness: 0.55, roughness: 0.4 });

  // Continuous sidewalk strips along both sides of the town cross (no gaps / floaters).
  const townPaths = PATHS.filter((p) => p.grip >= 0.85 && !p.closed && p.width >= 12);
  for (const path of townPaths) {
    // Skip the short lake spur for sidewalks — only the main cross arms.
    const span = Math.hypot(path.points[0][0] - path.points[path.points.length - 1][0], path.points[0][1] - path.points[path.points.length - 1][1]);
    if (span < 500) continue;
    for (const side of [1, -1] as const) {
      const geo = edgeStripGeometry(path, side, 1.35, SURFACE_LIFT + 0.04);
      if (!geo) continue;
      const mesh = new THREE.Mesh(geo, curbMat);
      mesh.receiveShadow = true;
      object.add(mesh);
      // Slight curb face so the strip reads as raised concrete, still on the ground.
      const face = edgeStripGeometry(path, side, 0.18, SURFACE_LIFT + 0.1);
      if (face) object.add(new THREE.Mesh(face, curbMat));
    }
  }

  // Guardrails on outer highway samples — posts stay vertical.
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const bulge = 1 + 0.08 * Math.sin(a * 2);
    const r = 820 * bulge + 16;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const y = heightAt(x, z);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.12), railMat);
    post.position.set(x, y + 0.45, z);
    post.rotation.set(0, 0, 0);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 28), railMat);
    rail.position.set(x, y + 0.7, z);
    rail.rotation.set(0, -a, 0);
    object.add(post, rail);
  }
}
