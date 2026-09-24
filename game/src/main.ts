import "./style.css";
import { Game } from "./game/Game";
import { rarityLabel, weaponRoleFor, weaponRoleLabel, evolveLineage, SUMMON_COST, LUCKY_SUMMON_COST, type FriendDef } from "./game/data";
import { friendPortraitDataUrl, weaponRoleShort } from "./game/animalArt";
import { unlockAudio, setMuted, isMuted, playUnmuteChirp, setBgmMode } from "./game/sound";
import { getActiveMap, listCourses, COURSE_CHIP_COUNT } from "./game/path";
import { upgradeCost, isBeaverBuilder, BEAVER_DAM_COST, isEagleBomber, EAGLE_LAND_COST, friendDamage, type PlacedFriend } from "./game/types";
import {
  clearAllHighScores,
  clearHighScoresForMode,
  deleteHighScore,
  difficultyBadge,
  formatPoints,
  formatScoreDate,
  formatWeeklyResetHint,
  getSavedPlayerName,
  isHighScoreWorthy,
  loadHighScores,
  scoreBreakdown,
  scoreMapLevel,
  submitHighScore,
  updateHighScore,
  type HighScore,
} from "./game/highscores";
import { DIFFICULTIES, isDifficulty, type Difficulty } from "./game/difficulty";
import { submitFeedback, fetchFeedbackList, kindLabel, type FeedbackKind, type FeedbackEntry } from "./game/feedback";
import {
  fetchStats,
  formatCount,
  formatRatingAvg,
  getMyRating,
  recordPlay,
  recordVisit,
  submitRating,
  type GameStats,
} from "./game/stats";

const app = document.querySelector<HTMLDivElement>("#app")!;

