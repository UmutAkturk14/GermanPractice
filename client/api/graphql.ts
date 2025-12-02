import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createYoga } from "graphql-yoga";
import schemaModule from "../server/dist/graphql/schema.js";
import { PrismaClient } from "@prisma/client";
import { enforceJsonContent, rateLimit, verifyAuth } from "./security.js";
import { getUserFromRequest, verifyJWT } from "./auth.js";

const { schema } = schemaModule as typeof import("../server/src/graphql/schema.js");
const prisma = new PrismaClient();

const yoga = createYoga<{ req: VercelRequest; res: VercelResponse }>({
  schema,
  context: async ({ request }) => {
    const token = request.headers.get("authorization");
    const jwtPayload = await verifyJWT({
      headers: {
        authorization: token ?? undefined,
      },
    } as unknown as VercelRequest);
    const apiKeyAuth = request.headers.get("x-api-key") === process.env.AUTH_SECRET;
    const isAuthenticated = Boolean(jwtPayload || apiKeyAuth);
    return {
      prisma,
      isAuthenticated,
      user:
        jwtPayload ??
        (await getUserFromRequest({
          headers: { authorization: token ?? undefined },
        } as unknown as VercelRequest)),
    };
  },
  graphqlEndpoint: "/api/graphql",
});

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  try {
    if (!(await verifyAuth(req, res))) return;
    if (!(await rateLimit(req, res))) return;
    if (req.method === "POST" && !enforceJsonContent(req, res)) return;

    const response = await yoga.handleNodeRequest(req, { req, res });
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.status(response.status).send(await response.text());
  } catch (error) {
    console.error("[api/graphql] error", error);
    res.status(500).json({ error: { message: "Internal server error", code: "SERVER_ERROR" } });
  }
}
