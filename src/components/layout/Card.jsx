// ─── Card ────────────────────────────────────────────────────────────────────
// Layout primitive for card-style containers. Provides consistent padding,
// surface, border radius, and optional hover lift.
// variant: "default" | "glow" | "glass" | "premium"

const VARIANTS = {
  default:  'rounded-xl border border-slate-700/40 bg-surface-raised shadow-surface-sm',
  glow:     'rounded-xl border border-primary/25 bg-surface-raised shadow-glow-sm',
  glass:    'rounded-xl glass shadow-surface-sm',
  premium:  'rounded-xl border border-primary/30 bg-surface-raised shadow-glow-sm animate-glow-breathe',
};

export default function Card({
  children,
  className = '',
  padding = true,
  hover = false,
  variant = 'default',
}) {
  return (
    <div
      className={[
        VARIANTS[variant] || VARIANTS.default,
        'transition-all duration-200 ease-out-smooth',
        padding && 'p-4 sm:p-5',
        hover && variant === 'glow'    && 'hover:shadow-glow-md hover:-translate-y-0.5',
        hover && variant === 'default' && 'hover:border-slate-600/50 hover:shadow-surface-md hover:-translate-y-0.5',
        hover && variant === 'glass'   && 'hover:bg-white/[0.05] hover:-translate-y-0.5',
        className,
      ].filter(Boolean).join(' ')}
    >
      {children}
    </div>
  );
}
