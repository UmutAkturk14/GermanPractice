const STORAGE_KEY = "gp_review_meta";
const ALLOWED_KEY_PATTERN = /^[a-zA-Z0-9-_]+$/;
const MAX_ID_LEN = 120;

type ReviewMeta = {
  lastReviewed: string | null;
  nextReview: string | null;
  successStreak: number;
};

const defaultMeta: ReviewMeta = {
  lastReviewed: null,
  nextReview: null,
  successStreak: 0,
};

const intervalsMs = [
  10 * 60 * 1000,
  60 * 60 * 1000,
  12 * 60 * 60 * 1000,
  24 * 60 * 60 * 1000,
  3 * 24 * 60 * 60 * 1000,
  7 * 24 * 60 * 60 * 1000,
];

const xorEncode = (input: string) => {
  const key = 17;
  return btoa(
    input
      .split("")
      .map((char) => String.fromCharCode(char.charCodeAt(0) ^ key))
      .join(""),
  );
};

const xorDecode = (input: string) => {
  const key = 17;
  const decoded = atob(input);
  return decoded
    .split("")
    .map((char) => String.fromCharCode(char.charCodeAt(0) ^ key))
    .join("");
};

const sanitizeId = (id: string) => {
  const trimmed = id.trim().slice(0, MAX_ID_LEN);
  return ALLOWED_KEY_PATTERN.test(trimmed) ? trimmed : "";
};

export const loadReviewMeta = (): Record<string, ReviewMeta> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const decoded = xorDecode(raw);
    return JSON.parse(decoded) as Record<string, ReviewMeta>;
  } catch (error) {
    console.warn("Failed to load review metadata:", error);
    return {};
  }
};

const saveReviewMeta = (meta: Record<string, ReviewMeta>) => {
  if (typeof window === "undefined") return;
  try {
    const encoded = xorEncode(JSON.stringify(meta));
    window.localStorage.setItem(STORAGE_KEY, encoded);
  } catch (error) {
    console.warn("Failed to save review metadata:", error);
  }
};

export const updateReviewMeta = (
  id: string,
  correct: boolean,
  existing: Record<string, ReviewMeta>,
) => {
  const safeId = sanitizeId(id);
  if (!safeId) return existing;

  const now = Date.now();
  const current = existing[safeId] ?? defaultMeta;
  const successStreak = correct ? current.successStreak + 1 : 0;
  const interval = correct
    ? intervalsMs[Math.min(successStreak, intervalsMs.length - 1)]
    : intervalsMs[0];
  const nextReview = new Date(now + interval).toISOString();

  const updated: ReviewMeta = {
    lastReviewed: new Date(now).toISOString(),
    nextReview,
    successStreak,
  };

  const merged = { ...existing, [safeId]: updated };
  saveReviewMeta(merged);
  return merged;
};

export const getDueItems = <T extends { id: string }>(
  items: T[],
  meta: Record<string, ReviewMeta>,
) => {
  const now = Date.now();
  const due = [];
  const later = [];

  for (const item of items) {
    const safeId = sanitizeId(item.id);
    const m = meta[safeId];
    const next = m?.nextReview ? Date.parse(m.nextReview) : 0;
    if (!next || next <= now) {
      due.push(item);
    } else {
      later.push(item);
    }
  }

  return { due, later };
};

export const getIsDue = (id: string, meta: Record<string, ReviewMeta>) => {
  const safeId = sanitizeId(id);
  if (!safeId) return false;
  const m = meta[safeId];
  if (!m?.nextReview) return true;
  return Date.parse(m.nextReview) <= Date.now();
};
