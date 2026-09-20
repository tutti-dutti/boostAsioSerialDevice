import { difficultyTuning, isDifficulty, type Difficulty } from "./difficulty";

const HS_KEY = "cookie-guard-highscores-v1";
const NAME_KEY = "cookie-guard-player-name";
/** Top scores kept per play level (Easy / Medium / Hard) */
export const MAX_SCORES_PER_MODE = 8;

export interface HighScore {
  name: string;
  wave: number;
  gold: number;
  at: number;
  /** Missing on legacy scores — treat as easy */
  difficulty?: Difficulty;
}

/** Rank within a single play level (wave first, gold breaks ties) */
export function scoreValue(s: Pick<HighScore, "wave" | "gold" | "difficulty">): number {
  const weight = difficultyTuning(s.difficulty && isDifficulty(s.difficulty) ? s.difficulty : "easy").scoreWeight;
  return Math.round(s.wave * 1000 * weight) + Math.min(999, Math.max(0, s.gold));
}

function normalize(list: HighScore[]): HighScore[] {
  return list
    .filter((e) => e && typeof e.name === "string" && typeof e.wave === "number")
    .map((e) => ({
      ...e,
      difficulty: isDifficulty(e.difficulty) ? e.difficulty : ("easy" as Difficulty),
    }));
}

function loadAllHighScores(): HighScore[] {
  try {
    const raw = localStorage.getItem(HS_KEY);
    if (!raw) return [];
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

/** True if this run makes the top board for that play level */
export function isHighScoreWorthy(
  wave: number,
  gold: number,
  difficulty: Difficulty = "easy",
): boolean {
  if (wave < 1) return false;
  const list = loadHighScores(difficulty);
  if (list.length < MAX_SCORES_PER_MODE) return true;
  const worst = list[list.length - 1]!;
  return scoreValue({ wave, gold, difficulty }) > scoreValue(worst);
}

export function submitHighScore(
  name: string,
  wave: number,
  gold: number,
  difficulty: Difficulty = "easy",
): HighScore[] {
  const clean = (name.trim() || "Player").slice(0, 16);
  rememberPlayerName(clean);
  const entry: HighScore = { name: clean, wave, gold, at: Date.now(), difficulty };
  const list = loadAllHighScores();
  list.push(entry);
  saveHighScores(list);
  return loadHighScores(difficulty);
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
