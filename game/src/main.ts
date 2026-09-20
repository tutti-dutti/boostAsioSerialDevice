import "./style.css";
import { Game } from "./game/Game";
import { rarityLabel, weaponRoleFor, weaponRoleLabel, evolveLineage, type FriendDef } from "./game/data";
import { friendPortraitDataUrl, weaponRoleShort } from "./game/animalArt";
import { unlockAudio, setMuted, isMuted, playUnmuteChirp } from "./game/sound";
import { getActiveMap, listCourses } from "./game/path";
import { upgradeCost, isBeaverBuilder, BEAVER_DAM_COST, isEagleBomber, EAGLE_LAND_COST } from "./game/types";
import {
  formatScoreDate,
  getSavedPlayerName,
  isHighScoreWorthy,
  loadHighScores,
  submitHighScore,
  type HighScore,
} from "./game/highscores";
import { DIFFICULTIES, isDifficulty, type Difficulty } from "./game/difficulty";
import { submitFeedback, fetchFeedbackList, kindLabel, type FeedbackKind, type FeedbackEntry } from "./game/feedback";

const app = document.querySelector<HTMLDivElement>("#app")!;

app.innerHTML = `
  <section class="home" id="home">
    <h1 class="home-brand">Cookie Guard <span class="home-by">by James Nguyen</span></h1>
    <p class="home-line">Animal friends</p>
    <div class="course-picker" id="home-courses">
      <p class="course-label">Choose a course</p>
      <div class="course-chips" id="home-course-chips"></div>
      <button class="course-random" id="home-random-course" type="button">🎲 Random course</button>
    </div>
    <div class="mode-picker" id="home-modes">
      <p class="course-label">Difficulty</p>
      <div class="mode-chips" id="home-mode-chips" role="group" aria-label="Difficulty">
        <button class="mode-chip mode-easy" data-mode="easy" type="button">Easy</button>
        <button class="mode-chip mode-medium" data-mode="medium" type="button">Medium</button>
        <button class="mode-chip mode-hard" data-mode="hard" type="button">Hard</button>
      </div>
      <p class="mode-blurb" id="home-mode-blurb">Softer thieves — learn roles & place freely</p>
    </div>
    <button class="home-play" id="play-btn" type="button">Play</button>
    <button class="home-feedback" id="home-feedback-btn" type="button">Feedback &amp; ideas</button>
    <p class="home-note">No ads. Just the game.</p>
    <div class="home-scores" id="home-scores">
      <h2 class="scores-title">High Scores</h2>
      <div class="mode-chips scores-mode-chips" id="home-score-chips" role="group" aria-label="Score play level">
        <button class="mode-chip mode-easy selected" data-score-mode="easy" type="button">Easy</button>
        <button class="mode-chip mode-medium" data-score-mode="medium" type="button">Medium</button>
        <button class="mode-chip mode-hard" data-score-mode="hard" type="button">Hard</button>
      </div>
      <ol class="scores-list" id="home-scores-list"></ol>
      <p class="scores-empty hidden" id="home-scores-empty">No scores yet for this level — clear waves to earn a spot!</p>
    </div>
  </section>

  <section class="play-screen hidden" id="play-screen">
    <div class="status-banner" id="status-banner" aria-live="polite">
      <div class="status-main" id="status-main"></div>
      <div class="status-meta">
        <span class="status-upgrade" id="status-upgrade">Select friend for upgrade cost</span>
        <div class="status-links">
          <button class="home-link" id="mute-btn" type="button">Sound: On</button>
          <button class="home-link" id="play-scores-btn" type="button">Save score</button>
          <button class="home-link" id="play-feedback-btn" type="button">Feedback</button>
          <button class="home-link" id="back-home" type="button">Home</button>
        </div>
      </div>
    </div>

    <div class="action-banner" id="action-banner">
      <button class="new-game-btn" id="new-game" type="button">New game</button>
      <button class="wave-btn" id="start-wave" type="button">Start Wave</button>
      <button class="pause-btn" id="pause-action" type="button">Pause</button>
      <button class="spell" id="crumb" type="button">Crumb 5🪙</button>
      <button class="spell" id="frost" type="button">Frost 4🪙</button>
      <button class="spell" id="zap" type="button">Zap 6🪙</button>
    </div>

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

    <div class="bottom-dock" id="bottom-dock">
      <div class="friends-panel" id="friends-strip">
        <div class="inventory" id="bag"></div>
      </div>

      <div class="manage-panel" id="manage-panel">
        <div class="manage-row summon-row">
          <button class="big" id="summon" type="button">Summon 15⭐</button>
          <button class="pink" id="lucky" type="button">Lucky 30⭐</button>
          <button class="danger" id="clear-bag" type="button">Clear unused</button>
        </div>
        <div class="manage-row">
          <button class="green" id="upgrade" type="button">Upgrade / Evolve</button>
          <button id="sell" type="button">To bag</button>
          <button class="danger" id="delete-unit" type="button">Delete</button>
          <button id="clear-board" type="button">Clear board</button>
          <button id="clear-others" type="button">Clear others</button>
        </div>
        <div class="manage-row beaver-dam-row hidden" id="beaver-dam-row">
          <button class="dam-btn" id="build-dam" type="button">Build Dam (5🪵)</button>
        </div>
        <div class="manage-row eagle-land-row hidden" id="eagle-land-row">
          <button class="eagle-btn" id="eagle-land" type="button">Land &amp; Bomb (6⭐)</button>
        </div>
        <p class="hint select-hint" id="select-hint">Upgrade to try a 5% mythical evolve!</p>
        <p class="gold-upgrade-line hint" id="gold-upgrade-line">Gold 0🪙 · Select a friend for upgrade cost</p>
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
      </div>
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
      <div class="feedback-board" id="feedback-board">
        <div class="feedback-board-head">
          <h3 class="feedback-board-title">Current notes</h3>
          <div class="feedback-board-filters" role="group" aria-label="Show notes">
            <button type="button" class="feedback-filter selected" data-filter="all">All</button>
            <button type="button" class="feedback-filter" data-filter="feedback">Feedback</button>
            <button type="button" class="feedback-filter" data-filter="idea">Ideas</button>
          </div>
        </div>
        <p class="hint feedback-board-meta" id="feedback-board-meta">Loading…</p>
        <ul class="feedback-board-list" id="feedback-board-list"></ul>
        <p class="feedback-board-empty hidden" id="feedback-board-empty">No notes yet — be the first!</p>
      </div>
    </div>
  </div>

  <div class="confirm-overlay hidden" id="confirm-overlay" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
    <div class="confirm-card">
      <h2 id="confirm-title">Are you sure?</h2>
      <p class="confirm-message" id="confirm-message"></p>
      <div class="confirm-actions">
        <button type="button" class="danger" id="confirm-yes">Confirm</button>
        <button type="button" id="confirm-no">Cancel</button>
      </div>
    </div>
  </div>

  <div class="scores-overlay hidden" id="scores-overlay" role="dialog" aria-modal="true" aria-labelledby="scores-title">
    <div class="scores-card">
      <h2 id="scores-title">High scores</h2>
      <p class="scores-lead" id="scores-lead">Save your run for this play level.</p>
      <p class="scores-run-line" id="scores-run-line">Wave 1 · Easy · 0🪙</p>
      <div class="score-save" id="play-score-save">
        <p class="score-save-label" id="play-score-save-label">Enter your name to save</p>
        <div class="score-save-row">
          <input id="play-score-name" type="text" maxlength="16" placeholder="Your name" autocomplete="nickname" />
          <button class="green" id="play-save-score-btn" type="button">Save</button>
        </div>
        <p class="hint" id="play-score-save-status"></p>
      </div>
      <ol class="scores-list scores-list-compact" id="play-scores-list"></ol>
      <p class="scores-empty hidden" id="play-scores-empty">No scores for this level yet.</p>
      <button type="button" id="scores-close">Close</button>
    </div>
  </div>
`;

