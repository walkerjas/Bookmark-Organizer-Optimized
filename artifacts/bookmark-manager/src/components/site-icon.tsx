import { useEffect, useMemo, useState, useRef } from "react";
import { cn } from "@/lib/utils";

interface SiteIconProps {
  url: string;
  favicon?: string | null;
  bookmarkId?: number;
  className?: string;
  size?: number;
}

function getHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function getDomain(url: string): string {
  return getHostname(url).replace(/^www\./, "");
}

function domainHue(domain: string): number {
  let h = 0;
  for (let i = 0; i < domain.length; i++) {
    h = (h * 31 + domain.charCodeAt(i)) % 360;
  }
  return h;
}

function LetterAvatar({ domain, size }: { domain: string; size: number }) {
  const letter = (domain[0] ?? "?").toUpperCase();
  const hue = domainHue(domain);
  const bg = `hsl(${hue}, 40%, 28%)`;
  const fg = `hsl(${hue}, 60%, 85%)`;
  const fontSize = Math.round(size * 0.44);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ borderRadius: "10px", flexShrink: 0, display: "block" }}
    >
      <rect width={size} height={size} fill={bg} rx="10" />
      <text
        x="50%"
        y="50%"
        dy="0.35em"
        textAnchor="middle"
        fill={fg}
        fontSize={fontSize}
        fontFamily="Inter, system-ui, sans-serif"
        fontWeight="600"
      >
        {letter}
      </text>
    </svg>
  );
}

// Known stub-returning services — their icons look like "success" but are generic placeholders
const STUB_DOMAINS = ["icons.duckduckgo.com", "www.google.com/s2/favicons", "google.com/s2/favicons"];

function isStubUrl(url: string): boolean {
  return STUB_DOMAINS.some((s) => url.includes(s));
}

// Server-side proxy (same-origin, fetched where the tower has internet) — most reliable
function proxyUrl(url: string): string {
  return `/api/favicon?url=${encodeURIComponent(url)}`;
}

// Private/local IP ranges + Tailscale magic DNS — unreachable from a public
// favicon service, so render a letter avatar immediately instead of fetching.
function isPrivateHost(hostname: string): boolean {
  return (
    /^10\.\d+\.\d+\.\d+/.test(hostname) ||
    /^192\.168\.\d+\.\d+/.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+/.test(hostname) ||
    /^100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\.\d+\.\d+/.test(hostname) || // CGNAT 100.64.0.0/10
    /^127\./.test(hostname) ||
    hostname === "localhost" ||
    hostname.endsWith(".ts.net") ||        // Tailscale magic DNS
    hostname.endsWith(".tailscalefae.ts.net")
  );
}

function buildCandidates(url: string, favicon?: string | null): string[] {
  let parsed: URL | null = null;
  try { parsed = new URL(url); } catch { /* ignore */ }
  const hostname = getHostname(url);
  const domain = getDomain(url);
  const origin = parsed?.origin ?? `http://${hostname}`;
  const isPrivate = isPrivateHost(hostname);

  const seen = new Set<string>();
  const list: string[] = [];
  const add = (u: string) => { if (u && !seen.has(u)) { seen.add(u); list.push(u); } };

  // Server-side proxy FIRST (same-origin; tower has solid internet for public
  // hosts and is ON the tailnet, so it can also reach LAN hosts' own favicons).
  add(proxyUrl(url));

  // Stored hint if it's a usable direct URL (skip external stubs / Clearbit).
  if (favicon && !isStubUrl(favicon) && !favicon.includes("logo.clearbit.com")) add(favicon);

  if (isPrivate) {
    // LAN / Tailscale host: the user's browser (and the tower) are ON the tailnet,
    // so the host's own favicon is directly reachable. Try it; skip external services
    // (Google/DuckDuckGo/Clearbit) which cannot reach private IPs. Falls back to a
    // branded letter avatar if the host publishes no standard icon (e.g. Umbrel/Jellyfin).
    add(`${origin}/favicon.ico`);
    add(`${origin}/apple-touch-icon.png`);
    return list;
  }

  // Public host: full candidate list
  add(`${origin}/favicon.ico`);
  // Clearbit as secondary — great for businesses but can return parent-company logos
  add(`https://logo.clearbit.com/${domain}`);
  // If subdomain, also try root domain with Clearbit (e.g. 1491.3cx.cloud → 3cx.cloud)
  if (hostname !== domain) {
    const root = domain.split(".").slice(-2).join(".");
    if (root !== domain) add(`https://logo.clearbit.com/${root}`);
  }
  // DuckDuckGo as final external fallback — wide coverage (universities, gov sites, etc.)
  add(`https://icons.duckduckgo.com/ip3/${hostname}.ico`);
  return list;
}

