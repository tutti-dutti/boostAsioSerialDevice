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
  surfaceAt,
  type Car,
  type Input,
  type Setup,
  type Tune,
} from "./sim";
import { SURFACE_LIFT, carSurfaceHeight, heightAt } from "./mapData";
import { createWorld } from "./world";

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
  private readonly desired = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private readonly onFrame: (info: FrameInfo) => void;

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

    this.camera = new THREE.PerspectiveCamera(62, 1, 0.35, 3200);
    this.resize();

    this.scene.background = new THREE.Color(0x8ecfff);
    this.scene.fog = new THREE.Fog(0x9fd4f5, 180, 1100);

    const hemi = new THREE.HemisphereLight(0xfff0dc, 0x4e8a46, 0.95);
    this.scene.add(hemi);
    this.sun = new THREE.DirectionalLight(0xfff8ee, 1.55);
    this.sun.castShadow = false;
    this.scene.add(this.sun, this.sun.target);

    this.scene.add(this.world.object, this.visual.root);
    this.placeCar();
    void this.mountCar();

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("resize", this.resize);
    this.draw(0);
  }

  private async mountCar() {
    try {
      const next = await loadCarModel(this.ride.model, this.ride.look);
      this.scene.remove(this.visual.root);
      this.visual = next;
      this.scene.add(next.root);
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
      this.placeCar();
      this.say(`${nextRide.label} is ready`);
    } catch (err) {
      console.error("Could not switch cars", err);
      this.say("That car did not load");
    } finally {
      this.switching = false;
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
  };

  private resize = () => {
    const w = window.innerWidth;
    const h = Math.max(1, window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private readInput(): Input {
    const shiftUp = this.shiftUp;
    const shiftDown = this.shiftDown;
    this.shiftUp = false;
    this.shiftDown = false;
    if (this.inputBlocked) {
      return { throttle: 0, brake: 0, steer: 0, handbrake: false, clutch: false, shiftUp: false, shiftDown: false };
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
    const input = this.readInput();
    const surface = surfaceAt(this.car.x, this.car.z, this.world.roads, this.car.y);
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
    for (const wheel of this.visual.wheels) {
      wheel.spin.rotation.x = this.roll;
      if (wheel.front) wheel.pivot.rotation.y = steerVis;
      const data = wheel.pivot.userData;
      if (typeof data.restY !== "number") data.restY = wheel.pivot.position.y;
      const index = (wheel.front ? 0 : 2) + (wheel.pivot.position.x > 0 ? 1 : 0);
      const drop = wheels[index] ?? 0.08;
      wheel.pivot.position.y = (data.restY as number) - drop * 0.45;
    }

    this.visual.chassis.rotation.z += (clampLean(roll) - this.visual.chassis.rotation.z) * 0.35;
    this.visual.chassis.rotation.x += (clampLean(pitch) - this.visual.chassis.rotation.x) * 0.35;
    const glow = input.brake > 0 && this.car.speed > 0.4 ? 2.8 : 1.15;
    this.visual.tail.emissiveIntensity = glow;
    for (const mat of this.visual.tailLights) mat.emissiveIntensity = glow;

    this.placeCar(dt);
    this.world.updateChunks(this.car.x, this.car.z);
    this.placeCamera(dt);
    this.followSun();

    const targetFov = this.camMode === "hood" ? 74 : 58 + Math.min(6, Math.abs(this.car.speed) * 0.06);
    this.camera.fov += (targetFov - this.camera.fov) * (1 - Math.exp(-3 * dt));
    this.camera.updateProjectionMatrix();

    this.onFrame(this.frameInfo(gear, surface.name));
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
    const target = (fl + fr + rl + rr) * 0.25 + SURFACE_LIFT + this.visual.ride;

    // Gravity when not touching the surface — never hover or stick to pillars.
    const gap = this.car.y - target;
    if (gap > 0.25) {
      this.car.vy -= 28 * dt;
      this.car.y += this.car.vy * dt;
      this.car.airTime += dt;
      if (this.car.y <= target) {
        this.car.y = target;
        this.car.vy = 0;
        this.car.airTime = 0;
      } else if (this.car.airTime > 2) {
        // Stuck floating for too long — drop straight to the ground/deck.
        this.car.y = target;
        this.car.vy = 0;
        this.car.airTime = 0;
      }
    } else {
      this.car.y += (target - this.car.y) * 0.55;
      this.car.vy = 0;
      this.car.airTime = 0;
    }

    this.visual.root.position.set(this.car.x, this.car.y, this.car.z);
    this.visual.root.rotation.order = "YXZ";
    this.visual.root.rotation.y = this.car.yaw;
    const pitch = THREE.MathUtils.clamp(((rl + rr) - (fl + fr)) * 0.12, -0.14, 0.14);
    const roll = THREE.MathUtils.clamp(((fr + rr) - (fl + rl)) * 0.12, -0.12, 0.12);
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
    if (this.snap) {
      this.camera.position.copy(this.desired);
      this.snap = false;
    } else {
      const k = this.camMode === "chase" ? 4.2 : this.camMode === "free" ? 8 : 10;
      this.camera.position.lerp(this.desired, 1 - Math.exp(-k * dt));
    }
    const camFloor = heightAt(this.camera.position.x, this.camera.position.z) + SURFACE_LIFT + 2.2;
    if (this.camera.position.y < camFloor) this.camera.position.y = camFloor;
    this.camera.lookAt(this.look);
  }

  private frameInfo(gear: string, surface: string, mph?: number): FrameInfo {
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
      this.followSun();
      this.onFrame(this.frameInfo("N", "Road", 0));
    }
    this.renderer.render(this.scene, this.camera);
  }
}

function clampLean(v: number) {
  return Math.max(-0.1, Math.min(0.1, v));
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
