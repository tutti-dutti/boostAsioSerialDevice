/**
 * WORLD-BUILD visuals: forests, trail props, mud park, speed track, skyway,
 * restaurants, car wash. Heavy use of InstancedMesh for performance.
 */
import * as THREE from "three";
import { loadCarModel } from "./car";
import { carById } from "./garage";
import {
  INNER_RIM,
  SURFACE_LIFT,
  WORLD_HALF,
  heightAt,
  nearestRoadClearance,
  terrainHeightAt,
  type PathDef,
} from "./mapData";
import {
  DEALERSHIP,
  FORESTS,
  LANDMARKS,
  MUD_PARK,
  SKYWAY,
  SPEED_TRACK,
  TRAILS,
  skywayPaths,
  speedTrackPaths,
  type TrailDef,
} from "./mapZones";
import type { Collider } from "./sim";

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clearOfRoads(x: number, z: number, pad: number) {
  const n = nearestRoadClearance(x, z);
  return n.d > n.half + pad;
}

/** JOB 1 — dense instanced forests (pines, leafy, bushes, logs, boulders). */
export function addGiantForests(object: THREE.Group, colliders: Collider[]) {
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.32, 3.2, 6);
  const pineGeo = new THREE.ConeGeometry(1.6, 4.2, 7);
  const pine2Geo = new THREE.ConeGeometry(1.1, 2.4, 7);
  const leafGeo = new THREE.SphereGeometry(1.5, 8, 6);
  const bushGeo = new THREE.SphereGeometry(0.75, 7, 5);
  const rockGeo = new THREE.DodecahedronGeometry(0.85, 0);
  const logGeo = new THREE.CylinderGeometry(0.28, 0.32, 3.2, 8);

  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.92 });
  const pineMat = new THREE.MeshStandardMaterial({ color: 0x1f5a28, roughness: 0.88 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3a8a3a, roughness: 0.85 });
  const bushMat = new THREE.MeshStandardMaterial({ color: 0x3f8a3a, roughness: 0.9 });
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x7a7268, roughness: 0.95 });
  const logMat = new THREE.MeshStandardMaterial({ color: 0x4a3220, roughness: 0.94 });

  for (const forest of FORESTS) {
    const rand = mulberry32(forest.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0));
    const count = Math.floor(420 * forest.density);
    type Spot = { x: number; z: number; s: number; kind: number };
    const spots: Spot[] = [];
    let guard = 0;
    while (spots.length < count && guard < count * 8) {
      guard += 1;
      const a = rand() * Math.PI * 2;
      const d = Math.sqrt(rand()) * forest.r;
      const x = forest.x + Math.cos(a) * d;
      const z = forest.z + Math.sin(a) * d;
      if (Math.abs(x) > WORLD_HALF - 40 || Math.abs(z) > WORLD_HALF - 40) continue;
      // Keep trees ≥5 m from any road edge; never on elevated decks.
      if (!clearOfRoads(x, z, 5)) continue;
      if (Math.hypot(x, z) > SKYWAY.radius - 60 && Math.hypot(x, z) < SKYWAY.radius + 40) continue;
      spots.push({ x, z, s: 0.75 + rand() * 1.1, kind: Math.floor(rand() * 10) });
    }

    // East pine plain: mostly tall pines + a clearing in the middle.
    const pineBias = forest.id === "pine-east-plain";
    const pines = spots.filter((s) => {
      if (pineBias && Math.hypot(s.x - forest.x, s.z - forest.z) < 38) return false; // clearing
      return pineBias ? s.kind < 7 : s.kind < 4;
    });
    const leafy = pineBias ? [] : spots.filter((s) => s.kind >= 4 && s.kind < 7);
    const bushes = spots.filter((s) => s.kind === 7 || (pineBias && s.kind === 8));
    const rocks = spots.filter((s) => (!pineBias && s.kind === 8) || (pineBias && s.kind === 9 && s.s > 1));
    const logs = spots.filter((s) => s.kind === 9);
    const dummy = new THREE.Object3D();

    if (pines.length) {
      const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, pines.length);
      const tops = new THREE.InstancedMesh(pineGeo, pineMat, pines.length);
      const tops2 = new THREE.InstancedMesh(pine2Geo, pineMat, pines.length);
      pines.forEach((p, i) => {
        const y = terrainHeightAt(p.x, p.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(p.s, p.s * 1.15, p.s);
        dummy.position.set(p.x, y + 1.6 * p.s, p.z);
        dummy.updateMatrix();
        trunks.setMatrixAt(i, dummy.matrix);
        dummy.position.set(p.x, y + 3.6 * p.s, p.z);
        dummy.updateMatrix();
        tops.setMatrixAt(i, dummy.matrix);
        dummy.position.set(p.x, y + 5.2 * p.s, p.z);
        dummy.scale.set(p.s * 0.85, p.s, p.s * 0.85);
        dummy.updateMatrix();
        tops2.setMatrixAt(i, dummy.matrix);
        colliders.push({ kind: "circle", x: p.x, z: p.z, r: 0.55 * p.s, soft: "solid" });
      });
      object.add(trunks, tops, tops2);
    }
    if (leafy.length) {
      const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, leafy.length);
      const crowns = new THREE.InstancedMesh(leafGeo, leafMat, leafy.length);
      leafy.forEach((p, i) => {
        const y = terrainHeightAt(p.x, p.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(p.s * 0.9, p.s, p.s * 0.9);
        dummy.position.set(p.x, y + 1.5 * p.s, p.z);
        dummy.updateMatrix();
        trunks.setMatrixAt(i, dummy.matrix);
        dummy.scale.set(p.s * 1.3, p.s * 1.1, p.s * 1.3);
        dummy.position.set(p.x, y + 3.4 * p.s, p.z);
        dummy.updateMatrix();
        crowns.setMatrixAt(i, dummy.matrix);
        colliders.push({ kind: "circle", x: p.x, z: p.z, r: 0.5 * p.s, soft: "solid" });
      });
      object.add(trunks, crowns);
    }
    if (bushes.length) {
      const mesh = new THREE.InstancedMesh(bushGeo, bushMat, bushes.length);
      bushes.forEach((p, i) => {
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(p.s * 1.2, p.s * 0.8, p.s * 1.2);
        dummy.position.set(p.x, terrainHeightAt(p.x, p.z) + 0.4 * p.s, p.z);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        colliders.push({ kind: "circle", x: p.x, z: p.z, r: 0.55 * p.s, soft: "shrub" });
      });
      object.add(mesh);
    }
    if (rocks.length) {
      const mesh = new THREE.InstancedMesh(rockGeo, rockMat, rocks.length);
      rocks.forEach((p, i) => {
        const big = p.s >= 1.15;
        const scale = big ? p.s * 1.8 : p.s * 0.85;
        dummy.scale.set(scale, scale * (big ? 0.85 : 0.6), scale);
        dummy.rotation.set(rand() * 1.2, rand() * 6, rand() * 0.5);
        dummy.position.set(p.x, terrainHeightAt(p.x, p.z) + 0.35 * scale, p.z);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        colliders.push({
          kind: "circle",
          x: p.x,
          z: p.z,
          r: big ? 0.95 * scale : 0.4 * p.s,
          soft: big ? "solid" : "rock",
        });
      });
      object.add(mesh);
    }
    if (logs.length) {
      const mesh = new THREE.InstancedMesh(logGeo, logMat, logs.length);
      logs.forEach((p, i) => {
        dummy.scale.set(p.s, p.s, p.s);
        dummy.rotation.set(0, rand() * Math.PI, Math.PI / 2);
        dummy.position.set(p.x, terrainHeightAt(p.x, p.z) + 0.28 * p.s, p.z);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        colliders.push({ kind: "circle", x: p.x, z: p.z, r: 0.7 * p.s, soft: "solid" });
      });
      object.add(mesh);
    }

  }
}

