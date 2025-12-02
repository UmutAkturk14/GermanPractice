import type { StudyMode } from "../types/content";

type ModeOption = {
  id: StudyMode;
  title: string;
  description: string;
  accent: string;
};

const options: ModeOption[] = [
  {
    id: "flashcards",
    title: "Flashcards",
    description: "Practice quick recall with front/back pairs and spaced review.",
    accent: "from-emerald-400/70 to-emerald-500/80",
  },
  {
    id: "multiple-choice",
    title: "Multiple Choice",
    description: "Pick the right answer from curated distractors to check accuracy.",
    accent: "from-sky-400/70 to-blue-500/80",
  },
];

type ModeSelectorProps = {
  selectedMode: StudyMode | null;
  onSelect: (mode: StudyMode) => void;
  disabled?: boolean;
};

export const ModeSelector = ({ selectedMode, onSelect, disabled = false }: ModeSelectorProps) => {
  return (
    <div className="grid w-full gap-4 sm:grid-cols-2">
      {options.map((option) => {
        const isActive = selectedMode === option.id;

        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={isActive}
            onClick={() => !disabled && onSelect(option.id)}
            disabled={disabled}
            className={[
              "group relative overflow-hidden rounded-2xl border border-slate-200 bg-white/80 px-6 py-5 text-left shadow-sm transition",
              "hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900",
              isActive ? "ring-2 ring-offset-2 ring-slate-900" : "",
              disabled ? "opacity-60 pointer-events-none" : "",
            ].join(" ")}
          >
            <div
              className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${option.accent}`}
            />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  Mode
                </p>
                <h3 className="text-xl font-semibold text-slate-900">
                  {option.title}
                </h3>
              </div>
              <span
                className={`inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${option.accent} text-sm font-semibold text-white shadow-inner shadow-white/20`}
              >
                {option.id === "flashcards" ? "A↔B" : "A/B/C"}
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              {option.description}
            </p>
            <div
              className={`pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition group-hover:opacity-10 bg-gradient-to-br ${option.accent}`}
            />
          </button>
        );
      })}
    </div>
  );
};
