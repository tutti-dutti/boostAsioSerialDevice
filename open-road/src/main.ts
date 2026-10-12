import "./style.css";
import { GARAGE } from "./drive/garage";
import { DriveGame, type FrameInfo } from "./drive/Game";
import { LAKE, ROADS, SPAWN } from "./drive/mapData";

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
    </div>
    <p class="note">Turn your sound on. Manual uses Q and E to shift, and Shift is the clutch. A song plays while you drive.</p>
    <p class="credits">Models: all garage cars are original bodies made for this game. Road props use Kenney's Car Kit (CC0). Lambchop engine sound: Chrysalyn on Pixabay.</p>
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
        <button id="garage-btn" type="button">Garage</button>
        <button id="reset-btn" type="button">Reset</button>
        <button id="menu-btn" type="button">Menu</button>
      </div>
    </header>
    <canvas id="map" class="map" width="180" height="180"></canvas>
    <div id="toast" class="toast"></div>
    <div id="engine" class="engine">Engine off</div>
    <div id="assist" class="assist">Auto · TC · ABS</div>
    <p class="hints">Arrows or WASD to drive · Space slide · C camera · H horn · G garage · R reset</p>
    <footer class="bottom">
      <div class="cluster">
        <div class="rpm"><div id="rpm-bar"></div></div>
        <div id="speed" class="speed">0</div>
        <div class="unit">MPH</div>
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
const gearEl = document.querySelector<HTMLElement>("#gear")!;
const surfaceEl = document.querySelector<HTMLElement>("#surface")!;
const camEl = document.querySelector<HTMLElement>("#cam-name")!;
const toastEl = document.querySelector<HTMLElement>("#toast")!;
const engineEl = document.querySelector<HTMLElement>("#engine")!;
const assistEl = document.querySelector<HTMLElement>("#assist")!;
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
  gearEl.textContent = info.gear;
  surfaceEl.textContent = info.surface;
  camEl.textContent = info.camera;
  engineEl.textContent = info.audioOn ? "Engine on" : "Engine off";
  assistEl.textContent = info.assists;
  const pct = Math.max(0, Math.min(1, info.rpm / info.redline));
  rpmBar.style.width = `${pct * 100}%`;
  rpmBar.classList.toggle("hot", pct > 0.86);
  toastEl.textContent = info.toast;
  toastEl.classList.toggle("show", info.toast.length > 0);
}

function paintMap(info: FrameInfo) {
  const w = mapCanvas.width;
  const h = mapCanvas.height;
  const scale = w / 900;
  const X = (x: number) => w / 2 + x * scale;
  const Y = (z: number) => h / 2 + z * scale;
  mapCtx.clearRect(0, 0, w, h);
  mapCtx.fillStyle = "#1d4a28";
  mapCtx.fillRect(0, 0, w, h);
  mapCtx.lineCap = "round";
  for (const road of ROADS) {
    mapCtx.strokeStyle = road.grip < 0.85 ? "#8a6238" : "#8d939a";
    mapCtx.lineWidth = road.width > 16 ? 4 : 3;
    mapCtx.beginPath();
    mapCtx.moveTo(X(road.x1), Y(road.z1));
    mapCtx.lineTo(X(road.x2), Y(road.z2));
    mapCtx.stroke();
  }
  mapCtx.fillStyle = "#2a8eaf";
  mapCtx.beginPath();
  mapCtx.arc(X(LAKE.x), Y(LAKE.z), LAKE.r * scale, 0, Math.PI * 2);
  mapCtx.fill();
  mapCtx.fillStyle = "#ffe08a";
  mapCtx.fillRect(X(SPAWN.x) - 2, Y(SPAWN.z) - 2, 4, 4);
  mapCtx.save();
  mapCtx.translate(X(info.x), Y(info.z));
  mapCtx.rotate(-info.yaw);
  mapCtx.fillStyle = "#ff3355";
  mapCtx.beginPath();
  mapCtx.moveTo(0, 7);
  mapCtx.lineTo(4.5, -5);
  mapCtx.lineTo(-4.5, -5);
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
