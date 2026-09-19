import {
  FRIENDS,
  SUMMON_COST,
  pickFriend,
  tryEvolve,
  thiefForWave,
  waveCount,
  waveHpScale,
  isLevelBossWave,
  levelBossForWave,
  type FriendDef,
} from "./data";
import { COOKIE, SLOT_SPOTS, W, H, pathPoint, nearestProgress, mapIndexForWave, setActiveMap } from "./path";
import { draw, drawRangeHint } from "./render";
import { playHit, playShoot, playSpell } from "./sound";
import {
  friendDamage,
  friendRange,
  flyerOrbitSpeed,
  flyerWorldPos,
  uid,
  upgradeCost,
  type Boom,
  type FloatText,
  type PlacedFriend,
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
  mapIndex = 0;
  bag: FriendDef[] = [];
  selectedBag: number | null = null;
  selectedSlot: number | null = null;
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
  spawnLeft = 0;
  spawnTimer = 0;
  wavePause = 2;
  time = 0;
  running = true;
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
    this.applyMap(0, false);
    this.load();
    this.syncMapForWave(false);
    this.grantIdleGold();
    this.canvas.addEventListener("pointerdown", (e) => this.onClick(e));
  }

  /** Rebuild pads for a map; optionally keep friends by slot index */
  applyMap(index: number, announce: boolean) {
    const prevFriends = this.slots.map((s) => s.friend);
    const map = setActiveMap(index);
    this.mapIndex = index;
    this.slots = SLOT_SPOTS.map((p, i) => ({
      id: i,
      x: p.x,
      y: p.y,
      friend: null as PlacedFriend | null,
    }));
    const overflow: FriendDef[] = [];
    for (let i = 0; i < prevFriends.length; i++) {
      const f = prevFriends[i];
      if (!f) continue;
      if (i < this.slots.length) {
        f.slotId = i;
        this.slots[i].friend = f;
      } else {
        overflow.push(f.def);
      }
    }
    if (overflow.length) this.bag.push(...overflow);
    this.walls = [];
    this.shots = [];
    this.selectedSlot = null;
    if (announce) {
      this.toast(`🗺️ New map: ${map.name}!`, true);
    }
  }

  syncMapForWave(announce: boolean) {
    const next = mapIndexForWave(this.wave);
    if (next !== this.mapIndex || this.slots.length === 0) {
      const changed = this.slots.length > 0 && next !== this.mapIndex;
      this.applyMap(next, announce && changed);
    }
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
      bag: this.bag.map((f) => f.id),
      slots: this.slots.map((s) =>
        s.friend ? { id: s.friend.def.id, level: s.friend.level } : null,
      ),
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
      this.bag = (data.bag || [])
        .map((id: string) => FRIENDS.find((f) => f.id === id))
        .filter(Boolean);
      (data.slots || []).forEach((slot: { id: string; level: number } | null, i: number) => {
        if (!slot || !this.slots[i]) return;
        const def = FRIENDS.find((f) => f.id === slot.id);
        if (!def) return;
        this.slots[i].friend = {
          uid: uid("f"),
          def,
          level: slot.level || 1,
          cooldown: 0,
          slotId: i,
          abilityTimer: def.ability === "foxWall" ? 30 : 0,
          orbitAngle: Math.random() * Math.PI * 2,
        };
      });
    } catch {
      /* ignore */
    }
  }

  reset() {
    localStorage.removeItem(SAVE_KEY);
    this.slots.forEach((s) => (s.friend = null));
    this.bag = [];
    this.selectedBag = null;
    this.selectedSlot = null;
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
    this.spawnLeft = 0;
    this.spawnTimer = 0;
    this.wavePause = 2;
    this.gameOver = false;
    this.running = true;
    this.syncMapForWave(false);
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
    if (this.selectedSlot == null) {
      this.toast("Tap a friend on the path first", true);
      return;
    }
    const slot = this.slots[this.selectedSlot];
    if (!slot.friend) return;
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
        this.toast(`${evolved.emoji} MYTHICAL! ${evolved.name}!!!`, true);
        this.booms.push({ kind: "beam", x: slot.x, y: slot.y, life: 1.2, radius: 60 });
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
    if (this.selectedSlot == null) return;
    const slot = this.slots[this.selectedSlot];
    if (!slot.friend) return;
    this.bag.push(slot.friend.def);
    this.gold += Math.max(1, Math.floor(upgradeCost(slot.friend) * 0.35));
    slot.friend = null;
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
      slot.friend = null;
      n += 1;
    }
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
    if (this.selectedSlot != null) {
      const slot = this.slots[this.selectedSlot];
      if (!slot?.friend) {
        this.toast("Pick a friend in the bag or on the board first", true);
        return;
      }
      const name = `${slot.friend.def.emoji} ${slot.friend.def.name}`;
      slot.friend = null;
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

  onClick(e: PointerEvent) {
    if (this.gameOver) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const y = ((e.clientY - rect.top) / rect.height) * H;

    for (const slot of this.slots) {
      if (Math.hypot(slot.x - x, slot.y - y) <= 28) {
        if (slot.friend) {
          this.selectedSlot = slot.id;
          this.selectedBag = null;
          this.onChange();
          return;
        }
        if (this.selectedBag != null) {
          const friend = this.bag[this.selectedBag];
          if (!friend) return;
          slot.friend = {
            uid: uid("f"),
            def: friend,
            level: 1,
            cooldown: 0,
            slotId: slot.id,
            abilityTimer: friend.ability === "foxWall" ? 2 : 0,
            orbitAngle: Math.random() * Math.PI * 2,
          };
          this.bag.splice(this.selectedBag, 1);
          this.selectedBag = null;
          this.selectedSlot = slot.id;
          this.save();
          this.onChange();
          return;
        }
        this.toast("Pick a friend from your bag first", true);
        this.onChange();
        return;
      }
    }
    this.selectedSlot = null;
    this.onChange();
  }

  startWave() {
    this.spawnLeft = waveCount(this.wave);
    this.spawnTimer = 0.2;
    this.wavePause = 0;
    if (isLevelBossWave(this.wave)) {
      const boss = levelBossForWave(this.wave);
      this.toast(`⚔️ BOSS FIGHT! ${boss.emoji} ${boss.name}!`, true);
    }
  }

  spawnThief() {
    const def = thiefForWave(this.wave);
    const scale = waveHpScale(this.wave);
    const hp = Math.round(def.hp * scale);
    this.thieves.push({
      uid: uid("t"),
      def,
      hp,
      maxHp: hp,
      progress: 0,
      slowTimer: 0,
      blockedTimer: 0,
      alive: true,
    });
  }

  hurt(t: Thief, dmg: number, x: number, y: number, floppy = false) {
    t.hp -= dmg;
    this.floats.push({ x, y: y - 10, text: `-${dmg}`, color: "#ff6b6b", life: 0.8 });
    if (floppy) {
      t.slowTimer = Math.max(t.slowTimer, 1.8);
      this.booms.push({ kind: "floppy", x, y, life: 0.5, radius: 28 });
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
    for (const k of Object.keys(this.spellCool) as (keyof typeof this.spellCool)[]) {
      if (this.spellCool[k] > 0) this.spellCool[k] -= dt;
    }
    if (!this.running || this.gameOver) {
      this.paint();
      return;
    }

    if (this.wavePause > 0) {
      this.wavePause -= dt;
      if (this.wavePause <= 0) this.startWave();
    } else if (this.spawnLeft > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnThief();
        this.spawnLeft -= 1;
        this.spawnTimer = Math.max(0.45, 1.1 - this.wave * 0.03);
      }
    } else if (this.thieves.every((t) => !t.alive)) {
      this.thieves = [];
      this.wave += 1;
      this.stars += 1;
      this.gold += 3;
      this.syncMapForWave(true);
      this.wavePause = 2.5;
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
      if (t.blockedTimer > 0) t.blockedTimer -= dt;

      // hit a wall?
      for (const w of this.walls) {
        if (Math.abs(t.progress - w.progress) < 0.025) {
          t.blockedTimer = Math.max(t.blockedTimer, 0.35);
        }
      }

      const slow = t.slowTimer > 0 ? 0.45 : 1;
      const block = t.blockedTimer > 0 ? 0.15 : 1;
      t.progress += ((t.def.speed * slow * block) / 900) * dt;
      if (t.progress >= 1) {
        t.alive = false;
        this.cookieHp -= t.def.boss ? (isLevelBossWave(this.wave) ? 8 : 4) : 1;
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
        let best: Thief | null = null;
        let bestD = Infinity;
        for (const t of this.thieves) {
          if (!t.alive) continue;
          const p = pathPoint(t.progress);
          const d = Math.hypot(p.x - originX, p.y - originY);
          if (d <= range && d < bestD) {
            best = t;
            bestD = d;
          }
        }
        if (!best) break;

        const p = pathPoint(best.progress);
        const kind = isFlyer
          ? "normal"
          : isLegend
            ? "normal"
            : f.def.ability === "godBeam"
              ? "god"
              : f.def.ability === "floppyFin"
                ? "floppy"
                : "normal";
        this.shots.push({
          x: birdPos.x,
          y: birdPos.y,
          tx: p.x,
          ty: p.y,
          speed: isFlyer ? 480 : isLegend ? 420 : f.def.ability === "godBeam" ? 420 : 320,
          damage: friendDamage(f),
          color: f.def.color,
          targetId: best.uid,
          floppy: f.def.ability === "floppyFin",
          godBeam: f.def.ability === "godBeam",
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
          this.hurt(t, dmg, p.x, p.y, !!s.floppy);
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
      selectedSlot: this.selectedSlot,
      time: this.time,
      wave: this.wave,
      bossFight: isLevelBossWave(this.wave),
    });
    if (this.selectedSlot != null) {
      const slot = this.slots[this.selectedSlot];
      if (slot?.friend) drawRangeHint(this.ctx, slot);
    }
  }
}