function saveFavicon(bookmarkId: number, faviconUrl: string) {
  // Persist the server-proxy URL (stable, server-resolved) rather than an external
  // stub (DuckDuckGo/Google) which can go stale or be blocked in the browser.
  if (isStubUrl(faviconUrl)) return;
  // Imported browser exports may contain a self-contained data URI. It is
  // already persistent and must never be wrapped in the HTTP favicon proxy.
  if (faviconUrl.startsWith("data:image/")) return;
  const toSave = faviconUrl.startsWith("/api/favicon")
    ? faviconUrl
    : proxyUrl(new URL(faviconUrl).href);
  fetch(`/api/bookmarks/${bookmarkId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ favicon: toSave }),
  }).catch(() => {});
}

export function SiteIcon({ url, favicon, bookmarkId, className, size = 36 }: SiteIconProps) {
  const domain = getDomain(url);
  const candidates = useMemo(() => buildCandidates(url, favicon), [url, favicon]);
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(candidates.length === 0);
  const savedRef = useRef(false);

  useEffect(() => {
    setIndex(0);
    setFailed(candidates.length === 0);
    savedRef.current = false;
  }, [candidates]);

  const px = `${size}px`;

  // Refs so setTimeout callbacks see the latest values without stale closures
  const indexRef = useRef(index);
  const candidatesRef = useRef(candidates);
  indexRef.current = index;
  candidatesRef.current = candidates;

  function advance() {
    const cur = indexRef.current;
    const cands = candidatesRef.current;
    if (cur + 1 < cands.length) {
      setIndex(cur + 1);
    } else {
      setFailed(true);
    }
  }

  function handleLoad(e: React.SyntheticEvent<HTMLImageElement>, src: string) {
    const img = e.currentTarget;
    // Some servers return 200 OK with HTML for a missing favicon — the browser
    // treats it as a broken image (0×0). Advance to the next candidate instead.
    // Defer via setTimeout so we don't call setState during React reconciliation
    // (cached images fire onLoad synchronously, which causes "Maximum update depth exceeded").
    if (img.naturalWidth === 0 || img.naturalHeight === 0) {
      setTimeout(advance, 0);
      return;
    }
    // Save back to DB when:
    //   • we used a fallback (stored favicon failed), OR
    //   • there was no stored favicon at all (index 0 is favicon.ico / Clearbit)
    if (bookmarkId && !savedRef.current && (index > 0 || !favicon)) {
      savedRef.current = true;
      saveFavicon(bookmarkId, src);
    }
  }

  function handleError() {
    advance();
  }

  if (failed) {
    return (
      <div className={cn("shrink-0", className)} style={{ width: px, height: px }}>
        <LetterAvatar domain={domain} size={size} />
      </div>
    );
  }

  const src = candidates[index];
  return (
    <div
      className={cn(
        "shrink-0 rounded-xl overflow-hidden bg-muted/80 flex items-center justify-center",
        className
      )}
      style={{ width: px, height: px }}
    >
      <img
        key={src}
        src={src}
        alt=""
        className="w-full h-full object-contain p-[5px]"
        onLoad={(e) => handleLoad(e, src)}
        onError={handleError}
      />
    </div>
  );
}
