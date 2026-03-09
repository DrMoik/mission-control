// ─── Textarea ────────────────────────────────────────────────────────────────
// Multi-line text input with consistent styling.

export default function Textarea({
  className = '',
  error = false,
  disabled = false,
  ...props
}) {
  const base =
    'w-full px-3 py-2 text-sm text-content-primary bg-surface-sunken border rounded-lg resize-none ' +
    'placeholder:text-content-tertiary ' +
    'transition-colors duration-150 ease-out-smooth ' +
    'focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none ' +
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-surface-overlay/50';
  const stateClass = error
    ? 'border-red-500/60 focus:border-red-500 focus:ring-red-500/20'
    : 'border-slate-600/60 hover:border-slate-500/60';

  return (
    <textarea
      className={`${base} ${stateClass} ${className}`.trim()}
      disabled={disabled}
      {...props}
    />
  );
}
