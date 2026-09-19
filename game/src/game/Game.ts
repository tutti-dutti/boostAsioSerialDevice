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
  type FriendDef,
} from "./data";
import { COOKIE, W, H, pathPoint, nearestProgress, mapTierForWave, setActiveCourseMap, randomCourseIndex, listCourses, canPlaceAt } from "./path";
import { draw, drawRangeHint } from "./render";
import { playHit, playShoot, playSpell, playCookieMunch } from "./sound";
import {
  friendRange,
  flyerOrbitSpeed,
  flyerWorldPos,
  uid,
  upgradeCost,
  damageVsThief,
  type Boom,
  type FloatText,
  type Shot,
  type Slot,
  type Thief,
  type Wall,
} from "./types";

const SAVE_KEY = "cookie-guard-save-v2";

export class Game {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  slots: Slot[] = [];
  mapTier = 0;
  /** Which base course theme is active (Forest, River, …) */
  courseIndex = 0;
  /** When true, each new map tier picks a different random course */
  courseRandom = true;
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
  gold = 20;
  stars = 5;
  wave = 1;
  cookieHp = 55;
  cookieMax = 55;
  cookieBiteFlash = 0;
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

  isValidPlace(x: number, y: number, ignoreSlotId?: number) {
    return canPlaceAt(x, y, { ignoreSlotId, others: this.occupiedPoints(ignoreSlotId) });
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
      if (!this.isValidPlace(x, y)) {
        // Nudge outward from the path a few times
        let placed = false;
        for (let a = 0; a < 12 && !placed; a++) {
          const ang = (a / 12) * Math.PI * 2;
          const nx = item.x + Math.cos(ang) * 48;
          const ny = item.y + Math.sin(ang) * 48;
          if (this.isValidPlace(nx, ny)) {
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
    }
    if (overflow.length) this.bag.push(...overflow);
    this.walls = [];
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

  /** Pick a specific course theme (only between waves) */
  selectCourse(index: number, opts: { random?: boolean; announce?: boolean } = {}) {
    if (this.slots.length > 0 && !this.canChangeCourse()) {
      this.toast("Finish the wave first", true);
      return;
    }
    const courses = listCourses();
    if (!courses.length) return;
    const next = ((Math.floor(index) % courses.length) + courses.length) % courses.length;
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
    this.toastTimer = 1.6;
    this.toastCooldown = 3.5;
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
      courseIndex: this.courseIndex,
      courseRandom: this.courseRandom,
      bag: this.bag.map((f) => f.id),
      slots: this.slots
        .filter((s) => s.friend)
        .map((s) => ({
          id: s.friend!.def.id,
          level: s.friend!.level,
          x: s.x,
          y: s.y,
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
      if (typeof data.courseIndex === "number") this.courseIndex = data.courseIndex;
      if (typeof data.courseRandom === "boolean") this.courseRandom = data.courseRandom;
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
        if (!this.isValidPlace(x, y)) {
          this.bag.push(def);
          continue;
        }
        const id = this.nextSlotId++;
        this.slots.push({
          id,
          x,
          y,
          friend: {
            uid: uid("f"),
            def,
            level: slot.level || 1,
            cooldown: 0,
            slotId: id,
            abilityTimer: def.ability === "foxWall" ? 30 : 0,
            orbitAngle: Math.random() * Math.PI * 2,
          },
        });
      }
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
    this.gold = 20;
    this.stars = 5;
    this.wave = 1;
    this.cookieHp = 55;
    this.cookieMax = 55;
    this.cookieBiteFlash = 0;
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
    this.bag.push(friend);
    const tag =
      friend.rarity === "god"
        ? "GOD!"
        : friend.rarity === "legendary"
          ? "LEGENDARY!"
          : friend.name;
    this.toast(`${friend.emoji} ${tag}`, true);
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
      this.toast("Need more gold", true);
      return;
    }
    this.gold -= cost;

    // Evolution roll on every upgrade (50% → mythical form)
    if (slot.friend.def.canEvolve) {
      const evolved = tryEvolve(slot.friend.def);
      if (evolved) {
        slot.friend.def = evolved;
        slot.friend.level = Math.max(1, slot.friend.level);
        slot.friend.abilityTimer = evolved.ability === "foxWall" ? 30 : 0;
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
          life: evolved.id === "giantpanda" ? 1.6 : 1.2,
          radius: evolved.id === "giantpanda" ? 90 : 60,
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
      this.onChange();
      return;
    }

    if (this.selectedBag != null) {
      if (this.isValidPlace(x, y)) {
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
      this.deployGhost = { x, y, valid: this.isValidPlace(x, y) };
      this.paint();
      return;
    }

    if (this.draggingSlot == null) return;
    const slot = this.slots.find((s) => s.id === this.draggingSlot);
    if (!slot) return;
    const dragSlop = e.pointerType === "touch" ? 10 : 6;
    if (this.dragOrigin && Math.hypot(x - this.dragOrigin.x, y - this.dragOrigin.y) > dragSlop) {
      this.dragMoved = true;
    }
    // Only move onto grass — never onto the path
    if (this.isValidPlace(x, y, slot.id)) {
      slot.x = x;
      slot.y = y;
    }
    this.deployGhost = { x, y, valid: this.isValidPlace(x, y, slot.id) };
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
      if (slot && (!this.isValidPlace(slot.x, slot.y, slot.id) || (this.dragOrigin && !this.dragMoved))) {
        // Snap back if ended on path / invalid, or treat as a click-select
        if (this.dragOrigin && !this.isValidPlace(slot.x, slot.y, slot.id)) {
          slot.x = this.dragOrigin.x;
          slot.y = this.dragOrigin.y;
          this.toast("Can't place on the path", true);
        }
      }
      if (slot && this.dragMoved && this.isValidPlace(slot.x, slot.y, slot.id)) {
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
    if (!this.isValidPlace(x, y)) {
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
        abilityTimer: friend.ability === "foxWall" ? 2 : 0,
        orbitAngle: Math.random() * Math.PI * 2,
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
    this.spawnLeft = waveCount(this.wave);
    this.spawnTimer = 0.2;
    this.autoWaveTimer = 0;
    if (isLevelBossWave(this.wave)) {
      const boss = levelBossForWave(this.wave);
      this.toast(`⚔️ BOSS FIGHT! ${boss.emoji} ${boss.name}!`, true);
    } else {
      this.toast(`Wave ${this.wave} — go!`, true);
    }
  }

  spawnThief() {
    const base = thiefForWave(this.wave);
    const scale = waveHpScale(this.wave);
    const spd = waveSpeedScale(this.wave);
    // Keep archetypes sharp after wave scaling: speed stays fragile, strength stays slow
    const hpMult = base.kind === "speed" ? 0.85 : base.kind === "strength" ? 1.12 : 1;
    const spdMult = base.kind === "speed" ? 1.08 : base.kind === "strength" ? 0.82 : 1;
    const def = { ...base, speed: Math.max(10, Math.round(base.speed * spd * spdMult)) };
    const hp = Math.max(1, Math.round(def.hp * scale * hpMult));
    this.thieves.push({
      uid: uid("t"),
      def,
      hp,
      maxHp: hp,
      progress: 0,
      slowTimer: 0,
      freezeTimer: 0,
      blockedTimer: 0,
      alive: true,
    });
  }

  hurt(t: Thief, dmg: number, x: number, y: number, floppy = false, chill = false, freeze = false) {
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
    }
  }

  placeFoxWall(slotX: number, slotY: number) {
    // Place wall a bit ahead on the path near this fox
    const prog = Math.min(0.95, nearestProgress(slotX, slotY) + 0.06);
    const p = pathPoint(prog);
    this.walls.push({ x: p.x, y: p.y, life: 10, maxLife: 10, progress: prog });
    this.booms.push({ kind: "wall", x: p.x, y: p.y, life: 0.8, radius: 40 });
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
        this.spawnTimer = Math.max(0.45, 1.1 - this.wave * 0.03);
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
      this.toast(`Wave clear! Next wave in 3… (Pause to prepare)`, true);
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

    // Walls expire + block thieves
    for (const w of this.walls) w.life -= dt;
    this.walls = this.walls.filter((w) => w.life > 0);

    for (const t of this.thieves) {
      if (!t.alive) continue;
      if (t.slowTimer > 0) t.slowTimer -= dt;
      if (t.freezeTimer > 0) t.freezeTimer -= dt;
      if (t.blockedTimer > 0) t.blockedTimer -= dt;

      // hit a wall?
      for (const w of this.walls) {
        if (Math.abs(t.progress - w.progress) < 0.025) {
          t.blockedTimer = Math.max(t.blockedTimer, 0.35);
        }
      }

      const frozen = t.freezeTimer > 0;
      const slow = frozen ? 0.1 : t.slowTimer > 0 ? 0.45 : 1;
      const block = t.blockedTimer > 0 ? 0.15 : 1;
      t.progress += ((t.def.speed * slow * block) / 900) * dt;
      if (t.progress >= 1) {
        t.alive = false;
        const dmg = t.def.boss ? (isLevelBossWave(this.wave) ? 8 : 4) : 1;
        this.cookieHp -= dmg;
        this.cookieBiteFlash = 0.55;
        playCookieMunch(dmg > 1);
        this.booms.push({
          kind: "crumb",
          x: COOKIE.x,
          y: COOKIE.y,
          life: 0.7,
          radius: 40 + dmg * 4,
        });
        this.floats.push({
          x: COOKIE.x,
          y: COOKIE.y - 40,
          text: dmg > 1 ? "CHOMP!!" : "NOM!",
          color: "#c4782a",
          life: 1,
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

    // Friends shoot
    for (const slot of this.slots) {
      const f = slot.friend;
      if (!f) continue;

      // Birds fly in a circle around their nest
      if (f.def.flies) {
        f.orbitAngle += flyerOrbitSpeed(f) * dt;
      }

      f.cooldown -= dt;
      if (f.cooldown > 0) continue;

      const isFlyer = !!f.def.flies;
      const isLegend = f.def.rarity === "legendary" && !isFlyer;
      const maxBurst = 1;
      let burst = 0;
      const birdPos = isFlyer ? flyerWorldPos(slot.x, slot.y, f) : { x: slot.x, y: slot.y };

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
        const kind = isFlyer
          ? "laser"
          : isLegend
            ? "minigun"
            : f.def.ability === "godBeam"
              ? "god"
              : f.def.ability === "floppyFin"
                ? "floppy"
                : f.def.ability === "freeze"
                  ? "freeze"
                  : f.def.ability === "heavyHit"
                    ? "heavy"
                    : "normal";
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
        const t = this.thieves.find((x) => x.uid === s.targetId && x.alive);
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
                this.hurt(other, Math.round(dmg * 0.45), op.x, op.y);
              }
            }
          }
          if (s.heavyHit) {
            dmg = Math.round(dmg * (t.def.kind === "strength" ? 1.25 : 1.05));
            this.booms.push({ kind: "heavy", x: p.x, y: p.y, life: 0.45, radius: 36 });
          }
          const chill = s.weaponRole === "antiSpeed" && !s.floppy && !s.freeze;
          this.hurt(t, dmg, p.x, p.y, !!s.floppy, chill, !!s.freeze);
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
      cookieHp: this.cookieHp,
      cookieMax: this.cookieMax,
      cookieBiteFlash: Math.max(0, this.cookieBiteFlash),
      selectedSlot: this.selectedSlot,
      time: this.time,
      wave: this.wave,
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
