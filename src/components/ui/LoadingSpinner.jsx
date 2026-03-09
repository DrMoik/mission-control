// ─── LoadingSpinner ─────────────────────────────────────────────────────────
// Animated loading indicator. Fast, subtle, consistent with design system.

export default function LoadingSpinner({ size = 'md', className = '' }) {
  const sizeClass = size === 'sm' ? 'w-4 h-4 border-2' : size === 'lg' ? 'w-8 h-8 border-2' : 'w-5 h-5 border-2';

  return (
    <div
      role="status"
      aria-label="Loading"
      className={`animate-spin-slow rounded-full border-content-tertiary border-t-primary ${sizeClass} ${className}`.trim()}
    />
  );
}
