import OpenAI from "openai";
import type { GenerationResult, StudyMode } from "../types/generation";

type Level = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

const LEVELS: Level[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const OPENAI_PROMPT_TEMPLATE = `
You are a content generator for a German learning app.
Return ONLY a valid JSON array of exactly 5 items. No prose, no preamble, no markdown.

Each item must include level (A1-C2) and topic, and match the Prisma-backed model for the selected mode:

- Flashcards:
  {
    "theme": string,
    "topic": string,
    "level": "A1" | "A2" | "B1" | "B2" | "C1" | "C2",
    "question": string, // a single German word with its article and its plural (ex. "das Buch (die Bücher))") form or short phrase (not a full question; no question marks)
    "answer": string,   // concise translation/meaning in English (<= 8 words)
    "correctCount": 0,
    "wrongCount": 0,
    "knowledgeScore": 0
  }

- Multiple Choice:
  {
    "theme": string,
    "topic": string,
    "level": "A1" | "A2" | "B1" | "B2" | "C1" | "C2",
    "question": string,
    "answer": string,
    "choices": ["option A", "option B", "option C", "option D"],
    "correctCount": 0,
    "wrongCount": 0,
    "knowledgeScore": 0
  }

Do not include id, createdAt, or updatedAt. Keep JSON strictly valid.
`;

export const flashcardSchema = {
  name: "FlashcardArray",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["items"],
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "theme",
            "topic",
            "level",
            "question",
            "answer",
            "correctCount",
            "wrongCount",
            "knowledgeScore",
          ],
          properties: {
            theme: { type: "string" },
            topic: { type: "string" },
            level: { type: "string" },
            question: { type: "string" },
            answer: { type: "string" },
            correctCount: { type: "integer" },
            wrongCount: { type: "integer" },
            knowledgeScore: { type: "number" },
          },
        },
      },
    },
  },
} as const;

export const multipleChoiceSchema = {
  name: "MultipleChoiceArray",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["items"],
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "theme",
            "topic",
            "level",
            "question",
            "answer",
            "choices",
            "correctCount",
            "wrongCount",
            "knowledgeScore",
          ],
          properties: {
            theme: { type: "string" },
            topic: { type: "string" },
            level: { type: "string" },
            question: { type: "string" },
            answer: { type: "string" },
            choices: {
              type: "array",
              minItems: 3,
              items: { type: "string" },
            },
            correctCount: { type: "integer" },
            wrongCount: { type: "integer" },
            knowledgeScore: { type: "number" },
          },
        },
      },
    },
  },
} as const;

const getSchemaForMode = (mode: StudyMode) =>
  mode === "flashcards" ? flashcardSchema : multipleChoiceSchema;

async function fetchQuestionsForLevel(
  mode: StudyMode,
  theme: string,
  level: string,
  topic?: string
): Promise<GenerationResult> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing. Set it in /server/.env");
  }

  const safeTheme = theme
    .trim()
    .replace(/<[^>]*>?/gm, "")
    .slice(0, 200);
  const safeTopic = topic
    ? topic
        .trim()
        .replace(/<[^>]*>?/gm, "")
        .slice(0, 120)
    : "";
  const safeLevel: Level = /^A[12]|B[12]|C[12]$/.test(level)
    ? (level as Level)
    : "A1";
  const prompt = `${OPENAI_PROMPT_TEMPLATE}\nMode: ${mode}\nTheme: ${safeTheme}\nTopic: ${safeTopic || safeTheme}\nLevel: ${safeLevel}\nGenerate 10 items now.`;

  const schema = getSchemaForMode(mode);

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: schema.name,
        schema: schema.schema,
        strict: schema.strict,
      },
    },
    temperature: 0.6,
  });

  const content = completion.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI response was empty or malformed.");
  }

  const raw = JSON.parse(content) as
    | GenerationResult
    | { items?: GenerationResult };
  const parsed = Array.isArray(raw) ? raw : raw.items;

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("OpenAI response did not contain items.");
  }

  return parsed;
}

export async function generateQuestions(
  mode: StudyMode,
  theme: string,
  level?: string,
  topic?: string
): Promise<GenerationResult> {
  // Always generate across all levels; ignore incoming single-level hints.
  const levelList = [...LEVELS];

  const allResults: GenerationResult = [];

  for (const lvl of levelList) {
    const items = await fetchQuestionsForLevel(mode, theme, lvl, topic);
    console.log(`Fetching questions: ${theme}\nLevel: ${lvl}`);
    // ensure level is set on each item
    const normalized = items.map((item) => ({
      ...item,
      level: item.level || (lvl as Level),
      topic: item.topic || theme,
      theme: item.theme || theme,
    })) as GenerationResult;
    allResults.push(...normalized);
  }

  return allResults;
}
