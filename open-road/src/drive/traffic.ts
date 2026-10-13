/**
 * Computer traffic on city / road / highway / skyway routes.
 * Caps near players (~400 m), everyday shapes, lights, gaps, bumps.
 */
import * as THREE from "three";
import {
  HIGHWAY,
  PATHS,
  RAMPS,
  carSurfaceHeight,
  heightAt,
  nearestRoadClearance,
  type PathDef,
} from "./mapData";
import { SKYWAY, skywayPaths } from "./mapZones";
import type { Car } from "./sim";

const SIM_RADIUS = 400;
const MAX_CARS = 36;
const GAP = 14;
const CITY_R = 380;
/** Minimum clearance past road edge for poles / lights (meters). */
const OFF_ROAD_PAD = 1.25;

export type TrafficDot = { x: number; z: number };

type Kind = "sedan" | "hatch" | "suv" | "pickup" | "van" | "bus" | "box";

type Route = {
  id: number;
  pts: { x: number; z: number }[];
  dist: number[];
  total: number;
  width: number;
  highway: boolean;
  skyway: boolean;
  city: boolean;
  closed: boolean;
  /** Posted-ish cruise mph for this route. */
  cruiseMph: number;
};

type TrafficCar = {
  route: Route;
  along: number;
  dir: 1 | -1;
  lane: number;
  /** Extra lateral offset toward shoulder when avoiding oncoming player (meters). */
  shoulder: number;
  x: number;
  z: number;
  yaw: number;
  speed: number;
  kind: Kind;
  mesh: THREE.Group;
  glow: THREE.Group;
  signal: THREE.Mesh;
  brakeLight: THREE.Mesh[];
  stunned: number;
  honkCd: number;
  turnSignal: number;
  waiting: number;
};

type Signal = {
  x: number;
  z: number;
  /** Seconds into cycle. */
  phase: number;
  cycle: number;
  mesh?: THREE.Group;
  /** Lamp materials: [NSred, NSyel, NSgrn, EWred, EWyel, EWgrn] */
  lamps?: THREE.MeshStandardMaterial[];
};

const COLORS = [
  0x3a6ea5, 0xc45c26, 0xd8d8d8, 0x2f8f4e, 0xe0b040, 0x5a5a5a, 0x8b3a4a, 0x2a4a6a, 0xf0f0e8, 0x6b4e31, 0x1f6f8b,
  0xb33a3a,
];

