import { FRIENDS, type FriendDef, type Rarity } from "./data";

export type MathGrade = 4 | 5 | 6 | 7;
export type MathTopic = "arithmetic" | "preAlgebra" | "algebra" | "geometry" | "fractions";

export const MATH_GRADES: MathGrade[] = [4, 5, 6, 7];

const MATH_GRADE_KEY = "cookie-guard-math-grade-v1";

export interface MathQuestion {
  prompt: string;
  answer: number;
  accept: string[];
  topic: MathTopic;
  topicLabel: string;
  grade: MathGrade;
  hardness: 1 | 2 | 3;
  hint: string;
  /** Internal template id — used to avoid repeating the same kind */
  kind: string;
}

export function gradeLabel(g: MathGrade): string {
  if (g === 4) return "4th grade";
  if (g === 5) return "5th grade";
  if (g === 6) return "6th grade";
  return "7th grade";
}

export function gradeBlurb(g: MathGrade): string {
  if (g === 4) return "Multiply, divide, area & simple fractions → friend, gold, or stars";
  if (g === 5) return "Decimals, volume, fraction ops → better friend / bigger payouts";
  if (g === 6) return "Ratios, integers, expressions, triangles → stronger rewards";
  return "Algebra, proportions, circles & angles → best friend / gold / star odds";
}

export function loadMathGrade(): MathGrade {
  try {
    const raw = Number(localStorage.getItem(MATH_GRADE_KEY));
    if (raw === 4 || raw === 5 || raw === 6 || raw === 7) return raw;
  } catch {
    /* ignore */
  }
  return 4;
}

