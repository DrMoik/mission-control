import { addDoc, collection, doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase/client.js';

export async function createCrossTeamMessage({
  channelId,
  currentTeam,
  currentMembership,
  authUser,
  userProfile,
  canManageCrossTeamChannels,
  isPlatformAdmin,
  channel,
  content,
}) {
  const trimmedContent = String(content || '').trim();
  if (!channel || !trimmedContent || !currentTeam || !authUser || !canManageCrossTeamChannels) return false;

  const relationSnap = await getDoc(doc(db, 'crossTeamChannelTeams', `${channelId}_${currentTeam.id}`));
  const relation = relationSnap.exists() ? relationSnap.data() : null;
  const isLegacyMember = (channel.memberTeamIds || []).includes(currentTeam.id);
  if (!isPlatformAdmin && !['owner', 'member'].includes(relation?.status || '') && !isLegacyMember) return false;

  await addDoc(collection(db, 'crossTeamMessages'), {
    channelId,
    teamId: currentTeam.id,
    teamName: currentTeam.name || 'Equipo',
    membershipId: currentMembership?.id || null,
    authorName: currentMembership?.displayName || userProfile?.displayName || authUser.email || 'Member',
    content: trimmedContent,
    createdAt: serverTimestamp(),
  });

  try {
    await updateDoc(doc(db, 'crossTeamChannels', channelId), {
      lastMessageAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.warn('Channel timestamp update failed:', error);
  }

  return true;
}