function mulberry(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function buildRoute(id: number, path: PathDef, opts: { skyway?: boolean; cruiseMph: number }): Route | null {
  const src = path.closed ? [...path.points, path.points[0]] : path.points;
  if (src.length < 2) return null;
  const pts: { x: number; z: number }[] = [];
  // Densify roughly every 12 m.
  for (let i = 0; i < src.length - 1; i++) {
    const [x1, z1] = src[i];
    const [x2, z2] = src[i + 1];
    const seg = Math.hypot(x2 - x1, z2 - z1);
    const n = Math.max(1, Math.ceil(seg / 12));
    for (let k = 0; k < n; k++) {
      const u = k / n;
      pts.push({ x: x1 + (x2 - x1) * u, z: z1 + (z2 - z1) * u });
    }
  }
  pts.push({ x: src[src.length - 1][0], z: src[src.length - 1][1] });
  const dist = [0];
  for (let i = 1; i < pts.length; i++) {
    dist.push(dist[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
  }
  const total = dist[dist.length - 1];
  if (total < 40) return null;
  const mid = pts[Math.floor(pts.length / 2)];
  const city = Math.hypot(mid.x, mid.z) < CITY_R;
  return {
    id,
    pts,
    dist,
    total,
    width: path.width,
    highway: !!path.highway || !!opts.skyway,
    skyway: !!opts.skyway,
    city,
    closed: !!path.closed,
    cruiseMph: opts.cruiseMph,
  };
}

function sampleRoute(route: Route, along: number): { x: number; z: number; yaw: number } {
  let a = along;
  if (route.closed) {
    a = ((a % route.total) + route.total) % route.total;
  } else {
    a = Math.max(0, Math.min(route.total - 0.01, a));
  }
  let i = 0;
  while (i < route.dist.length - 2 && route.dist[i + 1] < a) i++;
  const span = Math.max(1e-3, route.dist[i + 1] - route.dist[i]);
  const u = (a - route.dist[i]) / span;
  const x = route.pts[i].x + (route.pts[i + 1].x - route.pts[i].x) * u;
  const z = route.pts[i].z + (route.pts[i + 1].z - route.pts[i].z) * u;
  const yaw = Math.atan2(route.pts[i + 1].x - route.pts[i].x, route.pts[i + 1].z - route.pts[i].z);
  return { x, z, yaw };
}

function makeBody(kind: Kind, color: number): { mesh: THREE.Group; glow: THREE.Group; signal: THREE.Mesh; brakes: THREE.Mesh[] } {
  const mesh = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.15 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x334455, roughness: 0.25, metalness: 0.2, transparent: true, opacity: 0.7 });
  const dims: Record<Kind, { w: number; h: number; l: number; cabin: number }> = {
    sedan: { w: 1.75, h: 0.55, l: 4.2, cabin: 0.45 },
    hatch: { w: 1.65, h: 0.6, l: 3.6, cabin: 0.5 },
    suv: { w: 1.9, h: 0.75, l: 4.4, cabin: 0.65 },
    pickup: { w: 1.85, h: 0.7, l: 5.0, cabin: 0.55 },
    van: { w: 1.95, h: 1.1, l: 5.2, cabin: 0.9 },
    bus: { w: 2.4, h: 1.5, l: 9.5, cabin: 1.3 },
    box: { w: 2.2, h: 1.4, l: 6.5, cabin: 0.7 },
  };
  const d = dims[kind];
  const body = new THREE.Mesh(new THREE.BoxGeometry(d.w, d.h, d.l), paint);
  body.position.y = d.h * 0.55 + 0.28;
  mesh.add(body);
  if (kind === "pickup") {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(d.w * 0.9, d.h * 0.35, d.l * 0.42), dark);
    bed.position.set(0, 0.55, -d.l * 0.22);
    mesh.add(bed);
  }
  if (kind !== "pickup") {
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(d.w * 0.85, d.cabin, d.l * (kind === "bus" ? 0.7 : 0.45)), glass);
    cabin.position.set(0, d.h + d.cabin * 0.55, kind === "bus" ? 0 : 0.15);
    mesh.add(cabin);
  } else {
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(d.w * 0.85, d.cabin, d.l * 0.32), glass);
    cabin.position.set(0, d.h + 0.35, d.l * 0.22);
    mesh.add(cabin);
  }
  for (const sx of [-1, 1]) {
    for (const sz of kind === "bus" ? [-3.2, -1.1, 1.1, 3.2] : [-d.l * 0.32, d.l * 0.32]) {
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.26, 10), dark);
      tire.rotation.z = Math.PI / 2;
      tire.position.set(sx * (d.w * 0.48), 0.3, sz);
      mesh.add(tire);
    }
  }
  const glow = new THREE.Group();
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2c8 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2200 });
  const brakes: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.06), headMat);
    h.position.set(s * d.w * 0.35, 0.5, d.l * 0.5 - 0.05);
    glow.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.1, 0.06), tailMat);
    t.position.set(s * d.w * 0.35, 0.52, -d.l * 0.5 + 0.05);
    glow.add(t);
    brakes.push(t);
  }
  glow.visible = false;
  mesh.add(glow);
  const signal = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.12, 0.08),
    new THREE.MeshStandardMaterial({ color: 0xffaa00, emissive: 0xff8800, emissiveIntensity: 0 }),
  );
  signal.position.set(d.w * 0.45, 0.7, d.l * 0.35);
  mesh.add(signal);
  return { mesh, glow, signal, brakes };
}

export class TrafficSystem {
  root = new THREE.Group();
  cars: TrafficCar[] = [];
  routes: Route[] = [];
  signals: Signal[] = [];
  private rand = mulberry(0x7a1f1c);
  private audioCtx: AudioContext | null = null;
  private time = 0;

  constructor() {
    this.buildRoutes();
    this.buildSignals();
  }

