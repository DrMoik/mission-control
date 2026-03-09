// ─── PageContainer ────────────────────────────────────────────────────────────
// Wraps page content with max-width, responsive padding, and centered alignment.
// Use for main content areas to ensure consistent layout rhythm.

export default function PageContainer({ children, className = '', narrow = false }) {
  return (
    <div
      className={`page-container ${narrow ? '!max-w-content' : ''} ${className}`.trim()}
    >
      {children}
    </div>
  );
}
