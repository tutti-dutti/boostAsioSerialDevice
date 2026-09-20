import "./style.css";
import { Game } from "./game/Game";
import { rarityLabel, weaponRoleFor, weaponRoleLabel, evolveLineage, type FriendDef } from "./game/data";
import { unlockAudio, setMuted, isMuted, playUnmuteChirp } from "./game/sound";
import { getActiveMap, listCourses } from "./game/path";
import { upgradeCost, isBeaverBuilder, BEAVER_DAM_COST, isEagleBomber, EAGLE_LAND_COST } from "./game/types";
import {
  difficultyBadge,
  formatScoreDate,
  getSavedPlayerName,
  isHighScoreWorthy,
  loadHighScores,
  submitHighScore,
  type HighScore,
} from "./game/highscores";
import { DIFFICULTIES, isDifficulty, type Difficulty } from "./game/difficulty";
import { submitFeedback, fetchFeedbackList, kindLabel, type FeedbackKind, type FeedbackEntry } from "./game/feedback";
import {
  checkMathAnswer,
  formatMathReward,
  generateMathQuestion,
  gradeBlurb,
  gradeLabel,
  loadMathGrade,
  rewardBlurb,
  saveMathGrade,
  type MathGrade,
  type MathQuestion,
} from "./game/mathChallenge";

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
    <div class="mode-picker" id="home-modes">
      <p class="course-label">Difficulty</p>
      <div class="mode-chips" id="home-mode-chips" role="group" aria-label="Difficulty">
        <button class="mode-chip mode-easy" data-mode="easy" type="button">Easy</button>
        <button class="mode-chip mode-medium" data-mode="medium" type="button">Medium</button>
        <button class="mode-chip mode-hard" data-mode="hard" type="button">Hard</button>
      </div>
      <p class="mode-blurb" id="home-mode-blurb">Softer thieves — learn roles & place freely</p>
    </div>
    <div class="mode-picker" id="home-math">
      <p class="course-label">Math challenge level</p>
      <div class="mode-chips" id="home-math-chips" role="group" aria-label="Math grade">
        <button class="mode-chip math-chip" data-grade="4" type="button">4th</button>
        <button class="mode-chip math-chip" data-grade="5" type="button">5th</button>
        <button class="mode-chip math-chip" data-grade="6" type="button">6th</button>
        <button class="mode-chip math-chip" data-grade="7" type="button">7th</button>
      </div>
      <p class="mode-blurb" id="home-math-blurb">Multiply, divide, area &amp; simple fractions → mostly Basic friends</p>
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
    <div class="status-banner" id="status-banner" aria-live="polite">
      <div class="status-main" id="status-main"></div>
      <div class="status-meta">
        <span class="status-upgrade" id="status-upgrade">Select friend for upgrade cost</span>
        <div class="status-links">
          <button class="home-link" id="mute-btn" type="button">Sound: On</button>
          <button class="home-link" id="play-feedback-btn" type="button">Feedback</button>
          <button class="home-link" id="back-home" type="button">Home</button>
        </div>
      </div>
    </div>

    <div class="action-banner" id="action-banner">
      <button class="new-game-btn" id="new-game" type="button">New game</button>
      <button class="wave-btn" id="start-wave" type="button">Start Wave</button>
      <button class="pause-btn" id="pause-action" type="button">Pause</button>
      <button class="math-btn" id="math-challenge" type="button">Math 📚</button>
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
          <button class="big" id="summon" type="button">Summon 1⭐</button>
          <button class="pink" id="lucky" type="button">Lucky 3⭐</button>
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

  <div class="math-overlay hidden" id="math-overlay" role="dialog" aria-modal="true" aria-labelledby="math-title">
    <div class="math-card">
      <h2 id="math-title">Math challenge</h2>
      <p class="math-meta" id="math-meta">4th grade · Arithmetic</p>
      <p class="math-reward" id="math-reward">Correct → friend, gold, or stars</p>
      <p class="math-prompt" id="math-prompt">What is 2 + 2?</p>
      <label class="math-field">
        <span>Your answer</span>
        <input id="math-answer" type="text" inputmode="decimal" autocomplete="off" placeholder="Type a number" />
      </label>
      <p class="hint" id="math-status"></p>
      <div class="math-actions">
        <button type="button" class="green" id="math-submit">Check answer</button>
        <button type="button" id="math-skip">Skip</button>
        <button type="button" id="math-close">Close</button>
      </div>
      <p class="math-hint-line hint" id="math-hint-line"></p>
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
const overScoreLine = document.querySelector("#over-score-line")!;
const scoreSave = document.querySelector("#score-save")!;
const scoreNameInput = document.querySelector<HTMLInputElement>("#score-name")!;
const scoreSaveStatus = document.querySelector("#score-save-status")!;
const overScoresList = document.querySelector("#over-scores-list")!;
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
const homeMathChips = document.querySelector("#home-math-chips")!;
const homeMathBlurb = document.querySelector("#home-math-blurb")!;
const mathOverlay = document.querySelector("#math-overlay")!;
const mathMeta = document.querySelector("#math-meta")!;
const mathReward = document.querySelector("#math-reward")!;
const mathPrompt = document.querySelector("#math-prompt")!;
const mathAnswerInput = document.querySelector<HTMLInputElement>("#math-answer")!;
const mathStatus = document.querySelector("#math-status")!;
const mathHintLine = document.querySelector("#math-hint-line")!;
const mathChallengeBtn = document.querySelector<HTMLButtonElement>("#math-challenge")!;

