// ─── Button ──────────────────────────────────────────────────────────────────
// Reusable button with variants and consistent hover/active/focus/disabled states.

const VARIANTS = {
  primary:
    'relative overflow-hidden bg-gradient-to-br from-teal-500 to-teal-700 text-white font-semibold ' +
    'shadow-[0_1px_2px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.12)] ' +
    'hover:from-teal-400 hover:to-teal-600 hover:shadow-[0_0_16px_rgba(13,148,136,0.35),0_1px_2px_rgba(0,0,0,0.3)] ' +
    'active:scale-[0.96] active:shadow-none ' +
    'disabled:opacity-40 disabled:pointer-events-none disabled:active:scale-100',
  premium:
    'relative overflow-hidden bg-gradient-to-br from-teal-400 via-teal-600 to-teal-800 text-white font-semibold ' +
    'shadow-[0_2px_4px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.15)] ' +
    'hover:from-teal-300 hover:to-teal-700 hover:shadow-[0_0_24px_rgba(13,148,136,0.40)] ' +
    'active:scale-[0.96] disabled:opacity-40 disabled:pointer-events-none disabled:active:scale-100',
  secondary:
    'bg-surface-overlay text-content-primary border border-slate-600/50 ' +
    'shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ' +
    'hover:bg-slate-700/60 hover:border-slate-500/70 hover:text-content-primary ' +
    'active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none disabled:active:scale-100',
  ghost:
    'bg-transparent text-content-secondary ' +
    'hover:text-content-primary hover:bg-white/6 ' +
    'active:bg-white/10 disabled:opacity-40 disabled:pointer-events-none',
  danger:
    'bg-gradient-to-br from-red-500 to-red-700 text-white font-semibold ' +
    'shadow-[0_1px_2px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)] ' +
    'hover:from-red-400 hover:to-red-600 hover:shadow-[0_0_16px_rgba(239,68,68,0.30)] ' +
    'active:scale-[0.96] disabled:opacity-40 disabled:pointer-events-none disabled:active:scale-100',
  link:
    'bg-transparent text-content-tertiary hover:text-content-primary underline underline-offset-2 ' +
    'disabled:opacity-40 disabled:pointer-events-none',
};

const SIZES = {
  sm: 'px-2.5 py-1.5 text-xs rounded-md',
  md: 'px-4 py-2 text-sm rounded-lg',
  lg: 'px-5 py-2.5 text-sm rounded-lg font-semibold',
};
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  type = 'button',
  className = '',
  ...props
}) {
  const base = 'inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 ease-out-smooth focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base';
  const variantClass = VARIANTS[variant] || VARIANTS.primary;
  const sizeClass = SIZES[size] || SIZES.md;

  return (
    <button
      type={type}
      disabled={disabled}
      className={`${base} ${variantClass} ${sizeClass} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}
