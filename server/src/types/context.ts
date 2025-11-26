import type { PrismaClient } from "@prisma/client";

export type GraphQLContext = {
  prisma: PrismaClient;
  isAuthenticated?: boolean;
  user?: {
    userId: string;
    role: string;
    email: string;
  } | null;
};