app.innerHTML = `
  <section class="home" id="home">
    <h1 class="home-brand">Cookie Guard <span class="home-by">by <button type="button" class="home-author" id="home-author" aria-label="James Nguyen">James Nguyen</button></span></h1>
    <p class="home-line">Animal friends</p>
    <div class="course-picker" id="home-courses">
      <p class="course-label">Choose a course</p>
      <div class="course-chips" id="home-course-chips"></div>
      <label class="course-more-wrap">
        <span class="visually-hidden">More courses</span>
        <select class="course-more" id="home-course-more" aria-label="More courses"></select>
      </label>
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
    <div class="home-community" id="home-community" aria-live="polite">
      <div class="home-counts">
        <span class="home-count"><strong id="stat-visits">0</strong> visits</span>
        <span class="home-count-sep" aria-hidden="true">·</span>
        <span class="home-count"><strong id="stat-plays">0</strong> plays</span>
      </div>
      <div class="home-rate" id="home-rate">
        <p class="home-rate-label">Rate the game</p>
        <div class="rate-stars" id="rate-stars" role="group" aria-label="Rate Cookie Guard from 1 to 5 stars">
          <button type="button" class="rate-star" data-stars="1" aria-label="1 star">★</button>
          <button type="button" class="rate-star" data-stars="2" aria-label="2 stars">★</button>
          <button type="button" class="rate-star" data-stars="3" aria-label="3 stars">★</button>
          <button type="button" class="rate-star" data-stars="4" aria-label="4 stars">★</button>
          <button type="button" class="rate-star" data-stars="5" aria-label="5 stars">★</button>
        </div>
        <p class="home-rate-avg" id="rate-avg">No ratings yet</p>
        <p class="hint home-rate-status" id="rate-status"></p>
      </div>
    </div>
    <div class="home-scores" id="home-scores">
      <h2 class="scores-title">High Scores</h2>
      <p class="scores-week-hint" id="home-scores-week">${formatWeeklyResetHint()}</p>
      <p class="scores-board-hint">Top 50 this week · all difficulties</p>
      <ol class="scores-list" id="home-scores-list"></ol>
      <p class="scores-empty hidden" id="home-scores-empty">No scores yet this week — kills &amp; cleared waves only!</p>
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
          <button class="big" id="summon" type="button">Summon ${SUMMON_COST}⭐</button>
          <button class="pink" id="lucky" type="button">Lucky ${LUCKY_SUMMON_COST}⭐</button>
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
        <div class="unit-stats hidden" id="unit-stats" aria-live="polite">
          <div class="unit-stat">
            <span class="unit-stat-label">Damage</span>
            <span class="unit-stat-value" id="unit-stat-damage">—</span>
          </div>
          <div class="unit-stat">
            <span class="unit-stat-label">Fire rate</span>
            <span class="unit-stat-value" id="unit-stat-rof">—</span>
          </div>
          <div class="unit-stat">
            <span class="unit-stat-label">DPS</span>
            <span class="unit-stat-value" id="unit-stat-dps">—</span>
          </div>
        </div>
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
      <p class="scores-lead" id="scores-lead">Kills &amp; finished waves only. Board resets Sunday midnight.</p>
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

  <div class="secret-overlay hidden" id="secret-overlay" role="dialog" aria-modal="true" aria-labelledby="secret-title">
    <div class="secret-card">
      <h2 id="secret-title">SECRET MENU</h2>
      <div id="secret-gate">
        <p class="secret-lead">Enter the secret code</p>
        <div class="secret-code-row">
          <input id="secret-code" type="password" maxlength="40" placeholder="Secret code" autocomplete="off" spellcheck="false" />
          <button class="green" id="secret-unlock-btn" type="button">Unlock</button>
        </div>
        <p class="hint" id="secret-gate-status"></p>
      </div>
      <div id="secret-admin" class="hidden">
        <p class="secret-lead">High score admin — edit or erase entries</p>
        <div class="mode-chips secret-mode-chips" id="secret-mode-chips" role="group" aria-label="Admin score play level">
          <button class="mode-chip mode-easy selected" data-secret-mode="easy" type="button">Easy</button>
          <button class="mode-chip mode-medium" data-secret-mode="medium" type="button">Medium</button>
          <button class="mode-chip mode-hard" data-secret-mode="hard" type="button">Hard</button>
        </div>
        <div class="secret-admin-list" id="secret-admin-list"></div>
        <p class="scores-empty hidden" id="secret-admin-empty">No scores for this level.</p>
        <div class="secret-admin-actions">
          <button class="danger" id="secret-clear-mode" type="button">Erase this level</button>
          <button class="danger" id="secret-clear-all" type="button">Erase all scores</button>
        </div>
        <p class="hint" id="secret-admin-status"></p>
      </div>
      <button type="button" id="secret-close">Close</button>
    </div>
  </div>
`;

const home = document.querySelector<HTMLElement>("#home")!;
const playScreen = document.querySelector<HTMLElement>("#play-screen")!;
const canvas = document.querySelector<HTMLCanvasElement>("#stage")!;
const game = new Game(canvas);
(window as unknown as { __cg: Game }).__cg = game;
(window as unknown as { __getMap: typeof getActiveMap }).__getMap = getActiveMap;

