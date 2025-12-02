# Language Learning Backend (Apollo + Prisma + PostgreSQL)

Node.js + TypeScript backend with Prisma ORM and Apollo GraphQL Server for flashcards and multiple-choice exercises.

## Setup

1) Copy `.env.example` to `.env` and set `DATABASE_URL`.
2) Generate Prisma client and push schema:
```bash
npm install
npx prisma generate --schema ./src/prisma/schema.prisma
npx prisma db push --schema ./src/prisma/schema.prisma
```
3) Seed sample data:
```bash
npm run prisma:seed
```
4) Start the server:
```bash
npm run dev
# or after build
npm run build && npm start
```

## GraphQL

- Endpoint: `http://localhost:4000/`
- Types, queries, and mutations are defined in `src/graphql/typeDefs.ts`.
- Sample operations live in `src/graphql/examples.graphql`.
- Quick test with curl (replace payload as needed):
```bash
curl -X POST http://localhost:4000/ \
  -H "Content-Type: application/json" \
  -d '{ "query": "query { getFlashcards { id question answer } }" }'
```

## Scripts

- `npm run dev` – start Apollo server with ts-node.
- `npm run build` – compile TypeScript.
- `npm start` – run compiled server.
- `npm run prisma:generate` – generate Prisma client (schema at `src/prisma/schema.prisma`).
- `npm run prisma:push` – sync schema to database.
- `npm run prisma:seed` – seed sample flashcards and MC questions.

## OpenAI generation (backend services)

- Set `OPENAI_API_KEY` in `.env` (placeholder in `.env.example`).
- Generator: `src/services/openai.ts` (`generateQuestions(mode, theme)`) calls OpenAI with JSON schema enforcement to return 10 items shaped for Prisma.
- Sync: `src/services/sync.ts` (`syncGeneratedQuestionsToDB`) sends generated items to GraphQL mutations.
- TODO: attach user context/auth and handle rate limiting before production use.

## TODOs

- Add authentication and user-scoped stats.
- Support spaced repetition scheduling for incorrect answers.
- Add pagination/filters for queries and richer validation on mutations.
