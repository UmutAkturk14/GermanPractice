import { useEffect, useRef, useState } from "react";
import type { NormalizedItem } from "../../types/content";

type FlashcardExerciseProps = {
  items: NormalizedItem[];
  theme: string;
  onResult?: (id: string, correct: boolean, kind: "flashcards") => void;
  dueIds?: Set<string>;
  onQueueChange?: (remaining: number) => void;
};

export const FlashcardExercise = ({
  items,
  theme,
  onResult,
  dueIds,
  onQueueChange,
}: FlashcardExerciseProps) => {
  const total = items.length;
  const [queue, setQueue] = useState<number[]>(() =>
    items.map((_, idx) => idx)
  );
  const [currentIdx, setCurrentIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [result, setResult] = useState<"correct" | "incorrect" | null>(null);
  const [tally, setTally] = useState({ correct: 0, incorrect: 0 });
  const lastSeenIdRef = useRef<string | null>(null);
  const [remaining, setRemaining] = useState(0);

  // Reset when items change
  useEffect(() => {
    const newQueue = items.map((_, idx) => idx);
    let nextIdx = 0;
    if (lastSeenIdRef.current) {
      const found = items.findIndex((i) => i.id === lastSeenIdRef.current);
      nextIdx = found >= 0 ? found : 0;
    }
    setQueue(newQueue);
    setCurrentIdx(nextIdx);
    setRevealed(false);
    setResult(null);
  }, [items]);

  useEffect(() => {
    setRemaining(queue.length);
    onQueueChange?.(queue.length);
  }, [queue, onQueueChange]);

  const activeCard = queue.length > 0 ? items[queue[currentIdx] ?? 0] : null;

  useEffect(() => {
    if (activeCard?.id) {
      lastSeenIdRef.current = activeCard.id;
    }
  }, [activeCard?.id]);

  const answeredCount = tally.correct + tally.incorrect;

  const inProgress = answeredCount;
  const progressText = total === 0 ? "0 / 0" : `${Math.min(inProgress, total)} / ${total}`;
  const progressPercent = total === 0 ? 0 : Math.min((inProgress / total) * 100, 100);

  const handleNext = () => {
    if (queue.length === 0) return;
    const nextIndex = (currentIdx + 1) % queue.length;
    setCurrentIdx(nextIndex);
    setRevealed(false);
    setResult(null);
  };

  const mark = (status: "correct" | "incorrect") => {
    if (!activeCard || result === status) return;

    setResult(status);

    setQueue((prev) => {
      if (prev.length === 0) return prev;
      const currentQueueIndex = prev[currentIdx];

      if (status === "incorrect") {
        // Move current to end (single instance) and advance
        const nextQueue = [...prev];
        nextQueue.splice(currentIdx, 1);
        nextQueue.push(currentQueueIndex);
        const nextIdx = Math.min(currentIdx, nextQueue.length - 1);
        setCurrentIdx(nextIdx < 0 ? 0 : nextIdx);
        return nextQueue;
      }

      // Correct: remove current
      const nextQueue = prev.filter((_, idx) => idx !== currentIdx);
      const nextIdx = Math.min(currentIdx, nextQueue.length - 1);
      setCurrentIdx(nextIdx < 0 ? 0 : nextIdx);
      return nextQueue;
    });

    setRevealed(false);
  };

  if (!activeCard || queue.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 text-center text-sm text-slate-600">
        {items.length === 0
          ? "No flashcards available yet. Add some to the database."
          : "Session complete. Great job!"}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Flashcards • {theme}
          </p>
          <h3 className="text-xl font-semibold text-slate-900">
            Reveal and mark each card
          </h3>
        </div>
        <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-white">
          {progressText}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-blue-500 transition-all"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
        <div className="rounded-xl border border-slate-100 bg-slate-50 px-6 py-8 text-center shadow-inner">
          <div className="flex items-center justify-center gap-2 text-sm uppercase tracking-[0.14em] text-slate-500">
            <span>Prompt</span>
            {dueIds?.has(activeCard.id) ? (
              <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800">
                Due
              </span>
            ) : null}
          </div>
          <p className="mt-3 text-2xl font-semibold text-slate-900">
            {activeCard.prompt}
          </p>

          {revealed ? (
            <div className="mt-6 space-y-2">
              <p className="text-xs uppercase tracking-[0.14em] text-emerald-600">
                Answer
              </p>
              <p className="text-lg text-slate-800">{activeCard.answer}</p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className="mt-6 inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              Reveal answer
            </button>
          )}
        </div>

        {revealed && (
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  mark("correct");
                  onResult?.(activeCard.id, true, "flashcards");
                  setTally((prev) => ({
                    correct: prev.correct + 1,
                    incorrect: prev.incorrect,
                  }));
                }}
                disabled={result === "correct"}
                className="inline-flex items-center justify-center rounded-xl border border-emerald-500/50 bg-emerald-500/90 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-70"
              >
                Mark correct
              </button>
              <button
                type="button"
                onClick={() => {
                  mark("incorrect");
                  onResult?.(activeCard.id, false, "flashcards");
                  setTally((prev) => ({
                    correct: prev.correct,
                    incorrect: prev.incorrect + 1,
                  }));
                }}
                disabled={result === "incorrect"}
                className="inline-flex items-center justify-center rounded-xl border border-amber-500/50 bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-800 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 disabled:opacity-70"
              >
                Not correct
              </button>
            </div>

            {queue.length > 1 ? (
              <button
                type="button"
                onClick={handleNext}
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
              >
                Next card
              </button>
            ) : null}
          </div>
        )}

        {result && (
          <div
            className={[
              "mt-4 rounded-xl px-4 py-3 text-sm font-semibold",
              result === "correct"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-100"
                : "bg-amber-50 text-amber-800 border border-amber-100",
            ].join(" ")}
          >
            {result === "correct"
              ? "Marked correct!"
              : "Marked not correct — we will reshow this card later in the round."}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 text-xs font-semibold text-slate-600">
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">
          Correct: {tally.correct}
        </span>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800">
          Incorrect: {tally.incorrect}
        </span>
        <span className="rounded-full bg-slate-900 px-3 py-1 text-white">
          Queue: {remaining} cards
        </span>
      </div>
    </div>
  );
};
