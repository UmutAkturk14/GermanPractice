import type { IncomingHttpHeaders } from "http";
import { z } from "zod";

const rateLimitWindowMs = 60_000;
const rateLimitMax = 100;

const callCounts = new Map<string, { count: number; reset: number }>();

const sanitizeString = (value: string, max = 200) => {
  const trimmed = value.trim().slice(0, max);
  return trimmed.replace(/<[^>]*>?/gm, "");
};

const authSchema = z.object({
  authorization: z.string().min(1).optional(),
  "x-api-key": z.string().min(1).optional(),
});

export const parseAuthHeader = (headers: IncomingHttpHeaders) => {
  const parsed = authSchema.safeParse(headers);
  if (!parsed.success) return null;
  const token =
    parsed.data.authorization?.replace(/Bearer\s+/i, "") ||
    parsed.data["x-api-key"];
  return token ?? null;
};

export const requireAuth = (headers: IncomingHttpHeaders) => {
  const key = parseAuthHeader(headers);
  const secret = process.env.AUTH_SECRET;
  if (!secret || !key) return false;
  return key === secret;
};

export const enforceJsonContent = (headers: IncomingHttpHeaders) => {
  const contentType = headers["content-type"] ?? "";
  return typeof contentType === "string" && contentType.includes("application/json");
};

export const rateLimit = (ip: string) => {
  const now = Date.now();
  const existing = callCounts.get(ip);
  if (!existing || existing.reset < now) {
    callCounts.set(ip, { count: 1, reset: now + rateLimitWindowMs });
    return { ok: true, remaining: rateLimitMax - 1 };
  }
  if (existing.count >= rateLimitMax) {
    return { ok: false, retryAfterMs: existing.reset - now };
  }
  existing.count += 1;
  callCounts.set(ip, existing);
  return { ok: true, remaining: rateLimitMax - existing.count };
};

export const sanitizePayload = <T extends Record<string, unknown>>(
  payload: T,
  maxLenMap: Record<string, number>,
) => {
  const copy = { ...payload };
  for (const [key, max] of Object.entries(maxLenMap)) {
    const val = copy[key];
    if (typeof val === "string") {
      copy[key] = sanitizeString(val, max) as T[Extract<keyof T, string>];
    }
  }
  return copy;
};

const budgetWindowMs = 24 * 60 * 60 * 1000;
const defaultBudget = Number(process.env.OPENAI_MAX_REQUESTS_PER_DAY ?? "100");
const openAiBudget = new Map<string, { count: number; reset: number }>();

export const checkOpenAIBudget = (key: string) => {
  const now = Date.now();
  const existing = openAiBudget.get(key);
  if (!existing || existing.reset < now) {
    openAiBudget.set(key, { count: 1, reset: now + budgetWindowMs });
    return { ok: true };
  }
  if (existing.count >= defaultBudget) {
    return { ok: false, remainingMs: existing.reset - now };
  }
  existing.count += 1;
  openAiBudget.set(key, existing);
  return { ok: true };
};
