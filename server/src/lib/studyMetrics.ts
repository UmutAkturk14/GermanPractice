import type { PrismaClient } from "@prisma/client";

export const calculateKnowledgeScore = (
  correctCount: number,
  wrongCount: number,
) => {
  const total = correctCount + wrongCount;
  if (total === 0) return 0;
  return Number(((correctCount / total) * 100).toFixed(2));
};

export async function updateFlashcardStats(
  prisma: PrismaClient,
  id: string,
) {
  const existing = await prisma.flashcard.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new Error("Flashcard not found");
  }

  // Progress is now per-user; base items are unchanged.
  return existing;
}

export async function updateMultipleChoiceStats(
  prisma: PrismaClient,
  id: string,
) {
  const existing = await prisma.multipleChoiceQuestion.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new Error("MultipleChoiceQuestion not found");
  }

  // Progress is now per-user; base items are unchanged.
  return existing;
}
