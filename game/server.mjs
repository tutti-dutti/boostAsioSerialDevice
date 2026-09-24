/**
 * Cookie Guard — static host + feedback / stats / ratings API (Cloud Storage)
 */
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { Storage } from "@google-cloud/storage";
import { randomUUID, createHash } from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8080);
const DIST = path.join(__dirname, "dist");
const BUCKET =
  process.env.FEEDBACK_BUCKET ||
  `${process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || "fairway-finder-507002-n2"}-cookie-guard-data`;
const PREFIX = process.env.FEEDBACK_PREFIX || "feedback/";
const STATS_OBJECT = process.env.STATS_OBJECT || "stats/summary.json";
const RATINGS_PREFIX = process.env.RATINGS_PREFIX || "stats/ratings/";

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "24kb" }));

const storage = new Storage();

/** Simple in-memory rate limit: max N posts per IP per window */
const hits = new Map();
const RATE_MAX = 8;
const RATE_WINDOW_MS = 10 * 60 * 1000;
/** Lighter limit for visit/play bumps */
const STAT_HITS = new Map();
const STAT_RATE_MAX = 40;
const STAT_RATE_WINDOW_MS = 10 * 60 * 1000;

function rateLimited(ip, map = hits, max = RATE_MAX, windowMs = RATE_WINDOW_MS) {
  const now = Date.now();
  const row = map.get(ip) || { count: 0, start: now };
  if (now - row.start > windowMs) {
    row.count = 0;
    row.start = now;
  }
  row.count += 1;
  map.set(ip, row);
  return row.count > max;
}

function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length) return fwd.split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

function emptySummary() {
  return { visits: 0, plays: 0, ratingSum: 0, ratingCount: 0, updatedAt: 0 };
}

function normalizeSummary(raw) {
  const base = emptySummary();
  if (!raw || typeof raw !== "object") return base;
  return {
    visits: Math.max(0, Math.floor(Number(raw.visits) || 0)),
    plays: Math.max(0, Math.floor(Number(raw.plays) || 0)),
    ratingSum: Math.max(0, Math.floor(Number(raw.ratingSum) || 0)),
    ratingCount: Math.max(0, Math.floor(Number(raw.ratingCount) || 0)),
    updatedAt: Number(raw.updatedAt) || 0,
  };
}

function publicStats(summary) {
  const s = normalizeSummary(summary);
  const ratingAvg =
    s.ratingCount > 0 ? Math.round((s.ratingSum / s.ratingCount) * 10) / 10 : 0;
  return {
    visits: s.visits,
    plays: s.plays,
    ratingAvg,
    ratingCount: s.ratingCount,
  };
}

async function readSummary() {
  const file = storage.bucket(BUCKET).file(STATS_OBJECT);
  try {
    const [buf] = await file.download();
    const [meta] = await file.getMetadata();
    return {
      summary: normalizeSummary(JSON.parse(buf.toString("utf8"))),
      generation: Number(meta.generation) || 0,
    };
  } catch (err) {
    if (err?.code === 404 || err?.message?.includes("No such object")) {
      return { summary: emptySummary(), generation: 0 };
    }
    throw err;
  }
}

async function writeSummary(summary, generation) {
  const file = storage.bucket(BUCKET).file(STATS_OBJECT);
  const next = { ...normalizeSummary(summary), updatedAt: Date.now() };
  const opts = {
    contentType: "application/json",
    resumable: false,
    metadata: { cacheControl: "no-store" },
  };
  if (generation > 0) {
    opts.preconditionOpts = { ifGenerationMatch: generation };
  } else {
    opts.preconditionOpts = { ifGenerationMatch: 0 };
  }
  try {
    await file.save(JSON.stringify(next, null, 2), opts);
    return next;
  } catch (err) {
    // Generation conflict — caller may retry
    if (err?.code === 412 || err?.code === 409) {
      const e = new Error("conflict");
      e.code = "conflict";
      throw e;
    }
    // First create without precondition if empty match fails oddly
    if (generation === 0 && (err?.code === 412 || err?.code === 409)) {
      await file.save(JSON.stringify(next, null, 2), {
        contentType: "application/json",
        resumable: false,
        metadata: { cacheControl: "no-store" },
      });
      return next;
    }
    throw err;
  }
}

