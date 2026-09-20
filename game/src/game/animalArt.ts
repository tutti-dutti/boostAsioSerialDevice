/**
 * Stylized animal portraits for friends.
 * Base forms = recognizable animal drawings.
 * Mythical / evolved / god = same base animal with RGB glow + stars + mega aura.
 */
import { evolvesFrom, type FriendDef, type Rarity } from "./data";

export type SpeciesId =
  | "hummingbird"
  | "bunny"
  | "squirrel"
  | "hedgehog"
  | "chipmunk"
  | "mouse"
  | "penguin"
  | "mole"
  | "skunk"
  | "owl"
  | "deer"
  | "beaver"
  | "wolf"
  | "fox"
  | "fish"
  | "seal"
  | "moose"
  | "otter"
  | "brownbear"
  | "polarbear"
  | "eagle"
  | "shark"
  | "redpanda";

const SPECIES_SET = new Set<string>([
  "hummingbird",
  "bunny",
  "squirrel",
  "hedgehog",
  "chipmunk",
  "mouse",
  "penguin",
  "mole",
  "skunk",
  "owl",
  "deer",
  "beaver",
  "wolf",
  "fox",
  "fish",
  "seal",
  "moose",
  "otter",
  "brownbear",
  "polarbear",
  "eagle",
  "shark",
  "redpanda",
]);

/** Walk evolution chain back to the drawable base animal */
export function baseSpeciesFor(def: FriendDef): SpeciesId {
  let cur: FriendDef | undefined = def;
  const seen = new Set<string>();
  while (cur && !SPECIES_SET.has(cur.id)) {
    if (seen.has(cur.id)) break;
    seen.add(cur.id);
    cur = evolvesFrom(cur.id);
  }
  if (cur && SPECIES_SET.has(cur.id)) return cur.id as SpeciesId;
  // Fallback: redpanda for god-line unknowns
  return "bunny";
}

export function isMegaPortrait(rarity: Rarity, evolved?: boolean): boolean {
  return rarity === "mythical" || rarity === "god" || !!evolved;
}

function circle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  fill: string,
  stroke?: string,
  lw = 1.5,
) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

function oval(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  fill: string,
  rot = 0,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
}

function eye(ctx: CanvasRenderingContext2D, x: number, y: number, s = 1) {
  circle(ctx, x, y, 2.2 * s, "#fff");
  circle(ctx, x + 0.4 * s, y + 0.3 * s, 1.15 * s, "#1a2030");
  circle(ctx, x + 0.9 * s, y - 0.4 * s, 0.45 * s, "#fff");
}

function blush(ctx: CanvasRenderingContext2D, x: number, y: number) {
  oval(ctx, x, y, 2.2, 1.2, "rgba(255,140,150,0.35)");
}

