import "./style.css";
import { GARAGE } from "./drive/garage";
import { DriveGame, type FrameInfo } from "./drive/Game";
import { BRIDGE_SAMPLES, EXTRA_PATHS, LAKE, RIVER, ROADS, SPAWN } from "./drive/mapData";
import { FORESTS, LANDMARKS, MUD_PARK, SPEED_TRACK, SKYWAY } from "./drive/mapZones";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Missing #app");

app.innerHTML = `
  <canvas id="view"></canvas>
  <section id="home" class="home">
    <p class="eyebrow">Open world</p>
    <h1>Open Road</h1>
    <p class="lede">One red car. A big map. A loud engine.</p>
    <button id="play" class="play" type="button">Drive</button>
    <ul class="tips">
      <li><b>W</b> gas</li>
      <li><b>S</b> brake</li>
      <li><b>A D</b> steer</li>
      <li><b>Space</b> slide</li>
    </ul>
    <div class="assists">
      <button id="gear-mode" type="button">Gearbox: Auto</button>
      <button id="clutch-mode" type="button">Clutch: Off</button>
      <button id="handling-mode" type="button">Handling: Arcade</button>
      <button id="tc-mode" type="button">Traction: On</button>
      <button id="abs-mode" type="button">ABS: On</button>
      <button id="time-morning" type="button">Morning</button>
      <button id="time-noon" type="button">Noon</button>
      <button id="time-sunset" type="button">Sunset</button>
      <button id="time-night" type="button">Night</button>
      <button id="time-pause" type="button">Pause Clock</button>
    </div>
    <p class="note">Turn your sound on. Manual uses Q and E to shift, and Shift is the clutch. Press F for freecam. A song plays while you drive.</p>
    <p class="credits">Models: all garage cars are original bodies made for this game. Road props use Kenney's Car Kit (CC0). Music: Aurec and prettyjohn1 on Pixabay. Engine sounds: freesound_community and Chrysalyn on Pixabay.</p>
  </section>
  <div id="hud" class="hud is-hidden">
    <header class="top">
      <div>
        <div class="brand">Open Road</div>
        <div class="sub"><span id="car-name">Lambchop Chupacabra</span> · <span id="surface">Road</span> · <span id="cam-name">Chase</span></div>
      </div>
      <div class="top-buttons">
        <button id="cam-btn" type="button">Camera</button>
        <button id="horn-btn" type="button">Horn</button>
        <button id="cops-btn" type="button">Cops: OFF</button>
        <button id="garage-btn" type="button">Garage</button>
        <button id="reset-btn" type="button">Reset</button>
        <button id="menu-btn" type="button">Menu</button>
      </div>
    </header>
    <canvas id="map" class="map" width="180" height="180"></canvas>
    <div id="toast" class="toast"></div>
    <div id="engine" class="engine">Engine off</div>
    <div id="assist" class="assist">Auto · TC · ABS</div>
    <div id="wanted" class="wanted is-hidden">WANTED</div>
    <div id="track-hud" class="track-hud is-hidden"></div>
    <p class="hints">Arrows or WASD to drive · Space slide · C camera · H horn · G garage · R reset</p>
    <footer class="bottom">
      <div class="cluster">
        <div class="rpm"><div id="rpm-bar"></div></div>
        <div id="speed" class="speed">0</div>
        <div class="unit">MPH</div>
        <div id="limit" class="limit">LIM 45</div>
        <div id="gear" class="gear">N</div>
      </div>
    </footer>
    <div class="touch">
      <button data-hold="left" type="button">Left</button>
      <button data-hold="brake" type="button">Brake</button>
      <button data-hold="handbrake" type="button">Slide</button>
      <button data-hold="throttle" type="button">Gas</button>
      <button data-hold="right" type="button">Right</button>
    </div>
  </div>
  <section id="garage" class="garage is-hidden" aria-label="Garage">
    <div class="garage-panel">
      <div class="garage-head">
        <div>
          <h2>Garage</h2>
          <p>Every car is free. Pick one and you stay right where you are.</p>
        </div>
        <button id="garage-close" type="button">Close</button>
      </div>
      <div id="garage-list" class="garage-list"></div>
    </div>
  </section>
`;

