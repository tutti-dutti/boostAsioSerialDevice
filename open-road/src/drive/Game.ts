import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EngineAudio } from "./audio";
import { loadCarModel, setCarEnvironment, type CarVisual } from "./car";
import { GARAGE, carById, type GarageCar } from "./garage";
import {
  REDLINE,
  DEFAULT_SETUP,
  gearLabel,
  makeCar,
  resetCar,
  climbBumpAt,
  resolveBorder,
  resolveCollisions,
  resolveWater,
  stepCar,
  surfaceUnderCar,
  type Car,
  type Input,
  type Setup,
  type Tune,
} from "./sim";
import { SPAWN, SURFACE_LIFT, carSurfaceHeight, heightAt } from "./mapData";
import { createWorld } from "./world";
import { GameFeatures, type TimePreset } from "./gameFeatures";
import { bumpCars, readP1Keys, readP2Keys, type SplitHud } from "./splitSupport";

export type FrameInfo = {
  mph: number;
  gear: string;
  rpm: number;
  redline: number;
  x: number;
  z: number;
  yaw: number;
  surface: string;
  camera: string;
  toast: string;
  audioOn: boolean;
  carName: string;
  assists: string;
  speedLimit?: number;
  wanted?: number;
  chase?: boolean;
  busted?: boolean;
  escaped?: boolean;
  lapTime?: number | null;
  bestLap?: number | null;
  trackTop?: number | null;
  trackBest?: number | null;
  zeroSixty?: number | null;
  timeLabel?: string;
  copsOn?: boolean;
  dirt?: number;
  split?: boolean;
  p2?: SplitHud;
};

type CamMode = "chase" | "bumper" | "hood" | "free";

const CAM_LABEL: Record<CamMode, string> = {
  chase: "Chase",
  bumper: "Bumper",
  hood: "Hood",
  free: "Freecam",
};

export class DriveGame {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private sun: THREE.DirectionalLight;
  private car: Car = makeCar();
  private visual: CarVisual = emptyCar();
  private world = createWorld();
  private audio = new EngineAudio();
  private keys = new Set<string>();
  private holds = new Set<string>();
  private running = false;
  private looping = false;
  private last = 0;
  private roll = 0;
  private snap = true;
  private camMode: CamMode = "chase";
  private camBeforeFree: CamMode = "chase";
  private freeYaw = 0;
  private freeDist = 14;
  private freeHeight = 5;
  private impactCool = 0;
  private toast = "";
  private toastTimer = 0;
  private padArmed = false;
  private hornHeld = false;
  private camHeld = false;
  private resetHeld = false;
  private inputBlocked = false;
  private ride: GarageCar = GARAGE[0];
  private tune: Tune = GARAGE[0].tune;
  private setup: Setup = { ...DEFAULT_SETUP };
  private shiftUp = false;
  private shiftDown = false;
  private switching = false;
  private inWater = false;
  /** Seconds of remaining launch camera shake (EV truck punch). */
  private launchShake = 0;
  private lastThrottle = 0;
  /** Per-wheel ground height deltas used for long-travel wheel well motion. */
  private wheelGround: [number, number, number, number] = [0, 0, 0, 0];
  /** Smoothed steer so keyboard A/D is not instant full lock. */
  private steerSmooth = 0;
  private features = new GameFeatures();
  private readonly desired = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private readonly onFrame: (info: FrameInfo) => void;
  /** 2-player split-screen (left = P1 WASD, right = P2 Arrows). */
  private splitMode = false;
  private car2: Car = makeCar();
  private visual2: CarVisual = emptyCar();
  private ride2: GarageCar = GARAGE[0];
  private tune2: Tune = GARAGE[0].tune;
  private steerSmooth2 = 0;
  private camera2: THREE.PerspectiveCamera;
  private keyCodes = new Set<string>();
  private readonly desired2 = new THREE.Vector3();
  private readonly look2 = new THREE.Vector3();
  private lastFeat2: SplitHud | null = null;

  constructor(canvas: HTMLCanvasElement, onFrame: (info: FrameInfo) => void) {
    this.onFrame = onFrame;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.shadowMap.enabled = false;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    setCarEnvironment(pmrem.fromScene(new RoomEnvironment(), 0.04).texture);
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(62, 1, 0.35, 9000);
    this.camera2 = new THREE.PerspectiveCamera(62, 1, 0.35, 4500);
    this.resize();

    this.scene.background = new THREE.Color(0x8ecfff);
    this.scene.fog = new THREE.Fog(0x9fd4f5, 180, 1400);

    const hemi = new THREE.HemisphereLight(0xfff0dc, 0x4e8a46, 0.95);
    this.scene.add(hemi);
    this.sun = new THREE.DirectionalLight(0xfff8ee, 1.55);
    this.sun.castShadow = false;
    this.scene.add(this.sun, this.sun.target);

    this.scene.add(this.world.object, this.visual.root);
    this.features.attach(this.scene, hemi, this.sun);
    this.placeCar();
    void this.mountCar();

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("resize", this.resize);
    // Defer first HUD paint so the caller's `game` binding is assigned.
    queueMicrotask(() => this.draw(0));
  }