  private buildRoutes() {
    let id = 0;
    for (const p of PATHS) {
      const r = buildRoute(id++, p, { cruiseMph: Math.hypot(p.points[0][0], p.points[0][1]) < CITY_R ? 95 : 115 });
      if (r) this.routes.push(r);
    }
    {
      const r = buildRoute(id++, HIGHWAY, { cruiseMph: 160 });
      if (r) this.routes.push(r);
    }
    for (const p of RAMPS) {
      const r = buildRoute(id++, p, { cruiseMph: 120 });
      if (r) this.routes.push(r);
    }
    const { deck, ramps } = skywayPaths();
    {
      const r = buildRoute(id++, deck, { skyway: true, cruiseMph: 175 });
      if (r) this.routes.push(r);
    }
    for (const p of ramps) {
      const r = buildRoute(id++, p, { skyway: true, cruiseMph: 140 });
      if (r) this.routes.push(r);
    }
  }

  private buildSignals() {
    // Major town crosses + a few highway merges get timed lights.
    const spots: [number, number][] = [
      [0, 0],
      [180, 0],
      [-180, 0],
      [0, 180],
      [0, -180],
      [70, 28],
      [-100, 0],
      [280, 0],
    ];
    for (const [x, z] of spots) {
      this.signals.push({ x, z, phase: this.rand() * 8, cycle: 8 + this.rand() * 4 });
    }
  }

  /** Push a point onto the sidewalk / corner — never leave a pole on asphalt. */
  private pushOffRoad(x: number, z: number, minPad = OFF_ROAD_PAD): { x: number; z: number } {
    let px = x;
    let pz = z;
    for (let attempt = 0; attempt < 12; attempt++) {
      const clear = nearestRoadClearance(px, pz);
      const need = clear.half + minPad;
      if (clear.d >= need) break;
      // Prefer the NE corner of the intersection, then fan outward.
      const ox = px - x || 1;
      const oz = pz - z || 1;
      const diag = Math.hypot(ox, oz) || 1;
      const push = need - clear.d + 0.6;
      px += (ox / diag) * push * 0.35 + push * 0.55;
      pz += (oz / diag) * push * 0.35 + push * 0.55;
    }
    // Absolute fallback: walk out on a diagonal until clear.
    for (let k = 0; k < 16; k++) {
      const clear = nearestRoadClearance(px, pz);
      if (clear.d >= clear.half + minPad) break;
      px += 1.2;
      pz += 1.2;
    }
    return { x: px, z: pz };
  }

