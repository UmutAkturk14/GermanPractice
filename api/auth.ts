import type { VercelRequest } from "@vercel/node";
import jwt from "jsonwebtoken";

type JWTPayload = {
  userId: string;
  role: string;
  email: string;
};

export async function verifyJWT(req: VercelRequest): Promise<JWTPayload | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== "string") return null;
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  try {
    const decoded = jwt.verify(token, secret) as JWTPayload;
    return decoded;
  } catch {
    return null;
  }
}

export async function getUserFromRequest(req: VercelRequest) {
  return verifyJWT(req);
}

export async function requireUser(
  req: VercelRequest,
  res: VercelResponse,
): Promise<JWTPayload | null> {
  const user = await verifyJWT(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return user;
}
