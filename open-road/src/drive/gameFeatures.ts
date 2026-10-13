/**
 * WORLD-BUILD + CAR-FIXES gameplay systems: day/night, dirt, speed track,
 * mud-park laps, restaurants, car wash, traffic, cops, speed limits.
 */
import * as THREE from "three";
import { ROADS, SPAWN, elevatedHeightAt, heightAt } from "./mapData";
import { FORESTS, LANDMARKS, SPEED_TRACK, SKYWAY } from "./mapZones";
import { surfaceAt, type Car, type RoadSeg, type Tune } from "./sim";

const DAY_LEN_SEC = 20 * 60; // 20-minute day
const COP_COUNT = 5;
const COP_PATROL_R = 500;
const COP_NOTICE_R = 150;
const COP_ESCAPE_DIST = 300;
const COP_LOS_ESCAPE_SEC = 10;
const COP_STAR_DROP_SEC = 15;
/** Keep cops off the player's body — bump OK, overlap never. */
const COP_MIN_SEP = 4.5;
const COP_SPAWN_MIN = 110;
const MAX_STREET_LIGHTS = 6;

const COP_ROADS: RoadSeg[] = ROADS.map((r) => ({
  x1: r.x1,
  z1: r.z1,
  x2: r.x2,
  z2: r.z2,
  half: r.width / 2,
  grip: r.grip,
}));

export type TimePreset = "morning" | "noon" | "sunset" | "night" | "pause";

export type FeatureHud = {
  speedLimit: number;
  wanted: number;
  chase: boolean;
  busted: boolean;
  escaped: boolean;
  lapTime: number | null;
  bestLap: number | null;
  trackMph: number | null;
  trackTop: number | null;
  trackBest: number | null;
  zeroSixty: number | null;
  dirt: number;
  timeLabel: string;
  copsOn: boolean;
};

type Cop = {
  x: number;
  z: number;
  yaw: number;
  speed: number;
  mesh: THREE.Group;
  chase: boolean;
  bar: THREE.Mesh;
  patrolA: number;
};

export class GameFeatures {
  timeOfDay = 0.35; // 0..1, morning-ish
  timePaused = false;
  copsOn = false;
  dirt = 0;
  wanted = 0;
  chaseTimer = 0;
  escapeTimer = 0;
  /** Seconds with no cop line-of-sight while wanted. */
  losHiddenTimer = 0;
  /** Seconds without LOS toward the next star drop. */
  starDropTimer = 0;
  stoppedNearCop = 0;
  bustedFlash = 0;
  escapedFlash = 0;
  /** Brief flash of WANTED stars before ESCAPED clears. */
  escapePending = 0;
  lapStart: number | null = null;
  lapTime: number | null = null;
  bestLap: number | null = null;
  onLap = false;
  trackTop = 0;
  trackBest = Number(localStorage.getItem("or-track-best") || 0);
  zeroSixty: number | null = null;
  zeroSixtyT = 0;
  zeroSixtyArmed = false;
  lastRestaurant = "";
  traffic: { x: number; z: number; yaw: number; speed: number; mesh: THREE.Group; glow: THREE.Group }[] = [];
  cops: Cop[] = [];
  private trafficRoot = new THREE.Group();
  private copRoot = new THREE.Group();
  private hemi: THREE.HemisphereLight | null = null;
  private sun: THREE.DirectionalLight | null = null;
  private scene: THREE.Scene | null = null;
  private stars: THREE.Points | null = null;
  private moon: THREE.Mesh | null = null;
  private headL: THREE.SpotLight | null = null;
  private headR: THREE.SpotLight | null = null;
  private streetPool: THREE.PointLight[] = [];
  private streetLampPos: { x: number; y: number; z: number }[] = [];
  private windowMats: THREE.MeshStandardMaterial[] = [];
  private streetLampMats: THREE.MeshStandardMaterial[] = [];
  private sirenOsc: OscillatorNode | null = null;
  private audioCtx: AudioContext | null = null;
  private playerRoot: THREE.Object3D | null = null;

  attach(scene: THREE.Scene, hemi: THREE.HemisphereLight, sun: THREE.DirectionalLight) {
    this.scene = scene;
    this.hemi = hemi;
    this.sun = sun;
    scene.add(this.trafficRoot, this.copRoot);
    this.buildStars();
    this.buildMoon();
    this.buildHeadlights();
    this.buildStreetPool();
    this.collectNightProps(scene);
    this.spawnTraffic();
  }

