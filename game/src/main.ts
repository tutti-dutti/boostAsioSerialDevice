import "./style.css";
import { Game } from "./game/Game";
import { rarityLabel } from "./game/data";
import { upgradeCost } from "./game/types";

const app = document.querySelector<HTMLDivElement>("#app")!;

app.innerHTML = `
  <section class="home" id="home">
    <h1 class="home-brand">Cookie Guard</h1>
    <p class="home-line">Protect your giant cookie with cute animal friends.</p>
    <button class="home-play" id="play-btn" type="button">Play</button>
    <p class="home-note">No ads. Just the game.</p>
  </section>

  <section class="play-screen hidden" id="play-screen">
    <header class="top-bar">
      <div class="brand-small">Cookie Guard</div>
      <button class="home-link" id="back-home" type="button">Home</button>
    </header>

    <div class="stats" id="stats"></div>

    <div class="stage-wrap">
      <canvas id="stage"></canvas>
      <div class="toast" id="toast"></div>
      <div class="overlay hidden" id="over">
        <div class="overlay-card">
          <h2>Cookie gone!</h2>
          <p>The thieves ate it. Try again?</p>
          <button class="big" id="retry-btn" type="button">Play again</button>
        </div>
      </div>
    </div>

    <div class="hud">
      <section class="panel">
        <h2>Friends</h2>
        <div class="row">
          <button class="big" id="summon" type="button">Summon (1⭐)</button>
          <button class="pink" id="lucky" type="button">Lucky (3⭐)</button>
        </div>
        <div class="inventory" id="bag"></div>
        <p class="hint">Tap a friend, then tap a circle. Top-down view!</p>
      </section>

      <section class="panel">
        <h2>Actions</h2>
        <div class="row">
          <button class="green" id="upgrade" type="button">Upgrade / Evolve</button>
          <button id="sell" type="button">To bag</button>
        </div>
        <div class="row">
          <button class="spell" id="crumb" type="button">Crumb (5🪙)</button>
          <button class="spell" id="frost" type="button">Frost (4🪙)</button>
          <button class="spell" id="zap" type="button">Zap (6🪙)</button>
        </div>
        <p class="hint" id="select-hint">Fish can evolve when you upgrade!</p>
        <div class="row">
          <button id="new-game" type="button">New game</button>
        </div>
      </section>
    </div>
  </section>
`;

const home = document.querySelector<HTMLElement>("#home")!;
const playScreen = document.querySelector<HTMLElement>("#play-screen")!;
const canvas = document.querySelector<HTMLCanvasElement>("#stage")!;
const game = new Game(canvas);

const stats = document.querySelector("#stats")!;
const bag = document.querySelector("#bag")!;
const toast = document.querySelector("#toast")!;
const over = document.querySelector("#over")!;
const selectHint = document.querySelector("#select-hint")!;

function refresh() {
  stats.innerHTML = `
    <div class="stat">🪙 ${game.gold}</div>
    <div class="stat">⭐ ${game.stars}</div>
    <div class="stat">Wave ${game.wave}</div>
    <div class="stat">🍪 ${game.cookieHp}/${game.cookieMax}</div>
  `;

  if (!game.bag.length) {
    bag.innerHTML = `<span class="empty-inv">Press Summon to get friends</span>`;
  } else {
    bag.innerHTML = game.bag
      .map(
        (f, i) => `
      <button class="inv-item ${game.selectedBag === i ? "selected" : ""} rarity-${f.rarity}" data-i="${i}" type="button">
        <span class="emoji">${f.emoji}</span>
        <span>${f.name}</span>
        <span class="rarity-${f.rarity}">${rarityLabel(f.rarity)}</span>
      </button>`,
      )
      .join("");
    bag.querySelectorAll<HTMLButtonElement>(".inv-item").forEach((btn) => {
      btn.onclick = () => {
        game.selectedBag = Number(btn.dataset.i);
        game.selectedSlot = null;
        refresh();
      };
    });
  }

  if (game.selectedSlot != null && game.slots[game.selectedSlot]?.friend) {
    const f = game.slots[game.selectedSlot].friend!;
    let extra = "";
    if (f.def.id === "fish") extra = " · Floppy Fin · tiny evolve chance!";
    if (f.def.id === "fox") extra = " · builds walls every 30s";
    if (f.def.id === "shark") extra = " · can become Megalodon!";
    if (f.def.rarity === "god") extra = " · GOD TIER!";
    selectHint.textContent = `${f.def.emoji} ${f.def.name} Lv${f.level} — ${upgradeCost(f)}🪙${extra}`;
  } else {
    selectHint.textContent = "Tap a friend on the path. Fish can evolve on Upgrade!";
  }

  toast.textContent = game.toastText;
  toast.classList.toggle("show", game.toastTimer > 0);
  over.classList.toggle("hidden", !game.gameOver);

  (document.querySelector("#summon") as HTMLButtonElement).disabled = game.stars < 1;
  (document.querySelector("#lucky") as HTMLButtonElement).disabled = game.stars < 3;
}

game.onChange = refresh;
refresh();

function showHome() {
  game.running = false;
  home.classList.remove("hidden");
  playScreen.classList.add("hidden");
}

function showPlay() {
  home.classList.add("hidden");
  playScreen.classList.remove("hidden");
  game.running = true;
  game.paint();
  refresh();
}

document.querySelector("#play-btn")!.addEventListener("click", showPlay);
document.querySelector("#back-home")!.addEventListener("click", showHome);

document.querySelector("#retry-btn")!.addEventListener("click", () => {
  game.reset();
  over.classList.add("hidden");
});

document.querySelector("#summon")!.addEventListener("click", () => game.summon(false));
document.querySelector("#lucky")!.addEventListener("click", () => game.summon(true));
document.querySelector("#upgrade")!.addEventListener("click", () => game.upgradeSelected());
document.querySelector("#sell")!.addEventListener("click", () => game.sellSelected());
document.querySelector("#crumb")!.addEventListener("click", () => game.cast("crumb"));
document.querySelector("#frost")!.addEventListener("click", () => game.cast("frost"));
document.querySelector("#zap")!.addEventListener("click", () => game.cast("zap"));
document.querySelector("#new-game")!.addEventListener("click", () => {
  if (confirm("Start over?")) game.reset();
});

game.running = false;

let last = performance.now();
function loop(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.update(dt);
  if (game.toastTimer > 0 || game.gameOver) refresh();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

setInterval(() => {
  if (game.running) game.save();
}, 15000);
