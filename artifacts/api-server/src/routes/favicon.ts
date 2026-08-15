import { Router } from "express";
import fs from "fs";
import path from "path";
import { createHash } from "crypto";

const router = Router();

// --- Persistent disk cache so restarts (e.g. after a supervisor reload) don't
// wipe the warm favicon cache. Cache is keyed by the FULL requested URL (not just
// the domain) so a failed probe of one path (e.g. a host's root /favicon.ico that
// returns an HTML shell) cannot poison a valid specific-path fetch for the same host.
const CACHE_DIR = "/tmp/bookmark-favicon-cache";
fs.mkdirSync(CACHE_DIR, { recursive: true });

const CACHE_TTL_OK = 7 * 24 * 60 * 60 * 1000;   // 7 days for successful fetches
const CACHE_TTL_FAIL = 24 * 60 * 60 * 1000;      // 24h for failed lookups (avoid hammering)

type CacheMeta = { expires: number; buf: Buffer | null; contentType: string };
const memoryCache = new Map<string, CacheMeta>();
const MAX_ICON_BYTES = 1024 * 1024;

function safeName(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

function readDisk(key: string): CacheMeta | null {
  const inMemory = memoryCache.get(key);
  if (inMemory && inMemory.expires > Date.now()) return inMemory;
  if (inMemory) memoryCache.delete(key);
  try {
    const metaPath = path.join(CACHE_DIR, `${safeName(key)}.meta`);
    const metaRaw = fs.readFileSync(metaPath, "utf8");
    const meta = JSON.parse(metaRaw) as { expires: number; contentType: string; hasBuf: boolean };
    if (meta.expires <= Date.now()) return null;
    let buf: Buffer | null = null;
    if (meta.hasBuf) {
      buf = fs.readFileSync(path.join(CACHE_DIR, `${safeName(key)}.bin`));
    }
    const entry = { expires: meta.expires, buf, contentType: meta.contentType };
    memoryCache.set(key, entry);
    return entry;
  } catch {
    return null;
  }
}

function writeDisk(key: string, entry: CacheMeta): void {
  memoryCache.set(key, entry);
  if (memoryCache.size > 2_000) {
    const oldestKey = memoryCache.keys().next().value;
    if (oldestKey) memoryCache.delete(oldestKey);
  }
  try {
    const meta = {
      expires: entry.expires,
      contentType: entry.contentType,
      hasBuf: entry.buf !== null,
    };
    fs.writeFileSync(path.join(CACHE_DIR, `${safeName(key)}.meta`), JSON.stringify(meta));
    if (entry.buf) {
      fs.writeFileSync(path.join(CACHE_DIR, `${safeName(key)}.bin`), entry.buf);
    }
  } catch {
    /* best-effort cache; ignore disk errors */
  }
}

function getDomain(raw: string): string | null {
  try {
    const url = raw.startsWith("http") ? raw : `https://${raw}`;
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

async function tryFetch(url: string): Promise<{ buf: Buffer; contentType: string } | null> {
  try {
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(4000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Markbase/1.0)" },
    });
    if (!resp.ok) return null;
    const contentType = resp.headers.get("content-type") ?? "image/png";
    if (!contentType.startsWith("image/") && !contentType.includes("icon")) return null;
    const announcedSize = Number(resp.headers.get("content-length") ?? 0);
    if (announcedSize > MAX_ICON_BYTES) return null;
    const buf = Buffer.from(await resp.arrayBuffer());
    // Google returns a ~68-byte transparent GIF stub for unknown domains
    if (buf.length < 150 || buf.length > MAX_ICON_BYTES) return null;
    return { buf, contentType };
  } catch {
    return null;
  }
}

router.get("/favicon", async (req, res) => {
  const { url, hint } = req.query;
  if (!url || typeof url !== "string") {
    res.status(400).json({ error: "url query param required" });
    return;
  }

  // The request key is the full url (the specific resource), so caching is
  // path-specific and a bad root probe can't poison a good specific-path fetch.
  const reqKey = url;

  const domain = getDomain(url);
  if (!domain) {
    res.status(400).json({ error: "invalid url" });
    return;
  }

  // 1) Disk cache (survives restarts), keyed by full url
  const cached = readDisk(reqKey);
  if (cached) {
    if (cached.buf) {
      res.setHeader("Content-Type", cached.contentType);
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.send(cached.buf);
    } else {
      res.status(404).json({ error: "favicon not found" });
    }
    return;
  }

  // 2) Build candidate URLs. The tower is itself a Tailscale node, so it can
  // reach LAN/Tailscale hosts directly. The `url` param IS the requested
  // resource (the frontend passes the stored favicon URL here), so try it
  // first — it's often a direct image path (e.g. a self-hosted /favicon/...png).
  // Then try the host's canonical favicon, then external services.
  const candidates: string[] = [];
  const addCandidate = (candidate: string) => {
    if (!candidates.includes(candidate)) candidates.push(candidate);
  };
  if (url.startsWith("http")) addCandidate(url);
  // Direct site favicon (with port preserved) — canonical, works for LAN hosts
  try {
    const origin = new URL(url).origin;
    addCandidate(`${origin}/favicon.ico`);
    addCandidate(`${origin}/apple-touch-icon.png`);
  } catch { /* ignore bad url */ }
  addCandidate(`https://www.google.com/s2/favicons?sz=64&domain=${domain}`);
  addCandidate(`https://icons.duckduckgo.com/ip3/${domain}.ico`);

  for (const candidate of candidates) {
    const result = await tryFetch(candidate);
    if (result) {
      const entry: CacheMeta = { expires: Date.now() + CACHE_TTL_OK, ...result };
      writeDisk(reqKey, entry);
      res.setHeader("Content-Type", result.contentType);
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.send(result.buf);
      return;
    }
  }

  // 3) Cache the failure so we don't retry every request (and survive restarts)
  writeDisk(reqKey, { expires: Date.now() + CACHE_TTL_FAIL, buf: null, contentType: "" });
  res.status(404).json({ error: "favicon not found" });
});

export default router;