const canvas = document.querySelector<HTMLCanvasElement>("#view");
const home = document.querySelector<HTMLElement>("#home");
const hud = document.querySelector<HTMLElement>("#hud");
const playBtn = document.querySelector<HTMLButtonElement>("#play");
if (!canvas || !home || !hud || !playBtn) throw new Error("Missing game UI");

const carNameEl = document.querySelector<HTMLElement>("#car-name")!;
const garageEl = document.querySelector<HTMLElement>("#garage")!;
const garageList = document.querySelector<HTMLElement>("#garage-list")!;
const speedEl = document.querySelector<HTMLElement>("#speed")!;
const limitEl = document.querySelector<HTMLElement>("#limit")!;
const gearEl = document.querySelector<HTMLElement>("#gear")!;
const surfaceEl = document.querySelector<HTMLElement>("#surface")!;
const camEl = document.querySelector<HTMLElement>("#cam-name")!;
const toastEl = document.querySelector<HTMLElement>("#toast")!;
const engineEl = document.querySelector<HTMLElement>("#engine")!;
const assistEl = document.querySelector<HTMLElement>("#assist")!;
const wantedEl = document.querySelector<HTMLElement>("#wanted")!;
const trackHudEl = document.querySelector<HTMLElement>("#track-hud")!;
const copsBtn = document.querySelector<HTMLButtonElement>("#cops-btn")!;
const rpmBar = document.querySelector<HTMLElement>("#rpm-bar")!;
const mapCanvas = document.querySelector<HTMLCanvasElement>("#map")!;
const mapCtx = mapCanvas.getContext("2d")!;

const game = new DriveGame(canvas, (info) => {
  paintHud(info);
  paintMap(info);
});
(window as unknown as { __driveGame: DriveGame }).__driveGame = game;

function paintHud(info: FrameInfo) {
  carNameEl.textContent = info.carName;
  speedEl.textContent = String(info.mph);
  limitEl.textContent = info.speedLimit != null ? `LIM ${info.speedLimit}` : "";
  gearEl.textContent = info.gear;
  surfaceEl.textContent = info.surface;
  camEl.textContent = info.camera;
  engineEl.textContent = info.audioOn ? "Engine on" : "Engine off";
  assistEl.textContent = info.assists + (info.timeLabel ? ` · ${info.timeLabel}` : "");
  const pct = Math.max(0, Math.min(1, info.rpm / info.redline));
  rpmBar.style.width = `${pct * 100}%`;
  rpmBar.classList.toggle("hot", pct > 0.86);
  toastEl.textContent = info.toast;
  toastEl.classList.toggle("show", info.toast.length > 0);
  const wanted = (info.wanted ?? 0) > 0 || !!info.chase;
  wantedEl.classList.toggle("is-hidden", !wanted);
  wantedEl.textContent = info.busted
    ? "BUSTED"
    : info.escaped
      ? "ESCAPED"
      : `WANTED ${"★".repeat(Math.max(1, Math.round(info.wanted ?? 1)))}`;
  const onTrack = info.trackTop != null;
  const onPark = info.lapTime != null || info.bestLap != null;
  trackHudEl.classList.toggle("is-hidden", !onTrack && !onPark);
  if (onTrack) {
    trackHudEl.textContent = `Track ${info.mph} · Top ${Math.round(info.trackTop ?? 0)} · Best ${Math.round(info.trackBest ?? 0)}${info.zeroSixty != null ? ` · 0-60 ${info.zeroSixty.toFixed(2)}s` : ""}`;
  } else if (onPark) {
    trackHudEl.textContent = `Lap ${info.lapTime != null ? info.lapTime.toFixed(1) + "s" : "—"} · Best ${info.bestLap != null ? info.bestLap.toFixed(1) + "s" : "—"}`;
  }
  if (copsBtn) copsBtn.textContent = info.copsOn ? "Cops: ON" : "Cops: OFF";
}

