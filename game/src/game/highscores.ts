import { difficultyTuning, isDifficulty, type Difficulty } from "./difficulty";

const HS_KEY = "cookie-guard-highscores-v3";
const HS_KEY_V2 = "cookie-guard-highscores-v2";
const HS_KEY_LEGACY = "cookie-guard-highscores-v1";
const WEEK_KEY = "cookie-guard-hs-week-id";
const NAME_KEY = "cookie-guard-player-name";
/** Top scores kept per play level (Easy / Medium / Hard) */
export const MAX_SCORES_PER_MODE = 8;

/** Points awarded when an enemy dies (before difficulty weight) */
export const SCORE_PER_KILL = 100;
/** Extra points for boss kills (before difficulty weight) */
export const SCORE_PER_BOSS_KILL = 300;
/** Points awarded when a wave is fully cleared (before difficulty weight) */
export const SCORE_PER_WAVE_CLEAR = 520;

/** Snapshot of what made a run great — used for ranking and display */
export interface ScoreStats {
  wave: number;
  /** Enemies killed this run */
  kills: number;
  /** Waves fully cleared (board empty) — not early spawns */
  wavesCleared: number;
  gold: number;
  stars: number;
  /** Friends on the board */
  friends: number;
  /** Sum of friend levels on the board */
  friendLevels: number;
  /** Mythical + god friends (board + bag) */
  mythics: number;
  cookieHp: number;
  cookieMax: number;
  /** Map tier (0 = first course set) */
  mapTier: number;
  /** Approximate board DPS */
  defense: number;
  difficulty: Difficulty;
}

export interface HighScore {
  name: string;
  /** Composite achievement points (ranking key) */
  points: number;
  wave: number;
  kills?: number;
  wavesCleared?: number;
  gold: number;
  stars?: number;
  friends?: number;
  friendLevels?: number;
  mythics?: number;
  cookieHp?: number;
  cookieMax?: number;
  mapTier?: number;
  defense?: number;
  at: number;
  /** Missing on legacy scores — treat as easy */
  difficulty?: Difficulty;
}

/**
 * Local calendar week id: Sunday 00:00 → next Sunday.
 * High scores wipe when this id changes.
 */
