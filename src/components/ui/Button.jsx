// ─── Button ──────────────────────────────────────────────────────────────────
// Reusable button with variants and consistent hover/active/focus/disabled states.

const VARIANTS = {
  primary:
    'bg-gradient-to-br from-primary-hover to-primary text-content-inverse font-semibold ' +
    'hover:from-teal-400 hover:to-primary-hover hover:shadow-glow-sm ' +
    'active:scale-[0.96] disabled:opacity-40 disabled:pointer-events-none disabled:active:scale-100',
  premium:
    'bg-gradient-to-br from-teal-400 via-primary to-teal-700 text-white font-semibold ' +
    'hover:from-teal-300 hover:via-primary-hover hover:shadow-glow-md ' +
    'active:scale-[0.96] disabled:opacity-40 disabled:pointer-events-none disabled:active:scale-100',
  secondary:
    'bg-surface-overlay text-content-primary border border-slate-600/60 ' +
    'hover:bg-slate-700/50 hover:border-slate-500/60 ' +
    'active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none disabled:active:scale-100',
  ghost:
    'bg-transparent text-content-secondary hover:text-content-primary hover:bg-slate-700/40 ' +
    'active:bg-slate-700/60 disabled:opacity-40 disabled:pointer-events-none',
  danger:
    'bg-red-600/90 text-white font-semibold hover:bg-red-500 ' +
    'active:scale-[0.96] disabled:opacity-40 disabled:pointer-events-none disabled:active:scale-100',
  link:
    'bg-transparent text-content-tertiary hover:text-content-primary underline underline-offset-2 ' +
    'disabled:opacity-40 disabled:pointer-events-none',
};

const SIZES = {
  sm: 'px-2.5 py-1.5 text-xs rounded-md',
  md: 'px-4 py-2 text-sm rounded-lg',
  lg: 'px-5 py-2.5 text-base rounded-lg',
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
