import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PrismaClient } from "@prisma/client";
import { requireUser } from "../auth.js";
import { rateLimit } from "../security.js";

const prisma = new PrismaClient();

type ProgressEvent = {
  itemId: string;
  itemType: "flashcard" | "mcq";
  result: "correct" | "incorrect";
  timestamp: number;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await requireUser(req, res);
  if (!user) return;
  if (!(await rateLimit(req, res))) return;
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const events = (req.body as { events?: unknown }).events as ProgressEvent[] | undefined;
  if (!Array.isArray(events) || events.length === 0) {
    res.status(400).json({ error: { message: "No events provided", code: "BAD_REQUEST" } });
    return;
  }

  // Basic payload validation
  const validEvents = events.filter(
    (ev) =>
      ev &&
      typeof ev.itemId === "string" &&
      (ev.itemType === "flashcard" || ev.itemType === "mcq") &&
      (ev.result === "correct" || ev.result === "incorrect") &&
      typeof ev.timestamp === "number",
  );

  if (validEvents.length === 0) {
    res.status(400).json({ error: { message: "No valid events provided", code: "BAD_REQUEST" } });
    return;
  }

  const updates: Record<string, unknown> = {};

  try {
    await prisma.$transaction(async (tx) => {
      // Fetch existing rows in one query
      const existing = await tx.userProgress.findMany({
        where: {
          userId: user.userId,
          itemId: { in: validEvents.map((e) => e.itemId) },
          itemType: { in: validEvents.map((e) => e.itemType) },
        },
      });
      const mapKey = (e: ProgressEvent) => `${e.itemId}:${e.itemType}`;
      type ProgressRow = (typeof existing)[number];
      const existingMap = new Map<string, ProgressRow>(
        existing.map((row) => [mapKey(row), row]),
      );

      for (const ev of validEvents) {
        const key = mapKey(ev);
        const current = existingMap.get(key);
        const now = new Date();

        if (!current) {
          const successStreak = ev.result === "correct" ? 1 : 0;
          const nextReview = new Date(
            now.getTime() +
              (ev.result === "correct" ? 60 * 60 * 1000 : 5 * 60 * 1000),
          );
          const created = await tx.userProgress.create({
            data: {
              userId: user.userId,
              itemId: ev.itemId,
              itemType: ev.itemType,
              correctCount: ev.result === "correct" ? 1 : 0,
              wrongCount: ev.result === "incorrect" ? 1 : 0,
              successStreak,
              knowledgeScore: ev.result === "correct" ? 1 : 0,
              lastReviewed: now,
              nextReview,
            },
          });
          updates[ev.itemId] = created;
          continue;
        }

        const correctCount = current.correctCount + (ev.result === "correct" ? 1 : 0);
        const wrongCount = current.wrongCount + (ev.result === "incorrect" ? 1 : 0);
        const successStreak = ev.result === "correct" ? current.successStreak + 1 : 0;
        const nextReview = new Date(
          now.getTime() +
            (ev.result === "correct"
              ? 60 * 60 * 1000 * Math.max(1, successStreak)
              : 5 * 60 * 1000),
        );

        const updated = await tx.userProgress.update({
          where: { id: current.id },
          data: {
            correctCount,
            wrongCount,
            successStreak,
            knowledgeScore: correctCount / Math.max(1, correctCount + wrongCount),
            lastReviewed: now,
            nextReview,
          },
        });
        updates[ev.itemId] = updated;
      }
    });

    res.status(200).json({ progress: updates });
  } catch (error) {
    console.error("[api/progress/batch] error", error);
    res.status(500).json({ error: { message: "Internal server error", code: "SERVER_ERROR" } });
  }
}
