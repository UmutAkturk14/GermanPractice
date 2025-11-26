import { useCallback, useEffect, useRef, useState } from "react";
import { fetchExercisesByMode } from "../helpers/mockDb";
import type { NormalizedContent, StudyMode } from "../types/content";
import { LoadingIndicator } from "./LoadingIndicator";
import { ModeSelector } from "./ModeSelector";
import { FlashcardExercise } from "./exercise/FlashcardExercise";
import { MultipleChoiceExercise } from "./exercise/MultipleChoiceExercise";
import { useToast } from "./ToastProvider";
import { useProgressSync } from "../hooks/useProgressSync";

export const ExercisePage = () => {
  const [mode, setMode] = useState<StudyMode | null>(null);
  const [content, setContent] = useState<NormalizedContent | null>(null);
  const [items, setItems] = useState<NormalizedContent["items"]>([]);
  const [theme, setTheme] = useState<string>("");
  const [dueCount, setDueCount] = useState(0);
  const [dueIds, setDueIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [topicFilter, setTopicFilter] = useState<string>("");
  const [sortOption, setSortOption] = useState<"due" | "oldest" | "newest" | "random">("due");
  const { showToast } = useToast();
  const [queueCount, setQueueCount] = useState(0);
  const prevLengthRef = useRef(0);
  const [baseProgress, setBaseProgress] = useState<
    Record<string, NonNullable<NormalizedContent["items"][number]["progress"]>>
  >({});
  const [overlayProgress, setOverlayProgress] = useState<
    Record<string, NonNullable<NormalizedContent["items"][number]["progress"]>>
  >({});
  const scope = `${mode ?? "none"}:${levelFilter}:${topicFilter || "all"}`;
  const applyEventToProgress = (
    current: NonNullable<NormalizedContent["items"][number]["progress"]> | undefined,
    ev: { result: "correct" | "incorrect"; timestamp?: number },
  ) => {
    const ts = ev.timestamp ?? Date.now();
    const base =
      current ?? {
        correctCount: 0,
        wrongCount: 0,
        knowledgeScore: 0,
        successStreak: 0,
        lastReviewed: new Date(0).toISOString(),
        nextReview: new Date(0).toISOString(),
      };
    const correctCount = base.correctCount + (ev.result === "correct" ? 1 : 0);
    const wrongCount = base.wrongCount + (ev.result === "incorrect" ? 1 : 0);
    const successStreak = ev.result === "correct" ? base.successStreak + 1 : 0;
    const nextReview = new Date(
      ts +
        (ev.result === "correct"
          ? 60 * 60 * 1000 * Math.max(1, successStreak)
          : 5 * 60 * 1000),
    ).toISOString();
    return {
      correctCount,
      wrongCount,
      successStreak,
      knowledgeScore: correctCount / Math.max(1, correctCount + wrongCount),
      lastReviewed: new Date(ts).toISOString(),
      nextReview,
    };
  };

  const updateProgressWithEvents = useCallback((events: Array<{ itemId: string; itemType: "flashcard" | "mcq"; result: "correct" | "incorrect"; timestamp?: number }>) => {
    setOverlayProgress((prev) => {
      const next = { ...prev };
      for (const ev of events) {
        const effective = next[ev.itemId] ?? baseProgress[ev.itemId];
        next[ev.itemId] = applyEventToProgress(effective, {
          result: ev.result,
          timestamp: ev.timestamp,
        });
      }
      return next;
    });
  }, [baseProgress]);

  const { state: syncState, record, flush } = useProgressSync({
    scope,
    onSynced: (updated) => {
      setBaseProgress((prev) => {
        const next = { ...prev };
        Object.entries(updated).forEach(([itemId, val]) => {
          if (!val) return;
          const progress = val as Partial<
            NonNullable<NormalizedContent["items"][number]["progress"]>
          >;
          next[itemId] = {
            correctCount: Number(progress.correctCount ?? 0),
            wrongCount: Number(progress.wrongCount ?? 0),
            knowledgeScore: Number(progress.knowledgeScore ?? 0),
            successStreak: Number(progress.successStreak ?? 0),
            lastReviewed: String(progress.lastReviewed ?? new Date().toISOString()),
            nextReview: String(progress.nextReview ?? new Date().toISOString()),
          };
        });
        return next;
      });
      setOverlayProgress({});
    },
    applyBuffered: updateProgressWithEvents,
  });

  const flushRef = useRef(flush);
  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  useEffect(() => {
    const run = async () => {
      if (!mode) return;
      setLoading(true);
      setError(null);

      try {
        const response = await fetchExercisesByMode(mode, {
          level: levelFilter !== "all" ? levelFilter : undefined,
          topic: topicFilter.trim() || undefined,
          sort: sortOption,
        });
        const initialProgress = response.items.reduce<
          Record<string, NonNullable<NormalizedContent["items"][number]["progress"]>>
        >((acc, item) => {
          if (item.progress) acc[item.id] = item.progress;
          return acc;
        }, {});
        setBaseProgress(initialProgress);
        setOverlayProgress({});
        setItems(response.items);
        setTheme(response.theme);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load exercises.",
        );
        showToast(
          err instanceof Error
            ? err.message
            : "We couldn't load exercises right now.",
          "error",
        );
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [mode, levelFilter, topicFilter, sortOption, showToast]);

  useEffect(() => {
    if (!mode || !items.length) {
      setContent(mode ? { mode, theme, items: [] } : null);
      setDueCount(0);
      setDueIds(new Set());
      setQueueCount(0);
      return;
    }

    const now = Date.now();

    const effectiveProgress: Record<
      string,
      NonNullable<NormalizedContent["items"][number]["progress"]>
    > = {};
    items.forEach((item) => {
      const base = baseProgress[item.id];
      const overlay = overlayProgress[item.id];
      effectiveProgress[item.id] =
        overlay ??
        base ?? {
          correctCount: 0,
          wrongCount: 0,
          knowledgeScore: 0,
          successStreak: 0,
          lastReviewed: new Date(0).toISOString(),
          nextReview: new Date(0).toISOString(),
        };
    });

    const getNext = (itemId: string, fallback?: string | null) => {
      const p = effectiveProgress[itemId];
      if (p?.nextReview) return Date.parse(p.nextReview);
      if (fallback) return Date.parse(fallback);
      return 0;
    };

    const due = items.filter((item) => {
      const next = getNext(item.id, item.progress?.nextReview ?? null);
      return !next || next <= now;
    });
    const dueIdsSet = new Set(due.map((d) => d.id));

    let ordered = [...due, ...items.filter((i) => !dueIdsSet.has(i.id))];

    if (sortOption === "oldest") {
      ordered = [...ordered].sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
    } else if (sortOption === "newest") {
      ordered = [...ordered].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    } else if (sortOption === "random") {
      ordered = [...ordered].sort(() => Math.random() - 0.5);
    }

    setContent({ mode, theme, items: ordered });
    setDueCount(due.length);
    setDueIds(dueIdsSet);
    if (ordered.length !== prevLengthRef.current) {
      setQueueCount(ordered.length);
      prevLengthRef.current = ordered.length;
    }
  }, [items, baseProgress, overlayProgress, mode, theme, sortOption]);

  const handleResult = (id: string, correct: boolean, kind: StudyMode) => {
    updateProgressWithEvents([
      {
        itemId: id,
        itemType: kind === "flashcards" ? "flashcard" : "mcq",
        result: correct ? "correct" : "incorrect",
        timestamp: Date.now(),
      },
    ]);
    record({
      itemId: id,
      itemType: kind === "flashcards" ? "flashcard" : "mcq",
      result: correct ? "correct" : "incorrect",
    });
    if (kind === "multiple-choice") {
      setQueueCount((prev) => {
        const next = prev > 0 ? prev - 1 : 0;
        if (next === 0) void flush();
        return next;
      });
    }
  };

  const handleQueueChange = useCallback((remaining: number) => {
    setQueueCount(remaining);
    if (remaining === 0) {
      const toFlush = flushRef.current;
      if (toFlush) void toFlush();
    }
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-emerald-50">
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute left-16 top-8 h-52 w-52 rounded-full bg-sky-200 blur-3xl" />
        <div className="absolute bottom-0 right-10 h-64 w-64 rounded-full bg-emerald-200 blur-3xl" />
      </div>

      <div className="relative mx-auto flex max-w-5xl flex-col gap-8 px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <header className="flex flex-col gap-4 text-center">
          <div className="flex items-center justify-center">
            <a
              href="/"
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              ← Back to home
            </a>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
              Exercise Mode
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900 sm:text-4xl">
              Practice what you generated.
            </h1>
            <p className="mt-3 max-w-2xl text-lg text-slate-600">
              Choose Flashcards or Multiple Choice. We will fetch the relevant
              items from the database and let you mark correctness.
            </p>
          </div>
        </header>

        <section className="flex flex-col items-center gap-8">
          <ModeSelector selectedMode={mode} onSelect={setMode} disabled={loading} />

          <div className="w-full max-w-4xl space-y-4 rounded-2xl border border-slate-200 bg-white/85 p-5 shadow-sm backdrop-blur">
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  Level
                </label>
                <select
                  value={levelFilter}
                  onChange={(e) => setLevelFilter(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="all">All</option>
                  {["A1", "A2", "B1", "B2", "C1", "C2"].map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  Topic
                </label>
                <input
                  type="text"
                  value={topicFilter}
                  onChange={(e) => setTopicFilter(e.target.value)}
                  placeholder="technology, garden, house..."
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  Sort
                </label>
                <select
                  value={sortOption}
                  onChange={(e) =>
                    setSortOption(e.target.value as "due" | "oldest" | "newest" | "random")
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="due">Due first</option>
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="random">Random</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
              <div className="text-sm font-semibold text-slate-900">
                {mode ? `Loaded ${content?.items.length ?? 0} items` : "Pick a mode to load items"}
              </div>
              <div className="flex gap-2 text-xs font-semibold uppercase tracking-[0.12em]">
                <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800">
                  Due now: {dueCount}
                </span>
                <span className="rounded-full bg-slate-900 px-3 py-1 text-white">
                  Queue: {queueCount}
                </span>
                <span
                  className={
                    syncState === "syncing"
                      ? "rounded-full bg-blue-100 px-3 py-1 text-blue-800"
                      : syncState === "error"
                        ? "rounded-full bg-amber-100 px-3 py-1 text-amber-800"
                        : "rounded-full bg-emerald-100 px-3 py-1 text-emerald-800"
                  }
                >
                  {syncState === "syncing"
                    ? "Syncing"
                    : syncState === "error"
                      ? "Retrying"
                      : "Synced"}
                </span>
              </div>
            </div>

            {error ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {error}
              </div>
            ) : null}

            {!mode ? (
              <p className="text-sm text-slate-600">Select a mode to pull questions.</p>
            ) : loading ? (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <LoadingIndicator label="Loading" />
                <span>Fetching exercises...</span>
              </div>
            ) : content ? (
              mode === "flashcards" ? (
                <FlashcardExercise
                  items={content.items}
                  theme={content.theme}
                  onResult={handleResult}
                  dueIds={dueIds}
                  onQueueChange={handleQueueChange}
                />
              ) : (
                <MultipleChoiceExercise
                  items={content.items}
                  theme={content.theme}
                  onResult={handleResult}
                  dueIds={dueIds}
                  onQueueChange={handleQueueChange}
                />
              )
            ) : (
              <p className="text-sm text-slate-600">Data will appear after loading.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
};
