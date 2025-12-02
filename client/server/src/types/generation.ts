export type StudyMode = "flashcards" | "multiple-choice";

export type GeneratedFlashcard = {
  theme: string;
  topic?: string;
  level?: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
  question: string;
  answer: string;
  correctCount: number;
  wrongCount: number;
  knowledgeScore: number;
};

export type GeneratedMultipleChoice = {
  theme: string;
  topic?: string;
  level?: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
  question: string;
  answer: string;
  choices: string[];
  correctCount: number;
  wrongCount: number;
  knowledgeScore: number;
};

export type GenerationResult = Array<
  GeneratedFlashcard | GeneratedMultipleChoice
>;
