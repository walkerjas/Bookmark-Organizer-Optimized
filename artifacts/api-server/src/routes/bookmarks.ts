import { Router } from "express";
import { db } from "@workspace/db";
import {
  bookmarksTable,
  collectionsTable,
  tagsTable,
  bookmarkTagsTable,
} from "@workspace/db";
import { eq, desc, and, ilike, or, sql, inArray } from "drizzle-orm";
import {
  CreateBookmarkBody,
  UpdateBookmarkBody,
} from "@workspace/api-zod";
import { fetchFaviconUrl } from "../lib/favicon.js";

const router = Router();

async function getBookmarkWithTags(id: number) {
  const bookmark = await db.query.bookmarksTable.findFirst({
    where: eq(bookmarksTable.id, id),
  });
  if (!bookmark) return null;
  const tagRows = await db
    .select({ id: tagsTable.id, name: tagsTable.name, color: tagsTable.color })
    .from(bookmarkTagsTable)
    .innerJoin(tagsTable, eq(bookmarkTagsTable.tagId, tagsTable.id))
    .where(eq(bookmarkTagsTable.bookmarkId, id));
  return { ...bookmark, tags: tagRows };
}

async function getBookmarksWithTags(ids: number[]) {
  if (ids.length === 0) return new Map<number, { bookmarkId: number; id: number; name: string; color: string | null }[]>();
  const tagRows = await db
    .select({
      bookmarkId: bookmarkTagsTable.bookmarkId,
      id: tagsTable.id,
      name: tagsTable.name,
      color: tagsTable.color,
    })
    .from(bookmarkTagsTable)
    .innerJoin(tagsTable, eq(bookmarkTagsTable.tagId, tagsTable.id))
    .where(inArray(bookmarkTagsTable.bookmarkId, ids));

  const tagsByBookmark = new Map<number, typeof tagRows>();
  for (const row of tagRows) {
    const arr = tagsByBookmark.get(row.bookmarkId) ?? [];
    arr.push(row);
    tagsByBookmark.set(row.bookmarkId, arr);
  }
  return tagsByBookmark;
}

// GET /bookmarks/stats
router.get("/bookmarks/stats", async (req, res) => {
  const [totalResult, pinnedResult, collectionsResult, tagsResult, recentResult] =
    await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(bookmarksTable),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(bookmarksTable)
        .where(eq(bookmarksTable.pinned, true)),
      db.select({ count: sql<number>`count(*)::int` }).from(collectionsTable),
      db.select({ count: sql<number>`count(*)::int` }).from(tagsTable),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(bookmarksTable)
        .where(
          sql`${bookmarksTable.createdAt} > now() - interval '7 days'`
        ),
    ]);

  res.json({
    total: totalResult[0].count,
    pinned: pinnedResult[0].count,
    collections: collectionsResult[0].count,
    tags: tagsResult[0].count,
    recentCount: recentResult[0].count,
  });
});

// GET /bookmarks/recent
router.get("/bookmarks/recent", async (req, res) => {
  const bookmarks = await db
    .select()
    .from(bookmarksTable)
    .orderBy(desc(bookmarksTable.createdAt))
    .limit(10);

  const ids = bookmarks.map((b) => b.id);
  const tagsByBookmark = await getBookmarksWithTags(ids);
  const result = bookmarks.map((b) => ({
    ...b,
    tags: tagsByBookmark.get(b.id) ?? [],
  }));

  res.json(result);
});