async function mutateSummary(mutator, attempts = 5) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const { summary, generation } = await readSummary();
      const next = mutator({ ...summary });
      return await writeSummary(next, generation);
    } catch (err) {
      lastErr = err;
      if (err?.code === "conflict") continue;
      throw err;
    }
  }
  throw lastErr || new Error("Could not update stats");
}

function deviceKey(req, deviceId) {
  const raw = `${clientIp(req)}:${String(deviceId || "").slice(0, 64)}`;
  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "cookie-guard", store: "gcs", bucket: BUCKET });
});

/** Global visit / play / rating snapshot */
app.get("/api/stats", async (_req, res) => {
  try {
    const { summary } = await readSummary();
    res.json({ ok: true, ...publicStats(summary) });
  } catch (err) {
    console.error("stats read failed", err);
    res.status(500).json({ ok: false, error: "Could not load stats.", visits: 0, plays: 0, ratingAvg: 0, ratingCount: 0 });
  }
});

app.post("/api/stats/visit", async (req, res) => {
  try {
    const ip = clientIp(req);
    if (rateLimited(ip, STAT_HITS, STAT_RATE_MAX, STAT_RATE_WINDOW_MS)) {
      res.status(429).json({ ok: false, error: "Too many requests." });
      return;
    }
    const summary = await mutateSummary((s) => {
      s.visits += 1;
      return s;
    });
    res.json({ ok: true, ...publicStats(summary) });
  } catch (err) {
    console.error("visit bump failed", err);
    res.status(500).json({ ok: false, error: "Could not record visit." });
  }
});

app.post("/api/stats/play", async (req, res) => {
  try {
    const ip = clientIp(req);
    if (rateLimited(ip, STAT_HITS, STAT_RATE_MAX, STAT_RATE_WINDOW_MS)) {
      res.status(429).json({ ok: false, error: "Too many requests." });
      return;
    }
    const summary = await mutateSummary((s) => {
      s.plays += 1;
      return s;
    });
    res.json({ ok: true, ...publicStats(summary) });
  } catch (err) {
    console.error("play bump failed", err);
    res.status(500).json({ ok: false, error: "Could not record play." });
  }
});

/** Submit or update a 1–5 star rating for this device */
app.post("/api/rate", async (req, res) => {
  try {
    const ip = clientIp(req);
    if (rateLimited(ip)) {
      res.status(429).json({ ok: false, error: "Too many ratings — try again later." });
      return;
    }

    const stars = Math.round(Number(req.body?.stars));
    if (!Number.isFinite(stars) || stars < 1 || stars > 5) {
      res.status(400).json({ ok: false, error: "Pick a rating from 1 to 5 stars." });
      return;
    }

    const key = deviceKey(req, req.body?.deviceId);
    const ratingFile = storage.bucket(BUCKET).file(`${RATINGS_PREFIX}${key}.json`);
    let previous = 0;
    try {
      const [buf] = await ratingFile.download();
      const doc = JSON.parse(buf.toString("utf8"));
      previous = Math.round(Number(doc.stars) || 0);
      if (previous < 1 || previous > 5) previous = 0;
    } catch (err) {
      if (!(err?.code === 404 || err?.message?.includes("No such object"))) {
        console.warn("rating read", err?.message || err);
      }
    }

    const at = Date.now();
    await ratingFile.save(
      JSON.stringify(
        {
          stars,
          previous,
          at,
          createdAt: new Date(at).toISOString(),
        },
        null,
        2,
      ),
      {
        contentType: "application/json",
        resumable: false,
        metadata: { cacheControl: "no-store" },
      },
    );

    const summary = await mutateSummary((s) => {
      if (previous >= 1 && previous <= 5) {
        s.ratingSum = Math.max(0, s.ratingSum - previous + stars);
      } else {
        s.ratingSum += stars;
        s.ratingCount += 1;
      }
      return s;
    });

    res.status(201).json({ ok: true, stars, ...publicStats(summary) });
  } catch (err) {
    console.error("rate failed", err);
    res.status(500).json({ ok: false, error: "Could not save rating. Please try again." });
  }
});