  setCops(on: boolean) {
    this.features.setCops(on);
    this.say(on ? "Cops ON" : "Cops OFF");
  }

  copsOn() {
    return this.features.copsOn;
  }

  copDots() {
    return this.features.copDots();
  }

  setTimePreset(preset: TimePreset) {
    this.features.setTimePreset(preset);
    this.say(`Time: ${this.features.timeLabel()}`);
  }

  private async mountCar() {
    try {
      const next = await loadCarModel(this.ride.model, this.ride.look);
      this.scene.remove(this.visual.root);
      this.visual = next;
      this.scene.add(next.root);
      this.features.setPlayerRoot(next.root);
      this.audio.setVoice(this.ride.voice);
      this.placeCar();
    } catch (err) {
      console.error("Could not load the car model", err);
    }
  }

  hold(action: string, down: boolean) {
    if (down) this.holds.add(action);
    else this.holds.delete(action);
  }

  playMusic() {
    this.audio.playMusic();
  }

  /** Resume Web Audio after a click or key (browsers block sound until then). */
  unlockAudio() {
    void this.audio.unlock();
  }

  /** Lambchop engine mix readout for tests. */
  audioDebug() {
    return { on: this.audio.on, voice: this.ride.voice, ...this.audio.debug };
  }

  setInputBlocked(blocked: boolean) {
    this.inputBlocked = blocked;
    if (blocked) this.holds.clear();
  }

  getSetup() {
    return { ...this.setup };
  }

  setSetup(patch: Partial<Setup>) {
    this.setup = { ...this.setup, ...patch };
  }

  currentCarId() {
    return this.ride.id;
  }

  currentCarIdP2() {
    return this.ride2.id;
  }

  isSplit() {
    return this.splitMode;
  }

  /** Start left/right split-screen with P2's chosen garage car. */
  async enableSplit(p2CarId: string) {
    this.splitMode = true;
    this.ride2 = carById(p2CarId);
    this.tune2 = this.ride2.tune;
    try {
      const next = await loadCarModel(this.ride2.model, this.ride2.look);
      this.scene.remove(this.visual2.root);
      this.visual2 = next;
      this.scene.add(next.root);
    } catch (err) {
      console.error("P2 car failed to load", err);
    }
    // Side-by-side at the dealership facing the doors.
    resetCar(this.car);
    this.car.x = SPAWN.x - 2.2;
    this.car.z = SPAWN.z;
    this.car.yaw = SPAWN.yaw;
    this.car2 = makeCar();
    this.car2.x = SPAWN.x + 2.2;
    this.car2.z = SPAWN.z;
    this.car2.yaw = SPAWN.yaw;
    this.steerSmooth = 0;
    this.steerSmooth2 = 0;
    this.snap = true;
    this.camera.far = 4500;
    this.camera2.far = 4500;
    this.placeCar(0);
    this.placeCar2(0);
    this.say("2 Players — Left WASD · Right Arrows");
    this.resize();
  }

  disableSplit() {
    this.splitMode = false;
    this.scene.remove(this.visual2.root);
    this.visual2 = emptyCar();
    this.camera.far = 9000;
    this.lastFeat2 = null;
    this.say("Back to 1 Player");
    this.resize();
  }

  async switchCar(id: string) {
    const nextRide = carById(id);
    if (nextRide.id === this.ride.id || this.switching) return;
    this.switching = true;
    this.say(`Getting ${nextRide.label}...`);
    try {
      const next = await loadCarModel(nextRide.model, nextRide.look);
      this.scene.remove(this.visual.root);
      this.visual = next;
      this.scene.add(next.root);
      this.ride = nextRide;
      this.tune = nextRide.tune;
      this.audio.setVoice(nextRide.voice);
      this.features.setPlayerRoot(next.root);
      // Keep xz/yaw/speed — nudge clear of solids so a bigger body isn't inside a boulder.
      this.clearSpawnOverlap();
      this.placeCar(0);
      this.say(`${nextRide.label} is ready`);
    } catch (err) {
      console.error("Could not switch cars", err);
      this.say("That car did not load");
    } finally {
      this.switching = false;
    }
  }

  /** If the car overlaps a solid, walk backward/sideways to the nearest clear spot. */
  private clearSpawnOverlap() {
    const car = this.car;
    const colliders = this.world.colliders;
    const radius = 1.6;
    const blocked = (x: number, z: number) => {
      for (const c of colliders) {
        if (c.soft && c.soft !== "solid") continue;
        if (c.kind === "circle") {
          if (Math.hypot(x - c.x, z - c.z) < c.r + radius) return true;
        } else if (c.kind === "box") {
          if (Math.abs(x - c.x) < c.hx + radius && Math.abs(z - c.z) < c.hz + radius) return true;
        }
      }
      return false;
    };
    if (!blocked(car.x, car.z)) return;
    const fx = Math.sin(car.yaw);
    const fz = Math.cos(car.yaw);
    const rx = Math.cos(car.yaw);
    const rz = -Math.sin(car.yaw);
    for (let dist = 2; dist <= 18; dist += 2) {
      for (const [sx, sz] of [
        [-fx * dist, -fz * dist],
        [rx * dist, rz * dist],
        [-rx * dist, -rz * dist],
        [fx * dist, fz * dist],
      ]) {
        const nx = car.x + sx;
        const nz = car.z + sz;
        if (!blocked(nx, nz)) {
          car.x = nx;
          car.z = nz;
          return;
        }
      }
    }
  }