// GET /bookmarks
router.get("/bookmarks", async (req, res) => {
  const { collectionId, tagId, search, pinned } = req.query;

  const conditions = [];
  if (collectionId && collectionId !== "null") {
    const parsedCollectionId = Number(collectionId);
    if (!Number.isInteger(parsedCollectionId)) {
      res.status(400).json({ error: "Invalid collectionId" }); return;
    }
    conditions.push(eq(bookmarksTable.collectionId, parsedCollectionId));
  }
  if (pinned === "true") {
    conditions.push(eq(bookmarksTable.pinned, true));
  }
  if (search && typeof search === "string" && search.trim()) {
    const term = `%${search.trim()}%`;
    const searchCondition = or(
      ilike(bookmarksTable.title, term),
      ilike(bookmarksTable.url, term),
      ilike(bookmarksTable.description, term),
    );
    if (searchCondition) conditions.push(searchCondition);
  }

  if (tagId && tagId !== "null") {
    const parsedTagId = Number(tagId);
    if (!Number.isInteger(parsedTagId)) {
      res.status(400).json({ error: "Invalid tagId" }); return;
    }
    const taggedBookmarkIds = await db
      .select({ bookmarkId: bookmarkTagsTable.bookmarkId })
      .from(bookmarkTagsTable)
      .where(eq(bookmarkTagsTable.tagId, parsedTagId));
    const ids = taggedBookmarkIds.map((r) => r.bookmarkId);
    if (ids.length === 0) { res.json([]); return; }
    conditions.push(inArray(bookmarksTable.id, ids));
  }

  const bookmarks = await db
    .select()
    .from(bookmarksTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(bookmarksTable.sortOrder, desc(bookmarksTable.pinned), desc(bookmarksTable.createdAt));

  const ids = bookmarks.map((b) => b.id);
  const tagsByBookmark = await getBookmarksWithTags(ids);
  const result = bookmarks.map((b) => ({
    ...b,
    tags: tagsByBookmark.get(b.id) ?? [],
  }));

  res.json(result);
});

// POST /bookmarks
router.post("/bookmarks", async (req, res) => {
  const parsed = CreateBookmarkBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" }); return;
  }

  const { tagIds, ...bookmarkData } = parsed.data as any;

  let normalizedUrl: string;
  try {
    normalizedUrl = new URL(bookmarkData.url).href;
  } catch {
    res.status(400).json({ error: "Invalid bookmark URL" }); return;
  }

  const existing = await db.query.bookmarksTable.findFirst({
    where: eq(bookmarksTable.url, normalizedUrl),
  });
  if (existing) {
    res.status(409).json({ error: "Bookmark already exists", id: existing.id }); return;
  }

  const [bookmark] = await db
    .insert(bookmarksTable)
    .values({
      url: normalizedUrl,
      title: bookmarkData.title,
      description: bookmarkData.description ?? null,
      favicon: bookmarkData.favicon ?? null,
      previewImage: bookmarkData.previewImage ?? null,
      collectionId: bookmarkData.collectionId ?? null,
      pinned: bookmarkData.pinned ?? false,
    })
    .returning();

  if (tagIds && tagIds.length > 0) {
    await db.insert(bookmarkTagsTable).values(
      tagIds.map((tagId: number) => ({ bookmarkId: bookmark.id, tagId }))
    );
  }

  // Auto-fetch favicon in background — don't block the response
  if (!bookmarkData.favicon) {
    fetchFaviconUrl(normalizedUrl).then(async (faviconUrl) => {
      if (faviconUrl) {
        await db
          .update(bookmarksTable)
          .set({ favicon: faviconUrl })
          .where(eq(bookmarksTable.id, bookmark.id));
      }
    }).catch(() => {});
  }

  const full = await getBookmarkWithTags(bookmark.id);
  res.status(201).json(full);
});

// PATCH /bookmarks/reorder — save a complete order in one request.
router.patch("/bookmarks/reorder", async (req, res) => {
  const ids = req.body?.ids;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 10_000 ||
      ids.some((id) => !Number.isInteger(id) || id <= 0) ||
      new Set(ids).size !== ids.length) {
    res.status(400).json({ error: "ids must be a unique array of bookmark IDs" }); return;
  }

  await db.transaction(async (tx) => {
    for (let offset = 0; offset < ids.length; offset += 250) {
      const batch = ids.slice(offset, offset + 250);
      await Promise.all(batch.map((id: number, index: number) =>
        tx.update(bookmarksTable)
          .set({ sortOrder: offset + index, updatedAt: new Date() })
          .where(eq(bookmarksTable.id, id)),
      ));
    }
  });

  res.status(204).send();
});

