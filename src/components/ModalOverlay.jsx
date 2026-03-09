// ─── ModalOverlay ────────────────────────────────────────────────────────────
// Reusable modal backdrop + panel wrapper with entrance animations.
// Use for consistent modal transitions across the app.

export default function ModalOverlay({ children, onClickBackdrop, className = '' }) {
  return (
    <div
      className={`modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 ${className}`.trim()}
      onClick={onClickBackdrop}
    >
      <div
        className="modal-panel max-w-full max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
