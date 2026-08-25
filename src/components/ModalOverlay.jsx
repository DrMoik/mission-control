// ─── ModalOverlay ────────────────────────────────────────────────────────────
// Reusable modal backdrop + panel wrapper with entrance animations.
// Use for consistent modal transitions across the app.
// Handles Escape-to-close and traps Tab focus inside the panel while open.
//
// Portals to document.body: a `position: fixed` element is only positioned
// relative to the viewport if none of its ancestors have a transform (or
// filter/perspective/contain). Several entrance animations in this app
// (e.g. .animate-slide-up) end with `transform: translateY(0)` and
// `animation-fill-mode: both/forwards`, which leaves that transform on the
// element permanently — still a real transform, so it still creates a new
// containing block. Any modal rendered inline inside such an ancestor would
// get sized/positioned relative to that ancestor's box instead of the
// viewport. Portaling to <body> sidesteps that regardless of where the
// modal is triggered from.

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

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

  return createPortal(
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
    </div>,
    document.body,
  );
}
