const DIFF_KEY = "cookie-guard-difficulty-v1";

export type Difficulty = "easy" | "hard";

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
  startGold: number;
  startStars: number;
  cookieHp: number;
  /** High-score weight so Hard ranks above the same wave on Easy */
  scoreWeight: number;
}

export const DIFFICULTIES: Record<Difficulty, DifficultyTuning> = {
  easy: {
    id: "easy",
    label: "Easy",
    blurb: "Softer thieves — great for learning",
    hp: 0.72,
    speed: 0.9,
    count: 0.8,
    gold: 1.15,
    startGold: 28,
    startStars: 7,
    cookieHp: 70,
    scoreWeight: 1,
  },
  hard: {
    id: "hard",
    label: "Hard",
    blurb: "Tougher packs — for a real challenge",
    hp: 1.38,
    speed: 1.12,
    count: 1.22,
    gold: 0.92,
    startGold: 16,
    startStars: 4,
    cookieHp: 45,
    scoreWeight: 1.35,
  },
};

export function isDifficulty(v: unknown): v is Difficulty {
  return v === "easy" || v === "hard";
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