function paintMap(info: FrameInfo) {
  const w = mapCanvas.width;
  const h = mapCanvas.height;
  // Focused on the core map; speed track sits off-canvas north.
  const scale = w / 2400;
  const X = (x: number) => w / 2 + x * scale;
  const Y = (z: number) => h / 2 + z * scale;
  mapCtx.clearRect(0, 0, w, h);
  mapCtx.fillStyle = "#1d4a28";
  mapCtx.fillRect(0, 0, w, h);
  mapCtx.lineCap = "round";
  // Forests
  for (const f of FORESTS) {
    mapCtx.fillStyle = "#145222";
    mapCtx.beginPath();
    mapCtx.arc(X(f.x), Y(f.z), Math.max(4, f.r * scale), 0, Math.PI * 2);
    mapCtx.fill();
  }
  // Mud park
  mapCtx.fillStyle = "#5a3a18";
  mapCtx.fillRect(X(MUD_PARK.x - MUD_PARK.hx), Y(MUD_PARK.z - MUD_PARK.hz), MUD_PARK.hx * 2 * scale, MUD_PARK.hz * 2 * scale);
  // Skyway (distinct color)
  mapCtx.strokeStyle = "#7ec8ff";
  mapCtx.lineWidth = 3;
  mapCtx.beginPath();
  mapCtx.arc(X(0), Y(0), SKYWAY.radius * scale, 0, Math.PI * 2);
  mapCtx.stroke();
  // Highway first (wide yellow-edge loop), then local roads on top.
  for (const road of ROADS) {
    if (!road.highway) continue;
    mapCtx.strokeStyle = "#c9a227";
    mapCtx.lineWidth = 5;
    mapCtx.beginPath();
    mapCtx.moveTo(X(road.x1), Y(road.z1));
    mapCtx.lineTo(X(road.x2), Y(road.z2));
    mapCtx.stroke();
  }
  for (const road of ROADS) {
    if (road.highway) continue;
    mapCtx.strokeStyle = road.grip < 0.85 ? "#8a6238" : "#8d939a";
    mapCtx.lineWidth = road.width > 16 ? 3.5 : 2.5;
    mapCtx.beginPath();
    mapCtx.moveTo(X(road.x1), Y(road.z1));
    mapCtx.lineTo(X(road.x2), Y(road.z2));
    mapCtx.stroke();
  }
  // Dirt trails (extra paths with low grip)
  for (const path of EXTRA_PATHS) {
    if ((path.grip ?? 1) >= 0.85) continue;
    mapCtx.strokeStyle = "#a06a30";
    mapCtx.lineWidth = 2;
    mapCtx.beginPath();
    mapCtx.moveTo(X(path.points[0][0]), Y(path.points[0][1]));
    for (let i = 1; i < path.points.length; i++) mapCtx.lineTo(X(path.points[i][0]), Y(path.points[i][1]));
    mapCtx.stroke();
  }
  // Speed track tick
  mapCtx.strokeStyle = "#e8e8e8";
  mapCtx.lineWidth = 2;
  mapCtx.beginPath();
  mapCtx.moveTo(X(SPEED_TRACK.x0), Y(SPEED_TRACK.z0));
  mapCtx.lineTo(X(SPEED_TRACK.x1), Y(SPEED_TRACK.z0));
  mapCtx.stroke();
  // River
  mapCtx.strokeStyle = "#2a8eaf";
  mapCtx.lineWidth = Math.max(4, RIVER.halfWidth * 2 * scale);
  mapCtx.lineCap = "round";
  mapCtx.lineJoin = "round";
  mapCtx.beginPath();
  mapCtx.moveTo(X(RIVER.points[0][0]), Y(RIVER.points[0][1]));
  for (let i = 1; i < RIVER.points.length; i++) {
    mapCtx.lineTo(X(RIVER.points[i][0]), Y(RIVER.points[i][1]));
  }
  mapCtx.stroke();
  mapCtx.fillStyle = "#2a8eaf";
  mapCtx.beginPath();
  mapCtx.arc(X(LAKE.x), Y(LAKE.z), Math.max(2, LAKE.r * scale), 0, Math.PI * 2);
  mapCtx.fill();
  if (BRIDGE_SAMPLES.length > 1) {
    mapCtx.strokeStyle = "#f0e6a8";
    mapCtx.lineWidth = 6;
    mapCtx.beginPath();
    mapCtx.moveTo(X(BRIDGE_SAMPLES[0].x), Y(BRIDGE_SAMPLES[0].z));
    for (let i = 1; i < BRIDGE_SAMPLES.length; i++) {
      mapCtx.lineTo(X(BRIDGE_SAMPLES[i].x), Y(BRIDGE_SAMPLES[i].z));
    }
    mapCtx.stroke();
  }
  // Landmarks
  for (const lm of LANDMARKS) {
    if (lm.kind === "restaurant") {
      mapCtx.fillStyle = lm.id === "pizza" ? "#ff3355" : lm.id === "pho" ? "#ffcc33" : "#33cc66";
      mapCtx.beginPath();
      mapCtx.arc(X(lm.x), Y(lm.z), 3, 0, Math.PI * 2);
      mapCtx.fill();
    } else if (lm.kind === "carwash") {
      mapCtx.fillStyle = "#66d0ff";
      mapCtx.fillRect(X(lm.x) - 3, Y(lm.z) - 3, 6, 6);
    }
  }
  // Cops
  for (const c of game.copDots()) {
    mapCtx.fillStyle = c.chase ? (Math.sin(performance.now() * 0.02) > 0 ? "#ff0044" : "#0044ff") : "#3355aa";
    mapCtx.beginPath();
    mapCtx.arc(X(c.x), Y(c.z), c.chase ? 3.5 : 2.5, 0, Math.PI * 2);
    mapCtx.fill();
  }
  mapCtx.fillStyle = "#ffe08a";
  mapCtx.fillRect(X(SPAWN.x) - 2, Y(SPAWN.z) - 2, 4, 4);
  mapCtx.save();
  mapCtx.translate(X(info.x), Y(info.z));
  mapCtx.rotate(-info.yaw);
  mapCtx.fillStyle = "#ff3355";
  mapCtx.beginPath();
  mapCtx.moveTo(0, 6);
  mapCtx.lineTo(3.5, -4);
  mapCtx.lineTo(-3.5, -4);
  mapCtx.closePath();
  mapCtx.fill();
  mapCtx.restore();
}

