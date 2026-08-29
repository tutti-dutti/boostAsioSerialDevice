export type Rarity = "common" | "rare" | "epic" | "mythic";

export interface FriendDef {
  id: string;
  name: string;
  emoji: string;
  rarity: Rarity;
  color: string;
  damage: number;
  range: number;
  attackSpeed: number;
}

export interface ThiefDef {
  id: string;
  name: string;
  emoji: string;
  hp: number;
  speed: number;
  gold: number;
  size: number;
  boss?: boolean;
}

export const FRIENDS: FriendDef[] = [
  { id: "cat", name: "Kitty", emoji: "🐱", rarity: "common", color: "#f0b070", damage: 7, range: 95, attackSpeed: 1.2 },
  { id: "dog", name: "Puppy", emoji: "🐶", rarity: "common", color: "#d0a070", damage: 9, range: 90, attackSpeed: 1.0 },
  { id: "frog", name: "Froggy", emoji: "🐸", rarity: "common", color: "#6ecf7a", damage: 8, range: 100, attackSpeed: 1.1 },
  { id: "owl", name: "Owl", emoji: "🦉", rarity: "rare", color: "#8a7050", damage: 15, range: 130, attackSpeed: 1.4 },
  { id: "fox", name: "Fox", emoji: "🦊", rarity: "rare", color: "#e87840", damage: 20, range: 105, attackSpeed: 1.15 },
  { id: "bee", name: "Buzz", emoji: "🐝", rarity: "rare", color: "#ffd24a", damage: 12, range: 120, attackSpeed: 1.8 },
  { id: "panda", name: "Panda", emoji: "🐼", rarity: "epic", color: "#f0f0f0", damage: 35, range: 110, attackSpeed: 0.85 },
  { id: "unicorn", name: "Unicorn", emoji: "🦄", rarity: "epic", color: "#ff9ad4", damage: 30, range: 150, attackSpeed: 1.3 },
  { id: "dragon", name: "Baby Dragon", emoji: "🐉", rarity: "mythic", color: "#7ecf9a", damage: 60, range: 170, attackSpeed: 1.15 },
];

export const THIEVES: ThiefDef[] = [
  { id: "mouse", name: "Hungry Mouse", emoji: "🐭", hp: 26, speed: 44, gold: 1, size: 16 },
  { id: "raccoon", name: "Raccoon", emoji: "🦝", hp: 50, speed: 38, gold: 2, size: 18 },
  { id: "squirrel", name: "Squirrel", emoji: "🐿️", hp: 38, speed: 54, gold: 2, size: 16 },
  { id: "pig", name: "Snack Pig", emoji: "🐷", hp: 75, speed: 32, gold: 3, size: 20 },
  { id: "bear", name: "Cookie Bear", emoji: "🐻", hp: 120, speed: 28, gold: 5, size: 22 },
  { id: "boss", name: "King Raccoon", emoji: "👑", hp: 300, speed: 24, gold: 18, size: 28, boss: true },
];

const RARITY_CHANCE: Record<Rarity, number> = {
  common: 60,
  rare: 27,
  epic: 10,
  mythic: 3,
};

export const SUMMON_COST = 1;

export function pickFriend(lucky = false): FriendDef {
  const chance = lucky
    ? { common: 35, rare: 35, epic: 22, mythic: 8 }
    : RARITY_CHANCE;
  const roll = Math.random() * 100;
  let total = 0;
  let rarity: Rarity = "common";
  for (const key of Object.keys(chance) as Rarity[]) {
    total += chance[key];
    if (roll <= total) {
      rarity = key;
      break;
    }
  }
  const pool = FRIENDS.filter((f) => f.rarity === rarity);
  return pool[Math.floor(Math.random() * pool.length)];
}

export function thiefForWave(wave: number): ThiefDef {
  if (wave > 0 && wave % 10 === 0) return THIEVES[5];
  if (wave >= 20) return THIEVES[1 + Math.floor(Math.random() * 4)];
  if (wave >= 12) return THIEVES[Math.floor(Math.random() * 4)];
  if (wave >= 6) return THIEVES[Math.floor(Math.random() * 3)];
  if (wave >= 3) return THIEVES[Math.floor(Math.random() * 2)];
  return THIEVES[0];
}

export function waveCount(wave: number): number {
  return Math.min(10, 2 + Math.floor(wave / 2));
}

export function waveHpScale(wave: number): number {
  // Gentler scaling so early waves stay fun for kids
  return 1 + (wave - 1) * 0.1 + Math.floor(wave / 10) * 0.25;
}
