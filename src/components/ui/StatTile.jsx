// --- StatTile ---
const ACCENT = {
  teal:   { icon: 'text-teal-400',   bg: 'bg-teal-400/10',   border: 'border-teal-400/20',   value: 'text-teal-300',   glow: 'rgba(20,184,166,0.25)' },
  amber:  { icon: 'text-amber-400',  bg: 'bg-amber-400/10',  border: 'border-amber-400/20',  value: 'text-amber-300',  glow: 'rgba(251,191,36,0.20)' },
  red:    { icon: 'text-red-400',    bg: 'bg-red-400/10',    border: 'border-red-400/20',    value: 'text-red-300',    glow: 'rgba(248,113,113,0.20)' },
  blue:   { icon: 'text-blue-400',   bg: 'bg-blue-400/10',   border: 'border-blue-400/20',   value: 'text-blue-300',   glow: 'rgba(96,165,250,0.20)' },
  purple: { icon: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-400/20', value: 'text-purple-300', glow: 'rgba(192,132,252,0.20)' },
};

export default function StatTile({ label, value, icon: Icon, accent = 'teal', className = '' }) {
  const a = ACCENT[accent] || ACCENT.teal;
  return (
    <div className={[
      'group relative rounded-xl border border-slate-700/40 bg-surface-raised p-4',
      'shadow-surface-sm overflow-hidden',
      'hover:border-slate-600/60 hover:-translate-y-0.5',
      'transition-all duration-200',
      className,
    ].join(' ')}>
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 100%, ' + a.glow + ' 0%, transparent 70%)' }}
      />
      <div className="relative">
        {Icon && (
          <div className={'inline-flex p-2 rounded-lg border mb-3 ' + a.bg + ' ' + a.border}>
            <Icon className={'w-4 h-4 ' + a.icon} strokeWidth={2} />
          </div>
        )}
        <div className={'text-2xl font-bold tracking-tight tabular-nums ' + a.value}>{value}</div>
        <div className="text-[11px] font-semibold text-content-tertiary uppercase tracking-widest mt-1">{label}</div>
      </div>
    </div>
  );
}