/** Draw base animal art in local space centered at 0,0 fitting ~±14 */
function drawSpecies(ctx: CanvasRenderingContext2D, species: SpeciesId) {
  switch (species) {
    case "bunny": {
      oval(ctx, -6, -11, 3.2, 7, "#f2e6dc", -0.15);
      oval(ctx, 6, -11, 3.2, 7, "#f2e6dc", 0.15);
      oval(ctx, -6, -11, 1.6, 4.5, "#f5b8c0", -0.15);
      oval(ctx, 6, -11, 1.6, 4.5, "#f5b8c0", 0.15);
      circle(ctx, 0, 0, 10, "#f5ebe3", "#d8c4b0", 1.2);
      eye(ctx, -3.5, -1);
      eye(ctx, 3.5, -1);
      blush(ctx, -6.5, 2.5);
      blush(ctx, 6.5, 2.5);
      oval(ctx, 0, 2.5, 1.6, 1.2, "#f0a0a8");
      break;
    }
    case "squirrel":
    case "chipmunk": {
      const fur = species === "chipmunk" ? "#d4a060" : "#c48848";
      oval(ctx, 8, 2, 4, 7, fur, 0.6);
      circle(ctx, 0, 0, 9.5, fur, "#8a5830", 1.2);
      if (species === "chipmunk") {
        oval(ctx, 0, 1, 7, 3.5, "#f0d8b0");
        ctx.strokeStyle = "#6a4020";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-5, 0);
        ctx.lineTo(5, 0);
        ctx.stroke();
      }
      oval(ctx, -7, -7, 3, 3.5, fur);
      oval(ctx, 7, -7, 3, 3.5, fur);
      eye(ctx, -3, -1);
      eye(ctx, 3, -1);
      oval(ctx, 0, 2, 1.4, 1.1, "#4a3020");
      break;
    }
    case "hedgehog": {
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI * 0.85 + i * 0.19;
        ctx.strokeStyle = "#6a5040";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 6, Math.sin(a) * 5 - 1);
        ctx.lineTo(Math.cos(a) * 13, Math.sin(a) * 11 - 2);
        ctx.stroke();
      }
      circle(ctx, 0, 1, 8.5, "#d8b898", "#a08060", 1.2);
      eye(ctx, -3, 0);
      eye(ctx, 3, 0);
      oval(ctx, 0, 3, 1.5, 1.1, "#4a3020");
      break;
    }
    case "mouse": {
      oval(ctx, -8, -6, 4.5, 4, "#c8b8a8");
      oval(ctx, 8, -6, 4.5, 4, "#c8b8a8");
      oval(ctx, -8, -6, 2.5, 2.2, "#f0c0c8");
      oval(ctx, 8, -6, 2.5, 2.2, "#f0c0c8");
      circle(ctx, 0, 1, 8, "#c8b8a8", "#908070", 1.2);
      eye(ctx, -3, 0);
      eye(ctx, 3, 0);
      oval(ctx, 0, 3, 1.3, 1, "#e08090");
      break;
    }
    case "penguin": {
      circle(ctx, 0, 1, 10, "#2a3040");
      oval(ctx, 0, 3, 6.5, 7, "#f5f5f0");
      oval(ctx, -7, 4, 2.5, 1.5, "#e8a040", 0.3);
      oval(ctx, 7, 4, 2.5, 1.5, "#e8a040", -0.3);
      eye(ctx, -3, -2);
      eye(ctx, 3, -2);
      ctx.fillStyle = "#e87830";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-2.5, 2.5);
      ctx.lineTo(2.5, 2.5);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "mole": {
      circle(ctx, 0, 1, 9.5, "#8a7060", "#5a4838", 1.2);
      oval(ctx, -8, 2, 4, 2, "#7a6050", 0.4);
      oval(ctx, 8, 2, 4, 2, "#7a6050", -0.4);
      // squint eyes
      ctx.strokeStyle = "#2a2018";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-5, 0);
      ctx.lineTo(-2, 0);
      ctx.moveTo(2, 0);
      ctx.lineTo(5, 0);
      ctx.stroke();
      oval(ctx, 0, 3, 2, 1.4, "#f0a0b0");
      break;
    }
    case "skunk": {
      circle(ctx, 0, 1, 9.5, "#3a3840", "#1a1820", 1.2);
      oval(ctx, 0, -2, 3, 8, "#f5f5f0", 0);
      oval(ctx, 9, 3, 3.5, 6, "#3a3840", 0.5);
      oval(ctx, 9, 1, 1.2, 5, "#f5f5f0", 0.5);
      eye(ctx, -3, 0);
      eye(ctx, 3, 0);
      oval(ctx, 0, 3, 1.4, 1, "#1a1820");
      break;
    }
    case "hummingbird": {
      oval(ctx, 0, 1, 7, 6, "#5ecf90");
      oval(ctx, -10, 0, 5, 2.2, "rgba(120,220,200,0.55)", -0.4);
      oval(ctx, 8, 2, 5, 2, "#4ab878", 0.5);
      circle(ctx, 4, -4, 4.5, "#7ed9a0");
      eye(ctx, 5, -4, 0.85);
      ctx.strokeStyle = "#304050";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(8, -3);
      ctx.lineTo(14, -1);
      ctx.stroke();
      break;
    }
    case "owl": {
      circle(ctx, 0, 0, 10, "#8a7050", "#5a4830", 1.2);
      circle(ctx, -4, -1, 4.2, "#f5efe0");
      circle(ctx, 4, -1, 4.2, "#f5efe0");
      circle(ctx, -4, -1, 2, "#2a3040");
      circle(ctx, 4, -1, 2, "#2a3040");
      circle(ctx, -3.2, -1.6, 0.7, "#fff");
      circle(ctx, 4.8, -1.6, 0.7, "#fff");
      ctx.fillStyle = "#e09040";
      ctx.beginPath();
      ctx.moveTo(0, 1);
      ctx.lineTo(-2, 4);
      ctx.lineTo(2, 4);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "deer":
    case "moose": {
      const antler = species === "moose";
      ctx.strokeStyle = "#6a4830";
      ctx.lineWidth = antler ? 2.4 : 1.8;
      ctx.lineCap = "round";
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(side * 4, -6);
        ctx.lineTo(side * 8, -14);
        if (antler) {
          ctx.moveTo(side * 6, -10);
          ctx.lineTo(side * 11, -12);
          ctx.moveTo(side * 7, -12);
          ctx.lineTo(side * 10, -16);
        } else {
          ctx.moveTo(side * 6, -10);
          ctx.lineTo(side * 9, -13);
        }
        ctx.stroke();
      }
      circle(ctx, 0, 1, 9, antler ? "#a07040" : "#c89858", "#8a6030", 1.2);
      eye(ctx, -3.2, 0);
      eye(ctx, 3.2, 0);
      oval(ctx, 0, 3, 1.5, 1.2, "#4a3020");
      break;
    }
    case "beaver": {
      circle(ctx, 0, 0, 9.5, "#8a6040", "#5a3820", 1.2);
      oval(ctx, -7, -6, 3.2, 3, "#8a6040");
      oval(ctx, 7, -6, 3.2, 3, "#8a6040");
      eye(ctx, -3, -1);
      eye(ctx, 3, -1);
      // buck teeth
      ctx.fillStyle = "#fff8e0";
      ctx.fillRect(-2.4, 2, 2.2, 3);
      ctx.fillRect(0.2, 2, 2.2, 3);
      oval(ctx, 0, 10, 4, 2.5, "#6a4830");
      break;
    }
    case "wolf":
    case "fox": {
      const fox = species === "fox";
      const fur = fox ? "#e87840" : "#808898";
      const ear = fox ? "#e87840" : "#808898";
      ctx.fillStyle = ear;
      ctx.beginPath();
      ctx.moveTo(-9, -2);
      ctx.lineTo(-5, -12);
      ctx.lineTo(-1, -3);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(9, -2);
      ctx.lineTo(5, -12);
      ctx.lineTo(1, -3);
      ctx.fill();
      if (fox) {
        ctx.fillStyle = "#f5c0b0";
        ctx.beginPath();
        ctx.moveTo(-7.5, -3);
        ctx.lineTo(-5, -9);
        ctx.lineTo(-3, -3);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(7.5, -3);
        ctx.lineTo(5, -9);
        ctx.lineTo(3, -3);
        ctx.fill();
      }
      circle(ctx, 0, 1, 9, fur, fox ? "#b05020" : "#505868", 1.2);
      if (fox) oval(ctx, 0, 4, 5, 4, "#f5efe8");
      eye(ctx, -3.2, 0);
      eye(ctx, 3.2, 0);
      oval(ctx, 0, 3, 1.5, 1.1, "#2a2018");
      break;
    }
    case "fish": {
      oval(ctx, -1, 0, 9, 6, "#5eb8e0");
      ctx.fillStyle = "#4aa0c8";
      ctx.beginPath();
      ctx.moveTo(7, 0);
      ctx.lineTo(14, -5);
      ctx.lineTo(14, 5);
      ctx.closePath();
      ctx.fill();
      eye(ctx, -4, -1, 0.9);
      oval(ctx, -7, 1.5, 1.2, 0.8, "#e06070");
      break;
    }
    case "seal": {
      circle(ctx, 0, 1, 10, "#a8d0e8", "#7098b0", 1.2);
      oval(ctx, -9, 4, 3.5, 2, "#90b8d0", 0.3);
      oval(ctx, 9, 4, 3.5, 2, "#90b8d0", -0.3);
      eye(ctx, -3.5, -1);
      eye(ctx, 3.5, -1);
      oval(ctx, 0, 2.5, 1.6, 1.2, "#304050");
      circle(ctx, -5, 3, 1.2, "rgba(255,140,150,0.4)");
      circle(ctx, 5, 3, 1.2, "rgba(255,140,150,0.4)");
      break;
    }
    case "otter": {
      circle(ctx, 0, 0, 9.5, "#b08050", "#805830", 1.2);
      oval(ctx, -7, -6, 3, 3.2, "#b08050");
      oval(ctx, 7, -6, 3, 3.2, "#b08050");
      eye(ctx, -3, -1);
      eye(ctx, 3, -1);
      oval(ctx, 0, 2.5, 1.4, 1.1, "#4a3020");
      // whiskers
      ctx.strokeStyle = "#5a4030";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-3, 3);
      ctx.lineTo(-9, 2);
      ctx.moveTo(-3, 4);
      ctx.lineTo(-9, 5);
      ctx.moveTo(3, 3);
      ctx.lineTo(9, 2);
      ctx.moveTo(3, 4);
      ctx.lineTo(9, 5);
      ctx.stroke();
      break;
    }
    case "brownbear":
    case "polarbear": {
      const fur = species === "polarbear" ? "#e8f0f8" : "#8a5030";
      const stroke = species === "polarbear" ? "#a0b0c0" : "#5a3020";
      oval(ctx, -8, -7, 4, 4, fur);
      oval(ctx, 8, -7, 4, 4, fur);
      circle(ctx, 0, 1, 10, fur, stroke, 1.2);
      circle(ctx, 0, 4, 4.5, species === "polarbear" ? "#d0d8e0" : "#6a3820");
      eye(ctx, -3.5, -1);
      eye(ctx, 3.5, -1);
      oval(ctx, 0, 3.5, 1.6, 1.2, "#2a2018");
      break;
    }
    case "eagle": {
      circle(ctx, 0, 1, 9, "#d8c8a8", "#a09060", 1.2);
      oval(ctx, -11, 2, 5, 2.5, "#4a4030", -0.3);
      oval(ctx, 11, 2, 5, 2.5, "#4a4030", 0.3);
      eye(ctx, -3, -1);
      eye(ctx, 3, -1);
      ctx.fillStyle = "#e89030";
      ctx.beginPath();
      ctx.moveTo(0, 1);
      ctx.lineTo(-2.5, 4);
      ctx.lineTo(6, 3);
      ctx.closePath();
      ctx.fill();
      oval(ctx, 0, -8, 5, 2.5, "#f5f5f0");
      break;
    }
    case "shark": {
      oval(ctx, 0, 1, 11, 6.5, "#7090a8");
      ctx.fillStyle = "#5a7890";
      ctx.beginPath();
      ctx.moveTo(-2, -5);
      ctx.lineTo(2, -12);
      ctx.lineTo(4, -4);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(8, 1);
      ctx.lineTo(14, -4);
      ctx.lineTo(14, 6);
      ctx.closePath();
      ctx.fill();
      eye(ctx, -4, 0, 0.9);
      ctx.strokeStyle = "#2a3040";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-8, 3);
      ctx.quadraticCurveTo(-2, 6, 4, 3);
      ctx.stroke();
      break;
    }
    case "redpanda": {
      oval(ctx, -8, -6, 3.5, 4, "#e05030");
      oval(ctx, 8, -6, 3.5, 4, "#e05030");
      oval(ctx, -8, -6, 1.8, 2, "#f5d0c0");
      oval(ctx, 8, -6, 1.8, 2, "#f5d0c0");
      circle(ctx, 0, 1, 9.5, "#e86040", "#b03020", 1.2);
      oval(ctx, 0, 4, 5, 4, "#f5efe8");
      // eye patches
      oval(ctx, -3.5, 0, 2.8, 2.2, "#3a2018");
      oval(ctx, 3.5, 0, 2.8, 2.2, "#3a2018");
      eye(ctx, -3.2, 0, 0.9);
      eye(ctx, 3.2, 0, 0.9);
      oval(ctx, 0, 3, 1.4, 1.1, "#2a1810");
      break;
    }
    default: {
      circle(ctx, 0, 0, 9, "#d0c0b0", "#908070", 1.2);
      eye(ctx, -3, -1);
      eye(ctx, 3, -1);
    }
  }
}

