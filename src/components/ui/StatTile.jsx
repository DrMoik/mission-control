// ─── StatTile ────────────────────────────────────────────────────────────────
// Premium stat display: icon in tinted circle + large value + label.
// accent: "teal" | "amber" | "red" | "blue" | "purple"

const ACCENT = {
  teal:   { icon: 'text-primary',   bg: 'bg-primary/10',   border: 'border-primary/20',   value: 'text-primary' },
  amber:  { icon: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/20', value: 'text-amber-400' },
  red:    { icon: 'text-red-400',   bg: 'bg-red-400/10',   border: 'border-red-400/20',   value: 'text-red-400' },
  blue:   { icon: 'text-blue-400',  bg: 'bg-blue-400/10',  border: 'border-blue-400/20',  value: 'text-blue-400' },
  purple: { icon: 'text-purple-400',bg: 'bg-purple-400/10',border: 'border-purple-400/20',value: 'text-purple-400' },
};

export default function StatTile({ label, value, icon: Icon, accent = 'teal', className = '' }) {
  const a = ACCENT[accent] || ACCENT.teal;
  return (
    <div className={[
      'rounded-xl border border-slate-700/40 bg-surface-raised p-4 shadow-surface-sm',
      'hover:shadow-glow-sm hover:border-primary/25',
      'transition-all duration-200 ease-out-smooth',
      className,
    ].join(' ')}>
      <div className="flex items-start justify-between gap-2 mb-3">
        {Icon && (
          <div className={`p-2 rounded-lg border ${a.bg} ${a.border}`}>
            <Icon className={`w-4 h-4 ${a.icon}`} strokeWidth={2} />
          </div>
        )}
      </div>
      <div className={`text-2xl font-bold tracking-tight ${a.value}`}>{value}</div>
      <div className="text-xs font-medium text-content-tertiary uppercase tracking-wider mt-1">{label}</div>
    </div>
  );
}
