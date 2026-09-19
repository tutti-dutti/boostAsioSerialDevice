import "./style.css";
import { Game } from "./game/Game";
import { rarityLabel, weaponRoleFor, weaponRoleLabel, evolveLineage, type FriendDef } from "./game/data";
import { unlockAudio, setMuted, isMuted } from "./game/sound";
import { getActiveMap, listCourses } from "./game/path";
import { upgradeCost, isBeaverBuilder, BEAVER_DAM_COST } from "./game/types";
import {
  formatScoreDate,
  getSavedPlayerName,
  isHighScoreWorthy,
  loadHighScores,
  submitHighScore,
  type HighScore,
} from "./game/highscores";
import { submitFeedback, type FeedbackKind } from "./game/feedback";

const app = document.querySelector<HTMLDivElement>("#app")!;

app.innerHTML = `
  <section class="home" id="home">
    <h1 class="home-brand">Cookie Guard <span class="home-by">by James Nguyen</span></h1>
    <p class="home-line">Protect your giant cookie with cute animal friends.</p>
    <div class="course-picker" id="home-courses">
      <p class="course-label">Choose a course</p>
      <div class="course-chips" id="home-course-chips"></div>
      <button class="course-random" id="home-random-course" type="button">🎲 Random course</button>
    </div>
    <button class="home-play" id="play-btn" type="button">Play</button>
    <button class="home-feedback" id="home-feedback-btn" type="button">Feedback &amp; ideas</button>
    <p class="home-note">No ads. Just the game.</p>
    <div class="home-scores" id="home-scores">
      <h2 class="scores-title">High Scores</h2>
      <ol class="scores-list" id="home-scores-list"></ol>
      <p class="scores-empty hidden" id="home-scores-empty">No scores yet — clear waves to earn a spot!</p>
    </div>
  </section>

  <section class="play-screen hidden" id="play-screen">
    <header class="top-bar">
      <div class="brand-small">Cookie Guard <span class="brand-by">by James Nguyen</span></div>
      <div class="top-actions">
        <button class="home-link" id="pause-btn" type="button">Pause</button>
        <button class="home-link" id="mute-btn" type="button">Sound: On</button>
        <button class="home-link" id="play-feedback-btn" type="button">Feedback</button>
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
          <p id="over-score-line">The thieves ate it. Try again?</p>
          <div class="score-save hidden" id="score-save">
            <p class="score-save-label">New high score! Enter your name:</p>
            <div class="score-save-row">
              <input id="score-name" type="text" maxlength="16" placeholder="Your name" autocomplete="nickname" />
              <button class="green" id="save-score-btn" type="button">Save</button>
            </div>
            <p class="hint" id="score-save-status"></p>
          </div>
          <ol class="scores-list scores-list-compact" id="over-scores-list"></ol>
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
        <p class="hint">Equip from bag, tap grass to deploy (not the path). Drag friends to move them.</p>
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
        <div class="row beaver-dam-row hidden" id="beaver-dam-row">
          <button class="dam-btn" id="build-dam" type="button">Build Dam (5🪵)</button>
        </div>
        <div class="row">
          <button id="clear-board" type="button">Clear board</button>
        </div>
        <div class="row">
          <button class="spell" id="crumb" type="button">Crumb (5🪙)</button>
          <button class="spell" id="frost" type="button">Frost (4🪙)</button>
          <button class="spell" id="zap" type="button">Zap (6🪙)</button>
        </div>
        <p class="hint" id="select-hint">Upgrade to try a 5% mythical evolve!</p>
        <div class="evolve-lineage hidden" id="evolve-lineage" aria-live="polite">
          <div class="evolve-row">
            <span class="evolve-label">Evolved from</span>
            <span class="evolve-value" id="evolve-from">—</span>
          </div>
          <div class="evolve-row">
            <span class="evolve-label">Evolves into</span>
            <span class="evolve-value" id="evolve-into">—</span>
          </div>
        </div>
        <div class="row">
          <button id="new-game" type="button">New game</button>
        </div>
      </section>
    </div>
  </section>

  <div class="feedback-overlay hidden" id="feedback-overlay" role="dialog" aria-modal="true" aria-labelledby="feedback-title">
    <div class="feedback-card">
      <h2 id="feedback-title">Send a note</h2>
      <p class="feedback-lead">Share feedback or an idea request for Cookie Guard.</p>
      <div class="feedback-kinds" role="tablist" aria-label="Message type">
        <button type="button" class="feedback-kind selected" data-kind="feedback" id="kind-feedback">Feedback</button>
        <button type="button" class="feedback-kind" data-kind="idea" id="kind-idea">Idea request</button>
      </div>
      <label class="feedback-field">
        <span>Your name (optional)</span>
        <input id="feedback-name" type="text" maxlength="40" placeholder="Player name" autocomplete="nickname" />
      </label>
      <label class="feedback-field">
        <span>Your message</span>
        <textarea id="feedback-message" rows="5" maxlength="2000" placeholder="What should we know or add?"></textarea>
      </label>
      <p class="hint" id="feedback-status"></p>
      <div class="feedback-actions">
        <button type="button" class="green" id="feedback-submit">Submit</button>
        <button type="button" id="feedback-cancel">Close</button>
      </div>
    </div>
  </div>
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
const evolveLineageEl = document.querySelector("#evolve-lineage")!;
const evolveFromEl = document.querySelector("#evolve-from")!;
const evolveIntoEl = document.querySelector("#evolve-into")!;
const homeCourseChips = document.querySelector("#home-course-chips")!;
const playCourseChips = document.querySelector("#play-course-chips")!;
const homeScoresList = document.querySelector("#home-scores-list")!;
const homeScoresEmpty = document.querySelector("#home-scores-empty")!;
const overScoreLine = document.querySelector("#over-score-line")!;
const scoreSave = document.querySelector("#score-save")!;
const scoreNameInput = document.querySelector<HTMLInputElement>("#score-name")!;
const scoreSaveStatus = document.querySelector("#score-save-status")!;
const overScoresList = document.querySelector("#over-scores-list")!;
const feedbackOverlay = document.querySelector("#feedback-overlay")!;
const feedbackNameInput = document.querySelector<HTMLInputElement>("#feedback-name")!;
const feedbackMessageInput = document.querySelector<HTMLTextAreaElement>("#feedback-message")!;
const feedbackStatus = document.querySelector("#feedback-status")!;

let scorePromptShown = false;
let scoreSavedThisRun = false;
let feedbackKind: FeedbackKind = "feedback";
let pausedForFeedback = false;

function renderScoresList(container: Element, scores: HighScore[], compact = false) {
  container.innerHTML = scores
    .map(
      (s, i) => `
    <li class="score-row">
      <span class="score-rank">${i + 1}.</span>
      <span class="score-name">${escapeHtml(s.name)}</span>
      <span class="score-wave">Wave ${s.wave}</span>
      ${compact ? "" : `<span class="score-meta">${s.gold}🪙 · ${formatScoreDate(s.at)}</span>`}
    </li>`,
    )
    .join("");
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function refreshHomeScores() {
  const scores = loadHighScores();
  renderScoresList(homeScoresList, scores);
  homeScoresEmpty.classList.toggle("hidden", scores.length > 0);
  homeScoresList.classList.toggle("hidden", scores.length === 0);
}

function setupGameOverScoreUi() {
  overScoreLine.textContent = `Reached wave ${game.wave} with ${game.gold}🪙. The thieves ate it!`;
  const scores = loadHighScores();
  renderScoresList(overScoresList, scores, true);

  const worthy = !scoreSavedThisRun && isHighScoreWorthy(game.wave, game.gold);
  scoreSave.classList.toggle("hidden", !worthy);
  if (worthy && !scorePromptShown) {
    scorePromptShown = true;
    scoreNameInput.value = getSavedPlayerName();
    scoreSaveStatus.textContent = "";
    setTimeout(() => scoreNameInput.focus(), 50);
  }
}

function saveCurrentScore() {
  if (scoreSavedThisRun) return;
  const name = scoreNameInput.value.trim() || getSavedPlayerName() || "Player";
  const list = submitHighScore(name, game.wave, game.gold);
  scoreSavedThisRun = true;
  scoreSave.classList.add("hidden");
  scoreSaveStatus.textContent = `Saved — nice run, ${name}!`;
  renderScoresList(overScoresList, list, true);
  refreshHomeScores();
}

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

  function showEvolveLineage(def: FriendDef | null) {
    if (!def) {
      evolveLineageEl.classList.add("hidden");
      return;
    }
    const line = evolveLineage(def);
    evolveFromEl.textContent = line.fromLabel;
    evolveIntoEl.textContent = line.intoLabel;
    evolveLineageEl.classList.remove("hidden");
  }

  if (game.selectedSlot != null) {
    const slot = game.slots.find((s) => s.id === game.selectedSlot);
    if (slot?.friend) {
      const f = slot.friend;
      let extra = "";
      if (f.def.ability === "floppyFin") extra += " · Floppy Fin";
      if (f.def.ability === "foxWall") extra += " · builds walls";
      if (f.def.ability === "godBeam") extra += " · God Beam";
      if (f.def.ability === "freeze") extra += " · FREEZE";
      if (f.def.ability === "heavyHit") extra += " · HEAVY HIT";
      extra += ` · ${weaponRoleLabel(weaponRoleFor(f.def))}`;
      if (f.def.id === "giantpanda") extra += " · MEGA Giant Panda!";
      else if (f.def.rarity === "mythical") extra += " · MYTHICAL form!";
      else if (f.def.rarity === "god") extra += " · GOD TIER!";
      if (isBeaverBuilder(f)) {
        const pts = f.beaverPoints ?? 0;
        extra += ` · ${pts}/${BEAVER_DAM_COST}🪵 dam points`;
      }
      selectHint.textContent = `${f.def.emoji} ${f.def.name} Lv${f.level} — ${upgradeCost(f)}🪙${extra}`;
      showEvolveLineage(f.def);
    } else if (game.selectedBag != null && game.bag[game.selectedBag]) {
      const f = game.bag[game.selectedBag];
      selectHint.textContent = `${f.emoji} ${f.name} equipped — tap grass (not the path) to deploy`;
      showEvolveLineage(f);
    } else {
      selectHint.textContent = "Drag friends to move. Equip from bag, then tap grass to deploy.";
      showEvolveLineage(null);
    }
  } else if (game.selectedBag != null && game.bag[game.selectedBag]) {
    const f = game.bag[game.selectedBag];
    selectHint.textContent = `${f.emoji} ${f.name} equipped — tap grass (not the path) to deploy`;
    showEvolveLineage(f);
  } else {
    selectHint.textContent = "Drag friends to move. Equip from bag, then tap grass to deploy.";
    showEvolveLineage(null);
  }

  toast.textContent = game.toastText;
  toast.classList.toggle("show", game.toastTimer > 0);
  const wasHidden = over.classList.contains("hidden");
  over.classList.toggle("hidden", !game.gameOver);
  // Only rebuild score UI when overlay first opens — avoid wiping the name field
  if (game.gameOver && wasHidden) {
    scorePromptShown = false;
    scoreSavedThisRun = false;
    setupGameOverScoreUi();
  }

  (document.querySelector("#summon") as HTMLButtonElement).disabled = game.stars < 1;
  (document.querySelector("#lucky") as HTMLButtonElement).disabled = game.stars < 3;
  const startBtn = document.querySelector("#start-wave") as HTMLButtonElement;
  startBtn.disabled = !game.canStartWave();
  startBtn.textContent = game.canStartWave()
    ? game.autoWaveTimer > 0
      ? `Start Now (${Math.ceil(game.autoWaveTimer)})`
      : `Start Wave ${game.wave}`
    : game.waveInProgress || game.spawnLeft > 0 || game.thieves.some((t) => t.alive)
      ? `Wave ${game.wave}…`
      : `Start Wave ${game.wave}`;

  const pauseLabel = game.paused ? "Resume" : "Pause";
  (document.querySelector("#pause-btn") as HTMLButtonElement).textContent = pauseLabel;
  const pauseAction = document.querySelector("#pause-action") as HTMLButtonElement;
  pauseAction.textContent = pauseLabel;
  pauseAction.disabled = game.gameOver;
  pauseAction.classList.toggle("is-paused", game.paused);

  const beaverRow = document.querySelector("#beaver-dam-row")!;
  const buildDamBtn = document.querySelector("#build-dam") as HTMLButtonElement;
  const beaverSlot = game.selectedBeaver();
  if (beaverSlot?.friend) {
    beaverRow.classList.remove("hidden");
    const pts = beaverSlot.friend.beaverPoints ?? 0;
    buildDamBtn.textContent = `Build Dam (${pts}/${BEAVER_DAM_COST}🪵)`;
    buildDamBtn.disabled = !game.canBuildDam() || game.gameOver;
  } else {
    beaverRow.classList.add("hidden");
  }

  refreshCourses();
}

game.onChange = refresh;
refresh();
refreshHomeScores();

function showHome() {
  game.running = false;
  game.setPaused(false);
  home.classList.remove("hidden");
  playScreen.classList.add("hidden");
  refreshCourses();
  refreshHomeScores();
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

function openFeedbackMenu() {
  unlockAudio();
  feedbackKind = "feedback";
  document.querySelectorAll<HTMLButtonElement>(".feedback-kind").forEach((btn) => {
    btn.classList.toggle("selected", btn.dataset.kind === feedbackKind);
  });
  feedbackNameInput.value = getSavedPlayerName();
  feedbackMessageInput.value = "";
  feedbackStatus.textContent = "";
  pausedForFeedback = false;
  if (game.running && !game.paused && !game.gameOver) {
    game.setPaused(true);
    pausedForFeedback = true;
  }
  feedbackOverlay.classList.remove("hidden");
  setTimeout(() => feedbackMessageInput.focus(), 40);
  refresh();
}

function closeFeedbackMenu() {
  feedbackOverlay.classList.add("hidden");
  if (pausedForFeedback && game.paused && !game.gameOver) {
    game.setPaused(false);
  }
  pausedForFeedback = false;
  refresh();
}

document.querySelector("#home-feedback-btn")!.addEventListener("click", openFeedbackMenu);
document.querySelector("#play-feedback-btn")!.addEventListener("click", openFeedbackMenu);
document.querySelector("#feedback-cancel")!.addEventListener("click", closeFeedbackMenu);
feedbackOverlay.addEventListener("click", (e) => {
  if (e.target === feedbackOverlay) closeFeedbackMenu();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !feedbackOverlay.classList.contains("hidden")) {
    closeFeedbackMenu();
  }
});

document.querySelectorAll<HTMLButtonElement>(".feedback-kind").forEach((btn) => {
  btn.addEventListener("click", () => {
    feedbackKind = (btn.dataset.kind as FeedbackKind) || "feedback";
    document.querySelectorAll<HTMLButtonElement>(".feedback-kind").forEach((b) => {
      b.classList.toggle("selected", b.dataset.kind === feedbackKind);
    });
  });
});

document.querySelector("#feedback-submit")!.addEventListener("click", () => {
  unlockAudio();
  const result = submitFeedback({
    kind: feedbackKind,
    name: feedbackNameInput.value,
    message: feedbackMessageInput.value,
  });
  if (!result.ok) {
    feedbackStatus.textContent = result.error;
    return;
  }
  feedbackStatus.textContent = "Saved — opening your mail app to send it. Thanks!";
  feedbackMessageInput.value = "";
  setTimeout(() => closeFeedbackMenu(), 900);
});

const muteBtn = document.querySelector<HTMLButtonElement>("#mute-btn")!;
muteBtn.addEventListener("click", () => {
  setMuted(!isMuted());
  muteBtn.textContent = isMuted() ? "Sound: Off" : "Sound: On";
});

document.querySelector("#retry-btn")!.addEventListener("click", () => {
  unlockAudio();
  scorePromptShown = false;
  scoreSavedThisRun = false;
  game.reset();
  over.classList.add("hidden");
});

document.querySelector("#save-score-btn")!.addEventListener("click", () => {
  unlockAudio();
  saveCurrentScore();
});
scoreNameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    saveCurrentScore();
  }
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
document.querySelector("#build-dam")!.addEventListener("click", () => {
  unlockAudio();
  game.buildBeaverDam();
});
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
  if (game.toastTimer > 0 || game.gameOver || game.waveWaiting || game.paused || game.autoWaveTimer > 0) refresh();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

setInterval(() => {
  if (game.running) game.save();
}, 15000);
