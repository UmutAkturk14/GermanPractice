import type { NormalizedContent, StudyMode } from "../types/content";

const STORAGE_KEY = "gp_generated_content";
const ALLOWED_KEY_PATTERN = /^[a-zA-Z0-9-_]+$/;

type StoredPayload = {
  content: NormalizedContent;
  rawJson: string;
  theme: string;
  mode: StudyMode;
};

const sanitizeTheme = (theme: string) =>
  theme.replace(/<[^>]*>?/g, "").trim().slice(0, 200);

const xorEncode = (input: string) => {
  const key = 29;
  return btoa(
    input
      .split("")
      .map((char) => String.fromCharCode(char.charCodeAt(0) ^ key))
      .join(""),
  );
};

const xorDecode = (input: string) => {
  const key = 29;
  const decoded = atob(input);
  return decoded
    .split("")
    .map((char) => String.fromCharCode(char.charCodeAt(0) ^ key))
    .join("");
};

export const saveGeneratedSession = (payload: StoredPayload) => {
  if (typeof window === "undefined") return;
  try {
    const safeTheme = sanitizeTheme(payload.theme);
    if (!safeTheme) return;

    // only allow safe IDs in items
    const safeItems = payload.content.items
      .filter((item) => ALLOWED_KEY_PATTERN.test(item.id))
      .map((item) => ({
        ...item,
        prompt: item.prompt.slice(0, 400),
        answer: item.answer.slice(0, 400),
        options: item.options?.map((opt) => opt.slice(0, 200)),
      }));

    const safePayload: StoredPayload = {
      ...payload,
      theme: safeTheme,
      content: {
        ...payload.content,
        items: safeItems,
      },
      rawJson: payload.rawJson.slice(0, 4000),
    };

    const encoded = xorEncode(JSON.stringify(safePayload));
    window.sessionStorage.setItem(STORAGE_KEY, encoded);
  } catch (error) {
    console.warn("Failed to persist generated content:", error);
  }
};

export const loadGeneratedSession = (): StoredPayload | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const decoded = xorDecode(raw);
    return JSON.parse(decoded) as StoredPayload;
  } catch (error) {
    console.warn("Failed to read generated content:", error);
    return null;
  }
};

export const clearGeneratedSession = () => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn("Failed to clear generated content:", error);
  }
};
