import { useEffect, useMemo, useState } from "react";
import type { NormalizedItem } from "../../types/content";

type MultipleChoiceExerciseProps = {
  items: NormalizedItem[];
  theme: string;
  onResult?: (id: string, correct: boolean, kind: "multiple-choice") => void;
  dueIds?: Set<string>;
  onQueueChange?: (remaining: number) => void;
};

const shuffle = (arr: string[]) => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

export const MultipleChoiceExercise = ({
  items,
  theme,
  onResult,
  dueIds,
  onQueueChange,
}: MultipleChoiceExerciseProps) => {
  const [sessionItems, setSessionItems] = useState(items);
  const total = sessionItems.length;
  // Track identity of the current set of questions (ignoring order) to avoid resets on re-sorts
  const itemsKey = useMemo(() => {
    const ids = items.map((i) => i.id).sort();
    return ids.join("|");
  }, [items]);
  const [queue, setQueue] = useState<number[]>(() =>
    sessionItems.map((_, idx) => idx)
  );
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [tally, setTally] = useState({ correct: 0, incorrect: 0 });

  useEffect(() => {
    setSessionItems(items);
    setQueue(items.map((_, idx) => idx));
    setCurrentIdx(0);
    setSelected(null);
    setIsCorrect(null);
    setTally({ correct: 0, incorrect: 0 });
  }, [itemsKey, items]);

  useEffect(() => {
    onQueueChange?.(queue.length);
  }, [queue.length, onQueueChange]);

  const active = queue.length > 0 ? sessionItems[queue[currentIdx] ?? 0] : null;
  const options = useMemo(
    () => shuffle(active?.options ?? []),
    [active?.options],
  );

  const answeredCount = tally.correct + tally.incorrect;
  const progressText = useMemo(() => {
    if (total === 0) return "0 / 0";
    return `${Math.min(answeredCount, total)} / ${total}`;
  }, [answeredCount, total]);

  const progressPercent = useMemo(() => {
    if (total === 0) return 0;
    return Math.min((answeredCount / total) * 100, 100);
  }, [answeredCount, total]);

  if (!active || queue.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 text-center text-sm text-slate-600">
        {items.length === 0
          ? "No multiple choice questions available yet. Add some to the database."
          : "Session complete. Great job!"}
      </div>
    );
  }

  const submitAnswer = () => {
    if (!selected || isCorrect !== null) return;
    const correct = selected === active.answer;
    setIsCorrect(correct);
    setTally((prev) => ({
      correct: prev.correct + (correct ? 1 : 0),
      incorrect: prev.incorrect + (!correct ? 1 : 0),
    }));
    onResult?.(active.id, correct, "multiple-choice");
  };

  const nextQuestion = () => {
    if (queue.length === 0) return;
    setQueue((prev) => {
      if (prev.length === 0) return prev;
      const currentQueueIndex = prev[currentIdx];

      // Apply queue mutation based on the last submitted answer
      let nextQueue = prev;
      if (isCorrect !== null) {
        if (!isCorrect) {
          nextQueue = [...prev];
          nextQueue.splice(currentIdx, 1);
          nextQueue.push(currentQueueIndex);
        } else {
          nextQueue = prev.filter((_, idx) => idx !== currentIdx);
        }
      }

      const nextIdx =
        nextQueue.length === 0
          ? 0
          : Math.min(
              isCorrect !== null
                ? Math.min(currentIdx, nextQueue.length - 1)
                : (currentIdx + 1) % nextQueue.length,
              nextQueue.length - 1
            );
      setCurrentIdx(nextIdx < 0 ? 0 : nextIdx);
      return nextQueue;
    });

    setSelected(null);
    setIsCorrect(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Multiple Choice • {theme}
          </p>
          <h3 className="text-xl font-semibold text-slate-900">
            Select and submit an answer
          </h3>
        </div>
        <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-white">
          {progressText}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-400 to-indigo-500 transition-all"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-lg font-semibold text-slate-900">
            {active.prompt}
          </p>
          {dueIds?.has(active.id) ? (
            <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800">
              Due
            </span>
          ) : null}
        </div>

        <div className="mt-5 space-y-3">
          {options.map((option) => {
            const isActive = selected === option;
            const answered = isCorrect !== null;
            const isAnswer = answered && option === active.answer;
            const isWrongPick = answered && isActive && !isAnswer;

            return (
              <button
                key={option}
                type="button"
                disabled={answered}
                onClick={() => setSelected(option)}
                className={[
                  "flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed",
                  isActive && !answered
                    ? "border-slate-900 bg-slate-900/90 text-white shadow-lg"
                    : "border-slate-200 bg-white text-slate-900 hover:-translate-y-0.5 hover:shadow-lg",
                  answered && isAnswer
                    ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                    : "",
                  isWrongPick ? "border-rose-300 bg-rose-50 text-rose-800" : "",
                  answered ? "opacity-90" : "",
                ].join(" ")}
              >
                <span>{option}</span>
                {answered && isAnswer ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-800">
                    Correct
                  </span>
                ) : null}
                {answered && isWrongPick ? (
                  <span className="rounded-full bg-rose-100 px-2 py-1 text-[11px] font-semibold text-rose-800">
                    Chosen
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-slate-500">
            {selected
              ? `Selected: ${selected}`
              : "Choose an option and submit."}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={submitAnswer}
              disabled={!selected || isCorrect !== null}
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:translate-y-0 disabled:opacity-50 disabled:shadow-none"
            >
              Submit
            </button>
            <button
              type="button"
              onClick={nextQuestion}
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              Next
            </button>
          </div>
        </div>

        {isCorrect !== null && (
          <div
            className={[
              "mt-4 rounded-xl px-4 py-3 text-sm font-semibold",
              isCorrect
                ? "bg-emerald-50 text-emerald-800 border border-emerald-100"
                : "bg-amber-50 text-amber-800 border border-amber-100",
            ].join(" ")}
          >
            {isCorrect
              ? "Correct! Nice work."
              : `Not correct — the right answer is "${active.answer}".`}
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
      </div>
    </div>
  );
};