const statusMain = document.querySelector("#status-main")!;
const statusUpgrade = document.querySelector("#status-upgrade")!;
const bag = document.querySelector<HTMLElement>("#bag")!;
const toast = document.querySelector("#toast")!;
const over = document.querySelector("#over")!;
const selectHint = document.querySelector("#select-hint")!;
const unitStatsEl = document.querySelector("#unit-stats")!;
const unitStatDamage = document.querySelector("#unit-stat-damage")!;
const unitStatRof = document.querySelector("#unit-stat-rof")!;
const unitStatDps = document.querySelector("#unit-stat-dps")!;
const evolveLineageEl = document.querySelector("#evolve-lineage")!;
const evolveFromEl = document.querySelector("#evolve-from")!;
const evolveIntoEl = document.querySelector("#evolve-into")!;
const goldUpgradeLine = document.querySelector("#gold-upgrade-line")!;
const upgradeBtn = document.querySelector<HTMLButtonElement>("#upgrade")!;
const homeCourseChips = document.querySelector("#home-course-chips")!;
const homeCourseMore = document.querySelector<HTMLSelectElement>("#home-course-more")!;
const homeModeChips = document.querySelector("#home-mode-chips")!;
const homeModeBlurb = document.querySelector("#home-mode-blurb")!;
const homeScoresList = document.querySelector("#home-scores-list")!;
const homeScoresEmpty = document.querySelector("#home-scores-empty")!;
const statVisitsEl = document.querySelector("#stat-visits")!;
const statPlaysEl = document.querySelector("#stat-plays")!;
const rateStarsEl = document.querySelector("#rate-stars")!;
const rateAvgEl = document.querySelector("#rate-avg")!;
const rateStatusEl = document.querySelector("#rate-status")!;
let myRating = getMyRating();
let ratingBusy = false;
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
const homeAuthorBtn = document.querySelector<HTMLButtonElement>("#home-author")!;
const secretOverlay = document.querySelector("#secret-overlay")!;
const secretGate = document.querySelector("#secret-gate")!;
const secretAdmin = document.querySelector("#secret-admin")!;
const secretCodeInput = document.querySelector<HTMLInputElement>("#secret-code")!;
const secretUnlockBtn = document.querySelector<HTMLButtonElement>("#secret-unlock-btn")!;
const secretGateStatus = document.querySelector("#secret-gate-status")!;
const secretAdminList = document.querySelector("#secret-admin-list")!;
const secretAdminEmpty = document.querySelector("#secret-admin-empty")!;
const secretAdminStatus = document.querySelector("#secret-admin-status")!;
const secretModeChips = document.querySelector("#secret-mode-chips")!;
let scorePromptShown = false;
let scoreSavedThisRun = false;
let secretScoreMode: Difficulty = "easy";
let secretAuthorClicks = 0;
let secretAuthorClickTimer: ReturnType<typeof setTimeout> | null = null;
const SECRET_CODE = "chicken&waffles";
const SECRET_UNLOCK_KEY = "cookie-guard-secret-hs-admin";

function isSecretAdminUnlocked(): boolean {
  try {
    return sessionStorage.getItem(SECRET_UNLOCK_KEY) === "1";
  } catch {
    return false;
  }
}

