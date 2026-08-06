// ─── ModalOverlay ────────────────────────────────────────────────────────────
// Reusable modal backdrop + panel wrapper with entrance animations.
// Use for consistent modal transitions across the app.
// Handles Escape-to-close and traps Tab focus inside the panel while open.

import { useEffect, useRef } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function ModalOverlay({ children, onClickBackdrop, className = '' }) {
  const panelRef = useRef(null);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const previouslyFocused = document.activeElement;
    if (!panel.contains(document.activeElement)) panel.focus();

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClickBackdrop?.({ target: panel, currentTarget: panel });
        return;
      }
      if (e.key !== 'Tab') return;
      const items = panel.querySelectorAll(FOCUSABLE);
      if (items.length === 0) { e.preventDefault(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [onClickBackdrop]);

  return (
    <div
      className={`modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 ${className}`.trim()}
      onClick={onClickBackdrop}
      role="presentation"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="modal-panel max-w-full max-h-[92vh] overflow-y-auto outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