  async start() {
    this.audio.playMusic();
    try {
      await this.audio.start();
    } catch {
      /* The car still drives if sound is blocked. */
    }
    this.running = true;
    this.snap = true;
    if (!this.looping) {
      this.looping = true;
      this.last = performance.now();
      requestAnimationFrame(this.frame);
    }
  }

  pause() {
    this.running = false;
    this.audio.silence();
  }

  reset() {
    resetCar(this.car);
    this.inWater = false;
    this.snap = true;
    this.launchShake = 0;
    this.lastThrottle = 0;
    this.steerSmooth = 0;
    this.say("Back to the start");
  }

  horn() {
    this.audio.horn();
  }

  cycleCam() {
    if (this.camMode === "free") return;
    this.camMode = this.camMode === "chase" ? "bumper" : this.camMode === "bumper" ? "hood" : "chase";
    this.snap = true;
  }

  toggleFreecam() {
    if (this.camMode === "free") {
      this.camMode = this.camBeforeFree;
      this.snap = true;
      this.setInputBlocked(false);
      this.say("Camera: " + CAM_LABEL[this.camMode]);
    } else {
      this.camBeforeFree = this.camMode;
      this.camMode = "free";
      this.freeYaw = this.car.yaw + Math.PI;
      this.freeDist = 14;
      this.freeHeight = 5;
      this.snap = true;
      this.setInputBlocked(true);
      this.say("Freecam · WASD move · Q/E up/down · F exit");
    }
  }

  /** Rear three-quarter for garage screenshots. */
  setRearFreecam(dist = 10, height = 2.2) {
    this.camBeforeFree = this.camMode === "free" ? this.camBeforeFree : this.camMode;
    this.camMode = "free";
    this.freeYaw = this.car.yaw;
    this.freeDist = dist;
    this.freeHeight = height;
    this.snap = true;
    this.setInputBlocked(true);
  }

  /** Side silhouette for garage screenshots (freecam orbit). */
  setSideFreecam(dist = 9, height = 1.8) {
    if (this.camMode !== "free") {
      this.camBeforeFree = this.camMode;
      this.setInputBlocked(true);
    }
    this.camMode = "free";
    this.freeYaw = this.car.yaw + Math.PI / 2;
    this.freeDist = dist;
    this.freeHeight = height;
    this.snap = true;
  }

  private say(text: string) {
    this.toast = text;
    this.toastTimer = 2.2;
  }

