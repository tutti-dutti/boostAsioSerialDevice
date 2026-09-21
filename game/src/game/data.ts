import { WAVES_PER_MAP, getActiveCourseIndex, mapTierForWave } from "./path";
import type { Difficulty } from "./difficulty";

export type Rarity = "common" | "rare" | "legendary" | "mythical" | "god";

export type AbilityId = "none" | "floppyFin" | "foxWall" | "godBeam" | "freeze" | "heavyHit" | "poisonFart";

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
  /** Override unused — global EVOLVE_CHANCE is flat 5% for every animal */
  evolveChance?: number;
  flies?: boolean;
  /** Evolved forms are summon-blocked */
  evolvedForm?: boolean;
  /** Visual size multiplier (default 1). Capped — mega forms stay slightly larger without covering the path */
  scale?: number;
}

/** Hard cap so evolved icons never cover the path */
export const MAX_FRIEND_SCALE = 1.25;

export function friendDisplayScale(def: FriendDef): number {
  return Math.min(def.scale ?? 1, MAX_FRIEND_SCALE);
}

/** Drawn token radius — used for path clearance so icons can't overhang the path */
export function friendFootprintRadius(def: FriendDef): number {
  const scale = friendDisplayScale(def);
  if (def.rarity === "god") return Math.round(28 * scale);
  if (def.rarity === "mythical") return Math.round(26 * scale);
  return Math.round(22 * scale);
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

/** Base animals + mythical evolutions
 * Role identity (same-rarity DPS peaks are close when on-role):
 * - antiSpeed: fast fire, low damage — shreds runners
 * - antiStrength: slow fire, high damage — cracks tanks
 * - balanced: mid fire & damage — reliable generalists
 */
export const FRIENDS: FriendDef[] = [
  // —— Basic ——
  // Birds: fastest fire, still low damage — chase speed
  { id: "hummingbird", name: "Hummingbird", emoji: "🐦", rarity: "common", color: "#7ecf9a", damage: 2, range: 95, attackSpeed: 3.0, ability: "none", flies: true, weaponRole: "antiSpeed", canEvolve: true, evolvesTo: "phoenixlet" },
  { id: "bunny", name: "Bunny", emoji: "🐰", rarity: "common", color: "#f0e0d0", damage: 7, range: 90, attackSpeed: 1.2, ability: "none", weaponRole: "balanced", canEvolve: true, evolvesTo: "moonhare" },
  { id: "squirrel", name: "Squirrel", emoji: "🐿️", rarity: "common", color: "#c48848", damage: 7, range: 88, attackSpeed: 1.25, ability: "none", weaponRole: "balanced", canEvolve: true, evolvesTo: "stormsquirrel" },
  { id: "hedgehog", name: "Hedgehog", emoji: "🦔", rarity: "common", color: "#a08060", damage: 13, range: 80, attackSpeed: 0.72, ability: "heavyHit", weaponRole: "antiStrength", canEvolve: true, evolvesTo: "spikeking" },
  { id: "chipmunk", name: "Chipmunk", emoji: "🐹", rarity: "common", color: "#d0a060", damage: 4, range: 92, attackSpeed: 2.2, ability: "none", weaponRole: "antiSpeed", canEvolve: true, evolvesTo: "jewelmunk" },
  { id: "mouse", name: "Forest Mouse", emoji: "🐭", rarity: "common", color: "#c0b0a0", damage: 3, range: 86, attackSpeed: 2.5, ability: "none", weaponRole: "antiSpeed", canEvolve: true, evolvesTo: "shadowmouse" },
  // Freeze specialist — stops speed runners
  { id: "penguin", name: "Penguin", emoji: "🐧", rarity: "common", color: "#90c8e8", damage: 4, range: 88, attackSpeed: 1.55, ability: "freeze", weaponRole: "antiSpeed", canEvolve: true, evolvesTo: "emperorpenguin" },
  // Heavy specialist — cracks strength tanks
  { id: "mole", name: "Mole", emoji: "🦡", rarity: "common", color: "#8a7060", damage: 14, range: 78, attackSpeed: 0.68, ability: "heavyHit", weaponRole: "antiStrength", canEvolve: true, evolvesTo: "titanmole" },
  // Poison specialist — farts a toxic cloud
  { id: "skunk", name: "Skunk", emoji: "🦨", rarity: "common", color: "#6a6870", damage: 4, range: 85, attackSpeed: 1.7, ability: "poisonFart", weaponRole: "antiSpeed", canEvolve: true, evolvesTo: "stinklord" },

  // —— Tier two ——
  { id: "owl", name: "Owl", emoji: "🦉", rarity: "rare", color: "#8a7050", damage: 4, range: 110, attackSpeed: 2.6, ability: "none", flies: true, weaponRole: "antiSpeed", canEvolve: true, evolvesTo: "nightoracle" },
  { id: "deer", name: "Deer", emoji: "🦌", rarity: "rare", color: "#c89858", damage: 15, range: 110, attackSpeed: 1.1, ability: "none", weaponRole: "balanced", canEvolve: true, evolvesTo: "starcervid" },
  { id: "beaver", name: "Beaver", emoji: "🦫", rarity: "rare", color: "#8a6040", damage: 24, range: 100, attackSpeed: 0.7, ability: "heavyHit", weaponRole: "antiStrength", canEvolve: true, evolvesTo: "giantpanda" },
  { id: "wolf", name: "Wolf", emoji: "🐺", rarity: "rare", color: "#808898", damage: 26, range: 115, attackSpeed: 0.65, ability: "none", weaponRole: "antiStrength", canEvolve: true, evolvesTo: "werewolf" },
  { id: "fox", name: "Fox", emoji: "🦊", rarity: "rare", color: "#e87840", damage: 9, range: 105, attackSpeed: 1.9, ability: "foxWall", weaponRole: "antiSpeed", canEvolve: true, evolvesTo: "kitsune" },
  { id: "fish", name: "Fish", emoji: "🐟", rarity: "rare", color: "#5eb8e0", damage: 8, range: 100, attackSpeed: 2.0, ability: "floppyFin", weaponRole: "antiSpeed", canEvolve: true, evolvesTo: "tidalkoi" },
  { id: "seal", name: "Seal", emoji: "🦭", rarity: "rare", color: "#a8d0e8", damage: 9, range: 108, attackSpeed: 1.75, ability: "freeze", weaponRole: "antiSpeed", canEvolve: true, evolvesTo: "frostseal" },
  { id: "moose", name: "Moose", emoji: "🫎", rarity: "rare", color: "#a07040", damage: 30, range: 105, attackSpeed: 0.58, ability: "heavyHit", weaponRole: "antiStrength", canEvolve: true, evolvesTo: "megamoose" },

  // —— Legendary ——
  { id: "otter", name: "Otter", emoji: "🦦", rarity: "legendary", color: "#b08050", damage: 22, range: 115, attackSpeed: 1.15, ability: "none", weaponRole: "balanced", canEvolve: true, evolvesTo: "riverspirit" },
  // Bears: freeze / heavy roles
  { id: "brownbear", name: "Brown Bear", emoji: "🐻", rarity: "legendary", color: "#8a5030", damage: 78, range: 110, attackSpeed: 0.38, ability: "heavyHit", weaponRole: "antiStrength", canEvolve: true, evolvesTo: "ursaking" },
  { id: "polarbear", name: "Polar Bear", emoji: "🐻‍❄️", rarity: "legendary", color: "#e8f0f8", damage: 18, range: 115, attackSpeed: 1.35, ability: "freeze", weaponRole: "antiSpeed", canEvolve: true, evolvesTo: "frostursine" },
  { id: "eagle", name: "Bald Eagle", emoji: "🦅", rarity: "legendary", color: "#d0a040", damage: 4, range: 130, attackSpeed: 2.5, ability: "none", flies: true, weaponRole: "antiSpeed", canEvolve: true, evolvesTo: "thunderroc" },
  { id: "shark", name: "Shark", emoji: "🦈", rarity: "legendary", color: "#6080a0", damage: 14, range: 130, attackSpeed: 1.85, ability: "floppyFin", weaponRole: "antiSpeed", canEvolve: true, evolvesTo: "megalodon" },

  // —— Mythical evolutions (bigger/stronger, evolve-only) ——
  { id: "phoenixlet", name: "Phoenixlet", emoji: "🔥", rarity: "mythical", color: "#ff7040", damage: 6, range: 150, attackSpeed: 3.4, ability: "none", flies: true, weaponRole: "antiSpeed", evolvedForm: true },
  { id: "moonhare", name: "Moon Hare", emoji: "🌙", rarity: "mythical", color: "#d0e0ff", damage: 26, range: 130, attackSpeed: 1.35, ability: "none", weaponRole: "balanced", evolvedForm: true },
  { id: "stormsquirrel", name: "Storm Squirrel", emoji: "⚡", rarity: "mythical", color: "#f0d040", damage: 28, range: 125, attackSpeed: 1.4, ability: "none", weaponRole: "balanced", evolvedForm: true },
  { id: "spikeking", name: "Spike King", emoji: "🛡️", rarity: "mythical", color: "#a09070", damage: 48, range: 120, attackSpeed: 0.75, ability: "heavyHit", weaponRole: "antiStrength", evolvedForm: true },
  { id: "jewelmunk", name: "Jewelmunk", emoji: "💎", rarity: "mythical", color: "#70e0ff", damage: 14, range: 135, attackSpeed: 2.4, ability: "none", weaponRole: "antiSpeed", evolvedForm: true },
  { id: "shadowmouse", name: "Shadow Mouse", emoji: "🖤", rarity: "mythical", color: "#504060", damage: 12, range: 130, attackSpeed: 2.7, ability: "none", weaponRole: "antiSpeed", evolvedForm: true },
  { id: "emperorpenguin", name: "Emperor Penguin", emoji: "🧊", rarity: "mythical", color: "#70b8e0", damage: 14, range: 140, attackSpeed: 1.85, ability: "freeze", weaponRole: "antiSpeed", evolvedForm: true },
  { id: "titanmole", name: "Titan Mole", emoji: "⛏️", rarity: "mythical", color: "#6a5040", damage: 55, range: 125, attackSpeed: 0.62, ability: "heavyHit", weaponRole: "antiStrength", evolvedForm: true },
  { id: "stinklord", name: "Stink Lord", emoji: "☁️", rarity: "mythical", color: "#5a7060", damage: 12, range: 130, attackSpeed: 1.9, ability: "poisonFart", weaponRole: "antiSpeed", evolvedForm: true },
  { id: "frostseal", name: "Frost Seal", emoji: "❄️", rarity: "mythical", color: "#c0e8ff", damage: 18, range: 150, attackSpeed: 1.8, ability: "freeze", weaponRole: "antiSpeed", evolvedForm: true },
  { id: "megamoose", name: "Mega Moose", emoji: "🦌", rarity: "mythical", color: "#804820", damage: 72, range: 140, attackSpeed: 0.55, ability: "heavyHit", weaponRole: "antiStrength", evolvedForm: true, scale: 1.2 },
  { id: "nightoracle", name: "Night Oracle", emoji: "🔮", rarity: "mythical", color: "#6a40a0", damage: 8, range: 170, attackSpeed: 3.0, ability: "none", flies: true, weaponRole: "antiSpeed", evolvedForm: true },
  { id: "starcervid", name: "Star Cervid", emoji: "✨", rarity: "mythical", color: "#ffe08a", damage: 38, range: 145, attackSpeed: 1.25, ability: "none", weaponRole: "balanced", evolvedForm: true },
  { id: "giantpanda", name: "Giant Panda", emoji: "🐼", rarity: "mythical", color: "#f0f0f0", damage: 88, range: 165, attackSpeed: 0.7, ability: "heavyHit", weaponRole: "antiStrength", evolvedForm: true, scale: 1.25 },
  { id: "werewolf", name: "Werewolf", emoji: "🐺", rarity: "mythical", color: "#4a3048", damage: 62, range: 155, attackSpeed: 0.72, ability: "none", weaponRole: "antiStrength", evolvedForm: true },
  { id: "kitsune", name: "Kitsune", emoji: "🦊", rarity: "mythical", color: "#ff9040", damage: 18, range: 140, attackSpeed: 2.2, ability: "foxWall", weaponRole: "antiSpeed", evolvedForm: true },
  { id: "tidalkoi", name: "Tidal Koi", emoji: "🐠", rarity: "mythical", color: "#30c0e8", damage: 16, range: 145, attackSpeed: 2.3, ability: "floppyFin", weaponRole: "antiSpeed", evolvedForm: true },
  { id: "riverspirit", name: "River Spirit", emoji: "🌊", rarity: "mythical", color: "#40c0e0", damage: 40, range: 150, attackSpeed: 1.3, ability: "none", weaponRole: "balanced", evolvedForm: true },
  { id: "ursaking", name: "Ursa King", emoji: "👑", rarity: "mythical", color: "#6a3020", damage: 145, range: 140, attackSpeed: 0.4, ability: "heavyHit", weaponRole: "antiStrength", evolvedForm: true },
  { id: "frostursine", name: "Frost Ursine", emoji: "❄️", rarity: "mythical", color: "#b0e0ff", damage: 28, range: 145, attackSpeed: 1.55, ability: "freeze", weaponRole: "antiSpeed", evolvedForm: true },
  { id: "thunderroc", name: "Thunder Roc", emoji: "🌩️", rarity: "mythical", color: "#e8c040", damage: 10, range: 190, attackSpeed: 2.9, ability: "none", flies: true, weaponRole: "antiSpeed", evolvedForm: true },
  { id: "megalodon", name: "Megalodon", emoji: "🐋", rarity: "mythical", color: "#204060", damage: 32, range: 190, attackSpeed: 1.9, ability: "floppyFin", weaponRole: "antiSpeed", evolvedForm: true },
  { id: "crimsonoracle", name: "Crimson Oracle", emoji: "☄️", rarity: "mythical", color: "#ff3020", damage: 95, range: 210, attackSpeed: 0.85, ability: "godBeam", weaponRole: "antiStrength", evolvedForm: true },

  // —— GOD ——
  { id: "redpanda", name: "Red Panda", emoji: "🐼", rarity: "god", color: "#e05030", damage: 70, range: 180, attackSpeed: 1.05, ability: "godBeam", weaponRole: "antiStrength", canEvolve: true, evolvesTo: "crimsonoracle" },
];

/** Speed thieves — fragile & fast. Strength thieves — tanky & slow.
 * Pools are ordered weak → strong; waves unlock further entries over time.
 */
export const SPEED_THIEVES: ThiefDef[] = [
  { id: "crumb", name: "Crumb Bug", emoji: "🐛", hp: 26, speed: 70, gold: 2, size: 12, kind: "speed" },
  { id: "sugarant", name: "Sugar Ant", emoji: "🐜", hp: 32, speed: 76, gold: 2, size: 11, kind: "speed" },
  { id: "raiderskunk", name: "Skunk", emoji: "🦨", hp: 40, speed: 82, gold: 3, size: 13, kind: "speed" },
  { id: "sprinklefly", name: "Sprinkle Fly", emoji: "🦟", hp: 36, speed: 88, gold: 3, size: 11, kind: "speed" },
  { id: "swiftrat", name: "Swift Rat", emoji: "🐀", hp: 55, speed: 96, gold: 4, size: 13, kind: "speed" },
  { id: "jellyjay", name: "Jelly Jay", emoji: "🐤", hp: 48, speed: 102, gold: 4, size: 12, kind: "speed" },
  { id: "frostingfox", name: "Frosting Fox", emoji: "🦊", hp: 62, speed: 108, gold: 5, size: 14, kind: "speed" },
  { id: "cookiebat", name: "Cookie Bat", emoji: "🦇", hp: 58, speed: 118, gold: 5, size: 13, kind: "speed" },
  { id: "candycrow", name: "Candy Crow", emoji: "🐦‍⬛", hp: 70, speed: 112, gold: 6, size: 14, kind: "speed" },
];

export const STRENGTH_THIEVES: ThiefDef[] = [
  { id: "raccoon", name: "Raccoon", emoji: "🦝", hp: 110, speed: 24, gold: 3, size: 17, kind: "strength" },
  { id: "pantrygoat", name: "Pantry Goat", emoji: "🐐", hp: 200, speed: 22, gold: 4, size: 18, kind: "strength" },
  { id: "pig", name: "Snack Pig", emoji: "🐷", hp: 175, speed: 18, gold: 5, size: 19, kind: "strength" },
  { id: "doughbadger", name: "Dough Badger", emoji: "🦡", hp: 290, speed: 17, gold: 5, size: 18, kind: "strength" },
  { id: "boar", name: "Cookie Boar", emoji: "🐗", hp: 380, speed: 14, gold: 8, size: 22, kind: "strength" },
  { id: "ovenox", name: "Oven Ox", emoji: "🐂", hp: 420, speed: 13, gold: 8, size: 23, kind: "strength" },
  { id: "fridgehippo", name: "Fridge Hippo", emoji: "🦛", hp: 480, speed: 11, gold: 9, size: 24, kind: "strength" },
  { id: "crumbgorilla", name: "Crumb Gorilla", emoji: "🦍", hp: 540, speed: 12, gold: 10, size: 25, kind: "strength" },
  { id: "doughgolem", name: "Dough Golem", emoji: "🗿", hp: 620, speed: 10, gold: 12, size: 26, kind: "strength" },
];

/** Mid-map checkpoint foes (every 10 waves) */
export const MINI_BOSSES: ThiefDef[] = [
  { id: "miniboss_pig", name: "Boss Pig", emoji: "🐷", hp: 360, speed: 20, gold: 18, size: 24, kind: "boss", boss: true },
  { id: "miniboss_crow", name: "Sugar Baron", emoji: "🐦‍⬛", hp: 480, speed: 34, gold: 18, size: 22, kind: "boss", boss: true },
  { id: "miniboss_ox", name: "Baker Ox", emoji: "🐂", hp: 640, speed: 16, gold: 22, size: 26, kind: "boss", boss: true },
  { id: "boss", name: "King Raccoon", emoji: "👑", hp: 560, speed: 28, gold: 30, size: 28, kind: "boss", boss: true },
];

export const THIEVES: ThiefDef[] = [
  ...SPEED_THIEVES,
  ...STRENGTH_THIEVES,
  ...MINI_BOSSES,
];

/** End-of-map bosses (fought on waves 30, 60, 90, …) */
export const LEVEL_BOSSES: ThiefDef[] = [
  { id: "boss_forest", name: "King Raccoon", emoji: "👑", hp: 880, speed: 24, gold: 60, size: 34, kind: "boss", boss: true },
  { id: "boss_river", name: "Tide Thief", emoji: "🌊", hp: 1450, speed: 27, gold: 70, size: 34, kind: "boss", boss: true },
  { id: "boss_meadow", name: "Meadow Tyrant", emoji: "🐗", hp: 1650, speed: 22, gold: 80, size: 36, kind: "boss", boss: true },
  { id: "boss_canyon", name: "Canyon King", emoji: "🦂", hp: 1900, speed: 25, gold: 90, size: 36, kind: "boss", boss: true },
  { id: "boss_bakery", name: "Oven Overlord", emoji: "🍪", hp: 1750, speed: 23, gold: 85, size: 35, kind: "boss", boss: true },
  { id: "boss_pantry", name: "Pantry Phantom", emoji: "👻", hp: 1580, speed: 30, gold: 75, size: 33, kind: "boss", boss: true },
  { id: "boss_frost", name: "Frostbite Bandit", emoji: "🧊", hp: 1820, speed: 21, gold: 88, size: 35, kind: "boss", boss: true },
  { id: "boss_spice", name: "Spice Drake", emoji: "🐉", hp: 2100, speed: 26, gold: 100, size: 38, kind: "boss", boss: true },
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

/** Flat 5% chance (5 out of 100) to evolve on every upgrade for every animal */
export const EVOLVE_CHANCE = 0.05;

export function evolveChanceFor(_current: FriendDef): number {
  return EVOLVE_CHANCE;
}

export function friendById(id: string): FriendDef | undefined {
  return FRIENDS.find((f) => f.id === id);
}

/** Base form that evolves into this id (if any) */
export function evolvesFrom(id: string): FriendDef | undefined {
  return FRIENDS.find((f) => f.evolvesTo === id);
}

/** Next form this friend can evolve into (if any) */
export function evolveInto(def: FriendDef): FriendDef | undefined {
  if (!def.canEvolve || !def.evolvesTo) return undefined;
  return friendById(def.evolvesTo);
}

export function evolveLineage(def: FriendDef): {
  from: FriendDef | null;
  into: FriendDef | null;
  fromLabel: string;
  intoLabel: string;
} {
  const from = evolvesFrom(def.id) ?? null;
  const into = evolveInto(def) ?? null;
  const pct = Math.round(EVOLVE_CHANCE * 100);
  return {
    from,
    into,
    fromLabel: from ? `${from.emoji} ${from.name}` : "Base form (nothing before)",
    intoLabel: into
      ? `${into.emoji} ${into.name} (${pct}% on upgrade)`
      : "Fully evolved (no further form)",
  };
}

export function tryEvolve(current: FriendDef): FriendDef | null {
  if (!current.canEvolve || !current.evolvesTo) return null;
  if (Math.random() >= evolveChanceFor(current)) return null;
  return FRIENDS.find((f) => f.id === current.evolvesTo) ?? null;
}

export const SUMMON_COST = 5;
/** Lucky costs exactly 2 normal summons — better rarity odds */
export const LUCKY_SUMMON_COST = SUMMON_COST * 2;
/** Stars on New Game — enough for 3 normal summons before Wave 1 */
export const START_STARS = 15;

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

/** How far into a role pool this wave unlocks (0..poolLength-1) */
function roleUnlockIndex(tier: number, local: number, poolLen: number): number {
  const max = Math.max(0, poolLen - 1);
  if (tier === 0) {
    if (local <= 4) return 0;
    if (local <= 8) return Math.min(max, 1);
    if (local <= 12) return Math.min(max, 2);
    if (local <= 18) return Math.min(max, 3);
    if (local <= 24) return Math.min(max, 5);
    return Math.min(max, 6);
  }
  if (local <= 4) return Math.min(max, tier > 1 ? 2 : 1);
  if (local <= 10) return Math.min(max, 3 + Math.min(2, tier));
  if (local <= 20) return Math.min(max, 5 + Math.min(2, tier));
  return max;
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

function miniBossForWave(wave: number, tier: number): ThiefDef {
  if (tier === 0 && waveInLevel(wave) <= 10) {
    return MINI_BOSSES[0]!; // Boss Pig — gentle first checkpoint
  }
  const idx = Math.floor(wave / 10) % MINI_BOSSES.length;
  return MINI_BOSSES[idx]!;
}

/**
 * Pick a thief for this wave.
 * Waves combine speed (fragile/fast) and strength (tanky/slow) targets.
 * Early level still weights toward weak speed bugs so players can win.
 * Hard trims strength mix a bit so tank packs don't overwhelm income.
 */
export function thiefForWave(wave: number, difficulty: Difficulty = "easy"): ThiefDef {
  if (isLevelBossWave(wave)) return levelBossForWave(wave);

  const tier = mapTierForWave(wave);
  const local = waveInLevel(wave);

  // Soft mini-boss every 10 waves
  if (wave > 0 && wave % 10 === 0) {
    return miniBossForWave(wave, tier);
  }

  let chance = strengthChance(tier, local);
  if (difficulty === "hard") chance *= 0.82;
  else if (difficulty === "easy") chance *= 1.05;
  const wantStrength = Math.random() < chance;
  const pool = wantStrength ? STRENGTH_THIEVES : SPEED_THIEVES;
  const unlock = roleUnlockIndex(tier, local, pool.length);
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
    // Slightly firmer early map — still teachable, but not trivial
    const soft = 0.62 + (local - 1) * 0.055 + Math.floor(local / 10) * 0.18;
    if (isLevelBossWave(wave)) return soft * 1.55;
    return soft;
  }

  const tierFloor = 1.1 + tier * 0.55;
  const localRamp =
    (local - 1) * (0.095 + tier * 0.025) + Math.floor(local / 10) * (0.28 + tier * 0.12);
  const base = tierFloor + localRamp;
  if (isLevelBossWave(wave)) return base * (1.75 + tier * 0.14);
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
  if (def.ability === "freeze" || def.flies || def.ability === "floppyFin" || def.ability === "foxWall" || def.ability === "poisonFart") {
    return "antiSpeed";
  }
  if (def.ability === "heavyHit" || def.damage >= 50 || def.attackSpeed <= 0.5) return "antiStrength";
  if (
    def.id === "hedgehog" ||
    def.id === "beaver" ||
    def.id === "wolf" ||
    def.id === "spikeking" ||
    def.id === "werewolf" ||
    def.id === "mole" ||
    def.id === "moose"
  ) {
    return "antiStrength";
  }
  if (
    def.id === "chipmunk" ||
    def.id === "mouse" ||
    def.id === "jewelmunk" ||
    def.id === "shadowmouse" ||
    def.id === "penguin" ||
    def.id === "seal"
  ) {
    return "antiSpeed";
  }
  return "balanced";
}

export function weaponRoleLabel(role: WeaponRole): string {
  if (role === "antiSpeed") return "Fast fire · low dmg · vs Speed";
  if (role === "antiStrength") return "Slow fire · high dmg · vs Strength";
  return "Balanced fire & damage";
}