const showPlay = () => {
  home.classList.add("is-hidden");
  hud.classList.remove("is-hidden");
};

const showMenu = () => {
  game.pause();
  hud.classList.add("is-hidden");
  home.classList.remove("is-hidden");
  playBtn.textContent = "Resume";
};

playBtn.addEventListener("click", () => {
  showPlay();
  game.playMusic();
  void game.start();
});

// Browsers block sound until a click or key. Unlock on the first gesture too.
const unlockAudioOnce = () => {
  game.unlockAudio();
};
window.addEventListener("pointerdown", unlockAudioOnce, { once: true });
window.addEventListener("keydown", unlockAudioOnce, { once: true });

function paintAssists() {
  const setup = game.getSetup();
  const gear = document.querySelector<HTMLButtonElement>("#gear-mode");
  const clutch = document.querySelector<HTMLButtonElement>("#clutch-mode");
  const handling = document.querySelector<HTMLButtonElement>("#handling-mode");
  const tc = document.querySelector<HTMLButtonElement>("#tc-mode");
  const abs = document.querySelector<HTMLButtonElement>("#abs-mode");
  if (gear) gear.textContent = `Gearbox: ${setup.auto ? "Auto" : "Manual"}`;
  if (clutch) clutch.textContent = `Clutch: ${setup.clutchNeeded ? "On" : "Off"}`;
  if (handling) handling.textContent = `Handling: ${setup.handling === "sim" ? "Sim" : "Arcade"}`;
  if (tc) tc.textContent = `Traction: ${setup.tc ? "On" : "Off"}`;
  if (abs) abs.textContent = `ABS: ${setup.abs ? "On" : "Off"}`;
}

