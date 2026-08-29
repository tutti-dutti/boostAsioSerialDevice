import "./style.css";
import { Game } from "./game/Game";
import { upgradeCost } from "./game/types";

const app = document.querySelector<HTMLDivElement>("#app")!;

app.innerHTML = `
  <header class="top-bar">
    <h1 class="brand">Cookie Guard</h1>
    <p class="story">You baked a giant magic cookie! Hungry snack thieves want it. Call cute animal friends to protect it!</p>
  </header>

  <div class="stats" id="stats"></div>

  <div class="stage-wrap">
    <canvas id="stage"></canvas>
    <div class="toast" id="toast"></div>
    <div class="overlay" id="start">
      <div class="overlay-card">
        <h2>Cookie Guard</h2>
        <p>Same kind of game as those idle tower games — but with cookies, animals, and snack thieves!</p>
        <p>1) Get friends with ⭐<br/>2) Tap a friend, then tap a circle<br/>3) Stop the thieves!</p>
        <button class="big" id="play-btn">Play!</button>
      </div>
    </div>
    <div class="overlay hidden" id="over">
      <div class="overlay-card">
        <h2>Cookie gone!</h2>
        <p>The thieves ate your cookie. Want to try again?</p>
        <button class="big" id="retry-btn">Play again</button>
      </div>
    </div>
  </div>

  <div class="hud">
    <section class="panel">
      <h2>Get friends</h2>
      <div class="row">
        <button class="big" id="summon">Summon (1⭐)</button>
        <button class="pink" id="lucky">Lucky summon (3⭐)</button>
      </div>
      <h2>Your bag</h2>
      <div class="inventory" id="bag"></div>
      <p class="hint" id="bag-hint">Tap a friend here, then tap an empty circle on the path.</p>
    </section>

    <section class="panel">
      <h2>Help &amp; spells</h2>
      <div class="row">
        <button class="green" id="upgrade">Upgrade friend</button>
        <button id="sell">Put back in bag</button>
      </div>
      <div class="row">
        <button class="spell" id="crumb">Crumb boom (5🪙)</button>
        <button class="spell" id="frost">Frost chill (4🪙)</button>
        <button class="spell" id="zap">Zap zap (6🪙)</button>
      </div>
      <p class="hint" id="select-hint">Tap a friend on the path to upgrade them.</p>
      <div class="row" style="margin-top:0.6rem">
        <button id="new-game">New game</button>
      </div>
    </section>
  </div>
`;

const canvas = document.querySelector<HTMLCanvasElement>("#stage")!;
const game = new Game(canvas);

const stats = document.querySelector("#stats")!;
const bag = document.querySelector("#bag")!;
const toast = document.querySelector("#toast")!;
const start = document.querySelector("#start")!;
const over = document.querySelector("#over")!;
const selectHint = document.querySelector("#select-hint")!;

function rarityLabel(r: string) {
  if (r === "mythic") return "MYTHIC";
  if (r === "epic") return "EPIC";
  if (r === "rare") return "RARE";
  return "COMMON";
}

function refresh() {
  stats.innerHTML = `
    <div class="stat">🪙 Gold: <strong>${game.gold}</strong></div>
    <div class="stat">⭐ Stars: <strong>${game.stars}</strong></div>
    <div class="stat">🌊 Wave: <strong>${game.wave}</strong></div>
    <div class="stat">🍪 Cookie: <strong>${game.cookieHp}/${game.cookieMax}</strong></div>
  `;

  if (!game.bag.length) {
    bag.innerHTML = `<span class="empty-inv">Bag is empty — press Summon!</span>`;
  } else {
    bag.innerHTML = game.bag
      .map(
        (f, i) => `
      <button class="inv-item ${game.selectedBag === i ? "selected" : ""}" data-i="${i}">
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
    selectHint.textContent = `${f.def.emoji} ${f.def.name} Lv${f.level} — upgrade costs ${upgradeCost(f)} gold`;
  } else {
    selectHint.textContent = "Tap a friend on the path to upgrade them.";
  }

  toast.textContent = game.toastText;
  toast.classList.toggle("show", game.toastTimer > 0);
  over.classList.toggle("hidden", !game.gameOver);

  (document.querySelector("#summon") as HTMLButtonElement).disabled = game.stars < 1;
  (document.querySelector("#lucky") as HTMLButtonElement).disabled = game.stars < 3;
}

game.onChange = refresh;
refresh();

document.querySelector("#play-btn")!.addEventListener("click", () => {
  start.classList.add("hidden");
  game.running = true;
});

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
  if (confirm("Start over? You will lose your progress.")) game.reset();
});

// pause until play
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

// autosave heartbeat
setInterval(() => game.save(), 10000);
