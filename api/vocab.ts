import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PrismaClient } from "@prisma/client";
import openAiModule from "../server/dist/services/openai.js";
import type {
  GeneratedFlashcard,
  GeneratedMultipleChoice,
  GenerationResult,
  StudyMode,
} from "../server/src/types/generation.js";
import { enforceJsonContent, rateLimit, verifyAuth } from "./security.js";
import { vocabSchema } from "./validators.js";
import { getUserFromRequest, verifyJWT } from "./auth.js";

const prisma = new PrismaClient();
const { generateQuestions } = openAiModule as typeof import("../server/src/services/openai.js");

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

const persistGeneratedItems = async (
  mode: StudyMode,
  theme: string,
  level: string,
  topic: string,
  items: GenerationResult,
) => {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  if (mode === "flashcards") {
    return prisma.$transaction(
      (items as GeneratedFlashcard[]).map((item) =>
        prisma.flashcard.create({
          data: {
            theme: item.theme ?? theme,
            level: (item as GeneratedFlashcard & { level?: string }).level ?? level,
            topic: (item as GeneratedFlashcard & { topic?: string }).topic ?? topic,
            question: item.question,
            answer: item.answer,
            correctCount: item.correctCount,
            wrongCount: item.wrongCount,
            knowledgeScore: item.knowledgeScore,
          },
        }),
      ),
    );
  }

  return prisma.$transaction(
    (items as GeneratedMultipleChoice[]).map((item) =>
      prisma.multipleChoiceQuestion.create({
        data: {
          theme: item.theme ?? theme,
          level: (item as GeneratedMultipleChoice & { level?: string }).level ?? level,
          topic: (item as GeneratedMultipleChoice & { topic?: string }).topic ?? topic,
          question: item.question,
          answer: item.answer,
          choices: item.choices,
          correctCount: item.correctCount,
          wrongCount: item.wrongCount,
          knowledgeScore: item.knowledgeScore,
        },
      }),
    ),
  );
};

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  const jwtPayload = await verifyJWT(req);
  if (!jwtPayload && !(await verifyAuth(req, res))) return;
  const user = jwtPayload ?? (await getUserFromRequest(req));
  if (!user) {
    res.status(401).json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } });
    return;
  }
  if (user.role !== "admin") {
    res
      .status(403)
      .json({ error: { message: "Admin role required to generate content", code: "FORBIDDEN" } });
    return;
  }
  if (!(await rateLimit(req, res))) return;
  if (req.method === "POST" && !enforceJsonContent(req, res)) return;

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: { message: "Method not allowed", code: "METHOD_NOT_ALLOWED" } });
    return;
  }

  const body = parseJsonBody(req.body);
  const parsed = vocabSchema.safeParse(body);

  if (!parsed.success) {
    res
      .status(400)
      .json({ error: { message: "Invalid payload", code: "BAD_REQUEST" }, details: parsed.error.flatten() });
    return;
  }

  const { mode, theme } = parsed.data;
  const themeValue = theme.trim();
  const levelRaw = typeof body?.level === "string" ? body.level : "";
  const topicRaw = typeof body?.topic === "string" ? body.topic : "";
  const topic = topicRaw.replace(/<[^>]*>?/g, "").trim().slice(0, 120) || themeValue;
  const requestedLevels =
    levelRaw && /^A[12]|B[12]|C[12]$/.test(levelRaw)
      ? [levelRaw]
      : ["A1", "A2", "B1", "B2", "C1", "C2"];

  try {
    const allPersisted: GenerationResult = [];

    for (const lvl of requestedLevels) {
      const generated = await generateQuestions(mode, themeValue, lvl, topic);
      const persisted = await persistGeneratedItems(mode, themeValue, lvl, topic, generated);
      allPersisted.push(...persisted);
    }

    res.status(200).json({
      mode,
      theme: themeValue,
      level: requestedLevels.length === 1 ? requestedLevels[0] : "all",
      topic,
      count: allPersisted.length,
      items: allPersisted,
    });
  } catch (error) {
    console.error("[api/vocab] error", error);
    res.status(500).json({ error: { message: "Internal server error", code: "SERVER_ERROR" } });
  }
}