let scorePromptShown = false;
let scoreSavedThisRun = false;
let feedbackKind: FeedbackKind = "feedback";
let feedbackListFilter: FeedbackKind | "all" = "all";
let feedbackListLoading = false;
let pausedForFeedback = false;
let pausedForConfirm = false;
let pausedForMath = false;
let mathGrade: MathGrade = loadMathGrade();
let currentMath: MathQuestion | null = null;
let mathCooldownUntil = 0;
const MATH_COOLDOWN_MS = 20_000;
/** Wave number we already rolled an between-wave math offer for */
let mathWaveOfferFor = -1;
/** Active combat time toward a random mid-wave math popup */
let mathPlayAccum = 0;
const MATH_PLAY_INTERVAL = 14;
const MATH_WAVE_CHANCE = 0.48;
const MATH_PLAY_CHANCE = 0.24;
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
      <span class="score-wave">Wave ${s.wave}</span>
      ${
        compact
          ? `<span class="score-mode mode-tag-${s.difficulty ?? "easy"}">${difficultyBadge(s.difficulty)}</span>`
          : `<span class="score-meta"><span class="mode-tag mode-tag-${s.difficulty ?? "easy"}">${difficultyBadge(s.difficulty)}</span> · ${s.gold}🪙 · ${formatScoreDate(s.at)}</span>`
      }
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
  overScoreLine.textContent = `Reached wave ${game.wave} on ${game.difficultyLabel} with ${game.gold}🪙. The thieves ate it!`;
  const scores = loadHighScores();
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
  refreshHomeScores();
}

function refreshModes() {
  homeModeChips.querySelectorAll<HTMLButtonElement>(".mode-chip").forEach((btn) => {
    const mode = btn.dataset.mode as Difficulty;
    btn.classList.toggle("selected", game.difficulty === mode);
  });
  homeModeBlurb.textContent = DIFFICULTIES[game.difficulty].blurb;
}

function refreshMathGrade() {
  homeMathChips.querySelectorAll<HTMLButtonElement>(".math-chip").forEach((btn) => {
    const g = Number(btn.dataset.grade) as MathGrade;
    btn.classList.toggle("selected", mathGrade === g);
  });
  homeMathBlurb.textContent = gradeBlurb(mathGrade);
}

homeModeChips.querySelectorAll<HTMLButtonElement>(".mode-chip").forEach((btn) => {
  btn.addEventListener("click", () => {
    unlockAudio();
    const mode = btn.dataset.mode as Difficulty;
    if (isDifficulty(mode)) game.setDifficulty(mode);
    refreshModes();
  });
});

