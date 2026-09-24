/** Client helpers for global visit / play counts and star ratings */

const DEVICE_KEY = "cookie-guard-device-id";
const RATED_KEY = "cookie-guard-my-rating";
const VISIT_SESSION = "cookie-guard-visit-sent";
const LOCAL_STATS_KEY = "cookie-guard-local-stats-v1";

export interface GameStats {
  visits: number;
  plays: number;
  ratingAvg: number;
  ratingCount: number;
}

function emptyStats(): GameStats {
  return { visits: 0, plays: 0, ratingAvg: 0, ratingCount: 0 };
}

export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_KEY);
    if (existing && existing.length >= 8) return existing;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `d_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    return `tmp_${Date.now()}`;
  }
}

export function getMyRating(): number {
  try {
    const n = Number(localStorage.getItem(RATED_KEY));
    if (Number.isFinite(n) && n >= 1 && n <= 5) return Math.round(n);
  } catch {
    /* ignore */
  }
  return 0;
}

export function rememberMyRating(stars: number) {
  try {
    localStorage.setItem(RATED_KEY, String(Math.round(stars)));
  } catch {
    /* ignore */
  }
}

function loadLocalStats(): GameStats {
  try {
    const raw = localStorage.getItem(LOCAL_STATS_KEY);
    if (!raw) return emptyStats();
    const data = JSON.parse(raw) as Partial<GameStats>;
    return {
      visits: Math.max(0, Math.floor(Number(data.visits) || 0)),
      plays: Math.max(0, Math.floor(Number(data.plays) || 0)),
      ratingAvg: Math.max(0, Number(data.ratingAvg) || 0),
      ratingCount: Math.max(0, Math.floor(Number(data.ratingCount) || 0)),
    };
  } catch {
    return emptyStats();
  }
}

function saveLocalStats(stats: GameStats) {
  try {
    localStorage.setItem(LOCAL_STATS_KEY, JSON.stringify(stats));
  } catch {
    /* ignore */
  }
}

function bumpLocal(field: "visits" | "plays"): GameStats {
  const s = loadLocalStats();
  s[field] += 1;
  saveLocalStats(s);
  return s;
}

function parseStats(data: Partial<GameStats> | null | undefined): GameStats | null {
  if (!data) return null;
  return {
    visits: Math.max(0, Math.floor(Number(data.visits) || 0)),
    plays: Math.max(0, Math.floor(Number(data.plays) || 0)),
    ratingAvg: Math.max(0, Number(data.ratingAvg) || 0),
    ratingCount: Math.max(0, Math.floor(Number(data.ratingCount) || 0)),
  };
}

export function formatCount(n: number): string {
  return Math.max(0, Math.round(n)).toLocaleString();
}

export function formatRatingAvg(avg: number, count: number): string {
  if (count <= 0) return "No ratings yet";
  return `${avg.toFixed(1)} ★ · ${formatCount(count)} rating${count === 1 ? "" : "s"}`;
}

export async function fetchStats(): Promise<GameStats> {
  try {
    const res = await fetch("/api/stats");
    const data = (await res.json().catch(() => null)) as (Partial<GameStats> & { ok?: boolean }) | null;
    if (res.ok && data?.ok) {
      const stats = parseStats(data) || emptyStats();
      saveLocalStats(stats);
      return stats;
    }
  } catch {
    /* fall through */
  }
  return loadLocalStats();
}

/** Record one site visit (once per browser tab session). */
export async function recordVisit(): Promise<GameStats> {
  try {
    if (sessionStorage.getItem(VISIT_SESSION) === "1") {
      return fetchStats();
    }
    sessionStorage.setItem(VISIT_SESSION, "1");
  } catch {
    /* continue */
  }

  bumpLocal("visits");
  try {
    const res = await fetch("/api/stats/visit", { method: "POST" });
    const data = (await res.json().catch(() => null)) as (Partial<GameStats> & { ok?: boolean }) | null;
    if (res.ok && data?.ok) {
      const stats = parseStats(data) || loadLocalStats();
      saveLocalStats(stats);
      return stats;
    }
  } catch {
    /* keep local */
  }
  return loadLocalStats();
}

/** Record a gameplay start (Play / Play again). */
export async function recordPlay(): Promise<GameStats> {
  bumpLocal("plays");
  try {
    const res = await fetch("/api/stats/play", { method: "POST" });
    const data = (await res.json().catch(() => null)) as (Partial<GameStats> & { ok?: boolean }) | null;
    if (res.ok && data?.ok) {
      const stats = parseStats(data) || loadLocalStats();
      saveLocalStats(stats);
      return stats;
    }
  } catch {
    /* keep local */
  }
  return loadLocalStats();
}

export async function submitRating(
  stars: number,
): Promise<{ ok: true; stats: GameStats; stars: number } | { ok: false; error: string }> {
  const n = Math.round(stars);
  if (n < 1 || n > 5) {
    return { ok: false, error: "Pick 1 to 5 stars." };
  }

  try {
    const res = await fetch("/api/rate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stars: n, deviceId: getDeviceId() }),
    });
    const data = (await res.json().catch(() => null)) as
      | (Partial<GameStats> & { ok?: boolean; stars?: number; error?: string })
      | null;

    if (!res.ok || !data?.ok) {
      return { ok: false, error: data?.error || "Could not save rating." };
    }

    rememberMyRating(n);
    const stats = parseStats(data) || loadLocalStats();
    saveLocalStats(stats);
    return { ok: true, stats, stars: n };
  } catch {
    return { ok: false, error: "Network error — try again in a moment." };
  }
}
