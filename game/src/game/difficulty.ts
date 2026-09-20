const DIFF_KEY = "cookie-guard-difficulty-v1";

export type Difficulty = "easy" | "medium" | "hard";

export interface DifficultyTuning {
  id: Difficulty;
  label: string;
  blurb: string;
  /** Enemy HP multiplier */
  hp: number;
  /** Enemy move-speed multiplier */
  speed: number;
  /** Spawn pack size multiplier */
  count: number;
  /** Gold-from-kills multiplier */
  gold: number;
  /** Wave spawn interval multiplier (<1 = faster spawns) */
  spawnPace: number;
  /** Cookie damage taken when a thief arrives */
  cookieDmg: number;
  startGold: number;
  startStars: number;
  cookieHp: number;
  /** High-score weight so tougher modes rank above easier same-wave runs */
  scoreWeight: number;
}

export const DIFFICULTY_ORDER: Difficulty[] = ["easy", "medium", "hard"];

export const DIFFICULTIES: Record<Difficulty, DifficultyTuning> = {
  easy: {
    id: "easy",
    label: "Easy",
    blurb: "Softer thieves — learn roles & place freely",
    hp: 0.88,
    speed: 0.92,
    count: 0.88,
    gold: 1.15,
    spawnPace: 1.08,
    cookieDmg: 1.05,
    startGold: 30,
    startStars: 7,
    cookieHp: 72,
    scoreWeight: 1,
  },
  medium: {
    id: "medium",
    label: "Medium",
    blurb: "Fair fight — mix fast & heavy friends to win",
    hp: 1.28,
    speed: 1.05,
    count: 1.08,
    gold: 1.0,
    spawnPace: 0.95,
    cookieDmg: 1.22,
    startGold: 22,
    startStars: 5,
    cookieHp: 58,
    scoreWeight: 1.25,
  },
  hard: {
    id: "hard",
    label: "Hard",
    blurb: "Tough packs — still beatable with good counters",
    hp: 1.75,
    speed: 1.2,
    count: 1.32,
    gold: 0.85,
    spawnPace: 0.8,
    cookieDmg: 1.5,
    startGold: 14,
    startStars: 4,
    cookieHp: 42,
    scoreWeight: 1.55,
  },
};

export function isDifficulty(v: unknown): v is Difficulty {
  return v === "easy" || v === "medium" || v === "hard";
}

export function difficultyTuning(d: Difficulty): DifficultyTuning {
  return DIFFICULTIES[d];
}

export function loadDifficultyPreference(): Difficulty {
  try {
    const raw = localStorage.getItem(DIFF_KEY);
    if (isDifficulty(raw)) return raw;
  } catch {
    /* ignore */
  }
  return "easy";
}

export function saveDifficultyPreference(d: Difficulty) {
  try {
    localStorage.setItem(DIFF_KEY, d);
  } catch {
    /* ignore */
  }
}

/** Scale a wave pack size; bosses stay solo */
export function scaleWaveCount(base: number, d: Difficulty): number {
  if (base <= 1) return base;
  const mult = difficultyTuning(d).count;
  return Math.max(1, Math.round(base * mult));
}