function setSecretAdminUnlocked(on: boolean) {
  try {
    if (on) sessionStorage.setItem(SECRET_UNLOCK_KEY, "1");
    else sessionStorage.removeItem(SECRET_UNLOCK_KEY);
  } catch {
    /* ignore */
  }
}
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
      <span class="score-wave">${formatPoints(s.points ?? 0)}</span>
      <span class="score-level" title="Map level">L${scoreMapLevel(s)}</span>
      ${
        compact
          ? `<span class="score-meta">${difficultyBadge(s.difficulty)} · ${scoreBreakdown(s)}</span>`
          : `<span class="score-meta">${difficultyBadge(s.difficulty)} · ${scoreBreakdown(s)} · ${formatScoreDate(s.at)}</span>`
      }
    </li>`,
    )
    .join("");
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function refreshHomeScores() {
  const weekHint = document.querySelector("#home-scores-week");
  if (weekHint) weekHint.textContent = formatWeeklyResetHint();
  const scores = loadHighScores();
  renderScoresList(homeScoresList, scores);
  homeScoresEmpty.classList.toggle("hidden", scores.length > 0);
  homeScoresList.classList.toggle("hidden", scores.length === 0);
}

function syncSecretPanel() {
  const unlocked = isSecretAdminUnlocked();
  secretGate.classList.toggle("hidden", unlocked);
  secretAdmin.classList.toggle("hidden", !unlocked);
  if (unlocked) {
    secretGateStatus.textContent = "";
    refreshSecretAdminList();
  }
}

function openSecretMenu() {
  secretAuthorClicks = 0;
  secretCodeInput.value = "";
  secretGateStatus.textContent = "";
  secretAdminStatus.textContent = "";
  secretScoreMode = "easy";
  syncSecretPanel();
  secretOverlay.classList.remove("hidden");
  setTimeout(() => {
    if (isSecretAdminUnlocked()) {
      (document.querySelector("#secret-close") as HTMLButtonElement | null)?.focus();
    } else {
      secretCodeInput.focus();
    }
  }, 40);
}

function closeSecretMenu() {
  secretOverlay.classList.add("hidden");
  secretCodeInput.value = "";
  secretGateStatus.textContent = "";
  secretAdminStatus.textContent = "";
}

function tryUnlockSecret() {
  const code = secretCodeInput.value;
  if (code === SECRET_CODE) {
    setSecretAdminUnlocked(true);
    secretGateStatus.textContent = "";
    secretAdminStatus.textContent = "Unlocked — edit or erase high scores below.";
    syncSecretPanel();
    return;
  }
  secretGateStatus.textContent = "Nope. Wrong code.";
  secretCodeInput.select();
}

function refreshSecretAdminList() {
  secretModeChips.querySelectorAll<HTMLButtonElement>("[data-secret-mode]").forEach((btn) => {
    btn.classList.toggle("selected", btn.dataset.secretMode === secretScoreMode);
  });
  const scores = loadHighScores(secretScoreMode);
  if (!scores.length) {
    secretAdminList.innerHTML = "";
    secretAdminEmpty.classList.remove("hidden");
    return;
  }
  secretAdminEmpty.classList.add("hidden");
  secretAdminList.innerHTML = scores
    .map((s, i) => {
      const id = s.id || "";
      return `
      <div class="secret-score-row" data-score-id="${escapeHtml(id)}">
        <div class="secret-score-head">
          <span class="score-rank">${i + 1}.</span>
          <span class="secret-score-summary">${escapeHtml(s.name)} · ${formatPoints(s.points ?? 0)} · W${s.wave} · ${difficultyLabel(s.difficulty)}</span>
        </div>
        <div class="secret-score-edit">
          <label>Name <input type="text" class="secret-edit-name" maxlength="16" value="${escapeHtml(s.name)}" /></label>
          <label>Points <input type="number" class="secret-edit-points" min="0" step="1" value="${Math.round(s.points ?? 0)}" /></label>
          <label>Wave <input type="number" class="secret-edit-wave" min="1" step="1" value="${s.wave | 0}" /></label>
          <label>Mode
            <select class="secret-edit-diff">
              <option value="easy" ${(s.difficulty ?? "easy") === "easy" ? "selected" : ""}>Easy</option>
              <option value="medium" ${s.difficulty === "medium" ? "selected" : ""}>Medium</option>
              <option value="hard" ${s.difficulty === "hard" ? "selected" : ""}>Hard</option>
            </select>
          </label>
        </div>
        <div class="secret-score-actions">
          <button type="button" class="green secret-save-btn" data-id="${escapeHtml(id)}">Save</button>
          <button type="button" class="danger secret-erase-btn" data-id="${escapeHtml(id)}">Erase</button>
        </div>
      </div>`;
    })
    .join("");
}

function difficultyLabel(d?: Difficulty): string {
  if (d === "medium") return "Medium";
  if (d === "hard") return "Hard";
  return "Easy";
}

homeAuthorBtn.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  unlockAudio();
  secretAuthorClicks += 1;
  if (secretAuthorClickTimer) clearTimeout(secretAuthorClickTimer);
  secretAuthorClickTimer = setTimeout(() => {
    secretAuthorClicks = 0;
  }, 8000);
  if (secretAuthorClicks >= 5) {
    if (secretAuthorClickTimer) clearTimeout(secretAuthorClickTimer);
    secretAuthorClicks = 0;
    openSecretMenu();
  }
});

secretUnlockBtn.addEventListener("click", () => {
  unlockAudio();
  tryUnlockSecret();
});

secretCodeInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    tryUnlockSecret();
  }
});

document.querySelector("#secret-close")!.addEventListener("click", () => {
  unlockAudio();
  closeSecretMenu();
});

secretModeChips.querySelectorAll<HTMLButtonElement>("[data-secret-mode]").forEach((btn) => {
  btn.addEventListener("click", () => {
    unlockAudio();
    const mode = btn.dataset.secretMode;
    if (isDifficulty(mode)) {
      secretScoreMode = mode;
      refreshSecretAdminList();
    }
  });
});

secretAdminList.addEventListener("click", (e) => {
  const t = e.target as HTMLElement;
  const saveBtn = t.closest<HTMLButtonElement>(".secret-save-btn");
  const eraseBtn = t.closest<HTMLButtonElement>(".secret-erase-btn");
  if (saveBtn) {
    unlockAudio();
    const id = saveBtn.dataset.id || "";
    const row = saveBtn.closest(".secret-score-row");
    if (!row || !id) return;
    const name = (row.querySelector(".secret-edit-name") as HTMLInputElement).value;
    const points = Number((row.querySelector(".secret-edit-points") as HTMLInputElement).value);
    const wave = Number((row.querySelector(".secret-edit-wave") as HTMLInputElement).value);
    const difficulty = (row.querySelector(".secret-edit-diff") as HTMLSelectElement).value;
    const updated = updateHighScore(id, {
      name,
      points,
      wave,
      difficulty: isDifficulty(difficulty) ? difficulty : undefined,
    });
    if (!updated) {
      secretAdminStatus.textContent = "Could not save that entry.";
      return;
    }
    secretAdminStatus.textContent = `Saved ${updated.name} · ${formatPoints(updated.points)}.`;
    if (isDifficulty(updated.difficulty)) secretScoreMode = updated.difficulty;
    refreshSecretAdminList();
    refreshHomeScores();
    return;
  }
  if (eraseBtn) {
    unlockAudio();
    const id = eraseBtn.dataset.id || "";
    if (!id) return;
    deleteHighScore(id);
    secretAdminStatus.textContent = "Erased.";
    refreshSecretAdminList();
    refreshHomeScores();
  }
});

document.querySelector("#secret-clear-mode")!.addEventListener("click", () => {
  unlockAudio();
  openConfirm({
    title: "Erase this level?",
    message: `Delete all ${DIFFICULTIES[secretScoreMode].label} high scores for this week?`,
    confirmLabel: "Erase level",
    onConfirm: () => {
      clearHighScoresForMode(secretScoreMode);
      secretAdminStatus.textContent = `${DIFFICULTIES[secretScoreMode].label} board cleared.`;
      refreshSecretAdminList();
      refreshHomeScores();
    },
  });
});

document.querySelector("#secret-clear-all")!.addEventListener("click", () => {
  unlockAudio();
  openConfirm({
    title: "Erase all scores?",
    message: "Delete every high score for this week (all difficulties)?",
    confirmLabel: "Erase all",
    onConfirm: () => {
      clearAllHighScores();
      secretAdminStatus.textContent = "All high scores erased.";
      refreshSecretAdminList();
      refreshHomeScores();
    },
  });
});

function setupGameOverScoreUi() {
  const best = game.bestScoreStats();
  const points = game.peakScore || game.currentScore();
  overScoreLine.textContent = `Best score ${formatPoints(points)} — ${best.kills} kills · ${best.wavesCleared} waves cleared · Wave ${best.wave} · L${scoreMapLevel({ wave: best.wave, mapTier: best.mapTier })}`;
  const scores = loadHighScores();
  renderScoresList(overScoresList, scores, true);

  const worthy = !scoreSavedThisRun && isHighScoreWorthy(points);
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
  const stats = game.bestScoreStats();
  const list = submitHighScore(name, { ...stats, points: game.peakScore || game.currentScore() });
  scoreSavedThisRun = true;
  scoreSave.classList.add("hidden");
  scoreSaveStatus.textContent = `Saved ${formatPoints(game.peakScore)} — nice ${game.difficultyLabel} run, ${name}!`;
  renderScoresList(overScoresList, list, true);
  refreshHomeScores();
}

function refreshPlayScoresPanel() {
  const best = game.bestScoreStats();
  const points = game.peakScore || game.currentScore();
  scoresLead.textContent = `Top 50 · all difficulties · kills & finished waves only · ${formatWeeklyResetHint()}`;
  scoresRunLine.textContent = `Best this run: ${formatPoints(points)} · ${best.kills} kills · ${best.wavesCleared} cleared · Wave ${best.wave} · L${scoreMapLevel({ wave: best.wave, mapTier: best.mapTier })}`;
  const scores = loadHighScores();
  renderScoresList(playScoresList, scores, true);
  playScoresEmpty.classList.toggle("hidden", scores.length > 0);
  playScoresList.classList.toggle("hidden", scores.length === 0);

  const worthy = isHighScoreWorthy(points);
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
    playScoreSaveStatus.textContent = "Earn points by killing enemies and finishing waves.";
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
    !scoreSavedThisRun && isHighScoreWorthy(game.peakScore || game.currentScore());
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
  const points = game.peakScore || game.currentScore();
  if (!isHighScoreWorthy(points)) {
    playScoreSaveStatus.textContent = "Not high enough for the top 50 yet.";
    refreshPlayScoresPanel();
    return;
  }
  const name = playScoreNameInput.value.trim() || getSavedPlayerName() || "Player";
  const stats = game.bestScoreStats();
  const list = submitHighScore(name, { ...stats, points });
  scoreSavedThisRun = true;
  playScoreSaveStatus.textContent = `Saved ${formatPoints(points)} on ${game.difficultyLabel} — nice work, ${name}!`;
  renderScoresList(playScoresList, list, true);
  playScoresEmpty.classList.add("hidden");
  playScoresList.classList.remove("hidden");
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
      refreshHomeScores();
    }
    refreshModes();
  });
});

function renderCourseChips(container: Element) {
  const courses = listCourses();
  const featured = courses.slice(0, COURSE_CHIP_COUNT);
  const rest = courses.slice(COURSE_CHIP_COUNT);
  container.innerHTML = featured
    .map(
      (c) => `
    <button class="course-chip ${!game.courseRandom && game.courseIndex === c.index ? "selected" : ""}"
      data-course="${c.index}" type="button"
      aria-pressed="${!game.courseRandom && game.courseIndex === c.index ? "true" : "false"}">
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

  const moreSelected = !game.courseRandom && game.courseIndex >= COURSE_CHIP_COUNT;
  homeCourseMore.innerHTML =
    `<option value="" ${moreSelected ? "" : "selected"} disabled>More maps…</option>` +
    rest
      .map(
        (c) =>
          `<option value="${c.index}" ${!game.courseRandom && game.courseIndex === c.index ? "selected" : ""}>${c.name}</option>`,
      )
      .join("");
  homeCourseMore.classList.toggle("selected", moreSelected);
}

