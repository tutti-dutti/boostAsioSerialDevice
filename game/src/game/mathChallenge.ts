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
}

export function gradeLabel(g: MathGrade): string {
  if (g === 4) return "4th grade";
  if (g === 5) return "5th grade";
  if (g === 6) return "6th grade";
  return "7th grade";
}

export function gradeBlurb(g: MathGrade): string {
  if (g === 4) return "Multiply, divide, area & simple fractions → mostly Basic friends";
  if (g === 5) return "Decimals, volume, fraction ops → Tier 2 friends more often";
  if (g === 6) return "Ratios, integers, expressions, triangles → stronger rewards";
  return "Algebra, proportions, circles & angles → Legendary-leaning rewards";
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

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
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
  if (grade === 4) return "Correct → mostly Basic friends";
  if (grade === 5) return "Correct → often Tier 2 friends";
  if (grade === 6) return "Correct → Tier 2 / Legendary friends";
  return "Correct → Legendary friends (rare GOD!)";
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

function q4(): MathQuestion {
  const kind = pick(["mul", "div", "area", "frac", "add", "sub"] as const);
  const hardness = pick([1, 1, 2, 2, 3] as const);

  if (kind === "mul") {
    const a = randInt(6, hardness === 3 ? 12 : 10);
    const b = randInt(4, hardness === 3 ? 12 : 9);
    return {
      prompt: `What is ${a} × ${b}?`,
      answer: a * b,
      accept: acceptNumber(a * b),
      topic: "arithmetic",
      topicLabel: "Arithmetic",
      grade: 4,
      hardness,
      hint: "Multiply the two numbers.",
    };
  }
  if (kind === "div") {
    const b = randInt(3, 9);
    const q = randInt(4, hardness === 3 ? 12 : 10);
    const a = b * q;
    return {
      prompt: `What is ${a} ÷ ${b}?`,
      answer: q,
      accept: acceptNumber(q),
      topic: "arithmetic",
      topicLabel: "Arithmetic",
      grade: 4,
      hardness,
      hint: "How many groups of the divisor fit into the dividend?",
    };
  }
  if (kind === "area") {
    const w = randInt(4, 12);
    const h = randInt(3, 10);
    return {
      prompt: `A rectangle is ${w} units by ${h} units. What is its area?`,
      answer: w * h,
      accept: acceptNumber(w * h),
      topic: "geometry",
      topicLabel: "Geometry",
      grade: 4,
      hardness,
      hint: "Area of a rectangle = length × width.",
    };
  }
  if (kind === "frac") {
    const d = pick([2, 3, 4, 5, 6, 8]);
    const n = randInt(1, d - 1);
    const whole = randInt(2, 5);
    const ans = whole * n;
    const total = whole * d;
    return {
      prompt: `What is ${n}/${d} of ${total}?`,
      answer: ans,
      accept: acceptNumber(ans),
      topic: "fractions",
      topicLabel: "Fractions",
      grade: 4,
      hardness,
      hint: `Divide ${total} into ${d} equal parts, then take ${n} parts.`,
    };
  }
  if (kind === "add") {
    const a = randInt(100, hardness === 3 ? 900 : 500);
    const b = randInt(50, hardness === 3 ? 400 : 250);
    return {
      prompt: `What is ${a} + ${b}?`,
      answer: a + b,
      accept: acceptNumber(a + b),
      topic: "arithmetic",
      topicLabel: "Arithmetic",
      grade: 4,
      hardness,
      hint: "Add carefully — watch the place values.",
    };
  }
  const a = randInt(200, 900);
  const b = randInt(40, Math.min(180, a - 10));
  return {
    prompt: `What is ${a} − ${b}?`,
    answer: a - b,
    accept: acceptNumber(a - b),
    topic: "arithmetic",
    topicLabel: "Arithmetic",
    grade: 4,
    hardness,
    hint: "Subtract — borrow if you need to.",
  };
}

function q5(): MathQuestion {
  const kind = pick(["dec", "vol", "fracAdd", "peri", "div", "pctIntro"] as const);
  const hardness = pick([1, 1, 2, 2, 3] as const);

  if (kind === "dec") {
    const a = round1(randInt(15, 80) / 10);
    const b = round1(randInt(12, 60) / 10);
    const ans = round1(a + b);
    return {
      prompt: `What is ${a} + ${b}?`,
      answer: ans,
      accept: acceptNumber(ans),
      topic: "arithmetic",
      topicLabel: "Decimals",
      grade: 5,
      hardness,
      hint: "Line up the decimal points, then add.",
    };
  }
  if (kind === "vol") {
    const l = randInt(3, 8);
    const w = randInt(2, 7);
    const h = randInt(2, 6);
    return {
      prompt: `A box is ${l}×${w}×${h}. What is its volume?`,
      answer: l * w * h,
      accept: acceptNumber(l * w * h),
      topic: "geometry",
      topicLabel: "Geometry",
      grade: 5,
      hardness,
      hint: "Volume of a rectangular prism = length × width × height.",
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
      prompt: `What is ${n1}/${d} + ${n2}/${d}? (simplify)`,
      answer: ans,
      accept: acceptNumber(ans, [mixed, `${n1 + n2}/${d}`]),
      topic: "fractions",
      topicLabel: "Fractions",
      grade: 5,
      hardness,
      hint: "Same denominator — add the numerators, then simplify.",
    };
  }
  if (kind === "peri") {
    const w = randInt(5, 14);
    const h = randInt(3, 12);
    return {
      prompt: `A rectangle is ${w} by ${h}. What is its perimeter?`,
      answer: 2 * (w + h),
      accept: acceptNumber(2 * (w + h)),
      topic: "geometry",
      topicLabel: "Geometry",
      grade: 5,
      hardness,
      hint: "Perimeter = 2 × (length + width).",
    };
  }
  if (kind === "pctIntro") {
    const whole = pick([20, 25, 40, 50, 80, 100]);
    const pct = pick([10, 20, 25, 50]);
    const ans = (whole * pct) / 100;
    return {
      prompt: `What is ${pct}% of ${whole}?`,
      answer: ans,
      accept: acceptNumber(ans),
      topic: "preAlgebra",
      topicLabel: "Pre-algebra",
      grade: 5,
      hardness,
      hint: `${pct}% means ${pct}/100 of the number.`,
    };
  }
  const b = randInt(4, 12);
  const q = randInt(5, hardness === 3 ? 15 : 12);
  const a = b * q;
  return {
    prompt: `What is ${a} ÷ ${b}?`,
    answer: q,
    accept: acceptNumber(q),
    topic: "arithmetic",
    topicLabel: "Arithmetic",
    grade: 5,
    hardness,
    hint: "Divide to find the quotient.",
  };
}

function q6(): MathQuestion {
  const kind = pick(["ratio", "int", "expr", "triArea", "pct", "coord"] as const);
  const hardness = pick([1, 1, 2, 2, 3] as const);

  if (kind === "ratio") {
    const a = randInt(2, 8);
    const b = randInt(2, 8);
    const k = randInt(2, 6);
    return {
      prompt: `A recipe uses ${a} cups flour for ${b} cups sugar. How many cups flour for ${b * k} cups sugar?`,
      answer: a * k,
      accept: acceptNumber(a * k),
      topic: "preAlgebra",
      topicLabel: "Ratios",
      grade: 6,
      hardness,
      hint: "Keep the same ratio — scale both parts equally.",
    };
  }
  if (kind === "int") {
    const a = randInt(-12, -2);
    const b = randInt(3, 15);
    const op = pick(["+", "-"] as const);
    const ans = op === "+" ? a + b : a - b;
    return {
      prompt: `What is ${a} ${op} ${b}?`,
      answer: ans,
      accept: acceptNumber(ans),
      topic: "preAlgebra",
      topicLabel: "Integers",
      grade: 6,
      hardness,
      hint: "Use a number line for negative integers.",
    };
  }
  if (kind === "expr") {
    const x = randInt(2, 9);
    const a = randInt(2, 6);
    const b = randInt(1, 12);
    const ans = a * x + b;
    return {
      prompt: `If x = ${x}, what is ${a}x + ${b}?`,
      answer: ans,
      accept: acceptNumber(ans),
      topic: "algebra",
      topicLabel: "Algebra",
      grade: 6,
      hardness,
      hint: "Substitute x, then multiply and add.",
    };
  }
  if (kind === "triArea") {
    const height = randInt(3, 12);
    let b2 = randInt(4, 14);
    if (b2 % 2 !== 0 && height % 2 !== 0) b2 += 1;
    const ans = (b2 * height) / 2;
    return {
      prompt: `A triangle has base ${b2} and height ${height}. What is its area?`,
      answer: ans,
      accept: acceptNumber(ans),
      topic: "geometry",
      topicLabel: "Geometry",
      grade: 6,
      hardness,
      hint: "Area of a triangle = (1/2) × base × height.",
    };
  }
  if (kind === "pct") {
    const whole = pick([40, 50, 60, 80, 120, 200]);
    const pct = pick([15, 20, 25, 30, 40, 75]);
    const ans = (whole * pct) / 100;
    return {
      prompt: `What is ${pct}% of ${whole}?`,
      answer: ans,
      accept: acceptNumber(ans),
      topic: "preAlgebra",
      topicLabel: "Percents",
      grade: 6,
      hardness,
      hint: "Percent means per hundred.",
    };
  }
  const x1 = randInt(-4, 5);
  const y1 = randInt(-4, 5);
  const x2 = x1 + randInt(2, 6);
  const y2 = y1;
  const dist = Math.abs(x2 - x1);
  return {
    prompt: `Points (${x1}, ${y1}) and (${x2}, ${y2}) are on a horizontal line. What is the distance between them?`,
    answer: dist,
    accept: acceptNumber(dist),
    topic: "geometry",
    topicLabel: "Coordinate plane",
    grade: 6,
    hardness,
    hint: "On a horizontal line, distance = |x₂ − x₁|.",
  };
}

function q7(): MathQuestion {
  const kind = pick(["solve", "prop", "circle", "angle", "twostep", "ineq"] as const);
  const hardness = pick([1, 1, 2, 2, 3] as const);

  if (kind === "solve") {
    const x = randInt(2, 12);
    const a = randInt(2, 8);
    const b = a * x;
    return {
      prompt: `Solve for x: ${a}x = ${b}`,
      answer: x,
      accept: acceptNumber(x),
      topic: "algebra",
      topicLabel: "Algebra",
      grade: 7,
      hardness,
      hint: `Divide both sides by ${a}.`,
    };
  }
  if (kind === "prop") {
    const a = randInt(2, 9);
    const b = randInt(2, 9);
    const c = a * randInt(2, 5);
    const d = (b * c) / a;
    return {
      prompt: `Solve the proportion: ${a}/${b} = ${c}/x. What is x?`,
      answer: d,
      accept: acceptNumber(d),
      topic: "algebra",
      topicLabel: "Proportions",
      grade: 7,
      hardness,
      hint: "Cross-multiply: a·x = b·c, then solve for x.",
    };
  }
  if (kind === "circle") {
    const r = randInt(2, 10);
    if (hardness >= 2 && Math.random() < 0.5) {
      return {
        prompt: `A circle has radius ${r}. What is its area? Use π ≈ 3.14 (round to 1 decimal).`,
        answer: round1(3.14 * r * r),
        accept: acceptNumber(round1(3.14 * r * r)),
        topic: "geometry",
        topicLabel: "Geometry",
        grade: 7,
        hardness,
        hint: "Area = πr².",
      };
    }
    const circ = round1(2 * 3.14 * r);
    return {
      prompt: `A circle has radius ${r}. What is its circumference? Use π ≈ 3.14 (round to 1 decimal).`,
      answer: circ,
      accept: acceptNumber(circ),
      topic: "geometry",
      topicLabel: "Geometry",
      grade: 7,
      hardness,
      hint: "Circumference = 2πr.",
    };
  }
  if (kind === "angle") {
    const a = randInt(30, 80);
    const b = randInt(30, 80);
    const c = 180 - a - b;
    if (c <= 0) return q7();
    return {
      prompt: `A triangle has angles ${a}° and ${b}°. What is the third angle in degrees?`,
      answer: c,
      accept: acceptNumber(c),
      topic: "geometry",
      topicLabel: "Geometry",
      grade: 7,
      hardness,
      hint: "Angles in a triangle add to 180°.",
    };
  }
  if (kind === "twostep") {
    const x = randInt(2, 10);
    const a = randInt(2, 6);
    const b = randInt(1, 15);
    const c = a * x + b;
    return {
      prompt: `Solve for x: ${a}x + ${b} = ${c}`,
      answer: x,
      accept: acceptNumber(x),
      topic: "algebra",
      topicLabel: "Algebra",
      grade: 7,
      hardness,
      hint: `Subtract ${b} from both sides, then divide by ${a}.`,
    };
  }
  const a = pick([2, 3, 4, 5]);
  const x = randInt(3, 9);
  const n = a * x - 1;
  return {
    prompt: `What is the smallest integer x such that ${a}x > ${n}?`,
    answer: x,
    accept: acceptNumber(x),
    topic: "algebra",
    topicLabel: "Inequalities",
    grade: 7,
    hardness,
    hint: `Divide by ${a}, then take the smallest integer greater than the result.`,
  };
}

export function generateMathQuestion(grade: MathGrade): MathQuestion {
  if (grade === 4) return q4();
  if (grade === 5) return q5();
  if (grade === 6) return q6();
  return q7();
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