  private onKeyDown = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (e.code === "Space") this.keys.add(" ");
    this.keys.add(k);
    this.keyCodes.add(e.code);
    if (this.splitMode && e.code === "KeyQ" && !e.repeat) this.audio.horn();
    if (this.splitMode && e.code === "Enter" && !e.repeat) this.audio.horn();
    if (k.startsWith("arrow") || e.code === "Space") e.preventDefault();
    if (!this.running || e.repeat) return;
    if (k === "f") this.toggleFreecam();
    if (k === "c" && this.camMode !== "free") this.cycleCam();
    if (k === "r") this.reset();
    if (k === "h") this.audio.horn();
    if (!this.setup.auto && this.camMode !== "free" && k === "e") this.shiftUp = true;
    if (!this.setup.auto && this.camMode !== "free" && k === "q") this.shiftDown = true;
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.key.toLowerCase());
    if (e.code === "Space") this.keys.delete(" ");
    this.keyCodes.delete(e.code);
  };

  private resize = () => {
    const w = window.innerWidth;
    const h = Math.max(1, window.innerHeight);
    this.renderer.setSize(w, h);
    if (this.splitMode) {
      // Side-by-side halves — use half-width aspect so cars aren't stretched.
      const halfAspect = Math.max(0.2, w * 0.5) / h;
      this.camera.aspect = halfAspect;
      this.camera2.aspect = halfAspect;
    } else {
      this.camera.aspect = w / h;
    }
    this.camera.updateProjectionMatrix();
    this.camera2.updateProjectionMatrix();
  };

  private smoothSteer(rawSteer: number, which: 1 | 2, dt: number) {
    const slot = which === 1 ? "steerSmooth" : "steerSmooth2";
    let s = which === 1 ? this.steerSmooth : this.steerSmooth2;
    const target = Math.max(-1, Math.min(1, rawSteer));
    const digital = Math.abs(target) >= 0.95;
    if (Math.abs(target) < 0.02) {
      const step = 8.5 * dt;
      if (Math.abs(s) <= step) s = 0;
      else s -= Math.sign(s) * step;
    } else if (digital) {
      const step = (1 / 0.3) * dt;
      const want = Math.sign(target);
      if (Math.sign(s) === want || Math.abs(s) < 0.001) s = Math.max(-1, Math.min(1, s + want * step));
      else s -= Math.sign(s) * Math.min(step * 2.2, Math.abs(s));
    } else {
      s += (target - s) * (1 - Math.exp(-14 * dt));
    }
    if (Math.abs(s) < 0.008 && Math.abs(target) < 0.02) s = 0;
    if (slot === "steerSmooth") this.steerSmooth = s;
    else this.steerSmooth2 = s;
    return s;
  }

  private readInput(): Input {
    const shiftUp = this.shiftUp;
    const shiftDown = this.shiftDown;
    this.shiftUp = false;
    this.shiftDown = false;
    if (this.inputBlocked) {
      return { throttle: 0, brake: 0, steer: 0, handbrake: false, clutch: false, shiftUp: false, shiftDown: false };
    }
    if (this.splitMode) {
      const p1 = readP1Keys(this.keys, this.holds);
      return { ...p1, clutch: false, shiftUp, shiftDown };
    }
    let steer = 0;
    if (this.keys.has("a") || this.keys.has("arrowleft") || this.holds.has("left")) steer -= 1;
    if (this.keys.has("d") || this.keys.has("arrowright") || this.holds.has("right")) steer += 1;
    const key: Input = {
      throttle: this.keys.has("w") || this.keys.has("arrowup") || this.holds.has("throttle") ? 1 : 0,
      brake: this.keys.has("s") || this.keys.has("arrowdown") || this.holds.has("brake") ? 1 : 0,
      steer,
      handbrake: this.keys.has(" ") || this.holds.has("handbrake"),
      clutch: this.keys.has("shift"),
      shiftUp,
      shiftDown,
    };
    const pad = this.readPad();
    if (!pad) return key;
    return {
      throttle: Math.max(key.throttle, pad.throttle),
      brake: Math.max(key.brake, pad.brake),
      steer: Math.abs(pad.steer) > Math.abs(key.steer) ? pad.steer : key.steer,
      handbrake: key.handbrake || pad.handbrake,
      clutch: key.clutch,
      shiftUp,
      shiftDown,
    };
  }

  private readInputP2(): Input {
    if (this.inputBlocked) {
      return { throttle: 0, brake: 0, steer: 0, handbrake: false, clutch: false, shiftUp: false, shiftDown: false };
    }
    const p2 = readP2Keys(this.keys, this.keyCodes);
    return { ...p2, clutch: false, shiftUp: false, shiftDown: false };
  }

  private readPad(): Input | null {
    const pads = navigator.getGamepads?.();
    if (!pads) return null;
    let gp: Gamepad | null = null;
    for (const pad of pads) {
      if (pad?.connected) {
        gp = pad;
        break;
      }
    }
    if (!gp) return null;
    const pressed = gp.buttons.some((button) => button.pressed && button.value > 0.5);
    if (pressed) this.padArmed = true;
    if (!this.padArmed || gp.mapping !== "standard") return null;
    const steerRaw = gp.axes[0] ?? 0;
    const steer = Math.abs(steerRaw) < 0.22 ? 0 : steerRaw;
    if (gp.buttons[1]?.pressed && !this.hornHeld) this.audio.horn();
    this.hornHeld = Boolean(gp.buttons[1]?.pressed);
    if (this.running && gp.buttons[3]?.pressed && !this.camHeld) this.cycleCam();
    this.camHeld = Boolean(gp.buttons[3]?.pressed);
    if (this.running && gp.buttons[9]?.pressed && !this.resetHeld) this.reset();
    this.resetHeld = Boolean(gp.buttons[9]?.pressed);
    const throttle = gp.buttons[7]?.value ?? 0;
    const brake = gp.buttons[6]?.value ?? 0;
    return {
      throttle: throttle < 0.08 ? 0 : throttle,
      brake: brake < 0.08 ? 0 : brake,
      steer,
      handbrake: Boolean(gp.buttons[0]?.pressed),
      clutch: false,
      shiftUp: false,
      shiftDown: false,
    };
  }

  private frame = (now: number) => {
    const dt = Math.min(0.2, (now - this.last) / 1000);
    this.last = now;
    if (this.running) {
      const slice = 1 / 60;
      let left = dt;
      let steps = 0;
      while (left > 0.0001 && steps < 12) {
        this.step(Math.min(slice, left));
        left -= slice;
        steps += 1;
      }
    }
    this.draw(dt);
    if (this.running) requestAnimationFrame(this.frame);
    else this.looping = false;
  };

  private step(dt: number) {
    const raw = this.readInput();
    const input = { ...raw, steer: this.smoothSteer(raw.steer, 1, dt) };
    const surface = surfaceUnderCar(this.car.x, this.car.z, this.car.yaw, this.world.roads, this.car.y);
    const { skid, pitch, roll, wheels, wheel } = stepCar(this.car, input, surface, dt, this.tune, this.setup);
    const wet = resolveWater(this.car);
    if (wet && !this.inWater) this.say("You can't drive on the water");
    this.inWater = wet;
    resolveBorder(this.car);
    const { impact, overs } = resolveCollisions(this.car, this.world.colliders, this.tune);
    this.world.flattenProps?.(overs);
    this.impactCool = Math.max(0, this.impactCool - dt);
    if (impact > 6 && this.impactCool <= 0) {
      this.audio.impact(Math.min(impact, 18));
      this.say("Bump!");
      this.impactCool = 0.55;
    }
    // Swamp Beast-class EV: little camera punch when flooring from a stop.
    if (
      this.tune.launchGrip &&
      input.throttle > 0.85 &&
      this.lastThrottle <= 0.85 &&
      Math.abs(this.car.speed) < 4 &&
      !this.car.reverse
    ) {
      this.launchShake = Math.max(this.launchShake, 0.55);
    }
    this.launchShake = Math.max(0, this.launchShake - dt);
    this.lastThrottle = input.throttle;
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toast = "";
    }

    const gear = gearLabel(this.car, input.throttle, this.setup.auto, !!this.tune.singleSpeed);
    this.audio.update({
      rpm: this.car.rpm,
      throttle: input.throttle,
      speed: Math.abs(this.car.speed),
      skid,
      gear,
      active: true,
    });

    this.roll += (this.car.speed / this.visual.wheelRadius) * dt;
    const steerVis = -wheel;

    const mph = Math.abs(this.car.speed) * 2.23694;
    const onHighway = surface.name === "Dry" && Math.hypot(this.car.x, this.car.z) > 500;
    const feat = this.features.update(dt, this.car, this.tune, mph, surface.name, onHighway, (t) => this.say(t));
    this.features.applyDirt(this.visual.root);

    this.placeCar(dt);

    // Player 2 sim (split-screen)
    if (this.splitMode) {
      const raw2 = this.readInputP2();
      const input2 = { ...raw2, steer: this.smoothSteer(raw2.steer, 2, dt) };
      const surface2 = surfaceUnderCar(this.car2.x, this.car2.z, this.car2.yaw, this.world.roads, this.car2.y);
      const step2 = stepCar(this.car2, input2, surface2, dt, this.tune2, this.setup);
      resolveBorder(this.car2);
      resolveCollisions(this.car2, this.world.colliders, this.tune2);
      resolveWater(this.car2);
      bumpCars(this.car, this.car2);
      this.placeCar2(dt);
      const mph2 = Math.abs(this.car2.speed) * 2.23694;
      const onHighway2 = surface2.name === "Dry" && Math.hypot(this.car2.x, this.car2.z) > 500;
      const feat2 = this.features.updatePlayer2(dt, this.car2, this.tune2, mph2, onHighway2, (t) => this.say(t));
      this.lastFeat2 = {
        mph: mph2,
        gear: gearLabel(this.car2, input2.throttle, this.setup.auto, !!this.tune2.singleSpeed),
        speedLimit: feat2.speedLimit,
        wanted: feat2.wanted,
        chase: feat2.chase,
        x: this.car2.x,
        z: this.car2.z,
        yaw: this.car2.yaw,
        surface: surface2.name,
      };
      void step2;
    } else {
      this.lastFeat2 = null;
    }
    // Long-travel wheels visibly soak bumps in the wells; others stay subtle.
    const travelMul = this.tune.longTravel ? 1.15 : 0.45;
    const travelClamp = this.tune.longTravel ? 0.52 : 0.18;
    for (const wheelRig of this.visual.wheels) {
      wheelRig.spin.rotation.x = this.roll;
      if (wheelRig.front) wheelRig.pivot.rotation.y = steerVis;
      const data = wheelRig.pivot.userData;
      if (typeof data.restY !== "number") data.restY = wheelRig.pivot.position.y;
      const index = (wheelRig.front ? 0 : 2) + (wheelRig.pivot.position.x > 0 ? 1 : 0);
      const suspDrop = (wheels[index] ?? 0.08) * travelMul;
      const groundPush = this.tune.longTravel ? this.wheelGround[index] * 0.85 : 0;
      const drop = clampLeanAmt(suspDrop + groundPush, -0.12, travelClamp);
      wheelRig.pivot.position.y = (data.restY as number) - drop;
    }

    const leanMul = this.tune.longTravel ? 0.55 : 1;
    this.visual.chassis.rotation.z += (clampLean(roll * leanMul) - this.visual.chassis.rotation.z) * 0.35;
    this.visual.chassis.rotation.x += (clampLean(pitch * leanMul) - this.visual.chassis.rotation.x) * 0.35;
    const glow = input.brake > 0 && this.car.speed > 0.4 ? 2.8 : 1.15;
    this.visual.tail.emissiveIntensity = glow;
    for (const mat of this.visual.tailLights) mat.emissiveIntensity = glow;

    this.world.updateChunks(this.car.x, this.car.z);
    this.placeCamera(dt);
    if (this.splitMode) this.placeCamera2(dt);
    this.followSun();

    const targetFov = this.camMode === "hood" ? 74 : 58 + Math.min(6, Math.abs(this.car.speed) * 0.06);
    this.camera.fov += (targetFov - this.camera.fov) * (1 - Math.exp(-3 * dt));
    this.camera.updateProjectionMatrix();
    if (this.splitMode) {
      this.camera2.fov = this.camera.fov;
      this.camera2.updateProjectionMatrix();
    }

    this.onFrame(this.frameInfo(gear, surface.name, undefined, feat));
  }

  private placeCar2(dt = 1 / 60) {
    const isTruck = this.tune2.offroad >= 1.2 || this.tune2.mass >= 2300;
    const fx = Math.sin(this.car2.yaw);
    const fz = Math.cos(this.car2.yaw);
    const rx = Math.cos(this.car2.yaw);
    const rz = -Math.sin(this.car2.yaw);
    const axle = 1.35;
    const track = 0.9;
    const sample = (ox: number, oz: number) => {
      const base = carSurfaceHeight(ox, oz, this.car2.y);
      const bump = base < this.car2.y - 3 ? 0 : climbBumpAt(ox, oz, this.world.colliders, isTruck);
      return base + bump;
    };
    const fl = sample(this.car2.x + fx * axle - rx * track, this.car2.z + fz * axle - rz * track);
    const fr = sample(this.car2.x + fx * axle + rx * track, this.car2.z + fz * axle + rz * track);
    const rl = sample(this.car2.x - fx * axle - rx * track, this.car2.z - fz * axle - rz * track);
    const rr = sample(this.car2.x - fx * axle + rx * track, this.car2.z - fz * axle + rz * track);
    const avg = (fl + fr + rl + rr) * 0.25;
    const target = avg + SURFACE_LIFT + this.visual2.ride;
    const gap = this.car2.y - target;
    if (gap > 0.25) {
      this.car2.vy -= 28 * dt;
      this.car2.y += this.car2.vy * dt;
      this.car2.airTime += dt;
      if (this.car2.y < target) {
        this.car2.y = target;
        this.car2.vy = 0;
        this.car2.airTime = 0;
      }
    } else {
      this.car2.y += (target - this.car2.y) * 0.55;
      this.car2.vy = 0;
      this.car2.airTime = 0;
    }
    this.visual2.root.position.set(this.car2.x, this.car2.y, this.car2.z);
    this.visual2.root.rotation.order = "YXZ";
    this.visual2.root.rotation.y = this.car2.yaw;
  }

  private placeCar(dt = 1 / 60) {
    const isTruck = this.tune.offroad >= 1.2 || this.tune.mass >= 2300;
    const fx = Math.sin(this.car.yaw);
    const fz = Math.cos(this.car.yaw);
    const rx = Math.cos(this.car.yaw);
    const rz = -Math.sin(this.car.yaw);
    const axle = 1.35;
    const track = 0.9;
    const sample = (ox: number, oz: number) => {
      const base = carSurfaceHeight(ox, oz, this.car.y);
      // Only climb rocks when on the ground, not while under/on the bridge span.
      const bump = base < this.car.y - 3 ? 0 : climbBumpAt(ox, oz, this.world.colliders, isTruck);
      return base + bump;
    };
    const fl = sample(this.car.x + fx * axle - rx * track, this.car.z + fz * axle - rz * track);
    const fr = sample(this.car.x + fx * axle + rx * track, this.car.z + fz * axle + rz * track);
    const rl = sample(this.car.x - fx * axle - rx * track, this.car.z - fz * axle - rz * track);
    const rr = sample(this.car.x - fx * axle + rx * track, this.car.z - fz * axle + rz * track);
    const avg = (fl + fr + rl + rr) * 0.25;
    // Relative bumps so long-travel wheels climb into the wells over rocks/dirt.
    this.wheelGround = [fl - avg, fr - avg, rl - avg, rr - avg];
    if (this.tune.longTravel && this.car.airTime === 0) {
      for (let i = 0; i < 4; i++) {
        const bump = Math.max(0, this.wheelGround[i]);
        if (bump < 0.01) continue;
        this.car.susp[i] = Math.min(0.58, this.car.susp[i] + bump * 0.45);
        this.car.suspV[i] *= 0.85;
      }
    }
    const target = avg + SURFACE_LIFT + this.visual.ride;

    // Gravity when not touching the surface — never hover or stick to pillars.
    const gap = this.car.y - target;
    if (gap > 0.25) {
      this.car.vy -= 28 * dt;
      this.car.y += this.car.vy * dt;
      this.car.airTime += dt;
      if (this.car.y <= target) {
        const impact = Math.max(0, -this.car.vy);
        if (this.tune.longTravel && impact > 2) {
          // Compress, then settle in one smooth rebound — no wild bounce/flip.
          const punch = Math.min(0.45, impact * 0.032);
          for (let i = 0; i < 4; i++) {
            this.car.susp[i] = Math.min(0.58, this.car.susp[i] + punch);
            this.car.suspV[i] = Math.min(this.car.suspV[i], -impact * 0.1);
          }
          this.car.y = target + punch * 0.4;
          this.car.vy = -impact * 0.08;
        } else {
          this.car.y = target;
          this.car.vy = 0;
        }
        this.car.airTime = 0;
      } else if (this.car.airTime > 2) {
        // Stuck floating for too long — drop straight to the ground/deck.
        this.car.y = target;
        this.car.vy = 0;
        this.car.airTime = 0;
      }
    } else {
      const follow = this.tune.longTravel ? 0.38 : 0.55;
      this.car.y += (target - this.car.y) * follow;
      this.car.vy = 0;
      this.car.airTime = 0;
    }

    this.visual.root.position.set(this.car.x, this.car.y, this.car.z);
    this.visual.root.rotation.order = "YXZ";
    this.visual.root.rotation.y = this.car.yaw;
    const leanScale = this.tune.longTravel ? 0.07 : 0.12;
    const pitch = THREE.MathUtils.clamp(((rl + rr) - (fl + fr)) * leanScale, -0.14, 0.14);
    const roll = THREE.MathUtils.clamp(((fr + rr) - (fl + rl)) * leanScale, -0.12, 0.12);
    this.visual.root.rotation.x = pitch;
    this.visual.root.rotation.z = roll;
  }

  private placeCamera(dt: number) {
    const carY = this.visual.root.position.y;
    if (this.camMode === "free") {
      // Orbit / fly around the car. WASD strafe & dolly, Q/E height.
      let yaw = this.freeYaw;
      let dist = this.freeDist;
      let height = this.freeHeight;
      if (this.keys.has("a") || this.keys.has("arrowleft")) yaw += 1.4 * dt;
      if (this.keys.has("d") || this.keys.has("arrowright")) yaw -= 1.4 * dt;
      if (this.keys.has("w") || this.keys.has("arrowup")) dist = Math.max(4, dist - 10 * dt);
      if (this.keys.has("s") || this.keys.has("arrowdown")) dist = Math.min(40, dist + 10 * dt);
      if (this.keys.has("e")) height = Math.min(28, height + 8 * dt);
      if (this.keys.has("q")) height = Math.max(1.5, height - 8 * dt);
      this.freeYaw = yaw;
      this.freeDist = dist;
      this.freeHeight = height;
      const fx = Math.sin(yaw);
      const fz = Math.cos(yaw);
      this.desired.set(this.car.x - fx * dist, carY + height, this.car.z - fz * dist);
      this.look.set(this.car.x, carY + 1.0, this.car.z);
    } else {
      const fx = Math.sin(this.car.yaw);
      const fz = Math.cos(this.car.yaw);
      if (this.camMode === "chase") {
        this.desired.set(this.car.x - fx * 13.5, carY + 5.2, this.car.z - fz * 13.5);
        this.look.set(this.car.x + fx * 10, carY + 1.1, this.car.z + fz * 10);
      } else if (this.camMode === "bumper") {
        this.desired.set(this.car.x - fx * 4.3, carY + 1.55, this.car.z - fz * 4.3);
        this.look.set(this.car.x + fx * 8, carY + 0.85, this.car.z + fz * 8);
      } else {
        this.desired.set(this.car.x + fx * 0.7, carY + 1.1, this.car.z + fz * 0.7);
        this.look.set(this.car.x + fx * 14, carY + 0.9, this.car.z + fz * 14);
      }
    }
    // Keep the camera above the terrain and out of the car.
    const floor = heightAt(this.desired.x, this.desired.z) + SURFACE_LIFT + 2.4;
    this.desired.y = Math.max(this.desired.y, floor, carY + (this.camMode === "free" ? 0.5 : 1.2));
    // If trees/buildings sit between chase cam and car, pull the camera closer.
    if (this.camMode === "chase") {
      const fx = Math.sin(this.car.yaw);
      const fz = Math.cos(this.car.yaw);
      let dist = 13.5;
      for (let t = 0.25; t < 0.95; t += 0.12) {
        const x = this.car.x - fx * dist * t;
        const z = this.car.z - fz * dist * t;
        const yLine = carY + 5.2 * (1 - t) + (carY + 1.1) * t;
        // Tall prop near the sight line (trees ~4–6 m).
        for (const c of this.world.colliders) {
          if (c.kind !== "circle" || c.soft === "shrub") continue;
          const d = Math.hypot(c.x - x, c.z - z);
          if (d < c.r + 1.8 && yLine < carY + 7) {
            dist = Math.max(5.5, dist * t * 0.92);
            break;
          }
        }
      }
      this.desired.set(this.car.x - fx * dist, carY + 3.8 + dist * 0.1, this.car.z - fz * dist);
      this.desired.y = Math.max(this.desired.y, heightAt(this.desired.x, this.desired.z) + SURFACE_LIFT + 2.4);
    }
    if (this.snap) {
      this.camera.position.copy(this.desired);
      this.snap = false;
    } else {
      const k = this.camMode === "chase" ? 4.2 : this.camMode === "free" ? 8 : 10;
      this.camera.position.lerp(this.desired, 1 - Math.exp(-k * dt));
    }
    const camFloor = heightAt(this.camera.position.x, this.camera.position.z) + SURFACE_LIFT + 2.2;
    if (this.camera.position.y < camFloor) this.camera.position.y = camFloor;
    if (this.launchShake > 0 && this.camMode !== "free") {
      const amp = 0.09 * (this.launchShake / 0.55);
      this.camera.position.x += (Math.random() - 0.5) * amp;
      this.camera.position.y += (Math.random() - 0.5) * amp * 0.7;
      this.camera.position.z += (Math.random() - 0.5) * amp;
    }
    this.camera.lookAt(this.look);
  }

  private placeCamera2(dt: number) {
    const carY = this.visual2.root.position.y;
    const fx = Math.sin(this.car2.yaw);
    const fz = Math.cos(this.car2.yaw);
    this.desired2.set(this.car2.x - fx * 12, carY + 4.8, this.car2.z - fz * 12);
    this.look2.set(this.car2.x + fx * 10, carY + 1.1, this.car2.z + fz * 10);
    const floor = heightAt(this.desired2.x, this.desired2.z) + SURFACE_LIFT + 2.4;
    this.desired2.y = Math.max(this.desired2.y, floor, carY + 1.2);
    this.camera2.position.lerp(this.desired2, 1 - Math.exp(-4.2 * dt));
    const camFloor = heightAt(this.camera2.position.x, this.camera2.position.z) + SURFACE_LIFT + 2.2;
    if (this.camera2.position.y < camFloor) this.camera2.position.y = camFloor;
    this.camera2.lookAt(this.look2);
  }

  private frameInfo(
    gear: string,
    surface: string,
    mph?: number,
    feat?: ReturnType<GameFeatures["update"]>,
  ): FrameInfo {
    return {
      mph: mph ?? Math.round(Math.abs(this.car.speed) * 2.23694),
      gear,
      rpm: this.car.rpm,
      redline: REDLINE,
      x: this.car.x,
      z: this.car.z,
      yaw: this.car.yaw,
      surface,
      camera: CAM_LABEL[this.camMode],
      toast: this.toast,
      audioOn: this.audio.on,
      carName: this.ride.label,
      assists: `${this.setup.auto ? "Auto" : "Manual"} · ${this.setup.handling === "sim" ? "Sim" : "Arcade"} · TC ${this.setup.tc ? "on" : "off"} · ABS ${this.setup.abs ? "on" : "off"}`,
      speedLimit: feat?.speedLimit,
      wanted: feat?.wanted,
      chase: feat?.chase,
      busted: feat?.busted,
      escaped: feat?.escaped,
      lapTime: feat?.lapTime,
      bestLap: feat?.bestLap,
      trackTop: feat?.trackTop,
      trackBest: feat?.trackBest,
      zeroSixty: feat?.zeroSixty,
      timeLabel: feat?.timeLabel,
      copsOn: feat?.copsOn,
      dirt: feat?.dirt,
      split: this.splitMode,
      p2: this.lastFeat2 ?? undefined,
    };
  }

  private followSun() {
    const y = this.visual.root.position.y;
    this.sun.position.set(this.car.x + 40, y + 80, this.car.z + 20);
    this.sun.target.position.set(this.car.x, y, this.car.z);
    this.sun.target.updateMatrixWorld();
  }

  private draw(dt: number) {
    if (!this.running) {
      this.placeCar();
      this.placeCamera(Math.max(dt, 0.016));
      if (this.splitMode) {
        this.placeCar2();
        this.placeCamera2(Math.max(dt, 0.016));
      }
      this.followSun();
      this.onFrame(this.frameInfo("N", "Road", 0));
    }
    const w = this.renderer.domElement.width;
    const h = this.renderer.domElement.height;
    if (this.splitMode) {
      this.renderer.setScissorTest(true);
      const half = Math.floor(w * 0.5);
      // Left half — Player 1 (WASD)
      this.renderer.setViewport(0, 0, half, h);
      this.renderer.setScissor(0, 0, half, h);
      this.renderer.render(this.scene, this.camera);
      // Right half — Player 2 (Arrows)
      this.renderer.setViewport(half, 0, w - half, h);
      this.renderer.setScissor(half, 0, w - half, h);
      this.renderer.render(this.scene, this.camera2);
      this.renderer.setScissorTest(false);
      this.renderer.setViewport(0, 0, w, h);
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }
}

function clampLean(v: number) {
  return Math.max(-0.1, Math.min(0.1, v));
}

function clampLeanAmt(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function emptyCar(): CarVisual {
  const root = new THREE.Group();
  const chassis = new THREE.Group();
  root.add(chassis);
  return {
    root,
    chassis,
    wheels: [],
    tail: new THREE.MeshStandardMaterial(),
    head: new THREE.MeshStandardMaterial(),
    tailLights: [],
    wheelRadius: 0.55,
    ride: 0,
  };
}