  /**
   * Mast-arm signals: pole on the sidewalk/corner (≥1 m off pavement),
   * arm reaches out over the lane with G/Y/R lamps.
   */
  addSignalMeshes(scene: THREE.Scene) {
    const steel = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.55, metalness: 0.35 });
    for (const s of this.signals) {
      // Start NE of the intersection center, then force off the road.
      const corner = this.pushOffRoad(s.x + 8, s.z + 8, OFF_ROAD_PAD);
      const y0 = heightAt(corner.x, corner.z);
      const towardX = s.x - corner.x;
      const towardZ = s.z - corner.z;
      const yaw = Math.atan2(towardX, towardZ);
      const armLen = Math.min(7.5, Math.max(4.2, Math.hypot(towardX, towardZ) * 0.55));

      const g = new THREE.Group();
      g.position.set(corner.x, y0, corner.z);
      g.rotation.y = yaw;

      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 5.4, 8), steel);
      pole.position.y = 2.7;
      g.add(pole);

      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, armLen), steel);
      arm.position.set(0, 5.15, armLen * 0.5);
      g.add(arm);

      const lamps: THREE.MeshStandardMaterial[] = [];
      // Heads facing along and across the arm (NS + EW approaches).
      for (let head = 0; head < 2; head++) {
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.1, 0.3), steel);
        const hx = head === 0 ? 0 : 0.35;
        const hz = armLen - 0.35;
        box.position.set(hx, 4.55, hz);
        if (head === 1) box.rotation.y = Math.PI / 2;
        g.add(box);
        const colors = [0xff2200, 0xffcc00, 0x22cc44];
        for (let i = 0; i < 3; i++) {
          const mat = new THREE.MeshStandardMaterial({
            color: colors[i],
            emissive: colors[i],
            emissiveIntensity: 0.05,
          });
          lamps.push(mat);
          const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), mat);
          lamp.position.set(hx + (head === 0 ? 0 : 0.2), 4.9 - i * 0.3, hz + (head === 0 ? 0.2 : 0));
          g.add(lamp);
        }
      }
      scene.add(g);
      s.mesh = g;
      s.lamps = lamps;
    }
  }

  private updateSignalLamps() {
    for (const s of this.signals) {
      if (!s.lamps || s.lamps.length < 6) continue;
      const t = (s.phase % s.cycle) / s.cycle;
      // NS: green 0–0.38, yellow 0.38–0.48, red rest
      // EW: green 0.5–0.88, yellow 0.88–0.98, red rest
      const ns = t < 0.38 ? "g" : t < 0.48 ? "y" : "r";
      const ew = t >= 0.5 && t < 0.88 ? "g" : t >= 0.88 && t < 0.98 ? "y" : "r";
      const set = (base: number, mode: string) => {
        for (let i = 0; i < 3; i++) s.lamps![base + i].emissiveIntensity = 0.06;
        if (mode === "r") s.lamps![base].emissiveIntensity = 2.4;
        if (mode === "y") s.lamps![base + 1].emissiveIntensity = 2.2;
        if (mode === "g") s.lamps![base + 2].emissiveIntensity = 2.4;
      };
      set(0, ns);
      set(3, ew);
    }
  }

  private pickKind(): Kind {
    const r = this.rand();
    if (r < 0.28) return "sedan";
    if (r < 0.42) return "hatch";
    if (r < 0.58) return "suv";
    if (r < 0.7) return "pickup";
    if (r < 0.82) return "van";
    if (r < 0.9) return "box";
    return "bus";
  }

  private spawnOne(nearX: number, nearZ: number, preferCity: boolean): TrafficCar | null {
    // Weight city routes higher near town.
    const scored = this.routes
      .map((route) => {
        const mid = route.pts[Math.floor(route.pts.length / 2)];
        const d = Math.hypot(mid.x - nearX, mid.z - nearZ);
        let w = 1 / (1 + d * 0.002);
        if (preferCity && route.city) w *= 2.4;
        if (!preferCity && route.highway) w *= 1.6;
        if (route.skyway) w *= 0.7;
        return { route, w };
      })
      .filter((s) => s.w > 0.05);
    if (!scored.length) return null;
    let total = 0;
    for (const s of scored) total += s.w;
    let pick = this.rand() * total;
    let route = scored[0].route;
    for (const s of scored) {
      pick -= s.w;
      if (pick <= 0) {
        route = s.route;
        break;
      }
    }
    // Two-way roads: either direction, but ALWAYS offset to the RIGHT of travel.
    const dir: 1 | -1 = this.rand() > 0.5 || route.closed ? (this.rand() > 0.5 ? 1 : -1) : 1;
    // Keep spawns off open-route ends so cars don't immediately despawn / face wrong way.
    const along = route.closed
      ? this.rand() * route.total
      : 20 + this.rand() * Math.max(10, route.total - 40);
    const laneBase = Math.min(3.4, route.width * 0.22);
    // lane is a positive distance to the right of the car's facing direction.
    const lane = laneBase * (route.highway && this.rand() > 0.55 ? 1.55 : 1);
    const kind = this.pickKind();
    const color = COLORS[Math.floor(this.rand() * COLORS.length)];
    const { mesh, glow, signal, brakes } = makeBody(kind, color);
    this.root.add(mesh);
    const car: TrafficCar = {
      route,
      along,
      dir,
      lane,
      shoulder: 0,
      x: 0,
      z: 0,
      yaw: 0,
      speed: (route.cruiseMph * 0.85) / 2.23694,
      kind,
      mesh,
      glow,
      signal,
      brakeLight: brakes,
      stunned: 0,
      honkCd: 0,
      turnSignal: 0,
      waiting: 0,
    };
    this.place(car);
    // Reject if too close to another car at spawn.
    for (const o of this.cars) {
      if (Math.hypot(o.x - car.x, o.z - car.z) < GAP * 0.8) {
        this.root.remove(mesh);
        return null;
      }
    }
    return car;
  }

  private place(car: TrafficCar) {
    const sample = sampleRoute(car.route, car.along);
    const yaw = car.dir === 1 ? sample.yaw : sample.yaw + Math.PI;
    // Right of travel = (cos yaw, -sin yaw) — keep every car on the RIGHT side.
    const laneDist = Math.abs(car.lane) + Math.max(0, car.shoulder);
    const rx = Math.cos(yaw);
    const rz = -Math.sin(yaw);
    car.x = sample.x + rx * laneDist;
    car.z = sample.z + rz * laneDist;
    car.yaw = yaw;
    car.lane = Math.abs(car.lane);
    const y = carSurfaceHeight(car.x, car.z, car.route.skyway ? SKYWAY.height + 2 : 2);
    car.mesh.position.set(car.x, y, car.z);
    car.mesh.rotation.y = yaw;
  }

  /** True when traffic is facing the wrong way relative to its route/dir. */
  private isWrongWay(car: TrafficCar): boolean {
    const sample = sampleRoute(car.route, car.along);
    const expectYaw = car.dir === 1 ? sample.yaw : sample.yaw + Math.PI;
    let dyaw = Math.abs(((car.yaw - expectYaw + Math.PI) % (Math.PI * 2)) - Math.PI);
    return dyaw > Math.PI / 2;
  }

  /**
   * Player avoidance: never steer toward the player.
   * Same-lane ahead → brake / stop behind. Oncoming wrong-side → brake + shoulder.
   */
  private avoidPlayers(
    car: TrafficCar,
    players: { x: number; z: number; yaw: number; speed: number; y: number }[],
  ): number {
    let targetMul = 1;
    let wantShoulder = 0;
    const fx = Math.sin(car.yaw);
    const fz = Math.cos(car.yaw);
    const rx = Math.cos(car.yaw);
    const rz = -Math.sin(car.yaw);
    for (const p of players) {
      const dx = p.x - car.x;
      const dz = p.z - car.z;
      const d = Math.hypot(dx, dz);
      if (d > 36) continue;
      const ahead = dx * fx + dz * fz;
      const side = dx * rx + dz * rz; // + = to traffic's right
      const pfx = Math.sin(p.yaw);
      const pfz = Math.cos(p.yaw);
      const closing = -(pfx * fx + pfz * fz); // >0 when player faces traffic
      const sameDir = pfx * fx + pfz * fz > 0.25;

      if (sameDir && ahead > 0.5 && ahead < 28 && Math.abs(side) < 4.5) {
        // Player in our lane ahead — slow and stop behind; never steer into them.
        targetMul = Math.min(targetMul, Math.max(0, (ahead - 6) / 18));
        if (ahead < 10) targetMul = 0;
        if (car.honkCd <= 0 && Math.abs(p.speed) > 2) {
          this.honk();
          car.honkCd = 1.8;
        }
      } else if (closing > 0.2 && ahead > -4 && ahead < 32 && Math.abs(side) < 6) {
        // Oncoming player on our side / wrong side — brake and move to shoulder (more right).
        targetMul = Math.min(targetMul, Math.max(0, (ahead - 8) / 20));
        if (ahead < 16) targetMul = 0;
        wantShoulder = Math.max(wantShoulder, Math.min(4.5, 5.5 - Math.abs(side)));
        car.turnSignal = Math.max(car.turnSignal, 1.2);
        if (car.honkCd <= 0) {
          this.honk();
          car.honkCd = 1.6;
        }
      } else if (ahead > 0 && ahead < 14 && d < 10) {
        // Close side threat — brake only, do not steer toward player.
        targetMul = Math.min(targetMul, 0.35);
      }
    }
    // Ease shoulder out / back.
    const goal = wantShoulder;
    car.shoulder += (goal - car.shoulder) * 0.12;
    if (Math.abs(car.shoulder) < 0.05 && goal === 0) car.shoulder = 0;
    return targetMul;
  }

  private lightAllows(x: number, z: number, yaw: number): boolean {
    let nearest: Signal | null = null;
    let best = 22;
    for (const s of this.signals) {
      const d = Math.hypot(s.x - x, s.z - z);
      if (d < best) {
        best = d;
        nearest = s;
      }
    }
    if (!nearest) return true;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const toX = nearest.x - x;
    const toZ = nearest.z - z;
    const ahead = toX * fx + toZ * fz;
    if (ahead < 4 || ahead > 22) return true;
    const ns = Math.abs(fz) >= Math.abs(fx);
    const t = (nearest.phase % nearest.cycle) / nearest.cycle;
    // Green or yellow = go; red = stop (matches lamp colors).
    const nsGo = t < 0.48;
    const ewGo = t >= 0.5 && t < 0.98;
    return ns ? nsGo : ewGo;
  }

  private leaderGap(car: TrafficCar): number {
    let best = 1e9;
    for (const o of this.cars) {
      if (o === car || o.route.id !== car.route.id || o.dir !== car.dir) continue;
      if (Math.abs(o.lane - car.lane) > 2.2) continue;
      let delta = (o.along - car.along) * car.dir;
      if (car.route.closed) {
        if (delta < 0) delta += car.route.total;
      }
      if (delta > 0.5 && delta < best) best = delta;
    }
    return best;
  }

  private tryLaneChange(car: TrafficCar) {
    if (!car.route.highway && !car.route.skyway) return;
    if (car.stunned > 0 || car.waiting > 0) return;
    if (this.rand() > 0.002) return;
    const laneBase = Math.min(3.4, car.route.width * 0.22);
    // Same-direction lanes only (both positive right offsets — never cross center).
    const outer = laneBase * 1.55;
    const inner = laneBase;
    const next = Math.abs(car.lane - outer) < 0.5 ? inner : outer;
    for (const o of this.cars) {
      if (o === car || o.route.id !== car.route.id || o.dir !== car.dir) continue;
      if (Math.abs(Math.abs(o.lane) - next) > 1.5) continue;
      let delta = (o.along - car.along) * car.dir;
      if (car.route.closed && delta < 0) delta += car.route.total;
      if (Math.abs(delta) < GAP) return;
    }
    car.lane = next;
    car.turnSignal = 1.6;
  }

  private honk() {
    try {
      if (!this.audioCtx) this.audioCtx = new AudioContext();
      const ctx = this.audioCtx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = 420;
      gain.gain.value = 0.03;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
      osc.stop(ctx.currentTime + 0.26);
    } catch {
      /* ignore */
    }
  }

  seedNear(x: number, z: number) {
    const preferCity = Math.hypot(x, z) < CITY_R + 80;
    let guard = 0;
    while (this.cars.length < Math.min(MAX_CARS, preferCity ? 28 : 18) && guard < 80) {
      const c = this.spawnOne(x, z, preferCity);
      if (c) this.cars.push(c);
      guard++;
    }
  }

  update(dt: number, players: { x: number; z: number; yaw: number; speed: number; y: number }[], night: number) {
    this.time += dt;
    for (const s of this.signals) s.phase += dt;
    this.updateSignalLamps();

    // Despawn far / wrong-way / open-route ends (no U-turns) / maintain pool near players.
    const keep: TrafficCar[] = [];
    for (const c of this.cars) {
      if (this.isWrongWay(c)) {
        this.root.remove(c.mesh);
        continue; // facing wrong way — respawn correctly later
      }
      if (!c.route.closed && (c.along >= c.route.total - 2 || c.along <= 2)) {
        this.root.remove(c.mesh);
        continue; // end of open route — despawn instead of turning around
      }
      let near = false;
      for (const p of players) {
        if (Math.hypot(c.x - p.x, c.z - p.z) < SIM_RADIUS + 80) {
          near = true;
          break;
        }
      }
      if (near) keep.push(c);
      else this.root.remove(c.mesh);
    }
    this.cars = keep;

    for (const p of players) {
      const preferCity = Math.hypot(p.x, p.z) < CITY_R + 80;
      const local = this.cars.filter((c) => Math.hypot(c.x - p.x, c.z - p.z) < SIM_RADIUS).length;
      const want = preferCity ? 22 : 12;
      let guard = 0;
      while (this.cars.length < MAX_CARS && local + guard < want && guard < 6) {
        const c = this.spawnOne(p.x + (this.rand() - 0.5) * 200, p.z + (this.rand() - 0.5) * 200, preferCity);
        if (c && Math.hypot(c.x - p.x, c.z - p.z) < SIM_RADIUS) {
          this.cars.push(c);
        } else if (c) {
          this.root.remove(c.mesh);
        }
        guard++;
      }
    }

    for (const c of this.cars) {
      if (c.honkCd > 0) c.honkCd -= dt;
      if (c.turnSignal > 0) c.turnSignal -= dt;
      if (c.stunned > 0) {
        c.stunned -= dt;
        c.speed = Math.max(0, c.speed - 12 * dt);
        this.place(c);
        continue;
      }

      const cruise = (c.route.cruiseMph * 0.88) / 2.23694;
      let target = cruise;
      const gap = this.leaderGap(c);
      if (gap < GAP) target = Math.min(target, Math.max(0, (gap - 4) * 1.1));
      if (gap < 6) target = 0;

      // Player avoidance — brake / stop behind / shoulder; never steer toward player.
      target *= this.avoidPlayers(c, players);

      if (!this.lightAllows(c.x, c.z, c.yaw)) {
        target = 0;
        c.waiting += dt;
      } else {
        c.waiting = 0;
      }

      // Signal near open-route end (then despawn — no U-turn).
      if (!c.route.closed && c.along > c.route.total - 40) c.turnSignal = Math.max(c.turnSignal, 0.8);

      this.tryLaneChange(c);

      const accel = c.kind === "bus" || c.kind === "box" ? 3.5 : 6.5;
      if (c.speed < target) c.speed = Math.min(target, c.speed + accel * dt);
      else c.speed = Math.max(target, c.speed - 10 * dt);

      c.along += c.speed * dt * c.dir;
      if (c.route.closed) {
        c.along = ((c.along % c.route.total) + c.route.total) % c.route.total;
      } else {
        // Clamp; despawn pass above removes cars that reach the ends.
        c.along = Math.max(0.5, Math.min(c.route.total - 0.5, c.along));
      }

      this.place(c);
      c.glow.visible = night > 0.35;
      const braking = target + 2 < c.speed || target < 1;
      for (const b of c.brakeLight) {
        (b.material as THREE.MeshBasicMaterial).color.setHex(braking ? 0xff0000 : 0xaa2200);
      }
      const sigMat = c.signal.material as THREE.MeshStandardMaterial;
      if (c.turnSignal > 0) {
        sigMat.emissiveIntensity = Math.sin(this.time * 12) > 0 ? 2.2 : 0.1;
      } else {
        sigMat.emissiveIntensity = 0;
      }
    }
  }

  /**
   * Soft-separate from traffic. Returns true only when the PLAYER caused the
   * crash (closing speed dominated by the player) — traffic hitting you does not.
   */
  collidePlayer(car: Car): boolean {
    let hit = false;
    for (const t of this.cars) {
      const d = Math.hypot(t.x - car.x, t.z - car.z);
      if (d >= 3.8) continue;
      const nx = (t.x - car.x) / Math.max(1e-3, d);
      const nz = (t.z - car.z) / Math.max(1e-3, d);
      const push = (3.8 - d) * 0.5;
      t.x += nx * push;
      t.z += nz * push;
      car.x -= nx * push * 0.35;
      car.z -= nz * push * 0.35;
      const pvx = Math.sin(car.yaw) * car.speed;
      const pvz = Math.cos(car.yaw) * car.speed;
      const tvx = Math.sin(t.yaw) * t.speed;
      const tvz = Math.cos(t.yaw) * t.speed;
      const playerClosing = pvx * nx + pvz * nz;
      const trafficClosing = -(tvx * nx + tvz * nz);
      t.stunned = Math.max(t.stunned, 1.2);
      t.speed *= 0.3;
      if (playerClosing > 4 && playerClosing >= trafficClosing - 0.5 && Math.abs(car.speed) > 4) {
        hit = true;
        t.stunned = Math.max(t.stunned, 1.8);
        t.speed = 0;
        car.speed *= 0.72;
        if (t.honkCd <= 0) {
          this.honk();
          t.honkCd = 1.2;
        }
      }
    }
    return hit;
  }

  dots(): TrafficDot[] {
    return this.cars.map((c) => ({ x: c.x, z: c.z }));
  }
}
