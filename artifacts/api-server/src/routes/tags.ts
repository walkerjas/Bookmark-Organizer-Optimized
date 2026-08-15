import { Router } from "express";
import { db } from "@workspace/db";
import { tagsTable } from "@workspace/db";
import { asc, eq } from "drizzle-orm";
import { CreateTagBody, UpdateTagBody } from "@workspace/api-zod";

const router = Router();

// GET /tags
router.get("/tags", async (req, res) => {
  const tags = await db.select().from(tagsTable).orderBy(asc(tagsTable.sortOrder), asc(tagsTable.name));
  res.json(tags);
});

// POST /tags
router.post("/tags", async (req, res) => {
  const parsed = CreateTagBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const allTags = await db.select({ id: tagsTable.id }).from(tagsTable);
  const nextOrder = allTags.length;

  const [tag] = await db
    .insert(tagsTable)
    .values({
      name: parsed.data.name,
      color: (parsed.data as any).color ?? null,
      sortOrder: nextOrder,
    })
    .returning();

  res.status(201).json(tag);
});

// PATCH /tags/:id
router.patch("/tags/:id", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = UpdateTagBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const updates: Partial<typeof tagsTable.$inferInsert> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.color !== undefined) updates.color = parsed.data.color;
  if (parsed.data.sortOrder !== undefined) updates.sortOrder = parsed.data.sortOrder;

  const [tag] = await db.update(tagsTable).set(updates).where(eq(tagsTable.id, id)).returning();
  res.json(tag);
});

// DELETE /tags/:id
router.delete("/tags/:id", async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(tagsTable).where(eq(tagsTable.id, id));
  res.status(204).send();
});

export default router;