homeMathChips.querySelectorAll<HTMLButtonElement>(".math-chip").forEach((btn) => {
  btn.addEventListener("click", () => {
    unlockAudio();
    const g = Number(btn.dataset.grade);
    if (g === 4 || g === 5 || g === 6 || g === 7) {
      mathGrade = g;
      saveMathGrade(g);
      refreshMathGrade();
    }
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
        .map(
          (f, i) => `
      <button class="inv-item ${game.selectedBag === i ? "selected" : ""} rarity-${f.rarity}" data-i="${i}" type="button">
        <span class="emoji">${f.emoji}</span>
        <span>${f.name}</span>
        <span class="rarity-${f.rarity}">${rarityLabel(f.rarity)}</span>
      </button>`,
        )
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
      selectHint.textContent = `${f.emoji} ${f.name} equipped — tap grass to deploy, or tap a board friend to move`;
      showEvolveLineage(f);
    } else {
      selectHint.textContent = "Drag friends to move anytime (even mid-wave). Equip from bag to deploy.";
      showEvolveLineage(null);
    }
  } else if (game.selectedBag != null && game.bag[game.selectedBag]) {
    const f = game.bag[game.selectedBag];
    selectHint.textContent = `${f.emoji} ${f.name} equipped — tap grass to deploy, or tap a board friend to move`;
    showEvolveLineage(f);
  } else {
    selectHint.textContent = "Drag friends to move anytime (even mid-wave). Equip from bag to deploy.";
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
  const pauseAction = document.querySelector("#pause-action") as HTMLButtonElement;
  pauseAction.textContent = pauseLabel;
  pauseAction.disabled = game.gameOver;
  pauseAction.classList.toggle("is-paused", game.paused);

  const mathLeft = Math.max(0, mathCooldownUntil - Date.now());
  mathChallengeBtn.disabled = game.gameOver || mathLeft > 0 || !mathOverlay.classList.contains("hidden");
  mathChallengeBtn.textContent =
    mathLeft > 0 ? `Math ${Math.ceil(mathLeft / 1000)}s` : "Math 📚";

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
refreshMathGrade();
refreshHomeScores();

function showHome() {
  game.running = false;
  game.setPaused(false);
  home.classList.remove("hidden");
  playScreen.classList.add("hidden");
  refreshCourses();
  refreshModes();
  refreshMathGrade();
  refreshHomeScores();
}

function showPlay() {
  unlockAudio();
  home.classList.add("hidden");
  playScreen.classList.remove("hidden");
  game.running = true;
  game.setPaused(false);
  mathWaveOfferFor = -1;
  mathPlayAccum = 0;
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

document.querySelector("#retry-btn")!.addEventListener("click", () => {
  unlockAudio();
  scorePromptShown = false;
  scoreSavedThisRun = false;
  mathWaveOfferFor = -1;
  mathPlayAccum = 0;
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
      mathWaveOfferFor = -1;
      mathPlayAccum = 0;
      game.reset();
    },
  });
});

function showMathQuestion(q: MathQuestion) {
  currentMath = q;
  mathMeta.textContent = `${gradeLabel(q.grade)} · ${q.topicLabel}`;
  mathReward.textContent = rewardBlurb(q.grade);
  mathPrompt.textContent = q.prompt;
  mathAnswerInput.value = "";
  mathStatus.textContent = "";
  mathHintLine.textContent = `Hint: ${q.hint}`;
  mathHintLine.classList.add("dim");
}

function mathUiBlocked() {
  return (
    !mathOverlay.classList.contains("hidden") ||
    !confirmOverlay.classList.contains("hidden") ||
    !feedbackOverlay.classList.contains("hidden")
  );
}

/** Open math popup. `auto` = random/system offer (quiet if on cooldown). */
function openMathChallenge(opts: { auto?: boolean } = {}): boolean {
  unlockAudio();
  if (game.gameOver || mathUiBlocked()) return false;
  const left = mathCooldownUntil - Date.now();
  if (left > 0) {
    if (!opts.auto) {
      game.toast(`Math ready in ${Math.ceil(left / 1000)}s`, true);
      refresh();
    }
    return false;
  }
  showMathQuestion(generateMathQuestion(mathGrade));
  pausedForMath = false;
  if (game.running && !game.paused && !game.gameOver) {
    game.setPaused(true);
    pausedForMath = true;
  }
  mathOverlay.classList.remove("hidden");
  if (opts.auto) {
    mathStatus.textContent = "Surprise challenge! Solve it for a reward.";
  }
  setTimeout(() => mathAnswerInput.focus(), 40);
  refresh();
  return true;
}

/** Random math offers: between waves, and sometimes mid-fight */
function maybeAutoMathChallenge(dt: number) {
  if (!game.running || game.gameOver || game.paused || mathUiBlocked()) return;
  if (Date.now() < mathCooldownUntil) return;

  // Before the next wave (auto-wave countdown just started for this wave number)
  if (game.waveWaiting && game.autoWaveTimer > 0 && mathWaveOfferFor !== game.wave) {
    mathWaveOfferFor = game.wave;
    if (Math.random() < MATH_WAVE_CHANCE) {
      openMathChallenge({ auto: true });
      return;
    }
  }

  // Sometime during an active wave
  if (!game.waveWaiting && (game.waveInProgress || game.spawnLeft > 0 || game.thieves.some((t) => t.alive))) {
    mathPlayAccum += dt;
    if (mathPlayAccum >= MATH_PLAY_INTERVAL) {
      mathPlayAccum = 0;
      if (Math.random() < MATH_PLAY_CHANCE) {
        openMathChallenge({ auto: true });
      }
    }
  } else {
    mathPlayAccum = 0;
  }
}

function closeMathChallenge() {
  mathOverlay.classList.add("hidden");
  currentMath = null;
  if (pausedForMath && game.paused && !game.gameOver) {
    game.setPaused(false);
  }
  pausedForMath = false;
  refresh();
}

function submitMathAnswer() {
  unlockAudio();
  if (!currentMath) return;
  const raw = mathAnswerInput.value;
  if (!raw.trim()) {
    mathStatus.textContent = "Type an answer first.";
    return;
  }
  if (checkMathAnswer(currentMath, raw)) {
    const reward = game.grantMathReward(currentMath.grade, currentMath.hardness);
    mathCooldownUntil = Date.now() + MATH_COOLDOWN_MS;
    mathStatus.textContent = `Correct! You earned ${formatMathReward(reward)}.`;
    setTimeout(() => closeMathChallenge(), 900);
  } else {
    mathCooldownUntil = Date.now() + Math.floor(MATH_COOLDOWN_MS * 0.6);
    mathStatus.textContent = `Not quite — answer was ${currentMath.accept[0] ?? currentMath.answer}. Try again soon!`;
    mathHintLine.classList.remove("dim");
    setTimeout(() => closeMathChallenge(), 1400);
  }
}

mathChallengeBtn.addEventListener("click", () => openMathChallenge());
document.querySelector("#math-submit")!.addEventListener("click", submitMathAnswer);
document.querySelector("#math-skip")!.addEventListener("click", () => {
  unlockAudio();
  if (currentMath) showMathQuestion(generateMathQuestion(mathGrade));
  mathAnswerInput.focus();
});
document.querySelector("#math-close")!.addEventListener("click", closeMathChallenge);
mathOverlay.addEventListener("click", (e) => {
  if (e.target === mathOverlay) closeMathChallenge();
});
mathAnswerInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    submitMathAnswer();
  }
});

