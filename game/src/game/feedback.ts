const FB_KEY = "cookie-guard-feedback-v1";
const MAX_SAVED = 40;

/** Inbox for Feedback / Idea requests */
export const FEEDBACK_EMAIL = "tai.d.nguyen@gmail.com";

/** Fallback if mail client is unavailable */
export const FEEDBACK_ISSUE_URL =
  "https://github.com/tutti-dutti/boostAsioSerialDevice/issues/new";

export type FeedbackKind = "feedback" | "idea";

export interface FeedbackEntry {
  kind: FeedbackKind;
  name: string;
  message: string;
  at: number;
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

export function buildFeedbackBody(entry: FeedbackEntry): string {
  const who = entry.name.trim() || "Anonymous";
  return [
    `Type: ${kindLabel(entry.kind)}`,
    `From: ${who}`,
    `Game: Cookie Guard by James Nguyen`,
    "",
    entry.message.trim(),
  ].join("\n");
}

/** Save locally and open mail / GitHub issue compose for real delivery */
export function submitFeedback(input: {
  kind: FeedbackKind;
  name: string;
  message: string;
}): { ok: true; entry: FeedbackEntry } | { ok: false; error: string } {
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
  rememberFeedback(entry);

  const title = `[Cookie Guard] ${kindLabel(entry.kind)}${entry.name ? ` — ${entry.name}` : ""}`;
  const body = buildFeedbackBody(entry);

  if (FEEDBACK_EMAIL) {
    const mailto = `mailto:${encodeURIComponent(FEEDBACK_EMAIL)}?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
    const link = document.createElement("a");
    link.href = mailto;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  } else {
    const issue = `${FEEDBACK_ISSUE_URL}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
    window.open(issue, "_blank", "noopener,noreferrer");
  }

  try {
    void navigator.clipboard?.writeText(`${title}\n\n${body}`).catch(() => {
      /* clipboard optional */
    });
  } catch {
    /* clipboard optional */
  }

  return { ok: true, entry };
}
