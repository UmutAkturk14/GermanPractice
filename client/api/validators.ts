import { z } from "zod";

export const vocabSchema = z.object({
  mode: z.enum(["flashcards", "multiple-choice"]),
  theme: z.string().min(1).max(200),
});

export const exerciseSubmitSchema = z.object({
  id: z.string().min(1),
  correct: z.boolean().optional(),
  mode: z.enum(["flashcards", "multiple-choice"]),
});

export const graphqlAuthSchema = z.object({
  query: z.string().min(1),
  variables: z.record(z.any()).optional(),
});
