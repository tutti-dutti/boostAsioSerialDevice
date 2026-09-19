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
}

export interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

export interface Boom {
  kind: "crumb" | "frost" | "zap" | "floppy" | "wall" | "beam" | "freeze" | "heavy";
  x: number;
  y: number;
  life: number;
  radius: number;
}

/** Temporary fox defense on the path */
export interface Wall {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  progress: number;
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
