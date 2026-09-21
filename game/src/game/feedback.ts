const FB_KEY = "cookie-guard-feedback-v1";
const MAX_SAVED = 40;

export type FeedbackKind = "feedback" | "idea";

export interface FeedbackEntry {
  kind: FeedbackKind;
  name: string;
  message: string;
  at: number;
  id?: string;
}

export function kindLabel(kind: FeedbackKind): string {
  return kind === "idea" ? "Idea request" : "Feedback";
}

export function loadFeedback(): FeedbackEntry[] {
  try {
    const raw = localStorage.getItem(FB_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as FeedbackEntry[];
    if (!Array.isArray(list)) return [];
    return list
      .filter(
        (e) =>
          e &&
          (e.kind === "feedback" || e.kind === "idea") &&
          typeof e.message === "string" &&
          e.message.trim().length > 0,
      )
      .slice(0, MAX_SAVED);
  } catch {
    return [];
  }
}

function saveFeedbackList(list: FeedbackEntry[]) {
  localStorage.setItem(FB_KEY, JSON.stringify(list.slice(0, MAX_SAVED)));
}

export function rememberFeedback(entry: FeedbackEntry) {
  const list = loadFeedback();
  list.unshift(entry);
  saveFeedbackList(list);
}

/** Fetch recent notes from the server; falls back to local history. */
export async function fetchFeedbackList(
  kind: FeedbackKind | "all" = "all",
  limit = 24,
): Promise<{ ok: boolean; entries: FeedbackEntry[]; source: "server" | "local" }> {
  try {
    const q = new URLSearchParams({ kind, limit: String(limit) });
    const res = await fetch(`/api/feedback?${q}`);
    const data = (await res.json().catch(() => null)) as
      | { ok?: boolean; entries?: FeedbackEntry[]; error?: string }
      | null;
    if (res.ok && data?.ok && Array.isArray(data.entries)) {
      const entries = data.entries
        .filter(
          (e) =>
            e &&
            (e.kind === "feedback" || e.kind === "idea") &&
            typeof e.message === "string" &&
            e.message.trim().length > 0,
        )
        .map((e) => ({
          kind: e.kind,
          name: String(e.name || "Anonymous").slice(0, 40),
          message: e.message.trim().slice(0, 2000),
          at: Number(e.at) || Date.now(),
          id: e.id,
        }));
      return { ok: true, entries, source: "server" };
    }
  } catch {
    /* fall through to local */
  }

  let local = loadFeedback();
  if (kind === "feedback" || kind === "idea") {
    local = local.filter((e) => e.kind === kind);
  }
  return { ok: true, entries: local.slice(0, limit), source: "local" };
}

/** Save to Firestore via Cloud Run API (also keep a local copy). */
export async function submitFeedback(input: {
  kind: FeedbackKind;
  name: string;
  message: string;
}): Promise<{ ok: true; entry: FeedbackEntry } | { ok: false; error: string }> {
  const message = input.message.trim();
  if (message.length < 3) {
    return { ok: false, error: "Write a little more so we can understand your idea." };
  }
  if (message.length > 2000) {
    return { ok: false, error: "Keep it under 2000 characters." };
  }

  const entry: FeedbackEntry = {
    kind: input.kind,
    name: input.name.trim().slice(0, 40),
    message: message.slice(0, 2000),
    at: Date.now(),
  };

  try {
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: entry.kind,
        name: entry.name,
        message: entry.message,
      }),
    });
    const data = (await res.json().catch(() => null)) as
      | { ok?: boolean; id?: string; error?: string }
      | null;

    if (!res.ok || !data?.ok) {
      return {
        ok: false,
        error: data?.error || "Could not save right now. Please try again.",
      };
    }

    if (data.id) entry.id = data.id;
    rememberFeedback(entry);
    return { ok: true, entry };
  } catch {
    return { ok: false, error: "Network error — check your connection and try again." };
  }
}
