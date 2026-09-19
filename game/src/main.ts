import "./style.css";
import { Game } from "./game/Game";
import { rarityLabel, evolveChanceFor } from "./game/data";
import { unlockAudio, setMuted, isMuted } from "./game/sound";
import { getActiveMap, listCourses } from "./game/path";
import { upgradeCost } from "./game/types";

const app = document.querySelector<HTMLDivElement>("#app")!;

app.innerHTML = `
  <section class="home" id="home">
    <h1 class="home-brand">Cookie Guard</h1>
    <p class="home-line">Protect your giant cookie with cute animal friends.</p>
    <div class="course-picker" id="home-courses">
      <p class="course-label">Choose a course</p>
      <div class="course-chips" id="home-course-chips"></div>
      <button class="course-random" id="home-random-course" type="button">🎲 Random course</button>
    </div>
    <button class="home-play" id="play-btn" type="button">Play</button>
    <p class="home-note">No ads. Just the game.</p>
    <p class="home-credit">made by James Nguyen</p>
  </section>

  <section class="play-screen hidden" id="play-screen">
    <header class="top-bar">
      <div class="brand-small">Cookie Guard</div>
      <div class="top-actions">
        <button class="home-link" id="pause-btn" type="button">Pause</button>
        <button class="home-link" id="mute-btn" type="button">Sound: On</button>
        <button class="home-link" id="back-home" type="button">Home</button>
      </div>
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
        <div class="row">
          <button class="danger" id="delete-unit" type="button">Delete unit</button>
        </div>
        <p class="hint">Tap a friend once to equip, then tap a + spot to deploy.</p>
      </section>

      <section class="panel">
        <h2>Actions</h2>
        <div class="row">
          <button class="wave-btn" id="start-wave" type="button">Start Wave</button>
        </div>
        <div class="row">
          <button class="pause-btn" id="pause-action" type="button">Pause</button>
        </div>
        <div class="course-panel">
          <p class="hint">Course (between waves)</p>
          <div class="course-chips" id="play-course-chips"></div>
          <button class="course-random" id="play-random-course" type="button">🎲 Random course</button>
        </div>
        <div class="row">
          <button class="green" id="upgrade" type="button">Upgrade / Evolve</button>
          <button id="sell" type="button">To bag</button>
        </div>
        <div class="row">
          <button id="clear-board" type="button">Clear board</button>
        </div>
        <div class="row">
          <button class="spell" id="crumb" type="button">Crumb (5🪙)</button>
          <button class="spell" id="frost" type="button">Frost (4🪙)</button>
          <button class="spell" id="zap" type="button">Zap (6🪙)</button>
        </div>
        <p class="hint" id="select-hint">Upgrade to try a 50% mythical evolve!</p>
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
const homeCourseChips = document.querySelector("#home-course-chips")!;
const playCourseChips = document.querySelector("#play-course-chips")!;

function renderCourseChips(container: Element, opts: { requireIdle: boolean }) {
  const courses = listCourses();
  const locked = opts.requireIdle && !game.canChangeCourse();
  container.innerHTML = courses
    .map(
      (c) => `
    <button class="course-chip ${!game.courseRandom && game.courseIndex === c.index ? "selected" : ""}"
      data-course="${c.index}" type="button" ${locked ? "disabled" : ""}>
      ${c.name}
    </button>`,
    )
    .join("");
  container.querySelectorAll<HTMLButtonElement>(".course-chip").forEach((btn) => {
    btn.onclick = () => {
      unlockAudio();
      game.selectCourse(Number(btn.dataset.course), { random: false });
      refreshCourses();
    };
  });
}

function refreshCourses() {
  renderCourseChips(homeCourseChips, { requireIdle: false });
  renderCourseChips(playCourseChips, { requireIdle: true });
  const homeRandom = document.querySelector("#home-random-course") as HTMLButtonElement;
  const playRandom = document.querySelector("#play-random-course") as HTMLButtonElement;
  homeRandom.classList.toggle("selected", game.courseRandom);
  playRandom.classList.toggle("selected", game.courseRandom);
  playRandom.disabled = !game.canChangeCourse();
}

function refresh() {
  stats.innerHTML = `
    <div class="stat">🪙 ${game.gold}</div>
    <div class="stat">⭐ ${game.stars}</div>
    <div class="stat">Wave ${game.wave}</div>
    <div class="stat">🗺️ ${getActiveMap().name}${game.courseRandom ? " 🎲" : ""}</div>
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
        game.equipFromBag(Number(btn.dataset.i));
      };
    });
  }

  if (game.selectedSlot != null && game.slots[game.selectedSlot]?.friend) {
    const f = game.slots[game.selectedSlot].friend!;
    let extra = "";
    if (f.def.ability === "floppyFin") extra += " · Floppy Fin";
    if (f.def.ability === "foxWall") extra += " · builds walls";
    if (f.def.ability === "godBeam") extra += " · God Beam";
    if (f.def.canEvolve && f.def.evolvesTo) {
      const pct = Math.round(evolveChanceFor(f.def) * 1000) / 10;
      const label = Number.isInteger(pct) ? String(pct) : pct.toFixed(1);
      const target =
        f.def.evolvesTo === "werewolf"
          ? "Werewolf"
          : f.def.evolvesTo === "giantpanda"
            ? "Giant Panda"
            : "mythical";
      extra += ` · ${label}% → ${target}!`;
    }
    if (f.def.id === "giantpanda") extra = " · MEGA Giant Panda!";
    if (f.def.rarity === "mythical" && f.def.id !== "giantpanda") extra = " · MYTHICAL form!";
    if (f.def.rarity === "god") extra = " · GOD TIER!";
    selectHint.textContent = `${f.def.emoji} ${f.def.name} Lv${f.level} — ${upgradeCost(f)}🪙${extra}`;
  } else if (game.selectedBag != null && game.bag[game.selectedBag]) {
    const f = game.bag[game.selectedBag];
    selectHint.textContent = `${f.emoji} ${f.name} equipped — tap a glowing + spot to deploy`;
  } else {
    selectHint.textContent = "Tap a bag friend once to equip, then tap a + spot to deploy.";
  }

  toast.textContent = game.toastText;
  toast.classList.toggle("show", game.toastTimer > 0);
  over.classList.toggle("hidden", !game.gameOver);

  (document.querySelector("#summon") as HTMLButtonElement).disabled = game.stars < 1;
  (document.querySelector("#lucky") as HTMLButtonElement).disabled = game.stars < 3;
  const startBtn = document.querySelector("#start-wave") as HTMLButtonElement;
  startBtn.disabled = !game.canStartWave();
  startBtn.textContent = game.canStartWave()
    ? `Start Wave ${game.wave}`
    : game.waveInProgress || game.spawnLeft > 0 || game.thieves.some((t) => t.alive)
      ? `Wave ${game.wave}…`
      : `Start Wave ${game.wave}`;

  const pauseLabel = game.paused ? "Resume" : "Pause";
  (document.querySelector("#pause-btn") as HTMLButtonElement).textContent = pauseLabel;
  const pauseAction = document.querySelector("#pause-action") as HTMLButtonElement;
  pauseAction.textContent = pauseLabel;
  pauseAction.disabled = game.gameOver;
  pauseAction.classList.toggle("is-paused", game.paused);

  refreshCourses();
}

