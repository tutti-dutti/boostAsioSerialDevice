const HS_KEY = "cookie-guard-highscores-v1";
const NAME_KEY = "cookie-guard-player-name";
const MAX_SCORES = 10;

export interface HighScore {
  name: string;
  wave: number;
  gold: number;
  at: number;
}

export function scoreValue(s: Pick<HighScore, "wave" | "gold">): number {
  // Wave reached is the main score; leftover gold breaks ties
  return s.wave * 1000 + Math.min(999, Math.max(0, s.gold));
}

export function loadHighScores(): HighScore[] {
  try {
    const raw = localStorage.getItem(HS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as HighScore[];
    if (!Array.isArray(list)) return [];
    return list
      .filter((e) => e && typeof e.name === "string" && typeof e.wave === "number")
      .sort((a, b) => scoreValue(b) - scoreValue(a) || b.at - a.at)
      .slice(0, MAX_SCORES);
  } catch {
    return [];
  }
}

function saveHighScores(list: HighScore[]) {
  localStorage.setItem(HS_KEY, JSON.stringify(list.slice(0, MAX_SCORES)));
}

export function getSavedPlayerName(): string {
  return localStorage.getItem(NAME_KEY)?.trim() || "";
}

export function rememberPlayerName(name: string) {
  const clean = name.trim().slice(0, 16);
  if (clean) localStorage.setItem(NAME_KEY, clean);
}

/** True if this run would make the top board (or board isn't full yet) */
export function isHighScoreWorthy(wave: number, gold: number): boolean {
  const list = loadHighScores();
  if (list.length < MAX_SCORES) return wave >= 1;
  const worst = list[list.length - 1];
  return scoreValue({ wave, gold }) > scoreValue(worst);
}

export function submitHighScore(name: string, wave: number, gold: number): HighScore[] {
  const clean = (name.trim() || "Player").slice(0, 16);
  rememberPlayerName(clean);
  const entry: HighScore = { name: clean, wave, gold, at: Date.now() };
  const list = loadHighScores();
  list.push(entry);
  list.sort((a, b) => scoreValue(b) - scoreValue(a) || b.at - a.at);
  const next = list.slice(0, MAX_SCORES);
  saveHighScores(next);
  return next;
}

export function formatScoreDate(at: number): string {
  try {
    return new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}
