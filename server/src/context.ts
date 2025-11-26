import { PrismaClient } from "@prisma/client";
import type { GraphQLContext } from "./types/context.js";

const prisma = new PrismaClient();

export const createContext = (): GraphQLContext => ({ prisma });