confirmYesBtn.addEventListener("click", () => closeConfirm(true));
confirmNoBtn.addEventListener("click", () => closeConfirm(false));
confirmOverlay.addEventListener("click", (e) => {
  if (e.target === confirmOverlay) closeConfirm(false);
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!mathOverlay.classList.contains("hidden")) {
    e.preventDefault();
    closeMathChallenge();
    return;
  }
  if (!confirmOverlay.classList.contains("hidden")) {
    e.preventDefault();
    closeConfirm(false);
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
  maybeAutoMathChallenge(dt);
  // Never full-refresh every frame for toasts — that rebuilt UI during the summon
  // toast window and ate the first bag tap. Toast visibility is updated lightly.
  if (game.toastTimer > 0 || toast.classList.contains("show")) refreshToastOnly();
  // Update math cooldown label without a full UI rebuild every frame
  if (mathCooldownUntil > Date.now() && mathOverlay.classList.contains("hidden")) {
    const left = Math.ceil((mathCooldownUntil - Date.now()) / 1000);
    const label = `Math ${left}s`;
    if (mathChallengeBtn.textContent !== label) {
      mathChallengeBtn.textContent = label;
      mathChallengeBtn.disabled = true;
    }
  } else if (
    mathOverlay.classList.contains("hidden") &&
    mathChallengeBtn.textContent !== "Math 📚" &&
    mathCooldownUntil <= Date.now() &&
    !game.gameOver
  ) {
    mathChallengeBtn.textContent = "Math 📚";
    mathChallengeBtn.disabled = false;
  }
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
