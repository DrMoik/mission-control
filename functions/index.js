const admin = require('firebase-admin');
const logger = require('firebase-functions/logger');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');

admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();

const DEFAULT_NOTIFICATION_PREFERENCES = {
  assignmentsEnabled: true,
  sessionsEnabled: true,
};

const PUSH_CHANNEL_ID = 'mission-control-updates';

function stringValue(value, fallback = '') {
  if (value == null) return fallback;
  return String(value).trim() || fallback;
}

async function getMembershipsByIds(membershipIds) {
  const uniqueIds = [...new Set((membershipIds || []).filter(Boolean))];
  if (!uniqueIds.length) return new Map();

  const snapshots = await Promise.all(
    uniqueIds.map((membershipId) => db.collection('memberships').doc(membershipId).get()),
  );

  return new Map(
    snapshots
      .filter((snapshot) => snapshot.exists)
      .map((snapshot) => [snapshot.id, snapshot.data()]),
  );
}

async function getActiveTeamUserIds(teamId) {
  const snapshot = await db
    .collection('memberships')
    .where('teamId', '==', teamId)
    .where('status', '==', 'active')
    .get();

  return [...new Set(snapshot.docs.map((item) => item.data().userId).filter(Boolean))];
}

async function getDeliverableTokens({ teamId, userIds, preferenceKey }) {
  const deliverableTokens = [];

  for (const userId of [...new Set(userIds.filter(Boolean))]) {
    const preferenceSnapshot = await db
      .collection('users')
      .doc(userId)
      .collection('notificationPreferences')
      .doc(teamId)
      .get();

    const preferences = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...(preferenceSnapshot.exists ? preferenceSnapshot.data() : {}),
    };

    if (!preferences[preferenceKey]) continue;

    const devicesSnapshot = await db.collection('users').doc(userId).collection('devices').get();
    devicesSnapshot.forEach((device) => {
      const data = device.data();
      if (!data?.token || data.permissionState !== 'granted') return;
      deliverableTokens.push({
        userId,
        devicePath: device.ref.path,
        token: data.token,
      });
    });
  }

  return deliverableTokens;
}

async function cleanupInvalidTokens(entries) {
  const invalidEntries = entries.filter((entry) => {
    const code = entry?.error?.code || '';
    return code === 'messaging/invalid-registration-token' || code === 'messaging/registration-token-not-registered';
  });

  await Promise.all(
    invalidEntries.map((entry) => db.doc(entry.devicePath).delete().catch(() => {})),
  );
}

async function sendNotifications({ teamId, userIds, preferenceKey, title, body, data }) {
  const tokens = await getDeliverableTokens({ teamId, userIds, preferenceKey });
  if (!tokens.length) {
    logger.info('No device tokens available for notification', { teamId, preferenceKey });
    return;
  }

  const messages = tokens.map((entry) => ({
    token: entry.token,
    notification: { title, body },
    data,
    android: {
      priority: 'high',
      notification: {
        channelId: PUSH_CHANNEL_ID,
        clickAction: 'FCM_PLUGIN_ACTIVITY',
      },
    },
  }));

  const response = await messaging.sendEach(messages);
  const failedEntries = response.responses
    .map((item, index) => ({
      ...tokens[index],
      error: item.error || null,
      success: item.success,
    }))
    .filter((item) => !item.success && item.error);

  if (failedEntries.length) {
    await cleanupInvalidTokens(failedEntries);
    logger.warn('Some push notifications failed', {
      teamId,
      preferenceKey,
      failures: failedEntries.map((entry) => ({
        userId: entry.userId,
        code: entry.error.code,
      })),
    });
  }
}

exports.onTaskCreatedNotifyAssignees = onDocumentCreated('tasks/{taskId}', async (event) => {
  const task = event.data?.data();
  if (!task?.teamId) return;

  const membershipIds = task.assigneeMembershipIds?.length
    ? task.assigneeMembershipIds
    : (task.assigneeMembershipId ? [task.assigneeMembershipId] : []);

  const membershipMap = await getMembershipsByIds([...membershipIds, task.assignedByMembershipId]);
  const actorUserId = membershipMap.get(task.assignedByMembershipId)?.userId || null;
  const recipientUserIds = membershipIds
    .map((membershipId) => membershipMap.get(membershipId)?.userId)
    .filter((userId) => userId && userId !== actorUserId);

  if (!recipientUserIds.length) return;

  await sendNotifications({
    teamId: task.teamId,
    userIds: recipientUserIds,
    preferenceKey: 'assignmentsEnabled',
    title: 'Nueva tarea asignada',
    body: `${stringValue(task.title, 'Tarea sin titulo')} · ${stringValue(task.assignedByName, 'Tu equipo')}`,
    data: {
      route: '/tasks',
      teamId: String(task.teamId),
      taskId: String(event.params.taskId),
      type: 'task_assigned',
    },
  });
});

exports.onSessionCreatedNotifyTeam = onDocumentCreated('teamSessions/{sessionId}', async (event) => {
  const session = event.data?.data();
  if (!session?.teamId) return;

  const activeUserIds = await getActiveTeamUserIds(session.teamId);
  const recipientUserIds = activeUserIds.filter((userId) => userId && userId !== session.createdBy);
  if (!recipientUserIds.length) return;

  await sendNotifications({
    teamId: session.teamId,
    userIds: recipientUserIds,
    preferenceKey: 'sessionsEnabled',
    title: 'Nueva sesion programada',
    body: stringValue(session.title, 'Revisa la nueva sesion en Mission Control'),
    data: {
      route: '/sessions',
      teamId: String(session.teamId),
      sessionId: String(event.params.sessionId),
      type: 'session_created',
    },
  });
});
