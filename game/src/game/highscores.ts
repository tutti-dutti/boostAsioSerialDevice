import { difficultyTuning, isDifficulty, type Difficulty } from "./difficulty";

const HS_KEY = "cookie-guard-highscores-v2";
const HS_KEY_LEGACY = "cookie-guard-highscores-v1";
const NAME_KEY = "cookie-guard-player-name";
/** Top scores kept per play level (Easy / Medium / Hard) */
export const MAX_SCORES_PER_MODE = 8;

/** Snapshot of what made a run great — used for ranking and display */
export interface ScoreStats {
  wave: number;
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
 * Composite achievement score — rewards lasting further, richer economy,
 * stronger armies, and keeping the cookie healthy. Difficulty multiplies the total.
 *
 * Rough feel (Easy):
 *  Wave 10, 80🪙, 20⭐, 4 friends, full cookie ≈ mid thousands
 *  Wave 30 hard push with mythics ≈ tens of thousands
 */
export function computeAchievementScore(s: ScoreStats): number {
  const wave = Math.max(0, s.wave | 0);
  const gold = Math.max(0, s.gold | 0);
  const stars = Math.max(0, s.stars | 0);
  const friends = Math.max(0, s.friends | 0);
  const levels = Math.max(0, s.friendLevels | 0);
  const mythics = Math.max(0, s.mythics | 0);
  const tier = Math.max(0, s.mapTier | 0);
  const defense = Math.max(0, s.defense);
  const cookieMax = Math.max(1, s.cookieMax | 0);
  const cookieHp = Math.max(0, Math.min(cookieMax, s.cookieHp | 0));
  const cookiePct = cookieHp / cookieMax;

  // Wave progress dominates — each cleared wave is the core achievement
  const wavePts = wave * 520;
  // Economy: gold spent+held and stars banked both matter
  const economyPts = gold * 2 + stars * 28;
  // Army: bodies, upgrades, and mythical presence
  const armyPts = friends * 90 + levels * 55 + mythics * 220 + Math.round(defense * 6);
  // Cookie care: surviving with health left is skill, not just greed
  const cookiePts = Math.round(cookiePct * cookiePct * 480 + cookieHp * 3);
  // Deeper map courses
  const tierPts = tier * 650;

  const raw = wavePts + economyPts + armyPts + cookiePts + tierPts;
  const weight = difficultyTuning(s.difficulty).scoreWeight;
  return Math.max(0, Math.round(raw * weight));
}

/** Rank key — prefer stored points; fall back for legacy rows */
export function scoreValue(s: Pick<HighScore, "points" | "wave" | "gold" | "difficulty" | "stars">): number {
  if (typeof s.points === "number" && Number.isFinite(s.points)) return s.points;
  return computeAchievementScore({
    wave: s.wave,
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

function migrateLegacyIfNeeded(): HighScore[] {
  try {
    if (localStorage.getItem(HS_KEY)) return [];
    const raw = localStorage.getItem(HS_KEY_LEGACY);
    if (!raw) return [];
    const list = JSON.parse(raw) as HighScore[];
    if (!Array.isArray(list)) return [];
    return normalize(list);
  } catch {
    return [];
  }
}

function loadAllHighScores(): HighScore[] {
  try {
    const raw = localStorage.getItem(HS_KEY);
    if (!raw) {
      const legacy = migrateLegacyIfNeeded();
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
  const bits = [`W${s.wave}`];
  if (s.stars != null) bits.push(`${s.stars}⭐`);
  bits.push(`${s.gold}🪙`);
  if (s.friends != null) bits.push(`${s.friends}🐾`);
  if (s.cookieMax && s.cookieMax > 0 && s.cookieHp != null) {
    bits.push(`${s.cookieHp}/${s.cookieMax}🍪`);
  }
  return bits.join(" · ");
}