export function saveMathGrade(g: MathGrade) {
  try {
    localStorage.setItem(MATH_GRADE_KEY, String(g));
  } catch {
    /* ignore */
  }
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/** Fisher–Yates shuffle copy */
function shuffled<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Prefer kinds not used recently */
function pickKind<T extends string>(kinds: readonly T[], avoid: readonly string[]): T {
  const fresh = kinds.filter((k) => !avoid.includes(k));
  return pick(fresh.length ? fresh : kinds);
}

function pickHardness(): 1 | 2 | 3 {
  return pick([1, 1, 1, 2, 2, 2, 3, 3] as const);
}

/** Session history so prompts/kinds don't feel repetitive */
const recentPrompts: string[] = [];
const recentKinds: string[] = [];
const RECENT_PROMPT_LIMIT = 16;
const RECENT_KIND_LIMIT = 4;

function rememberQuestion(q: MathQuestion) {
  recentPrompts.push(q.prompt);
  while (recentPrompts.length > RECENT_PROMPT_LIMIT) recentPrompts.shift();
  recentKinds.push(q.kind);
  while (recentKinds.length > RECENT_KIND_LIMIT) recentKinds.shift();
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

function simplifyFraction(n: number, d: number): { n: number; d: number } {
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function acceptNumber(n: number, extras: string[] = []): string[] {
  const set = new Set<string>([String(n), ...extras]);
  if (!Number.isInteger(n)) {
    set.add(String(round2(n)));
    set.add(String(round1(n)));
  }
  return [...set];
}

/** Map grade + question hardness → reward rarity */
export function rewardRarityFor(grade: MathGrade, hardness: 1 | 2 | 3): Rarity {
  const score = (grade - 4) * 2 + hardness;
  const roll = Math.random() * 100;

  if (score <= 2) {
    if (roll < 78) return "common";
    if (roll < 97) return "rare";
    return "legendary";
  }
  if (score <= 4) {
    if (roll < 35) return "common";
    if (roll < 88) return "rare";
    return "legendary";
  }
  if (score <= 6) {
    if (roll < 12) return "common";
    if (roll < 62) return "rare";
    if (roll < 96) return "legendary";
    return "god";
  }
  if (roll < 8) return "rare";
  if (roll < 78) return "legendary";
  return "god";
}

export function rewardBlurb(grade: MathGrade): string {
  if (grade === 4) return "Correct → friend, gold, or stars (mostly Basic)";
  if (grade === 5) return "Correct → friend, gold, or stars (Tier 2 leans)";
  if (grade === 6) return "Correct → friend, gold, or stars (stronger)";
  return "Correct → friend, gold, or stars (Legendary leans)";
}

export type MathRewardKind = "friend" | "gold" | "stars";

export type MathReward =
  | { kind: "friend"; friend: FriendDef }
  | { kind: "gold"; amount: number }
  | { kind: "stars"; amount: number };

/** Gold payout scales with grade + question hardness */
export function mathGoldAmount(grade: MathGrade, hardness: 1 | 2 | 3): number {
  const base = 6 + (grade - 4) * 5 + hardness * 4;
  const bonus = randInt(0, 3 + (grade - 4));
  return base + bonus;
}

/** Star payout — harder grades can earn 2–3 */
export function mathStarAmount(grade: MathGrade, hardness: 1 | 2 | 3): number {
  const score = (grade - 4) * 2 + hardness;
  if (score >= 7) return pick([2, 2, 3] as const);
  if (score >= 4) return pick([1, 2, 2] as const);
  return 1;
}

export function pickFriendForMath(grade: MathGrade, hardness: 1 | 2 | 3): FriendDef {
  const rarity = rewardRarityFor(grade, hardness);
  if (rarity === "god") {
    return FRIENDS.find((f) => f.id === "redpanda")!;
  }
  const pool = FRIENDS.filter(
    (f) => !f.evolvedForm && f.rarity === rarity && f.id !== "redpanda",
  );
  if (!pool.length) {
    return FRIENDS.find((f) => f.rarity === "common" && !f.evolvedForm)!;
  }
  return pool[Math.floor(Math.random() * pool.length)]!;
}

/** Random reward: new friend, gold, or stars (weights favor friends a bit) */
export function pickMathReward(grade: MathGrade, hardness: 1 | 2 | 3): MathReward {
  const roll = Math.random() * 100;
  if (roll < 42) {
    return { kind: "friend", friend: pickFriendForMath(grade, hardness) };
  }
  if (roll < 74) {
    return { kind: "gold", amount: mathGoldAmount(grade, hardness) };
  }
  return { kind: "stars", amount: mathStarAmount(grade, hardness) };
}

export function formatMathReward(reward: MathReward): string {
  if (reward.kind === "friend") {
    const f = reward.friend;
    const tag =
      f.rarity === "god"
        ? "GOD!"
        : f.rarity === "legendary"
          ? "LEGENDARY!"
          : f.rarity === "rare"
            ? "Tier 2!"
            : f.name;
    return `${f.emoji} ${tag}`;
  }
  if (reward.kind === "gold") return `+${reward.amount}🪙 gold`;
  return `+${reward.amount}⭐ star${reward.amount === 1 ? "" : "s"}`;
}

function q4(avoidKinds: readonly string[]): MathQuestion {
  const kind = pickKind(
    ["mul", "div", "area", "frac", "add", "sub", "perim", "missing"] as const,
    avoidKinds,
  );
  const hardness = pickHardness();

  if (kind === "mul") {
    const a = randInt(6, hardness === 3 ? 12 : 10);
    const b = randInt(4, hardness === 3 ? 12 : 9);
    return {
      prompt: pick([
        `What is ${a} × ${b}?`,
        `Find the product of ${a} and ${b}.`,
        `Compute ${a} × ${b}.`,
        `${a} times ${b} equals…?`,
      ]),
      answer: a * b,
      accept: acceptNumber(a * b),
      topic: "arithmetic",
      topicLabel: "Arithmetic",
      grade: 4,
      hardness,
      hint: "Multiply the two numbers.",
      kind,
    };
  }
  if (kind === "div") {
    const b = randInt(3, 9);
    const q = randInt(4, hardness === 3 ? 12 : 10);
    const a = b * q;
    return {
      prompt: pick([
        `What is ${a} ÷ ${b}?`,
        `How many times does ${b} go into ${a}?`,
        `Divide ${a} by ${b}.`,
        `${a} ÷ ${b} = ?`,
      ]),
      answer: q,
      accept: acceptNumber(q),
      topic: "arithmetic",
      topicLabel: "Arithmetic",
      grade: 4,
      hardness,
      hint: "How many groups of the divisor fit into the dividend?",
      kind,
    };
  }
  if (kind === "area") {
    const w = randInt(4, 12);
    const h = randInt(3, 10);
    return {
      prompt: pick([
        `A rectangle is ${w} units by ${h} units. What is its area?`,
        `Find the area of a ${w}×${h} rectangle.`,
        `Cookie tray ${w} by ${h} — what is the area?`,
      ]),
      answer: w * h,
      accept: acceptNumber(w * h),
      topic: "geometry",
      topicLabel: "Geometry",
      grade: 4,
      hardness,
      hint: "Area of a rectangle = length × width.",
      kind,
    };
  }
  if (kind === "perim") {
    const s = randInt(3, 14);
    return {
      prompt: pick([
        `A square has side length ${s}. What is its perimeter?`,
        `Find the perimeter of a square with side ${s}.`,
      ]),
      answer: 4 * s,
      accept: acceptNumber(4 * s),
      topic: "geometry",
      topicLabel: "Geometry",
      grade: 4,
      hardness,
      hint: "Perimeter of a square = 4 × side.",
      kind,
    };
  }
  if (kind === "frac") {
    const d = pick([2, 3, 4, 5, 6, 8]);
    const n = randInt(1, d - 1);
    const whole = randInt(2, 5);
    const ans = whole * n;
    const total = whole * d;
    return {
      prompt: pick([
        `What is ${n}/${d} of ${total}?`,
        `Find ${n}/${d} of ${total}.`,
        `${n} out of ${d} equal parts of ${total} is…?`,
      ]),
      answer: ans,
      accept: acceptNumber(ans),
      topic: "fractions",
      topicLabel: "Fractions",
      grade: 4,
      hardness,
      hint: `Divide ${total} into ${d} equal parts, then take ${n} parts.`,
      kind,
    };
  }
  if (kind === "missing") {
    const a = randInt(4, 9);
    const b = randInt(3, 9);
    const product = a * b;
    return {
      prompt: pick([
        `${a} × ? = ${product}. What is the missing number?`,
        `Fill in the blank: ${a} × ___ = ${product}`,
      ]),
      answer: b,
      accept: acceptNumber(b),
      topic: "arithmetic",
      topicLabel: "Arithmetic",
      grade: 4,
      hardness,
      hint: `Divide ${product} by ${a}.`,
      kind,
    };
  }
  if (kind === "add") {
    const a = randInt(100, hardness === 3 ? 900 : 500);
    const b = randInt(50, hardness === 3 ? 400 : 250);
    return {
      prompt: pick([
        `What is ${a} + ${b}?`,
        `Add ${a} and ${b}.`,
        `${a} + ${b} = ?`,
      ]),
      answer: a + b,
      accept: acceptNumber(a + b),
      topic: "arithmetic",
      topicLabel: "Arithmetic",
      grade: 4,
      hardness,
      hint: "Add carefully — watch the place values.",
      kind,
    };
  }
  const a = randInt(200, 900);
  const b = randInt(40, Math.min(180, a - 10));
  return {
    prompt: pick([
      `What is ${a} − ${b}?`,
      `Subtract ${b} from ${a}.`,
      `${a} − ${b} = ?`,
    ]),
    answer: a - b,
    accept: acceptNumber(a - b),
    topic: "arithmetic",
    topicLabel: "Arithmetic",
    grade: 4,
    hardness,
    hint: "Subtract — borrow if you need to.",
    kind: "sub",
  };
}

function q5(avoidKinds: readonly string[]): MathQuestion {
  const kind = pickKind(
    ["dec", "decSub", "vol", "fracAdd", "peri", "div", "pctIntro", "fracOf"] as const,
    avoidKinds,
  );
  const hardness = pickHardness();

  if (kind === "dec") {
    const a = round1(randInt(15, 80) / 10);
    const b = round1(randInt(12, 60) / 10);
    const ans = round1(a + b);
    return {
      prompt: pick([
        `What is ${a} + ${b}?`,
        `Add the decimals: ${a} + ${b}`,
        `${a} + ${b} = ?`,
      ]),
      answer: ans,
      accept: acceptNumber(ans),
      topic: "arithmetic",
      topicLabel: "Decimals",
      grade: 5,
      hardness,
      hint: "Line up the decimal points, then add.",
      kind,
    };
  }
  if (kind === "decSub") {
    const a = round1(randInt(40, 99) / 10);
    const b = round1(randInt(10, Math.floor(a * 10) - 1) / 10);
    const ans = round1(a - b);
    return {
      prompt: pick([
        `What is ${a} − ${b}?`,
        `Subtract: ${a} − ${b}`,
      ]),
      answer: ans,
      accept: acceptNumber(ans),
      topic: "arithmetic",
      topicLabel: "Decimals",
      grade: 5,
      hardness,
      hint: "Line up the decimal points, then subtract.",
      kind,
    };
  }
  if (kind === "vol") {
    const l = randInt(3, 8);
    const w = randInt(2, 7);
    const h = randInt(2, 6);
    return {
      prompt: pick([
        `A box is ${l}×${w}×${h}. What is its volume?`,
        `Find the volume of a ${l} by ${w} by ${h} box.`,
        `Cookie crate ${l}×${w}×${h} — volume?`,
      ]),
      answer: l * w * h,
      accept: acceptNumber(l * w * h),
      topic: "geometry",
      topicLabel: "Geometry",
      grade: 5,
      hardness,
      hint: "Volume of a rectangular prism = length × width × height.",
      kind,
    };
  }
  if (kind === "fracAdd") {
    const d = pick([4, 6, 8, 10, 12]);
    const n1 = randInt(1, Math.floor(d / 2));
    const n2 = randInt(1, d - n1 - 1);
    const sum = simplifyFraction(n1 + n2, d);
    const ans = sum.n / sum.d;
    const mixed = sum.d === 1 ? String(sum.n) : `${sum.n}/${sum.d}`;
    return {
      prompt: pick([
        `What is ${n1}/${d} + ${n2}/${d}? (simplify)`,
        `Add and simplify: ${n1}/${d} + ${n2}/${d}`,
      ]),
      answer: ans,
      accept: acceptNumber(ans, [mixed, `${n1 + n2}/${d}`]),
      topic: "fractions",
      topicLabel: "Fractions",
      grade: 5,
      hardness,
      hint: "Same denominator — add the numerators, then simplify.",
      kind,
    };
  }
  if (kind === "fracOf") {
    const d = pick([2, 4, 5, 8, 10]);
    const n = randInt(1, d - 1);
    const total = d * randInt(3, 12);
    const ans = (total * n) / d;
    return {
      prompt: pick([
        `What is ${n}/${d} of ${total}?`,
        `Find ${n}/${d} of ${total} cookies.`,
      ]),
      answer: ans,
      accept: acceptNumber(ans),
      topic: "fractions",
      topicLabel: "Fractions",
      grade: 5,
      hardness,
      hint: `Multiply ${total} by ${n}/${d}.`,
      kind,
    };
  }
  if (kind === "peri") {
    const w = randInt(5, 14);
    const h = randInt(3, 12);
    return {
      prompt: pick([
        `A rectangle is ${w} by ${h}. What is its perimeter?`,
        `Find the perimeter of a ${w}×${h} rectangle.`,
      ]),
      answer: 2 * (w + h),
      accept: acceptNumber(2 * (w + h)),
      topic: "geometry",
      topicLabel: "Geometry",
      grade: 5,
      hardness,
      hint: "Perimeter = 2 × (length + width).",
      kind,
    };
  }
  if (kind === "pctIntro") {
    const whole = pick([20, 25, 40, 50, 80, 100]);
    const pct = pick([10, 20, 25, 50]);
    const ans = (whole * pct) / 100;
    return {
      prompt: pick([
        `What is ${pct}% of ${whole}?`,
        `Find ${pct} percent of ${whole}.`,
      ]),
      answer: ans,
      accept: acceptNumber(ans),
      topic: "preAlgebra",
      topicLabel: "Pre-algebra",
      grade: 5,
      hardness,
      hint: `${pct}% means ${pct}/100 of the number.`,
      kind,
    };
  }
  const b = randInt(4, 12);
  const q = randInt(5, hardness === 3 ? 15 : 12);
  const a = b * q;
  return {
    prompt: pick([
      `What is ${a} ÷ ${b}?`,
      `Divide ${a} by ${b}.`,
    ]),
    answer: q,
    accept: acceptNumber(q),
    topic: "arithmetic",
    topicLabel: "Arithmetic",
    grade: 5,
    hardness,
    hint: "Divide to find the quotient.",
    kind: "div",
  };
}

function q6(avoidKinds: readonly string[]): MathQuestion {
  const kind = pickKind(
    ["ratio", "int", "expr", "triArea", "pct", "coord", "order", "mean"] as const,
    avoidKinds,
  );
  const hardness = pickHardness();

  if (kind === "ratio") {
    const a = randInt(2, 8);
    const b = randInt(2, 8);
    const k = randInt(2, 6);
    return {
      prompt: pick([
        `A recipe uses ${a} cups flour for ${b} cups sugar. How many cups flour for ${b * k} cups sugar?`,
        `Scale the ratio ${a}:${b}. If sugar is ${b * k}, how much flour?`,
      ]),
      answer: a * k,
      accept: acceptNumber(a * k),
      topic: "preAlgebra",
      topicLabel: "Ratios",
      grade: 6,
      hardness,
      hint: "Keep the same ratio — scale both parts equally.",
      kind,
    };
  }
  if (kind === "int") {
    const a = randInt(-12, -2);
    const b = randInt(3, 15);
    const op = pick(["+", "-"] as const);
    const ans = op === "+" ? a + b : a - b;
    return {
      prompt: pick([
        `What is ${a} ${op} ${b}?`,
        `Compute ${a} ${op} ${b}.`,
      ]),
      answer: ans,
      accept: acceptNumber(ans),
      topic: "preAlgebra",
      topicLabel: "Integers",
      grade: 6,
      hardness,
      hint: "Use a number line for negative integers.",
      kind,
    };
  }
  if (kind === "expr") {
    const x = randInt(2, 9);
    const a = randInt(2, 6);
    const b = randInt(1, 12);
    const ans = a * x + b;
    return {
      prompt: pick([
        `If x = ${x}, what is ${a}x + ${b}?`,
        `Evaluate ${a}x + ${b} when x = ${x}.`,
      ]),
      answer: ans,
      accept: acceptNumber(ans),
      topic: "algebra",
      topicLabel: "Algebra",
      grade: 6,
      hardness,
      hint: "Substitute x, then multiply and add.",
      kind,
    };
  }
  if (kind === "order") {
    const a = randInt(2, 6);
    const b = randInt(2, 5);
    const c = randInt(1, 8);
    const ans = a + b * c;
    return {
      prompt: pick([
        `What is ${a} + ${b} × ${c}?`,
        `Evaluate: ${a} + ${b} × ${c}`,
      ]),
      answer: ans,
      accept: acceptNumber(ans),
      topic: "preAlgebra",
      topicLabel: "Order of operations",
      grade: 6,
      hardness,
      hint: "Multiply before you add.",
      kind,
    };
  }
  if (kind === "mean") {
    const nums = shuffled([randInt(4, 20), randInt(4, 20), randInt(4, 20), randInt(4, 20)]).slice(0, 3);
    const third = randInt(2, 18);
    const adjusted = [nums[0]!, nums[1]!, third];
    // make sum divisible by 3
    const s0 = adjusted[0]! + adjusted[1]! + adjusted[2]!;
    const fix = (3 - (s0 % 3)) % 3;
    adjusted[2] = adjusted[2]! + fix;
    const ans = (adjusted[0]! + adjusted[1]! + adjusted[2]!) / 3;
    return {
      prompt: pick([
        `What is the mean (average) of ${adjusted[0]}, ${adjusted[1]}, and ${adjusted[2]}?`,
        `Find the average of ${adjusted.join(", ")}.`,
      ]),
      answer: ans,
      accept: acceptNumber(ans),
      topic: "preAlgebra",
      topicLabel: "Statistics",
      grade: 6,
      hardness,
      hint: "Add the numbers, then divide by how many there are.",
      kind,
    };
  }
  if (kind === "triArea") {
    const height = randInt(3, 12);
    let b2 = randInt(4, 14);
    if (b2 % 2 !== 0 && height % 2 !== 0) b2 += 1;
    const ans = (b2 * height) / 2;
    return {
      prompt: pick([
        `A triangle has base ${b2} and height ${height}. What is its area?`,
        `Find the area of a triangle with base ${b2} and height ${height}.`,
      ]),
      answer: ans,
      accept: acceptNumber(ans),
      topic: "geometry",
      topicLabel: "Geometry",
      grade: 6,
      hardness,
      hint: "Area of a triangle = (1/2) × base × height.",
      kind,
    };
  }
  if (kind === "pct") {
    const whole = pick([40, 50, 60, 80, 120, 200]);
    const pct = pick([15, 20, 25, 30, 40, 75]);
    const ans = (whole * pct) / 100;
    return {
      prompt: pick([
        `What is ${pct}% of ${whole}?`,
        `Find ${pct}% of ${whole}.`,
      ]),
      answer: ans,
      accept: acceptNumber(ans),
      topic: "preAlgebra",
      topicLabel: "Percents",
      grade: 6,
      hardness,
      hint: "Percent means per hundred.",
      kind,
    };
  }
  const x1 = randInt(-4, 5);
  const y1 = randInt(-4, 5);
  const x2 = x1 + randInt(2, 6);
  const y2 = y1;
  const dist = Math.abs(x2 - x1);
  return {
    prompt: pick([
      `Points (${x1}, ${y1}) and (${x2}, ${y2}) are on a horizontal line. What is the distance between them?`,
      `Distance between (${x1}, ${y1}) and (${x2}, ${y2})?`,
    ]),
    answer: dist,
    accept: acceptNumber(dist),
    topic: "geometry",
    topicLabel: "Coordinate plane",
    grade: 6,
    hardness,
    hint: "On a horizontal line, distance = |x₂ − x₁|.",
    kind: "coord",
  };
}

function q7(avoidKinds: readonly string[]): MathQuestion {
  const kind = pickKind(
    ["solve", "prop", "circle", "angle", "twostep", "ineq", "dist", "comp"] as const,
    avoidKinds,
  );
  const hardness = pickHardness();

  if (kind === "solve") {
    const x = randInt(2, 12);
    const a = randInt(2, 8);
    const b = a * x;
    return {
      prompt: pick([
        `Solve for x: ${a}x = ${b}`,
        `Find x if ${a}x = ${b}.`,
      ]),
      answer: x,
      accept: acceptNumber(x),
      topic: "algebra",
      topicLabel: "Algebra",
      grade: 7,
      hardness,
      hint: `Divide both sides by ${a}.`,
      kind,
    };
  }
  if (kind === "prop") {
    const a = randInt(2, 9);
    const b = randInt(2, 9);
    const c = a * randInt(2, 5);
    const d = (b * c) / a;
    return {
      prompt: pick([
        `Solve the proportion: ${a}/${b} = ${c}/x. What is x?`,
        `If ${a}/${b} = ${c}/x, find x.`,
      ]),
      answer: d,
      accept: acceptNumber(d),
      topic: "algebra",
      topicLabel: "Proportions",
      grade: 7,
      hardness,
      hint: "Cross-multiply: a·x = b·c, then solve for x.",
      kind,
    };
  }
  if (kind === "circle") {
    const r = randInt(2, 10);
    if (hardness >= 2 && Math.random() < 0.5) {
      return {
        prompt: pick([
          `A circle has radius ${r}. What is its area? Use π ≈ 3.14 (round to 1 decimal).`,
          `Find the area of a circle with radius ${r} (π ≈ 3.14, 1 decimal).`,
        ]),
        answer: round1(3.14 * r * r),
        accept: acceptNumber(round1(3.14 * r * r)),
        topic: "geometry",
        topicLabel: "Geometry",
        grade: 7,
        hardness,
        hint: "Area = πr².",
        kind,
      };
    }
    const circ = round1(2 * 3.14 * r);
    return {
      prompt: pick([
        `A circle has radius ${r}. What is its circumference? Use π ≈ 3.14 (round to 1 decimal).`,
        `Circumference of a circle with radius ${r} (π ≈ 3.14, 1 decimal)?`,
      ]),
      answer: circ,
      accept: acceptNumber(circ),
      topic: "geometry",
      topicLabel: "Geometry",
      grade: 7,
      hardness,
      hint: "Circumference = 2πr.",
      kind,
    };
  }
  if (kind === "angle") {
    const a = randInt(30, 80);
    const b = randInt(30, 80);
    const c = 180 - a - b;
    if (c <= 0) return q7(avoidKinds);
    return {
      prompt: pick([
        `A triangle has angles ${a}° and ${b}°. What is the third angle in degrees?`,
        `Two angles of a triangle are ${a}° and ${b}°. Find the third.`,
      ]),
      answer: c,
      accept: acceptNumber(c),
      topic: "geometry",
      topicLabel: "Geometry",
      grade: 7,
      hardness,
      hint: "Angles in a triangle add to 180°.",
      kind,
    };
  }
  if (kind === "comp") {
    const a = randInt(15, 75);
    return {
      prompt: pick([
        `Angles that add to 90° are complementary. If one is ${a}°, what is the other?`,
        `Find the complement of ${a}°.`,
      ]),
      answer: 90 - a,
      accept: acceptNumber(90 - a),
      topic: "geometry",
      topicLabel: "Geometry",
      grade: 7,
      hardness,
      hint: "Complementary angles add to 90°.",
      kind,
    };
  }
  if (kind === "dist") {
    const a = randInt(2, 6);
    const b = randInt(1, 10);
    const x = randInt(2, 9);
    const inner = x + b;
    const right = a * inner;
    return {
      prompt: pick([
        `Solve for x: ${a}(x + ${b}) = ${right}`,
        `Find x: ${a}(x + ${b}) = ${right}`,
      ]),
      answer: x,
      accept: acceptNumber(x),
      topic: "algebra",
      topicLabel: "Algebra",
      grade: 7,
      hardness,
      hint: `Divide both sides by ${a}, then subtract ${b}.`,
      kind,
    };
  }
  if (kind === "twostep") {
    const x = randInt(2, 10);
    const a = randInt(2, 6);
    const b = randInt(1, 15);
    const c = a * x + b;
    return {
      prompt: pick([
        `Solve for x: ${a}x + ${b} = ${c}`,
        `Find x if ${a}x + ${b} = ${c}.`,
      ]),
      answer: x,
      accept: acceptNumber(x),
      topic: "algebra",
      topicLabel: "Algebra",
      grade: 7,
      hardness,
      hint: `Subtract ${b} from both sides, then divide by ${a}.`,
      kind,
    };
  }
  const a = pick([2, 3, 4, 5]);
  const x = randInt(3, 9);
  const n = a * x - 1;
  return {
    prompt: pick([
      `What is the smallest integer x such that ${a}x > ${n}?`,
      `Smallest integer x with ${a}x > ${n}?`,
    ]),
    answer: x,
    accept: acceptNumber(x),
    topic: "algebra",
    topicLabel: "Inequalities",
    grade: 7,
    hardness,
    hint: `Divide by ${a}, then take the smallest integer greater than the result.`,
    kind: "ineq",
  };
}

export function generateMathQuestion(grade: MathGrade): MathQuestion {
  const make = grade === 4 ? q4 : grade === 5 ? q5 : grade === 6 ? q6 : q7;
  let best: MathQuestion | null = null;
  for (let attempt = 0; attempt < 28; attempt++) {
    const q = make(recentKinds);
    const promptHit = recentPrompts.includes(q.prompt);
    const kindHit = recentKinds.includes(q.kind);
    if (!promptHit && !kindHit) {
      rememberQuestion(q);
      return q;
    }
    if (!promptHit && (!best || kindHit)) {
      best = q;
    }
    if (!promptHit && attempt >= 10) {
      rememberQuestion(q);
      return q;
    }
  }
  const fallback = best ?? make([]);
  rememberQuestion(fallback);
  return fallback;
}

export function parseMathAnswer(raw: string): number | null {
  const s = raw.trim().replace(/,/g, "").replace(/\s+/g, "");
  if (!s) return null;
  const frac = /^(-?\d+)\/(-?\d+)$/.exec(s);
  if (frac) {
    const n = Number(frac[1]);
    const d = Number(frac[2]);
    if (!d || !Number.isFinite(n) || !Number.isFinite(d)) return null;
    return n / d;
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return n;
}

export function checkMathAnswer(q: MathQuestion, raw: string): boolean {
  const parsed = parseMathAnswer(raw);
  if (parsed == null) {
    const norm = raw.trim().toLowerCase().replace(/\s+/g, "");
    return q.accept.some((a) => a.toLowerCase().replace(/\s+/g, "") === norm);
  }
  if (
    q.accept.some((a) => {
      const p = parseMathAnswer(a);
      return p != null && Math.abs(p - parsed) < 0.051;
    })
  ) {
    return true;
  }
  return Math.abs(parsed - q.answer) < 0.051;
}
