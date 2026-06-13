// ─── feedback ────────────────────────────────────────────────────────────────
// Imperative API for in-app toasts and confirm dialogs, replacing native
// window.alert / window.confirm (which can't be styled or translated).
//
// Usage:
//   import { showToast, confirmDialog } from '../services/feedback.js';
//   showToast('Guardado.', 'success');
//   if (await confirmDialog('¿Eliminar este elemento?')) { ... }
//
// The UI lives in <FeedbackHost /> (mounted once in main.jsx). If the host is
// not mounted for any reason, we fall back to the native dialogs so no action
// is ever silently lost.

let host = null;

/** Called by FeedbackHost on mount/unmount. */
export function registerFeedbackHost(api) {
  host = api;
  return () => { if (host === api) host = null; };
}

/**
 * Show a transient toast notification.
 * @param {string} message
 * @param {'info' | 'success' | 'error' | 'warning'} [type]
 */
export function showToast(message, type = 'info') {
  if (!message) return;
  if (host) host.toast(String(message), type);
  else window.alert(String(message));
}

/**
 * Ask the user to confirm an action. Resolves true/false.
 * @param {string | {
 *   title?: string,
 *   message: string,
 *   confirmLabel?: string,
 *   cancelLabel?: string,
 *   danger?: boolean,
 * }} options
 * @returns {Promise<boolean>}
 */
export function confirmDialog(options) {
  const opts = typeof options === 'string' ? { message: options } : (options || {});
  if (host) return host.confirm(opts);
  return Promise.resolve(window.confirm(opts.message || ''));
}
