import { WAVES_PER_MAP, getActiveCourseIndex, mapTierForWave } from "./path";

export type Rarity = "common" | "rare" | "legendary" | "mythical" | "god";

export type AbilityId = "none" | "floppyFin" | "foxWall" | "godBeam";

/** How this friend specializes against thief archetypes */
export type WeaponRole = "antiSpeed" | "antiStrength" | "balanced";

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
  /** Counters: antiSpeed slows/chips runners; antiStrength cracks tanks */
  weaponRole?: WeaponRole;
  canEvolve?: boolean;
  /** Target mythical / next form id */
  evolvesTo?: string;
  /** Override global evolve chance (0–1). e.g. 0.01 = 1% */
  evolveChance?: number;
  flies?: boolean;
  /** Evolved forms are summon-blocked */
  evolvedForm?: boolean;
  /** Visual size multiplier (default 1). Mega forms use ~1.8–2.2 */
  scale?: number;
}

export interface ThiefDef {
  id: string;
  name: string;
  emoji: string;
  hp: number;
  speed: number;
  gold: number;
  size: number;
  /** Speed = fragile/fast; strength = tanky/slow */
  kind: "speed" | "strength" | "boss";
  boss?: boolean;
}

/** Base animals + mythical evolutions */
export const FRIENDS: FriendDef[] = [
  // —— Basic ——
  // Birds: fastest fire, still low damage
  { id: "hummingbird", name: "Hummingbird", emoji: "🐦", rarity: "common", color: "#7ecf9a", damage: 2, range: 95, attackSpeed: 2.8, ability: "none", flies: true, canEvolve: true, evolvesTo: "phoenixlet" },
  { id: "bunny", name: "Bunny", emoji: "🐰", rarity: "common", color: "#f0e0d0", damage: 6, range: 90, attackSpeed: 1.2, ability: "none", canEvolve: true, evolvesTo: "moonhare" },
  { id: "squirrel", name: "Squirrel", emoji: "🐿️", rarity: "common", color: "#c48848", damage: 7, range: 88, attackSpeed: 1.3, ability: "none", canEvolve: true, evolvesTo: "stormsquirrel" },
  { id: "hedgehog", name: "Hedgehog", emoji: "🦔", rarity: "common", color: "#a08060", damage: 8, range: 80, attackSpeed: 0.95, ability: "none", canEvolve: true, evolvesTo: "spikeking" },
  { id: "chipmunk", name: "Chipmunk", emoji: "🐹", rarity: "common", color: "#d0a060", damage: 6, range: 92, attackSpeed: 1.4, ability: "none", canEvolve: true, evolvesTo: "jewelmunk" },
  { id: "mouse", name: "Forest Mouse", emoji: "🐭", rarity: "common", color: "#c0b0a0", damage: 5, range: 86, attackSpeed: 1.5, ability: "none", canEvolve: true, evolvesTo: "shadowmouse" },

  // —— Tier two ——
  { id: "owl", name: "Owl", emoji: "🦉", rarity: "rare", color: "#8a7050", damage: 3, range: 110, attackSpeed: 2.4, ability: "none", flies: true, canEvolve: true, evolvesTo: "nightoracle" },
  { id: "deer", name: "Deer", emoji: "🦌", rarity: "rare", color: "#c89858", damage: 16, range: 110, attackSpeed: 1.05, ability: "none", canEvolve: true, evolvesTo: "starcervid" },
  { id: "beaver", name: "Beaver", emoji: "🦫", rarity: "rare", color: "#8a6040", damage: 18, range: 100, attackSpeed: 0.9, ability: "none", canEvolve: true, evolvesTo: "giantpanda" },
  { id: "wolf", name: "Wolf", emoji: "🐺", rarity: "rare", color: "#808898", damage: 20, range: 115, attackSpeed: 1.2, ability: "none", canEvolve: true, evolvesTo: "werewolf", evolveChance: 0.01 },
  { id: "fox", name: "Fox", emoji: "🦊", rarity: "rare", color: "#e87840", damage: 15, range: 105, attackSpeed: 1.15, ability: "foxWall", canEvolve: true, evolvesTo: "kitsune" },
  { id: "fish", name: "Fish", emoji: "🐟", rarity: "rare", color: "#5eb8e0", damage: 12, range: 100, attackSpeed: 1.25, ability: "floppyFin", canEvolve: true, evolvesTo: "tidalkoi" },

  // —— Legendary ——
  { id: "otter", name: "Otter", emoji: "🦦", rarity: "legendary", color: "#b08050", damage: 22, range: 115, attackSpeed: 1.05, ability: "none", canEvolve: true, evolvesTo: "riverspirit" },
  // Bears: slow shots, huge damage
  { id: "brownbear", name: "Brown Bear", emoji: "🐻", rarity: "legendary", color: "#8a5030", damage: 85, range: 110, attackSpeed: 0.4, ability: "none", canEvolve: true, evolvesTo: "ursaking" },
  { id: "polarbear", name: "Polar Bear", emoji: "🐻‍❄️", rarity: "legendary", color: "#e8f0f8", damage: 90, range: 115, attackSpeed: 0.38, ability: "none", canEvolve: true, evolvesTo: "frostursine" },
  { id: "eagle", name: "Bald Eagle", emoji: "🦅", rarity: "legendary", color: "#d0a040", damage: 3, range: 130, attackSpeed: 2.2, ability: "none", flies: true, canEvolve: true, evolvesTo: "thunderroc" },
  { id: "shark", name: "Shark", emoji: "🦈", rarity: "legendary", color: "#6080a0", damage: 28, range: 130, attackSpeed: 1.0, ability: "floppyFin", canEvolve: true, evolvesTo: "megalodon" },

  // —— Mythical evolutions (bigger/stronger, evolve-only) ——
  { id: "phoenixlet", name: "Phoenixlet", emoji: "🔥", rarity: "mythical", color: "#ff7040", damage: 8, range: 150, attackSpeed: 3.2, ability: "none", flies: true, evolvedForm: true },
  { id: "moonhare", name: "Moon Hare", emoji: "🌙", rarity: "mythical", color: "#d0e0ff", damage: 28, range: 130, attackSpeed: 1.5, ability: "none", evolvedForm: true },
  { id: "stormsquirrel", name: "Storm Squirrel", emoji: "⚡", rarity: "mythical", color: "#f0d040", damage: 30, range: 125, attackSpeed: 1.7, ability: "none", evolvedForm: true },
  { id: "spikeking", name: "Spike King", emoji: "🛡️", rarity: "mythical", color: "#a09070", damage: 36, range: 120, attackSpeed: 1.1, ability: "none", evolvedForm: true },
  { id: "jewelmunk", name: "Jewelmunk", emoji: "💎", rarity: "mythical", color: "#70e0ff", damage: 26, range: 135, attackSpeed: 1.8, ability: "none", evolvedForm: true },
  { id: "shadowmouse", name: "Shadow Mouse", emoji: "🖤", rarity: "mythical", color: "#504060", damage: 24, range: 130, attackSpeed: 2.0, ability: "none", evolvedForm: true },
  { id: "nightoracle", name: "Night Oracle", emoji: "🔮", rarity: "mythical", color: "#6a40a0", damage: 10, range: 170, attackSpeed: 2.8, ability: "none", flies: true, evolvedForm: true },
  { id: "starcervid", name: "Star Cervid", emoji: "✨", rarity: "mythical", color: "#ffe08a", damage: 42, range: 145, attackSpeed: 1.35, ability: "none", evolvedForm: true },
  { id: "giantpanda", name: "Giant Panda", emoji: "🐼", rarity: "mythical", color: "#f0f0f0", damage: 95, range: 165, attackSpeed: 0.85, ability: "none", evolvedForm: true, scale: 2.15 },
  { id: "werewolf", name: "Werewolf", emoji: "🐺", rarity: "mythical", color: "#4a3048", damage: 58, range: 155, attackSpeed: 1.5, ability: "none", evolvedForm: true },
  { id: "kitsune", name: "Kitsune", emoji: "🦊", rarity: "mythical", color: "#ff9040", damage: 40, range: 140, attackSpeed: 1.5, ability: "foxWall", evolvedForm: true },
  { id: "tidalkoi", name: "Tidal Koi", emoji: "🐠", rarity: "mythical", color: "#30c0e8", damage: 38, range: 145, attackSpeed: 1.55, ability: "floppyFin", evolvedForm: true },
  { id: "riverspirit", name: "River Spirit", emoji: "🌊", rarity: "mythical", color: "#40c0e0", damage: 45, range: 150, attackSpeed: 1.4, ability: "none", evolvedForm: true },
  { id: "ursaking", name: "Ursa King", emoji: "👑", rarity: "mythical", color: "#6a3020", damage: 160, range: 140, attackSpeed: 0.45, ability: "none", evolvedForm: true },
  { id: "frostursine", name: "Frost Ursine", emoji: "❄️", rarity: "mythical", color: "#b0e0ff", damage: 150, range: 145, attackSpeed: 0.42, ability: "none", evolvedForm: true },
  { id: "thunderroc", name: "Thunder Roc", emoji: "🌩️", rarity: "mythical", color: "#e8c040", damage: 12, range: 190, attackSpeed: 2.6, ability: "none", flies: true, evolvedForm: true },
  { id: "megalodon", name: "Megalodon", emoji: "🐋", rarity: "mythical", color: "#204060", damage: 95, range: 190, attackSpeed: 1.15, ability: "floppyFin", evolvedForm: true },
  { id: "crimsonoracle", name: "Crimson Oracle", emoji: "☄️", rarity: "mythical", color: "#ff3020", damage: 140, range: 210, attackSpeed: 1.7, ability: "godBeam", evolvedForm: true },

  // —— GOD ——
  { id: "redpanda", name: "Red Panda", emoji: "🐼", rarity: "god", color: "#e05030", damage: 95, range: 180, attackSpeed: 1.5, ability: "godBeam", canEvolve: true, evolvesTo: "crimsonoracle" },
];