document.querySelector("#gear-mode")?.addEventListener("click", () => {
  game.setSetup({ auto: !game.getSetup().auto });
  paintAssists();
});
document.querySelector("#clutch-mode")?.addEventListener("click", () => {
  game.setSetup({ clutchNeeded: !game.getSetup().clutchNeeded });
  paintAssists();
});
document.querySelector("#handling-mode")?.addEventListener("click", () => {
  const next = game.getSetup().handling === "arcade" ? "sim" : "arcade";
  game.setSetup({ handling: next });
  paintAssists();
});
document.querySelector("#tc-mode")?.addEventListener("click", () => {
  game.setSetup({ tc: !game.getSetup().tc });
  paintAssists();
});
document.querySelector("#abs-mode")?.addEventListener("click", () => {
  game.setSetup({ abs: !game.getSetup().abs });
  paintAssists();
});

document.querySelector("#menu-btn")?.addEventListener("click", showMenu);
document.querySelector("#reset-btn")?.addEventListener("click", () => game.reset());
document.querySelector("#horn-btn")?.addEventListener("click", () => game.horn());
copsBtn.addEventListener("click", () => game.setCops(!game.copsOn()));
document.querySelector("#time-morning")?.addEventListener("click", () => game.setTimePreset("morning"));
document.querySelector("#time-noon")?.addEventListener("click", () => game.setTimePreset("noon"));
document.querySelector("#time-sunset")?.addEventListener("click", () => game.setTimePreset("sunset"));
document.querySelector("#time-night")?.addEventListener("click", () => game.setTimePreset("night"));
document.querySelector("#time-pause")?.addEventListener("click", () => game.setTimePreset("pause"));

function paintGarage() {
  const current = game.currentCarId();
  const brands: string[] = [];
  for (const car of GARAGE) {
    if (!brands.includes(car.brand)) brands.push(car.brand);
  }
  garageList.innerHTML = brands
    .map((brand) => {
      const cars = GARAGE.filter((car) => car.brand === brand)
        .map(
          (car) => `
            <button type="button" data-car="${car.id}" class="${car.id === current ? "is-current" : ""}">
              <b>${car.brand} ${car.name}</b>
            </button>
          `,
        )
        .join("");
      return `<h3>${brand}</h3>${cars}`;
    })
    .join("");
}

function openGarage() {
  paintGarage();
  garageEl.classList.remove("is-hidden");
  game.setInputBlocked(true);
}

function closeGarage() {
  garageEl.classList.add("is-hidden");
  game.setInputBlocked(false);
}

document.querySelector("#garage-btn")?.addEventListener("click", openGarage);
document.querySelector("#garage-close")?.addEventListener("click", closeGarage);
garageList.addEventListener("click", (event) => {
  const target = event.target;
  const button = target instanceof HTMLElement ? target.closest("button") : null;
  const id = button?.getAttribute("data-car");
  if (!id) return;
  closeGarage();
  void game.switchCar(id);
});

document.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() !== "g" || event.repeat) return;
  if (hud.classList.contains("is-hidden")) return;
  if (garageEl.classList.contains("is-hidden")) openGarage();
  else closeGarage();
});
document.querySelector("#cam-btn")?.addEventListener("click", () => game.cycleCam());
paintAssists();

for (const el of document.querySelectorAll<HTMLButtonElement>("[data-hold]")) {
  const name = el.dataset.hold;
  if (!name) continue;
  const down = (event: Event) => {
    event.preventDefault();
    game.hold(name, true);
  };
  const up = (event: Event) => {
    event.preventDefault();
    game.hold(name, false);
  };
  el.addEventListener("pointerdown", down);
  el.addEventListener("pointerup", up);
  el.addEventListener("pointerleave", up);
  el.addEventListener("pointercancel", up);
}

document.addEventListener("click", (event) => {
  const target = event.target;
  if (target instanceof HTMLElement) target.blur();
});
