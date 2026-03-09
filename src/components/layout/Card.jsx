// ─── Card ────────────────────────────────────────────────────────────────────
// Layout primitive for card-style containers. Provides consistent padding,
// surface, border radius, and optional hover lift.

export default function Card({ children, className = '', padding = true, hover = false }) {
  return (
    <div
      className={[
        'rounded-xl border border-slate-700/40 bg-surface-raised shadow-surface-sm',
        'transition-all duration-150 ease-out-smooth',
        padding && 'p-4 sm:p-5',
        hover && 'hover:border-slate-600/50 hover:shadow-surface-md hover:-translate-y-0.5',
        className,
      ].filter(Boolean).join(' ')}
    >
      {children}
    </div>
  );
}