/** Recent feedback / idea notes for the in-game menu */
app.get("/api/feedback", async (req, res) => {
  try {
    const kindFilter =
      req.query.kind === "idea" || req.query.kind === "feedback" ? req.query.kind : "all";
    const limit = Math.min(40, Math.max(1, Number(req.query.limit) || 24));

    const [files] = await storage.bucket(BUCKET).getFiles({
      prefix: PREFIX,
      autoPaginate: false,
      maxResults: 120,
    });

    const sorted = [...files].sort((a, b) => String(b.name).localeCompare(String(a.name)));
    const entries = [];

    for (const file of sorted) {
      if (entries.length >= limit * 2) break; // fetch extra before kind filter
      if (!String(file.name).endsWith(".json")) continue;
      try {
        const [buf] = await file.download();
        const doc = JSON.parse(buf.toString("utf8"));
        const kind = doc?.kind === "idea" ? "idea" : doc?.kind === "feedback" ? "feedback" : null;
        if (!kind) continue;
        if (kindFilter !== "all" && kind !== kindFilter) continue;
        const message = String(doc.message || "").trim();
        if (message.length < 1) continue;
        entries.push({
          id: String(doc.id || file.name),
          kind,
          name: String(doc.name || "Anonymous").slice(0, 40),
          message: message.slice(0, 2000),
          at: Number(doc.at) || Date.parse(doc.createdAt) || Date.now(),
        });
        if (entries.length >= limit) break;
      } catch (err) {
        console.warn("feedback read skip", file.name, err?.message || err);
      }
    }

    res.json({ ok: true, entries });
  } catch (err) {
    console.error("feedback list failed", err);
    res.status(500).json({ ok: false, error: "Could not load notes right now.", entries: [] });
  }
});

app.post("/api/feedback", async (req, res) => {
  try {
    const ip = clientIp(req);
    if (rateLimited(ip)) {
      res.status(429).json({ ok: false, error: "Too many notes — try again later." });
      return;
    }

    const kind = req.body?.kind === "idea" ? "idea" : req.body?.kind === "feedback" ? "feedback" : null;
    const name = String(req.body?.name ?? "").trim().slice(0, 40);
    const message = String(req.body?.message ?? "").trim();

    if (!kind) {
      res.status(400).json({ ok: false, error: "Pick Feedback or Idea request." });
      return;
    }
    if (message.length < 3) {
      res.status(400).json({ ok: false, error: "Write a little more so we can understand your idea." });
      return;
    }
    if (message.length > 2000) {
      res.status(400).json({ ok: false, error: "Keep it under 2000 characters." });
      return;
    }

    const id = randomUUID();
    const at = Date.now();
    const doc = {
      id,
      kind,
      name: name || "Anonymous",
      message: message.slice(0, 2000),
      at,
      createdAt: new Date(at).toISOString(),
      userAgent: String(req.headers["user-agent"] || "").slice(0, 240),
    };

    const objectPath = `${PREFIX}${new Date(at).toISOString().slice(0, 10)}/${at}-${id}.json`;
    await storage.bucket(BUCKET).file(objectPath).save(JSON.stringify(doc, null, 2), {
      contentType: "application/json",
      resumable: false,
      metadata: {
        cacheControl: "no-store",
        metadata: { kind, id },
      },
    });

    res.status(201).json({ ok: true, id });
  } catch (err) {
    console.error("feedback write failed", err);
    res.status(500).json({ ok: false, error: "Could not save right now. Please try again." });
  }
});

app.use(express.static(DIST, { index: false, maxAge: "1h" }));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) {
    res.status(404).json({ ok: false, error: "Not found" });
    return;
  }
  res.sendFile(path.join(DIST, "index.html"), (err) => {
    if (err) next(err);
  });
});

app.listen(PORT, () => {
  console.log(`Cookie Guard listening on :${PORT} (bucket=${BUCKET})`);
});
