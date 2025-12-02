import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.flashcard.deleteMany();
  await prisma.multipleChoiceQuestion.deleteMany();
  // Seed default admin account
  await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      passwordHash: await bcrypt.hash("52544672", 10),
      role: "admin",
    },
  });

  await prisma.flashcard.createMany({
    data: [
      {
        theme: "Greetings",
        question: "How do you say 'Good morning' in German?",
        answer: "Guten Morgen",
      },
      {
        theme: "Travel",
        question: "Translate 'Where is the train station?'",
        answer: "Wo ist der Bahnhof?",
      },
    ],
  });

  await prisma.multipleChoiceQuestion.createMany({
    data: [
      {
        theme: "Food",
        question: "What is the German word for 'apple'?",
        answer: "der Apfel",
        choices: ["der Apfel", "die Orange", "die Banane", "die Traube"],
      },
      {
        theme: "Directions",
        question: "How do you say 'left' in German?",
        answer: "links",
        choices: ["links", "rechts", "geradeaus"],
      },
    ],
  });

  // TODO: Add user-scoped seeding once auth is in place.
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