  /** Call each frame with the player car root for headlight aim + night glow. */
  setPlayerRoot(root: THREE.Object3D | null) {
    this.playerRoot = root;
  }

  private buildStars() {
    const geo = new THREE.BufferGeometry();
    const n = 1200;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const b = 0.05 + Math.random() * 1.1;
      const r = 1200 + Math.random() * 600;
      pos[i * 3] = Math.cos(a) * Math.cos(b) * r;
      pos[i * 3 + 1] = 180 + Math.sin(b) * r * 0.75;
      pos[i * 3 + 2] = Math.sin(a) * Math.cos(b) * r;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: true, transparent: true, opacity: 0 }),
    );
    this.scene?.add(this.stars);
  }

  private buildMoon() {
    this.moon = new THREE.Mesh(
      new THREE.SphereGeometry(28, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xf0f4ff }),
    );
    this.moon.position.set(-400, 520, -600);
    this.moon.visible = false;
    this.scene?.add(this.moon);
  }

  private buildHeadlights() {
    const mk = () => {
      const s = new THREE.SpotLight(0xfff2d0, 0, 55, 0.42, 0.45, 1.4);
      s.castShadow = false;
      this.scene?.add(s);
      this.scene?.add(s.target);
      return s;
    };
    this.headL = mk();
    this.headR = mk();
  }

  private buildStreetPool() {
    for (let i = 0; i < MAX_STREET_LIGHTS; i++) {
      const p = new THREE.PointLight(0xffe0a0, 0, 38, 1.6);
      this.scene?.add(p);
      this.streetPool.push(p);
    }
    // Known town + highway lamp positions (matches world.addLamps).
    for (let x = -180; x <= 180; x += 40) {
      for (const z of [-16, 16]) {
        this.streetLampPos.push({ x, y: heightAt(x, z) + 5.2, z });
      }
    }
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      const r = 820 * (1 + 0.08 * Math.sin(a * 2));
      const x = Math.cos(a) * (r + 18);
      const z = Math.sin(a) * (r + 18);
      this.streetLampPos.push({ x, y: heightAt(x, z) + 5.2, z });
    }
  }

  private collectNightProps(scene: THREE.Scene) {
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        if (!(m instanceof THREE.MeshStandardMaterial)) continue;
        if (m.name === "window-glass" || m.userData?.nightWindow) this.windowMats.push(m);
        if (m.emissive && (m.color.getHex() === 0xfff0c8 || m.emissive.getHex() === 0xffd88a)) {
          this.streetLampMats.push(m);
        }
      }
      if (mesh.userData?.streetLamp && mesh.material instanceof THREE.MeshStandardMaterial) {
        this.streetLampMats.push(mesh.material);
      }
    });
  }

  registerWindowMaterial(mat: THREE.MeshStandardMaterial) {
    this.windowMats.push(mat);
  }

  private carMesh(color: number) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.7, 4.0),
      new THREE.MeshStandardMaterial({ color, roughness: 0.55 }),
    );
    body.position.y = 0.55;
    g.add(body);
    const glow = new THREE.Group();
    const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2c8 });
    const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2200 });
    for (const s of [-1, 1]) {
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.12, 0.08), headMat);
      h.position.set(s * 0.55, 0.45, 2.05);
      glow.add(h);
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.06), tailMat);
      t.position.set(s * 0.55, 0.48, -2.05);
      glow.add(t);
    }
    glow.visible = false;
    g.add(glow);
    return { mesh: g, glow };
  }

  private spawnTraffic() {
    const colors = [0x4488cc, 0xcc4444, 0xdddddd, 0x33aa66, 0xffaa33];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const r = 820;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const { mesh, glow } = this.carMesh(colors[i % colors.length]);
      mesh.position.set(x, heightAt(x, z) + 0.2, z);
      this.trafficRoot.add(mesh);
      this.traffic.push({ x, z, yaw: a + Math.PI / 2, speed: 28 + (i % 5) * 2, mesh, glow });
    }
  }

  setCops(on: boolean) {
    this.copsOn = on;
    if (!on) {
      for (const c of this.cops) this.copRoot.remove(c.mesh);
      this.cops = [];
      this.wanted = 0;
      this.chaseTimer = 0;
      this.stopSiren();
      return;
    }
    this.spawnCopsNear(SPAWN.x, SPAWN.z);
  }

  /** Full 3D cruiser — never a flat blue panel. */
  private makeCop(x: number, z: number, yaw: number, patrolA: number): Cop {
    const mesh = new THREE.Group();
    const white = new THREE.MeshStandardMaterial({ color: 0xf2f4f8, roughness: 0.45, metalness: 0.15 });
    const blue = new THREE.MeshStandardMaterial({ color: 0x1a3a8a, roughness: 0.5, metalness: 0.2 });
    const black = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.85 });
    const glass = new THREE.MeshStandardMaterial({
      color: 0x223344,
      roughness: 0.2,
      metalness: 0.3,
      transparent: true,
      opacity: 0.65,
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 4.2), white);
    body.position.y = 0.55;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.22, 4.22), blue);
    stripe.position.y = 0.62;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 1.8), white);
    cabin.position.set(0, 1.05, -0.15);
    const win = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.4, 1.55), glass);
    win.position.set(0, 1.15, -0.1);
    mesh.add(body, stripe, cabin, win);
    for (const sx of [-1, 1]) {
      for (const sz of [1.25, -1.25]) {
        const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.28, 12), black);
        tire.rotation.z = Math.PI / 2;
        tire.position.set(sx * 0.85, 0.32, sz);
        mesh.add(tire);
      }
    }
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.35, 0.22, 0.45),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xff0044, emissiveIntensity: 1.4 }),
    );
    bar.position.set(0, 1.45, -0.1);
    mesh.add(bar);
    mesh.position.set(x, heightAt(x, z) + 0.02, z);
    mesh.rotation.y = yaw;
    this.copRoot.add(mesh);
    return { x, z, yaw, speed: 30, mesh, chase: false, bar, patrolA };
  }

  /** Spawn/replace all cops ≥100 m away, out of sight. */
  private spawnCopsNear(px: number, pz: number) {
    for (const c of this.cops) this.copRoot.remove(c.mesh);
    this.cops = [];
    for (let i = 0; i < COP_COUNT; i++) {
      const a = (i / COP_COUNT) * Math.PI * 2 + 0.35;
      const dist = COP_SPAWN_MIN + 30 + (i % 3) * 110; // ~140–360 m
      const x = px + Math.cos(a) * dist;
      const z = pz + Math.sin(a) * dist;
      this.cops.push(this.makeCop(x, z, a + Math.PI / 2, a));
    }
  }

  /** Top up missing/far cops without wiping an active chase pack. */
  private ensureCopsNear(px: number, pz: number) {
    // Drop only idle cops that wandered too far; keep chasers.
    this.cops = this.cops.filter((c) => {
      const d = Math.hypot(c.x - px, c.z - pz);
      if (c.chase || d < COP_PATROL_R) return true;
      this.copRoot.remove(c.mesh);
      return false;
    });
    let i = 0;
    while (this.cops.length < COP_COUNT && i < COP_COUNT * 3) {
      const a = Math.random() * Math.PI * 2;
      const dist = COP_SPAWN_MIN + 40 + (i % 4) * 80;
      const x = px + Math.cos(a) * dist;
      const z = pz + Math.sin(a) * dist;
      // Never spawn on top of the player or another cop.
      if (Math.hypot(x - px, z - pz) < COP_SPAWN_MIN) {
        i++;
        continue;
      }
      let ok = true;
      for (const c of this.cops) {
        if (Math.hypot(c.x - x, c.z - z) < 18) {
          ok = false;
          break;
        }
      }
      if (ok) this.cops.push(this.makeCop(x, z, a + Math.PI / 2, a));
      i++;
    }
  }

  /** Separate cop from player: bump OK, mesh overlap never. */
  private separateCop(c: Cop, car: Car, dt: number) {
    const d = Math.hypot(c.x - car.x, c.z - car.z);
    if (d >= COP_MIN_SEP || d < 1e-4) return;
    const nx = (c.x - car.x) / d;
    const nz = (c.z - car.z) / d;
    const push = COP_MIN_SEP - d;
    c.x += nx * push;
    c.z += nz * push;
    // Soft bump on the player (opposite) — never teleport into the cop.
    const bump = Math.min(2.8, push * 6) * dt;
    car.x -= nx * bump;
    car.z -= nz * bump;
    if (c.chase) c.speed *= 0.85;
  }

  setTimePreset(preset: TimePreset) {
    if (preset === "pause") {
      this.timePaused = !this.timePaused;
      return;
    }
    this.timePaused = false;
    const map: Record<string, number> = { morning: 0.22, noon: 0.45, sunset: 0.72, night: 0.9 };
    this.timeOfDay = map[preset] ?? 0.45;
  }

  speedLimitAt(x: number, z: number, onHighway: boolean, carY = 0): number {
    // NEXT #29: city 130 / roads 150 / highway 195 / skyway 210
    const deck = elevatedHeightAt(x, z);
    if (deck != null && carY > deck - 4.5 && Math.hypot(x, z) > SKYWAY.radius - 80) return 210;
    if (Math.hypot(x, z) > SKYWAY.radius - 40) return 210;
    if (onHighway) return 195;
    if (Math.hypot(x, z) < 320) return 130;
    return 150;
  }

  /** Hide under bridges/skyway, in forests, or tight against buildings. */
  private inCover(x: number, z: number, y: number): boolean {
    const deck = elevatedHeightAt(x, z);
    if (deck != null && y < deck - 3) return true;
    for (const f of FORESTS) {
      if (Math.hypot(x - f.x, z - f.z) < f.r * 0.9) return true;
    }
    for (const lm of LANDMARKS) {
      if (Math.abs(x - lm.x) < lm.hx + 6 && Math.abs(z - lm.z) < lm.hz + 6) return true;
    }
    return false;
  }

  private canSeePlayer(c: Cop, car: Car): boolean {
    const d = Math.hypot(c.x - car.x, c.z - car.z);
    if (d > COP_ESCAPE_DIST) return false;
    const playerCover = this.inCover(car.x, car.z, car.y);
    const copCover = this.inCover(c.x, c.z, heightAt(c.x, c.z) + 0.5);
    if (playerCover && !copCover) return false;
    return true;
  }

  private maxChasers(): number {
    const w = Math.floor(this.wanted);
    if (w >= 5) return 3;
    if (w >= 3) return 2;
    if (w >= 1) return 1;
    return 1; // first notice still gets one unit
  }

  private clearChase(say: (t: string) => void, escaped: boolean) {
    for (const c of this.cops) c.chase = false;
    this.stopSiren();
    this.losHiddenTimer = 0;
    this.starDropTimer = 0;
    this.chaseTimer = 0;
    if (escaped) {
      this.wanted = 0;
      this.escapedFlash = 2.2;
      this.escapePending = 0;
      say("ESCAPED");
    }
  }

  onSpeedTrack(x: number, z: number) {
    return Math.abs(z - SPEED_TRACK.z0) < SPEED_TRACK.width * 0.7 && x >= SPEED_TRACK.x0 - 50 && x <= SPEED_TRACK.x1 + 50;
  }

  update(
    dt: number,
    car: Car,
    tune: Tune | unknown,
    mph: number,
    surface: string,
    onHighway: boolean,
    say: (t: string) => void,
  ): FeatureHud {
    const playerTopMph =
      tune && typeof tune === "object" && tune !== null && "top" in tune && typeof (tune as Tune).top === "number"
        ? (tune as Tune).top * 2.23694
        : 140;
    const copTopMs = (playerTopMph * 0.9) / 2.23694; // ~90% of player top
    const copAccel = 9.5; // m/s² — a bit slower than sports-car shove
    if (!this.timePaused) this.timeOfDay = (this.timeOfDay + dt / DAY_LEN_SEC) % 1;
    this.applyLighting(car);

    if (surface === "Mud" || surface === "Dirt" || surface === "Sand" || surface === "Wet") {
      this.dirt = Math.min(1, this.dirt + dt * (surface === "Mud" ? 0.12 : 0.05));
    }

    for (const lm of LANDMARKS) {
      if (Math.abs(car.x - lm.x) < lm.hx && Math.abs(car.z - lm.z) < lm.hz) {
        if (lm.kind === "restaurant" && Math.abs(car.speed) < 2 && this.lastRestaurant !== lm.id) {
          this.lastRestaurant = lm.id;
          const emoji = lm.id === "pizza" ? "🍕" : lm.id === "pho" ? "🍜" : "🥖";
          say(`${emoji} Welcome to the ${lm.label}!`);
        }
        if (lm.kind === "carwash" && Math.abs(car.speed) < 8 && Math.abs(car.speed) > 0.5) {
          if (this.dirt > 0.05) {
            this.dirt = 0;
            say("Sparkling clean! ✨");
          }
        }
      }
    }

    const nearStart = Math.hypot(car.x + 180, car.z + 340) < 10;
    const nearFinish = Math.hypot(car.x + 300, car.z + 400) < 10;
    if (nearStart && Math.abs(car.speed) > 3) {
      this.lapStart = performance.now();
      this.onLap = true;
      this.lapTime = null;
    }
    if (this.onLap && nearFinish && this.lapStart != null) {
      this.lapTime = (performance.now() - this.lapStart) / 1000;
      if (this.bestLap == null || this.lapTime < this.bestLap) {
        this.bestLap = this.lapTime;
        localStorage.setItem("or-mud-best", String(this.bestLap));
      }
      this.onLap = false;
      this.lapStart = null;
      say(`Lap ${this.lapTime.toFixed(2)}s`);
    }
    if (this.bestLap == null) {
      const saved = localStorage.getItem("or-mud-best");
      if (saved) this.bestLap = Number(saved);
    }

    let trackMph: number | null = null;
    if (this.onSpeedTrack(car.x, car.z)) {
      trackMph = mph;
      this.trackTop = Math.max(this.trackTop, mph);
      if (mph > this.trackBest) {
        this.trackBest = mph;
        localStorage.setItem("or-track-best", String(this.trackBest));
      }
      const atLine = Math.abs(car.x - SPEED_TRACK.x0) < 30 && Math.abs(car.speed) < 1.5;
      if (atLine) {
        this.zeroSixtyArmed = true;
        this.zeroSixtyT = 0;
        this.zeroSixty = null;
      }
      if (this.zeroSixtyArmed && car.speed > 0.5) {
        this.zeroSixtyT += dt;
        if (mph >= 60 && this.zeroSixty == null) {
          this.zeroSixty = this.zeroSixtyT;
          this.zeroSixtyArmed = false;
        }
      }
    } else {
      this.trackTop = 0;
      this.zeroSixtyArmed = false;
    }

    const night = this.nightFactor();
    let hitTraffic = false;
    for (const t of this.traffic) {
      t.yaw += (t.speed / 820) * dt;
      t.x = Math.cos(t.yaw - Math.PI / 2) * 820;
      t.z = Math.sin(t.yaw - Math.PI / 2) * 820;
      t.mesh.position.set(t.x, heightAt(t.x, t.z) + 0.2, t.z);
      t.mesh.rotation.y = t.yaw;
      t.glow.visible = night > 0.35;
      const d = Math.hypot(t.x - car.x, t.z - car.z);
      if (d < 18) t.speed = Math.max(12, t.speed - 20 * dt);
      else t.speed = Math.min(36, t.speed + 8 * dt);
      // Crash into another car (not a red light — there are none).
      if (d < 3.6 && Math.abs(car.speed) > 4) hitTraffic = true;
    }

    let anyChase = false;
    if (this.copsOn) {
      let near = 0;
      for (const c of this.cops) if (Math.hypot(c.x - car.x, c.z - car.z) < COP_PATROL_R) near++;
      if (this.cops.length < COP_COUNT || near < 2) this.ensureCopsNear(car.x, car.z);

      const limit = this.speedLimitAt(car.x, car.z, onHighway, car.y);
      const speeding = mph > limit + 15;
      const wantedNow = speeding || hitTraffic;
      const maxChase = this.maxChasers();
      let chaseCount = this.cops.filter((c) => c.chase).length;

      // Recruit nearest idle cops up to the star cap.
      if (wantedNow) {
        const candidates = this.cops
          .filter((c) => !c.chase)
          .map((c) => ({ c, d: Math.hypot(c.x - car.x, c.z - car.z) }))
          .filter(({ d }) => d < (hitTraffic ? COP_PATROL_R : COP_NOTICE_R))
          .sort((a, b) => a.d - b.d);
        for (const { c } of candidates) {
          if (chaseCount >= maxChase) break;
          c.chase = true;
          chaseCount++;
          if (this.wanted < 1) this.wanted = 1;
        }
      }
      // Drop excess chasers (keep closest).
      if (chaseCount > maxChase) {
        const ranked = this.cops
          .filter((c) => c.chase)
          .map((c) => ({ c, d: Math.hypot(c.x - car.x, c.z - car.z) }))
          .sort((a, b) => a.d - b.d);
        for (let i = maxChase; i < ranked.length; i++) ranked[i].c.chase = false;
      }

      let anySee = false;
      let nearestChase = Infinity;
      for (const c of this.cops) {
        let d = Math.hypot(c.x - car.x, c.z - car.z);
        if (c.chase) {
          anyChase = true;
          nearestChase = Math.min(nearestChase, d);
          if (this.canSeePlayer(c, car)) anySee = true;
          const ang = Math.atan2(car.x - c.x, car.z - c.z);
          // Slow on sharp turns (big heading change).
          const turn = Math.abs(((ang - c.yaw + Math.PI) % (Math.PI * 2)) - Math.PI);
          c.yaw = ang;
          const surf = surfaceAt(c.x, c.z, COP_ROADS, heightAt(c.x, c.z) + 0.5);
          let top = copTopMs;
          if (surf.name === "Grass") top *= 0.72;
          else if (surf.name === "Dirt" || surf.name === "Mud" || surf.name === "Sand") top *= 0.62;
          if (turn > 0.45) top *= 0.7;
          c.speed = Math.min(top, c.speed + copAccel * (surf.name === "Dry" || surf.name === "Wet" ? 1 : 0.55) * dt);
          const chasePace = Math.min(top, Math.max(18, (mph * 0.9) / 2.23694));
          if (c.speed > chasePace) c.speed += (chasePace - c.speed) * Math.min(1, 1.8 * dt);
          c.x += Math.sin(c.yaw) * c.speed * dt;
          c.z += Math.cos(c.yaw) * c.speed * dt;
          this.separateCop(c, car, dt);
          d = Math.hypot(c.x - car.x, c.z - car.z);
          if (d < 10 && Math.abs(car.speed) < 2) this.stoppedNearCop += dt;
          else this.stoppedNearCop = Math.max(0, this.stoppedNearCop - dt);
        } else {
          c.patrolA += 0.22 * dt;
          const pr = 180 + (c.patrolA % 3) * 90;
          const tx = car.x + Math.cos(c.patrolA) * pr;
          const tz = car.z + Math.sin(c.patrolA) * pr;
          c.yaw = Math.atan2(tx - c.x, tz - c.z);
          c.speed = 28;
          c.x += Math.sin(c.yaw) * c.speed * dt;
          c.z += Math.cos(c.yaw) * c.speed * dt;
          this.separateCop(c, car, dt);
          const pd = Math.hypot(c.x - car.x, c.z - car.z);
          if (pd > COP_PATROL_R) {
            const leash = Math.max(COP_SPAWN_MIN, COP_PATROL_R - 40);
            c.x = car.x + ((c.x - car.x) / pd) * leash;
            c.z = car.z + ((c.z - car.z) / pd) * leash;
          }
        }
        // Sit on terrain — mesh origin is ground level (wheels at y≈0.32).
        c.mesh.position.set(c.x, heightAt(c.x, c.z), c.z);
        c.mesh.rotation.y = c.yaw;
        c.mesh.scale.set(1, 1, 1);
        const mat = c.bar.material as THREE.MeshStandardMaterial;
        if (c.chase) {
          mat.emissive.set(Math.sin(performance.now() * 0.025) > 0 ? 0xff0044 : 0x0044ff);
          mat.emissiveIntensity = 2.2;
        } else {
          mat.emissive.setHex(0x2244aa);
          mat.emissiveIntensity = 0.4;
        }
      }

      if (this.escapePending > 0) {
        this.escapePending -= dt;
        if (this.escapePending <= 0) this.clearChase(say, true);
      } else if (anyChase || this.wanted > 0) {
        if (anySee) {
          this.wanted = Math.min(5, Math.max(1, this.wanted + dt * 0.18));
          this.chaseTimer += dt;
          this.losHiddenTimer = 0;
          this.starDropTimer = 0;
          this.startSiren();
        } else if (this.wanted > 0) {
          this.losHiddenTimer += dt;
          this.starDropTimer += dt;
          if (this.starDropTimer >= COP_STAR_DROP_SEC) {
            this.wanted = Math.max(0, Math.floor(this.wanted) - 1);
            this.starDropTimer = 0;
            if (this.wanted <= 0) {
              this.escapePending = 0.85; // WANTED flash, then ESCAPED
              say("WANTED");
            }
          }
          if (nearestChase > COP_ESCAPE_DIST || this.losHiddenTimer >= COP_LOS_ESCAPE_SEC) {
            this.escapePending = 0.85;
            say("WANTED");
          }
        }
      } else {
        this.stopSiren();
      }

      if (this.stoppedNearCop > 3) {
        this.bustedFlash = 2.5;
        this.wanted = 0;
        this.stoppedNearCop = 0;
        this.clearChase(say, false);
        car.x = SPAWN.x;
        car.z = SPAWN.z;
        car.yaw = SPAWN.yaw;
        car.speed = 0;
        say("BUSTED");
      }
    }
    this.bustedFlash = Math.max(0, this.bustedFlash - dt);
    this.escapedFlash = Math.max(0, this.escapedFlash - dt);

    return {
      speedLimit: this.speedLimitAt(car.x, car.z, onHighway, car.y),
      wanted: this.wanted,
      chase: anyChase,
      busted: this.bustedFlash > 0,
      escaped: this.escapedFlash > 0,
      lapTime: this.onLap && this.lapStart ? (performance.now() - this.lapStart) / 1000 : this.lapTime,
      bestLap: this.bestLap,
      trackMph,
      trackTop: trackMph != null ? this.trackTop : null,
      trackBest: this.trackBest || null,
      zeroSixty: this.zeroSixty,
      dirt: this.dirt,
      timeLabel: this.timeLabel(),
      copsOn: this.copsOn,
    };
  }

  private startSiren() {
    try {
      if (!this.audioCtx) this.audioCtx = new AudioContext();
      if (this.sirenOsc) return;
      const ctx = this.audioCtx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.value = 680;
      gain.gain.value = 0.03;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      this.sirenOsc = osc;
      // Wail between two tones
      const t0 = ctx.currentTime;
      osc.frequency.setValueAtTime(680, t0);
      osc.frequency.linearRampToValueAtTime(920, t0 + 0.45);
      osc.frequency.linearRampToValueAtTime(680, t0 + 0.9);
      const loop = () => {
        if (!this.sirenOsc || !this.audioCtx) return;
        const t = this.audioCtx.currentTime;
        this.sirenOsc.frequency.cancelScheduledValues(t);
        this.sirenOsc.frequency.setValueAtTime(680, t);
        this.sirenOsc.frequency.linearRampToValueAtTime(920, t + 0.45);
        this.sirenOsc.frequency.linearRampToValueAtTime(680, t + 0.9);
        setTimeout(loop, 900);
      };
      setTimeout(loop, 900);
    } catch {
      /* audio blocked */
    }
  }

  private stopSiren() {
    try {
      this.sirenOsc?.stop();
    } catch {
      /* already stopped */
    }
    this.sirenOsc = null;
  }

  nightFactor() {
    const t = this.timeOfDay;
    if (t < 0.2) return 1 - t / 0.2;
    if (t < 0.65) return 0;
    if (t < 0.8) return (t - 0.65) / 0.15;
    return 1;
  }

  timeLabel() {
    if (this.timePaused) return "Paused";
    const t = this.timeOfDay;
    if (t < 0.25) return "Morning";
    if (t < 0.55) return "Noon";
    if (t < 0.75) return "Sunset";
    return "Night";
  }

  private applyLighting(car: Car) {
    if (!this.hemi || !this.sun || !this.scene) return;
    const night = this.nightFactor();
    const day = 1 - night;
    this.hemi.intensity = 0.12 + 0.78 * day;
    this.sun.intensity = 0.05 + 1.45 * day;
    this.sun.color.set(night > 0.5 ? 0x6a7aaa : 0xfff8ee);
    const sky = new THREE.Color().setHSL(0.62, 0.45, 0.04 + 0.58 * day);
    this.scene.background = sky;
    if (this.scene.fog) {
      this.scene.fog.color.copy(sky);
      (this.scene.fog as THREE.Fog).near = 80 + 100 * day;
      (this.scene.fog as THREE.Fog).far = 500 + 600 * day;
    }
    if (this.stars) {
      (this.stars.material as THREE.PointsMaterial).opacity = night * 0.95;
      this.stars.visible = night > 0.15;
    }
    if (this.moon) {
      this.moon.visible = night > 0.25;
      this.moon.position.set(car.x - 500, 480, car.z - 700);
    }

    // Player headlights — real spotlights only on the player car.
    const headI = night > 0.2 ? 3.2 * night : 0;
    for (const spot of [this.headL, this.headR]) {
      if (!spot) continue;
      spot.intensity = headI;
    }
    if (this.headL && this.headR && headI > 0) {
      const yaw = car.yaw;
      const fx = Math.sin(yaw);
      const fz = Math.cos(yaw);
      const rx = Math.cos(yaw);
      const rz = -Math.sin(yaw);
      const y = heightAt(car.x, car.z) + 0.7;
      const nose = 1.6;
      this.headL.position.set(car.x + fx * nose - rx * 0.55, y, car.z + fz * nose - rz * 0.55);
      this.headR.position.set(car.x + fx * nose + rx * 0.55, y, car.z + fz * nose + rz * 0.55);
      const aim = 28;
      this.headL.target.position.set(car.x + fx * aim - rx * 0.4, y - 1.2, car.z + fz * aim - rz * 0.4);
      this.headR.target.position.set(car.x + fx * aim + rx * 0.4, y - 1.2, car.z + fz * aim + rz * 0.4);
      this.headL.target.updateMatrixWorld();
      this.headR.target.updateMatrixWorld();
    }

    // Closest few streetlights get real point lights + brighter bulbs.
    const scored = this.streetLampPos
      .map((p, i) => ({ i, d: Math.hypot(p.x - car.x, p.z - car.z), p }))
      .sort((a, b) => a.d - b.d);
    for (let i = 0; i < this.streetPool.length; i++) {
      const light = this.streetPool[i];
      const hit = scored[i];
      if (!hit || night < 0.2 || hit.d > 90) {
        light.intensity = 0;
        continue;
      }
      light.position.set(hit.p.x, hit.p.y, hit.p.z);
      light.intensity = 1.6 * night * (1 - hit.d / 90);
    }
    for (const m of this.streetLampMats) {
      m.emissiveIntensity = 0.3 + 2.2 * night;
    }

    // Building windows — random yellow/white glow at night.
    for (let i = 0; i < this.windowMats.length; i++) {
      const m = this.windowMats[i];
      if (night < 0.25) {
        m.emissiveIntensity = m.userData.dayEmissive ?? 0.15;
        continue;
      }
      if (m.userData.dayEmissive == null) m.userData.dayEmissive = m.emissiveIntensity;
      const on = ((i * 17 + Math.floor(this.timeOfDay * 40)) % 5) !== 0;
      if (!on) {
        m.emissiveIntensity = 0.05;
        continue;
      }
      const warm = (i * 13) % 2 === 0;
      m.emissive.setHex(warm ? 0xffcc66 : 0xfff8e0);
      m.emissiveIntensity = 0.7 + 0.9 * night;
    }

    // Player taillights glow red at night (emissive materials on the model).
    if (this.playerRoot && night > 0.2) {
      this.playerRoot.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          if (!(m instanceof THREE.MeshStandardMaterial)) continue;
          if (m.name === "light-tail" || m.name === "tail") {
            m.emissiveIntensity = 1.2 + 1.6 * night;
          }
          if (m.name === "light-head" || m.name === "head") {
            m.emissiveIntensity = 1.4 + 1.8 * night;
          }
        }
      });
    }
  }

  copDots() {
    return this.cops.map((c) => ({ x: c.x, z: c.z, chase: c.chase }));
  }

  applyDirt(root: THREE.Object3D) {
    const d = this.dirt;
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        if (!(m instanceof THREE.MeshStandardMaterial) && !(m instanceof THREE.MeshPhysicalMaterial)) continue;
        if (m.name !== "paint") continue;
        m.roughness = 0.22 + d * 0.55;
        m.metalness = Math.max(0.1, 0.62 - d * 0.4);
      }
    });
  }
}