function drawStars(
  ctx: CanvasRenderingContext2D,
  time: number,
  color: string,
  count = 7,
) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + time * 1.4;
    const rad = 15 + (i % 3) * 2.5 + Math.sin(time * 3 + i) * 1.5;
    const x = Math.cos(a) * rad;
    const y = Math.sin(a) * rad;
    const twinkle = 0.45 + 0.55 * Math.abs(Math.sin(time * 5 + i * 1.7));
    ctx.globalAlpha = twinkle;
    ctx.fillStyle = color;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.beginPath();
    for (let p = 0; p < 4; p++) {
      const ang = (p * Math.PI) / 2;
      ctx.lineTo(Math.cos(ang) * 2.4, Math.sin(ang) * 2.4);
      ctx.lineTo(Math.cos(ang + Math.PI / 4) * 1, Math.sin(ang + Math.PI / 4) * 1);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

const tintCanvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
if (tintCanvas) {
  tintCanvas.width = 48;
  tintCanvas.height = 48;
}

function drawTintedSpecies(
  ctx: CanvasRenderingContext2D,
  species: SpeciesId,
  tint: string,
  dx: number,
  dy: number,
  alpha: number,
) {
  if (!tintCanvas) return;
  const tctx = tintCanvas.getContext("2d")!;
  tctx.clearRect(0, 0, 48, 48);
  tctx.save();
  tctx.translate(24, 24);
  drawSpecies(tctx, species);
  tctx.globalCompositeOperation = "source-atop";
  tctx.fillStyle = tint;
  tctx.fillRect(-24, -24, 48, 48);
  tctx.restore();
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(tintCanvas, dx - 24, dy - 24);
  ctx.restore();
}

function drawRgbGhosts(
  ctx: CanvasRenderingContext2D,
  species: SpeciesId,
  time: number,
) {
  const ox = 1.8 + Math.sin(time * 4) * 0.6;
  const oy = Math.cos(time * 3.2) * 0.8;
  drawTintedSpecies(ctx, species, "rgba(255,40,90,0.85)", -ox, -oy, 0.55);
  drawTintedSpecies(ctx, species, "rgba(40,220,255,0.85)", ox, oy, 0.5);
  drawTintedSpecies(ctx, species, "rgba(120,255,80,0.7)", -oy * 0.5, ox * 0.4, 0.35);
}

export interface PortraitOpts {
  size?: number;
  time?: number;
  mega?: boolean;
  glowColor?: string;
  selected?: boolean;
}

/** Draw a friend portrait centered at (x,y) */
export function drawFriendPortrait(
  ctx: CanvasRenderingContext2D,
  def: FriendDef,
  x: number,
  y: number,
  opts: PortraitOpts = {},
) {
  const size = opts.size ?? 28;
  const time = opts.time ?? 0;
  const mega = opts.mega ?? isMegaPortrait(def.rarity, def.evolvedForm);
  const species = baseSpeciesFor(def);
  const scale = size / 28;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  if (mega) {
    // outer glow aura
    const glow = opts.glowColor || def.color;
    const g = ctx.createRadialGradient(0, 0, 6, 0, 0, 20);
    g.addColorStop(0, glow);
    g.addColorStop(0.45, glow);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    drawRgbGhosts(ctx, species, time);
    drawStars(ctx, time, def.rarity === "god" ? "#ffd24a" : "#e8d0ff", def.rarity === "god" ? 9 : 7);

    // slight mega scale pulse
    const pulse = 1 + Math.sin(time * 3) * 0.04;
    ctx.scale(pulse * 1.08, pulse * 1.08);
  }

  drawSpecies(ctx, species);

  if (mega) {
    // iridescent rim sparkles
    ctx.strokeStyle = def.rarity === "god" ? "#ff7050" : "#c080ff";
    ctx.lineWidth = 1.4;
    ctx.globalAlpha = 0.65 + Math.sin(time * 4) * 0.25;
    ctx.beginPath();
    ctx.arc(0, 0, 13.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

const portraitCache = new Map<string, string>();

/** Cached data-URL for bag / HTML UI */
export function friendPortraitDataUrl(def: FriendDef, size = 64): string {
  const mega = isMegaPortrait(def.rarity, def.evolvedForm);
  const key = `${def.id}:${size}:${mega ? "m" : "n"}`;
  const hit = portraitCache.get(key);
  if (hit) return hit;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  // soft pad behind
  ctx.fillStyle = def.color;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.46, 0, Math.PI * 2);
  ctx.fill();
  drawFriendPortrait(ctx, def, size / 2, size / 2, {
    size: size * 0.72,
    time: mega ? 0.8 : 0,
    mega,
    glowColor: def.color,
  });
  const url = canvas.toDataURL("image/png");
  portraitCache.set(key, url);
  return url;
}
