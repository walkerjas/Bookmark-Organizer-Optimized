import { useState, useEffect, useRef, SyntheticEvent } from "react";

const STUB_PATTERNS = [
  "duckduckgo.com/favicon",
  "icons.duckduckgo.com/ip3",
  "s.ytimg.com",
  "/favicon.ico?v=",
];

function isStubUrl(url: string): boolean {
  return STUB_PATTERNS.some((p) => url.includes(p));
}

function isPrivateHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    /^127\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
    /^100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\./.test(hostname) || // CGNAT (Tailscale/Carrier) 100.64.0.0/10
    /^::1$/.test(hostname)
  );
}

function letterAvatarUrl(domain: string, size: number): string {
  const letter = (domain.replace(/^www\./, "")[0] ?? "?").toUpperCase();
  const colors = [
    ["#1a56db", "#60a5fa"],
    ["#057a55", "#34d399"],
    ["#7e3af2", "#c084fc"],
    ["#e3a008", "#fbbf24"],
    ["#d03801", "#f97316"],
    ["#c81e1e", "#f87171"],
    ["#0694a2", "#22d3ee"],
  ];
  let h = 0;
  for (let i = 0; i < domain.length; i++) h = (h * 31 + domain.charCodeAt(i)) | 0;
  const [bg, fg] = colors[Math.abs(h) % colors.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" rx="${size * 0.2}" fill="${bg}"/><text x="50%" y="50%" dy=".35em" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="${size * 0.52}" font-weight="600" fill="${fg}">${letter}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function getApiBase(): string {
  try {
    return (localStorage.getItem("markbase_api_url") || "http://racetrack:8082").replace(/\/$/, "");
  } catch {
    return "http://racetrack:8082";
  }
}

// Stored favicons may be relative (/api/favicon?url=…). In the extension the
// <img> resolves those against chrome-extension://… and they 404. Absolutize.
function resolveFavicon(fav: string | null | undefined): string | null {
  if (!fav) return null;
  if (fav.startsWith("/api/favicon")) return `${getApiBase()}${fav}`;
  return fav;
}

type Stage = "stored" | "direct" | "proxy" | "fallback";

interface Props {
  url: string;
  favicon?: string | null;
  size?: number;
  className?: string;
}

export function SiteIcon({ url, favicon, size = 32, className = "" }: Props) {
  let hostname = "";
  try { hostname = new URL(url).hostname; } catch { /* noop */ }

  const isPrivate = hostname ? isPrivateHost(hostname) : true;

  function initialSrc(): { src: string; stage: Stage } {
    const resolved = resolveFavicon(favicon);
    if (resolved && !isStubUrl(resolved) && !resolved.includes("logo.clearbit.com"))
      return { src: resolved, stage: "stored" };
    // Private / Tailscale / CGNAT hosts: the browser tab shows the site's own
    // favicon, so ask the proxy to fetch it (handles plain http + self-signed https).
    if (isPrivate && hostname) {
      const scheme = /^https:/i.test(url) ? "https" : "http";
      const siteFav = `${scheme}://${hostname}/favicon.ico`;
      return {
        src: `${getApiBase()}/api/favicon?url=${encodeURIComponent(siteFav)}`,
        stage: "proxy",
      };
    }
    if (hostname) return { src: `https://${hostname}/favicon.ico`, stage: "direct" };
    return { src: letterAvatarUrl(hostname || "?", size), stage: "fallback" };
  }

  const init = initialSrc();
  const [src, setSrc] = useState(init.src);
  const stage = useRef<Stage>(init.stage);
  const loadedRef = useRef(false);

  useEffect(() => {
    const i = initialSrc();
    setSrc(i.src);
    stage.current = i.stage;
  }, [url, favicon]);

  // Hard timeout: if a favicon URL hangs (connection opens but never completes),
  // advance to the next stage instead of letting the <img> stall the whole popup.
  useEffect(() => {
    loadedRef.current = false;
    const t = setTimeout(() => {
      if (!loadedRef.current) doAdvance();
    }, 4000);
    return () => clearTimeout(t);
  }, [src]);

  // Keep refs so deferred callbacks see fresh values
  const stageRef = useRef(stage.current);
  stageRef.current = stage.current;

  function doAdvance() {
    const next = advance(stageRef.current, hostname, size);
    if (next) { setSrc(next.src); stage.current = next.stage; stageRef.current = next.stage; }
  }

  function onError() {
    doAdvance();
  }

  function onLoad(e: SyntheticEvent<HTMLImageElement>) {
    loadedRef.current = true;
    const img = e.currentTarget;
    // Some servers return 200 OK with HTML for a missing favicon — 0×0 dimensions.
    // Defer setState via setTimeout to avoid cascading calls during reconciliation.
    if (img.naturalWidth === 0 || img.naturalHeight === 0) {
      setTimeout(doAdvance, 0);
    }
  }

  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className={`rounded object-contain shrink-0 ${className}`}
      onLoad={onLoad}
      onError={onError}
      loading="lazy"
    />
  );
}

function advance(
  current: Stage,
  hostname: string,
  size: number,
): { src: string; stage: Stage } | null {
  // stored → try the site's own /favicon.ico directly
  if (current === "stored")
    return hostname
      ? { src: `https://${hostname}/favicon.ico`, stage: "direct" }
      : null;
  // direct → Clearbit is dead (DNS dropped); go straight to a letter tile
  if (current === "direct")
    return { src: letterAvatarUrl(hostname || "?", size), stage: "fallback" };
  // proxy → site favicon unavailable; letter tile
  if (current === "proxy")
    return { src: letterAvatarUrl(hostname || "?", size), stage: "fallback" };
  return null;
}
