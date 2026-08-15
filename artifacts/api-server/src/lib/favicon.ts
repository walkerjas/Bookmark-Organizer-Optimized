function resolveUrl(base: string, path: string): string {
  try {
    if (path.startsWith("data:")) return path;
    return new URL(path, base).href;
  } catch {
    return path;
  }
}

export async function fetchFaviconUrl(pageUrl: string): Promise<string | null> {
  try {
    const signal = AbortSignal.timeout(6000);
    const response = await fetch(pageUrl, {
      signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; Markbase/1.0; +https://markbase.app)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });

    if (!response.ok) return fallbackFaviconIco(pageUrl);

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return fallbackFaviconIco(pageUrl);

    const html = await response.text();

    // Only scan the <head> section — fast and avoids false positives in <body>
    const headEnd = html.indexOf("</head>");
    const head = headEnd > -1 ? html.slice(0, headEnd) : html.slice(0, 8000);

    // Priority order: apple-touch-icon → icon (png/svg) → shortcut icon → /favicon.ico
    const patterns: RegExp[] = [
      /<link[^>]+rel=["'][^"']*apple-touch-icon[^"']*["'][^>]*href=["']([^"']+)["']/i,
      /<link[^>]+href=["']([^"']+)["'][^>]*rel=["'][^"']*apple-touch-icon[^"']*["']/i,
      /<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]*href=["']([^"']+\.(png|svg|webp|ico)[^"']*)["']/i,
      /<link[^>]+href=["']([^"']+\.(png|svg|webp|ico)[^"']*)["'][^>]*rel=["'][^"']*icon[^"']*["']/i,
      /<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]*href=["']([^"']+)["']/i,
      /<link[^>]+href=["']([^"']+)["'][^>]*rel=["'][^"']*icon[^"']*["']/i,
    ];

    for (const pattern of patterns) {
      const m = head.match(pattern);
      if (m?.[1] && !m[1].startsWith("data:")) {
        const resolved = resolveUrl(pageUrl, m[1]);
        return resolved;
      }
    }

    return fallbackFaviconIco(pageUrl);
  } catch {
    return fallbackFaviconIco(pageUrl);
  }
}

function fallbackFaviconIco(pageUrl: string): string | null {
  try {
    const { protocol, host } = new URL(pageUrl);
    return `${protocol}//${host}/favicon.ico`;
  } catch {
    return null;
  }
}
