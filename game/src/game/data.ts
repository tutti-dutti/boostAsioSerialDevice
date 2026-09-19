export type Rarity = "common" | "rare" | "legendary" | "god";

export type AbilityId = "none" | "floppyFin" | "foxWall" | "godBeam";

export interface FriendDef {
  id: string;
  name: string;
  emoji: string;
  rarity: Rarity;
  color: string;
  damage: number;
  range: number;
  attackSpeed: number;
  ability: AbilityId;
  /** Fish can evolve; shark can become megalodon */
  canEvolve?: boolean;
  /** Flying animals: sniper range + ultra-fast low-damage shots */
  flies?: boolean;
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

/** Basic forest animals + hummingbird */
export const FRIENDS: FriendDef[] = [
  // —— Basic (common) ——
  { id: "hummingbird", name: "Hummingbird", emoji: "🐦", rarity: "common", color: "#7ecf9a", damage: 2, range: 320, attackSpeed: 48, ability: "none", flies: true },
  { id: "bunny", name: "Bunny", emoji: "🐰", rarity: "common", color: "#f0e0d0", damage: 6, range: 90, attackSpeed: 1.2, ability: "none" },
  { id: "squirrel", name: "Squirrel", emoji: "🐿️", rarity: "common", color: "#c48848", damage: 7, range: 88, attackSpeed: 1.3, ability: "none" },
  { id: "hedgehog", name: "Hedgehog", emoji: "🦔", rarity: "common", color: "#a08060", damage: 8, range: 80, attackSpeed: 0.95, ability: "none" },
  { id: "chipmunk", name: "Chipmunk", emoji: "🐹", rarity: "common", color: "#d0a060", damage: 6, range: 92, attackSpeed: 1.4, ability: "none" },
  { id: "mouse", name: "Forest Mouse", emoji: "🐭", rarity: "common", color: "#c0b0a0", damage: 5, range: 86, attackSpeed: 1.5, ability: "none" },

  // —— Tier two (rare) ——
  { id: "owl", name: "Owl", emoji: "🦉", rarity: "rare", color: "#8a7050", damage: 3, range: 340, attackSpeed: 48, ability: "none", flies: true },
  { id: "deer", name: "Deer", emoji: "🦌", rarity: "rare", color: "#c89858", damage: 16, range: 110, attackSpeed: 1.05, ability: "none" },
  { id: "beaver", name: "Beaver", emoji: "🦫", rarity: "rare", color: "#8a6040", damage: 18, range: 100, attackSpeed: 0.9, ability: "none" },
  { id: "wolf", name: "Wolf", emoji: "🐺", rarity: "rare", color: "#808898", damage: 20, range: 115, attackSpeed: 1.2, ability: "none" },
  { id: "fox", name: "Fox", emoji: "🦊", rarity: "rare", color: "#e87840", damage: 15, range: 105, attackSpeed: 1.15, ability: "foxWall" },
  { id: "fish", name: "Fish", emoji: "🐟", rarity: "rare", color: "#5eb8e0", damage: 12, range: 100, attackSpeed: 1.25, ability: "floppyFin", canEvolve: true },

  // —— Legendary (ground miniguns: 50 dmg; eagle flies so sniper instead) ——
  { id: "otter", name: "Otter", emoji: "🦦", rarity: "legendary", color: "#b08050", damage: 50, range: 125, attackSpeed: 16, ability: "none" },
  { id: "brownbear", name: "Brown Bear", emoji: "🐻", rarity: "legendary", color: "#8a5030", damage: 50, range: 115, attackSpeed: 16, ability: "none" },
  { id: "polarbear", name: "Polar Bear", emoji: "🐻‍❄️", rarity: "legendary", color: "#e8f0f8", damage: 50, range: 120, attackSpeed: 16, ability: "none" },
  { id: "eagle", name: "Bald Eagle", emoji: "🦅", rarity: "legendary", color: "#d0a040", damage: 3, range: 380, attackSpeed: 48, ability: "none", flies: true },
  { id: "shark", name: "Shark", emoji: "🦈", rarity: "legendary", color: "#6080a0", damage: 50, range: 135, attackSpeed: 16, ability: "floppyFin", canEvolve: true },

  // —— GOD tier ——
  { id: "redpanda", name: "Red Panda", emoji: "🐼", rarity: "god", color: "#e05030", damage: 95, range: 180, attackSpeed: 1.5, ability: "godBeam" },
  { id: "megalodon", name: "Megalodon", emoji: "🐋", rarity: "god", color: "#204060", damage: 110, range: 190, attackSpeed: 1.0, ability: "floppyFin" },
];

export const THIEVES: ThiefDef[] = [
  { id: "crumb", name: "Crumb Bug", emoji: "🐛", hp: 26, speed: 44, gold: 1, size: 14 },
  { id: "raccoon", name: "Raccoon", emoji: "🦝", hp: 50, speed: 38, gold: 2, size: 16 },
  { id: "skunk", name: "Skunk", emoji: "🦨", hp: 42, speed: 48, gold: 2, size: 15 },
  { id: "pig", name: "Snack Pig", emoji: "🐷", hp: 75, speed: 32, gold: 3, size: 18 },
  { id: "boar", name: "Cookie Boar", emoji: "🐗", hp: 120, speed: 28, gold: 5, size: 20 },
  { id: "boss", name: "King Raccoon", emoji: "👑", hp: 300, speed: 24, gold: 18, size: 26, boss: true },
];

/** Normal summon: mostly common/rare, tiny legendary, special 0.5% red panda */
export function pickFriend(lucky = false): FriendDef {
  const roll = Math.random() * 100;

  // GOD red panda: 0.5% normal, a bit higher on lucky
  const pandaChance = lucky ? 1.5 : 0.5;
  if (roll < pandaChance) {
    return FRIENDS.find((f) => f.id === "redpanda")!;
  }

  // Never summon shark/megalodon from portal — evolve only
  const summonable = FRIENDS.filter((f) => f.id !== "shark" && f.id !== "megalodon" && f.id !== "redpanda");

  if (lucky) {
    // better odds
    const r = Math.random() * 100;
    let rarity: Rarity = "common";
    if (r < 40) rarity = "common";
    else if (r < 75) rarity = "rare";
    else rarity = "legendary";
    const pool = summonable.filter((f) => f.rarity === rarity);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  const r = Math.random() * 100;
  let rarity: Rarity = "common";
  if (r < 62) rarity = "common";
  else if (r < 90) rarity = "rare";
  else rarity = "legendary"; // ~10% legendary

  const pool = summonable.filter((f) => f.rarity === rarity);
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Fish → Shark 0.5%, Fish → Megalodon 0.1%
 * Shark → Megalodon 0.1%
 */
export function tryEvolve(current: FriendDef): FriendDef | null {
  const roll = Math.random() * 100;
  if (current.id === "fish") {
    if (roll < 0.1) return FRIENDS.find((f) => f.id === "megalodon")!;
    if (roll < 0.1 + 0.5) return FRIENDS.find((f) => f.id === "shark")!;
    return null;
  }
  if (current.id === "shark") {
    if (roll < 0.1) return FRIENDS.find((f) => f.id === "megalodon")!;
    return null;
  }
  return null;
}

export const SUMMON_COST = 1;

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
  return 1 + (wave - 1) * 0.1 + Math.floor(wave / 10) * 0.25;
}

export function rarityLabel(r: Rarity): string {
  if (r === "god") return "GOD";
  if (r === "legendary") return "LEGENDARY";
  if (r === "rare") return "TIER 2";
  return "BASIC";
}
