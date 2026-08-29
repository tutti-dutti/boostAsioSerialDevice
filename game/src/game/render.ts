import { COOKIE, PATH, W, H } from "./path";
import type { Boom, FloatText, PlacedFriend, Shot, Slot, Thief } from "./types";
import { friendRange } from "./types";

function sky(ctx: CanvasRenderingContext2D, time: number) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#7ec8f0");
  g.addColorStop(0.55, "#b8e8ff");
  g.addColorStop(0.55, "#8fd86a");
  g.addColorStop(1, "#6ec05a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // clouds
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  for (let i = 0; i < 4; i++) {
    const x = ((i * 260 + time * 12) % (W + 120)) - 60;
    const y = 40 + i * 18;
    cloud(ctx, x, y, 28 + i * 4);
  }

  // sun
  ctx.fillStyle = "#ffe08a";
  ctx.beginPath();
  ctx.arc(900, 55, 28, 0, Math.PI * 2);
  ctx.fill();
}

function cloud(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.arc(x + r * 0.8, y - 6, r * 0.75, 0, Math.PI * 2);
  ctx.arc(x + r * 1.5, y, r * 0.9, 0, Math.PI * 2);
  ctx.fill();
}

function path(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = "#d4b070";
  ctx.lineWidth = 34;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(PATH[0].x, PATH[0].y);
  for (let i = 1; i < PATH.length; i++) ctx.lineTo(PATH[i].x, PATH[i].y);
  ctx.stroke();
  ctx.strokeStyle = "#e8c888";
  ctx.lineWidth = 20;
  ctx.stroke();
}

function cookie(ctx: CanvasRenderingContext2D, hp: number, max: number, time: number) {
  const bob = Math.sin(time * 3) * 4;
  const x = COOKIE.x;
  const y = COOKIE.y + bob;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#e8a04a";
  ctx.beginPath();
  ctx.arc(0, 0, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#c4782a";
  ctx.lineWidth = 4;
  ctx.stroke();
  // chips
  ctx.fillStyle = "#6a3a18";
  [[-10, -8], [8, -6], [-4, 10], [12, 8], [0, 0]].forEach(([cx, cy]) => {
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.font = "700 14px Nunito, sans-serif";
  ctx.fillStyle = "#fff6e8";
  ctx.textAlign = "center";
  ctx.fillText("COOKIE", 0, 48);
  ctx.restore();

  const pct = Math.max(0, hp / max);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(x - 36, y + 54, 72, 10);
  ctx.fillStyle = pct > 0.3 ? "#6ecf7a" : "#ff6b6b";
  ctx.fillRect(x - 36, y + 54, 72 * pct, 10);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.strokeRect(x - 36, y + 54, 72, 10);
}

function slots(
  ctx: CanvasRenderingContext2D,
  list: Slot[],
  selected: number | null,
  time: number,
) {
  for (const s of list) {
    const on = selected === s.id;
    ctx.fillStyle = on ? "rgba(255, 210, 74, 0.35)" : "rgba(255,255,255,0.28)";
    ctx.strokeStyle = on ? "#e8a04a" : "rgba(42,48,64,0.25)";
    ctx.lineWidth = on ? 4 : 2;
    ctx.setLineDash(s.friend ? [] : [6, 5]);
    ctx.beginPath();
    ctx.arc(s.x, s.y, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);

    if (s.friend) {
      drawFriend(ctx, s.friend, s.x, s.y, time);
    } else {
      ctx.fillStyle = "rgba(42,48,64,0.35)";
      ctx.font = "800 16px Nunito, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("+", s.x, s.y);
    }
  }
}

function drawFriend(ctx: CanvasRenderingContext2D, f: PlacedFriend, x: number, y: number, time: number) {
  const bob = Math.sin(time * 4 + f.slotId) * 3;
  ctx.font = "32px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(f.def.emoji, x, y + bob);

  // level bubble
  ctx.fillStyle = "#fff6e8";
  ctx.strokeStyle = "#e8a04a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x + 16, y - 16 + bob, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#2a3040";
  ctx.font = "800 11px Nunito, sans-serif";
  ctx.fillText(String(f.level), x + 16, y - 15 + bob);
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
    ctx.font = `${t.def.boss ? 36 : 28}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(t.def.emoji, p.x, p.y);
    if (t.def.boss) {
      ctx.font = "20px serif";
      ctx.fillText("👑", p.x, p.y - 26);
    }
    const pct = t.hp / t.maxHp;
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(p.x - 14, p.y - 28, 28, 6);
    ctx.fillStyle = "#ff6b6b";
    ctx.fillRect(p.x - 14, p.y - 28, 28 * pct, 6);
    if (t.slowTimer > 0) {
      ctx.strokeStyle = "#5b8cff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 20, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function shots(ctx: CanvasRenderingContext2D, list: Shot[]) {
  for (const s of list) {
    ctx.fillStyle = s.color;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function booms(ctx: CanvasRenderingContext2D, list: Boom[]) {
  for (const b of list) {
    const a = Math.max(0, b.life);
    ctx.globalAlpha = a;
    ctx.strokeStyle = b.kind === "frost" ? "#5b8cff" : b.kind === "zap" ? "#ffd24a" : "#e8a04a";
    ctx.fillStyle = b.kind === "frost" ? "rgba(91,140,255,0.25)" : b.kind === "zap" ? "rgba(255,210,74,0.25)" : "rgba(232,160,74,0.3)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius * (1.3 - a * 0.3), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function floats(ctx: CanvasRenderingContext2D, list: FloatText[]) {
  ctx.textAlign = "center";
  ctx.font = "800 14px Nunito, sans-serif";
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
  cookieHp: number;
  cookieMax: number;
  selectedSlot: number | null;
  time: number;
  wave: number;
}

export function draw(ctx: CanvasRenderingContext2D, s: DrawState) {
  sky(ctx, s.time);
  path(ctx);
  slots(ctx, s.slots, s.selectedSlot, s.time);
  thieves(ctx, s.thieves, s.thiefPos);
  shots(ctx, s.shots);
  booms(ctx, s.booms);
  cookie(ctx, s.cookieHp, s.cookieMax, s.time);
  floats(ctx, s.floats);

  ctx.fillStyle = "rgba(42,48,64,0.55)";
  ctx.font = "800 16px Nunito, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(`Wave ${s.wave}`, 16, 28);
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
