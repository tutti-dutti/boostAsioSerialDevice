import { COOKIE, GATE, PATH, W, H, getActiveMap, type MapDecor } from "./path";
import { evolveLineage, friendDisplayScale, friendFootprintRadius } from "./data";
import { drawFriendPortrait } from "./animalArt";
import type { Boom, CookieBite, Dam, FloatText, PlacedFriend, PoisonCloud, Shot, Slot, Thief, Wall } from "./types";
import { flyerOrbitRadius, flyerWorldPos, friendRange } from "./types";

/** Strip complexity suffix (`forest_t2` → `forest`) */
function baseThemeId(mapId: string): string {
  return mapId.replace(/_t\d+$/, "");
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Soft, theme-following ground — no checkerboard */
function grass(ctx: CanvasRenderingContext2D) {
  const map = getActiveMap();
  const theme = baseThemeId(map.id);
  const rnd = mulberry32(hashStr(map.id + ":ground"));

  // Base wash
  ctx.fillStyle = map.grassB;
  ctx.fillRect(0, 0, W, H);

  // Soft diagonal blend into the lighter tone
  const wash = ctx.createLinearGradient(0, 0, W * 0.85, H);
  wash.addColorStop(0, map.grassA);
  wash.addColorStop(0.45, "rgba(0,0,0,0)");
  wash.addColorStop(1, map.grassA);
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;

  // Gentle radial lift toward the center
  const lift = ctx.createRadialGradient(W * 0.45, H * 0.4, 40, W * 0.5, H * 0.5, 520);
  lift.addColorStop(0, map.grassA);
  lift.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = lift;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;

  // Theme accents — organic patches, not a grid
  if (theme === "snow") {
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    for (let i = 0; i < 28; i++) {
      const x = rnd() * W;
      const y = rnd() * H;
      const r = 18 + rnd() * 55;
      ctx.globalAlpha = 0.12 + rnd() * 0.18;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * (0.45 + rnd() * 0.35), rnd() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (theme === "desert") {
    ctx.strokeStyle = "rgba(160, 120, 60, 0.22)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 14; i++) {
      const y = 40 + rnd() * (H - 80);
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= W; x += 40) {
        ctx.lineTo(x, y + Math.sin(x * 0.02 + i) * (6 + rnd() * 8));
      }
      ctx.stroke();
    }
  } else if (theme === "volcano") {
    for (let i = 0; i < 22; i++) {
      const x = rnd() * W;
      const y = rnd() * H;
      const r = 12 + rnd() * 40;
      ctx.globalAlpha = 0.1 + rnd() * 0.15;
      ctx.fillStyle = rnd() > 0.5 ? "#5a3028" : "#a04028";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (theme === "river") {
    for (let i = 0; i < 18; i++) {
      const x = rnd() * W;
      const y = rnd() * H;
      ctx.globalAlpha = 0.08 + rnd() * 0.12;
      ctx.fillStyle = "#9ad8e8";
      ctx.beginPath();
      ctx.ellipse(x, y, 30 + rnd() * 50, 10 + rnd() * 18, rnd() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (theme === "swamp") {
    for (let i = 0; i < 20; i++) {
      const x = rnd() * W;
      const y = rnd() * H;
      ctx.globalAlpha = 0.12 + rnd() * 0.16;
      ctx.fillStyle = rnd() > 0.4 ? "#3a5840" : "#4a7060";
      ctx.beginPath();
      ctx.ellipse(x, y, 20 + rnd() * 45, 14 + rnd() * 28, rnd(), 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (theme === "sakura") {
    ctx.fillStyle = "rgba(255, 180, 200, 0.2)";
    for (let i = 0; i < 36; i++) {
      const x = rnd() * W;
      const y = rnd() * H;
      ctx.globalAlpha = 0.15 + rnd() * 0.25;
      ctx.beginPath();
      ctx.ellipse(x, y, 3 + rnd() * 5, 2 + rnd() * 3, rnd() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (theme === "canyon") {
    for (let i = 0; i < 16; i++) {
      const x = rnd() * W;
      const y = rnd() * H;
      ctx.globalAlpha = 0.1 + rnd() * 0.14;
      ctx.fillStyle = "#a88858";
      ctx.beginPath();
      ctx.ellipse(x, y, 25 + rnd() * 60, 12 + rnd() * 22, rnd(), 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (theme === "bamboo") {
    ctx.strokeStyle = "rgba(60, 120, 50, 0.12)";
    ctx.lineWidth = 3;
    for (let i = 0; i < 20; i++) {
      const x = rnd() * W;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + (rnd() - 0.5) * 30, H);
      ctx.stroke();
    }
  } else {
    // Forest / meadow — soft moss patches
    for (let i = 0; i < 24; i++) {
      const x = rnd() * W;
      const y = rnd() * H;
      ctx.globalAlpha = 0.1 + rnd() * 0.16;
      ctx.fillStyle = map.grassA;
      ctx.beginPath();
      ctx.ellipse(x, y, 22 + rnd() * 48, 16 + rnd() * 32, rnd() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  // Theme-tinted vignette
  const vig = ctx.createRadialGradient(W / 2, H / 2, 140, W / 2, H / 2, 540);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  if (theme === "snow") vig.addColorStop(1, "rgba(80,110,140,0.22)");
  else if (theme === "desert") vig.addColorStop(1, "rgba(120,80,30,0.2)");
  else if (theme === "volcano") vig.addColorStop(1, "rgba(40,10,8,0.32)");
  else if (theme === "swamp") vig.addColorStop(1, "rgba(20,40,28,0.3)");
  else if (theme === "river") vig.addColorStop(1, "rgba(20,60,70,0.22)");
  else vig.addColorStop(1, "rgba(20,40,20,0.2)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
}

function drawDecorItem(ctx: CanvasRenderingContext2D, d: MapDecor) {
  const s = d.s;
  ctx.save();
  ctx.translate(d.x, d.y);
  ctx.scale(s, s);

  const trunk = (h: number, w = 5) => {
    ctx.fillStyle = "#6a4828";
    ctx.fillRect(-w / 2, -h * 0.15, w, h * 0.55);
  };
  const canopy = (r: number, color: string, y = -r * 0.55) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, y, r, 0, Math.PI * 2);
    ctx.fill();
  };

  switch (d.kind) {
    case "oak":
      trunk(28, 6);
      canopy(16, "#3d8a45");
      canopy(11, "#4ea055", -22);
      break;
    case "pine":
    case "snowpine": {
      trunk(22, 5);
      ctx.fillStyle = d.kind === "snowpine" ? "#6a9a78" : "#2f6b3a";
      for (let i = 0; i < 3; i++) {
        const top = -8 - i * 12;
        const half = 14 - i * 2;
        ctx.beginPath();
        ctx.moveTo(0, top - 10);
        ctx.lineTo(half, top + 10);
        ctx.lineTo(-half, top + 10);
        ctx.closePath();
        ctx.fill();
      }
      if (d.kind === "snowpine") {
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.beginPath();
        ctx.moveTo(0, -42);
        ctx.lineTo(8, -28);
        ctx.lineTo(-8, -28);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case "palm":
      trunk(32, 4);
      ctx.fillStyle = "#3d9a4a";
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i - 2) * 0.45;
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * 14, -28 + Math.sin(a) * 6, 14, 5, a, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case "bamboo":
      ctx.strokeStyle = "#5a9a40";
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      for (const ox of [-5, 0, 5]) {
        ctx.beginPath();
        ctx.moveTo(ox, 8);
        ctx.lineTo(ox, -28);
        ctx.stroke();
        ctx.fillStyle = "#6aaa50";
        ctx.fillRect(ox - 2, -12, 4, 2);
        ctx.fillRect(ox - 2, -22, 4, 2);
      }
      break;
    case "sakura":
      trunk(26, 5);
      canopy(15, "#f2a0c0");
      canopy(10, "#ffc0d8", -20);
      ctx.fillStyle = "#fff0f6";
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 10, -14 + Math.sin(a) * 8, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case "cactus":
      ctx.fillStyle = "#3d8a58";
      ctx.fillRect(-5, -22, 10, 30);
      ctx.fillRect(-14, -14, 9, 5);
      ctx.fillRect(-14, -14, 5, 12);
      ctx.fillRect(5, -8, 9, 5);
      ctx.fillRect(9, -8, 5, 10);
      break;
    case "dead":
      trunk(24, 5);
      ctx.strokeStyle = "#6a4828";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(-12, -22);
      ctx.moveTo(0, -6);
      ctx.lineTo(11, -18);
      ctx.stroke();
      break;
    case "bush":
      canopy(12, "#4a9a52", -4);
      canopy(9, "#5aaa60", -10);
      break;
    case "rock":
      ctx.fillStyle = "#8a8490";
      ctx.beginPath();
      ctx.ellipse(0, 0, 12, 8, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#9a96a0";
      ctx.beginPath();
      ctx.ellipse(-4, -3, 6, 4, 0.3, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "flower": {
      const petals = ["#f070a0", "#f0c040", "#70b0f0", "#e070f0"];
      ctx.fillStyle = petals[Math.abs(Math.floor(d.x + d.y)) % petals.length]!;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 5, Math.sin(a) * 5 - 2, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#f8e060";
      ctx.beginPath();
      ctx.arc(0, -2, 2.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "reed":
      ctx.strokeStyle = "#6a8a48";
      ctx.lineWidth = 2;
      for (const ox of [-4, 0, 4]) {
        ctx.beginPath();
        ctx.moveTo(ox, 6);
        ctx.quadraticCurveTo(ox + 4, -8, ox - 2, -22);
        ctx.stroke();
      }
      break;
    case "mushroom":
      ctx.fillStyle = "#e8e0d0";
      ctx.fillRect(-3, -2, 6, 10);
      ctx.fillStyle = "#d05050";
      ctx.beginPath();
      ctx.ellipse(0, -4, 10, 7, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = "#fff8f0";
      ctx.beginPath();
      ctx.arc(-3, -6, 1.8, 0, Math.PI * 2);
      ctx.arc(3, -5, 1.4, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "crystal":
      ctx.fillStyle = "#70c8f0";
      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.lineTo(8, 4);
      ctx.lineTo(0, 8);
      ctx.lineTo(-8, 4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.lineTo(3, -2);
      ctx.lineTo(0, 2);
      ctx.closePath();
      ctx.fill();
      break;
    case "lily":
      ctx.fillStyle = "#68a868";
      ctx.beginPath();
      ctx.ellipse(0, 2, 10, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f0e8ff";
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f0c040";
      ctx.beginPath();
      ctx.arc(0, 0, 1.8, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "stump":
      ctx.fillStyle = "#7a5838";
      ctx.fillRect(-8, -4, 16, 12);
      ctx.fillStyle = "#c4a078";
      ctx.beginPath();
      ctx.ellipse(0, -4, 8, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#a88860";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(0, -4, 5, 2.5, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
  }
  ctx.restore();
}

function landscaping(ctx: CanvasRenderingContext2D) {
  const map = getActiveMap();
  for (const d of map.decor || []) drawDecorItem(ctx, d);
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

  // Arrow pointing along the path's starting direction
  const next = PATH[1] ?? { x: GATE.x + 1, y: GATE.y };
  const ang = Math.atan2(next.y - GATE.y, next.x - GATE.x);
  ctx.save();
  ctx.translate(GATE.x, GATE.y);
  ctx.rotate(ang);
  ctx.fillStyle = "#fff6e8";
  ctx.beginPath();
  ctx.moveTo(12, 0);
  ctx.lineTo(-8, -9);
  ctx.lineTo(-4, 0);
  ctx.lineTo(-8, 9);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#3a2810";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

function cookieBiteCenters(x: number, y: number, r: number, bites: CookieBite[]) {
  return bites.map((b) => {
    // Size scales with damage: small nibble → deep boss chomp
    const br = 10 + b.size * 14;
    const inset = Math.min(r * 0.72, br * 0.55);
    return {
      bx: x + Math.cos(b.angle) * (r - inset),
      by: y + Math.sin(b.angle) * (r - inset),
      br,
      angle: b.angle,
      size: b.size,
    };
  });
}

function cookie(
  ctx: CanvasRenderingContext2D,
  hp: number,
  max: number,
  biteFlash = 0,
  biteMarks: CookieBite[] = [],
  pulseIndex = -1,
) {
  const x = COOKIE.x;
  const y = COOKIE.y;
  const r = 40;
  const map = getActiveMap();
  const marks =
    biteMarks.length > 0
      ? biteMarks
      : Array.from({ length: Math.min(10, Math.max(0, max - hp)) }, (_, i) => ({
          angle: -Math.PI * 0.9 + i * 0.7,
          size: 0.8,
        }));
  const bites = cookieBiteCenters(x, y, r, marks);
  const warm = biteFlash > 0.25;

  ctx.save();
  if (biteFlash > 0) {
    const shake = biteFlash * 7;
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  }

  // Soft cookie body — warm base + lighter center
  ctx.fillStyle = warm ? "#f0b45a" : "#e39a3e";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = warm ? "rgba(255, 220, 150, 0.55)" : "rgba(250, 210, 140, 0.45)";
  ctx.beginPath();
  ctx.arc(x - 4, y - 5, r * 0.62, 0, Math.PI * 2);
  ctx.fill();
  // Soft top highlight
  ctx.fillStyle = "rgba(255, 245, 220, 0.35)";
  ctx.beginPath();
  ctx.ellipse(x - 6, y - 12, r * 0.42, r * 0.22, -0.35, 0, Math.PI * 2);
  ctx.fill();

  // Clean chocolate chips — fewer, varied, inset from the rim
  const chips: [number, number, number][] = [
    [-9, -7, 3.4],
    [7, -9, 2.8],
    [11, 3, 3.1],
    [2, 9, 2.6],
    [-11, 6, 3.0],
    [-2, -1, 2.4],
  ];
  for (const [cx, cy, cr] of chips) {
    if (Math.hypot(cx, cy) > r - 11) continue;
    ctx.fillStyle = "#5c3214";
    ctx.beginPath();
    ctx.arc(x + cx, y + cy, cr, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(90, 50, 20, 0.35)";
    ctx.beginPath();
    ctx.arc(x + cx - cr * 0.25, y + cy - cr * 0.25, cr * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }

  // Scoop each bite: grass shows through a clean circular chomp
  for (let i = 0; i < bites.length; i++) {
    const b = bites[i];
    const hot = biteFlash > 0 && i === pulseIndex;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r + 0.5, 0, Math.PI * 2);
    ctx.clip();
    ctx.beginPath();
    ctx.arc(b.bx, b.by, b.br, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = map.grassB;
    ctx.fillRect(b.bx - b.br - 2, b.by - b.br - 2, b.br * 2 + 4, b.br * 2 + 4);
    // Soft theme patch inside the bite (no checkerboard)
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = map.grassA;
    ctx.beginPath();
    ctx.ellipse(b.bx - b.br * 0.15, b.by - b.br * 0.1, b.br * 0.7, b.br * 0.55, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();

    // Smooth chew rim (no tooth dots)
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r + 0.5, 0, Math.PI * 2);
    ctx.clip();
    ctx.beginPath();
    ctx.arc(b.bx, b.by, b.br, 0, Math.PI * 2);
    ctx.strokeStyle = hot ? "#4a220c" : "#6a3818";
    ctx.lineWidth = hot ? 4 : 2.75;
    ctx.lineCap = "round";
    ctx.stroke();
    // Soft inner shade along the bite
    ctx.beginPath();
    ctx.arc(b.bx, b.by, b.br - 2.2, 0, Math.PI * 2);
    ctx.strokeStyle = hot ? "rgba(90, 40, 10, 0.35)" : "rgba(70, 35, 12, 0.22)";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }

  // Outer cookie rim (skip bitten arcs)
  ctx.strokeStyle = "#c4782a";
  ctx.lineWidth = 3.25;
  if (bites.length === 0) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    const gaps = bites
      .map((b) => {
        const half = Math.asin(Math.min(0.98, (b.br * 0.95) / r));
        return { a0: b.angle - half, a1: b.angle + half };
      })
      .sort((a, b) => a.a0 - b.a0);
    let cursor = -Math.PI;
    for (const g of gaps) {
      if (g.a0 > cursor + 0.05) {
        ctx.beginPath();
        ctx.arc(x, y, r, cursor, g.a0);
        ctx.stroke();
      }
      cursor = Math.max(cursor, g.a1);
    }
    if (cursor < Math.PI - 0.05) {
      ctx.beginPath();
      ctx.arc(x, y, r, cursor, Math.PI);
      ctx.stroke();
    }
  }

  // Crumbs only on the freshest bite while flashing
  if (biteFlash > 0 && pulseIndex >= 0 && bites[pulseIndex]) {
    const b = bites[pulseIndex];
    const burst = 1 + biteFlash * 1.6;
    ctx.fillStyle = "#d4a060";
    for (let c = 0; c < 4; c++) {
      ctx.beginPath();
      ctx.arc(
        x + Math.cos(b.angle + (c - 1.5) * 0.18) * (r + 6 + c * 4 * burst),
        y + Math.sin(b.angle + (c - 1.5) * 0.18) * (r + 6 + c * 4 * burst),
        1.8 + (c % 2) * 0.6,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.strokeStyle = `rgba(255, 235, 180, ${Math.min(1, biteFlash * 1.4)})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(b.bx, b.by, b.br + 4 + (1 - biteFlash) * 10, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Compact HP bar under the cookie
  const pct = Math.max(0, hp / max);
  ctx.fillStyle = "rgba(42, 48, 64, 0.35)";
  ctx.beginPath();
  roundRect(ctx, x - 30, y + 48, 60, 7, 3.5);
  ctx.fill();
  if (pct > 0.01) {
    ctx.fillStyle = pct > 0.3 ? "#6ecf7a" : "#ff6b6b";
    ctx.beginPath();
    roundRect(ctx, x - 30, y + 48, 60 * pct, 7, 3.5);
    ctx.fill();
  }
  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  rad: number,
) {
  const r = Math.min(rad, w / 2, h / 2);
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function friendTokenRadius(f: PlacedFriend): number {
  return friendFootprintRadius(f.def);
}

function drawFriendPad(
  ctx: CanvasRenderingContext2D,
  f: PlacedFriend,
  x: number,
  y: number,
  selected: boolean,
  time = 0,
) {
  const r = friendTokenRadius(f);
  const scale = friendDisplayScale(f.def);
  // round top-down token (mythical / god stay a bit larger, but capped off the path)
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
    ctx.strokeStyle = scale >= 1.2 ? "#ffd24a" : "#c060ff";
    ctx.lineWidth = scale >= 1.2 ? 3.5 : 3;
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

  const portraitSize = Math.round((f.def.rarity === "mythical" || f.def.rarity === "god" ? 30 : 24) * scale);
  drawFriendPortrait(ctx, f.def, x, y, {
    size: portraitSize,
    time,
    mega: f.def.rarity === "mythical" || f.def.rarity === "god" || !!f.def.evolvedForm,
    glowColor: f.def.color,
    selected,
  });

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

  if (selected) {
    drawEvolveInfo(ctx, f, x, y, r);
  }
}

function drawEvolveInfo(
  ctx: CanvasRenderingContext2D,
  f: PlacedFriend,
  x: number,
  y: number,
  r: number,
) {
  const line = evolveLineage(f.def);
  const lines = [`From: ${line.fromLabel}`, `Into: ${line.intoLabel}`];
  ctx.font = "800 12px Nunito, sans-serif";
  const padX = 10;
  const padY = 7;
  const lineH = 15;
  let maxW = 0;
  for (const t of lines) maxW = Math.max(maxW, ctx.measureText(t).width);
  const boxW = maxW + padX * 2;
  const boxH = padY * 2 + lineH * lines.length;
  let boxX = x - boxW / 2;
  let boxY = y - r - boxH - 10;
  if (boxY < 8) boxY = y + r + 12;
  if (boxX < 8) boxX = 8;
  if (boxX + boxW > W - 8) boxX = W - 8 - boxW;

  ctx.fillStyle = "rgba(255, 248, 238, 0.94)";
  ctx.strokeStyle = "#c4782a";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxW, boxH, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#2a3040";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  lines.forEach((t, i) => {
    ctx.fillText(t, boxX + padX, boxY + padY + i * lineH);
  });
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
}

function drawSpeechBubble(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
) {
  ctx.font = "800 13px Nunito, sans-serif";
  const padX = 10;
  const tw = ctx.measureText(text).width;
  const boxW = tw + padX * 2;
  const boxH = 22;
  let boxX = x - boxW / 2;
  let boxY = y - 48;
  if (boxX < 6) boxX = 6;
  if (boxX + boxW > W - 6) boxX = W - 6 - boxW;
  if (boxY < 6) boxY = y + 28;

  ctx.fillStyle = "#fffdf6";
  ctx.strokeStyle = "#2a3040";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxW, boxH, 10);
  ctx.fill();
  ctx.stroke();
  // tail
  ctx.beginPath();
  ctx.moveTo(x - 6, boxY + boxH);
  ctx.lineTo(x, boxY + boxH + 8);
  ctx.lineTo(x + 6, boxY + boxH);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#2a3040";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, boxX + boxW / 2, boxY + boxH / 2 + 1);
}

function slots(
  ctx: CanvasRenderingContext2D,
  list: Slot[],
  selected: number | null,
  time = 0,
) {
  for (const s of list) {
    if (!s.friend) continue; // never draw empty deploy pads — too crowded
    const on = selected === s.id;
    if (s.friend.def.flies) {
      const f = s.friend;
      const landed = !!f.landed;
      const pos = landed ? { x: s.x, y: s.y } : flyerWorldPos(s.x, s.y, f);
      // Nest / orbit rings only when this flyer is selected — keeps the board clear
      if (on) {
        const orbitR = flyerOrbitRadius(f);
        ctx.fillStyle = landed ? "rgba(224, 112, 48, 0.3)" : "rgba(255,210,74,0.25)";
        ctx.strokeStyle = landed ? "#e07030" : "#e8a04a";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        if (!landed) {
          ctx.strokeStyle = "rgba(126,200,255,0.55)";
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 6]);
          ctx.beginPath();
          ctx.arc(s.x, s.y, orbitR, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.strokeStyle = "rgba(255,255,255,0.25)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(s.x, s.y, orbitR * 0.72, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      drawFriendPad(ctx, f, pos.x, pos.y, on, time);
      if (f.speech && f.speech.life > 0) {
        drawSpeechBubble(ctx, pos.x, pos.y, f.speech.text);
      }
    } else {
      drawFriendPad(ctx, s.friend, s.x, s.y, on, time);
      if (s.friend.speech && s.friend.speech.life > 0) {
        drawSpeechBubble(ctx, s.x, s.y, s.friend.speech.text);
      }
    }
  }
}

function deployGhost(
  ctx: CanvasRenderingContext2D,
  ghost: { x: number; y: number; valid: boolean } | null | undefined,
  deployMode: boolean,
) {
  // Placement ghost only while a bag friend is equipped
  if (!deployMode || !ghost) return;
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = ghost.valid ? "rgba(126, 220, 120, 0.45)" : "rgba(220, 80, 80, 0.4)";
  ctx.strokeStyle = ghost.valid ? "#3a9a40" : "#c04030";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(ghost.x, ghost.y, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = ghost.valid ? "#2a6030" : "#6a2020";
  ctx.font = "800 18px Nunito, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(ghost.valid ? "+" : "✕", ghost.x, ghost.y);
  ctx.restore();
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
    const kind = t.def.kind ?? "strength";
    const fill =
      t.def.boss ? "#e8c15a" : kind === "speed" ? "#dff6ff" : "#ffe8d4";
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle =
      t.def.boss ? "rgba(42,48,64,0.4)" : kind === "speed" ? "#3aa0c8" : "#c87838";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.font = `${t.def.boss ? 22 : 18}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(t.def.emoji, p.x, p.y);

    const pct = t.hp / t.maxHp;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(p.x - 12, p.y - r - 10, 24, 5);
    ctx.fillStyle = kind === "speed" ? "#4ec4f0" : "#ff6b6b";
    ctx.fillRect(p.x - 12, p.y - r - 10, 24 * pct, 5);

    if (t.slowTimer > 0 || t.blockedTimer > 0 || t.freezeTimer > 0) {
      ctx.strokeStyle = t.freezeTimer > 0 ? "#9ad4ff" : t.blockedTimer > 0 ? "#c4782a" : "#5b8cff";
      ctx.lineWidth = t.freezeTimer > 0 ? 3 : 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (t.poisonTimer > 0) {
      ctx.strokeStyle = "#5a9060";
      ctx.lineWidth = 2.5;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
}

function walls(ctx: CanvasRenderingContext2D, list: Wall[]) {
  for (const w of list) {
    const a = Math.min(1, w.life / 2);
    const fade = 0.55 + a * 0.45;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(w.x, w.y);

    // Wooden log body (horizontal)
    ctx.fillStyle = "#8a5a28";
    ctx.strokeStyle = "#5a3818";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-22, -10, 44, 20, 9);
    ctx.fill();
    ctx.stroke();

    // Bark stripes
    ctx.strokeStyle = "rgba(40, 24, 12, 0.4)";
    ctx.lineWidth = 1.6;
    for (const ox of [-12, -4, 4, 12]) {
      ctx.beginPath();
      ctx.moveTo(ox, -7);
      ctx.lineTo(ox + 2, 7);
      ctx.stroke();
    }

    // Cut ends (rings)
    for (const side of [-1, 1] as const) {
      ctx.fillStyle = "#c9a066";
      ctx.beginPath();
      ctx.ellipse(side * 20, 0, 5, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#6a4820";
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.strokeStyle = "rgba(90, 56, 24, 0.55)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(side * 20, 0, 2.5, 4.5, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(side * 20, 0, 1.2, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Soft highlight along the top
    ctx.fillStyle = "rgba(255, 220, 160, 0.22)";
    ctx.beginPath();
    ctx.roundRect(-16, -8, 32, 5, 3);
    ctx.fill();

    ctx.restore();
  }
}

function dams(ctx: CanvasRenderingContext2D, list: Dam[]) {
  for (const d of list) {
    const hpPct = Math.max(0, d.hp / d.maxHp);
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = "#6a4828";
    ctx.strokeStyle = "#c9a66b";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(d.x - 26, d.y - 16, 52, 32, 8);
    ctx.fill();
    ctx.stroke();
    // log stripes
    ctx.strokeStyle = "rgba(40, 24, 12, 0.35)";
    ctx.lineWidth = 2;
    for (const ox of [-12, 0, 12]) {
      ctx.beginPath();
      ctx.moveTo(d.x + ox, d.y - 12);
      ctx.lineTo(d.x + ox, d.y + 12);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.font = "20px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🪵", d.x, d.y);
    // HP bar
    ctx.fillStyle = "rgba(20,16,12,0.55)";
    ctx.fillRect(d.x - 22, d.y + 18, 44, 6);
    ctx.fillStyle = hpPct > 0.35 ? "#7ecf6a" : "#e07050";
    ctx.fillRect(d.x - 22, d.y + 18, 44 * hpPct, 6);
  }
}

function poisonClouds(ctx: CanvasRenderingContext2D, list: PoisonCloud[], time: number) {
  for (const c of list) {
    const fade = Math.min(1, c.life / Math.min(1.2, c.maxLife));
    const pulse = 0.85 + Math.sin(time * 4 + c.x * 0.01) * 0.08;
    ctx.globalAlpha = 0.22 * fade;
    ctx.fillStyle = "#5a9060";
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.radius * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.35 * fade;
    ctx.strokeStyle = "#3a7048";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.radius * 0.92, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = Math.min(1, fade + 0.2);
    ctx.font = "22px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("💨", c.x, c.y);
    ctx.globalAlpha = 1;
  }
}

function shots(ctx: CanvasRenderingContext2D, list: Shot[]) {
  for (const s of list) {
    if (s.dumpling) {
      ctx.font = "22px serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🥟", s.x, s.y);
      continue;
    }
    if (s.bomb) {
      ctx.font = "22px serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("💣", s.x, s.y);
      continue;
    }
    ctx.fillStyle = s.color;
    const r = s.godBeam ? 7 : s.heavyHit ? 7 : s.freeze || s.floppy ? 6 : 4;
    ctx.beginPath();
    ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
    ctx.fill();
    if (s.floppy) {
      ctx.strokeStyle = "#7ec8f0";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    if (s.freeze) {
      ctx.strokeStyle = "#9ad4ff";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    if (s.heavyHit) {
      ctx.strokeStyle = "#c87838";
      ctx.lineWidth = 2.5;
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
      dam: "#8a6040",
      dumpling: "#f0c878",
      bomb: "#e07030",
      fart: "#5a9060",
      beam: "#ff5040",
      freeze: "#9ad4ff",
      heavy: "#c87838",
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
  dams?: Dam[];
  poisonClouds?: PoisonCloud[];
  cookieHp: number;
  cookieMax: number;
  cookieBiteFlash?: number;
  cookieBites?: CookieBite[];
  cookieBitePulse?: number;
  selectedSlot: number | null;
  time: number;
  wave: number;
  bossFight?: boolean;
  deployMode?: boolean;
  waveWaiting?: boolean;
  paused?: boolean;
  autoWaveTimer?: number;
  deployGhost?: { x: number; y: number; valid: boolean } | null;
}

export function draw(ctx: CanvasRenderingContext2D, s: DrawState) {
  grass(ctx);
  path(ctx);
  landscaping(ctx);
  gate(ctx);
  walls(ctx, s.walls);
  dams(ctx, s.dams || []);
  poisonClouds(ctx, s.poisonClouds || [], s.time);
  slots(ctx, s.slots, s.selectedSlot, s.time);
  deployGhost(ctx, s.deployGhost, !!s.deployMode);
  thieves(ctx, s.thieves, s.thiefPos);
  shots(ctx, s.shots);
  booms(ctx, s.booms);
  cookie(ctx, s.cookieHp, s.cookieMax, s.cookieBiteFlash ?? 0, s.cookieBites ?? [], s.cookieBitePulse ?? -1);
  floats(ctx, s.floats);

  if (s.waveWaiting && !s.deployMode) {
    ctx.fillStyle = "rgba(42, 48, 64, 0.72)";
    ctx.font = "700 14px Nunito, sans-serif";
    ctx.textAlign = "center";
    if (s.autoWaveTimer && s.autoWaveTimer > 0) {
      const secs = Math.max(1, Math.ceil(s.autoWaveTimer));
      ctx.fillText(`Next wave in ${secs}s · Move & prepare`, W / 2, H - 12);
    } else {
      ctx.fillText(`Ready · Start Wave ${s.wave}`, W / 2, H - 12);
    }
  }

  if (s.deployMode) {
    ctx.fillStyle = "rgba(232, 160, 74, 0.92)";
    ctx.font = "800 16px Nunito, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Tap grass to deploy — not on the path. Drag friends to move.", W / 2, H - 16);
  }

  if (s.bossFight) {
    const pulse = 0.75 + Math.sin(s.time * 5) * 0.25;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = "#c04030";
    ctx.font = "900 28px Fredoka, Nunito, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("⚔️ BOSS FIGHT ⚔️", W / 2, 48);
    ctx.restore();
  }

  if (s.paused) {
    ctx.fillStyle = "rgba(20, 24, 36, 0.45)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#fff8ee";
    ctx.font = "900 36px Fredoka, Nunito, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Paused", W / 2, H / 2 - 8);
    ctx.font = "700 16px Nunito, sans-serif";
    ctx.fillStyle = "rgba(255, 248, 238, 0.9)";
    ctx.fillText("Press Resume to continue", W / 2, H / 2 + 24);
  }
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
