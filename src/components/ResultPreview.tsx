import type { NormalizedContent } from "../types/content";

type ResultPreviewProps = {
  data: NormalizedContent | null;
  rawJson?: string;
};

export const ResultPreview = ({ data, rawJson }: ResultPreviewProps) => {
  if (!data) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-5 py-4 text-sm text-slate-500">
        Generated content will appear here.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
              Prepared Payload
            </p>
            <h4 className="text-lg font-semibold text-slate-900">
              {data.items.length} items for "{data.theme}"
            </h4>
          </div>
          <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-white">
            {data.mode}
          </span>
        </div>
        <div className="mt-4 space-y-3">
          {data.items.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-800"
            >
              <div className="flex items-center justify-between">
                <p className="font-semibold text-slate-900">{item.prompt}</p>
                <span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  {item.kind}
                </span>
              </div>
              <p className="mt-1 text-slate-700">Answer: {item.answer}</p>
              {item.options && (
                <p className="mt-1 text-slate-600">
                  Options: {item.options.join(", ")}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {rawJson ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-950 p-4 text-xs text-slate-50 shadow-inner">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-300">
            Raw mock JSON
          </p>
          <pre className="overflow-x-auto whitespace-pre-wrap">{rawJson}</pre>
        </div>
      ) : null}
    </div>
  );
};
