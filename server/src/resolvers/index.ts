/* eslint-disable @typescript-eslint/no-explicit-any */
import { GraphQLScalarType, Kind } from "graphql";
import { PrismaClient } from "@prisma/client";
import type { GraphQLContext } from "../types/context.js";
import type { GenerationResult, StudyMode } from "../types/generation.js";
import { generateQuestions } from "../services/openai.js";

const prismaFallback = new PrismaClient();

const sanitize = (value: string, max = 120) =>
  value
    .replace(/<[^>]*>?/g, "")
    .trim()
    .slice(0, max);
const calcNextReview = (successStreak: number) => {
  const now = Date.now();
  if (successStreak <= 0) return new Date(now);
  if (successStreak === 1) return new Date(now + 60 * 60 * 1000);
  if (successStreak === 2) return new Date(now + 24 * 60 * 60 * 1000);
  if (successStreak === 3) return new Date(now + 3 * 24 * 60 * 60 * 1000);
  return new Date(now + 7 * 24 * 60 * 60 * 1000);
};

const upsertUserProgress = async (
  prisma: PrismaClient,
  userId: string,
  itemId: string,
  itemType: "flashcard" | "mcq",
  correct: boolean
) => {
  const existing =
    (await prisma.userProgress.findFirst({
      where: { userId, itemId, itemType },
    })) ?? null;

  const correctCount = (existing?.correctCount ?? 0) + (correct ? 1 : 0);
  const wrongCount = (existing?.wrongCount ?? 0) + (!correct ? 1 : 0);
  const successStreak = correct ? (existing?.successStreak ?? 0) + 1 : 0;
  const total = correctCount + wrongCount;
  const knowledgeScore =
    total === 0 ? 0 : Number(((correctCount / total) * 100).toFixed(2));

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

const progressDefaults = {
  correctCount: 0,
  wrongCount: 0,
  knowledgeScore: 0,
  successStreak: 0,
  lastReviewed: new Date(0),
  nextReview: new Date(0),
};

const toProgress = (record?: any) => {
  if (!record) return progressDefaults;
  return {
    correctCount: record.correctCount ?? 0,
    wrongCount: record.wrongCount ?? 0,
    knowledgeScore: record.knowledgeScore ?? 0,
    successStreak: record.successStreak ?? 0,
    lastReviewed: record.lastReviewed ?? new Date(0),
    nextReview: record.nextReview ?? new Date(0),
  };
};

const assertNonEmpty = (value: string, label: string) => {
  if (!value.trim()) {
    throw new Error(`${label} is required.`);
  }
};

const validateStudyMode = (mode: string): mode is StudyMode =>
  mode === "flashcards" || mode === "multiple-choice";
const maskError = (error: unknown) => {
  console.error("GraphQL mutation error:", error);
  return new Error("Internal server error");
};

const DateScalar = new GraphQLScalarType({
  name: "Date",
  description: "ISO-8601 date string",
  serialize(value) {
    return new Date(value as string | number | Date).toISOString();
  },
  parseValue(value) {
    return new Date(value as string);
  },
  parseLiteral(ast) {
    return ast.kind === Kind.STRING ? new Date(ast.value) : null;
  },
});

const persistGenerationResult = async (
  ctx: GraphQLContext,
  mode: StudyMode,
  theme: string,
  topic: string,
  items: GenerationResult
) => {
  if (!Array.isArray(items) || items.length === 0) return;

  if (mode === "flashcards") {
    const data = (items as any[]).map((item) => ({
      theme: item.theme ?? theme,
      topic: item.topic ?? topic ?? theme,
      level: item.level ?? "A1",
      question: item.question,
      answer: item.answer,
    }));
    await ctx.prisma.flashcard.createMany({ data });
    return;
  }

  const data = (items as any[]).map((item) => ({
    theme: item.theme ?? theme,
    topic: item.topic ?? topic ?? theme,
    level: item.level ?? "A1",
    question: item.question,
    answer: item.answer,
    choices: item.choices ?? [],
  }));
  await ctx.prisma.multipleChoiceQuestion.createMany({ data });
};

export const resolvers = {
  Date: DateScalar,
  Query: {
    getFlashcards: async (
      _: unknown,
      args: { theme?: string },
      ctx: GraphQLContext
    ) => {
      const client = ctx.prisma ?? prismaFallback;
      if (!client?.flashcard) {
        console.error("Prisma client missing flashcard delegate", client);
        throw new Error("Server misconfiguration: prisma unavailable.");
      }
      const where = args.theme ? { theme: args.theme } : {};
      const items = await client.flashcard.findMany({
        where,
        orderBy: { createdAt: "desc" },
      });

      if (!ctx.user) {
        return items.map((item: any) => ({
          ...item,
          progress: progressDefaults,
        }));
      }
      const ids = items.map((i: { id: string }) => i.id);
      const progress = await (client as any).userProgress.findMany({
        where: {
          userId: ctx.user.userId,
          itemId: { in: ids },
          itemType: "flashcard",
        },
      });
      const progressMap = new Map<string, any>(
        progress.map((p: any) => [p.itemId, p])
      );
      const now = Date.now();
      const due = items.filter((i: any) => {
        const p = progressMap.get(i.id);
        if (!p || !p.nextReview) return true;
        return Date.parse(String(p.nextReview)) <= now;
      });
      const selected = due.length > 0 ? due : items;
      return selected.map((item: any) => {
        const p = toProgress(progressMap.get(item.id));
        return {
          ...item,
          progress: p,
        };
      });
    },
    getMultipleChoiceQuestions: async (
      _: unknown,
      args: { theme?: string },
      ctx: GraphQLContext
    ) => {
      const client = ctx.prisma ?? prismaFallback;
      if (!client?.multipleChoiceQuestion) {
        console.error("Prisma client missing mcq delegate", client);
        throw new Error("Server misconfiguration: prisma unavailable.");
      }
      const where = args.theme ? { theme: args.theme } : {};
      const items = await client.multipleChoiceQuestion.findMany({
        where,
        orderBy: { createdAt: "desc" },
      });
      if (!ctx.user) {
        return items.map((item: any) => ({
          ...item,
          progress: progressDefaults,
        }));
      }
      const ids = items.map((i: { id: string }) => i.id);
      const progress = await (client as any).userProgress.findMany({
        where: {
          userId: ctx.user.userId,
          itemId: { in: ids },
          itemType: "mcq",
        },
      });
      const progressMap = new Map<string, any>(
        progress.map((p: any) => [p.itemId, p])
      );
      const now = Date.now();
      const due = items.filter((i: any) => {
        const p = progressMap.get(i.id);
        if (!p || !p.nextReview) return true;
        return Date.parse(String(p.nextReview)) <= now;
      });
      const selected = due.length > 0 ? due : items;
      return selected.map((item: any) => {
        const p = toProgress(progressMap.get(item.id));
        return {
          ...item,
          progress: p,
        };
      });
    },
  },
  Mutation: {
    createFlashcard: async (
      _: unknown,
      {
        input,
      }: { input: { theme?: string; question: string; answer: string } },
      ctx: GraphQLContext
    ) => {
      if (!ctx.isAuthenticated) {
        throw new Error("Unauthorized");
      }
      try {
        assertNonEmpty(input.question, "Question");
        assertNonEmpty(input.answer, "Answer");
        const theme = input.theme ? sanitize(input.theme) : undefined;
        const question = sanitize(input.question);
        const answer = sanitize(input.answer, 300);
        const created = await ctx.prisma.flashcard.create({
          data: {
            theme,
            question,
            answer,
          },
        });
        return { ...created, progress: progressDefaults };
      } catch (error) {
        throw maskError(error);
      }
    },
    createMultipleChoiceQuestion: async (
      _: unknown,
      {
        input,
      }: {
        input: {
          theme?: string;
          question: string;
          answer: string;
          choices: string[];
        };
      },
      ctx: GraphQLContext
    ) => {
      if (!ctx.isAuthenticated) {
        throw new Error("Unauthorized");
      }
      try {
        assertNonEmpty(input.question, "Question");
        assertNonEmpty(input.answer, "Answer");
        if (!Array.isArray(input.choices) || input.choices.length < 3) {
          throw new Error("At least 3 choices are required.");
        }
        const theme = input.theme ? sanitize(input.theme) : undefined;
        const question = sanitize(input.question);
        const answer = sanitize(input.answer, 300);
        const choices = input.choices.map((c) => sanitize(c, 200));
        const created = await ctx.prisma.multipleChoiceQuestion.create({
          data: {
            theme,
            question,
            answer,
            choices,
          },
        });
        return { ...created, progress: progressDefaults };
      } catch (error) {
        throw maskError(error);
      }
    },
    updateFlashcardStats: async (
      _: unknown,
      { id, correct = true }: { id: string; correct?: boolean },
      ctx: GraphQLContext
    ) => {
      if (!ctx.isAuthenticated || !ctx.user) {
        throw new Error("Unauthorized");
      }
      try {
        const client = ctx.prisma ?? prismaFallback;
        await upsertUserProgress(
          client,
          ctx.user.userId,
          id,
          "flashcard",
          correct
        );
        const item = await client.flashcard.findUnique({ where: { id } });
        const progress =
          (await client.userProgress.findFirst({
            where: {
              userId: ctx.user.userId,
              itemId: id,
              itemType: "flashcard",
            },
          })) ?? null;
        return { ...item, progress: toProgress(progress) };
      } catch (error) {
        throw maskError(error);
      }
    },
    updateMultipleChoiceStats: async (
      _: unknown,
      { id, correct = true }: { id: string; correct?: boolean },
      ctx: GraphQLContext
    ) => {
      if (!ctx.isAuthenticated || !ctx.user) {
        throw new Error("Unauthorized");
      }
      try {
        const client = ctx.prisma ?? prismaFallback;
        await upsertUserProgress(client, ctx.user.userId, id, "mcq", correct);
        const item = await client.multipleChoiceQuestion.findUnique({
          where: { id },
        });
        const progress =
          (await client.userProgress.findFirst({
            where: { userId: ctx.user.userId, itemId: id, itemType: "mcq" },
          })) ?? null;
        return { ...item, progress: toProgress(progress) };
      } catch (error) {
        throw maskError(error);
      }
    },
    generateStudyContent: async (
      _: unknown,
      { mode, theme }: { mode: StudyMode; theme: string },
      ctx: GraphQLContext
    ) => {
      if (!ctx.isAuthenticated) {
        throw new Error("Unauthorized");
      }
      if (ctx.user && ctx.user.role !== "admin") {
        throw new Error("Forbidden: admin role required for generation.");
      }
      try {
        if (!validateStudyMode(mode)) {
          throw new Error("Invalid study mode provided.");
        }
        const cleanTheme = sanitize(theme);
        assertNonEmpty(cleanTheme, "Theme");
        const cleanTopic = cleanTheme;

        const generated = await generateQuestions(mode, cleanTheme, undefined, cleanTopic);
        try {
          await persistGenerationResult(ctx, mode, cleanTheme, cleanTopic, generated);
        } catch (error) {
          console.error("Persist generated content failed, continuing", error);
        }
        return JSON.stringify(generated);
      } catch (error) {
        throw maskError(error);
      }
    },
  },
};
