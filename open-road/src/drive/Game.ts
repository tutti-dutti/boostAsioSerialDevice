import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { Sky } from "three/addons/objects/Sky.js";
import { EngineAudio } from "./audio";
import { createCar } from "./car";
import {
  REDLINE,
  gearLabel,
  makeCar,
  resetCar,
  resolveCollisions,
  stepCar,
  surfaceAt,
  type Car,
  type Input,
} from "./sim";
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
  private visual = createCar();
  private world = createWorld();
  private audio = new EngineAudio();
  private keys = new Set<string>();
  private holds = new Set<string>();
  private running = false;
  private looping = false;
  private last = 0;
  private roll = 0;
  private prevSpeed = 0;
  private snap = true;
  private camMode: CamMode = "chase";
  private impactCool = 0;
  private toast = "";
  private toastTimer = 0;
  private hornHeld = false;
  private camHeld = false;
  private resetHeld = false;
  private readonly desired = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private readonly sunDir = new THREE.Vector3(0.84, 0.3, 0.36).normalize();
  private readonly onFrame: (info: FrameInfo) => void;

  constructor(canvas: HTMLCanvasElement, onFrame: (info: FrameInfo) => void) {
    this.onFrame = onFrame;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.camera = new THREE.PerspectiveCamera(62, 1, 0.15, 2500);
    this.resize();

    const sky = new Sky();
    sky.scale.setScalar(450000);
    const uniforms = sky.material.uniforms;
    uniforms.turbidity.value = 7;
    uniforms.rayleigh.value = 1.35;
    uniforms.mieCoefficient.value = 0.006;
    uniforms.mieDirectionalG.value = 0.82;
    uniforms.sunPosition.value.copy(this.sunDir);
    this.scene.add(sky);
    this.scene.fog = new THREE.Fog(0xf0b48a, 140, 760);

    const hemi = new THREE.HemisphereLight(0xffd2a8, 0x3d6b32, 0.75);
    this.scene.add(hemi);
    this.sun = new THREE.DirectionalLight(0xffc48a, 3.4);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 8;
    this.sun.shadow.camera.far = 180;
    this.sun.shadow.camera.left = -30;
    this.sun.shadow.camera.right = 30;
    this.sun.shadow.camera.top = 30;
    this.sun.shadow.camera.bottom = -30;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.sun, this.sun.target);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.scene.add(this.world.object, this.visual.root);
    this.placeCar();

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("resize", this.resize);
    this.draw(0);
  }

  hold(action: string, down: boolean) {
    if (down) this.holds.add(action);
    else this.holds.delete(action);
  }

  async start() {
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
    this.prevSpeed = 0;
    this.snap = true;
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
    let steer = 0;
    if (this.keys.has("a") || this.keys.has("arrowleft") || this.holds.has("left")) steer -= 1;
    if (this.keys.has("d") || this.keys.has("arrowright") || this.holds.has("right")) steer += 1;
    const key: Input = {
      throttle: this.keys.has("w") || this.keys.has("arrowup") || this.holds.has("throttle") ? 1 : 0,
      brake: this.keys.has("s") || this.keys.has("arrowdown") || this.holds.has("brake") ? 1 : 0,
      steer,
      handbrake: this.keys.has(" ") || this.holds.has("handbrake"),
    };
    const pad = this.readPad();
    if (!pad) return key;
    return {
      throttle: Math.max(key.throttle, pad.throttle),
      brake: Math.max(key.brake, pad.brake),
      steer: Math.abs(pad.steer) > Math.abs(key.steer) ? pad.steer : key.steer,
      handbrake: key.handbrake || pad.handbrake,
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
    const steerRaw = gp.axes[0] ?? 0;
    const steer = Math.abs(steerRaw) < 0.12 ? 0 : steerRaw;
    if (gp.buttons[1]?.pressed && !this.hornHeld) this.audio.horn();
    this.hornHeld = Boolean(gp.buttons[1]?.pressed);
    if (this.running && gp.buttons[3]?.pressed && !this.camHeld) this.cycleCam();
    this.camHeld = Boolean(gp.buttons[3]?.pressed);
    if (this.running && gp.buttons[9]?.pressed && !this.resetHeld) this.reset();
    this.resetHeld = Boolean(gp.buttons[9]?.pressed);
    return {
      throttle: gp.buttons[7]?.value ?? 0,
      brake: gp.buttons[6]?.value ?? 0,
      steer,
      handbrake: Boolean(gp.buttons[0]?.pressed),
    };
  }

  private frame = (now: number) => {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (this.running) this.step(dt);
    this.draw(dt);
    if (this.running) requestAnimationFrame(this.frame);
    else this.looping = false;
  };

  private step(dt: number) {
    const input = this.readInput();
    const surface = surfaceAt(this.car.x, this.car.z, this.world.roads);
    const { skid } = stepCar(this.car, input, surface, dt);
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

    const gear = gearLabel(this.car, input.throttle);
    this.audio.update({
      rpm: this.car.rpm,
      throttle: input.throttle,
      speed: Math.abs(this.car.speed),
      skid,
      gear,
      active: true,
    });

    this.roll += (this.car.speed / 0.36) * dt;
    const steerVis = input.steer * 0.42;
    for (const wheel of this.visual.wheels) {
      wheel.spin.rotation.x = this.roll;
      if (wheel.front) wheel.pivot.rotation.y = steerVis;
    }

    const accel = (this.car.speed - this.prevSpeed) / Math.max(dt, 0.001);
    this.prevSpeed = this.car.speed;
    const targetRoll = clampLean(-this.car.lat * 0.03 - input.steer * Math.abs(this.car.speed) * 0.0035);
    const targetPitch = clampLean(-accel * 0.01);
    this.visual.chassis.rotation.z += (targetRoll - this.visual.chassis.rotation.z) * 0.12;
    this.visual.chassis.rotation.x += (targetPitch - this.visual.chassis.rotation.x) * 0.12;
    this.visual.tail.emissiveIntensity = input.brake > 0 && this.car.speed > 0.4 ? 2.4 : 0.45;

    this.placeCar();
    this.placeCamera(dt);
    this.followSun();

    const targetFov = this.camMode === "hood" ? 78 : 60 + Math.min(14, Math.abs(this.car.speed) * 0.2);
    this.camera.fov += (targetFov - this.camera.fov) * (1 - Math.exp(-3 * dt));
    this.camera.updateProjectionMatrix();

    this.onFrame({
      mph: Math.round(Math.abs(this.car.speed) * 2.23694),
      gear,
      rpm: this.car.rpm,
      redline: REDLINE,
      x: this.car.x,
      z: this.car.z,
      yaw: this.car.yaw,
      surface: surface.name,
      camera: CAM_LABEL[this.camMode],
      toast: this.toast,
      audioOn: this.audio.on,
    });
  }

  private placeCar() {
    this.visual.root.position.set(this.car.x, 0, this.car.z);
    this.visual.root.rotation.y = this.car.yaw;
  }

  private placeCamera(dt: number) {
    const fx = Math.sin(this.car.yaw);
    const fz = Math.cos(this.car.yaw);
    if (this.camMode === "chase") {
      this.desired.set(this.car.x - fx * 8.2, 3.2, this.car.z - fz * 8.2);
      this.look.set(this.car.x + fx * 6, 1.05, this.car.z + fz * 6);
    } else if (this.camMode === "bumper") {
      this.desired.set(this.car.x - fx * 4.3, 1.65, this.car.z - fz * 4.3);
      this.look.set(this.car.x + fx * 8, 0.9, this.car.z + fz * 8);
    } else {
      this.desired.set(this.car.x + fx * 0.7, 1.15, this.car.z + fz * 0.7);
      this.look.set(this.car.x + fx * 14, 0.95, this.car.z + fz * 14);
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

  private followSun() {
    this.sun.position.set(this.car.x, 0, this.car.z).addScaledVector(this.sunDir, 90);
    this.sun.target.position.set(this.car.x, 0, this.car.z);
  }

  private draw(dt: number) {
    if (!this.running) {
      this.placeCar();
      this.placeCamera(Math.max(dt, 0.016));
      this.followSun();
      this.onFrame({
        mph: 0,
        gear: "N",
        rpm: this.car.rpm,
        redline: REDLINE,
        x: this.car.x,
        z: this.car.z,
        yaw: this.car.yaw,
        surface: "Road",
        camera: CAM_LABEL[this.camMode],
        toast: this.toast,
        audioOn: this.audio.on,
      });
    }
    this.renderer.render(this.scene, this.camera);
  }
}

function clampLean(v: number) {
  return Math.max(-0.1, Math.min(0.1, v));
}
