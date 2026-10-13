/**
 * WORLD-BUILD + CAR-FIXES gameplay systems: day/night, dirt, speed track,
 * mud-park laps, restaurants, car wash, traffic, cops, speed limits.
 */
import * as THREE from "three";
import { SPAWN, heightAt } from "./mapData";
import { LANDMARKS, SPEED_TRACK, SKYWAY } from "./mapZones";
import type { Car } from "./sim";

const DAY_LEN_SEC = 20 * 60; // 20-minute day

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

export class GameFeatures {
  timeOfDay = 0.35; // 0..1, morning-ish
  timePaused = false;
  copsOn = false;
  dirt = 0;
  wanted = 0;
  chaseTimer = 0;
  escapeTimer = 0;
  stoppedNearCop = 0;
  bustedFlash = 0;
  escapedFlash = 0;
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
  traffic: { x: number; z: number; yaw: number; speed: number; mesh: THREE.Group }[] = [];
  cops: { x: number; z: number; yaw: number; speed: number; mesh: THREE.Group; chase: boolean }[] = [];
  private trafficRoot = new THREE.Group();
  private copRoot = new THREE.Group();
  private hemi: THREE.HemisphereLight | null = null;
  private sun: THREE.DirectionalLight | null = null;
  private scene: THREE.Scene | null = null;
  private stars: THREE.Points | null = null;

  attach(scene: THREE.Scene, hemi: THREE.HemisphereLight, sun: THREE.DirectionalLight) {
    this.scene = scene;
    this.hemi = hemi;
    this.sun = sun;
    scene.add(this.trafficRoot, this.copRoot);
    this.buildStars();
    this.spawnTraffic();
  }

