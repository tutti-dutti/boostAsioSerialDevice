/**
 * WORLD-BUILD visuals: forests, trail props, mud park, speed track, skyway,
 * restaurants, car wash. Heavy use of InstancedMesh for performance.
 */
import * as THREE from "three";
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
      if (!clearOfRoads(x, z, 8)) continue;
      spots.push({ x, z, s: 0.75 + rand() * 1.1, kind: Math.floor(rand() * 10) });
    }

    const pines = spots.filter((s) => s.kind < 4);
    const leafy = spots.filter((s) => s.kind >= 4 && s.kind < 7);
    const bushes = spots.filter((s) => s.kind === 7);
    const rocks = spots.filter((s) => s.kind === 8);
    const logs = spots.filter((s) => s.kind === 9);
    const dummy = new THREE.Object3D();

    if (pines.length) {
      const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, pines.length);
      const tops = new THREE.InstancedMesh(pineGeo, pineMat, pines.length);
      const tops2 = new THREE.InstancedMesh(pine2Geo, pineMat, pines.length);
      pines.forEach((p, i) => {
        const y = heightAt(p.x, p.z);
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
        const y = heightAt(p.x, p.z);
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
        dummy.position.set(p.x, heightAt(p.x, p.z) + 0.4 * p.s, p.z);
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
        dummy.position.set(p.x, heightAt(p.x, p.z) + 0.35 * scale, p.z);
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
        dummy.position.set(p.x, heightAt(p.x, p.z) + 0.28 * p.s, p.z);
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

/** JOB 2 — trail posts + grade signs (off the trail edge). */
export function addTrailMarkers(object: THREE.Group, colliders: Collider[]) {
  const postMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.9 });
  const boardMat = (hex: string) =>
    new THREE.MeshStandardMaterial({ color: hex, roughness: 0.7, emissive: hex, emissiveIntensity: 0.15 });
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
        const board = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 0.08), boardMat(GRADE_COLOR[trail.grade]));
        board.position.set(px, y + 1.7, pz);
        board.rotation.y = Math.atan2(nx, nz);
        object.add(board);
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

  // Entrance sign
  const ex = MUD_PARK.entrance.x;
  const ez = MUD_PARK.entrance.z;
  const ey = heightAt(ex, ez);
  const postL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.2, 0.2), wood);
  postL.position.set(ex - 3, ey + 1.6, ez);
  const postR = postL.clone();
  postR.position.set(ex + 3, ey + 1.6, ez);
  const banner = new THREE.Mesh(
    new THREE.BoxGeometry(6.5, 1.2, 0.15),
    new THREE.MeshStandardMaterial({ color: 0xc45a12, emissive: 0x3a1a00, emissiveIntensity: 0.3 }),
  );
  banner.position.set(ex, ey + 3.0, ez);
  object.add(postL, postR, banner);
  colliders.push({ kind: "circle", x: ex - 3, z: ez, r: 0.35, soft: "solid" });
  colliders.push({ kind: "circle", x: ex + 3, z: ez, r: 0.35, soft: "solid" });

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
  const banner = new THREE.Mesh(new THREE.BoxGeometry(8, 1.4, 0.2), signMat);
  banner.position.set(sx, sy + 3.2, sz);
  object.add(banner);
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
  const { deck } = skywayPaths();
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
  const half = SKYWAY.width / 2;

  // Deck segments + pillars
  for (let i = 0; i < n; i++) {
    const [x1, z1] = pts[i];
    const [x2, z2] = pts[(i + 1) % n];
    const mx = (x1 + x2) * 0.5;
    const mz = (z1 + z2) * 0.5;
    const dx = x2 - x1;
    const dz = z2 - z1;
    const seg = Math.hypot(dx, dz);
    const yaw = Math.atan2(dx, dz);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(SKYWAY.width, 0.7, seg + 0.4), asphalt);
    slab.position.set(mx, h, mz);
    slab.rotation.y = yaw;
    object.add(slab);

    // Side barriers
    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.5, seg + 0.4), barrier);
      wall.position.set(mx + Math.cos(yaw) * side * (half - 0.2), h + 0.9, mz - Math.sin(yaw) * side * (half - 0.2));
      // offset perpendicular
      const px = -Math.sin(yaw) * side * (half - 0.15);
      const pz = -Math.cos(yaw) * side * (half - 0.15);
      wall.position.set(mx + px, h + 0.95, mz + pz);
      wall.rotation.y = yaw;
      object.add(wall);
    }
    // Center barrier
    const center = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.9, seg + 0.3), barrier);
    center.position.set(mx, h + 0.55, mz);
    center.rotation.y = yaw;
    object.add(center);

    // Pillars every ~segment (skip if on road)
    if (i % 2 === 0 && clearOfRoads(mx, mz, 10)) {
      const ground = terrainHeightAt(mx, mz);
      const ph = h - ground;
      if (ph > 4) {
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, ph, 8), concrete);
        pillar.position.set(mx, ground + ph * 0.5, mz);
        object.add(pillar);
        colliders.push({ kind: "circle", x: mx, z: mz, r: 1.5, soft: "solid", maxY: h - 2 });
      }
    }
    // Streetlights on outer barrier
    if (i % 3 === 0) {
      const px = mx - Math.sin(yaw) * (half - 0.4);
      const pz = mz - Math.cos(yaw) * (half - 0.4);
      const light = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), lamp);
      light.position.set(px, h + 2.2, pz);
      object.add(light);
    }
  }

  // Ramp meshes sloping from skyway height down to highway
  for (const ramp of skywayPaths().ramps) {
    const rp = ramp.points;
    for (let i = 0; i < rp.length - 1; i++) {
      const [x1, z1] = rp[i];
      const [x2, z2] = rp[i + 1];
      const t0 = i / (rp.length - 1);
      const t1 = (i + 1) / (rp.length - 1);
      const y0 = h * (1 - t0) + heightAt(x1, z1) * t0;
      const y1 = h * (1 - t1) + heightAt(x2, z2) * t1;
      const mx = (x1 + x2) * 0.5;
      const mz = (z1 + z2) * 0.5;
      const my = (y0 + y1) * 0.5;
      const seg = Math.hypot(x2 - x1, z2 - z1);
      const yaw = Math.atan2(x2 - x1, z2 - z1);
      const pitch = Math.atan2(y1 - y0, seg);
      const slab = new THREE.Mesh(new THREE.BoxGeometry(ramp.width, 0.6, seg + 0.5), asphalt);
      slab.position.set(mx, my, mz);
      slab.rotation.order = "YXZ";
      slab.rotation.y = yaw;
      slab.rotation.x = -pitch;
      object.add(slab);
    }
  }
}

