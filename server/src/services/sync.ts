import type {
  GeneratedFlashcard,
  GeneratedMultipleChoice,
  StudyMode,
} from "../types/generation";

type GraphQLResult<T> = {
  data?: T;
  errors?: { message: string }[];
};

const defaultGraphQLEndpoint = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}/api/graphql`
  : "http://127.0.0.1:3000/api/graphql";

const GRAPHQL_ENDPOINT =
  process.env.GRAPHQL_ENDPOINT ?? defaultGraphQLEndpoint;

const CREATE_FLASHCARD = `
  mutation CreateFlashcard($input: CreateFlashcardInput!) {
    createFlashcard(input: $input) {
      id
      question
    }
  }
`;

const CREATE_MULTIPLE_CHOICE = `
  mutation CreateMultipleChoice($input: CreateMultipleChoiceInput!) {
    createMultipleChoiceQuestion(input: $input) {
      id
      question
    }
  }
`;

async function callGraphQL<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`GraphQL request failed with status ${res.status}`);
  }

  const json = (await res.json()) as GraphQLResult<T>;
  if (json.errors && json.errors.length > 0) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }

  if (!json.data) {
    throw new Error("GraphQL response missing data");
  }

  return json.data;
}

export async function syncGeneratedQuestionsToDB(
  mode: StudyMode,
  items: GeneratedFlashcard[] | GeneratedMultipleChoice[],
) {
  for (const item of items) {
    if (mode === "flashcards") {
      const payload = item as GeneratedFlashcard;
      await callGraphQL(CREATE_FLASHCARD, {
        input: {
          theme: payload.theme,
          question: payload.question,
          answer: payload.answer,
        },
      });
    } else {
      const payload = item as GeneratedMultipleChoice;
      await callGraphQL(CREATE_MULTIPLE_CHOICE, {
        input: {
          theme: payload.theme,
          question: payload.question,
          answer: payload.answer,
          choices: payload.choices,
        },
      });
    }
  }

  // TODO: Add user/session context to associate generated items with a specific learner.
}
