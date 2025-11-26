import { getToken } from "./authClient";
import type { NormalizedContent, StudyMode } from "../types/content";

const GRAPHQL_ENDPOINT =
  import.meta.env.VITE_GRAPHQL_ENDPOINT ?? "/api/graphql";

const GET_FLASHCARDS = `
  query GetFlashcards {
    getFlashcards {
      id
      theme
      topic
      level
      question
      answer
      createdAt
      progress {
        correctCount
        wrongCount
        knowledgeScore
        successStreak
        lastReviewed
        nextReview
      }
    }
  }
`;

const GET_MULTIPLE_CHOICE = `
  query GetMultipleChoice {
    getMultipleChoiceQuestions {
      id
      theme
      topic
      level
      question
      answer
      choices
      createdAt
      progress {
        correctCount
        wrongCount
        knowledgeScore
        successStreak
        lastReviewed
        nextReview
      }
    }
  }
`;

type FlashcardRow = {
  id: string;
  theme: string | null;
  topic?: string | null;
  level?: string | null;
  question: string;
  answer: string;
  createdAt?: string | null;
  progress?: {
    correctCount: number;
    wrongCount: number;
    knowledgeScore: number;
    successStreak: number;
    lastReviewed: string;
    nextReview: string;
  } | null;
};

type MultipleChoiceRow = {
  id: string;
  theme: string | null;
  topic?: string | null;
  level?: string | null;
  question: string;
  answer: string;
  choices: string[];
  createdAt?: string | null;
  progress?: {
    correctCount: number;
    wrongCount: number;
    knowledgeScore: number;
    successStreak: number;
    lastReviewed: string;
    nextReview: string;
  } | null;
};

type GraphQLResponse<T> = { data?: T; errors?: { message: string }[] };

export const fetchExercisesByMode = async (
  mode: StudyMode,
  filters?: { level?: string; topic?: string; sort?: "oldest" | "newest" | "due" | "random" },
): Promise<NormalizedContent> => {
  const payload = mode === "flashcards" ? { query: GET_FLASHCARDS } : { query: GET_MULTIPLE_CHOICE };

  const token = getToken();

  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }

  const sortItems = (list: NormalizedContent["items"]) => {
    let filtered = list;
    if (filters?.topic) {
      const match = filters.topic.toLowerCase();
      filtered = filtered.filter((item) =>
        (item.topic ?? item.theme ?? "").toLowerCase().includes(match),
      );
    }
    if (filters?.level && filters.level !== "all") {
      filtered = filtered.filter((item) => item.level === filters.level);
    }

    const now = Date.now();
    const due = filtered.filter((item) => {
      const next = item.progress?.nextReview ? Date.parse(item.progress.nextReview) : 0;
      return !next || next <= now;
    });
    const dueIds = new Set(due.map((d) => d.id));
    let ordered = [...due, ...filtered.filter((i) => !dueIds.has(i.id))];

    if (filters?.sort === "oldest") {
      ordered = [...ordered].sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
    } else if (filters?.sort === "newest") {
      ordered = [...ordered].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    } else if (filters?.sort === "random") {
      ordered = [...ordered].sort(() => Math.random() - 0.5);
    }
    return ordered;
  };

  if (mode === "flashcards") {
    const json = (await res.json()) as GraphQLResponse<{ getFlashcards: FlashcardRow[] }>;
    if (json.errors?.length) {
      throw new Error(json.errors.map((e) => e.message).join("; "));
    }
    const items =
      json.data?.getFlashcards.map((row) => ({
        id: row.id,
        kind: "flashcards" as const,
        prompt: row.question,
        answer: row.answer,
        theme: row.theme ?? "General",
        level: row.level ?? null,
        topic: row.topic ?? null,
        createdAt: row.createdAt ?? null,
        progress: row.progress ?? null,
      })) ?? [];
    const ordered = sortItems(items);
    if (ordered.length === 0) throw new Error("No flashcards found in the database.");
    return { mode, theme: ordered[0].theme, items: ordered };
  }

  const json = (await res.json()) as GraphQLResponse<{ getMultipleChoiceQuestions: MultipleChoiceRow[] }>;
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }
  const items =
    json.data?.getMultipleChoiceQuestions.map((row) => ({
      id: row.id,
      kind: "multiple-choice" as const,
      prompt: row.question,
      answer: row.answer,
      options: row.choices,
      theme: row.theme ?? "General",
      level: row.level ?? null,
      topic: row.topic ?? null,
      createdAt: row.createdAt ?? null,
      progress: row.progress ?? null,
    })) ?? [];
  const ordered = sortItems(items);
  if (ordered.length === 0) throw new Error("No multiple-choice questions found in the database.");
  return { mode, theme: ordered[0].theme, items: ordered };
};