/** JOB 5 — denser city blocks inside the highway (instanced buildings). */
export function addCityBlocks(object: THREE.Group, colliders: Collider[]) {
  const colors = [0xe8dcc8, 0xd0d6e0, 0xc8b8a0, 0xb0c0d0, 0xe0e4e8, 0xd8c8b8];
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x88ccee,
    metalness: 0.6,
    roughness: 0.15,
    emissive: 0x224466,
    emissiveIntensity: 0.35,
  });
  const rand = mulberry32(99);
  // Grid of blocks inside ~r 280, skipping roads (near ± axes and ring).
  for (let gx = -4; gx <= 4; gx++) {
    for (let gz = -4; gz <= 4; gz++) {
      if (gx === 0 || gz === 0) continue; // keep cross clear
      const x = gx * 55 + (rand() - 0.5) * 8;
      const z = gz * 55 + (rand() - 0.5) * 8;
      if (Math.hypot(x, z) > 280) continue;
      if (!clearOfRoads(x, z, 10)) continue;
      const downtown = Math.hypot(x, z) < 120;
      const h = downtown ? 28 + rand() * 45 : 8 + rand() * 18;
      const w = 12 + rand() * 10;
      const d = 12 + rand() * 10;
      const y0 = heightAt(x, z);
      const mat =
        downtown && rand() > 0.7
          ? glassMat
          : new THREE.MeshStandardMaterial({
              color: colors[Math.floor(rand() * colors.length)],
              roughness: 0.82,
            });
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      body.position.set(x, y0 + h / 2, z);
      object.add(body);
      colliders.push({ kind: "box", x, z, hx: w / 2, hz: d / 2 });
    }
  }
  // Landmarks: glass tower, stadium, parking garage
  const tower = new THREE.Mesh(new THREE.BoxGeometry(18, 90, 18), glassMat);
  tower.position.set(35, heightAt(35, -35) + 45, -35);
  object.add(tower);
  colliders.push({ kind: "box", x: 35, z: -35, hx: 9, hz: 9 });

  const stadium = new THREE.Mesh(
    new THREE.CylinderGeometry(28, 32, 12, 20),
    new THREE.MeshStandardMaterial({ color: 0xc0c4c8, roughness: 0.8 }),
  );
  stadium.position.set(-90, heightAt(-90, -90) + 6, -90);
  object.add(stadium);
  colliders.push({ kind: "circle", x: -90, z: -90, r: 30, soft: "solid" });

  const garage = new THREE.Mesh(
    new THREE.BoxGeometry(30, 14, 22),
    new THREE.MeshStandardMaterial({ color: 0x6a7078, roughness: 0.85 }),
  );
  garage.position.set(100, heightAt(100, -80) + 7, -80);
  object.add(garage);
  colliders.push({ kind: "box", x: 100, z: -80, hx: 15, hz: 11 });
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
      new THREE.BoxGeometry(10, 2.2, 0.4),
      new THREE.MeshStandardMaterial({
        color: s.accent,
        emissive: s.accent,
        emissiveIntensity: 0.55,
        roughness: 0.45,
      }),
    );
    sign.position.set(s.x, y0 + 8.2, s.z);
    object.add(sign);

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

  // Pizza delivery car (simple)
  const y0 = heightAt(70, 42);
  const car = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 1.1, 4.2),
    new THREE.MeshStandardMaterial({ color: 0xff2222 }),
  );
  car.position.set(70, y0 + 0.7, 42);
  object.add(car);

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
