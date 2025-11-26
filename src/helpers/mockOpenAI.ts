import type { NormalizedContent, NormalizedItem, StudyMode } from "../types/content";
import { getToken } from "./authClient";

type MockFlashcard = { front: string; back: string };
type MockQuestion = { question: string; correctAnswer: string; distractors: string[] };
type MockApiResponse =
  | { mode: "flashcards"; theme: string; flashcards: MockFlashcard[] }
  | { mode: "multiple-choice"; theme: string; questions: MockQuestion[] };

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const buildSample = (mode: StudyMode, theme: string): MockApiResponse => {
  const lowercaseTheme = theme.toLowerCase();

  if (mode === "flashcards") {
    return {
      mode,
      theme,
      flashcards: [
        { front: "die Schule", back: "school" },
        { front: "der Lehrer", back: "teacher" },
        { front: "die Hausaufgaben", back: "homework" },
        { front: "die Prüfung", back: "exam" },
      ],
    };
  }

  return {
    mode,
    theme,
    questions: [
      {
        question: `How do you say "classroom" in ${lowercaseTheme}?`,
        correctAnswer: "das Klassenzimmer",
        distractors: ["die Mensa", "die Tafel", "das Wörterbuch"],
      },
      {
        question: `Choose the correct article for "Schüler" (${lowercaseTheme}).`,
        correctAnswer: "der",
        distractors: ["die", "das", "den"],
      },
      {
        question: `What is the plural of "die Aufgabe" (${lowercaseTheme})?`,
        correctAnswer: "die Aufgaben",
        distractors: ["die Aufgabe", "die Aufgabes", "die Aufgabern"],
      },
    ],
  };
};

const GRAPHQL_ENDPOINT =
  import.meta.env.VITE_GRAPHQL_ENDPOINT ?? "/api/graphql";

const GENERATE_STUDY_CONTENT_MUTATION = `
  mutation GenerateStudyContent($mode: String!, $theme: String!) {
    generateStudyContent(mode: $mode, theme: $theme)
  }
`;

type BackendResponse = {
  data?: { generateStudyContent: string };
  errors?: { message: string }[];
};

export const generateContent = async (
  mode: StudyMode,
  theme: string,
): Promise<string> => {
  try {
    const token = getToken();
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        query: GENERATE_STUDY_CONTENT_MUTATION,
        variables: { mode, theme },
      }),
    });

    if (!response.ok) {
      throw new Error(`Backend request failed with status ${response.status}`);
    }

    const json = (await response.json()) as BackendResponse;

    if (json.errors?.length) {
      throw new Error(json.errors.map((e) => e.message).join("; "));
    }

    if (!json.data?.generateStudyContent) {
      throw new Error("Backend response missing payload.");
    }

    return json.data.generateStudyContent;
  } catch (error) {
    // Gracefully fall back to mock data if backend generation is unavailable.
    console.warn("Falling back to mock content:", error);
    return mockGenerateContent(mode, theme);
  }
};

export const mockGenerateContent = async (
  mode: StudyMode,
  theme: string,
): Promise<string> => {
  await delay(850);
  const payload = buildSample(mode, theme);
  return JSON.stringify(payload, null, 2);
};

export const normalizeContent = (json: string): NormalizedContent => {
  const parsed = JSON.parse(json) as MockApiResponse;
  const items: NormalizedItem[] = [];

  if (parsed.mode === "flashcards" && "flashcards" in parsed) {
    parsed.flashcards.forEach((card: MockFlashcard, index: number) => {
      items.push({
        id: `flashcard-${index}`,
        kind: "flashcards",
        prompt: card.front,
        answer: card.back,
        theme: parsed.theme,
      });
    });
  }

  if (parsed.mode === "multiple-choice" && "questions" in parsed) {
    parsed.questions.forEach((question: MockQuestion, index: number) => {
      items.push({
        id: `mc-${index}`,
        kind: "multiple-choice",
        prompt: question.question,
        answer: question.correctAnswer,
        options: [question.correctAnswer, ...question.distractors],
        theme: parsed.theme,
      });
    });
  }

  return {
    mode: parsed.mode,
    theme: parsed.theme,
    items,
  };
};

export const prepareForDatabaseInsert = (
  normalized: NormalizedContent,
): NormalizedContent => {
  // TODO: Replace with actual persistence once a backend/DB is in place.
  return normalized;
};