/** Speed thieves — low HP, high speed. Strength thieves — high HP, low speed. */
export const SPEED_THIEVES: ThiefDef[] = [
  { id: "crumb", name: "Crumb Bug", emoji: "🐛", hp: 38, speed: 64, gold: 2, size: 13, kind: "speed" },
  { id: "skunk", name: "Skunk", emoji: "🦨", hp: 62, speed: 74, gold: 3, size: 14, kind: "speed" },
  { id: "swiftrat", name: "Swift Rat", emoji: "🐀", hp: 88, speed: 88, gold: 4, size: 14, kind: "speed" },
];

export const STRENGTH_THIEVES: ThiefDef[] = [
  { id: "raccoon", name: "Raccoon", emoji: "🦝", hp: 150, speed: 32, gold: 3, size: 16, kind: "strength" },
  { id: "pig", name: "Snack Pig", emoji: "🐷", hp: 240, speed: 26, gold: 5, size: 18, kind: "strength" },
  { id: "boar", name: "Cookie Boar", emoji: "🐗", hp: 360, speed: 22, gold: 8, size: 21, kind: "strength" },
];

export const THIEVES: ThiefDef[] = [
  ...SPEED_THIEVES,
  ...STRENGTH_THIEVES,
  { id: "boss", name: "King Raccoon", emoji: "👑", hp: 900, speed: 28, gold: 30, size: 28, kind: "boss", boss: true },
];