export function currentScoreWeekId(now = Date.now()): string {
  const d = new Date(now);
  const day = d.getDay(); // 0 = Sunday
  const sunday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
  sunday.setHours(0, 0, 0, 0);
  const y = sunday.getFullYear();
  const m = String(sunday.getMonth() + 1).padStart(2, "0");
  const dd = String(sunday.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/** Next Sunday midnight local — when the board resets */
export function nextWeeklyResetAt(now = Date.now()): Date {
  const d = new Date(now);
  const day = d.getDay();
  const daysUntilNextSunday = day === 0 ? 7 : 7 - day;
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + daysUntilNextSunday);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function formatWeeklyResetHint(now = Date.now()): string {
  try {
    const next = nextWeeklyResetAt(now);
    return `Weekly board · resets ${next.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })}`;
  } catch {
    return "Weekly board · resets Sunday midnight";
  }
}

/**
 * Score from kills + finished waves only.
 * Calling the next wave early does not count — only kills and board clears.
 */
export function computeAchievementScore(s: ScoreStats): number {
  const kills = Math.max(0, s.kills | 0);
  const cleared = Math.max(0, s.wavesCleared | 0);
  const raw = kills * SCORE_PER_KILL + cleared * SCORE_PER_WAVE_CLEAR;
  const weight = difficultyTuning(s.difficulty).scoreWeight;
  return Math.max(0, Math.round(raw * weight));
}

/** Weighted points for a single kill (bosses include the boss bonus) */
export function killScorePoints(boss: boolean, difficulty: Difficulty): number {
  const base = SCORE_PER_KILL + (boss ? SCORE_PER_BOSS_KILL : 0);
  return Math.max(0, Math.round(base * difficultyTuning(difficulty).scoreWeight));
}

/** Weighted points for finishing a wave (board cleared) */
export function waveClearScorePoints(difficulty: Difficulty): number {
  return Math.max(0, Math.round(SCORE_PER_WAVE_CLEAR * difficultyTuning(difficulty).scoreWeight));
}

/** Rank key — prefer stored points; fall back for legacy rows */
export function scoreValue(s: Pick<HighScore, "points" | "wave" | "gold" | "difficulty" | "stars" | "kills" | "wavesCleared">): number {
  if (typeof s.points === "number" && Number.isFinite(s.points)) return s.points;
  return computeAchievementScore({
    wave: s.wave,
    kills: s.kills ?? 0,
    wavesCleared: s.wavesCleared ?? Math.max(0, (s.wave | 0) - 1),
    gold: s.gold,
    stars: s.stars ?? 0,
    friends: 0,
    friendLevels: 0,
    mythics: 0,
    cookieHp: 0,
    cookieMax: 1,
    mapTier: 0,
    defense: 0,
    difficulty: s.difficulty && isDifficulty(s.difficulty) ? s.difficulty : "easy",
  });
}

function normalize(list: HighScore[]): HighScore[] {
  return list
    .filter((e) => e && typeof e.name === "string" && typeof e.wave === "number")
    .map((e) => {
      const difficulty = isDifficulty(e.difficulty) ? e.difficulty : ("easy" as Difficulty);
      const points =
        typeof e.points === "number" && Number.isFinite(e.points)
          ? e.points
          : scoreValue({ ...e, difficulty });
      return { ...e, difficulty, points };
    });
}

/** Wipe the board when a new Sunday week begins */
function ensureCurrentWeek(): void {
  try {
    const id = currentScoreWeekId();
    const stored = localStorage.getItem(WEEK_KEY);
    if (stored != null && stored !== id) {
      localStorage.removeItem(HS_KEY);
      localStorage.removeItem(HS_KEY_V2);
      localStorage.removeItem(HS_KEY_LEGACY);
    }
    localStorage.setItem(WEEK_KEY, id);
  } catch {
    /* ignore storage errors */
  }
}

function migrateOlderKeysIfNeeded(): HighScore[] {
  try {
    if (localStorage.getItem(HS_KEY)) return [];
    for (const key of [HS_KEY_V2, HS_KEY_LEGACY]) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const list = JSON.parse(raw) as HighScore[];
      if (!Array.isArray(list) || !list.length) continue;
      return normalize(list);
    }
    return [];
  } catch {
    return [];
  }
}

function loadAllHighScores(): HighScore[] {
  ensureCurrentWeek();
  try {
    const raw = localStorage.getItem(HS_KEY);
    if (!raw) {
      const legacy = migrateOlderKeysIfNeeded();
      if (legacy.length) {
        saveHighScores(legacy);
        return loadAllHighScores();
      }
      return [];
    }
    const list = JSON.parse(raw) as HighScore[];
    if (!Array.isArray(list)) return [];
    return normalize(list);
  } catch {
    return [];
  }
}

function trimPerMode(list: HighScore[]): HighScore[] {
  const modes: Difficulty[] = ["easy", "medium", "hard"];
  const kept: HighScore[] = [];
  for (const mode of modes) {
    const slice = list
      .filter((s) => (s.difficulty ?? "easy") === mode)
      .sort((a, b) => scoreValue(b) - scoreValue(a) || b.at - a.at)
      .slice(0, MAX_SCORES_PER_MODE);
    kept.push(...slice);
  }
  return kept;
}

function saveHighScores(list: HighScore[]) {
  ensureCurrentWeek();
  localStorage.setItem(HS_KEY, JSON.stringify(trimPerMode(list)));
}

/** Scores for one play level, or all modes when omitted */
export function loadHighScores(difficulty?: Difficulty): HighScore[] {
  const all = loadAllHighScores();
  if (!difficulty) {
    return trimPerMode(all).sort((a, b) => scoreValue(b) - scoreValue(a) || b.at - a.at);
  }
  return all
    .filter((s) => (s.difficulty ?? "easy") === difficulty)
    .sort((a, b) => scoreValue(b) - scoreValue(a) || b.at - a.at)
    .slice(0, MAX_SCORES_PER_MODE);
}

export function getSavedPlayerName(): string {
  return localStorage.getItem(NAME_KEY)?.trim() || "";
}

export function rememberPlayerName(name: string) {
  const clean = name.trim().slice(0, 16);
  if (clean) localStorage.setItem(NAME_KEY, clean);
}

export function formatPoints(n: number): string {
  return Math.round(n).toLocaleString();
}

/** True if this run's points make the top board for that play level */
export function isHighScoreWorthy(points: number, difficulty: Difficulty = "easy"): boolean {
  if (points <= 0) return false;
  const list = loadHighScores(difficulty);
  if (list.length < MAX_SCORES_PER_MODE) return true;
  const worst = list[list.length - 1]!;
  return points > scoreValue(worst);
}

export function submitHighScore(name: string, stats: ScoreStats & { points?: number }): HighScore[] {
  const clean = (name.trim() || "Player").slice(0, 16);
  rememberPlayerName(clean);
  const points = stats.points ?? computeAchievementScore(stats);
  const entry: HighScore = {
    name: clean,
    points,
    wave: stats.wave,
    kills: stats.kills,
    wavesCleared: stats.wavesCleared,
    gold: stats.gold,
    stars: stats.stars,
    friends: stats.friends,
    friendLevels: stats.friendLevels,
    mythics: stats.mythics,
    cookieHp: stats.cookieHp,
    cookieMax: stats.cookieMax,
    mapTier: stats.mapTier,
    defense: Math.round(stats.defense),
    at: Date.now(),
    difficulty: stats.difficulty,
  };
  const list = loadAllHighScores();
  list.push(entry);
  saveHighScores(list);
  return loadHighScores(stats.difficulty);
}

export function formatScoreDate(at: number): string {
  try {
    return new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export function difficultyBadge(d?: Difficulty): string {
  return difficultyTuning(d && isDifficulty(d) ? d : "easy").label;
}

/** Short breakdown line for score lists */
export function scoreBreakdown(s: HighScore): string {
  const bits: string[] = [];
  if (s.kills != null) bits.push(`${s.kills} kills`);
  if (s.wavesCleared != null) bits.push(`${s.wavesCleared} cleared`);
  bits.push(`W${s.wave}`);
  if (s.stars != null) bits.push(`${s.stars}⭐`);
  return bits.join(" · ");
}
