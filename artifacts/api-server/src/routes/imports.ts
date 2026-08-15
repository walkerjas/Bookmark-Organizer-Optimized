import { Router } from "express";
import { db } from "@workspace/db";
import { bookmarksTable } from "@workspace/db";
import { inArray } from "drizzle-orm";
import { ImportBookmarksBody } from "@workspace/api-zod";

const router = Router();

interface ParsedBookmark {
  url: string;
  title: string;
  addDate?: number;
  icon?: string | null;
}

function parseNetscapeBookmarks(html: string): ParsedBookmark[] {
  const bookmarks: ParsedBookmark[] = [];
  // Match <DT><A HREF="..." ...>title</A>  (case-insensitive)
  const linkPattern = /<a\s+[^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/gi;
  const addDatePattern = /add_date="(\d+)"/i;
  const iconPattern = /icon="([^"]+)"/i;

  let match: RegExpExecArray | null;
  while ((match = linkPattern.exec(html)) !== null) {
    const [fullMatch, url, title] = match;
    if (!url || url.startsWith("javascript:") || url.startsWith("place:")) continue;
    const addDateMatch = addDatePattern.exec(fullMatch);
    const addDate = addDateMatch ? Number(addDateMatch[1]) : undefined;
    const iconMatch = iconPattern.exec(fullMatch);
    const icon = iconMatch ? iconMatch[1] : null;
    bookmarks.push({ url: url.trim(), title: title.trim() || url, addDate, icon });
  }
  return bookmarks;
}

// POST /imports
router.post("/imports", async (req, res) => {
  const parsed = ImportBookmarksBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const { html, collectionId } = parsed.data as any;

  const parsedBookmarks = parseNetscapeBookmarks(html);

  let imported = 0;
  let skipped = 0;
  let errors = 0;
  const createdBookmarks: typeof bookmarksTable.$inferSelect[] = [];
  const unique = new Map<string, ParsedBookmark>();
  for (const bm of parsedBookmarks) {
    try {
      const normalized = new URL(bm.url).href;
      if (!/^https?:/.test(normalized)) { skipped++; continue; }
      if (unique.has(normalized)) { skipped++; continue; }
      unique.set(normalized, { ...bm, url: normalized });
    } catch { skipped++; }
  }

  const candidates = [...unique.values()];
  const existingUrls = new Set<string>();
  for (let offset = 0; offset < candidates.length; offset += 500) {
    const urls = candidates.slice(offset, offset + 500).map((bm) => bm.url);
    const rows = await db.select({ url: bookmarksTable.url })
      .from(bookmarksTable).where(inArray(bookmarksTable.url, urls));
    rows.forEach((row) => existingUrls.add(row.url));
  }

  const toInsert = candidates.filter((bm) => {
    if (existingUrls.has(bm.url)) { skipped++; return false; }
    return true;
  });

  for (let offset = 0; offset < toInsert.length; offset += 250) {
    const batch = toInsert.slice(offset, offset + 250);
    try {
      const inserted = await db.insert(bookmarksTable).values(batch.map((bm) => ({
        url: bm.url,
        title: bm.title,
        collectionId: collectionId ?? null,
        pinned: false,
        favicon: bm.icon && bm.icon.startsWith("data:image/") ? bm.icon : null,
        createdAt: bm.addDate ? new Date(bm.addDate * 1000) : new Date(),
        updatedAt: new Date(),
      }))).returning();
      createdBookmarks.push(...inserted);
      imported += inserted.length;
    } catch {
      errors += batch.length;
    }
  }

  const bookmarksWithTags = createdBookmarks.map((b) => ({ ...b, tags: [] }));

  res.json({ imported, skipped, errors, bookmarks: bookmarksWithTags });
});

export default router;
