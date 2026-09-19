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
    blurb: "Softer thieves — great for learning",
    hp: 0.72,
    speed: 0.9,
    count: 0.8,
    gold: 1.15,
    spawnPace: 1.1,
    cookieDmg: 1,
    startGold: 28,
    startStars: 7,
    cookieHp: 70,
    scoreWeight: 1,
  },
  medium: {
    id: "medium",
    label: "Medium",
    blurb: "Balanced fight — fair packs, fair rewards",
    hp: 1.28,
    speed: 1.08,
    count: 1.12,
    gold: 0.92,
    spawnPace: 0.92,
    cookieDmg: 1.25,
    startGold: 18,
    startStars: 5,
    cookieHp: 50,
    scoreWeight: 1.25,
  },
  hard: {
    id: "hard",
    label: "Hard",
    blurb: "Brutal packs — thick, fast, and hungry",
    hp: 2.05,
    speed: 1.32,
    count: 1.55,
    gold: 0.68,
    spawnPace: 0.72,
    cookieDmg: 1.75,
    startGold: 10,
    startStars: 3,
    cookieHp: 32,
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