game.onChange = refresh;
refresh();

function showHome() {
  game.running = false;
  game.setPaused(false);
  home.classList.remove("hidden");
  playScreen.classList.add("hidden");
  refreshCourses();
}

function showPlay() {
  unlockAudio();
  home.classList.add("hidden");
  playScreen.classList.remove("hidden");
  game.running = true;
  game.setPaused(false);
  game.paint();
  refresh();
}

document.querySelector("#play-btn")!.addEventListener("click", showPlay);
document.querySelector("#back-home")!.addEventListener("click", showHome);

const muteBtn = document.querySelector<HTMLButtonElement>("#mute-btn")!;
muteBtn.addEventListener("click", () => {
  setMuted(!isMuted());
  muteBtn.textContent = isMuted() ? "Sound: Off" : "Sound: On";
});

document.querySelector("#retry-btn")!.addEventListener("click", () => {
  unlockAudio();
  game.reset();
  over.classList.add("hidden");
});

document.querySelector("#summon")!.addEventListener("click", () => game.summon(false));
document.querySelector("#lucky")!.addEventListener("click", () => game.summon(true));
document.querySelector("#start-wave")!.addEventListener("click", () => {
  unlockAudio();
  game.requestStartWave();
});

function onPauseClick() {
  unlockAudio();
  game.togglePause();
}
document.querySelector("#pause-btn")!.addEventListener("click", onPauseClick);
document.querySelector("#pause-action")!.addEventListener("click", onPauseClick);

document.querySelector("#home-random-course")!.addEventListener("click", () => {
  unlockAudio();
  game.randomizeCourse();
  refreshCourses();
});
document.querySelector("#play-random-course")!.addEventListener("click", () => {
  unlockAudio();
  game.randomizeCourse();
});

document.querySelector("#upgrade")!.addEventListener("click", () => game.upgradeSelected());
document.querySelector("#sell")!.addEventListener("click", () => game.sellSelected());
document.querySelector("#clear-board")!.addEventListener("click", () => {
  if (confirm("Move all board friends back to the bag?")) game.clearBoard();
});
document.querySelector("#delete-unit")!.addEventListener("click", () => {
  if (confirm("Delete this friend forever?")) game.deleteSelected();
});
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
  if (game.toastTimer > 0 || game.gameOver || game.waveWaiting || game.paused) refresh();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

setInterval(() => {
  if (game.running) game.save();
}, 15000);
