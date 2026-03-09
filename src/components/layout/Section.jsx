// ─── Section ──────────────────────────────────────────────────────────────────
// Section wrapper with optional heading and consistent spacing.
// Use section-spacing for vertical rhythm between sections.

export default function Section({ title, children, className = '' }) {
  return (
    <section className={className}>
      {title && (
        <h2 className="text-sm font-semibold text-content-secondary uppercase tracking-wider mb-4">
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}
