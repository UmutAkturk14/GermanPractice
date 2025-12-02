import { useCallback, useEffect, useRef, useState } from "react";
import { getToken, getUserFromToken } from "../helpers/authClient";
import {
  clearBufferedEvents,
  getBufferedEvents,
  loadFromLocalStorage,
  recordEvent,
} from "../lib/progressBuffer";

type ProgressEvent = {
  itemId: string;
  itemType: "flashcard" | "mcq";
  result: "correct" | "incorrect";
  timestamp: number;
};

type SyncState = "synced" | "syncing" | "error" | "retrying";

type ProgressRecord = {
  correctCount: number;
  wrongCount: number;
  knowledgeScore: number;
  successStreak: number;
  lastReviewed: string;
  nextReview: string;
};

type UseProgressSyncOptions = {
  scope: string;
  onSynced?: (updated: Record<string, ProgressRecord | undefined>) => void;
  /**
   * Apply buffered events optimistically to local state on page load.
   */
  applyBuffered?: (events: ProgressEvent[]) => void;
};

export const useProgressSync = ({ scope, onSynced, applyBuffered }: UseProgressSyncOptions) => {
  const user = getUserFromToken();
  const userId = user?.email ?? "anon";
  const [state, setState] = useState<SyncState>("synced");
  const actionCount = useRef(0);
  const pendingFlush = useRef(false);
  const applyBufferedRef = useRef(applyBuffered);

  useEffect(() => {
    applyBufferedRef.current = applyBuffered;
  }, [applyBuffered]);

  useEffect(() => {
    loadFromLocalStorage(userId, scope);
    const buffered = getBufferedEvents(userId, scope);
    if (buffered.length && applyBufferedRef.current) {
      applyBufferedRef.current(buffered);
    }
  }, [userId, scope]);

  const flush = useCallback(async () => {
    const events = getBufferedEvents(userId, scope);
    if (!events.length) {
      setState("synced");
      return;
    }
    setState("syncing");
    try {
      const res = await fetch("/api/progress/batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
        },
        body: JSON.stringify({ events }),
      });
      if (!res.ok) throw new Error(`Sync failed: ${res.status}`);
      const json = (await res.json()) as { progress?: Record<string, ProgressRecord> };
      clearBufferedEvents(userId, scope);
      setState("synced");
      if (json.progress && onSynced) onSynced(json.progress);
    } catch (err) {
      console.error("Progress sync failed", err);
      setState("retrying");
      pendingFlush.current = true;
    }
  }, [onSynced, scope, userId]);

  useEffect(() => {
    const interval = setInterval(flush, 15000);
    const onHide = () => {
      void flush();
    };
    const onRoute = () => void flush();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onRoute);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onRoute);
    };
  }, [userId, scope, flush]);

  const record = (event: Omit<ProgressEvent, "timestamp">) => {
    const timestamp = Date.now();
    recordEvent(userId, scope, { ...event, timestamp });
    actionCount.current += 1;
    if (actionCount.current >= 5) {
      actionCount.current = 0;
      void flush();
    }
  };

  useEffect(() => {
    const onFocus = () => {
      if (pendingFlush.current) {
        pendingFlush.current = false;
        void flush();
      }
    };
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
    };
  }, [flush]);

  return { state, record, flush };
};
