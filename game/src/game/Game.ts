import {
  FRIENDS,
  SUMMON_COST,
  pickFriend,
  tryEvolve,
  thiefForWave,
  waveCount,
  waveHpScale,
  waveSpeedScale,
  isLevelBossWave,
  levelBossForWave,
  weaponRoleFor,
  friendFootprintRadius,
  type FriendDef,
} from "./data";
import { COOKIE, W, H, pathPoint, nearestProgress, mapTierForWave, setActiveCourseMap, randomCourseIndex, listCourses, canPlaceAt, pathClearanceFor } from "./path";
import { draw, drawRangeHint } from "./render";
import { playHit, playShoot, playSpell, playCookieMunch, shootSoundFor, playPoisonFart, playFoxWall } from "./sound";
import { funnyQuipFor } from "./quips";
import {
  difficultyTuning,
  isDifficulty,
  loadDifficultyPreference,
  saveDifficultyPreference,
  scaleWaveCount,
  type Difficulty,
} from "./difficulty";
import {
  friendRange,
  flyerOrbitSpeed,
  flyerWorldPos,
  uid,
  upgradeCost,
  damageVsThief,
  friendDamage,
  isBeaverBuilder,
  beaverKillPoints,
  beaverDamMaxHp,
  BEAVER_DAM_COST,
  isDumplingPanda,
  nextDumplingDelay,
  isEagleBomber,
  eagleKillPoints,
  EAGLE_LAND_COST,
  EAGLE_LAND_DURATION,
  type Boom,
  type CookieBite,
  type Dam,
  type FloatText,
  type PoisonCloud,
  type Shot,
  type Slot,
  type Thief,
  type Wall,
} from "./types";

const SAVE_KEY = "cookie-guard-save-v2";
const MAX_DAMS = 3;
const SKUNK_FART_INTERVAL = 5.5;