/** End-of-map bosses (fought on waves 30, 60, 90, …) */
export const LEVEL_BOSSES: ThiefDef[] = [
  { id: "boss_forest", name: "King Raccoon", emoji: "👑", hp: 1400, speed: 24, gold: 60, size: 34, kind: "boss", boss: true },
  { id: "boss_river", name: "Tide Thief", emoji: "🌊", hp: 1600, speed: 27, gold: 70, size: 34, kind: "boss", boss: true },
  { id: "boss_meadow", name: "Meadow Tyrant", emoji: "🐗", hp: 1850, speed: 22, gold: 80, size: 36, kind: "boss", boss: true },
  { id: "boss_canyon", name: "Canyon King", emoji: "🦂", hp: 2100, speed: 25, gold: 90, size: 36, kind: "boss", boss: true },
];

/** True on the last wave of each map (30, 60, 90, …) */
export function isLevelBossWave(wave: number): boolean {
  return wave > 0 && wave % WAVES_PER_MAP === 0;
}

export function levelBossForWave(_wave: number): ThiefDef {
  return LEVEL_BOSSES[getActiveCourseIndex() % LEVEL_BOSSES.length];
}

export function pickFriend(lucky = false): FriendDef {
  const roll = Math.random() * 100;
  const pandaChance = lucky ? 1.5 : 0.5;
  if (roll < pandaChance) {
    return FRIENDS.find((f) => f.id === "redpanda")!;
  }

  const summonable = FRIENDS.filter(
    (f) => !f.evolvedForm && f.rarity !== "mythical" && f.id !== "redpanda",
  );

  if (lucky) {
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
  else rarity = "legendary";

  const pool = summonable.filter((f) => f.rarity === rarity);
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Default 50% chance (0.5) to evolve; friends may override with evolveChance */
export const EVOLVE_CHANCE = 0.5;

export function evolveChanceFor(current: FriendDef): number {
  return current.evolveChance ?? EVOLVE_CHANCE;
}

export function tryEvolve(current: FriendDef): FriendDef | null {
  if (!current.canEvolve || !current.evolvesTo) return null;
  if (Math.random() >= evolveChanceFor(current)) return null;
  return FRIENDS.find((f) => f.id === current.evolvesTo) ?? null;
}

export const SUMMON_COST = 1;

/** Wave number within the current map level (1..WAVES_PER_MAP) */
export function waveInLevel(wave: number): number {
  return ((Math.max(1, wave) - 1) % WAVES_PER_MAP) + 1;
}

/**
 * Weighted pick in a pool. favorWeak 0..1 biases toward earlier (weaker) entries.
 */
function weightedFromPool(pool: ThiefDef[], maxIndex: number, favorWeak: number): ThiefDef {
  const hi = Math.max(0, Math.min(maxIndex, pool.length - 1));
  if (hi <= 0) return pool[0];
  const bias = Math.max(0.05, Math.min(1, favorWeak));
  const weights: number[] = [];
  for (let i = 0; i <= hi; i++) {
    weights.push(Math.pow(1 + bias * 4, hi - i));
  }
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return pool[i];
  }
  return pool[0];
}

/** How far into a role pool this wave unlocks (0..2) */
function roleUnlockIndex(tier: number, local: number): number {
  if (tier === 0) {
    if (local <= 8) return 0;
    if (local <= 16) return 1;
    return 2;
  }
  if (local <= 4) return Math.min(2, tier > 1 ? 1 : 0);
  if (local <= 12) return Math.min(2, 1 + Math.min(1, tier));
  return 2;
}

/** Chance a spawn is strength (vs speed) — waves mix both roles */
function strengthChance(tier: number, local: number): number {
  if (tier === 0) {
    if (local <= 5) return 0.08; // almost all speed early
    if (local <= 12) return 0.35;
    return 0.48;
  }
  return Math.min(0.62, 0.4 + tier * 0.05 + local * 0.008);
}

/**
 * Pick a thief for this wave.
 * Waves combine speed (fragile/fast) and strength (tanky/slow) targets.
 * Early level still weights toward weak speed bugs so players can win.
 */
export function thiefForWave(wave: number): ThiefDef {
  if (isLevelBossWave(wave)) return levelBossForWave(wave);

  const tier = mapTierForWave(wave);
  const local = waveInLevel(wave);

  // Soft mini-boss: early Snack Pig (strength), later King Raccoon
  if (wave > 0 && wave % 10 === 0) {
    if (tier === 0 && local <= 10) return STRENGTH_THIEVES[1];
    return THIEVES.find((t) => t.id === "boss")!;
  }

  const wantStrength = Math.random() < strengthChance(tier, local);
  const pool = wantStrength ? STRENGTH_THIEVES : SPEED_THIEVES;
  const unlock = roleUnlockIndex(tier, local);
  const favorWeak = tier === 0 ? Math.max(0.45, 0.95 - local * 0.025) : Math.max(0.3, 0.7 - tier * 0.08);

  return weightedFromPool(pool, unlock, favorWeak);
}

export function waveCount(wave: number): number {
  if (isLevelBossWave(wave)) return 1; // solo boss fight
  // Checkpoint mini-boss waves are a single tougher foe
  if (wave > 0 && wave % 10 === 0) return 1;
  const tier = mapTierForWave(wave);
  const local = waveInLevel(wave);
  if (tier === 0) {
    // Short early packs so new players can clear waves
    if (local <= 4) return 2;
    if (local <= 8) return 3;
    if (local <= 14) return 4;
    return Math.min(10, 4 + Math.floor((local - 14) / 3));
  }
  return Math.min(14, 3 + Math.floor(local / 3) + tier);
}

/**
 * HP multiplier. Level 1 opens soft and ramps slowly; higher levels stay
 * tougher at the start but remain below a runaway curve.
 */
export function waveHpScale(wave: number): number {
  const tier = mapTierForWave(wave);
  const local = waveInLevel(wave);

  if (tier === 0) {
    // ~0.55 → ~2.2 across the first map — winnable with a few basic friends
    const soft = 0.55 + (local - 1) * 0.05 + Math.floor(local / 10) * 0.2;
    if (isLevelBossWave(wave)) return soft * 1.6;
    return soft;
  }

  const tierFloor = 1.05 + tier * 0.55;
  const localRamp =
    (local - 1) * (0.09 + tier * 0.025) + Math.floor(local / 10) * (0.28 + tier * 0.12);
  const base = tierFloor + localRamp;
  if (isLevelBossWave(wave)) return base * (1.8 + tier * 0.15);
  return base;
}

/** Mild speed bump; level 1 stays at base speed longer */
export function waveSpeedScale(wave: number): number {
  const tier = mapTierForWave(wave);
  const local = waveInLevel(wave);
  if (tier === 0) return 1 + Math.max(0, local - 10) * 0.003;
  return 1 + tier * 0.05 + (local - 1) * 0.003;
}

export function rarityLabel(r: Rarity): string {
  if (r === "god") return "GOD";
  if (r === "mythical") return "MYTHICAL";
  if (r === "legendary") return "LEGENDARY";
  if (r === "rare") return "TIER 2";
  return "BASIC";
}

/** Resolve weapon specialty (defaults from traits if unset) */
export function weaponRoleFor(def: FriendDef): WeaponRole {
  if (def.weaponRole) return def.weaponRole;
  if (def.flies || def.ability === "floppyFin" || def.ability === "foxWall") return "antiSpeed";
  if (def.damage >= 50 || def.attackSpeed <= 0.5) return "antiStrength";
  // Ground specialists without extreme stats
  if (
    def.id === "hedgehog" ||
    def.id === "beaver" ||
    def.id === "wolf" ||
    def.id === "spikeking" ||
    def.id === "werewolf"
  ) {
    return "antiStrength";
  }
  if (def.id === "chipmunk" || def.id === "mouse" || def.id === "jewelmunk" || def.id === "shadowmouse") {
    return "antiSpeed";
  }
  return "balanced";
}

export function weaponRoleLabel(role: WeaponRole): string {
  if (role === "antiSpeed") return "vs Speed";
  if (role === "antiStrength") return "vs Strength";
  return "Balanced";
}