const GRADE_COLOR: Record<string, string> = {
  easy: "#3ecf5a",
  medium: "#3a7cff",
  hard: "#1a1a1a",
};

const GRADE_LABEL: Record<string, string> = {
  easy: "EASY",
  medium: "MEDIUM",
  hard: "HARD",
};

function labelTexture(text: string, bg: string, fg = "#ffffff", w = 512, h = 256) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d")!;
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.fillStyle = fg;
  g.font = `bold ${Math.floor(h * 0.38)}px sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, w / 2, h / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** JOB 2 — trail posts + grade signs, ruts, hard-trail rocks. */
export function addTrailMarkers(object: THREE.Group, colliders: Collider[]) {
  const postMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.9 });
  const dirt = new THREE.MeshStandardMaterial({ color: 0x5a3a18, roughness: 0.95 });
  const rock = new THREE.MeshStandardMaterial({ color: 0x6a6560, roughness: 0.95 });
  const root = new THREE.MeshStandardMaterial({ color: 0x4a3020, roughness: 0.9 });
  for (const trail of TRAILS) {
    const pts = trail.points;
    for (let i = 0; i < pts.length; i += Math.max(1, Math.floor(pts.length / 4))) {
      const [x, z] = pts[i];
      const next = pts[Math.min(pts.length - 1, i + 1)];
      const dx = next[0] - x;
      const dz = next[1] - z;
      const len = Math.hypot(dx, dz) || 1;
      const nx = -dz / len;
      const nz = dx / len;
      const px = x + nx * (trail.width * 0.5 + 2.2);
      const pz = z + nz * (trail.width * 0.5 + 2.2);
      if (!clearOfRoads(px, pz, 1.5) && nearestRoadClearance(px, pz).d < 4) continue;
      const y = heightAt(px, pz);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.6, 6), postMat);
      post.position.set(px, y + 0.8, pz);
      object.add(post);
      colliders.push({ kind: "circle", x: px, z: pz, r: 0.25, soft: "solid" });
      if (i === 0 || i === pts.length - 1) {
        const fg = trail.grade === "hard" ? "#ffffff" : "#0a0a0a";
        const board = new THREE.Mesh(
          new THREE.PlaneGeometry(1.8, 0.9),
          new THREE.MeshStandardMaterial({
            map: labelTexture(GRADE_LABEL[trail.grade] ?? "TRAIL", GRADE_COLOR[trail.grade], fg, 256, 128),
            roughness: 0.55,
            side: THREE.DoubleSide,
          }),
        );
        board.position.set(px, y + 1.75, pz);
        board.rotation.y = Math.atan2(nx, nz);
        object.add(board);
      }
    }
    // Ruts / roots / bumps along the trail bed.
    for (let i = 1; i < pts.length - 1; i += 2) {
      const [x, z] = pts[i];
      const next = pts[i + 1];
      const yaw = Math.atan2(next[0] - x, next[1] - z);
      const y = heightAt(x, z);
      const rut = new THREE.Mesh(new THREE.BoxGeometry(trail.width * 0.35, 0.12, 4.5), dirt);
      rut.position.set(x + Math.cos(yaw) * 0.8, y + 0.04, z - Math.sin(yaw) * 0.8);
      rut.rotation.y = yaw;
      object.add(rut);
      if (i % 4 === 0) {
        const rootMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 2.2, 5), root);
        rootMesh.rotation.z = Math.PI / 2;
        rootMesh.rotation.y = yaw;
        rootMesh.position.set(x, y + 0.15, z);
        object.add(rootMesh);
      }
    }
    // Hard trails: big rocks that block low cars.
    if (trail.grade === "hard") {
      for (let i = 1; i < pts.length - 1; i++) {
        const [x, z] = pts[i];
        const s = 1.3 + (i % 3) * 0.35;
        const boulder = new THREE.Mesh(new THREE.DodecahedronGeometry(0.9, 0), rock);
        boulder.scale.set(s, s * 0.75, s);
        boulder.position.set(x + ((i % 2) * 2 - 1) * 1.2, heightAt(x, z) + 0.45 * s, z);
        object.add(boulder);
        colliders.push({ kind: "circle", x, z, r: 0.85 * s, soft: "solid" });
      }
    }
  }
}

/** JOB 3 — mud park props: jumps, gates, rock crawl, creek, entrance sign. */
export function addMudPark(object: THREE.Group, colliders: Collider[]) {
  const dirt = new THREE.MeshStandardMaterial({ color: 0x6a4a28, roughness: 0.95 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.9 });
  const rock = new THREE.MeshStandardMaterial({ color: 0x6a6560, roughness: 0.95 });
  const water = new THREE.MeshStandardMaterial({ color: 0x2a7a90, roughness: 0.2, metalness: 0.4, transparent: true, opacity: 0.75 });

  // Entrance sign (off to the side of the dirt entrance)
  const ex = MUD_PARK.entrance.x;
  const ez = MUD_PARK.entrance.z;
  const ey = heightAt(ex, ez);
  const postL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.2, 0.2), wood);
  postL.position.set(ex - 4.5, ey + 1.6, ez + 4);
  const postR = postL.clone();
  postR.position.set(ex - 4.5 + 7, ey + 1.6, ez + 4);
  const banner = new THREE.Mesh(
    new THREE.PlaneGeometry(7.2, 1.5),
    new THREE.MeshStandardMaterial({
      map: labelTexture("OFF-ROAD PARK", "#c45a12", "#ffffff", 512, 128),
      roughness: 0.5,
      side: THREE.DoubleSide,
      emissive: 0x3a1a00,
      emissiveIntensity: 0.25,
    }),
  );
  banner.position.set(ex - 1, ey + 3.1, ez + 4);
  object.add(postL, postR, banner);
  colliders.push({ kind: "circle", x: ex - 4.5, z: ez + 4, r: 0.35, soft: "solid" });
  colliders.push({ kind: "circle", x: ex + 2.5, z: ez + 4, r: 0.35, soft: "solid" });

  // Dirt jumps (ramps)
  const jumps = [
    { x: -200, z: -360, s: 1 },
    { x: -240, z: -390, s: 1.4 },
    { x: -270, z: -350, s: 1.8 },
    { x: -210, z: -420, s: 1.2 },
  ];
  for (const j of jumps) {
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(6 * j.s, 1.2 * j.s, 8 * j.s), dirt);
    const y = heightAt(j.x, j.z);
    ramp.position.set(j.x, y + 0.4 * j.s, j.z);
    ramp.rotation.x = -0.35;
    object.add(ramp);
  }

  // Rock crawl
  for (let i = 0; i < 12; i++) {
    const x = -300 + (i % 4) * 8;
    const z = -430 + Math.floor(i / 4) * 7;
    const s = 1.2 + (i % 3) * 0.4;
    const boulder = new THREE.Mesh(new THREE.DodecahedronGeometry(1.1, 0), rock);
    boulder.scale.set(s, s * 0.7, s);
    boulder.position.set(x, heightAt(x, z) + 0.5 * s, z);
    object.add(boulder);
    colliders.push({ kind: "circle", x, z, r: 0.9 * s, soft: "solid" });
  }

  // Shallow creek
  const creek = new THREE.Mesh(new THREE.PlaneGeometry(40, 8), water);
  creek.rotation.x = -Math.PI / 2;
  creek.position.set(-230, heightAt(-230, -445) + 0.05, -445);
  object.add(creek);
  // Soft wet patch already in ZONE_PATCHES; add a local wet feel via mud max handled in patches.

  // Start / finish gates
  for (const [gx, gz] of [
    [-180, -340],
    [-300, -400],
  ] as const) {
    const gy = heightAt(gx, gz);
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.25, 4.5, 0.25), wood);
      p.position.set(gx + s * 4, gy + 2.25, gz);
      object.add(p);
      colliders.push({ kind: "circle", x: gx + s * 4, z: gz, r: 0.35, soft: "solid" });
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.3, 0.3), wood);
    beam.position.set(gx, gy + 4.4, gz);
    object.add(beam);
  }
}

/** JOB 4 — speed track markers + launch ramp + signs. */
export function addSpeedTrackProps(object: THREE.Group, colliders: Collider[]) {
  const z = SPEED_TRACK.z0;
  const mat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.6 });
  const signMat = new THREE.MeshStandardMaterial({ color: 0xffcc33, emissive: 0x443300, emissiveIntensity: 0.35 });
  // Km markers
  for (let km = 0; km <= 8; km++) {
    const x = SPEED_TRACK.x0 + (km / 8) * (SPEED_TRACK.x1 - SPEED_TRACK.x0);
    const y = heightAt(x, z);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.2, 0.2), mat);
    post.position.set(x, y + 1.1, z - SPEED_TRACK.width * 0.5 - 2);
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 0.1), signMat);
    board.position.set(x, y + 2.4, z - SPEED_TRACK.width * 0.5 - 2);
    object.add(post, board);
    colliders.push({
      kind: "circle",
      x,
      z: z - SPEED_TRACK.width * 0.5 - 2,
      r: 0.3,
      soft: "solid",
    });
  }
  // Entrance sign near ramp
  const sx = 40;
  const sz = 1500;
  const sy = heightAt(sx, sz);
  const banner = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 1.6),
    new THREE.MeshStandardMaterial({
      map: labelTexture("SPEED TRACK", "#ffcc33", "#111111", 512, 128),
      roughness: 0.45,
      side: THREE.DoubleSide,
      emissive: 0x443300,
      emissiveIntensity: 0.3,
    }),
  );
  banner.position.set(sx, sy + 3.2, sz);
  object.add(banner);
  // Banked turnaround loops (visual outer banking).
  const asphalt = new THREE.MeshStandardMaterial({ color: 0x4a5058, roughness: 0.9 });
  for (const cx of [SPEED_TRACK.x0, SPEED_TRACK.x1]) {
    const cz = z;
    const r = 100;
    for (let i = 0; i < 24; i++) {
      const a0 = (i / 24) * Math.PI * 2;
      const a1 = ((i + 1) / 24) * Math.PI * 2;
      const mx = cx + Math.cos((a0 + a1) / 2) * r;
      const mz = cz + Math.sin((a0 + a1) / 2) * r;
      const yaw = Math.atan2(Math.cos((a0 + a1) / 2), Math.sin((a0 + a1) / 2));
      const slab = new THREE.Mesh(new THREE.BoxGeometry(SPEED_TRACK.width, 0.6, ((2 * Math.PI * r) / 24) + 1.2), asphalt);
      slab.position.set(mx, heightAt(mx, mz) + 0.8, mz);
      slab.rotation.order = "YXZ";
      slab.rotation.y = yaw;
      slab.rotation.z = 0.22; // bank toward the outside of the loop
      object.add(slab);
    }
  }
  // Launch ramp off to the side near the east end
  const rx = SPEED_TRACK.x1 - 200;
  const rz = z + 40;
  const dirt = new THREE.MeshStandardMaterial({ color: 0x8a6a40, roughness: 0.95 });
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(12, 2.5, 28), dirt);
  ramp.position.set(rx, heightAt(rx, rz) + 1.0, rz);
  ramp.rotation.x = -0.45;
  object.add(ramp);
  const landing = new THREE.Mesh(new THREE.CylinderGeometry(22, 22, 0.4, 20), dirt);
  landing.position.set(rx, heightAt(rx, rz + 50) + 0.15, rz + 55);
  object.add(landing);
}

/** JOB 6 — elevated skyway deck, pillars, barriers, lights, ramps. */
export function addSkyway(object: THREE.Group, colliders: Collider[]) {
  const { deck, ramps } = skywayPaths();
  const concrete = new THREE.MeshStandardMaterial({ color: 0x8a9098, roughness: 0.88 });
  const asphalt = new THREE.MeshStandardMaterial({ color: 0x4a5058, roughness: 0.9 });
  const barrier = new THREE.MeshStandardMaterial({ color: 0xb0b4b8, roughness: 0.7, metalness: 0.25 });
  const lamp = new THREE.MeshStandardMaterial({
    color: 0xfff0c8,
    emissive: 0xffd88a,
    emissiveIntensity: 1.8,
    roughness: 0.3,
  });

  const pts = deck.points;
  const n = pts.length;
  const h = SKYWAY.height;
  const thick = SKYWAY.deckThick;
  const half = SKYWAY.width / 2;
  const deckTop = h + thick * 0.5;

  // Thick concrete deck + barriers + pillars
  for (let i = 0; i < n; i++) {
    const [x1, z1] = pts[i];
    const [x2, z2] = pts[(i + 1) % n];
    const mx = (x1 + x2) * 0.5;
    const mz = (z1 + z2) * 0.5;
    const dx = x2 - x1;
    const dz = z2 - z1;
    const seg = Math.hypot(dx, dz);
    const yaw = Math.atan2(dx, dz);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(SKYWAY.width, thick, seg + 0.4), asphalt);
    slab.position.set(mx, deckTop, mz);
    slab.rotation.y = yaw;
    object.add(slab);
    // Underside lip so the deck reads as thick concrete, not a paper plane.
    const lip = new THREE.Mesh(new THREE.BoxGeometry(SKYWAY.width + 0.8, 0.35, seg + 0.4), concrete);
    lip.position.set(mx, h - 0.05, mz);
    lip.rotation.y = yaw;
    object.add(lip);

    for (const side of [-1, 1]) {
      const px = -Math.sin(yaw) * side * (half - 0.2);
      const pz = -Math.cos(yaw) * side * (half - 0.2);
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.6, seg + 0.4), barrier);
      wall.position.set(mx + px, deckTop + 0.95, mz + pz);
      wall.rotation.y = yaw;
      object.add(wall);
    }
    const center = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.0, seg + 0.3), barrier);
    center.position.set(mx, deckTop + 0.6, mz);
    center.rotation.y = yaw;
    object.add(center);

    // Pillars under the deck only — never on a road / ramp / bridge surface.
    if (i % 2 === 0 && clearOfRoads(mx, mz, 12)) {
      const ground = terrainHeightAt(mx, mz);
      const ph = h - ground;
      if (ph > 4) {
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(2.4, ph, 2.4), concrete);
        pillar.position.set(mx, ground + ph * 0.5, mz);
        object.add(pillar);
        colliders.push({ kind: "circle", x: mx, z: mz, r: 1.6, soft: "solid", maxY: h - 2 });
      }
    }
    if (i % 3 === 0) {
      const px = mx - Math.sin(yaw) * (half - 0.4);
      const pz = mz - Math.cos(yaw) * (half - 0.4);
      const light = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), lamp);
      light.position.set(px, deckTop + 2.2, pz);
      light.userData.streetLamp = true;
      object.add(light);
    }
  }

  // Big green SKYWAY signs beside each on-ramp (highway end, off the pavement).
  for (const ramp of ramps) {
    const hwy = ramp.points[ramp.points.length - 1];
    const prev = ramp.points[ramp.points.length - 2];
    const dx = hwy[0] - prev[0];
    const dz = hwy[1] - prev[1];
    const len = Math.hypot(dx, dz) || 1;
    const nx = -dz / len;
    const nz = dx / len;
    let sx = hwy[0] + nx * 14;
    let sz = hwy[1] + nz * 14;
    for (let attempt = 0; attempt < 10; attempt++) {
      const clear = nearestRoadClearance(sx, sz);
      if (clear.d >= clear.half + 3.5) break;
      sx += nx * 1.4;
      sz += nz * 1.4;
    }
    // No sign collider on asphalt — skip the post if we still can't clear the road.
    if (!clearOfRoads(sx, sz, 2.5)) continue;
    const y0 = terrainHeightAt(sx, sz);
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.16, 4.2, 8),
      new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.4, roughness: 0.5 }),
    );
    post.position.set(sx, y0 + 2.1, sz);
    object.add(post);
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;
    const g = canvas.getContext("2d")!;
    g.fillStyle = "#0b7a3a";
    g.fillRect(0, 0, 512, 256);
    g.fillStyle = "#ffffff";
    g.font = "bold 96px sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("SKYWAY", 256, 128);
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(6.5, 3.2),
      new THREE.MeshStandardMaterial({
        map: new THREE.CanvasTexture(canvas),
        roughness: 0.55,
        side: THREE.DoubleSide,
      }),
    );
    board.position.set(sx, y0 + 4.4, sz);
    board.rotation.y = Math.atan2(dx, dz);
    object.add(board);
    colliders.push({ kind: "circle", x: sx, z: sz, r: 0.35 });
  }

  // Long gentle ramp slabs with barriers + support pillars (no tall arch walls).
  for (const ramp of ramps) {
    const rp = ramp.points;
    // Skip the last few highway-toe segments so nothing sits at car height on the ring.
    for (let i = 0; i < rp.length - 3; i++) {
      const [x1, z1] = rp[i];
      const [x2, z2] = rp[i + 1];
      const t0 = i / (rp.length - 1);
      const t1 = (i + 1) / (rp.length - 1);
      // Smoothstep grade ≤ ~6% over rampLength.
      const s0 = t0 * t0 * (3 - 2 * t0);
      const s1 = t1 * t1 * (3 - 2 * t1);
      const g0 = terrainHeightAt(x1, z1);
      const g1 = terrainHeightAt(x2, z2);
      const y0 = deckTop * (1 - s0) + g0 * s0;
      const y1 = deckTop * (1 - s1) + g1 * s1;
      const mx = (x1 + x2) * 0.5;
      const mz = (z1 + z2) * 0.5;
      const my = (y0 + y1) * 0.5;
      const seg = Math.hypot(x2 - x1, z2 - z1);
      const yaw = Math.atan2(x2 - x1, z2 - z1);
      const pitch = Math.atan2(y1 - y0, seg);
      const thick = 1.0;
      // Top of slab ≈ drive height (my); never hang a low slab across a road.
      const slab = new THREE.Mesh(new THREE.BoxGeometry(ramp.width, thick, seg + 0.6), asphalt);
      slab.position.set(mx, my - thick * 0.45, mz);
      slab.rotation.order = "YXZ";
      slab.rotation.y = yaw;
      slab.rotation.x = -pitch;
      object.add(slab);
      for (const side of [-1, 1]) {
        const px = -Math.sin(yaw) * side * (ramp.width * 0.5 - 0.2);
        const pz = -Math.cos(yaw) * side * (ramp.width * 0.5 - 0.2);
        const wall = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.2, seg + 0.4), barrier);
        wall.position.set(mx + px, my + 0.7, mz + pz);
        wall.rotation.order = "YXZ";
        wall.rotation.y = yaw;
        wall.rotation.x = -pitch;
        object.add(wall);
      }
      // Support pillars beside the ramp (not under the driving lane), never on pavement.
      if (i % 2 === 0 && t0 < 0.72) {
        const ground = terrainHeightAt(mx, mz);
        const ph = my - 0.6 - ground;
        if (ph <= 5) continue;
        for (const side of [-1, 1]) {
          const px = mx - Math.sin(yaw) * side * (ramp.width * 0.55 + 1.2);
          const pz = mz - Math.cos(yaw) * side * (ramp.width * 0.55 + 1.2);
          if (!clearOfRoads(px, pz, 6)) continue;
          const g = terrainHeightAt(px, pz);
          const pillarH = my - 0.6 - g;
          if (pillarH <= 5) continue;
          const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.6, pillarH, 1.6), concrete);
          pillar.position.set(px, g + pillarH * 0.5, pz);
          object.add(pillar);
          colliders.push({ kind: "circle", x: px, z: pz, r: 1.1, soft: "solid", maxY: my - 2 });
        }
      }
    }
  }
}

/** JOB 5 — denser city blocks inside the highway (detailed facades). */
export function addCityBlocks(object: THREE.Group, colliders: Collider[]) {
  const colors = [0xe8dcc8, 0xd0d6e0, 0xc8b8a0, 0xb0c0d0, 0xe0e4e8, 0xd8c8b8, 0xb8c4b0, 0xd4c0b0];
  const glassMat = new THREE.MeshStandardMaterial({
    name: "window-glass",
    color: 0x88ccee,
    metalness: 0.6,
    roughness: 0.15,
    emissive: 0x224466,
    emissiveIntensity: 0.35,
  });
  glassMat.userData.nightWindow = true;
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x4a5048, roughness: 0.9 });
  const rand = mulberry32(99);

  const addDetailedBuilding = (x: number, z: number, w: number, h: number, d: number, color: number, glassy: boolean) => {
    const y0 = heightAt(x, z);
    const mat = glassy
      ? glassMat
      : new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0.05 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    body.position.set(x, y0 + h / 2, z);
    object.add(body);
    // Roof edge / parapet
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.7, 0.45, d + 0.7), roofMat);
    roof.position.set(x, y0 + h + 0.15, z);
    object.add(roof);
    // Window grid on each face (skip full-glass towers)
    if (!glassy) {
      const winMat = new THREE.MeshStandardMaterial({
        name: "window-glass",
        color: 0xa8d0e8,
        emissive: 0xffe0a0,
        emissiveIntensity: 0.15,
        metalness: 0.4,
        roughness: 0.2,
      });
      winMat.userData.nightWindow = true;
      const floors = Math.max(2, Math.floor(h / 3.2));
      const colsW = Math.max(2, Math.floor(w / 2.4));
      const colsD = Math.max(2, Math.floor(d / 2.4));
      for (let f = 0; f < floors; f++) {
        const wy = y0 + 1.4 + f * (h / floors);
        for (let c = 0; c < colsW; c++) {
          const wx = x - w * 0.5 + (c + 0.5) * (w / colsW);
          for (const side of [-1, 1]) {
            const pane = new THREE.Mesh(new THREE.BoxGeometry(Math.min(1.1, w / colsW - 0.35), 1.15, 0.08), winMat);
            pane.position.set(wx, wy, z + side * (d * 0.5 + 0.04));
            object.add(pane);
          }
        }
        for (let c = 0; c < colsD; c++) {
          const wz = z - d * 0.5 + (c + 0.5) * (d / colsD);
          for (const side of [-1, 1]) {
            const pane = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.15, Math.min(1.1, d / colsD - 0.35)), winMat);
            pane.position.set(x + side * (w * 0.5 + 0.04), wy, wz);
            object.add(pane);
          }
        }
      }
    }
    colliders.push({ kind: "box", x, z, hx: w / 2, hz: d / 2 });
  };

  for (let gx = -4; gx <= 4; gx++) {
    for (let gz = -4; gz <= 4; gz++) {
      if (gx === 0 || gz === 0) continue;
      const x = gx * 55 + (rand() - 0.5) * 8;
      const z = gz * 55 + (rand() - 0.5) * 8;
      if (Math.hypot(x, z) > 280) continue;
      if (!clearOfRoads(x, z, 10)) continue;
      const downtown = Math.hypot(x, z) < 120;
      const h = downtown ? 28 + rand() * 45 : 8 + rand() * 18;
      const w = 12 + rand() * 10;
      const d = 12 + rand() * 10;
      const glassy = downtown && rand() > 0.7;
      const color = colors[Math.floor(rand() * colors.length)];
      addDetailedBuilding(x, z, w, h, d, color, glassy);
    }
  }

  addDetailedBuilding(35, -35, 18, 90, 18, 0x88ccee, true);
  // Replace glass-only tower collider from helper — already added inside.

  const stadium = new THREE.Mesh(
    new THREE.CylinderGeometry(28, 32, 12, 20),
    new THREE.MeshStandardMaterial({ color: 0xc0c4c8, roughness: 0.8 }),
  );
  stadium.position.set(-90, heightAt(-90, -90) + 6, -90);
  object.add(stadium);
  colliders.push({ kind: "circle", x: -90, z: -90, r: 30, soft: "solid" });

  addDetailedBuilding(100, -80, 30, 14, 22, 0x6a7078, false);
}

/** JOB 7 — three restaurants on the busy E–W street. */
export function addRestaurants(object: THREE.Group, colliders: Collider[]) {
  const shops = [
    { id: "pizza", x: 70, z: 28, body: 0xc41e2a, accent: 0xffffff, sign: "PIZZA" },
    { id: "pho", x: 110, z: 28, body: 0xf2c14e, accent: 0xc41e2a, sign: "PHỞ" },
    { id: "banhmi", x: 150, z: 28, body: 0x3a8a3a, accent: 0xf2c14e, sign: "BÁNH MÌ" },
  ];
  for (const s of shops) {
    const y0 = heightAt(s.x, s.z);
    const building = new THREE.Mesh(
      new THREE.BoxGeometry(14, 7, 12),
      new THREE.MeshStandardMaterial({ color: s.body, roughness: 0.8 }),
    );
    building.position.set(s.x, y0 + 3.5, s.z);
    object.add(building);
    colliders.push({ kind: "box", x: s.x, z: s.z, hx: 7, hz: 6 });

    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 2.4),
      new THREE.MeshStandardMaterial({
        map: labelTexture(s.sign, `#${s.accent.toString(16).padStart(6, "0")}`, s.id === "pho" ? "#c41e2a" : "#ffffff", 512, 128),
        emissive: s.accent,
        emissiveIntensity: 0.35,
        roughness: 0.4,
        side: THREE.DoubleSide,
      }),
    );
    sign.position.set(s.x, y0 + 8.2, s.z + 6.2);
    object.add(sign);
    // Pizza slice / bowl accents on roof
    if (s.id === "pizza") {
      const slice = new THREE.Mesh(
        new THREE.ConeGeometry(1.6, 0.35, 3),
        new THREE.MeshStandardMaterial({ color: 0xffcc33, roughness: 0.6 }),
      );
      slice.rotation.x = Math.PI / 2;
      slice.position.set(s.x, y0 + 9.6, s.z);
      object.add(slice);
    }

    // Outdoor tables
    for (let i = 0; i < 3; i++) {
      const tx = s.x - 4 + i * 4;
      const tz = s.z + 9;
      const table = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.55, 0.1, 10),
        new THREE.MeshStandardMaterial({ color: 0xdddddd }),
      );
      table.position.set(tx, y0 + 0.75, tz);
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 0.7, 6),
        new THREE.MeshStandardMaterial({ color: 0x444444 }),
      );
      leg.position.set(tx, y0 + 0.35, tz);
      object.add(table, leg);
    }
    // Parking pad marker (visual only)
    const pad = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 10),
      new THREE.MeshStandardMaterial({ color: 0x5a6068, roughness: 0.95 }),
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(s.x, y0 + SURFACE_LIFT + 0.02, s.z + 16);
    object.add(pad);
  }

  // Pizza delivery hatch (not a plain orange box placeholder)
  const y0 = heightAt(70, 42);
  const paint = new THREE.MeshStandardMaterial({ color: 0xc41e2a, roughness: 0.55, metalness: 0.15 });
  const glassM = new THREE.MeshStandardMaterial({
    color: 0x223344,
    roughness: 0.2,
    metalness: 0.3,
    transparent: true,
    opacity: 0.65,
  });
  const darkM = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 });
  const delivery = new THREE.Group();
  delivery.position.set(70, y0, 42);
  delivery.rotation.y = Math.PI * 0.15;
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 3.6), paint);
  body.position.y = 0.55;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.5, 1.4), paint);
  cabin.position.set(0, 1.05, -0.2);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 1.35), paint);
  roof.position.set(0, 1.32, -0.2);
  const ws = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.35, 0.06), glassM);
  ws.position.set(0, 1.05, 0.55);
  ws.rotation.x = -0.35;
  const topper = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.35, 0.7),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }),
  );
  topper.position.set(0, 1.55, -0.15);
  for (const s of [-1, 1]) {
    for (const z of [1.1, -1.15]) {
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.22, 12), darkM);
      tire.rotation.z = Math.PI / 2;
      tire.position.set(s * 0.78, 0.28, z);
      delivery.add(tire);
    }
  }
  delivery.add(body, cabin, roof, ws, topper);
  object.add(delivery);

  // Phở lanterns
  const lanternMat = new THREE.MeshStandardMaterial({
    color: 0xff6644,
    emissive: 0xff4422,
    emissiveIntensity: 0.8,
  });
  for (let i = 0; i < 5; i++) {
    const lx = 105 + i * 2.2;
    const lz = 36;
    const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), lanternMat);
    lantern.position.set(lx, heightAt(lx, lz) + 3.2, lz);
    object.add(lantern);
  }
}

