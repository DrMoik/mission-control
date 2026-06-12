// ─── FeedbackHost ────────────────────────────────────────────────────────────
// Renders toasts and the confirm dialog for the imperative feedback API
// (services/feedback.js). Mounted once in main.jsx so it is available on every
// screen, including the login and team-picker views.

import { useState, useEffect, useRef, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import { registerFeedbackHost } from '../../services/feedback.js';
import Button from '../ui/Button.jsx';

const TOAST_TTL_MS = 4500;

const TOAST_STYLES = {
  success: { border: 'border-emerald-600/50', icon: CheckCircle2, iconClass: 'text-emerald-400' },
  error:   { border: 'border-red-600/50',     icon: XCircle,      iconClass: 'text-red-400' },
  warning: { border: 'border-amber-600/50',   icon: AlertTriangle, iconClass: 'text-amber-400' },
  info:    { border: 'border-sky-600/50',     icon: Info,          iconClass: 'text-sky-400' },
};

function Toast({ toast, onDismiss }) {
  const style = TOAST_STYLES[toast.type] || TOAST_STYLES.info;
  const Icon = style.icon;
  return (
    <div
      className={`feedback-toast pointer-events-auto flex items-start gap-2.5 rounded-xl border ${style.border} bg-surface-overlay px-3.5 py-2.5 shadow-lg max-w-sm`}
      role="status"
    >
      <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${style.iconClass}`} strokeWidth={2} aria-hidden="true" />
      <p className="text-sm text-content-primary leading-snug whitespace-pre-line min-w-0 break-words">{toast.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Cerrar notificación"
        className="shrink-0 -mr-1 -mt-0.5 p-1 rounded text-content-tertiary hover:text-content-primary transition-colors"
      >
        <X className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

function ConfirmDialog({ confirm, onResolve }) {
  const confirmBtnRef = useRef(null);

  useEffect(() => {
    confirmBtnRef.current?.focus();
    const onKeyDown = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onResolve(false); }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [onResolve]);

  return (
    <div
      className="modal-overlay fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/75"
      onClick={() => onResolve(false)}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={confirm.title || confirm.message}
        className="modal-panel w-full max-w-sm rounded-2xl border border-slate-700/60 bg-surface-raised p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {confirm.title && (
          <h2 className="text-base font-semibold text-content-primary mb-1.5">{confirm.title}</h2>
        )}
        <p className="text-sm text-content-secondary whitespace-pre-line">{confirm.message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" size="md" onClick={() => onResolve(false)}>
            {confirm.cancelLabel || 'Cancelar'}
          </Button>
          <Button
            ref={confirmBtnRef}
            variant={confirm.danger ? 'danger' : 'primary'}
            size="md"
            onClick={() => onResolve(true)}
          >
            {confirm.confirmLabel || 'Confirmar'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function FeedbackHost() {
  const [toasts, setToasts] = useState([]);
  const [confirm, setConfirm] = useState(null); // { ...opts, resolve }
  const idRef = useRef(0);

  const dismissToast = useCallback((id) => {
    setToasts((list) => list.filter((item) => item.id !== id));
  }, []);

  useEffect(() => {
    const timers = [];
    return registerFeedbackHost({
      toast: (message, type) => {
        const id = ++idRef.current;
        setToasts((list) => [...list.slice(-3), { id, message, type }]);
        timers.push(setTimeout(() => dismissToast(id), TOAST_TTL_MS));
      },
      confirm: (opts) =>
        new Promise((resolve) => {
          setConfirm({ ...opts, resolve });
        }),
    });
  }, [dismissToast]);

  const resolveConfirm = useCallback((value) => {
    setConfirm((current) => {
      current?.resolve?.(value);
      return null;
    });
  }, []);

  return (
    <>
      {/* Toasts */}
      <div
        className="fixed top-3 right-3 z-[90] flex flex-col gap-2 items-end pointer-events-none"
        style={{ paddingTop: 'var(--safe-area-top)' }}
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </div>

      {/* Confirm dialog */}
      {confirm && <ConfirmDialog confirm={confirm} onResolve={resolveConfirm} />}
    </>
  );
}