const home = document.querySelector<HTMLElement>("#home")!;
const playScreen = document.querySelector<HTMLElement>("#play-screen")!;
const canvas = document.querySelector<HTMLCanvasElement>("#stage")!;
const game = new Game(canvas);
(window as unknown as { __cg: Game }).__cg = game;

const statusMain = document.querySelector("#status-main")!;
const statusUpgrade = document.querySelector("#status-upgrade")!;
const bag = document.querySelector<HTMLElement>("#bag")!;
const toast = document.querySelector("#toast")!;
const over = document.querySelector("#over")!;
const selectHint = document.querySelector("#select-hint")!;
const evolveLineageEl = document.querySelector("#evolve-lineage")!;
const evolveFromEl = document.querySelector("#evolve-from")!;
const evolveIntoEl = document.querySelector("#evolve-into")!;
const goldUpgradeLine = document.querySelector("#gold-upgrade-line")!;
const upgradeBtn = document.querySelector<HTMLButtonElement>("#upgrade")!;
const homeCourseChips = document.querySelector("#home-course-chips")!;
const homeModeChips = document.querySelector("#home-mode-chips")!;
const homeModeBlurb = document.querySelector("#home-mode-blurb")!;
const homeScoresList = document.querySelector("#home-scores-list")!;
const homeScoresEmpty = document.querySelector("#home-scores-empty")!;
const homeScoreChips = document.querySelector("#home-score-chips")!;
const overScoreLine = document.querySelector("#over-score-line")!;
const scoreSave = document.querySelector("#score-save")!;
const scoreNameInput = document.querySelector<HTMLInputElement>("#score-name")!;
const scoreSaveStatus = document.querySelector("#score-save-status")!;
const overScoresList = document.querySelector("#over-scores-list")!;
const scoresOverlay = document.querySelector("#scores-overlay")!;
const scoresLead = document.querySelector("#scores-lead")!;
const scoresRunLine = document.querySelector("#scores-run-line")!;
const playScoreSave = document.querySelector("#play-score-save")!;
const playScoreSaveLabel = document.querySelector("#play-score-save-label")!;
const playScoreNameInput = document.querySelector<HTMLInputElement>("#play-score-name")!;
const playScoreSaveStatus = document.querySelector("#play-score-save-status")!;
const playScoresList = document.querySelector("#play-scores-list")!;
const playScoresEmpty = document.querySelector("#play-scores-empty")!;
const feedbackOverlay = document.querySelector("#feedback-overlay")!;
const feedbackNameInput = document.querySelector<HTMLInputElement>("#feedback-name")!;
const feedbackMessageInput = document.querySelector<HTMLTextAreaElement>("#feedback-message")!;
const feedbackStatus = document.querySelector("#feedback-status")!;
const feedbackBoardList = document.querySelector("#feedback-board-list")!;
const feedbackBoardEmpty = document.querySelector("#feedback-board-empty")!;
const feedbackBoardMeta = document.querySelector("#feedback-board-meta")!;
const confirmOverlay = document.querySelector("#confirm-overlay")!;
const confirmTitle = document.querySelector("#confirm-title")!;
const confirmMessage = document.querySelector("#confirm-message")!;
const confirmYesBtn = document.querySelector<HTMLButtonElement>("#confirm-yes")!;
const confirmNoBtn = document.querySelector<HTMLButtonElement>("#confirm-no")!;
let scorePromptShown = false;
let scoreSavedThisRun = false;
let homeScoreMode: Difficulty = "easy";
let pausedForScores = false;
let feedbackKind: FeedbackKind = "feedback";
let feedbackListFilter: FeedbackKind | "all" = "all";
let feedbackListLoading = false;
let pausedForFeedback = false;
let pausedForConfirm = false;
let confirmAction: (() => void) | null = null;

