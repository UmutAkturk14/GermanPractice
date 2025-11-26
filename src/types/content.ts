export type StudyMode = "flashcards" | "multiple-choice";

export type NormalizedItem = {
  id: string;
  kind: StudyMode;
  prompt: string;
  answer: string;
  options?: string[];
  theme: string;
  level?: string | null;
  topic?: string | null;
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

export type NormalizedContent = {
  mode: StudyMode;
  theme: string;
  items: NormalizedItem[];
};
