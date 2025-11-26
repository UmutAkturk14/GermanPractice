import gql from "graphql-tag";

export const typeDefs = gql`
  scalar Date

  type Flashcard {
    id: ID!
    theme: String
    topic: String
    level: String
    question: String!
    answer: String!
    createdAt: Date!
    updatedAt: Date!
    progress: UserProgress!
  }

  type MultipleChoiceQuestion {
    id: ID!
    theme: String
    topic: String
    level: String
    question: String!
    answer: String!
    choices: [String!]!
    createdAt: Date!
    updatedAt: Date!
    progress: UserProgress!
  }

  type UserProgress {
    correctCount: Int!
    wrongCount: Int!
    knowledgeScore: Float!
    successStreak: Int!
    lastReviewed: Date!
    nextReview: Date!
  }

  type Query {
    getFlashcards(theme: String): [Flashcard!]!
    getMultipleChoiceQuestions(theme: String): [MultipleChoiceQuestion!]!
  }

  input CreateFlashcardInput {
    theme: String
    question: String!
    answer: String!
  }

  input CreateMultipleChoiceInput {
    theme: String
    question: String!
    answer: String!
    choices: [String!]!
  }

  type Mutation {
    createFlashcard(input: CreateFlashcardInput!): Flashcard!
    createMultipleChoiceQuestion(
      input: CreateMultipleChoiceInput!
    ): MultipleChoiceQuestion!
    updateFlashcardStats(id: ID!, correct: Boolean): Flashcard!
    updateMultipleChoiceStats(id: ID!, correct: Boolean): MultipleChoiceQuestion!
    generateStudyContent(mode: String!, theme: String!): String!
  }
`;
