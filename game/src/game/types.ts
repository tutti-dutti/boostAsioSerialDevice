import type { FriendDef, ThiefDef } from "./data";

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
}

export interface Thief {
  uid: string;
  def: ThiefDef;
  hp: number;
  maxHp: number;
  progress: number;
  slowTimer: number;
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
}

export interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

export interface Boom {
  kind: "crumb" | "frost" | "zap" | "floppy" | "wall" | "beam";
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
  const tier = f.def.rarity === "god" ? 1.15 : 1;
  return Math.round(f.def.damage * (1 + (f.level - 1) * 0.35) * tier);
}

export function friendRange(f: PlacedFriend): number {
  return f.def.range * (1 + (f.level - 1) * 0.04);
}

export function upgradeCost(f: PlacedFriend): number {
  const mult =
    f.def.rarity === "god"
      ? 4
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
