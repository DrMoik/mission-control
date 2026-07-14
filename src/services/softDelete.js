// ─── Soft-delete ("Papelera" / recycle bin) ─────────────────────────────────
// Instead of permanently removing a document, we flag it with `deletedAt` so it
// disappears from the normal UI but can be restored for a grace period. Anything
// older than TRASH_RETENTION_DAYS is purged permanently by a client-side sweep
// (see the auto-purge effect in App.jsx). No backend cron is required.

import { db } from '../firebase.js';
import { doc, updateDoc, deleteDoc, serverTimestamp, deleteField } from 'firebase/firestore';

export const TRASH_RETENTION_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
const RETENTION_MS = TRASH_RETENTION_DAYS * DAY_MS;

/** True when a document has been soft-deleted (is sitting in the trash). */
export const isTrashed = (item) => !!(item && item.deletedAt);

/** Milliseconds since a document was trashed, or null if it isn't trashed. */
export const trashedAtMs = (item) => {
  const value = item?.deletedAt;
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
};

/** Milliseconds remaining before a trashed document is auto-purged. */
export const msUntilPurge = (item) => {
  const trashedAt = trashedAtMs(item);
  return trashedAt == null ? null : (trashedAt + RETENTION_MS) - Date.now();
};

/** Whole days remaining before auto-purge (0 = purges today), or null. */
export const daysUntilPurge = (item) => {
  const ms = msUntilPurge(item);
  return ms == null ? null : Math.max(0, Math.ceil(ms / DAY_MS));
};

/** Move a document to the trash (recoverable for TRASH_RETENTION_DAYS days). */
export async function softDeleteDoc(collectionName, id, actor = {}) {
  await updateDoc(doc(db, collectionName, id), {
    deletedAt: serverTimestamp(),
    deletedBy: actor.name || null,
    deletedByUserId: actor.uid || null,
  });
}

/** Restore a trashed document back to normal. */
export async function restoreDoc(collectionName, id) {
  await updateDoc(doc(db, collectionName, id), {
    deletedAt: deleteField(),
    deletedBy: deleteField(),
    deletedByUserId: deleteField(),
  });
}

/** Permanently delete a document (used by "delete forever" and the auto-purge). */
export async function purgeDoc(collectionName, id) {
  await deleteDoc(doc(db, collectionName, id));
}
