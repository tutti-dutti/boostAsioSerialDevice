/**
 * Cookie Guard — static host + feedback API (Cloud Storage)
 */
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { Storage } from "@google-cloud/storage";
import { randomUUID } from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8080);
const DIST = path.join(__dirname, "dist");
const BUCKET =
  process.env.FEEDBACK_BUCKET ||
  `${process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || "fairway-finder-507002-n2"}-cookie-guard-data`;
const PREFIX = process.env.FEEDBACK_PREFIX || "feedback/";

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "24kb" }));

const storage = new Storage();

/** Simple in-memory rate limit: max N posts per IP per window */
const hits = new Map();
const RATE_MAX = 8;
const RATE_WINDOW_MS = 10 * 60 * 1000;

function rateLimited(ip) {
  const now = Date.now();
  const row = hits.get(ip) || { count: 0, start: now };
  if (now - row.start > RATE_WINDOW_MS) {
    row.count = 0;
    row.start = now;
  }
  row.count += 1;
  hits.set(ip, row);
  return row.count > RATE_MAX;
}

function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length) return fwd.split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "cookie-guard", store: "gcs", bucket: BUCKET });
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
