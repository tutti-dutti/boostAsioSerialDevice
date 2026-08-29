import {
  FRIENDS,
  SUMMON_COST,
  pickFriend,
  thiefForWave,
  waveCount,
  waveHpScale,
  type FriendDef,
} from "./data";
import { COOKIE, SLOT_SPOTS, W, H, pathPoint } from "./path";
import { draw, drawRangeHint } from "./render";
import {
  friendDamage,
  friendRange,
  uid,
  upgradeCost,
  type Boom,
  type FloatText,
  type PlacedFriend,
  type Shot,
  type Slot,
  type Thief,
} from "./types";

const SAVE_KEY = "cookie-guard-save-v1";

export class Game {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  slots: Slot[] = SLOT_SPOTS.map((p, i) => ({ id: i, x: p.x, y: p.y, friend: null }));
  bag: FriendDef[] = [];
  selectedBag: number | null = null;
  selectedSlot: number | null = null;
  thieves: Thief[] = [];
  shots: Shot[] = [];
  floats: FloatText[] = [];
  booms: Boom[] = [];
  gold = 12;
  stars = 3;
  wave = 1;
  cookieHp = 20;
  cookieMax = 20;
  spawnLeft = 0;
  spawnTimer = 0;
  wavePause = 2;
  time = 0;
  running = true;
  gameOver = false;
  toastTimer = 0;
  toastText = "";
  onChange: () => void = () => {};
  spellCool = { crumb: 0, frost: 0, zap: 0 };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    canvas.width = W;
    canvas.height = H;
    this.load();
    this.grantIdleGold();
    this.canvas.addEventListener("pointerdown", (e) => this.onClick(e));
  }

  toast(msg: string) {
    this.toastText = msg;
    this.toastTimer = 2;
  }

  grantIdleGold() {
    const last = Number(localStorage.getItem("cookie-guard-last") || Date.now());
    const now = Date.now();
    const secs = Math.min(60 * 60 * 8, Math.max(0, (now - last) / 1000));
    const earned = Math.floor(secs / 20); // 1 gold / 20 sec idle
    localStorage.setItem("cookie-guard-last", String(now));
    if (earned > 0) {
      this.gold += earned;
      this.toast(`Welcome back! +${earned} gold while away`);
    }
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
      this.gold = data.gold ?? 12;
      this.stars = data.stars ?? 3;
      this.wave = data.wave ?? 1;
      this.cookieHp = data.cookieHp ?? 20;
      this.cookieMax = data.cookieMax ?? 20;
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
        };
      });
    } catch {
      /* ignore bad save */
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
    this.gold = 12;
    this.stars = 3;
    this.wave = 1;
    this.cookieHp = 20;
    this.cookieMax = 20;
    this.spawnLeft = 0;
    this.spawnTimer = 0;
    this.wavePause = 2;
    this.gameOver = false;
    this.running = true;
    this.toast("New game!");
    this.onChange();
  }

  summon(lucky = false) {
    const cost = lucky ? 3 : SUMMON_COST;
    if (this.stars < cost) {
      this.toast("Need more stars!");
      return;
    }
    this.stars -= cost;
    const friend = pickFriend(lucky);
    this.bag.push(friend);
    this.toast(`You got ${friend.emoji} ${friend.name}!`);
    this.save();
    this.onChange();
  }

  upgradeSelected() {
    if (this.selectedSlot == null) {
      this.toast("Tap a friend on the path first");
      return;
    }
    const slot = this.slots[this.selectedSlot];
    if (!slot.friend) return;
    const cost = upgradeCost(slot.friend);
    if (this.gold < cost) {
      this.toast("Need more gold!");
      return;
    }
    this.gold -= cost;
    slot.friend.level += 1;
    this.toast(`${slot.friend.def.name} is now level ${slot.friend.level}!`);
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
    this.toast("Friend went back to your bag");
    this.save();
    this.onChange();
  }

  cast(kind: "crumb" | "frost" | "zap") {
    const costs = { crumb: 5, frost: 4, zap: 6 };
    if (this.spellCool[kind] > 0) {
      this.toast("Spell not ready yet");
      return;
    }
    if (this.gold < costs[kind]) {
      this.toast("Need more gold!");
      return;
    }
    this.gold -= costs[kind];
    this.spellCool[kind] = kind === "zap" ? 10 : kind === "crumb" ? 8 : 7;

    // hit middle of path / densest area
    let tx = COOKIE.x - 120;
    let ty = COOKIE.y;
    if (this.thieves.length) {
      const alive = this.thieves.filter((t) => t.alive);
      if (alive.length) {
        const mid = alive[Math.floor(alive.length / 2)];
        const p = pathPoint(mid.progress);
        tx = p.x;
        ty = p.y;
      }
    }

    if (kind === "crumb") {
      this.booms.push({ kind: "crumb", x: tx, y: ty, life: 1, radius: 90 });
      for (const t of this.thieves) {
        if (!t.alive) continue;
        const p = pathPoint(t.progress);
        if (Math.hypot(p.x - tx, p.y - ty) < 95) this.hurt(t, 40, p.x, p.y);
      }
      this.toast("Cookie crumbs boom!");
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
      this.toast("Everyone got chilly!");
    } else {
      this.booms.push({ kind: "zap", x: tx, y: ty, life: 1, radius: 70 });
      const alive = this.thieves.filter((t) => t.alive).slice(0, 4);
      for (const t of alive) {
        const p = pathPoint(t.progress);
        this.hurt(t, 55, p.x, p.y);
        this.booms.push({ kind: "zap", x: p.x, y: p.y, life: 0.8, radius: 30 });
      }
      this.toast("Zap zap zap!");
    }
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
          };
          this.bag.splice(this.selectedBag, 1);
          this.selectedBag = null;
          this.selectedSlot = slot.id;
          this.toast(`${friend.emoji} ready to guard!`);
          this.save();
          this.onChange();
          return;
        }
        this.toast("Pick a friend from your bag first");
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
      alive: true,
    });
  }

  hurt(t: Thief, dmg: number, x: number, y: number) {
    t.hp -= dmg;
    this.floats.push({ x, y: y - 10, text: `-${dmg}`, color: "#ff6b6b", life: 0.8 });
    if (t.hp <= 0) {
      t.alive = false;
      this.gold += t.def.gold;
      if (Math.random() < 0.22) this.stars += 1;
      this.floats.push({ x, y: y - 24, text: `+${t.def.gold}🪙`, color: "#c4782a", life: 1 });
    }
  }

  update(dt: number) {
    this.time += dt;
    if (this.toastTimer > 0) this.toastTimer -= dt;
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
      this.wavePause = 2.5;
      this.toast(`Wave ${this.wave - 1} clear! +1⭐ +3🪙`);
      this.save();
      this.onChange();
    }

    // move thieves
    for (const t of this.thieves) {
      if (!t.alive) continue;
      if (t.slowTimer > 0) t.slowTimer -= dt;
      const slow = t.slowTimer > 0 ? 0.45 : 1;
      t.progress += ((t.def.speed * slow) / 900) * dt;
      if (t.progress >= 1) {
        t.alive = false;
        this.cookieHp -= t.def.boss ? 4 : 1;
        this.toast(t.def.boss ? "Oh no! King Raccoon bit the cookie!" : "A thief stole a bite!");
        this.onChange();
        if (this.cookieHp <= 0) {
          this.cookieHp = 0;
          this.gameOver = true;
          this.running = false;
          this.toast("The cookie is gone...");
          this.onChange();
        }
      }
    }

    // friends shoot
    for (const slot of this.slots) {
      const f = slot.friend;
      if (!f) continue;
      f.cooldown -= dt;
      if (f.cooldown > 0) continue;
      const range = friendRange(f);
      let best: Thief | null = null;
      let bestD = Infinity;
      for (const t of this.thieves) {
        if (!t.alive) continue;
        const p = pathPoint(t.progress);
        const d = Math.hypot(p.x - slot.x, p.y - slot.y);
        if (d <= range && d < bestD) {
          best = t;
          bestD = d;
        }
      }
      if (best) {
        const p = pathPoint(best.progress);
        this.shots.push({
          x: slot.x,
          y: slot.y,
          tx: p.x,
          ty: p.y,
          speed: 320,
          damage: friendDamage(f),
          color: f.def.color,
          targetId: best.uid,
        });
        f.cooldown = 1 / f.def.attackSpeed;
      }
    }

    // shots
    for (const s of this.shots) {
      const dx = s.tx - s.x;
      const dy = s.ty - s.y;
      const d = Math.hypot(dx, dy) || 1;
      const step = s.speed * dt;
      if (step >= d) {
        const t = this.thieves.find((x) => x.uid === s.targetId && x.alive);
        if (t) {
          const p = pathPoint(t.progress);
          this.hurt(t, s.damage, p.x, p.y);
        }
        s.speed = -1;
      } else {
        s.x += (dx / d) * step;
        s.y += (dy / d) * step;
        // lead a little toward live target
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
      cookieHp: this.cookieHp,
      cookieMax: this.cookieMax,
      selectedSlot: this.selectedSlot,
      time: this.time,
      wave: this.wave,
    });
    if (this.selectedSlot != null) {
      const slot = this.slots[this.selectedSlot];
      if (slot?.friend) drawRangeHint(this.ctx, slot);
    }
  }
}

export type { PlacedFriend };
