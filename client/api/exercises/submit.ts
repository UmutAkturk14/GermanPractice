import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PrismaClient } from "@prisma/client";
import type { StudyMode } from "../../server/src/types/generation.js";
import { enforceJsonContent, rateLimit, verifyAuth } from "../security.js";
import { exerciseSubmitSchema } from "../validators.js";
import { verifyJWT } from "../auth.js";

const prisma = new PrismaClient();

const calcNextReview = (successStreak: number) => {
  const now = Date.now();
  if (successStreak <= 0) return new Date(now);
  if (successStreak === 1) return new Date(now + 60 * 60 * 1000);
  if (successStreak === 2) return new Date(now + 24 * 60 * 60 * 1000);
  if (successStreak === 3) return new Date(now + 3 * 24 * 60 * 60 * 1000);
  return new Date(now + 7 * 24 * 60 * 60 * 1000);
};

const upsertUserProgress = async (
  userId: string,
  itemId: string,
  itemType: "flashcard" | "mcq",
  correct: boolean,
) => {
  const existing = await prisma.userProgress.findFirst({
    where: { userId, itemId, itemType },
  });

  const correctCount = (existing?.correctCount ?? 0) + (correct ? 1 : 0);
  const wrongCount = (existing?.wrongCount ?? 0) + (!correct ? 1 : 0);
  const successStreak = correct ? (existing?.successStreak ?? 0) + 1 : 0;
  const total = correctCount + wrongCount;
  const knowledgeScore = total === 0 ? 0 : Number(((correctCount / total) * 100).toFixed(2));

  const data = {
    userId,
    itemId,
    itemType,
    correctCount,
    wrongCount,
    successStreak,
    knowledgeScore,
    lastReviewed: new Date(),
    nextReview: calcNextReview(successStreak),
  };

  if (existing?.id) {
    return prisma.userProgress.update({ where: { id: existing.id }, data });
  }
  return prisma.userProgress.create({ data });
};

const parseJsonBody = (raw: unknown) => {
  if (!raw) return null;
  if (raw instanceof Uint8Array) {
    try {
      return JSON.parse(raw.toString()) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  if (typeof raw === "object") {
    return raw as Record<string, unknown>;
  }
  return null;
};

const isStudyMode = (value: unknown): value is StudyMode =>
  value === "flashcards" || value === "multiple-choice";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  const jwtPayload = await verifyJWT(req);
  if (!jwtPayload && !(await verifyAuth(req, res))) return;
  const user = jwtPayload;
  if (!(await rateLimit(req, res))) return;
  if (req.method === "POST" && !enforceJsonContent(req, res)) return;

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const body = parseJsonBody(req.body);
  const parsed = exerciseSubmitSchema.safeParse(body);

  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  const { id, mode } = parsed.data;
  const correct = parsed.data.correct ?? true;

  if (!isStudyMode(mode) || !id) {
    res.status(400).json({
      error: "Provide mode ('flashcards' or 'multiple-choice') and question id.",
    });
    return;
  }

  if (!user?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const updated = await upsertUserProgress(
      user.userId,
      id,
      mode === "flashcards" ? "flashcard" : "mcq",
      correct,
    );

    res.status(200).json({
      mode,
      progress: {
        correctCount: updated.correctCount,
        wrongCount: updated.wrongCount,
        knowledgeScore: updated.knowledgeScore,
        successStreak: updated.successStreak,
        lastReviewed: updated.lastReviewed,
        nextReview: updated.nextReview,
      },
    });
  } catch (error) {
    console.error("[api/exercises/submit] error", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(message.includes("not found") ? 404 : 500).json({
      error: { message: message.includes("not found") ? message : "Internal server error", code: "SERVER_ERROR" },
    });
  }
}
