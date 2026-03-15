import { addDoc, collection, deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../services/firebase/client.js';

const REACTION_TYPES = new Set(['like', 'love', 'fire']);

export async function createFeedPost({ teamId, authorId, authorName, authorPhoto = null, content, mediaUrls = [] }) {
  const normalizedMediaUrls = Array.isArray(mediaUrls)
    ? mediaUrls.map((url) => String(url || '').trim()).filter(Boolean)
    : [];

  return addDoc(collection(db, 'posts'), {
    teamId,
    content,
    ...(normalizedMediaUrls.length > 0 ? {
      imageUrls: normalizedMediaUrls,
      imageUrl: normalizedMediaUrls[0],
    } : {}),
    authorId,
    authorName: authorName || 'Member',
    authorPhoto: authorPhoto || null,
    createdAt: serverTimestamp(),
  });
}

export async function deleteFeedPost(postId) {
  if (!postId) return;
  await deleteDoc(doc(db, 'posts', postId));
}

export async function createFeedComment({ teamId, postId, authorId, authorName, authorPhoto = null, content }) {
  return addDoc(collection(db, 'comments'), {
    teamId,
    postId,
    content,
    authorId,
    authorName: authorName || 'Member',
    authorPhoto: authorPhoto || null,
    createdAt: serverTimestamp(),
  });
}

export async function deleteFeedComment(commentId) {
  if (!commentId) return;
  await deleteDoc(doc(db, 'comments', commentId));
}

export async function toggleFeedReaction({ teamId, postId, userId, type, existingReaction = null }) {
  const normalizedType = String(type || '').trim();
  if (!teamId || !postId || !userId || !REACTION_TYPES.has(normalizedType)) return;

  const reactionRef = doc(db, 'postReactions', `${postId}_${userId}`);

  if (!existingReaction) {
    await setDoc(reactionRef, {
      teamId,
      postId,
      userId,
      type: normalizedType,
      createdAt: serverTimestamp(),
    });
    return;
  }

  if (existingReaction.type === normalizedType) {
    await deleteDoc(reactionRef);
    return;
  }

  await setDoc(reactionRef, {
    type: normalizedType,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}
