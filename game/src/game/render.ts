import { COOKIE, GATE, PATH, W, H, getActiveMap } from "./path";
import type { Boom, FloatText, PlacedFriend, Shot, Slot, Thief, Wall } from "./types";
import { flyerOrbitRadius, flyerWorldPos, friendRange } from "./types";

function grass(ctx: CanvasRenderingContext2D) {
  const map = getActiveMap();
  ctx.fillStyle = map.grassB;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = map.grassA;
  for (let y = 0; y < H; y += 28) {
    for (let x = 0; x < W; x += 28) {
      if ((x + y) % 56 === 0) ctx.fillRect(x, y, 28, 28);
    }
  }
  const g = ctx.createRadialGradient(W / 2, H / 2, 120, W / 2, H / 2, 520);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(20,40,20,0.18)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function path(ctx: CanvasRenderingContext2D) {
  const map = getActiveMap();
  ctx.strokeStyle = map.pathColor;
  ctx.lineWidth = 44;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(PATH[0].x, PATH[0].y);
  for (let i = 1; i < PATH.length; i++) ctx.lineTo(PATH[i].x, PATH[i].y);
  ctx.stroke();
  ctx.strokeStyle = "#d8b878";
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 30;
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.fillStyle = "rgba(90,60,20,0.25)";
  for (let i = 0; i < PATH.length; i++) {
    ctx.beginPath();
    ctx.arc(PATH[i].x, PATH[i].y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function gate(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#6a5030";
  ctx.beginPath();
  ctx.arc(GATE.x, GATE.y, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#3a2810";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = "#fff6e8";
  ctx.font = "800 10px Nunito, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("IN", GATE.x, GATE.y + 3);
}

function cookie(ctx: CanvasRenderingContext2D, hp: number, max: number) {
  const x = COOKIE.x;
  const y = COOKIE.y;
  // vault pad
  ctx.fillStyle = "#e8a04a";
  ctx.beginPath();
  ctx.arc(x, y, 36, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#c4782a";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = "#6a3a18";
  [[-10, -8], [8, -6], [-4, 10], [12, 8], [0, 0]].forEach(([cx, cy]) => {
    ctx.beginPath();
    ctx.arc(x + cx, y + cy, 4, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = "#fff6e8";
  ctx.font = "800 11px Nunito, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("COOKIE", x, y + 50);

  const pct = Math.max(0, hp / max);
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(x - 34, y + 56, 68, 8);
  ctx.fillStyle = pct > 0.3 ? "#6ecf7a" : "#ff6b6b";
  ctx.fillRect(x - 34, y + 56, 68 * pct, 8);
}

function friendTokenRadius(f: PlacedFriend): number {
  if (f.def.rarity === "god") return 32;
  if (f.def.rarity === "mythical") return 30;
  return 24;
}

function drawFriendPad(
  ctx: CanvasRenderingContext2D,
  f: PlacedFriend,
  x: number,
  y: number,
  selected: boolean,
) {
  const r = friendTokenRadius(f);
  // round top-down token (mythical / god forms are bigger)
  ctx.fillStyle = f.def.color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = selected ? "#ffd24a" : "rgba(0,0,0,0.35)";
  ctx.lineWidth = selected ? 4 : 2;
  ctx.stroke();

  // god / mythical / legendary ring
  if (f.def.rarity === "god") {
    ctx.strokeStyle = "#ff5040";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, r + 5, 0, Math.PI * 2);
    ctx.stroke();
  } else if (f.def.rarity === "mythical") {
    ctx.strokeStyle = "#c060ff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, r + 5, 0, Math.PI * 2);
    ctx.stroke();
  } else if (f.def.rarity === "legendary") {
    ctx.strokeStyle = "#e8c15a";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x, y, r + 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  const emojiSize = f.def.rarity === "mythical" || f.def.rarity === "god" ? 34 : 26;
  ctx.font = `${emojiSize}px serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(f.def.emoji, x, y);

  const badgeX = x + r - 8;
  const badgeY = y - r + 8;
  ctx.fillStyle = "#fff6e8";
  ctx.strokeStyle = "#c4782a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(badgeX, badgeY, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#2a3040";
  ctx.font = "800 10px Nunito, sans-serif";
  ctx.fillText(String(f.level), badgeX, badgeY + 1);
}

function slots(ctx: CanvasRenderingContext2D, list: Slot[], selected: number | null) {
  for (const s of list) {
    const on = selected === s.id;
    if (!s.friend) {
      ctx.fillStyle = on ? "rgba(255,210,74,0.35)" : "rgba(255,255,255,0.22)";
      ctx.strokeStyle = on ? "#e8a04a" : "rgba(42,48,64,0.3)";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.arc(s.x, s.y, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(42,48,64,0.4)";
      ctx.font = "800 16px Nunito, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("+", s.x, s.y);
    } else if (s.friend.def.flies) {
      const f = s.friend;
      const orbitR = flyerOrbitRadius(f);
      // nest pad
      ctx.fillStyle = on ? "rgba(255,210,74,0.25)" : "rgba(255,255,255,0.18)";
      ctx.strokeStyle = on ? "#e8a04a" : "rgba(42,48,64,0.25)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // shoot / fly circle
      ctx.strokeStyle = on ? "rgba(126,200,255,0.55)" : "rgba(126,200,255,0.28)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(s.x, s.y, orbitR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // inner flight ring
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(s.x, s.y, orbitR * 0.72, 0, Math.PI * 2);
      ctx.stroke();

      const pos = flyerWorldPos(s.x, s.y, f);
      drawFriendPad(ctx, f, pos.x, pos.y, on);
    } else {
      drawFriendPad(ctx, s.friend, s.x, s.y, on);
    }
  }
}

function thieves(
  ctx: CanvasRenderingContext2D,
  list: Thief[],
  pos: Map<string, { x: number; y: number }>,
) {
  for (const t of list) {
    if (!t.alive) continue;
    const p = pos.get(t.uid);
    if (!p) continue;
    const r = t.def.boss ? 18 : 13;
    ctx.fillStyle = t.def.boss ? "#e8c15a" : "#fff6e8";
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(42,48,64,0.4)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = `${t.def.boss ? 22 : 18}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(t.def.emoji, p.x, p.y);

    const pct = t.hp / t.maxHp;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(p.x - 12, p.y - r - 10, 24, 5);
    ctx.fillStyle = "#ff6b6b";
    ctx.fillRect(p.x - 12, p.y - r - 10, 24 * pct, 5);

    if (t.slowTimer > 0 || t.blockedTimer > 0) {
      ctx.strokeStyle = t.blockedTimer > 0 ? "#c4782a" : "#5b8cff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 4, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function walls(ctx: CanvasRenderingContext2D, list: Wall[]) {
  for (const w of list) {
    const a = Math.min(1, w.life / 2);
    ctx.globalAlpha = 0.45 + a * 0.4;
    ctx.fillStyle = "#8a6030";
    ctx.strokeStyle = "#ffe08a";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(w.x - 18, w.y - 18, 36, 36, 6);
    ctx.fill();
    ctx.stroke();
    ctx.font = "18px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.globalAlpha = 1;
    ctx.fillText("🧱", w.x, w.y);
  }
}

function shots(ctx: CanvasRenderingContext2D, list: Shot[]) {
  for (const s of list) {
    ctx.fillStyle = s.color;
    const r = s.godBeam ? 7 : s.floppy ? 6 : 4;
    ctx.beginPath();
    ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
    ctx.fill();
    if (s.floppy) {
      ctx.strokeStyle = "#7ec8f0";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    if (s.godBeam) {
      ctx.strokeStyle = "#ff5040";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
}

function booms(ctx: CanvasRenderingContext2D, list: Boom[]) {
  for (const b of list) {
    const a = Math.max(0, b.life);
    ctx.globalAlpha = a;
    const colors: Record<string, string> = {
      crumb: "#e8a04a",
      frost: "#5b8cff",
      zap: "#ffd24a",
      floppy: "#5eb8e0",
      wall: "#c4782a",
      beam: "#ff5040",
    };
    ctx.strokeStyle = colors[b.kind] || "#fff";
    ctx.fillStyle = ctx.strokeStyle;
    ctx.globalAlpha = a * 0.25;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius * (1.2 - a * 0.2), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = a;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function floats(ctx: CanvasRenderingContext2D, list: FloatText[]) {
  ctx.textAlign = "center";
  ctx.font = "800 13px Nunito, sans-serif";
  for (const f of list) {
    ctx.globalAlpha = Math.min(1, f.life);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

export interface DrawState {
  slots: Slot[];
  thieves: Thief[];
  thiefPos: Map<string, { x: number; y: number }>;
  shots: Shot[];
  floats: FloatText[];
  booms: Boom[];
  walls: Wall[];
  cookieHp: number;
  cookieMax: number;
  selectedSlot: number | null;
  time: number;
  wave: number;
}

export function draw(ctx: CanvasRenderingContext2D, s: DrawState) {
  grass(ctx);
  path(ctx);
  gate(ctx);
  walls(ctx, s.walls);
  slots(ctx, s.slots, s.selectedSlot);
  thieves(ctx, s.thieves, s.thiefPos);
  shots(ctx, s.shots);
  booms(ctx, s.booms);
  cookie(ctx, s.cookieHp, s.cookieMax);
  floats(ctx, s.floats);

  ctx.fillStyle = "rgba(42,48,64,0.65)";
  ctx.font = "800 15px Nunito, sans-serif";
  ctx.textAlign = "left";
  const map = getActiveMap();
  ctx.fillText(`Wave ${s.wave} · ${map.name}`, 14, 24);
}

export function drawRangeHint(ctx: CanvasRenderingContext2D, slot: Slot) {
  if (!slot.friend) return;
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.arc(slot.x, slot.y, friendRange(slot.friend), 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
}