  private buildStars() {
    const geo = new THREE.BufferGeometry();
    const n = 800;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const b = Math.random() * 0.9;
      const r = 900 + Math.random() * 400;
      pos[i * 3] = Math.cos(a) * Math.cos(b) * r;
      pos[i * 3 + 1] = 200 + Math.sin(b) * r * 0.6;
      pos[i * 3 + 2] = Math.sin(a) * Math.cos(b) * r;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color: 0xffffff, size: 1.8, sizeAttenuation: true, transparent: true, opacity: 0 }),
    );
    this.scene?.add(this.stars);
  }

  private carMesh(color: number) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.7, 4.0),
      new THREE.MeshStandardMaterial({ color, roughness: 0.55 }),
    );
    body.position.y = 0.55;
    g.add(body);
    return g;
  }

  private spawnTraffic() {
    const colors = [0x4488cc, 0xcc4444, 0xdddddd, 0x33aa66, 0xffaa33];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const r = 820;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const mesh = this.carMesh(colors[i % colors.length]);
      mesh.position.set(x, heightAt(x, z) + 0.2, z);
      this.trafficRoot.add(mesh);
      this.traffic.push({ x, z, yaw: a + Math.PI / 2, speed: 28 + (i % 5) * 2, mesh });
    }
  }

  setCops(on: boolean) {
    this.copsOn = on;
    if (!on) {
      for (const c of this.cops) this.copRoot.remove(c.mesh);
      this.cops = [];
      this.wanted = 0;
      this.chaseTimer = 0;
      return;
    }
    if (this.cops.length) return;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      const r = 200 + (i % 2) * 600;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const mesh = this.carMesh(0x2244aa);
      // light bar
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.2, 0.4),
        new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xff0044, emissiveIntensity: 1.2 }),
      );
      bar.position.y = 1.05;
      mesh.add(bar);
      mesh.position.set(x, heightAt(x, z) + 0.2, z);
      this.copRoot.add(mesh);
      this.cops.push({ x, z, yaw: a + Math.PI / 2, speed: 32, mesh, chase: false });
    }
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

  speedLimitAt(x: number, z: number, onHighway: boolean): number {
    if (Math.hypot(x, z) > SKYWAY.radius - 40) return 65; // skyway band
    if (onHighway) return 65;
    if (Math.hypot(x, z) < 320) return 30; // city
    return 45;
  }

  onSpeedTrack(x: number, z: number) {
    return Math.abs(z - SPEED_TRACK.z0) < SPEED_TRACK.width * 0.7 && x >= SPEED_TRACK.x0 - 50 && x <= SPEED_TRACK.x1 + 50;
  }

  update(
    dt: number,
    car: Car,
    _tune: unknown,
    mph: number,
    surface: string,
    onHighway: boolean,
    say: (t: string) => void,
  ): FeatureHud {
    if (!this.timePaused) this.timeOfDay = (this.timeOfDay + dt / DAY_LEN_SEC) % 1;
    this.applyLighting();

    // Dirt buildup
    if (surface === "Mud" || surface === "Dirt" || surface === "Sand" || surface === "Wet") {
      this.dirt = Math.min(1, this.dirt + dt * (surface === "Mud" ? 0.12 : 0.05));
    }

    // Restaurant / wash triggers
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

    // Mud park lap (start → finish)
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

    // Speed track meters
    let trackMph: number | null = null;
    if (this.onSpeedTrack(car.x, car.z)) {
      trackMph = mph;
      this.trackTop = Math.max(this.trackTop, mph);
      if (mph > this.trackBest) {
        this.trackBest = mph;
        localStorage.setItem("or-track-best", String(this.trackBest));
      }
      // 0-60 from near start line
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

    // Traffic cruise on highway ring
    for (const t of this.traffic) {
      t.yaw += (t.speed / 820) * dt;
      t.x = Math.cos(t.yaw - Math.PI / 2) * 820;
      t.z = Math.sin(t.yaw - Math.PI / 2) * 820;
      t.mesh.position.set(t.x, heightAt(t.x, t.z) + 0.2, t.z);
      t.mesh.rotation.y = t.yaw;
      // Keep gap from player
      const d = Math.hypot(t.x - car.x, t.z - car.z);
      if (d < 18) t.speed = Math.max(12, t.speed - 20 * dt);
      else t.speed = Math.min(36, t.speed + 8 * dt);
    }

    // Cops
    let anyChase = false;
    if (this.copsOn) {
      const limit = this.speedLimitAt(car.x, car.z, onHighway);
      const speeding = mph > limit + 10;
      for (const c of this.cops) {
        const d = Math.hypot(c.x - car.x, c.z - car.z);
        if (speeding && d < 80) c.chase = true;
        if (c.chase) {
          anyChase = true;
          const ang = Math.atan2(car.x - c.x, car.z - c.z);
          c.yaw = ang;
          c.speed = Math.min(55, c.speed + 10 * dt);
          c.x += Math.sin(c.yaw) * c.speed * dt;
          c.z += Math.cos(c.yaw) * c.speed * dt;
          if (d < 10 && Math.abs(car.speed) < 2) this.stoppedNearCop += dt;
          else this.stoppedNearCop = Math.max(0, this.stoppedNearCop - dt);
        } else {
          c.yaw += 0.15 * dt;
          c.x = Math.cos(c.yaw) * (200 + 400);
          c.z = Math.sin(c.yaw) * (200 + 400);
        }
        c.mesh.position.set(c.x, heightAt(c.x, c.z) + 0.2, c.z);
        c.mesh.rotation.y = c.yaw;
        // Flash lights
        const bar = c.mesh.children[1] as THREE.Mesh | undefined;
        if (bar && c.chase) {
          const mat = bar.material as THREE.MeshStandardMaterial;
          mat.emissive.set(Math.sin(performance.now() * 0.02) > 0 ? 0xff0044 : 0x0044ff);
        }
      }
      if (anyChase) {
        this.wanted = Math.min(5, this.wanted + dt * 0.15);
        this.chaseTimer += dt;
        this.escapeTimer = 0;
      } else if (this.wanted > 0) {
        this.escapeTimer += dt;
        if (this.escapeTimer > 15) {
          this.wanted = 0;
          this.escapedFlash = 2;
          say("ESCAPED");
        }
      }
      if (this.stoppedNearCop > 3) {
        this.bustedFlash = 2.5;
        this.wanted = 0;
        this.stoppedNearCop = 0;
        for (const c of this.cops) c.chase = false;
        car.x = SPAWN.x;
        car.z = SPAWN.z;
        car.speed = 0;
        say("BUSTED");
      }
    }
    this.bustedFlash = Math.max(0, this.bustedFlash - dt);
    this.escapedFlash = Math.max(0, this.escapedFlash - dt);

    return {
      speedLimit: this.speedLimitAt(car.x, car.z, onHighway),
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

  nightFactor() {
    // 0 day … 1 night
    const t = this.timeOfDay;
    if (t < 0.2) return 1 - t / 0.2; // sunrise from night
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

  private applyLighting() {
    if (!this.hemi || !this.sun || !this.scene) return;
    const night = this.nightFactor();
    const day = 1 - night;
    this.hemi.intensity = 0.25 + 0.7 * day;
    this.sun.intensity = 0.15 + 1.4 * day;
    this.sun.color.set(night > 0.5 ? 0x8899bb : 0xfff8ee);
    const sky = new THREE.Color().setHSL(0.6, 0.55, 0.15 + 0.55 * day);
    this.scene.background = sky;
    if (this.scene.fog) {
      this.scene.fog.color.copy(sky);
      (this.scene.fog as THREE.Fog).near = 120 + 60 * day;
      (this.scene.fog as THREE.Fog).far = 700 + 400 * day;
    }
    if (this.stars) {
      (this.stars.material as THREE.PointsMaterial).opacity = night * 0.9;
    }
  }

  copDots() {
    return this.cops.map((c) => ({ x: c.x, z: c.z, chase: c.chase }));
  }

  /** Apply dirt darkening to car paint materials. */
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
        // keep color; boost roughness reads as dirty
      }
    });
  }
}
