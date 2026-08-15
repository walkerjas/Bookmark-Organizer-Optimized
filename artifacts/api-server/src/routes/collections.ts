import { Router } from "express";
import { db } from "@workspace/db";
import { collectionsTable, bookmarksTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { CreateCollectionBody, UpdateCollectionBody } from "@workspace/api-zod";

const router = Router();

// GET /collections
router.get("/collections", async (req, res) => {
  const collections = await db.select().from(collectionsTable).orderBy(collectionsTable.name);
  const counts = await db
    .select({ collectionId: bookmarksTable.collectionId, count: sql<number>`count(*)::int` })
    .from(bookmarksTable)
    .where(sql`${bookmarksTable.collectionId} is not null`)
    .groupBy(bookmarksTable.collectionId);

  const countMap = new Map(counts.map((c) => [c.collectionId, c.count]));
  const result = collections.map((c) => ({ ...c, bookmarkCount: countMap.get(c.id) ?? 0 }));
  res.json(result);
});

// POST /collections
router.post("/collections", async (req, res) => {
  const parsed = CreateCollectionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const d = parsed.data as any;
  const [collection] = await db
    .insert(collectionsTable)
    .values({
      name: parsed.data.name,
      description: d.description ?? null,
      color: d.color ?? null,
      icon: d.icon ?? null,
      parentId: d.parentId ?? null,
    })
    .returning();

  res.status(201).json({ ...collection, bookmarkCount: 0 });
});

// PATCH /collections/:id
router.patch("/collections/:id", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = UpdateCollectionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const updateFields: Record<string, unknown> = {};
  const d = parsed.data as any;
  if (d.name !== undefined) updateFields.name = d.name;
  if (d.description !== undefined) updateFields.description = d.description;
  if (d.color !== undefined) updateFields.color = d.color;
  if (d.icon !== undefined) updateFields.icon = d.icon;
  if (d.parentId !== undefined) updateFields.parentId = d.parentId;

  const [collection] = await db
    .update(collectionsTable)
    .set(updateFields)
    .where(eq(collectionsTable.id, id))
    .returning();

  if (!collection) { res.status(404).json({ error: "Not found" }); return; }

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bookmarksTable)
    .where(eq(bookmarksTable.collectionId, id));

  res.json({ ...collection, bookmarkCount: countRow.count });
});

// DELETE /collections/:id
router.delete("/collections/:id", async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(collectionsTable).where(eq(collectionsTable.id, id));
  res.status(204).send();
});

export default router;