// GET /bookmarks/:id
router.get("/bookmarks/:id", async (req, res) => {
  const id = Number(req.params.id);
  const bookmark = await getBookmarkWithTags(id);
  if (!bookmark) { res.status(404).json({ error: "Not found" }); return; }
  res.json(bookmark);
});

// PATCH /bookmarks/:id
router.patch("/bookmarks/:id", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = UpdateBookmarkBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" }); return;
  }

  const { tagIds, ...updateData } = parsed.data as any;

  const updateFields: Record<string, unknown> = {};
  if (updateData.url !== undefined) updateFields.url = updateData.url;
  if (updateData.title !== undefined) updateFields.title = updateData.title;
  if (updateData.description !== undefined) updateFields.description = updateData.description;
  if (updateData.favicon !== undefined) updateFields.favicon = updateData.favicon;
  if (updateData.previewImage !== undefined) updateFields.previewImage = updateData.previewImage;
  if (updateData.collectionId !== undefined) updateFields.collectionId = updateData.collectionId;
  if (updateData.pinned !== undefined) updateFields.pinned = updateData.pinned;
  if (updateData.sortOrder !== undefined) updateFields.sortOrder = updateData.sortOrder;
  updateFields.updatedAt = new Date();

  await db.update(bookmarksTable).set(updateFields).where(eq(bookmarksTable.id, id));

  if (tagIds !== undefined) {
    await db.delete(bookmarkTagsTable).where(eq(bookmarkTagsTable.bookmarkId, id));
    if (tagIds.length > 0) {
      await db.insert(bookmarkTagsTable).values(
        tagIds.map((tagId: number) => ({ bookmarkId: id, tagId }))
      );
    }
  }

  const full = await getBookmarkWithTags(id);
  if (!full) { res.status(404).json({ error: "Not found" }); return; }
  res.json(full);
});

// POST /bookmarks/refresh-favicons — retroactively set favicon URLs for bookmarks missing them
router.post("/bookmarks/refresh-favicons", async (req, res) => {
  const missing = await db
    .select({ id: bookmarksTable.id, url: bookmarksTable.url })
    .from(bookmarksTable)
    .where(sql`${bookmarksTable.favicon} is null`);

  let updated = 0;
  const concurrency = 6;
  for (let offset = 0; offset < missing.length; offset += concurrency) {
    const results = await Promise.all(missing.slice(offset, offset + concurrency).map(async (bm) => {
      const faviconUrl = await fetchFaviconUrl(bm.url);
      if (!faviconUrl) return false;
      await db.update(bookmarksTable)
        .set({ favicon: faviconUrl, updatedAt: new Date() })
        .where(eq(bookmarksTable.id, bm.id));
      return true;
    }));
    updated += results.filter(Boolean).length;
  }

  res.json({ total: missing.length, updated });
});

// DELETE /bookmarks/:id
router.delete("/bookmarks/:id", async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(bookmarksTable).where(eq(bookmarksTable.id, id));
  res.status(204).send();
});

// PATCH /bookmarks/:id/pin
router.patch("/bookmarks/:id/pin", async (req, res) => {
  const id = Number(req.params.id);
  const bookmark = await db.query.bookmarksTable.findFirst({
    where: eq(bookmarksTable.id, id),
  });
  if (!bookmark) { res.status(404).json({ error: "Not found" }); return; }

  await db
    .update(bookmarksTable)
    .set({ pinned: !bookmark.pinned, updatedAt: new Date() })
    .where(eq(bookmarksTable.id, id));

  const full = await getBookmarkWithTags(id);
  res.json(full);
});

export default router;
