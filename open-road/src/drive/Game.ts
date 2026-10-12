import * as THREE from "three";
import { EngineAudio } from "./audio";
import { loadCarModel, type CarVisual } from "./car";
import { GARAGE, carById, type GarageCar } from "./garage";
import {
  REDLINE,
  DEFAULT_SETUP,
  gearLabel,
  makeCar,
  resetCar,
  resolveCollisions,
  resolveWater,
  stepCar,
  surfaceAt,
  type Car,
  type Input,
  type Setup,
  type Tune,
} from "./sim";
import { FOG, createWorld } from "./world";

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

type CamMode = "chase" | "bumper" | "hood";

const CAM_LABEL: Record<CamMode, string> = {
  chase: "Chase",
  bumper: "Bumper",
  hood: "Hood",
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
  private posed = false;
  private carVisualY = 0;
  private carPitch = 0;
  private carRoll = 0;
  private readonly desired = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private readonly sunDir = new THREE.Vector3(0.84, 0.3, 0.36).normalize();
  private readonly onFrame: (info: FrameInfo) => void;

  constructor(canvas: HTMLCanvasElement, onFrame: (info: FrameInfo) => void) {
    this.onFrame = onFrame;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;

    this.camera = new THREE.PerspectiveCamera(62, 1, 0.15, 4000);
    this.resize();

    this.scene.background = new THREE.Color(FOG.color);
    this.scene.fog = new THREE.Fog(FOG.color, FOG.near, FOG.far);

    const hemi = new THREE.HemisphereLight(0xfff0dc, 0x4e8a46, 1.15);
    this.scene.add(hemi);
    this.sun = new THREE.DirectionalLight(0xfff8ee, 3.1);
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
    this.posed = false;
    this.say("Back to the start");
  }

  horn() {
    this.audio.horn();
  }

  cycleCam() {
    this.camMode = this.camMode === "chase" ? "bumper" : this.camMode === "bumper" ? "hood" : "chase";
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
    if (k === "c") this.cycleCam();
    if (k === "r") this.reset();
    if (k === "h") this.audio.horn();
    if (!this.setup.auto && k === "e") this.shiftUp = true;
    if (!this.setup.auto && k === "q") this.shiftDown = true;
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
    const surface = surfaceAt(this.car.x, this.car.z, this.world.roads);
    const { skid, pitch, roll, wheels, wheel } = stepCar(this.car, input, surface, dt, this.tune, this.setup);
    const wet = resolveWater(this.car);
    if (wet && !this.inWater) this.say("You can't drive on the water");
    this.inWater = wet;
    const impact = resolveCollisions(this.car, this.world.colliders);
    this.impactCool = Math.max(0, this.impactCool - dt);
    if (impact > 8 && this.impactCool <= 0) {
      this.audio.impact(impact);
      this.say("Bump!");
      this.impactCool = 0.45;
    }
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toast = "";
    }

    const gear = gearLabel(this.car, input.throttle, this.setup.auto);
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
    this.visual.tail.emissiveIntensity = input.brake > 0 && this.car.speed > 0.4 ? 2.4 : 0.45;

    this.placeCar(dt);
    this.placeCamera(dt);
    this.followSun();

    const targetFov = this.camMode === "hood" ? 74 : 58 + Math.min(6, Math.abs(this.car.speed) * 0.06);
    this.camera.fov += (targetFov - this.camera.fov) * (1 - Math.exp(-3 * dt));
    this.camera.updateProjectionMatrix();

    this.onFrame(this.frameInfo(gear, surface.name));
  }

  private placeCar(dt = 0) {
    const y = this.world.heightAt(this.car.x, this.car.z);
    const ahead = 2.4;
    const side = 1.05;
    const fx = Math.sin(this.car.yaw);
    const fz = Math.cos(this.car.yaw);
    const rx = Math.cos(this.car.yaw);
    const rz = -Math.sin(this.car.yaw);
    const yF = this.world.heightAt(this.car.x + fx * ahead, this.car.z + fz * ahead);
    const yB = this.world.heightAt(this.car.x - fx * ahead, this.car.z - fz * ahead);
    const yL = this.world.heightAt(this.car.x - rx * side, this.car.z - rz * side);
    const yR = this.world.heightAt(this.car.x + rx * side, this.car.z + rz * side);
    const pitch = Math.max(-0.28, Math.min(0.28, Math.atan2(yB - yF, ahead * 2)));
    const roll = Math.max(-0.28, Math.min(0.28, Math.atan2(yR - yL, side * 2)));
    const targetY = y + this.visual.ride;
    if (!this.posed || dt <= 0) {
      this.carVisualY = targetY;
      this.carPitch = pitch;
      this.carRoll = roll;
      this.posed = true;
    } else {
      const k = 1 - Math.exp(-8 * dt);
      this.carVisualY += (targetY - this.carVisualY) * k;
      this.carPitch += (pitch - this.carPitch) * k;
      this.carRoll += (roll - this.carRoll) * k;
    }
    this.visual.root.position.set(this.car.x, this.carVisualY, this.car.z);
    this.visual.root.rotation.order = "YXZ";
    this.visual.root.rotation.set(this.carPitch, this.car.yaw, this.carRoll);
  }

  private placeCamera(dt: number) {
    const fx = Math.sin(this.car.yaw);
    const fz = Math.cos(this.car.yaw);
    const y = this.carVisualY;
    if (this.camMode === "chase") {
      this.desired.set(this.car.x - fx * 13.5, y + 5.8, this.car.z - fz * 13.5);
      this.look.set(this.car.x + fx * 10, y + 1.15, this.car.z + fz * 10);
    } else if (this.camMode === "bumper") {
      this.desired.set(this.car.x - fx * 4.3, y + 1.65, this.car.z - fz * 4.3);
      this.look.set(this.car.x + fx * 8, y + 0.9, this.car.z + fz * 8);
    } else {
      this.desired.set(this.car.x + fx * 0.7, y + 1.15, this.car.z + fz * 0.7);
      this.look.set(this.car.x + fx * 14, y + 0.95, this.car.z + fz * 14);
    }
    if (this.snap) {
      this.camera.position.copy(this.desired);
      this.snap = false;
    } else {
      const k = this.camMode === "chase" ? 4.2 : 10;
      this.camera.position.lerp(this.desired, 1 - Math.exp(-k * dt));
    }
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
      assists: `${this.setup.auto ? "Auto" : "Manual"} · TC ${this.setup.tc ? "on" : "off"} · ABS ${this.setup.abs ? "on" : "off"}`,
    };
  }

  private followSun() {
    this.sun.position.set(this.car.x, 0, this.car.z).addScaledVector(this.sunDir, 90);
    this.sun.target.position.set(this.car.x, 0, this.car.z);
  }

  private draw(dt: number) {
    this.world.update(this.car.x, this.car.z, dt);
    if (!this.running) {
      this.placeCar(dt);
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
    wheelRadius: 0.55,
    ride: 0,
  };
}