function refreshCourses() {
  renderCourseChips(homeCourseChips);
  const homeRandom = document.querySelector("#home-random-course") as HTMLButtonElement;
  homeRandom.classList.toggle("selected", game.courseRandom);
}

homeCourseMore.addEventListener("change", () => {
  unlockAudio();
  const idx = Number(homeCourseMore.value);
  if (!Number.isFinite(idx)) return;
  game.selectCourse(idx, { random: false });
  refreshCourses();
});

function refresh() {
  const courseName = `${getActiveMap().name}${game.courseRandom ? " 🎲" : ""}`;
  statusMain.innerHTML = `
    <div class="status-hero" aria-label="Resources">
      <span class="status-stat status-gold"><span class="status-stat-icon" aria-hidden="true">🪙</span><span class="status-stat-value">${game.gold}</span><span class="status-stat-label">Gold</span></span>
      <span class="status-stat status-level"><span class="status-stat-icon" aria-hidden="true">🗺️</span><span class="status-stat-value">${game.mapLevel}</span><span class="status-stat-label">Level</span></span>
      <span class="status-stat status-stars"><span class="status-stat-icon" aria-hidden="true">⭐</span><span class="status-stat-value">${game.stars}</span><span class="status-stat-label">Stars</span></span>
      <span class="status-stat status-wave"><span class="status-stat-icon" aria-hidden="true">🌊</span><span class="status-stat-value">${game.wave}</span><span class="status-stat-label">Wave</span></span>
    </div>
    <div class="status-secondary">
      <span class="status-chip status-score">🏆 ${formatPoints(game.peakScore || game.currentScore())}</span>
      <span class="status-chip mode-stat mode-stat-${game.difficulty}">${game.difficultyLabel}</span>
      ${
        game.mythicalPressure() > 0
          ? `<span class="status-chip status-pressure">Mythic ×${game.mythicalPressure()}</span>`
          : ""
      }
      <span class="status-chip">🗺️ ${courseName}</span>
      <span class="status-chip">🍪 ${game.cookieHp}/${game.cookieMax}</span>
    </div>
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
      bag.innerHTML = `<span class="empty-inv">Summon friends before Start Wave (${SUMMON_COST}⭐ each)</span>`;
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

  function showUnitCombatStats(friend: PlacedFriend | null, bagDef: FriendDef | null = null) {
    if (friend) {
      const dmg = friendDamage(friend);
      const rof = friend.def.attackSpeed;
      const dps = dmg * rof;
      unitStatDamage.textContent = String(dmg);
      unitStatRof.textContent = `${rof.toFixed(2)}/s`;
      unitStatDps.textContent = dps.toFixed(1);
      unitStatsEl.classList.remove("hidden");
      return;
    }
    if (bagDef) {
      // Preview at level 1 before deploy
      const preview: PlacedFriend = {
        uid: "preview",
        def: bagDef,
        level: 1,
        cooldown: 0,
        slotId: -1,
        abilityTimer: 0,
        orbitAngle: 0,
      };
      const dmg = friendDamage(preview);
      const rof = bagDef.attackSpeed;
      unitStatDamage.textContent = String(dmg);
      unitStatRof.textContent = `${rof.toFixed(2)}/s`;
      unitStatDps.textContent = (dmg * rof).toFixed(1);
      unitStatsEl.classList.remove("hidden");
      return;
    }
    unitStatsEl.classList.add("hidden");
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
      showUnitCombatStats(f);
    } else if (game.selectedBag != null && game.bag[game.selectedBag]) {
      const f = game.bag[game.selectedBag];
      selectHint.textContent = `${f.emoji} ${f.name} equipped — tap grass to deploy`;
      showEvolveLineage(f);
      showUnitCombatStats(null, f);
    } else {
      selectHint.textContent = game.canMoveUnits()
        ? game.paused
          ? "Paused — drag friends to move. Equip from bag to deploy."
          : "Move friends between waves. Equip from bag to deploy."
        : "Wave in progress — Pause to move friends.";
      showEvolveLineage(null);
      showUnitCombatStats(null);
    }
  } else if (game.selectedBag != null && game.bag[game.selectedBag]) {
    const f = game.bag[game.selectedBag];
    selectHint.textContent = `${f.emoji} ${f.name} equipped — tap grass to deploy`;
    showEvolveLineage(f);
    showUnitCombatStats(null, f);
  } else {
    selectHint.textContent = game.canMoveUnits()
      ? game.paused
        ? "Paused — drag friends to reposition."
        : "Upgrade to try a 5% mythical evolve! Move friends between waves."
      : "Wave in progress — Pause to move friends.";
    showEvolveLineage(null);
    showUnitCombatStats(null);
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

  (document.querySelector("#summon") as HTMLButtonElement).disabled = game.stars < SUMMON_COST;
  (document.querySelector("#lucky") as HTMLButtonElement).disabled = game.stars < LUCKY_SUMMON_COST;
  const startBtn = document.querySelector("#start-wave") as HTMLButtonElement;
  startBtn.disabled = !game.canStartWave();
  if (game.isCombatActive()) {
    startBtn.textContent = `Next Wave ${game.nextWaveToStart()}`;
  } else if (game.canStartWave()) {
    startBtn.textContent =
      game.autoWaveTimer > 0
        ? `Start Now (${Math.ceil(game.autoWaveTimer)})`
        : `Start Wave ${game.wave}`;
  } else {
    startBtn.textContent = `Start Wave ${game.wave}`;
  }

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

function applyStats(stats: GameStats) {
  statVisitsEl.textContent = formatCount(stats.visits);
  statPlaysEl.textContent = formatCount(stats.plays);
  rateAvgEl.textContent = formatRatingAvg(stats.ratingAvg, stats.ratingCount);
  paintRateStars();
}

function paintRateStars() {
  rateStarsEl.querySelectorAll<HTMLButtonElement>(".rate-star").forEach((btn) => {
    const n = Number(btn.dataset.stars) || 0;
    const on = myRating > 0 && n <= myRating;
    btn.classList.toggle("filled", on);
    btn.setAttribute("aria-pressed", on && n === myRating ? "true" : "false");
  });
}

rateStarsEl.querySelectorAll<HTMLButtonElement>(".rate-star").forEach((btn) => {
  btn.addEventListener("click", async () => {
    unlockAudio();
    if (ratingBusy) return;
    const stars = Number(btn.dataset.stars) || 0;
    if (stars < 1 || stars > 5) return;
    ratingBusy = true;
    rateStatusEl.textContent = "Saving…";
    paintRateStars();
    // Optimistic highlight while saving
    myRating = stars;
    paintRateStars();
    const result = await submitRating(stars);
    ratingBusy = false;
    if (!result.ok) {
      rateStatusEl.textContent = result.error;
      myRating = getMyRating();
      paintRateStars();
      return;
    }
    myRating = result.stars;
    applyStats(result.stats);
    rateStatusEl.textContent = `Thanks — you rated ${result.stars}★`;
  });
  btn.addEventListener("mouseenter", () => {
    if (ratingBusy) return;
    const hover = Number(btn.dataset.stars) || 0;
    rateStarsEl.querySelectorAll<HTMLButtonElement>(".rate-star").forEach((b) => {
      const n = Number(b.dataset.stars) || 0;
      b.classList.toggle("preview", n <= hover);
    });
  });
});
rateStarsEl.addEventListener("mouseleave", () => {
  rateStarsEl.querySelectorAll(".rate-star").forEach((b) => b.classList.remove("preview"));
});

paintRateStars();
void recordVisit().then(applyStats);
void fetchStats().then(applyStats);

function showHome() {
  game.running = false;
  game.setPaused(false);
  setBgmMode("off");
  closeScoresMenu();
  home.classList.remove("hidden");
  playScreen.classList.add("hidden");
  refreshCourses();
  refreshModes();
  refreshHomeScores();
  void fetchStats().then(applyStats);
}

function showPlay() {
  unlockAudio();
  // Always start fresh from the main menu — don't resume a prior save
  scorePromptShown = false;
  scoreSavedThisRun = false;
  game.reset();
  home.classList.add("hidden");
  playScreen.classList.remove("hidden");
  over.classList.add("hidden");
  game.running = true;
  game.setPaused(false);
  game.paint();
  refresh();
  void recordPlay().then(applyStats);
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
    const result = await fetchFeedbackList(feedbackListFilter, 40);
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
  void recordPlay().then(applyStats);
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
