import type { FriendDef, ThiefDef, WeaponRole } from "./data";
import { weaponRoleFor } from "./data";

export interface Vec2 {
  x: number;
  y: number;
}

export interface Slot {
  id: number;
  x: number;
  y: number;
  friend: PlacedFriend | null;
}

export interface PlacedFriend {
  uid: string;
  def: FriendDef;
  level: number;
  cooldown: number;
  slotId: number;
  /** Fox wall ability timer */
  abilityTimer: number;
  /** Bird orbit angle around the pad (radians) */
  orbitAngle: number;
  /** Beaver dam points earned from kills */
  beaverPoints?: number;
  /** Countdown until next random dumpling volley (pandas) */
  dumplingTimer?: number;
  /** Eagle freedom-run points from kills */
  eaglePoints?: number;
  /** Eagle has landed to drop bombs */
  landed?: boolean;
  /** Seconds left in land-and-bomb mode */
  landTimer?: number;
  /** Cooldown between bomb drops while landed */
  bombCooldown?: number;
  /** Comic speech bubble above the friend */
  speech?: { text: string; life: number };
}

/** Kill points needed for a beaver to build one dam */
export const BEAVER_DAM_COST = 5;

/** Kill points needed for an eagle to land and bomb */
export const EAGLE_LAND_COST = 6;

/** How long the eagle stays landed dropping bombs */
export const EAGLE_LAND_DURATION = 7.5;

export function isBeaverBuilder(f: PlacedFriend | FriendDef): boolean {
  const id = "def" in f ? f.def.id : f.id;
  return id === "beaver" || id === "giantpanda";
}

/** Kung Fu Panda–style dumpling throwers */
export function isDumplingPanda(f: PlacedFriend | FriendDef): boolean {
  const id = "def" in f ? f.def.id : f.id;
  return id === "giantpanda" || id === "redpanda";
}

export function nextDumplingDelay(): number {
  // Random 3.5–7.5s between dumpling volleys
  return 3.5 + Math.random() * 4;
}

export function isEagleBomber(f: PlacedFriend | FriendDef): boolean {
  const id = "def" in f ? f.def.id : f.id;
  return id === "eagle" || id === "thunderroc";
}

export function eagleKillPoints(thief: ThiefDef): number {
  if (thief.boss) return 3;
  if (thief.kind === "speed") return 2; // eagles love chasing runners
  return 1;
}

export function beaverKillPoints(thief: ThiefDef): number {
  if (thief.boss) return 3;
  if (thief.kind === "strength") return 2;
  return 1;
}

export function beaverDamMaxHp(level: number): number {
  return 36 + Math.max(1, level) * 10;
}

/** Orbit radius = shoot radius for flyers */
export function flyerOrbitRadius(f: PlacedFriend): number {
  return friendRange(f);
}

export function flyerWorldPos(slotX: number, slotY: number, f: PlacedFriend): { x: number; y: number } {
  const r = flyerOrbitRadius(f) * 0.72; // fly on a ring inside the shoot circle
  return {
    x: slotX + Math.cos(f.orbitAngle) * r,
    y: slotY + Math.sin(f.orbitAngle) * r,
  };
}

/** How fast birds circle (radians / second) */
export function flyerOrbitSpeed(f: PlacedFriend): number {
  if (f.def.id === "hummingbird") return 2.4;
  if (f.def.id === "phoenixlet") return 2.2;
  if (f.def.id === "eagle") return 1.5;
  if (f.def.id === "thunderroc") return 1.35;
  if (f.def.id === "nightoracle") return 1.6;
  return 1.8; // owl
}

export interface Thief {
  uid: string;
  def: ThiefDef;
  hp: number;
  maxHp: number;
  progress: number;
  slowTimer: number;
  /** Near-stop from freeze weapons (stronger than chill) */
  freezeTimer: number;
  blockedTimer: number;
  /** Poison DoT remaining duration */
  poisonTimer: number;
  /** Poison damage per second while poisoned */
  poisonDps: number;
  /** Accrues toward the next poison damage float tick */
  poisonAcc: number;
  /** Slot that applied the current poison (kill credit) */
  poisonOwnerSlotId?: number;
  alive: boolean;
}

export interface Shot {
  x: number;
  y: number;
  tx: number;
  ty: number;
  speed: number;
  damage: number;
  color: string;
  targetId: string;
  floppy?: boolean;
  godBeam?: boolean;
  freeze?: boolean;
  heavyHit?: boolean;
  weaponRole?: WeaponRole;
  /** Slot that fired this shot (for kill credit) */
  ownerSlotId?: number;
  /** Kung Fu Panda dumpling projectile */
  dumpling?: boolean;
  /** Eagle freedom bomb */
  bomb?: boolean;
}

export interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

export interface Boom {
  kind: "crumb" | "frost" | "zap" | "floppy" | "wall" | "beam" | "freeze" | "heavy" | "dam" | "dumpling" | "bomb" | "fart";
  x: number;
  y: number;
  life: number;
  radius: number;
}

/** A nibble taken out of the cookie when a thief reaches it */
export interface CookieBite {
  /** Angle around the cookie (radians) */
  angle: number;
  /** How deep the bite is (0.7–1.35) */
  size: number;
}

/** Temporary fox defense on the path */
export interface Wall {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  progress: number;
}

/** Beaver dam on the path — blocks thieves until smashed */
export interface Dam {
  x: number;
  y: number;
  progress: number;
  hp: number;
  maxHp: number;
  ownerSlotId: number;
}

/** Skunk fart poison cloud lingering on the board */
export interface PoisonCloud {
  x: number;
  y: number;
  radius: number;
  life: number;
  maxLife: number;
  dps: number;
  ownerSlotId: number;
}

export function friendDamage(f: PlacedFriend): number {
  const tier =
    f.def.rarity === "god" ? 1.15 : f.def.rarity === "mythical" ? 1.1 : 1;
  return Math.round(f.def.damage * (1 + (f.level - 1) * 0.35) * tier);
}

/** Damage after speed/strength weapon counters */
export function damageVsThief(f: PlacedFriend, thief: ThiefDef): number {
  let dmg = friendDamage(f);
  const role = weaponRoleFor(f.def);
  const kind = thief.kind ?? "strength";
  if (role === "antiSpeed") {
    if (kind === "speed") dmg *= 1.55;
    else if (kind === "strength") dmg *= 0.82;
  } else if (role === "antiStrength") {
    if (kind === "strength") dmg *= 1.6;
    else if (kind === "speed") dmg *= 0.78;
  }
  // Heavy hitters punch well above their weight vs tanks
  if (f.def.ability === "heavyHit" && kind === "strength") dmg *= 1.35;
  if (f.def.ability === "heavyHit" && kind === "speed") dmg *= 0.9;
  // Freeze units trade raw damage for control
  if (f.def.ability === "freeze" && kind === "speed") dmg *= 1.15;
  return Math.max(1, Math.round(dmg));
}

export function friendRange(f: PlacedFriend): number {
  return f.def.range * (1 + (f.level - 1) * 0.04);
}

export function upgradeCost(f: PlacedFriend): number {
  const mult =
    f.def.rarity === "god"
      ? 4
      : f.def.rarity === "mythical"
        ? 3
        : f.def.rarity === "legendary"
          ? 2.2
          : f.def.rarity === "rare"
            ? 1.35
            : 1;
  return Math.round(6 * Math.pow(1.5, f.level - 1) * mult);
}

export function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}