export class Game {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  slots: Slot[] = [];
  mapTier = 0;
  /** Which base course theme is active (Forest, River, …) */
  courseIndex = 0;
  /** When true, each new map tier picks a different random course */
  courseRandom = true;
  /** Easy = softer thieves; Hard = tougher packs */
  difficulty: Difficulty = "easy";
  bag: FriendDef[] = [];
  selectedBag: number | null = null;
  selectedSlot: number | null = null;
  /** Free-place drag state */
  draggingSlot: number | null = null;
  dragMoved = false;
  dragOrigin: { x: number; y: number } | null = null;
  /** Ghost cursor while equipping a bag friend */
  deployGhost: { x: number; y: number; valid: boolean } | null = null;
  nextSlotId = 1;
  thieves: Thief[] = [];
  shots: Shot[] = [];
  floats: FloatText[] = [];
  booms: Boom[] = [];
  walls: Wall[] = [];
  dams: Dam[] = [];
  poisonClouds: PoisonCloud[] = [];
  gold = 20;
  stars = 5;
  wave = 1;
  cookieHp = 55;
  cookieMax = 55;
  cookieBiteFlash = 0;
  /** Permanent bite marks left when thieves chomp the cookie */
  cookieBites: CookieBite[] = [];
  /** Index of the newest bite (for impact highlight) */
  cookieBitePulse = -1;
  spawnLeft = 0;
  spawnTimer = 0;
  /** Player must press Start Wave (or wait for auto-start) */
  waveWaiting = true;
  waveInProgress = false;
  /** Seconds until auto-start; 0 = wait for manual Start Wave */
  autoWaveTimer = 0;
  time = 0;
  running = true;
  paused = false;
  gameOver = false;
  toastTimer = 0;
  toastText = "";
  toastCooldown = 0;
  onChange: () => void = () => {};
  spellCool = { crumb: 0, frost: 0, zap: 0 };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    canvas.width = W;
    canvas.height = H;
    this.courseIndex = randomCourseIndex();
    this.difficulty = loadDifficultyPreference();
    this.applyStartingResources(false);
    this.applyMapForWave(1, false);
    this.load();
    this.syncMapForWave(false);
    this.grantIdleGold();
    this.canvas.style.touchAction = "none";
    this.canvas.addEventListener("pointerdown", (e) => this.onPointerDown(e));
    this.canvas.addEventListener("pointermove", (e) => this.onPointerMove(e));
    this.canvas.addEventListener("pointerup", (e) => this.onPointerUp(e));
    this.canvas.addEventListener("pointercancel", (e) => this.onPointerUp(e));
  }

  get difficultyLabel(): string {
    return difficultyTuning(this.difficulty).label;
  }

  /** Apply Easy/Hard starting gold, stars, and cookie HP */
  applyStartingResources(overwriteProgress: boolean) {
    const t = difficultyTuning(this.difficulty);
    if (overwriteProgress || this.wave <= 1) {
      this.gold = t.startGold;
      this.stars = t.startStars;
      this.cookieHp = t.cookieHp;
      this.cookieMax = t.cookieHp;
      if (overwriteProgress) {
        this.cookieBites = [];
        this.cookieBitePulse = -1;
        this.cookieBiteFlash = 0;
      }
    }
  }

  setDifficulty(d: Difficulty) {
    if (this.difficulty === d) return;
    this.difficulty = d;
    saveDifficultyPreference(d);
    // Fresh runs pick up new starting resources; mid-run keeps progress
    if (this.wave <= 1 && !this.waveInProgress && this.thieves.every((t) => !t.alive)) {
      this.applyStartingResources(true);
    }
    this.toast(`${difficultyTuning(d).label} mode`, true);
    this.save();
    this.onChange();
  }

  canvasPos(e: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  }

  occupiedPoints(ignoreSlotId?: number) {
    return this.slots
      .filter((s) => s.friend && s.id !== ignoreSlotId)
      .map((s) => ({ id: s.id, x: s.x, y: s.y }));
  }

  isValidPlace(x: number, y: number, ignoreSlotId?: number, footprint?: number) {
    return canPlaceAt(x, y, {
      ignoreSlotId,
      others: this.occupiedPoints(ignoreSlotId),
      footprint,
    });
  }

  footprintForSlot(slotId?: number | null): number | undefined {
    if (slotId == null) return undefined;
    const slot = this.slots.find((s) => s.id === slotId);
    return slot?.friend ? friendFootprintRadius(slot.friend.def) : undefined;
  }

  footprintForEquip(): number | undefined {
    if (this.selectedBag == null) return undefined;
    const f = this.bag[this.selectedBag];
    return f ? friendFootprintRadius(f) : undefined;
  }

  /** After evolve (or load), push oversized icons fully off the path */
  ensureOffPath(slot: Slot) {
    if (!slot.friend) return;
    const foot = friendFootprintRadius(slot.friend.def);
    if (this.isValidPlace(slot.x, slot.y, slot.id, foot)) return;

    const prog = nearestProgress(slot.x, slot.y);
    const p = pathPoint(prog);
    let dx = slot.x - p.x;
    let dy = slot.y - p.y;
    let len = Math.hypot(dx, dy);
    if (len < 1) {
      dx = 1;
      dy = 0;
      len = 1;
    }
    const ux = dx / len;
    const uy = dy / len;
    const need = pathClearanceFor(foot) + 4;
    for (let i = 0; i < 16; i++) {
      const dist = need + i * 8;
      for (const sign of [1, -1] as const) {
        const nx = p.x + ux * dist * sign;
        const ny = p.y + uy * dist * sign;
        if (this.isValidPlace(nx, ny, slot.id, foot)) {
          slot.x = nx;
          slot.y = ny;
          return;
        }
      }
      // Try perpendicular if along-normal is blocked
      const nx = p.x + -uy * dist;
      const ny = p.y + ux * dist;
      if (this.isValidPlace(nx, ny, slot.id, foot)) {
        slot.x = nx;
        slot.y = ny;
        return;
      }
    }
  }

  /** Larger pick radius on tablets / touch so fingers can grab units easily */
  friendHitRadius(e?: PointerEvent): number {
    if (e?.pointerType === "touch") return 56;
    if (typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches) return 52;
    return 36;
  }

  hitFriendSlot(x: number, y: number, radius = 36): Slot | null {
    let best: Slot | null = null;
    let bestD = radius;
    for (const slot of this.slots) {
      if (!slot.friend) continue;
      const d = Math.hypot(slot.x - x, slot.y - y);
      if (d <= bestD) {
        best = slot;
        bestD = d;
      }
    }
    return best;
  }

  slotById(id: number | null): Slot | null {
    if (id == null) return null;
    return this.slots.find((s) => s.id === id) ?? null;
  }

  /** Funny comic bubble when the player taps a friend */
  popFunnyBubble(slot: Slot) {
    const f = slot.friend;
    if (!f) return;
    // Don't stomp a mid-Freedom yell
    if (f.speech?.text === "Freedom!" && (f.speech.life ?? 0) > 1.2) return;
    f.speech = { text: funnyQuipFor(f.def), life: 2.5 };
  }

  /** Switch course layout; keep free-placed friends if still off the path */
  applyMapForWave(wave: number, announce: boolean) {
    const kept = this.slots.filter((s) => s.friend).map((s) => ({
      friend: s.friend!,
      x: s.x,
      y: s.y,
    }));
    const map = setActiveCourseMap(this.courseIndex, wave);
    this.mapTier = mapTierForWave(wave);
    this.slots = [];
    const overflow: FriendDef[] = [];
    for (const item of kept) {
      const f = item.friend;
      let x = item.x;
      let y = item.y;
      const foot = friendFootprintRadius(f.def);
      if (!this.isValidPlace(x, y, undefined, foot)) {
        // Nudge outward from the path a few times
        let placed = false;
        for (let a = 0; a < 12 && !placed; a++) {
          const ang = (a / 12) * Math.PI * 2;
          const nx = item.x + Math.cos(ang) * (pathClearanceFor(foot) + 8);
          const ny = item.y + Math.sin(ang) * (pathClearanceFor(foot) + 8);
          if (this.isValidPlace(nx, ny, undefined, foot)) {
            x = nx;
            y = ny;
            placed = true;
          }
        }
        if (!placed) {
          overflow.push(f.def);
          continue;
        }
      }
      const id = this.nextSlotId++;
      f.slotId = id;
      this.slots.push({ id, x, y, friend: f });
      this.ensureOffPath(this.slots[this.slots.length - 1]);
    }
    if (overflow.length) this.bag.push(...overflow);
    this.walls = [];
    this.dams = [];
    this.poisonClouds = [];
    this.shots = [];
    this.selectedSlot = null;
    this.draggingSlot = null;
    this.deployGhost = null;
    if (announce) {
      const hard = this.mapTier > 0 ? " (harder!)" : "";
      const roll = this.courseRandom ? " 🎲" : "";
      this.toast(`🗺️ Course: ${map.name}${hard}${roll}`, true);
    }
  }

  syncMapForWave(announce: boolean) {
    const next = mapTierForWave(this.wave);
    // Always ensure map is loaded; recreate when tier changes
    if (next !== this.mapTier) {
      const changed = this.mapTier !== next;
      if (changed && this.courseRandom) {
        this.courseIndex = randomCourseIndex(this.courseIndex);
      }
      this.applyMapForWave(this.wave, announce && changed);
    } else if (this.mapTier === 0 && this.wave === 1 && !this.slots.length) {
      // ensure active map lengths exist on fresh start
      setActiveCourseMap(this.courseIndex, this.wave);
    }
  }

  /** True when the player can switch courses (between waves) */
  canChangeCourse() {
    return (
      !this.gameOver &&
      this.waveWaiting &&
      !this.waveInProgress &&
      this.spawnLeft <= 0 &&
      this.thieves.every((t) => !t.alive)
    );
  }

  /** Pick a specific course theme (only between waves; home screen always allowed) */
  selectCourse(index: number, opts: { random?: boolean; announce?: boolean } = {}) {
    const courses = listCourses();
    if (!courses.length) return;
    const next = ((Math.floor(index) % courses.length) + courses.length) % courses.length;

    // Home / idle: always accept the pick so the chip can highlight.
    // Mid-wave on the play screen: block layout swap until the wave ends.
    if (this.running && this.slots.length > 0 && !this.canChangeCourse()) {
      this.toast("Finish the wave first", true);
      this.onChange();
      return;
    }

    const same = next === this.courseIndex && this.courseRandom === !!opts.random;
    this.courseRandom = !!opts.random;
    this.courseIndex = next;
    if (!same) this.applyMapForWave(this.wave, opts.announce !== false);
    else if (opts.announce !== false && opts.random) {
      this.toast(`🎲 Random courses on — ${courses[next].name}`, true);
    }
    this.save();
    this.onChange();
  }

  /** Jump to a different random course (only between waves) */
  randomizeCourse() {
    if (this.slots.length > 0 && !this.canChangeCourse()) {
      this.toast("Finish the wave first", true);
      return;
    }
    this.courseRandom = true;
    this.courseIndex = randomCourseIndex(this.courseIndex);
    this.applyMapForWave(this.wave, true);
    this.save();
    this.onChange();
  }

  /** Toggle pause — freezes thieves, shots, and wave spawning */
  togglePause() {
    if (this.gameOver) return;
    this.paused = !this.paused;
    this.toast(this.paused ? "Paused" : "Resumed", true);
    this.onChange();
  }

  setPaused(p: boolean) {
    if (p && this.gameOver) return;
    this.paused = p;
    this.onChange();
  }

  toast(msg: string, force = false) {
    if (!force && this.toastCooldown > 0) return;
    this.toastText = msg;
    this.toastTimer = 1.15;
    this.toastCooldown = 2.4;
  }

  /** Stable bite layout reconstructed from missing HP (legacy saves) */
  bitesFromMissingHp(missing: number): CookieBite[] {
    const n = Math.min(14, Math.max(0, Math.round(missing)));
    const bites: CookieBite[] = [];
    for (let i = 0; i < n; i++) {
      bites.push({
        angle: -Math.PI * 0.35 + i * 0.48 + (i % 3) * 0.07,
        size: 0.85 + (i % 4) * 0.12,
      });
    }
    return bites;
  }

  /** Leave one or more permanent bite marks when the cookie is hit */
  chompCookie(dmg: number) {
    const bites = Math.max(1, Math.min(4, Math.round(dmg)));
    for (let i = 0; i < bites; i++) {
      const idx = this.cookieBites.length;
      // Spread around the rim so each chomp is a distinct scoop
      const angle = -Math.PI * 0.85 + idx * 0.72 + (Math.random() - 0.5) * 0.15;
      const size = 1.15 + Math.min(0.5, dmg * 0.12) + (Math.random() - 0.5) * 0.1;
      this.cookieBites.push({ angle, size });
      this.cookieBitePulse = this.cookieBites.length - 1;
    }
    if (this.cookieBites.length > 14) {
      this.cookieBites = this.cookieBites.slice(-14);
      this.cookieBitePulse = this.cookieBites.length - 1;
    }
    this.cookieBiteFlash = 0.85;
  }

  grantIdleGold() {
    const last = Number(localStorage.getItem("cookie-guard-last") || Date.now());
    const now = Date.now();
    const secs = Math.min(60 * 60 * 8, Math.max(0, (now - last) / 1000));
    const earned = Math.floor(secs / 20);
    localStorage.setItem("cookie-guard-last", String(now));
    if (earned > 0) this.gold += earned;
  }

  save() {
    const data = {
      gold: this.gold,
      stars: this.stars,
      wave: this.wave,
      cookieHp: this.cookieHp,
      cookieMax: this.cookieMax,
      cookieBites: this.cookieBites,
      courseIndex: this.courseIndex,
      courseRandom: this.courseRandom,
      difficulty: this.difficulty,
      bag: this.bag.map((f) => f.id),
      slots: this.slots
        .filter((s) => s.friend)
        .map((s) => ({
          id: s.friend!.def.id,
          level: s.friend!.level,
          x: s.x,
          y: s.y,
          beaverPoints: s.friend!.beaverPoints ?? 0,
          eaglePoints: s.friend!.eaglePoints ?? 0,
        })),
      dams: this.dams.map((d) => ({
        x: d.x,
        y: d.y,
        progress: d.progress,
        hp: d.hp,
        maxHp: d.maxHp,
        ownerSlotId: d.ownerSlotId,
      })),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    localStorage.setItem("cookie-guard-last", String(Date.now()));
  }

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      this.gold = data.gold ?? 20;
      this.stars = data.stars ?? 5;
      this.wave = data.wave ?? 1;
      this.cookieHp = data.cookieHp ?? 55;
      this.cookieMax = data.cookieMax ?? 55;
      this.cookieBites = Array.isArray(data.cookieBites)
        ? data.cookieBites
            .filter(
              (b: CookieBite) =>
                b && typeof b.angle === "number" && typeof b.size === "number",
            )
            .slice(0, 16)
        : this.bitesFromMissingHp(this.cookieMax - this.cookieHp);
      if (typeof data.courseIndex === "number") this.courseIndex = data.courseIndex;
      if (typeof data.courseRandom === "boolean") this.courseRandom = data.courseRandom;
      if (isDifficulty(data.difficulty)) {
        this.difficulty = data.difficulty;
        saveDifficultyPreference(this.difficulty);
      }
      this.applyMapForWave(this.wave, false);
      this.bag = (data.bag || [])
        .map((id: string) => FRIENDS.find((f) => f.id === id))
        .filter(Boolean);
      this.slots = [];
      for (const slot of data.slots || []) {
        if (!slot) continue;
        const def = FRIENDS.find((f) => f.id === slot.id);
        if (!def) continue;
        const x = typeof slot.x === "number" ? slot.x : W / 2;
        const y = typeof slot.y === "number" ? slot.y : H / 2;
        const foot = friendFootprintRadius(def);
        if (!this.isValidPlace(x, y, undefined, foot)) {
          this.bag.push(def);
          continue;
        }
        const id = this.nextSlotId++;
        const placed: Slot = {
          id,
          x,
          y,
          friend: {
            uid: uid("f"),
            def,
            level: slot.level || 1,
            cooldown: 0,
            slotId: id,
            abilityTimer:
              def.ability === "foxWall" ? 30 : def.ability === "poisonFart" ? SKUNK_FART_INTERVAL * 0.5 : 0,
            orbitAngle: Math.random() * Math.PI * 2,
            beaverPoints: typeof slot.beaverPoints === "number" ? slot.beaverPoints : 0,
            eaglePoints: typeof slot.eaglePoints === "number" ? slot.eaglePoints : 0,
            dumplingTimer: isDumplingPanda(def) ? nextDumplingDelay() : undefined,
          },
        };
        this.slots.push(placed);
        this.ensureOffPath(placed);
      }
      this.dams = Array.isArray(data.dams)
        ? data.dams
            .filter((d: Dam) => d && typeof d.progress === "number" && d.hp > 0)
            .slice(0, MAX_DAMS)
            .map((d: Dam) => ({
              x: d.x,
              y: d.y,
              progress: d.progress,
              hp: d.hp,
              maxHp: d.maxHp || d.hp,
              ownerSlotId: d.ownerSlotId ?? -1,
            }))
        : [];
      // Always wait for Start Wave after loading a save
      this.waveWaiting = true;
      this.waveInProgress = false;
      this.autoWaveTimer = 0;
      this.spawnLeft = 0;
      this.thieves = [];
      this.shots = [];
    } catch {
      /* ignore */
    }
  }

  reset() {
    localStorage.removeItem(SAVE_KEY);
    this.slots = [];
    this.bag = [];
    this.selectedBag = null;
    this.selectedSlot = null;
    this.draggingSlot = null;
    this.deployGhost = null;
    this.thieves = [];
    this.shots = [];
    this.floats = [];
    this.booms = [];
    this.walls = [];
    this.dams = [];
    this.poisonClouds = [];
    this.wave = 1;
    this.applyStartingResources(true);
    this.cookieBiteFlash = 0;
    this.cookieBites = [];
    this.cookieBitePulse = -1;
    this.spawnLeft = 0;
    this.spawnTimer = 0;
    this.waveWaiting = true;
    this.waveInProgress = false;
    this.autoWaveTimer = 0;
    this.gameOver = false;
    this.running = true;
    this.paused = false;
    if (this.courseRandom) this.courseIndex = randomCourseIndex(this.courseIndex);
    this.applyMapForWave(1, false);
    this.onChange();
  }

  summon(lucky = false) {
    const cost = lucky ? 3 : SUMMON_COST;
    if (this.stars < cost) {
      this.toast("Need more stars", true);
      return;
    }
    this.stars -= cost;
    const friend = pickFriend(lucky);
    this.bag.unshift(friend);
    // Newly summoned friend is equipped immediately (front of bag)
    this.selectedBag = 0;
    this.selectedSlot = null;
    const tag =
      friend.rarity === "god"
        ? "GOD!"
        : friend.rarity === "legendary"
          ? "LEGENDARY!"
          : friend.name;
    this.toast(`${friend.emoji} ${tag} — tap grass to deploy`, true);
    this.save();
    this.onChange();
  }

  upgradeSelected() {
    const slot = this.slotById(this.selectedSlot);
    if (!slot?.friend) {
      this.toast("Tap a friend on the board first", true);
      return;
    }
    const cost = upgradeCost(slot.friend);
    if (this.gold < cost) {
      this.toast(`Need ${cost}🪙 (have ${this.gold}🪙)`, true);
      return;
    }
    this.gold -= cost;

    // Evolution roll on every upgrade (5% → evolved form for every animal)
    if (slot.friend.def.canEvolve) {
      const evolved = tryEvolve(slot.friend.def);
      if (evolved) {
        slot.friend.def = evolved;
        slot.friend.level = Math.max(1, slot.friend.level);
        slot.friend.abilityTimer =
          evolved.ability === "foxWall" ? 30 : evolved.ability === "poisonFart" ? SKUNK_FART_INTERVAL * 0.5 : 0;
        if (isDumplingPanda(slot.friend)) {
          slot.friend.dumplingTimer = nextDumplingDelay() * 0.4;
        }
        // Keep evolved icons off the path — never let a bigger form cover the trail
        this.ensureOffPath(slot);
        this.toast(
          evolved.id === "giantpanda"
            ? `${evolved.emoji} MEGA GIANT PANDA!!!`
            : `${evolved.emoji} MYTHICAL! ${evolved.name}!!!`,
          true,
        );
        this.booms.push({
          kind: "beam",
          x: slot.x,
          y: slot.y,
          life: evolved.id === "giantpanda" ? 1.4 : 1.2,
          radius: evolved.id === "giantpanda" ? 55 : 50,
        });
        this.save();
        this.onChange();
        return;
      }
    }

    slot.friend.level += 1;
    this.toast(`Level ${slot.friend.level}!`, true);
    this.save();
    this.onChange();
  }

  sellSelected() {
    const slot = this.slotById(this.selectedSlot);
    if (!slot?.friend) return;
    this.bag.push(slot.friend.def);
    this.gold += Math.max(1, Math.floor(upgradeCost(slot.friend) * 0.35));
    this.slots = this.slots.filter((s) => s.id !== slot.id);
    this.selectedSlot = null;
    this.save();
    this.onChange();
  }

  /** Pull every placed friend back into the bag */
  clearBoard() {
    let n = 0;
    for (const slot of this.slots) {
      if (!slot.friend) continue;
      this.bag.push(slot.friend.def);
      n += 1;
    }
    this.slots = [];
    this.selectedSlot = null;
    if (!n) {
      this.toast("Board is already empty", true);
      return;
    }
    this.toast(`Cleared ${n} friend${n === 1 ? "" : "s"} to bag`, true);
    this.save();
    this.onChange();
  }

  /** Move every board friend except the selected one back into the bag */
  clearUnselected() {
    const keep = this.slotById(this.selectedSlot);
    if (!keep?.friend) {
      this.toast("Select a friend to keep first", true);
      return;
    }
    let n = 0;
    for (const slot of this.slots) {
      if (slot.id === keep.id || !slot.friend) continue;
      this.bag.push(slot.friend.def);
      n += 1;
    }
    this.slots = this.slots.filter((s) => s.id === keep.id);
    this.selectedSlot = keep.id;
    if (!n) {
      this.toast("No other friends on the board", true);
      return;
    }
    this.toast(`Cleared ${n} other friend${n === 1 ? "" : "s"} to bag`, true);
    this.save();
    this.onChange();
  }

  /** Permanently remove every unused (bag-only) friend */
  clearBag() {
    const n = this.bag.length;
    if (!n) {
      this.toast("No unused friends in the bag", true);
      return;
    }
    this.bag = [];
    this.selectedBag = null;
    this.deployGhost = null;
    this.toast(`Removed ${n} unused friend${n === 1 ? "" : "s"}`, true);
    this.save();
    this.onChange();
  }

  /** Permanently remove selected bag unit or selected board unit */
  deleteSelected() {
    if (this.selectedBag != null) {
      const f = this.bag[this.selectedBag];
      if (!f) return;
      this.bag.splice(this.selectedBag, 1);
      this.selectedBag = null;
      this.toast(`Deleted ${f.emoji} ${f.name}`, true);
      this.save();
      this.onChange();
      return;
    }
    const slot = this.slotById(this.selectedSlot);
    if (slot?.friend) {
      const name = `${slot.friend.def.emoji} ${slot.friend.def.name}`;
      this.slots = this.slots.filter((s) => s.id !== slot.id);
      this.selectedSlot = null;
      this.toast(`Deleted ${name}`, true);
      this.save();
      this.onChange();
      return;
    }
    this.toast("Pick a friend in the bag or on the board first", true);
  }

  cast(kind: "crumb" | "frost" | "zap") {
    const costs = { crumb: 5, frost: 4, zap: 6 };
    if (this.spellCool[kind] > 0) return;
    if (this.gold < costs[kind]) {
      this.toast("Need more gold", true);
      return;
    }
    this.gold -= costs[kind];
    this.spellCool[kind] = kind === "zap" ? 10 : kind === "crumb" ? 8 : 7;

    let tx = COOKIE.x - 80;
    let ty = COOKIE.y;
    const alive = this.thieves.filter((t) => t.alive);
    if (alive.length) {
      const mid = alive[Math.floor(alive.length / 2)];
      const p = pathPoint(mid.progress);
      tx = p.x;
      ty = p.y;
    }

    if (kind === "crumb") {
      this.booms.push({ kind: "crumb", x: tx, y: ty, life: 1, radius: 90 });
      for (const t of this.thieves) {
        if (!t.alive) continue;
        const p = pathPoint(t.progress);
        if (Math.hypot(p.x - tx, p.y - ty) < 95) this.hurt(t, 40, p.x, p.y);
      }
    } else if (kind === "frost") {
      this.booms.push({ kind: "frost", x: tx, y: ty, life: 1, radius: 110 });
      for (const t of this.thieves) {
        if (!t.alive) continue;
        const p = pathPoint(t.progress);
        if (Math.hypot(p.x - tx, p.y - ty) < 115) {
          t.slowTimer = 3.5;
          this.hurt(t, 10, p.x, p.y);
        }
      }
    } else {
      this.booms.push({ kind: "zap", x: tx, y: ty, life: 1, radius: 70 });
      for (const t of alive.slice(0, 4)) {
        const p = pathPoint(t.progress);
        this.hurt(t, 55, p.x, p.y);
        this.booms.push({ kind: "zap", x: p.x, y: p.y, life: 0.8, radius: 30 });
      }
    }
    playSpell(kind);
    this.onChange();
  }

  onPointerDown(e: PointerEvent) {
    if (this.gameOver) return;
    const { x, y } = this.canvasPos(e);
    this.canvas.setPointerCapture(e.pointerId);

    const hit = this.hitFriendSlot(x, y, this.friendHitRadius(e));
    if (hit && this.selectedBag == null) {
      this.draggingSlot = hit.id;
      this.dragMoved = false;
      this.dragOrigin = { x: hit.x, y: hit.y };
      this.selectedSlot = hit.id;
      this.popFunnyBubble(hit);
      this.onChange();
      return;
    }

    if (this.selectedBag != null) {
      const foot = this.footprintForEquip();
      if (this.isValidPlace(x, y, undefined, foot)) {
        this.deployAt(x, y);
      } else {
        this.toast("Place on grass — not on the path!", true);
        this.onChange();
      }
      return;
    }

    this.selectedSlot = null;
    this.onChange();
  }

  onPointerMove(e: PointerEvent) {
    const { x, y } = this.canvasPos(e);

    if (this.selectedBag != null && this.draggingSlot == null) {
      this.deployGhost = { x, y, valid: this.isValidPlace(x, y, undefined, this.footprintForEquip()) };
      this.paint();
      return;
    }

    if (this.draggingSlot == null) return;
    const slot = this.slots.find((s) => s.id === this.draggingSlot);
    if (!slot) return;
    const foot = this.footprintForSlot(slot.id);
    const dragSlop = e.pointerType === "touch" ? 10 : 6;
    if (this.dragOrigin && Math.hypot(x - this.dragOrigin.x, y - this.dragOrigin.y) > dragSlop) {
      this.dragMoved = true;
    }
    // Only move onto grass — never onto the path
    if (this.isValidPlace(x, y, slot.id, foot)) {
      slot.x = x;
      slot.y = y;
    }
    this.deployGhost = { x, y, valid: this.isValidPlace(x, y, slot.id, foot) };
    this.paint();
  }

  onPointerUp(e: PointerEvent) {
    try {
      this.canvas.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }

    if (this.draggingSlot != null) {
      const slot = this.slots.find((s) => s.id === this.draggingSlot);
      const foot = slot ? this.footprintForSlot(slot.id) : undefined;
      if (slot && (!this.isValidPlace(slot.x, slot.y, slot.id, foot) || (this.dragOrigin && !this.dragMoved))) {
        // Snap back if ended on path / invalid, or treat as a click-select
        if (this.dragOrigin && !this.isValidPlace(slot.x, slot.y, slot.id, foot)) {
          slot.x = this.dragOrigin.x;
          slot.y = this.dragOrigin.y;
          this.toast("Can't place on the path", true);
        }
      }
      if (slot && this.dragMoved && this.isValidPlace(slot.x, slot.y, slot.id, foot)) {
        this.toast(`${slot.friend?.def.emoji ?? ""} Moved!`, true);
        this.save();
      }
      this.draggingSlot = null;
      this.dragMoved = false;
      this.dragOrigin = null;
      if (this.selectedBag == null) this.deployGhost = null;
      this.onChange();
      return;
    }

    if (this.selectedBag == null) this.deployGhost = null;
  }

  deployAt(x: number, y: number) {
    if (this.selectedBag == null) return;
    const friend = this.bag[this.selectedBag];
    if (!friend) {
      this.selectedBag = null;
      this.onChange();
      return;
    }
    const foot = friendFootprintRadius(friend);
    if (!this.isValidPlace(x, y, undefined, foot)) {
      this.toast("Can't place on the path — tap the grass", true);
      this.onChange();
      return;
    }
    const id = this.nextSlotId++;
    this.slots.push({
      id,
      x,
      y,
      friend: {
        uid: uid("f"),
        def: friend,
        level: 1,
        cooldown: 0,
        slotId: id,
        abilityTimer:
          friend.ability === "foxWall" ? 2 : friend.ability === "poisonFart" ? SKUNK_FART_INTERVAL * 0.4 : 0,
        orbitAngle: Math.random() * Math.PI * 2,
        beaverPoints: 0,
        eaglePoints: 0,
        dumplingTimer: isDumplingPanda(friend) ? nextDumplingDelay() : undefined,
      },
    });
    this.bag.splice(this.selectedBag, 1);
    this.selectedBag = null;
    this.selectedSlot = id;
    this.deployGhost = null;
    this.toast(`${friend.emoji} Deployed! Drag to move anytime.`, true);
    this.save();
    this.onChange();
  }

  /** One tap in the bag equips a friend for free placement */
  equipFromBag(index: number) {
    if (index < 0 || index >= this.bag.length) return;
    this.selectedBag = index;
    this.selectedSlot = null;
    const f = this.bag[index];
    this.toast(`${f.emoji} Equipped — tap grass (not the path) to deploy`, true);
    this.onChange();
  }

  /** True when the Start Wave button should be enabled */
  canStartWave() {
    return (
      !this.gameOver &&
      this.waveWaiting &&
      !this.waveInProgress &&
      this.spawnLeft <= 0 &&
      this.thieves.every((t) => !t.alive)
    );
  }

  /** Player presses Start Wave */
  requestStartWave() {
    if (!this.canStartWave()) {
      if (this.waveInProgress || this.spawnLeft > 0 || this.thieves.some((t) => t.alive)) {
        this.toast("Wave already going!", true);
      }
      return;
    }
    this.paused = false;
    this.autoWaveTimer = 0;
    this.startWave();
    this.onChange();
  }

  startWave() {
    this.waveWaiting = false;
    this.waveInProgress = true;
    this.spawnLeft = scaleWaveCount(waveCount(this.wave), this.difficulty);
    this.spawnTimer = 0.2;
    this.autoWaveTimer = 0;
    // Only announce bosses — normal wave toasts cover the board on phones
    if (isLevelBossWave(this.wave)) {
      const boss = levelBossForWave(this.wave);
      const mode = difficultyTuning(this.difficulty).label;
      this.toast(`⚔️ ${boss.emoji} ${boss.name}! (${mode})`, true);
    }
  }

  spawnThief() {
    const base = thiefForWave(this.wave);
    const scale = waveHpScale(this.wave);
    const spd = waveSpeedScale(this.wave);
    const diff = difficultyTuning(this.difficulty);
    // Keep archetypes sharp after wave scaling: speed stays fragile, strength stays slow
    const hpMult = base.kind === "speed" ? 0.85 : base.kind === "strength" ? 1.12 : 1;
    const spdMult = base.kind === "speed" ? 1.08 : base.kind === "strength" ? 0.82 : 1;
    const def = {
      ...base,
      speed: Math.max(10, Math.round(base.speed * spd * spdMult * diff.speed)),
      gold: Math.max(1, Math.round(base.gold * diff.gold)),
    };
    const hp = Math.max(1, Math.round(def.hp * scale * hpMult * diff.hp));
    this.thieves.push({
      uid: uid("t"),
      def,
      hp,
      maxHp: hp,
      progress: 0,
      slowTimer: 0,
      freezeTimer: 0,
      blockedTimer: 0,
      poisonTimer: 0,
      poisonDps: 0,
      poisonAcc: 0,
      alive: true,
    });
  }

  hurt(
    t: Thief,
    dmg: number,
    x: number,
    y: number,
    floppy = false,
    chill = false,
    freeze = false,
    killerSlotId?: number,
  ) {
    t.hp -= dmg;
    this.floats.push({ x, y: y - 10, text: `-${dmg}`, color: freeze ? "#7ec8ff" : "#ff6b6b", life: 0.8 });
    if (freeze) {
      const dur = t.def.kind === "speed" ? 2.2 : 1.0;
      t.freezeTimer = Math.max(t.freezeTimer, dur);
      this.booms.push({ kind: "freeze", x, y, life: 0.55, radius: 32 });
    } else if (floppy) {
      t.slowTimer = Math.max(t.slowTimer, 1.8);
      this.booms.push({ kind: "floppy", x, y, life: 0.5, radius: 28 });
    } else if (chill) {
      t.slowTimer = Math.max(t.slowTimer, t.def.kind === "speed" ? 1.15 : 0.55);
    }
    if (t.hp <= 0) {
      t.alive = false;
      this.gold += t.def.gold;
      if (t.def.boss && isLevelBossWave(this.wave)) {
        this.stars += 5;
        this.gold += 25;
        this.toast(`🏆 ${t.def.name} defeated! Map clear!`, true);
        this.booms.push({ kind: "beam", x, y, life: 1.4, radius: 80 });
      } else if (Math.random() < 0.22) {
        this.stars += 1;
      }
      this.floats.push({ x, y: y - 24, text: `+${t.def.gold}🪙`, color: "#c4782a", life: 1 });
      this.creditBeaverKill(killerSlotId, t, x, y);
      this.creditEagleKill(killerSlotId, t, x, y);
    }
  }

  creditBeaverKill(killerSlotId: number | undefined, t: Thief, x: number, y: number) {
    if (killerSlotId == null) return;
    const slot = this.slots.find((s) => s.id === killerSlotId);
    if (!slot?.friend || !isBeaverBuilder(slot.friend)) return;
    const pts = beaverKillPoints(t.def);
    const before = slot.friend.beaverPoints ?? 0;
    slot.friend.beaverPoints = before + pts;
    this.floats.push({
      x,
      y: y - 38,
      text: `+${pts}🪵`,
      color: "#8a6040",
      life: 1,
    });
    if (before < BEAVER_DAM_COST && (slot.friend.beaverPoints ?? 0) >= BEAVER_DAM_COST) {
      this.toast(`🦫 Dam ready! Tap Build Dam (${BEAVER_DAM_COST}🪵)`, true);
    }
    this.onChange();
  }

  creditEagleKill(killerSlotId: number | undefined, t: Thief, x: number, y: number) {
    if (killerSlotId == null) return;
    const slot = this.slots.find((s) => s.id === killerSlotId);
    if (!slot?.friend || !isEagleBomber(slot.friend)) return;
    if (slot.friend.landed) return; // already bombing
    const pts = eagleKillPoints(t.def);
    const before = slot.friend.eaglePoints ?? 0;
    slot.friend.eaglePoints = before + pts;
    this.floats.push({
      x,
      y: y - 38,
      text: `+${pts}⭐`,
      color: "#d0a040",
      life: 1,
    });
    if (before < EAGLE_LAND_COST && (slot.friend.eaglePoints ?? 0) >= EAGLE_LAND_COST) {
      this.toast(`🦅 Land & Bomb ready! (${EAGLE_LAND_COST}⭐)`, true);
    }
    this.onChange();
  }

  selectedEagle(): Slot | null {
    const slot = this.slotById(this.selectedSlot);
    if (!slot?.friend || !isEagleBomber(slot.friend)) return null;
    return slot;
  }

  canEagleLand(): boolean {
    const slot = this.selectedEagle();
    if (!slot?.friend) return false;
    if (slot.friend.landed) return false;
    return (slot.friend.eaglePoints ?? 0) >= EAGLE_LAND_COST;
  }

  activateEagleLand() {
    const slot = this.selectedEagle();
    if (!slot?.friend) {
      this.toast("Select an eagle first", true);
      return;
    }
    if (slot.friend.landed) {
      this.toast("Already on a Freedom run!", true);
      return;
    }
    const points = slot.friend.eaglePoints ?? 0;
    if (points < EAGLE_LAND_COST) {
      this.toast(`Need ${EAGLE_LAND_COST}⭐ (have ${points})`, true);
      return;
    }
    slot.friend.eaglePoints = points - EAGLE_LAND_COST;
    slot.friend.landed = true;
    slot.friend.landTimer = EAGLE_LAND_DURATION;
    slot.friend.bombCooldown = 0.25;
    slot.friend.speech = { text: "Freedom!", life: 2.8 };
    this.booms.push({ kind: "bomb", x: slot.x, y: slot.y, life: 0.8, radius: 40 });
    this.toast(`🦅 ${slot.friend.def.name} lands — FREEDOM!`, true);
    this.save();
    this.onChange();
  }

  dropEagleBomb(slot: Slot) {
    const f = slot.friend;
    if (!f || !f.landed) return;
    const alive = this.thieves.filter((t) => t.alive);
    if (!alive.length) {
      // Still drop a bomb on the nearby path for flair
      const prog = Math.min(0.95, nearestProgress(slot.x, slot.y) + 0.04 + Math.random() * 0.08);
      const p = pathPoint(prog);
      this.shots.push({
        x: slot.x,
        y: slot.y - 6,
        tx: p.x,
        ty: p.y,
        speed: 340,
        damage: Math.round(friendDamage(f) * 1.8),
        color: "#4a4030",
        targetId: "",
        bomb: true,
        ownerSlotId: slot.id,
      });
      playShoot("heavy");
      return;
    }

    // Prefer closest threats, drop up to 2 bombs
    const scored = alive
      .map((t) => {
        const p = pathPoint(t.progress);
        return { t, p, d: Math.hypot(p.x - slot.x, p.y - slot.y) };
      })
      .sort((a, b) => a.d - b.d);
    const count = Math.min(2, scored.length);
    for (let i = 0; i < count; i++) {
      const { t, p } = scored[i];
      this.shots.push({
        x: slot.x + (i === 0 ? -6 : 6),
        y: slot.y - 8,
        tx: p.x,
        ty: p.y,
        speed: 300 + Math.random() * 50,
        damage: Math.round(friendDamage(f) * (f.def.id === "thunderroc" ? 2.2 : 1.9)),
        color: "#4a4030",
        targetId: t.uid,
        bomb: true,
        ownerSlotId: slot.id,
        weaponRole: weaponRoleFor(f.def),
      });
      playShoot("heavy");
    }
  }

  selectedBeaver(): Slot | null {
    const slot = this.slotById(this.selectedSlot);
    if (!slot?.friend || !isBeaverBuilder(slot.friend)) return null;
    return slot;
  }

  canBuildDam(): boolean {
    const slot = this.selectedBeaver();
    if (!slot?.friend) return false;
    if (this.dams.length >= MAX_DAMS) return false;
    return (slot.friend.beaverPoints ?? 0) >= BEAVER_DAM_COST;
  }

  buildBeaverDam() {
    const slot = this.selectedBeaver();
    if (!slot?.friend) {
      this.toast("Select a beaver first", true);
      return;
    }
    if (this.dams.length >= MAX_DAMS) {
      this.toast("Too many dams — wait for enemies to smash one", true);
      return;
    }
    const points = slot.friend.beaverPoints ?? 0;
    if (points < BEAVER_DAM_COST) {
      this.toast(`Need ${BEAVER_DAM_COST}🪵 (have ${points})`, true);
      return;
    }
    slot.friend.beaverPoints = points - BEAVER_DAM_COST;
    const prog = Math.min(0.92, nearestProgress(slot.x, slot.y) + 0.08);
    const p = pathPoint(prog);
    const maxHp = beaverDamMaxHp(slot.friend.level);
    this.dams.push({
      x: p.x,
      y: p.y,
      progress: prog,
      hp: maxHp,
      maxHp,
      ownerSlotId: slot.id,
    });
    this.booms.push({ kind: "dam", x: p.x, y: p.y, life: 0.9, radius: 44 });
    this.toast(`🦫 Dam built! Blocks the path`, true);
    this.save();
    this.onChange();
  }

  placeFoxWall(slotX: number, slotY: number) {
    // Place wall a bit ahead on the path near this fox
    const prog = Math.min(0.95, nearestProgress(slotX, slotY) + 0.06);
    const p = pathPoint(prog);
    this.walls.push({ x: p.x, y: p.y, life: 10, maxLife: 10, progress: prog });
    this.booms.push({ kind: "wall", x: p.x, y: p.y, life: 0.8, radius: 40 });
    playFoxWall();
  }

  /** Skunk lets one rip — lingering poison cloud on the path */
  skunkFart(slot: Slot) {
    const f = slot.friend;
    if (!f) return;
    const prog = Math.min(0.94, nearestProgress(slot.x, slot.y) + 0.05);
    const p = pathPoint(prog);
    // Aim a bit toward the densest nearby threat if any
    let x = p.x;
    let y = p.y;
    let best: Thief | null = null;
    let bestD = 140;
    for (const t of this.thieves) {
      if (!t.alive) continue;
      const tp = pathPoint(t.progress);
      const d = Math.hypot(tp.x - slot.x, tp.y - slot.y);
      if (d < bestD) {
        best = t;
        bestD = d;
      }
    }
    if (best) {
      const tp = pathPoint(best.progress);
      x = tp.x;
      y = tp.y;
    }
    const radius = f.def.id === "stinklord" ? 78 : 62;
    const dps = Math.round(friendDamage(f) * (f.def.id === "stinklord" ? 0.85 : 0.65));
    const life = f.def.id === "stinklord" ? 5.5 : 4.2;
    this.poisonClouds.push({
      x,
      y,
      radius,
      life,
      maxLife: life,
      dps: Math.max(4, dps),
      ownerSlotId: slot.id,
    });
    this.booms.push({ kind: "fart", x, y, life: 0.85, radius: radius * 0.7 });
    f.speech = { text: Math.random() < 0.5 ? "Phew!" : "Toot!", life: 1.6 };
    this.floats.push({ x, y: y - 20, text: "💨", color: "#5a8060", life: 0.9 });
    playPoisonFart();
    if (Math.random() < 0.35) this.toast(`${f.def.emoji} Toxic cloud!`, true);
  }

  /** Kung Fu Panda style — randomly hurl dumplings at thieves */
  throwDumplings(slot: Slot) {
    const f = slot.friend;
    if (!f || !isDumplingPanda(f)) return;
    const alive = this.thieves.filter((t) => t.alive);
    if (!alive.length) return;

    // Prefer thieves in range; fall back to any on the board
    const range = friendRange(f) * 1.15;
    let targets = alive.filter((t) => {
      const p = pathPoint(t.progress);
      return Math.hypot(p.x - slot.x, p.y - slot.y) <= range;
    });
    if (!targets.length) targets = alive;

    // Shuffle and take up to 3
    for (let i = targets.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [targets[i], targets[j]] = [targets[j], targets[i]];
    }
    const count = Math.min(3, targets.length);
    const baseDmg = Math.round(friendDamage(f) * (f.def.id === "redpanda" ? 1.35 : 1.15));

    for (let i = 0; i < count; i++) {
      const t = targets[i];
      const p = pathPoint(t.progress);
      // Slight aim scatter like a cartoon toss
      const scatter = 12 + Math.random() * 18;
      const ang = Math.random() * Math.PI * 2;
      this.shots.push({
        x: slot.x,
        y: slot.y - 8,
        tx: p.x + Math.cos(ang) * scatter * 0.25,
        ty: p.y + Math.sin(ang) * scatter * 0.25,
        speed: 260 + Math.random() * 60,
        damage: baseDmg,
        color: "#f5d6a8",
        targetId: t.uid,
        dumpling: true,
        ownerSlotId: slot.id,
        weaponRole: weaponRoleFor(f.def),
      });
      playShoot("dumpling");
    }

    this.booms.push({ kind: "dumpling", x: slot.x, y: slot.y - 10, life: 0.7, radius: 34 });
    this.floats.push({
      x: slot.x,
      y: slot.y - 36,
      text: Math.random() < 0.35 ? "Skadoosh!" : "🥟 Dumpling!",
      color: "#c4782a",
      life: 1.1,
    });
    if (Math.random() < 0.4) {
      this.toast(`${f.def.emoji} Dumpling volley!`, true);
    }
  }

  update(dt: number) {
    this.time += dt;
    if (this.toastTimer > 0) this.toastTimer -= dt;
    if (this.toastCooldown > 0) this.toastCooldown -= dt;
    if (this.cookieBiteFlash > 0) this.cookieBiteFlash -= dt;
    for (const k of Object.keys(this.spellCool) as (keyof typeof this.spellCool)[]) {
      if (this.spellCool[k] > 0) this.spellCool[k] -= dt;
    }
    if (!this.running || this.gameOver || this.paused) {
      this.paint();
      return;
    }

    if (this.waveWaiting) {
      // Auto-start next wave unless the player paused (timer freezes while paused)
      if (this.autoWaveTimer > 0) {
        this.autoWaveTimer -= dt;
        if (this.autoWaveTimer <= 0) {
          this.autoWaveTimer = 0;
          this.startWave();
          this.onChange();
        }
      }
    } else if (this.spawnLeft > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnThief();
        this.spawnLeft -= 1;
        this.spawnTimer = Math.max(
          0.28,
          (1.1 - this.wave * 0.03) * difficultyTuning(this.difficulty).spawnPace,
        );
      }
    } else if (this.waveInProgress && this.thieves.every((t) => !t.alive)) {
      this.thieves = [];
      this.waveInProgress = false;
      this.waveWaiting = true;
      this.wave += 1;
      this.stars += 1;
      this.gold += 3;
      this.syncMapForWave(true);
      this.autoWaveTimer = 3.2;
      // Canvas banner already shows the countdown — skip a covering toast
      this.save();
      this.onChange();
    }

    // Fox walls tick
    for (const slot of this.slots) {
      const f = slot.friend;
      if (!f || f.def.ability !== "foxWall") continue;
      f.abilityTimer -= dt;
      if (f.abilityTimer <= 0) {
        this.placeFoxWall(slot.x, slot.y);
        f.abilityTimer = 30;
      }
    }

    // Skunk poison farts
    for (const slot of this.slots) {
      const f = slot.friend;
      if (!f || f.def.ability !== "poisonFart") continue;
      f.abilityTimer -= dt;
      if (f.abilityTimer <= 0) {
        this.skunkFart(slot);
        f.abilityTimer = SKUNK_FART_INTERVAL;
      }
    }

    // Poison clouds linger + apply DoT
    for (const cloud of this.poisonClouds) cloud.life -= dt;
    this.poisonClouds = this.poisonClouds.filter((c) => c.life > 0);
    for (const cloud of this.poisonClouds) {
      for (const t of this.thieves) {
        if (!t.alive) continue;
        const p = pathPoint(t.progress);
        if (Math.hypot(p.x - cloud.x, p.y - cloud.y) <= cloud.radius) {
          t.poisonTimer = Math.max(t.poisonTimer, 2.4);
          t.poisonDps = Math.max(t.poisonDps, cloud.dps);
          t.poisonOwnerSlotId = cloud.ownerSlotId;
          t.slowTimer = Math.max(t.slowTimer, 0.35);
        }
      }
    }

    // Pandas randomly throw dumpling volleys (Kung Fu Panda style)
    for (const slot of this.slots) {
      const f = slot.friend;
      if (!f || !isDumplingPanda(f)) continue;
      if (f.dumplingTimer == null) f.dumplingTimer = nextDumplingDelay();
      f.dumplingTimer -= dt;
      if (f.dumplingTimer <= 0) {
        this.throwDumplings(slot);
        f.dumplingTimer = nextDumplingDelay();
      }
    }

    // Walls expire + block thieves
    for (const w of this.walls) w.life -= dt;
    this.walls = this.walls.filter((w) => w.life > 0);

    // Dams: hard-block path; thieves smash them
    const smashed: Dam[] = [];
    for (const t of this.thieves) {
      if (!t.alive) continue;
      if (t.slowTimer > 0) t.slowTimer -= dt;
      if (t.freezeTimer > 0) t.freezeTimer -= dt;
      if (t.blockedTimer > 0) t.blockedTimer -= dt;
      if (t.poisonTimer > 0) {
        t.poisonTimer -= dt;
        t.poisonAcc += dt;
        if (t.poisonAcc >= 0.4) {
          const tick = Math.max(1, Math.round(t.poisonDps * t.poisonAcc));
          t.poisonAcc = 0;
          const p = pathPoint(t.progress);
          this.hurt(t, tick, p.x, p.y, false, false, false, t.poisonOwnerSlotId);
        }
        if (t.poisonTimer <= 0) {
          t.poisonDps = 0;
          t.poisonAcc = 0;
          t.poisonOwnerSlotId = undefined;
        }
      }

      // hit a fox wall?
      for (const w of this.walls) {
        if (Math.abs(t.progress - w.progress) < 0.025) {
          t.blockedTimer = Math.max(t.blockedTimer, 0.35);
        }
      }

      // Beaver dam — stop and chew
      for (const dam of this.dams) {
        if (dam.hp <= 0) continue;
        const gate = dam.progress - 0.012;
        if (t.progress >= gate) {
          t.progress = Math.min(t.progress, gate);
          t.blockedTimer = Math.max(t.blockedTimer, 0.25);
          const dps =
            t.def.boss ? 22 : t.def.kind === "strength" ? 14 : 7;
          dam.hp -= dps * dt;
          if (dam.hp <= 0) {
            dam.hp = 0;
            smashed.push(dam);
          }
        }
      }

      const frozen = t.freezeTimer > 0;
      const slow = frozen ? 0.1 : t.slowTimer > 0 ? 0.45 : 1;
      const block = t.blockedTimer > 0 ? 0.15 : 1;
      // Don't advance into a dam
      let next = t.progress + ((t.def.speed * slow * block) / 900) * dt;
      for (const dam of this.dams) {
        if (dam.hp <= 0) continue;
        const gate = dam.progress - 0.012;
        if (t.progress < gate && next > gate) next = gate;
      }
      t.progress = next;
      if (t.progress >= 1) {
        t.alive = false;
        const baseDmg = t.def.boss ? (isLevelBossWave(this.wave) ? 8 : 4) : 1;
        const dmg = Math.max(1, Math.round(baseDmg * difficultyTuning(this.difficulty).cookieDmg));
        this.cookieHp -= dmg;
        this.chompCookie(dmg);
        playCookieMunch(dmg > 1);
        const bite = this.cookieBites[this.cookieBitePulse];
        const biteX = bite
          ? COOKIE.x + Math.cos(bite.angle) * 38
          : COOKIE.x;
        const biteY = bite
          ? COOKIE.y + Math.sin(bite.angle) * 38
          : COOKIE.y;
        this.booms.push({
          kind: "crumb",
          x: biteX,
          y: biteY,
          life: 0.85,
          radius: 36 + dmg * 6,
        });
        this.booms.push({
          kind: "crumb",
          x: COOKIE.x,
          y: COOKIE.y,
          life: 0.55,
          radius: 28 + dmg * 3,
        });
        this.floats.push({
          x: biteX,
          y: biteY - 28,
          text: dmg > 1 ? "CHOMP!!" : "NOM!",
          color: "#c4782a",
          life: 1.1,
        });
        this.onChange();
        if (this.cookieHp <= 0) {
          this.cookieHp = 0;
          this.gameOver = true;
          this.running = false;
          this.onChange();
        }
      }
    }
    if (smashed.length) {
      for (const dam of smashed) {
        this.booms.push({ kind: "dam", x: dam.x, y: dam.y, life: 0.7, radius: 36 });
        this.floats.push({ x: dam.x, y: dam.y - 16, text: "Dam smashed!", color: "#8a6040", life: 1.1 });
      }
      this.dams = this.dams.filter((d) => d.hp > 0);
      this.toast("🪵 Dam destroyed!", true);
      this.onChange();
    } else {
      this.dams = this.dams.filter((d) => d.hp > 0);
    }

    // Friends shoot
    for (const slot of this.slots) {
      const f = slot.friend;
      if (!f) continue;

      // Birds fly in a circle around their nest (unless landed for Freedom bombs)
      if (f.def.flies && !f.landed) {
        f.orbitAngle += flyerOrbitSpeed(f) * dt;
      }

      // Eagle land-and-bomb Freedom run
      if (f.landed) {
        if (f.speech && f.speech.life > 0) f.speech.life -= dt;
        if (f.speech && f.speech.life <= 0) f.speech = undefined;
        f.landTimer = (f.landTimer ?? 0) - dt;
        f.bombCooldown = (f.bombCooldown ?? 0) - dt;
        if (f.bombCooldown <= 0) {
          this.dropEagleBomb(slot);
          f.bombCooldown = 0.75;
        }
        if ((f.landTimer ?? 0) <= 0) {
          f.landed = false;
          f.landTimer = 0;
          f.bombCooldown = 0;
          f.speech = undefined;
          this.toast(`🦅 ${f.def.name} takes off again!`, true);
          this.onChange();
        }
      } else if (f.speech && f.speech.life > 0) {
        f.speech.life -= dt;
        if (f.speech.life <= 0) f.speech = undefined;
      }

      f.cooldown -= dt;
      if (f.cooldown > 0) continue;

      const isFlyer = !!f.def.flies;
      const isLegend = f.def.rarity === "legendary" && !isFlyer;
      const maxBurst = 1;
      let burst = 0;
      const birdPos =
        isFlyer && !f.landed ? flyerWorldPos(slot.x, slot.y, f) : { x: slot.x, y: slot.y };

      while (f.cooldown <= 0 && burst < maxBurst) {
        const range = friendRange(f);
        // Flyers: hit anything inside the nest circle (pad center)
        const originX = isFlyer ? slot.x : slot.x;
        const originY = isFlyer ? slot.y : slot.y;
        const role = weaponRoleFor(f.def);
        let best: Thief | null = null;
        let bestScore = -Infinity;
        for (const t of this.thieves) {
          if (!t.alive) continue;
          const p = pathPoint(t.progress);
          const d = Math.hypot(p.x - originX, p.y - originY);
          if (d > range) continue;
          // Prefer matching counters; still fall back to nearest threat
          let score = -d;
          const kind = t.def.kind ?? "strength";
          if (role === "antiSpeed" && kind === "speed") score += 80;
          if (role === "antiStrength" && kind === "strength") score += 80;
          if (role === "antiSpeed" && kind === "strength") score -= 12;
          if (role === "antiStrength" && kind === "speed") score -= 12;
          // Prefer thieves closer to the cookie
          score += t.progress * 40;
          if (score > bestScore) {
            best = t;
            bestScore = score;
          }
        }
        if (!best) break;

        const p = pathPoint(best.progress);
        const kind = shootSoundFor(f.def);
        this.shots.push({
          x: birdPos.x,
          y: birdPos.y,
          tx: p.x,
          ty: p.y,
          speed: isFlyer ? 480 : isLegend ? 420 : f.def.ability === "godBeam" ? 420 : f.def.ability === "heavyHit" ? 280 : 320,
          damage: damageVsThief(f, best.def),
          color: f.def.color,
          targetId: best.uid,
          floppy: f.def.ability === "floppyFin",
          godBeam: f.def.ability === "godBeam",
          freeze: f.def.ability === "freeze",
          heavyHit: f.def.ability === "heavyHit",
          weaponRole: role,
          ownerSlotId: slot.id,
        });
        playShoot(kind);
        f.cooldown += 1 / f.def.attackSpeed;
        burst += 1;
      }
      if (burst === 0 && f.cooldown < 0) f.cooldown = 0;
    }

    for (const s of this.shots) {
      const dx = s.tx - s.x;
      const dy = s.ty - s.y;
      const d = Math.hypot(dx, dy) || 1;
      const step = s.speed * dt;
      if (step >= d) {
        const t = s.targetId
          ? this.thieves.find((x) => x.uid === s.targetId && x.alive)
          : undefined;
        if (t) {
          const p = pathPoint(t.progress);
          let dmg = s.damage;
          // Retarget role bonus if the thief kind changed mid-flight (shouldn't) — keep shot dmg
          if (s.godBeam) {
            dmg = Math.round(dmg * 1.4);
            this.booms.push({ kind: "beam", x: p.x, y: p.y, life: 0.6, radius: 40 });
            // splash nearby
            for (const other of this.thieves) {
              if (!other.alive || other.uid === t.uid) continue;
              const op = pathPoint(other.progress);
              if (Math.hypot(op.x - p.x, op.y - p.y) < 55) {
                this.hurt(other, Math.round(dmg * 0.45), op.x, op.y, false, false, false, s.ownerSlotId);
              }
            }
          }
          if (s.heavyHit) {
            dmg = Math.round(dmg * (t.def.kind === "strength" ? 1.25 : 1.05));
            this.booms.push({ kind: "heavy", x: p.x, y: p.y, life: 0.45, radius: 36 });
          }
          if (s.dumpling) {
            dmg = Math.round(dmg * 1.2);
            this.booms.push({ kind: "dumpling", x: p.x, y: p.y, life: 0.65, radius: 48 });
            this.floats.push({ x: p.x, y: p.y - 18, text: "🥟", color: "#c4782a", life: 0.7 });
            // Splash — dumplings go everywhere
            for (const other of this.thieves) {
              if (!other.alive || other.uid === t.uid) continue;
              const op = pathPoint(other.progress);
              if (Math.hypot(op.x - p.x, op.y - p.y) < 70) {
                this.hurt(other, Math.round(dmg * 0.55), op.x, op.y, false, false, false, s.ownerSlotId);
              }
            }
          }
          if (s.bomb) {
            dmg = Math.round(dmg * 1.15);
            this.booms.push({ kind: "bomb", x: p.x, y: p.y, life: 0.75, radius: 58 });
            this.floats.push({ x: p.x, y: p.y - 20, text: "💥", color: "#e07030", life: 0.75 });
            for (const other of this.thieves) {
              if (!other.alive || other.uid === t.uid) continue;
              const op = pathPoint(other.progress);
              if (Math.hypot(op.x - p.x, op.y - p.y) < 78) {
                this.hurt(other, Math.round(dmg * 0.6), op.x, op.y, false, false, false, s.ownerSlotId);
              }
            }
          }
          const chill = s.weaponRole === "antiSpeed" && !s.floppy && !s.freeze;
          this.hurt(t, dmg, p.x, p.y, !!s.floppy, chill, !!s.freeze, s.ownerSlotId);
          playHit();
        } else if (s.bomb) {
          // Path bomb with no live target — still explode at aim point
          this.booms.push({ kind: "bomb", x: s.tx, y: s.ty, life: 0.75, radius: 58 });
          for (const other of this.thieves) {
            if (!other.alive) continue;
            const op = pathPoint(other.progress);
            if (Math.hypot(op.x - s.tx, op.y - s.ty) < 78) {
              this.hurt(other, Math.round(s.damage * 0.7), op.x, op.y, false, false, false, s.ownerSlotId);
            }
          }
          playHit();
        }
        s.speed = -1;
      } else {
        s.x += (dx / d) * step;
        s.y += (dy / d) * step;
        const t = this.thieves.find((x) => x.uid === s.targetId && x.alive);
        if (t) {
          const p = pathPoint(t.progress);
          s.tx = p.x;
          s.ty = p.y;
        }
      }
    }
    this.shots = this.shots.filter((s) => s.speed > 0);

    for (const f of this.floats) {
      f.life -= dt;
      f.y -= 28 * dt;
    }
    this.floats = this.floats.filter((f) => f.life > 0);
    for (const b of this.booms) b.life -= dt * 1.4;
    this.booms = this.booms.filter((b) => b.life > 0);

    this.paint();
  }

  paint() {
    // Never leave a placement ghost up when not equipping
    if (this.selectedBag == null) this.deployGhost = null;
    // Drop any empty pad leftovers so they can't render
    if (this.slots.some((s) => !s.friend)) {
      this.slots = this.slots.filter((s) => s.friend);
    }
    const thiefPos = new Map<string, { x: number; y: number }>();
    for (const t of this.thieves) {
      if (!t.alive) continue;
      thiefPos.set(t.uid, pathPoint(t.progress));
    }
    draw(this.ctx, {
      slots: this.slots,
      thieves: this.thieves,
      thiefPos,
      shots: this.shots,
      floats: this.floats,
      booms: this.booms,
      walls: this.walls,
      dams: this.dams,
      poisonClouds: this.poisonClouds,
      cookieHp: this.cookieHp,
      cookieMax: this.cookieMax,
      cookieBiteFlash: Math.max(0, this.cookieBiteFlash),
      cookieBites: this.cookieBites,
      cookieBitePulse: this.cookieBitePulse,
      selectedSlot: this.selectedSlot,
      time: this.time,
      wave: this.wave,
      difficulty: this.difficultyLabel,
      bossFight: isLevelBossWave(this.wave) && this.waveInProgress,
      deployMode: this.selectedBag != null,
      waveWaiting: this.waveWaiting,
      paused: this.paused,
      autoWaveTimer: this.autoWaveTimer,
      deployGhost: this.selectedBag != null ? this.deployGhost : null,
    });
    // Range ring only while a board friend is selected (not during bag deploy)
    if (this.selectedBag == null) {
      const selected = this.slotById(this.selectedSlot);
      if (selected?.friend) drawRangeHint(this.ctx, selected);
    }
  }
}