/** JOB 8b — car dealership / garage showroom with driveway onto the EW road. */
export function addDealership(object: THREE.Group, colliders: Collider[]) {
  const dx = DEALERSHIP.x;
  const dz = DEALERSHIP.z;
  const y0 = terrainHeightAt(dx, dz);
  const glass = new THREE.MeshStandardMaterial({
    color: 0xa8d4ee,
    roughness: 0.12,
    metalness: 0.35,
    transparent: true,
    opacity: 0.55,
  });
  const frame = new THREE.MeshStandardMaterial({ color: 0xd8dce0, roughness: 0.45, metalness: 0.55 });
  const asphalt = new THREE.MeshStandardMaterial({ color: 0x4a5058, roughness: 0.92 });

  // Floor pad inside showroom
  const floor = new THREE.Mesh(new THREE.BoxGeometry(22, 0.25, 16), frame);
  floor.position.set(dx, y0 + 0.12, dz);
  object.add(floor);

  // Glass walls (open south for doors)
  const wallH = 6.5;
  for (const [wx, wz, ww, wd] of [
    [dx, dz + 7.5, 22, 0.35], // north
    [dx - 10.8, dz, 0.35, 15], // west
    [dx + 10.8, dz, 0.35, 15], // east
  ] as const) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(ww, wallH, wd), glass);
    wall.position.set(wx, y0 + wallH / 2, wz);
    object.add(wall);
  }
  // South door pillars (gap in the middle to drive out)
  for (const side of [-1, 1]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(5.5, wallH, 0.4), glass);
    pillar.position.set(dx + side * 7.5, y0 + wallH / 2, dz - 7.5);
    object.add(pillar);
    colliders.push({ kind: "box", x: dx + side * 7.5, z: dz - 7.5, hx: 2.8, hz: 0.35 });
  }
  colliders.push({ kind: "box", x: dx, z: dz + 7.5, hx: 11, hz: 0.4 });
  colliders.push({ kind: "box", x: dx - 10.8, z: dz, hx: 0.4, hz: 7.5 });
  colliders.push({ kind: "box", x: dx + 10.8, z: dz, hx: 0.4, hz: 7.5 });

  // Roof + GARAGE sign (two planes so it reads correctly from road and from behind)
  const roof = new THREE.Mesh(new THREE.BoxGeometry(24, 0.45, 18), frame);
  roof.position.set(dx, y0 + wallH + 0.2, dz);
  object.add(roof);
  const signCanvas = document.createElement("canvas");
  signCanvas.width = 512;
  signCanvas.height = 128;
  const sg = signCanvas.getContext("2d")!;
  sg.fillStyle = "#ffcc33";
  sg.fillRect(0, 0, 512, 128);
  sg.fillStyle = "#111111";
  sg.font = "bold 72px sans-serif";
  sg.textAlign = "center";
  sg.textBaseline = "middle";
  sg.fillText("GARAGE", 256, 68);
  const signTex = new THREE.CanvasTexture(signCanvas);
  const signMat = () =>
    new THREE.MeshStandardMaterial({
      map: signTex,
      emissive: 0xaa7700,
      emissiveIntensity: 0.35,
      roughness: 0.45,
      side: THREE.FrontSide,
    });
  const signY = y0 + wallH + 1.4;
  const signZ = dz - 2.2;
  // Front faces the road (south / −Z). PlaneGeometry faces +Z by default → yaw π.
  const signFront = new THREE.Mesh(new THREE.PlaneGeometry(12, 2.2), signMat());
  signFront.position.set(dx, signY, signZ - 0.02);
  signFront.rotation.y = Math.PI;
  // Back faces the showroom / north so it isn't mirrored from either side.
  const signBack = new THREE.Mesh(new THREE.PlaneGeometry(12, 2.2), signMat());
  signBack.position.set(dx, signY, signZ + 0.02);
  signBack.rotation.y = 0;
  object.add(signFront, signBack);

  // Real garage models on the display floor (async — pop in when GLBs load).
  void loadDealershipDisplayCars(object, dx, dz, y0 + 0.12);

  // Flags out front
  for (const side of [-1, 1]) {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.1, 7, 8),
      new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.5, roughness: 0.4 }),
    );
    const fx = dx + side * 14;
    const fz = dz - 10;
    pole.position.set(fx, y0 + 3.5, fz);
    const flag = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 1.2, 0.08),
      new THREE.MeshStandardMaterial({ color: side < 0 ? 0xff3355 : 0x3366ff, roughness: 0.55 }),
    );
    flag.position.set(fx + side * 1.1, y0 + 6.2, fz);
    object.add(pole, flag);
    colliders.push({ kind: "circle", x: fx, z: fz, r: 0.25 });
  }

  // Driveway apron onto the main EW road
  const driveLen = DEALERSHIP.drivewayZ0 - DEALERSHIP.drivewayZ1 + 4;
  const drive = new THREE.Mesh(new THREE.BoxGeometry(10, 0.18, driveLen), asphalt);
  drive.position.set(dx, y0 + SURFACE_LIFT + 0.04, (DEALERSHIP.drivewayZ0 + DEALERSHIP.drivewayZ1) / 2);
  object.add(drive);
}

