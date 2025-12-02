export type StudyMode = "Flashcards" | "Multiple-Choice";

type Prompt = Record<string, string>;
export type StudyLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export const prompts: Prompt = {
  getThemes:
    'Return ONLY a valid JSON array of COUNT language-learning themes as strings. Example: ["School", "Health", "Neighborhood"]. No prose.',
  getFlashcards: `
    You are a content generator for a German learning app.
    Return ONLY a valid JSON array of exactly 10 flashcard items about THEME in WORD-LEVEL. No prose, no preamble, no markdown.

    Each item must match this shape:
    {
      "theme": string,
      "topic": string,
      "level": "A1" | "A2" | "B1" | "B2" | "C1" | "C2",
      "question": string,
      "answer": string,
      "correctCount": 0,
      "wrongCount": 0,
      "knowledgeScore": 0
    }

    Do not include id, createdAt, or updatedAt. Keep JSON strictly valid.
    `,
  getMultipleChoice: `
    You are a content generator for a German learning app.
    Return ONLY a valid JSON array of exactly 10 multiple choice items about THEME in WORD-LEVEL. No prose, no preamble, no markdown.

    Each item must match this shape:
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
    `,
};

export type FlashcardItem = {
  theme: string;
  topic: string;
  level: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
  question: string;
  answer: string;
};

export type MultipleChoiceItem = {
  theme: string;
  topic: string;
  level: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
  question: string;
  answer: string;
  choices: string[];
};

export type PersistItem = FlashcardItem | MultipleChoiceItem;
