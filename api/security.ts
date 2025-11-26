import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyJWT } from "./auth.js";

const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 20;

type Bucket = { count: number; reset: number };
const buckets = new Map<string, Bucket>();

const getClientIp = (req: VercelRequest) => {
  const xfwd = req.headers["x-forwarded-for"];
  if (typeof xfwd === "string" && xfwd.length > 0) {
    return xfwd.split(",")[0]!.trim();
  }
  return req.socket?.remoteAddress ?? "unknown";
};

export const enforceJsonContent = (req: VercelRequest, res: VercelResponse) => {
  const contentType = req.headers["content-type"] ?? "";
  const isJson =
    typeof contentType === "string" && contentType.toLowerCase().includes("application/json");
  if (!isJson) {
    res.status(415).json({ error: "Content-Type must be application/json." });
    return false;
  }
  return true;
};

export async function verifyAuth(
  req: VercelRequest,
  res: VercelResponse,
): Promise<boolean> {
  const jwtPayload = await verifyJWT(req);
  if (jwtPayload) return true;

  const provided = req.headers["x-api-key"];
  const key =
    typeof provided === "string"
      ? provided
      : Array.isArray(provided)
        ? provided[0]
        : null;
  const secret = process.env.AUTH_SECRET;

  if (!secret || !key || key !== secret) {
    res
      .status(401)
      .json({ error: "Unauthorized. Provide a valid x-api-key header." });
    return false;
  }

  return true;
}

export async function rateLimit(
  req: VercelRequest,
  res: VercelResponse,
): Promise<boolean> {
  const ip = getClientIp(req);
  const now = Date.now();
  const existing = buckets.get(ip);

  if (!existing || existing.reset < now) {
    buckets.set(ip, { count: 1, reset: now + WINDOW_MS });
    return true;
  }

  if (existing.count >= MAX_REQUESTS) {
    res.setHeader("Retry-After", Math.ceil((existing.reset - now) / 1000));
    res.status(429).json({ error: "Too many requests. Please slow down." });
    return false;
  }

  existing.count += 1;
  buckets.set(ip, existing);
  return true;
}