/** Park real garage GLBs inside the showroom at display angles. */
async function loadDealershipDisplayCars(
  object: THREE.Group,
  dx: number,
  dz: number,
  floorY: number,
) {
  const spots = [
    { id: "lambchop-minotaur", x: -6.2, z: 1.2, yaw: 0.55 },
    { id: "baguetti-cerberus", x: 0.2, z: 2.8, yaw: -0.35 },
    { id: "king-egg-kraken", x: 6.0, z: 1.0, yaw: 0.85 },
  ];
  for (const spot of spots) {
    const entry = carById(spot.id);
    try {
      const visual = await loadCarModel(entry.model, entry.look);
      visual.root.position.set(dx + spot.x, floorY + visual.ride, dz + spot.z);
      visual.root.rotation.y = spot.yaw;
      visual.root.name = `dealership-display-${spot.id}`;
      object.add(visual.root);
    } catch (err) {
      console.error(`Dealership display failed for ${spot.id}`, err);
    }
  }
}

/** JOB 8 — car wash building. */
export function addCarWash(object: THREE.Group, colliders: Collider[]) {
  const lm = LANDMARKS.find((l) => l.id === "wash")!;
  const y0 = heightAt(lm.x, lm.z);
  const building = new THREE.Mesh(
    new THREE.BoxGeometry(12, 6, 18),
    new THREE.MeshStandardMaterial({ color: 0x3a8ecf, roughness: 0.7 }),
  );
  building.position.set(lm.x, y0 + 3, lm.z);
  object.add(building);
  // Open tunnel feel — arch
  const arch = new THREE.Mesh(
    new THREE.BoxGeometry(8, 4.5, 16),
    new THREE.MeshStandardMaterial({ color: 0x222830, roughness: 0.9, transparent: true, opacity: 0.35 }),
  );
  arch.position.set(lm.x, y0 + 2.4, lm.z);
  object.add(arch);
  // Brushes
  const brushMat = new THREE.MeshStandardMaterial({ color: 0x66ddaa, roughness: 0.6 });
  for (const z of [-4, 0, 4]) {
    const brush = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 3.5, 10), brushMat);
    brush.position.set(lm.x, y0 + 2.2, lm.z + z);
    object.add(brush);
  }
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(8, 1.5, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x88e0ff, emissive: 0x226688, emissiveIntensity: 0.5 }),
  );
  sign.position.set(lm.x, y0 + 6.8, lm.z);
  object.add(sign);
  colliders.push({ kind: "box", x: lm.x - 6, z: lm.z, hx: 1, hz: 9 });
  colliders.push({ kind: "box", x: lm.x + 6, z: lm.z, hx: 1, hz: 9 });
}

/** Draw trail/speed/skyway ribbons into the world (caller supplies ribbon helper). */
export function extraRibbonPaths(): PathDef[] {
  return [
    ...TRAILS.map((t) => ({ points: t.points, width: t.width, grip: t.grip, highway: t.highway, closed: t.closed })),
    ...speedTrackPaths(),
  ];
}

export function trailList(): TrailDef[] {
  return TRAILS;
}

export { FORESTS, LANDMARKS, MUD_PARK, SPEED_TRACK, SKYWAY, INNER_RIM };
