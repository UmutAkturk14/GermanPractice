type LoadingIndicatorProps = {
  label?: string;
};

export const LoadingIndicator = ({ label = "Loading..." }: LoadingIndicatorProps) => {
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600 shadow-sm ring-1 ring-slate-200">
      <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
      {label}
    </div>
  );
};
