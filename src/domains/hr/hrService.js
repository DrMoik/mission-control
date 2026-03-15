import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase/client.js';

export async function submitHrSuggestion({ teamId, authUserId, authorName, content, isAnonymous }) {
  if (!teamId || !authUserId) throw new Error('Debes iniciar sesion.');

  await addDoc(collection(db, 'hrSuggestions'), {
    teamId,
    content: String(content || '').trim(),
    isAnonymous: !!isAnonymous,
    authorId: isAnonymous ? null : authUserId,
    authorName: isAnonymous ? null : (authorName || ''),
    status: 'pending',
    createdAt: serverTimestamp(),
  });
}

export async function submitHrComplaint({ teamId, authUserId, authorName, data }) {
  if (!teamId || !authUserId) throw new Error('Debes iniciar sesion.');

  const hasEvidence =
    String(data?.evidence?.text || '').trim() ||
    String(data?.evidence?.link || '').trim();

  if (!hasEvidence) throw new Error('Se requiere evidencia (texto o enlace).');

  await addDoc(collection(db, 'hrComplaints'), {
    teamId,
    type: data?.type || 'team',
    targetCategoryId: data?.targetCategoryId || null,
    targetMembershipId: data?.targetMembershipId || null,
    content: String(data?.content || '').trim(),
    evidence: {
      text: String(data?.evidence?.text || '').trim() || null,
      link: String(data?.evidence?.link || '').trim() || null,
    },
    authorId: authUserId,
    authorName: authorName || '',
    createdAt: serverTimestamp(),
  });
}