function openConfirm(opts: {
  title?: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
}) {
  unlockAudio();
  confirmTitle.textContent = opts.title ?? "Are you sure?";
  confirmMessage.textContent = opts.message;
  confirmYesBtn.textContent = opts.confirmLabel ?? "Confirm";
  confirmAction = opts.onConfirm;
  pausedForConfirm = false;
  if (game.running && !game.paused && !game.gameOver) {
    game.setPaused(true);
    pausedForConfirm = true;
  }
  confirmOverlay.classList.remove("hidden");
  setTimeout(() => confirmNoBtn.focus(), 40);
  refresh();
}

function closeConfirm(runAction: boolean) {
  confirmOverlay.classList.add("hidden");
  const action = confirmAction;
  confirmAction = null;
  if (pausedForConfirm && game.paused && !game.gameOver) {
    game.setPaused(false);
  }
  pausedForConfirm = false;
  if (runAction && action) action();
  refresh();
}

function renderScoresList(container: Element, scores: HighScore[], compact = false) {
  container.innerHTML = scores
    .map(
      (s, i) => `
    <li class="score-row">
      <span class="score-rank">${i + 1}.</span>
      <span class="score-name">${escapeHtml(s.name)}</span>
      <span class="score-wave">W${s.wave}</span>
      ${
        compact
          ? `<span class="score-meta">${s.gold}🪙</span>`
          : `<span class="score-meta">${s.gold}🪙 · ${formatScoreDate(s.at)}</span>`
      }
    </li>`,
    )
    .join("");
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function refreshHomeScores() {
  homeScoreChips.querySelectorAll<HTMLButtonElement>("[data-score-mode]").forEach((btn) => {
    btn.classList.toggle("selected", btn.dataset.scoreMode === homeScoreMode);
  });
  const scores = loadHighScores(homeScoreMode);
  renderScoresList(homeScoresList, scores);
  homeScoresEmpty.classList.toggle("hidden", scores.length > 0);
  homeScoresList.classList.toggle("hidden", scores.length === 0);
}

homeScoreChips.querySelectorAll<HTMLButtonElement>("[data-score-mode]").forEach((btn) => {
  btn.addEventListener("click", () => {
    unlockAudio();
    const mode = btn.dataset.scoreMode;
    if (isDifficulty(mode)) {
      homeScoreMode = mode;
      refreshHomeScores();
    }
  });
});

function setupGameOverScoreUi() {
  overScoreLine.textContent = `Reached wave ${game.wave} on ${game.difficultyLabel} with ${game.gold}🪙. The thieves ate it!`;
  const scores = loadHighScores(game.difficulty);
  renderScoresList(overScoresList, scores, true);

  const worthy = !scoreSavedThisRun && isHighScoreWorthy(game.wave, game.gold, game.difficulty);
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
  const list = submitHighScore(name, game.wave, game.gold, game.difficulty);
  scoreSavedThisRun = true;
  scoreSave.classList.add("hidden");
  scoreSaveStatus.textContent = `Saved — nice ${game.difficultyLabel} run, ${name}!`;
  renderScoresList(overScoresList, list, true);
  homeScoreMode = game.difficulty;
  refreshHomeScores();
}

function refreshPlayScoresPanel() {
  const mode = game.difficulty;
  scoresLead.textContent = `${game.difficultyLabel} level board — top runs only for this mode.`;
  scoresRunLine.textContent = `This run: Wave ${game.wave} · ${game.difficultyLabel} · ${game.gold}🪙`;
  const scores = loadHighScores(mode);
  renderScoresList(playScoresList, scores, true);
  playScoresEmpty.classList.toggle("hidden", scores.length > 0);
  playScoresList.classList.toggle("hidden", scores.length === 0);

  const worthy = isHighScoreWorthy(game.wave, game.gold, mode);
  if (scoreSavedThisRun) {
    playScoreSaveLabel.textContent = "Already saved this run";
    playScoreSaveStatus.textContent = "Start a new game to save again.";
    (document.querySelector("#play-save-score-btn") as HTMLButtonElement).disabled = true;
  } else if (worthy) {
    playScoreSaveLabel.textContent = "New high score for this level — enter your name";
    playScoreSaveStatus.textContent = "";
    (document.querySelector("#play-save-score-btn") as HTMLButtonElement).disabled = false;
  } else {
    playScoreSaveLabel.textContent = "Not a top score for this level yet";
    playScoreSaveStatus.textContent = "Reach a higher wave to earn a spot.";
    (document.querySelector("#play-save-score-btn") as HTMLButtonElement).disabled = true;
  }
  playScoreSave.classList.remove("hidden");
}

function openScoresMenu() {
  unlockAudio();
  playScoreNameInput.value = getSavedPlayerName();
  refreshPlayScoresPanel();
  pausedForScores = false;
  if (game.running && !game.paused && !game.gameOver) {
    game.setPaused(true);
    pausedForScores = true;
  }
  scoresOverlay.classList.remove("hidden");
  const canSave =
    !scoreSavedThisRun && isHighScoreWorthy(game.wave, game.gold, game.difficulty);
  if (canSave) setTimeout(() => playScoreNameInput.focus(), 40);
  refresh();
}

function closeScoresMenu() {
  scoresOverlay.classList.add("hidden");
  if (pausedForScores && game.paused && !game.gameOver) {
    game.setPaused(false);
  }
  pausedForScores = false;
  refresh();
}

function savePlayScoreFromPanel() {
  unlockAudio();
  if (scoreSavedThisRun) {
    playScoreSaveStatus.textContent = "Already saved this run.";
    return;
  }
  if (!isHighScoreWorthy(game.wave, game.gold, game.difficulty)) {
    playScoreSaveStatus.textContent = "Not high enough for this level board yet.";
    refreshPlayScoresPanel();
    return;
  }
  const name = playScoreNameInput.value.trim() || getSavedPlayerName() || "Player";
  const list = submitHighScore(name, game.wave, game.gold, game.difficulty);
  scoreSavedThisRun = true;
  playScoreSaveStatus.textContent = `Saved on ${game.difficultyLabel} — nice work, ${name}!`;
  renderScoresList(playScoresList, list, true);
  playScoresEmpty.classList.add("hidden");
  playScoresList.classList.remove("hidden");
  homeScoreMode = game.difficulty;
  refreshHomeScores();
  refreshPlayScoresPanel();
}

function refreshModes() {
  homeModeChips.querySelectorAll<HTMLButtonElement>(".mode-chip").forEach((btn) => {
    const mode = btn.dataset.mode as Difficulty;
    btn.classList.toggle("selected", game.difficulty === mode);
  });
  homeModeBlurb.textContent = DIFFICULTIES[game.difficulty].blurb;
}

homeModeChips.querySelectorAll<HTMLButtonElement>(".mode-chip").forEach((btn) => {
  btn.addEventListener("click", () => {
    unlockAudio();
    const mode = btn.dataset.mode as Difficulty;
    if (isDifficulty(mode)) {
      game.setDifficulty(mode);
      homeScoreMode = mode;
      refreshHomeScores();
    }
    refreshModes();
  });
});

function renderCourseChips(container: Element) {
  const courses = listCourses();
  container.innerHTML = courses
    .map(
      (c) => `
    <button class="course-chip ${game.courseIndex === c.index ? "selected" : ""}"
      data-course="${c.index}" type="button"
      aria-pressed="${game.courseIndex === c.index ? "true" : "false"}">
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
  renderCourseChips(homeCourseChips);
  const homeRandom = document.querySelector("#home-random-course") as HTMLButtonElement;
  homeRandom.classList.toggle("selected", game.courseRandom);
}

function refresh() {
  const courseName = `${getActiveMap().name}${game.courseRandom ? " 🎲" : ""}`;
  statusMain.innerHTML = `
    <span class="status-chip status-gold">🪙 ${game.gold}</span>
    <span class="status-chip">⭐ ${game.stars}</span>
    <span class="status-chip">Wave ${game.wave}</span>
    <span class="status-chip mode-stat mode-stat-${game.difficulty}">${game.difficultyLabel}</span>
    ${
      game.mythicalPressure() > 0
        ? `<span class="status-chip status-pressure">Mythic ×${game.mythicalPressure()} · +${game.mythicalPressure() * 100} HP</span>`
        : ""
    }
    <span class="status-chip">🗺️ ${courseName}</span>
    <span class="status-chip">🍪 ${game.cookieHp}/${game.cookieMax}</span>
  `;

  let upgradeCostAmt: number | null = null;
  const selected = game.selectedSlot != null ? game.slots.find((s) => s.id === game.selectedSlot) : null;
  if (selected?.friend) {
    upgradeCostAmt = upgradeCost(selected.friend);
  }

  if (upgradeCostAmt != null) {
    const need = upgradeCostAmt;
    const have = game.gold;
    const short = Math.max(0, need - have);
    statusUpgrade.textContent =
      short > 0 ? `Upgrade ${need}🪙 · ${short} short` : `Upgrade ${need}🪙 · ready`;
    statusUpgrade.classList.toggle("can-afford", short === 0);
    statusUpgrade.classList.toggle("cant-afford", short > 0);
    goldUpgradeLine.textContent =
      short > 0
        ? `Gold ${have}🪙 · Upgrade costs ${need}🪙 (${short} short)`
        : `Gold ${have}🪙 · Upgrade costs ${need}🪙 (enough!)`;
    goldUpgradeLine.classList.toggle("can-afford", short === 0);
    goldUpgradeLine.classList.toggle("cant-afford", short > 0);
    upgradeBtn.textContent = `Upgrade ${need}🪙`;
    upgradeBtn.disabled = short > 0;
  } else {
    statusUpgrade.textContent = "Select friend for upgrade cost";
    statusUpgrade.classList.remove("can-afford", "cant-afford");
    goldUpgradeLine.textContent = `Gold ${game.gold}🪙 · Select a friend for upgrade cost`;
    goldUpgradeLine.classList.remove("can-afford", "cant-afford");
    upgradeBtn.textContent = "Upgrade / Evolve";
    upgradeBtn.disabled = false;
  }

  if (!game.bag.length) {
    if (bag.dataset.sig !== "empty") {
      bag.dataset.sig = "empty";
      bag.innerHTML = `<span class="empty-inv">Press Summon to get friends</span>`;
    }
  } else {
    const bagSig = `${game.selectedBag ?? "x"}:${game.bag.map((f) => f.id).join(",")}`;
    if (bag.dataset.sig !== bagSig) {
      bag.dataset.sig = bagSig;
      bag.innerHTML = game.bag
        .map((f, i) => {
          const role = weaponRoleFor(f);
          return `
      <button class="inv-item ${game.selectedBag === i ? "selected" : ""} rarity-${f.rarity} role-${role}" data-i="${i}" type="button" title="${f.name} · ${rarityLabel(f.rarity)} · ${weaponRoleShort(role)}">
        <span class="portrait-wrap">
          <img class="emoji portrait" src="${friendPortraitDataUrl(f)}" alt="${f.name}" width="40" height="40" draggable="false" />
        </span>
        <span class="inv-name">${f.name}</span>
        <span class="inv-meta">
          <span class="rarity-${f.rarity}">${rarityLabel(f.rarity)}</span>
          <span class="role-tag role-${role}">${weaponRoleShort(role)}</span>
        </span>
      </button>`;
        })
        .join("");
    }
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
      if (f.def.ability === "poisonFart") extra += " · poison FARTs!";
      extra += ` · ${weaponRoleLabel(weaponRoleFor(f.def))}`;
      if (f.def.id === "giantpanda") extra += " · MEGA Giant Panda!";
      else if (f.def.rarity === "mythical") extra += " · MYTHICAL form!";
      else if (f.def.rarity === "god") extra += " · GOD TIER!";
      if (isBeaverBuilder(f)) {
        const pts = f.beaverPoints ?? 0;
        extra += ` · ${pts}/${BEAVER_DAM_COST}🪵 dam points`;
      }
      if (isEagleBomber(f)) {
        const pts = f.eaglePoints ?? 0;
        if (f.landed) extra += " · LANDED — dropping bombs!";
        else extra += ` · ${pts}/${EAGLE_LAND_COST}⭐ Freedom points`;
      }
      if (f.def.id === "giantpanda" || f.def.id === "redpanda") {
        extra += " · random 🥟 dumplings!";
      }
      selectHint.textContent = `${f.def.emoji} ${f.def.name} Lv${f.level} — Gold ${game.gold}🪙 · Upgrade ${upgradeCost(f)}🪙${extra}`;
      showEvolveLineage(f.def);
    } else if (game.selectedBag != null && game.bag[game.selectedBag]) {
      const f = game.bag[game.selectedBag];
      selectHint.textContent = `${f.emoji} ${f.name} equipped — tap grass to deploy`;
      showEvolveLineage(f);
    } else {
      selectHint.textContent = game.canMoveUnits()
        ? "Move friends between waves. Equip from bag to deploy."
        : "Wave in progress — move friends after it ends.";
      showEvolveLineage(null);
    }
  } else if (game.selectedBag != null && game.bag[game.selectedBag]) {
    const f = game.bag[game.selectedBag];
    selectHint.textContent = `${f.emoji} ${f.name} equipped — tap grass to deploy`;
    showEvolveLineage(f);
  } else {
    selectHint.textContent = game.canMoveUnits()
      ? "Move friends between waves. Equip from bag to deploy."
      : "Wave in progress — move friends after it ends.";
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

  (document.querySelector("#summon") as HTMLButtonElement).disabled = game.stars < 15;
  (document.querySelector("#lucky") as HTMLButtonElement).disabled = game.stars < 30;
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

  const eagleRow = document.querySelector("#eagle-land-row")!;
  const eagleLandBtn = document.querySelector("#eagle-land") as HTMLButtonElement;
  const eagleSlot = game.selectedEagle();
  if (eagleSlot?.friend) {
    eagleRow.classList.remove("hidden");
    const pts = eagleSlot.friend.eaglePoints ?? 0;
    if (eagleSlot.friend.landed) {
      const left = Math.max(0, Math.ceil(eagleSlot.friend.landTimer ?? 0));
      eagleLandBtn.textContent = `Bombing… ${left}s`;
      eagleLandBtn.disabled = true;
    } else {
      eagleLandBtn.textContent = `Land & Bomb (${pts}/${EAGLE_LAND_COST}⭐)`;
      eagleLandBtn.disabled = !game.canEagleLand() || game.gameOver;
    }
  } else {
    eagleRow.classList.add("hidden");
  }

  refreshCourses();
}

game.onChange = refresh;
refresh();
refreshModes();
refreshHomeScores();

function showHome() {
  game.running = false;
  game.setPaused(false);
  closeScoresMenu();
  home.classList.remove("hidden");
  playScreen.classList.add("hidden");
  refreshCourses();
  refreshModes();
  homeScoreMode = game.difficulty;
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

function renderFeedbackBoard(entries: FeedbackEntry[], source: "server" | "local") {
  feedbackBoardList.innerHTML = entries
    .map(
      (e) => `
    <li class="feedback-note kind-${e.kind}">
      <div class="feedback-note-top">
        <span class="feedback-note-kind">${kindLabel(e.kind)}</span>
        <span class="feedback-note-when">${formatScoreDate(e.at)}</span>
      </div>
      <p class="feedback-note-msg">${escapeHtml(e.message)}</p>
      <p class="feedback-note-by">${escapeHtml(e.name || "Anonymous")}</p>
    </li>`,
    )
    .join("");
  feedbackBoardEmpty.classList.toggle("hidden", entries.length > 0);
  feedbackBoardList.classList.toggle("hidden", entries.length === 0);
  feedbackBoardMeta.textContent =
    entries.length === 0
      ? source === "local"
        ? "Showing your saved notes (offline)."
        : "No public notes yet."
      : source === "local"
        ? `${entries.length} saved on this device`
        : `${entries.length} recent note${entries.length === 1 ? "" : "s"}`;
}

async function refreshFeedbackBoard() {
  if (feedbackListLoading) return;
  feedbackListLoading = true;
  feedbackBoardMeta.textContent = "Loading…";
  document.querySelectorAll<HTMLButtonElement>(".feedback-filter").forEach((btn) => {
    btn.classList.toggle("selected", btn.dataset.filter === feedbackListFilter);
  });
  try {
    const result = await fetchFeedbackList(feedbackListFilter, 24);
    renderFeedbackBoard(result.entries, result.source);
  } catch {
    feedbackBoardMeta.textContent = "Could not load notes.";
  } finally {
    feedbackListLoading = false;
  }
}

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
  void refreshFeedbackBoard();
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
document.querySelectorAll<HTMLButtonElement>(".feedback-kind").forEach((btn) => {
  btn.addEventListener("click", () => {
    feedbackKind = (btn.dataset.kind as FeedbackKind) || "feedback";
    document.querySelectorAll<HTMLButtonElement>(".feedback-kind").forEach((b) => {
      b.classList.toggle("selected", b.dataset.kind === feedbackKind);
    });
  });
});

document.querySelectorAll<HTMLButtonElement>(".feedback-filter").forEach((btn) => {
  btn.addEventListener("click", () => {
    unlockAudio();
    const f = btn.dataset.filter;
    feedbackListFilter = f === "idea" || f === "feedback" ? f : "all";
    void refreshFeedbackBoard();
  });
});

document.querySelector("#feedback-submit")!.addEventListener("click", async () => {
  unlockAudio();
  feedbackStatus.textContent = "Sending…";
  const submitBtn = document.querySelector<HTMLButtonElement>("#feedback-submit")!;
  submitBtn.disabled = true;
  try {
    const result = await submitFeedback({
      kind: feedbackKind,
      name: feedbackNameInput.value,
      message: feedbackMessageInput.value,
    });
    if (!result.ok) {
      feedbackStatus.textContent = result.error;
      return;
    }
    feedbackStatus.textContent = "Saved — thanks for the note!";
    feedbackMessageInput.value = "";
    void refreshFeedbackBoard();
  } finally {
    submitBtn.disabled = false;
  }
});

const muteBtn = document.querySelector<HTMLButtonElement>("#mute-btn")!;
function syncMuteLabel() {
  muteBtn.textContent = isMuted() ? "Sound: Off" : "Sound: On";
}
syncMuteLabel();
muteBtn.addEventListener("click", () => {
  unlockAudio();
  const next = !isMuted();
  setMuted(next);
  syncMuteLabel();
  if (!next) playUnmuteChirp();
});

document.querySelector("#play-scores-btn")!.addEventListener("click", () => {
  openScoresMenu();
});
document.querySelector("#scores-close")!.addEventListener("click", () => {
  unlockAudio();
  closeScoresMenu();
});
scoresOverlay.addEventListener("click", (e) => {
  if (e.target === scoresOverlay) closeScoresMenu();
});
document.querySelector("#play-save-score-btn")!.addEventListener("click", () => {
  savePlayScoreFromPanel();
});
playScoreNameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    savePlayScoreFromPanel();
  }
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

// Event delegation — survives bag DOM rebuilds so the first tap always equips
bag.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(".inv-item");
  if (!btn || !bag.contains(btn)) return;
  const i = Number(btn.dataset.i);
  if (!Number.isFinite(i)) return;
  unlockAudio();
  game.equipFromBag(i);
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
document.querySelector("#pause-action")!.addEventListener("click", onPauseClick);

document.querySelector("#home-random-course")!.addEventListener("click", () => {
  unlockAudio();
  game.randomizeCourse();
  refreshCourses();
});

document.querySelector("#upgrade")!.addEventListener("click", () => game.upgradeSelected());
document.querySelector("#sell")!.addEventListener("click", () => game.sellSelected());
document.querySelector("#build-dam")!.addEventListener("click", () => {
  unlockAudio();
  game.buildBeaverDam();
});
document.querySelector("#eagle-land")!.addEventListener("click", () => {
  unlockAudio();
  game.activateEagleLand();
});
document.querySelector("#clear-board")!.addEventListener("click", () => {
  openConfirm({
    title: "Clear board?",
    message: "Move all board friends back to the bag?",
    confirmLabel: "Clear board",
    onConfirm: () => game.clearBoard(),
  });
});
document.querySelector("#clear-bag")!.addEventListener("click", () => {
  unlockAudio();
  if (!game.bag.length) {
    game.clearBag();
    return;
  }
  openConfirm({
    title: "Clear unused?",
    message: `Delete all ${game.bag.length} unused friend${game.bag.length === 1 ? "" : "s"} still in the bag? Friends on the board are kept. This cannot be undone.`,
    confirmLabel: "Clear unused",
    onConfirm: () => game.clearBag(),
  });
});
document.querySelector("#clear-others")!.addEventListener("click", () => {
  unlockAudio();
  if (!game.selectedSlot || !game.slotById(game.selectedSlot)?.friend) {
    game.clearUnselected();
    return;
  }
  openConfirm({
    title: "Clear others?",
    message: "Move all other board friends back to the bag? (keeps the selected one)",
    confirmLabel: "Clear others",
    onConfirm: () => game.clearUnselected(),
  });
});
document.querySelector("#delete-unit")!.addEventListener("click", () => {
  openConfirm({
    title: "Delete friend?",
    message: "Delete this friend forever? This cannot be undone.",
    confirmLabel: "Delete",
    onConfirm: () => game.deleteSelected(),
  });
});
document.querySelector("#crumb")!.addEventListener("click", () => game.cast("crumb"));
document.querySelector("#frost")!.addEventListener("click", () => game.cast("frost"));
document.querySelector("#zap")!.addEventListener("click", () => game.cast("zap"));
document.querySelector("#new-game")!.addEventListener("click", () => {
  openConfirm({
    title: "New game?",
    message: "Start over from wave 1? Your current run will be reset.",
    confirmLabel: "Start over",
    onConfirm: () => {
      game.reset();
    },
  });
});

confirmYesBtn.addEventListener("click", () => closeConfirm(true));
confirmNoBtn.addEventListener("click", () => closeConfirm(false));
confirmOverlay.addEventListener("click", (e) => {
  if (e.target === confirmOverlay) closeConfirm(false);
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!confirmOverlay.classList.contains("hidden")) {
    e.preventDefault();
    closeConfirm(false);
    return;
  }
  if (!scoresOverlay.classList.contains("hidden")) {
    e.preventDefault();
    closeScoresMenu();
    return;
  }
  if (!feedbackOverlay.classList.contains("hidden")) {
    e.preventDefault();
    closeFeedbackMenu();
  }
});

game.running = false;

function refreshToastOnly() {
  toast.textContent = game.toastText;
  toast.classList.toggle("show", game.toastTimer > 0);
}

let last = performance.now();
let lastAutoWaveCeil = -1;
function loop(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.update(dt);
  // Never full-refresh every frame for toasts — that rebuilt UI during the summon
  // toast window and ate the first bag tap. Toast visibility is updated lightly.
  if (game.toastTimer > 0 || toast.classList.contains("show")) refreshToastOnly();
  if (game.gameOver || game.paused) {
    refresh();
  } else if (game.autoWaveTimer > 0) {
    const ceil = Math.ceil(game.autoWaveTimer);
    if (ceil !== lastAutoWaveCeil) {
      lastAutoWaveCeil = ceil;
      refresh();
    }
  } else {
    lastAutoWaveCeil = -1;
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

setInterval(() => {
  if (game.running) game.save();
}, 15000);
