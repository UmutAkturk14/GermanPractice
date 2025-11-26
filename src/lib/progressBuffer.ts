type ProgressEvent = {
  itemId: string;
  itemType: "flashcard" | "mcq";
  result: "correct" | "incorrect";
  timestamp: number;
};

const buffers: Record<string, ProgressEvent[]> = {};
const WINDOW_MS = 50;

const getKey = (userId: string, scope: string) =>
  `progressQueue:${userId || "anon"}:${scope || "default"}`;

export const loadFromLocalStorage = (userId: string, scope: string) => {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(getKey(userId, scope));
    if (!raw) return;
    const events = JSON.parse(raw) as ProgressEvent[];
    buffers[getKey(userId, scope)] = events;
  } catch {
    // ignore parse errors
  }
};

const persist = (userId: string, scope: string) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      getKey(userId, scope),
      JSON.stringify(buffers[getKey(userId, scope)] ?? []),
    );
  } catch {
    // ignore storage errors
  }
};

export const recordEvent = (userId: string, scope: string, event: ProgressEvent) => {
  const key = getKey(userId, scope);
  const list = buffers[key] ?? [];
  const last = list[list.length - 1];
  if (
    last &&
    last.itemId === event.itemId &&
    last.itemType === event.itemType &&
    event.timestamp - last.timestamp < WINDOW_MS
  ) {
    return;
  }
  buffers[key] = [...list, event];
  persist(userId, scope);
};

export const getBufferedEvents = (userId: string, scope: string) =>
  buffers[getKey(userId, scope)] ?? [];

export const clearBufferedEvents = (userId: string, scope: string) => {
  buffers[getKey(userId, scope)] = [];
  persist(userId, scope);
};
