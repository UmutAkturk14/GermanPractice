# German Practice

Full-stack language learning app with two study modes (flashcards and multiple choice), JWT auth, OpenAI-powered content generation, and progress tracking backed by PostgreSQL + Prisma. Built with React + Vite on the front end and Vercel serverless functions + GraphQL Yoga on the back end.

## Features
- Flashcard and multiple-choice practice flows with filters, queue counts, due tracking, and per-item streaks.
- Admin-only content generation (`/api/graphql` mutation) using OpenAI with schema enforcement; generated items are normalized and persisted via Prisma.
- JWT authentication (email/password) with user roles, signup/signin endpoints, and session storage in `localStorage`.
- User progress stored per item with spaced-repetition-esque scheduling and a progress sync buffer to reduce writes.
- GraphQL API for querying/updating study items plus REST helpers for auth and exercise submissions; rate limiting and optional API key support.

## Stack
- UI: React 19, Vite, Tailwind CSS 4, React Router.
- API: Vercel serverless functions (`/api/*`) running GraphQL Yoga and helpers.
- Data: Prisma with PostgreSQL.
- AI: OpenAI (model configurable; defaults to `gpt-4o-mini` in `server/src/services/openai.ts`).

## Quickstart
Prereqs: Node.js 20+, npm, PostgreSQL running locally, and (optional) the Vercel CLI for local API emulation.

```bash
cd client
cp server/.env.example server/.env       # add your secrets
npm install                              # installs + runs prisma generate + server build
npx prisma db push --schema ./server/src/prisma/schema.prisma
```

Start everything (UI + serverless API) with Vercel dev so `/api/*` routes resolve locally:
```bash
vercel dev --listen 8080
# UI: http://localhost:8080
# API/GraphQL: http://localhost:8080/api/graphql
```

If you only need the UI for a quick look, run `npm run dev` (port 8080). Auth/generation calls will fail unless the API is also running.

## Environment variables
Set these in `server/.env` (and in your Vercel project/environment):
- `DATABASE_URL` – PostgreSQL connection string.
- `OPENAI_API_KEY` – required for content generation and optional seeding scripts.
- `JWT_SECRET` – used to sign auth tokens.
- `AUTH_SECRET` – optional API key for non-JWT calls to `/api/*`.
- Optional: `OPENAI_MODEL` (defaults to `gpt-4o-mini`), `OPENAI_MAX_REQUESTS_PER_DAY` (default 100), `GRAPHQL_ENDPOINT` override for the sync service.

## Scripts (root)
- `npm run dev` – Vite dev server (UI only).
- `vercel dev` – UI + serverless API locally (recommended).
- `npm run build` – type check + Vite build.
- `npm run typecheck` / `npm run lint` – static checks.
- `npm run build:server` – compile `server/` (GraphQL schema used by `/api/graphql`).
- `npm run seed:themes` – sample OpenAI seeding helper (requires DB + OpenAI key).
- Prisma: `npx prisma db push --schema ./server/src/prisma/schema.prisma` and `npm run prisma:seed` inside `server/` for local fixtures.

## API surface
- GraphQL: `POST /api/graphql` (see `server/src/graphql/typeDefs.ts` for schema). Auth via `Authorization: Bearer <JWT>` or `x-api-key: <AUTH_SECRET>`.
- Auth: `POST /api/auth/signup` and `POST /api/auth/signin` (email, password). Tokens stored in `localStorage`.
- Progress: `POST /api/exercises/submit` to upsert per-item stats.

## Usage notes
- Only users with role `admin` can trigger content generation from the landing page; others can practice existing items.
- The app stores the last generated session in local storage so you can preview it again without re-calling the backend.
- OpenAI responses are JSON-schema validated before persistence; failures surface in the UI toast and the mutation returns an error.
- Deployment target is Vercel (see `vercel.json` rewrite for `/graphql` → `/api/graphql`). Set env vars in the Vercel dashboard before deploying.

## Repository layout
- `src/` – React UI components, hooks, helpers.
- `api/` – Vercel serverless functions (GraphQL, auth, progress, vocab utilities).
- `server/` – GraphQL Yoga schema/resolvers, Prisma schema, OpenAI services (compiled on install for use by `/api/graphql`).
- `scripts/` – maintenance and seeding utilities.
