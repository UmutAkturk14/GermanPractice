/* eslint-disable @typescript-eslint/no-unused-vars */
import "dotenv/config";
import OpenAI from "openai";
import { prompts } from "../types/openai/openai";
import { prisma } from "../server/src/prisma/client";

console.log("Seeding the DB.");

await prisma.$connect();

const payload = [
  {
    theme: "Gesundheit",
    topic: "Körperteile",
    level: "A1",
    question: "Wie heißt 'head' auf Deutsch?",
    answer: "Kopf",
    correctCount: 0,
    wrongCount: 0,
    knowledgeScore: 0,
  },
  {
    theme: "Gesundheit",
    topic: "Krankheiten",
    level: "A1",
    question: "Was bedeutet 'Fieber'?",
    answer: "Hohe Körpertemperatur",
    correctCount: 0,
    wrongCount: 0,
    knowledgeScore: 0,
  },
  {
    theme: "Gesundheit",
    topic: "Medikamente",
    level: "A1",
    question: "Wie sagt man 'medicine' auf Deutsch?",
    answer: "Medikament",
    correctCount: 0,
    wrongCount: 0,
    knowledgeScore: 0,
  },
  {
    theme: "Gesundheit",
    topic: "Körperpflege",
    level: "A1",
    question: "Was ist 'die Zahnbürste'?",
    answer: "Ein Werkzeug zum Zähne putzen",
    correctCount: 0,
    wrongCount: 0,
    knowledgeScore: 0,
  },
  {
    theme: "Gesundheit",
    topic: "Symptome",
    level: "A1",
    question: "Was bedeutet 'Husten'?",
    answer: "Wenn man Luft hart ausatmet und Geräusche macht",
    correctCount: 0,
    wrongCount: 0,
    knowledgeScore: 0,
  },
  {
    theme: "Gesundheit",
    topic: "Arztbesuch",
    level: "A1",
    question: "Wie fragt man auf Deutsch: 'Where is the doctor?'",
    answer: "Wo ist der Arzt?",
    correctCount: 0,
    wrongCount: 0,
    knowledgeScore: 0,
  },
  {
    theme: "Gesundheit",
    topic: "Gesunde Ernährung",
    level: "A1",
    question: "Was sind 'Obst und Gemüse'?",
    answer: "Gesunde Lebensmittel wie Äpfel und Karotten",
    correctCount: 0,
    wrongCount: 0,
    knowledgeScore: 0,
  },
  {
    theme: "Gesundheit",
    topic: "Körperpflege",
    level: "A1",
    question: "Was macht man mit einer Seife?",
    answer: "Man wäscht sich die Hände",
    correctCount: 0,
    wrongCount: 0,
    knowledgeScore: 0,
  },
  {
    theme: "Gesundheit",
    topic: "Krankheiten",
    level: "A1",
    question: "Was ist eine Grippe?",
    answer: "Eine ansteckende Krankheit mit Fieber und Husten",
    correctCount: 0,
    wrongCount: 0,
    knowledgeScore: 0,
  },
  {
    theme: "Gesundheit",
    topic: "Gesundheitstipps",
    level: "A1",
    question: "Warum ist Trinken wichtig für die Gesundheit?",
    answer: "Weil Wasser den Körper gesund hält",
    correctCount: 0,
    wrongCount: 0,
    knowledgeScore: 0,
  },
];

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const getThemes = async (prompt: string) => {
  try {
    const response = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [{ role: "user", content: prompt }],
    });
    const text = response.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error("OpenAI returned an unexpected empty response.");
    }

    const themes: string[] = JSON.parse(text);

    return themes;
  } catch (error) {
    if (error instanceof Error) {
      console.log("OpenAI API error:", {
        message: error.message,
        name: error.name,
        stack: error.stack,
      });
      throw new Error(`OpenAI call failed: ${error.message}`);
    }
    throw new Error("Unknown error during OpenAI API call.");
  }
};

const getQuestions = async (
  mode: StudyMode,
  level: StudyLevel,
  theme: string
) => {
  try {
    const p =
      mode == "Flashcards" ? prompts.getFlashcards : prompts.getMultipleChoice;

    const prompt = p.replace("THEME", theme).replace("WORD-LEVEL", level);

    const response = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.choices?.[0]?.message?.content;

    if (!text) {
      throw new Error("OpenAI returned an unexpected empty response.");
    }

    const questions = JSON.parse(text);

    console.log(questions);
    console.log(typeof questions);
    return questions;
  } catch (error) {
    if (error instanceof Error) {
      console.log("OpenAI API error:", {
        message: error.message,
        name: error.name,
        stack: error.stack,
      });
      throw new Error(`OpenAI call failed: ${error.message}`);
    }
    throw new Error("Unknown error during OpenAI API call.");
  }
};

const seedDB = async () => {
  // const themes = await getThemes(prompts.getThemes.replace("COUNT", "10"));
  const themes = [
    "Food",
    "Travel",
    "Shopping",
    "Family",
    "Work",
    "Weather",
    "Hobbies",
    "Transportation",
    "Education",
    "Sports",
  ];
};

seedDB();
