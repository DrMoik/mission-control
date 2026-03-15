import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase.js';
import { t } from '../strings.js';
import { tsToDate } from '../utils.js';
import { Button, Input, Textarea } from '../components/ui/index.js';
import { Card } from '../components/layout/index.js';
import ModalOverlay from '../components/ModalOverlay.jsx';

const STATUS_META = {
  owner: { labelKey: 'channels_status_owner', tone: 'owner' },
  member: { labelKey: 'channels_status_member', tone: 'member' },
  pending: { labelKey: 'channels_status_pending', tone: 'pending' },
  declined: { labelKey: 'channels_status_declined', tone: 'muted' },
  left: { labelKey: 'channels_status_left', tone: 'muted' },
};

function TeamPill({ label, tone = 'default' }) {
  const tones = {
    default: 'border-slate-700 bg-slate-800 text-slate-200',
    member: 'border-sky-500/40 bg-sky-500/10 text-sky-200',
    pending: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
    owner: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
    muted: 'border-slate-700 bg-slate-900 text-slate-400',
  };
  return (
    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${tones[tone] || tones.default}`}>
      {label}
    </span>
  );
}

export default function ChannelsView({
  currentTeam = null,
  allTeams = [],
  channels = [],
  pendingInvitations = [],
  onCreateChannel,
  onInviteTeams,
  onAcceptInvitation,
  onDeclineInvitation,
  onUpdateChannel,
  onCreateMessage,
  onLeaveChannel,
  onDeleteChannel,
}) {
  const [selectedChannelId, setSelectedChannelId] = useState('');
  const [messages, setMessages] = useState([]);
  const [channelMemberships, setChannelMemberships] = useState([]);
  const [channelTeams, setChannelTeams] = useState([]);
  const [composer, setComposer] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [createDraft, setCreateDraft] = useState({ name: '', description: '', invitedTeamIds: [] });
  const [createError, setCreateError] = useState('');
  const [inviteDraft, setInviteDraft] = useState([]);
  const [editDraft, setEditDraft] = useState({ name: '', description: '' });
  const [busyAction, setBusyAction] = useState('');
  const [messageError, setMessageError] = useState('');
  const [messagesLoadError, setMessagesLoadError] = useState('');
  const [actionError, setActionError] = useState('');

  const sortedChannels = useMemo(
    () => [...channels].sort((a, b) => tsToDate(b.lastMessageAt || b.updatedAt || b.createdAt) - tsToDate(a.lastMessageAt || a.updatedAt || a.createdAt)),
    [channels],
  );

  useEffect(() => {
    if (!sortedChannels.length) {
      setSelectedChannelId('');
      return;
    }
    if (!sortedChannels.some((channel) => channel.id === selectedChannelId)) {
      setSelectedChannelId(sortedChannels[0].id);
    }
  }, [sortedChannels, selectedChannelId]);

  const selectedChannel = useMemo(
    () => sortedChannels.find((channel) => channel.id === selectedChannelId) || null,
    [sortedChannels, selectedChannelId],
  );

  useEffect(() => {
    if (!selectedChannel) {
      setMessages([]);
      setChannelMemberships([]);
      setChannelTeams([]);
      setInviteDraft([]);
      setEditDraft({ name: '', description: '' });
      setMessagesLoadError('');
      setActionError('');
      return undefined;
    }

    setEditDraft({
      name: selectedChannel.name || '',
      description: selectedChannel.description || '',
    });
    setInviteDraft([]);

    const qMessages = query(collection(db, 'crossTeamMessages'), where('channelId', '==', selectedChannel.id));
    const qTeams = query(collection(db, 'crossTeamChannelTeams'), where('channelId', '==', selectedChannel.id));

    const unsubMessages = onSnapshot(
      qMessages,
      (snap) => {
        const nextMessages = snap.docs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
          .sort((a, b) => tsToDate(a.createdAt) - tsToDate(b.createdAt));
        setMessages(nextMessages);
        setMessagesLoadError('');
      },
      () => {
        setMessages([]);
        setMessagesLoadError(t('channels_messages_load_failed'));
      },
    );

    const unsubTeams = onSnapshot(qTeams, (snap) => {
      const nextTeams = snap.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .sort((a, b) => {
          const order = { owner: 0, member: 1, pending: 2, left: 3, declined: 4 };
          const statusCmp = (order[a.status] ?? 99) - (order[b.status] ?? 99);
          if (statusCmp !== 0) return statusCmp;
          return String(a.teamName || '').localeCompare(String(b.teamName || ''));
        });
      setChannelTeams(nextTeams);
    });

    return () => {
      unsubMessages();
      unsubTeams();
    };
  }, [selectedChannel]);

  useEffect(() => {
    if (!channelTeams.length) {
      setChannelMemberships([]);
      return undefined;
    }

    const activeTeamIds = [...new Set(channelTeams
      .map((entry) => entry.teamId)
      .filter(Boolean))];

    if (!activeTeamIds.length) {
      setChannelMemberships([]);
      return undefined;
    }

    const unsubs = [];
    const membershipMap = new Map();
    const sync = () => setChannelMemberships([...membershipMap.values()]);

    for (let i = 0; i < activeTeamIds.length; i += 10) {
      const chunk = activeTeamIds.slice(i, i + 10);
      const unsub = onSnapshot(
        query(collection(db, 'memberships'), where('teamId', 'in', chunk)),
        (snap) => {
          chunk.forEach((teamId) => {
            [...membershipMap.entries()].forEach(([id, membership]) => {
              if (membership.teamId === teamId) membershipMap.delete(id);
            });
          });
          snap.docs.forEach((docSnap) => {
            membershipMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
          });
          sync();
        },
      );
      unsubs.push(unsub);
    }

    return () => unsubs.forEach((unsub) => unsub());
  }, [channelTeams]);

  const teamNameById = useMemo(() => new Map(allTeams.map((team) => [team.id, team.name])), [allTeams]);
  const membershipNameById = useMemo(
    () => new Map(channelMemberships.map((membership) => [membership.id, membership.displayName])),
    [channelMemberships],
  );

  const availableCreateTeams = useMemo(
    () => allTeams.filter((team) => team.id !== currentTeam?.id),
    [allTeams, currentTeam],
  );

  const rosterGroups = useMemo(() => {
    if (!selectedChannel) return { active: [], pending: [], history: [], byTeamId: new Map() };

    const statusRank = { owner: 0, member: 1, pending: 2, left: 3, declined: 4 };
    const byTeamId = new Map();

    channelTeams.forEach((entry) => {
      const previous = byTeamId.get(entry.teamId);
      if (!previous || (statusRank[entry.status] ?? 99) < (statusRank[previous.status] ?? 99)) {
        byTeamId.set(entry.teamId, entry);
      }
    });

    (selectedChannel.memberTeamIds || []).forEach((teamId) => {
      byTeamId.set(teamId, {
        ...(byTeamId.get(teamId) || {}),
        id: byTeamId.get(teamId)?.id || `${selectedChannel.id}_${teamId}_fallback_member`,
        channelId: selectedChannel.id,
        teamId,
        teamName: byTeamId.get(teamId)?.teamName || teamNameById.get(teamId) || 'Equipo',
        status: teamId === selectedChannel.createdByTeamId ? 'owner' : 'member',
      });
    });

    (selectedChannel.pendingTeamIds || []).forEach((teamId) => {
      if (!byTeamId.has(teamId) || ['left', 'declined'].includes(byTeamId.get(teamId)?.status)) {
        byTeamId.set(teamId, {
          ...(byTeamId.get(teamId) || {}),
          id: byTeamId.get(teamId)?.id || `${selectedChannel.id}_${teamId}_fallback_pending`,
          channelId: selectedChannel.id,
          teamId,
          teamName: byTeamId.get(teamId)?.teamName || teamNameById.get(teamId) || 'Equipo',
          status: 'pending',
        });
      }
    });

    const entries = [...byTeamId.values()].sort((a, b) => {
      const statusCmp = (statusRank[a.status] ?? 99) - (statusRank[b.status] ?? 99);
      if (statusCmp !== 0) return statusCmp;
      return String(a.teamName || '').localeCompare(String(b.teamName || ''));
    });

    return {
      active: entries.filter((entry) => ['owner', 'member'].includes(entry.status)),
      pending: entries.filter((entry) => entry.status === 'pending'),
      history: entries.filter((entry) => ['left', 'declined'].includes(entry.status)),
      byTeamId,
    };
  }, [channelTeams, selectedChannel, teamNameById]);

  const currentTeamChannelStatus = useMemo(() => {
    if (!selectedChannel || !currentTeam) return null;
    return rosterGroups.byTeamId.get(currentTeam.id)?.status || null;
  }, [currentTeam, rosterGroups, selectedChannel]);

  const isOwnerTeam = currentTeamChannelStatus === 'owner';
  const canParticipateInChannel = isOwnerTeam || currentTeamChannelStatus === 'member';
  const canLeaveChannel = currentTeamChannelStatus === 'member';

  const availableInviteTeams = useMemo(() => {
    if (!selectedChannel) return [];
    const blockedIds = new Set([
      ...rosterGroups.active.map((entry) => entry.teamId),
      ...rosterGroups.pending.map((entry) => entry.teamId),
    ]);
    return allTeams.filter((team) => !blockedIds.has(team.id));
  }, [allTeams, rosterGroups, selectedChannel]);

  const toggleIds = (setter, teamId) => {
    setter((prev) => (
      prev.includes(teamId)
        ? prev.filter((entry) => entry !== teamId)
        : [...prev, teamId]
    ));
  };

  const withBusy = async (key, fn) => {
    setBusyAction(key);
    try {
      await fn();
    } finally {
      setBusyAction('');
    }
  };

  const closeCreateModal = () => {
    if (busyAction === 'create') return;
    setShowCreateModal(false);
    setCreateDraft({ name: '', description: '', invitedTeamIds: [] });
    setCreateError('');
  };

  const closeEditModal = () => {
    if (busyAction === 'update') return;
    setShowEditModal(false);
  };

  const closeInviteModal = () => {
    if (busyAction === 'invite') return;
    setShowInviteModal(false);
    setInviteDraft([]);
  };

  const submitCreateChannel = async () => {
    if (!createDraft.name.trim()) {
      setCreateError(t('channels_validation_name'));
      return;
    }
    setCreateError('');
    await withBusy('create', async () => {
      await onCreateChannel?.({
        name: createDraft.name,
        description: createDraft.description,
        invitedTeamIds: createDraft.invitedTeamIds,
      });
      setShowCreateModal(false);
      setCreateDraft({ name: '', description: '', invitedTeamIds: [] });
      setCreateError('');
    });
  };

  const submitInviteTeams = async () => {
    if (!selectedChannel || !inviteDraft.length) return;
    if (!window.confirm(t('channels_confirm_invite'))) return;
    await withBusy('invite', async () => {
      await onInviteTeams?.(selectedChannel.id, inviteDraft);
      closeInviteModal();
    });
  };

  const submitChannelEdit = async () => {
    if (!selectedChannel || !editDraft.name.trim()) return;
    await withBusy('update', async () => {
      await onUpdateChannel?.(selectedChannel.id, editDraft);
      closeEditModal();
    });
  };

  const submitMessage = async () => {
    if (!selectedChannel || !composer.trim()) return;
    setMessageError('');
    try {
      await withBusy('message', async () => {
        await onCreateMessage?.(selectedChannel.id, composer);
        setComposer('');
      });
    } catch (_) {
      setMessageError(t('channels_message_failed'));
    }
  };

  const acceptInvitation = async (inviteId) => {
    if (!window.confirm(t('channels_confirm_accept'))) return;
    await withBusy(`accept:${inviteId}`, async () => {
      await onAcceptInvitation?.(inviteId);
    });
  };

  const declineInvitation = async (inviteId) => {
    if (!window.confirm(t('channels_confirm_decline'))) return;
    await withBusy(`decline:${inviteId}`, async () => {
      await onDeclineInvitation?.(inviteId);
    });
  };

  const leaveSelectedChannel = async () => {
    if (!selectedChannel) return;
    if (!window.confirm(t('channels_confirm_leave'))) return;
    await withBusy('leave', async () => {
      await onLeaveChannel?.(selectedChannel.id);
    });
  };

  const deleteSelectedChannel = async () => {
    if (!selectedChannel) return;
    if (!window.confirm(t('channels_confirm_delete'))) return;
    setActionError('');
    try {
      await withBusy('delete', async () => {
        await onDeleteChannel?.(selectedChannel.id);
      });
    } catch (_) {
      setActionError(t('channels_delete_failed'));
    }
  };

  return (
    <>
      <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-content-primary">{t('channels_title')}</h2>
              <p className="mt-1 text-sm text-content-secondary">{t('channels_help')}</p>
            </div>
            <Button variant="primary" onClick={() => setShowCreateModal(true)}>
              {t('channels_create')}
            </Button>
          </Card>

          <Card className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-content-primary">{t('channels_pending_invites')}</h3>
              <p className="text-xs text-content-secondary">{t('channels_pending_invites_help')}</p>
            </div>
            {pendingInvitations.length === 0 && (
              <p className="text-sm text-content-secondary">{t('channels_no_pending')}</p>
            )}
            {pendingInvitations.map((invite) => (
              <div key={invite.id} className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                <p className="text-sm font-semibold text-slate-100">{invite.channelName}</p>
                {invite.channelDescription ? (
                  <p className="mt-1 text-xs text-slate-400">{invite.channelDescription}</p>
                ) : null}
                <p className="mt-2 text-xs text-slate-500">
                  {t('channels_invited_by')}: {invite.ownerTeamName || teamNameById.get(invite.ownerTeamId) || 'Equipo'}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button variant="primary" size="sm" disabled={busyAction === `accept:${invite.id}`} onClick={() => acceptInvitation(invite.id)}>
                    {t('channels_accept')}
                  </Button>
                  <Button variant="ghost" size="sm" disabled={busyAction === `decline:${invite.id}`} onClick={() => declineInvitation(invite.id)}>
                    {t('channels_decline')}
                  </Button>
                </div>
              </div>
            ))}
          </Card>

          <Card className="space-y-4">
            <h3 className="text-sm font-semibold text-content-primary">{t('channels_my_channels')}</h3>
            {sortedChannels.length === 0 && (
              <p className="text-sm text-content-secondary">{t('channels_no_channels')}</p>
            )}
            <div className="space-y-2">
              {sortedChannels.map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => setSelectedChannelId(channel.id)}
                  className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                    channel.id === selectedChannelId
                      ? 'border-emerald-500/40 bg-emerald-500/10'
                      : 'border-slate-700/70 bg-slate-900/40 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-100">{channel.name}</p>
                      {channel.description ? (
                        <p className="mt-1 line-clamp-2 text-xs text-slate-400">{channel.description}</p>
                      ) : null}
                    </div>
                    {channel.createdByTeamId === currentTeam?.id && (
                      <TeamPill label={t('channels_status_owner')} tone="owner" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </div>

        <Card className="min-h-[640px] space-y-5">
          {!selectedChannel && (
            <div className="flex h-full min-h-[580px] items-center justify-center text-sm text-content-secondary">
              {t('channels_select_channel')}
            </div>
          )}

          {selectedChannel && (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-xl font-semibold text-slate-50">{selectedChannel.name}</h3>
                  {selectedChannel.description ? (
                    <p className="mt-1 max-w-3xl text-sm text-slate-400">{selectedChannel.description}</p>
                  ) : null}
                </div>
                <div className="space-y-2 text-right">
                  <div className="text-xs text-slate-500">
                    {t('channels_owner')}: {teamNameById.get(selectedChannel.createdByTeamId) || selectedChannel.createdByTeamName || 'Equipo'}
                  </div>
                  <div className="flex justify-end gap-2">
                    {isOwnerTeam && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => setShowEditModal(true)}>
                          {t('channels_edit')}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setShowInviteModal(true)}>
                          {t('channels_add_invites')}
                        </Button>
                      </>
                    )}
                    {isOwnerTeam ? (
                      <Button variant="danger" size="sm" disabled={busyAction === 'delete'} onClick={deleteSelectedChannel}>
                        {t('channels_delete')}
                      </Button>
                    ) : canLeaveChannel ? (
                      <Button variant="ghost" size="sm" disabled={busyAction === 'leave'} onClick={leaveSelectedChannel}>
                        {t('channels_leave')}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{t('channels_members')}</p>
                  <div className="space-y-2">
                    {rosterGroups.active.map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between gap-2">
                        <span className="text-sm text-slate-200">{entry.teamName || teamNameById.get(entry.teamId) || 'Equipo'}</span>
                        <TeamPill label={t(STATUS_META[entry.status]?.labelKey || 'channels_status_member')} tone={STATUS_META[entry.status]?.tone || 'default'} />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{t('channels_pending_members')}</p>
                  <div className="space-y-2">
                    {rosterGroups.pending.length === 0 && (
                      <p className="text-sm text-slate-500">{t('channels_no_pending_members')}</p>
                    )}
                    {rosterGroups.pending.map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between gap-2">
                        <span className="text-sm text-slate-200">{entry.teamName || teamNameById.get(entry.teamId) || 'Equipo'}</span>
                        <TeamPill label={t('channels_status_pending')} tone="pending" />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{t('channels_history')}</p>
                  <div className="space-y-2">
                    {rosterGroups.history.length === 0 && (
                      <p className="text-sm text-slate-500">{t('channels_no_history')}</p>
                    )}
                    {rosterGroups.history.map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between gap-2">
                        <span className="text-sm text-slate-200">{entry.teamName || teamNameById.get(entry.teamId) || 'Equipo'}</span>
                        <TeamPill label={t(STATUS_META[entry.status]?.labelKey || 'channels_status_left')} tone="muted" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {rosterGroups.pending.length > 0 && (
                  <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                    {t('channels_pending_alert')}
                  </div>
                )}
                <div className="max-h-[420px] space-y-3 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                  {actionError && (
                    <p className="text-sm text-red-400">{actionError}</p>
                  )}
                  {messagesLoadError && (
                    <p className="text-sm text-red-400">{messagesLoadError}</p>
                  )}
                  {messages.length === 0 && (
                    <p className="text-sm text-content-secondary">{t('channels_empty_messages')}</p>
                  )}
                    {messages.map((message) => (
                      <div key={message.id} className="rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <div className="flex flex-wrap items-baseline gap-2">
                            <span className="text-sm font-semibold text-slate-100">{membershipNameById.get(message.membershipId) || message.authorName}</span>
                            <span className="text-xs text-emerald-300">{message.teamName || teamNameById.get(message.teamId) || 'Equipo'}</span>
                          </div>
                        <span className="text-[11px] text-slate-500">{tsToDate(message.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-200">{message.content}</p>
                    </div>
                  ))}
                </div>

                {canParticipateInChannel ? (
                  <div className="space-y-3">
                    <Textarea
                      rows={4}
                      value={composer}
                      onChange={(e) => setComposer(e.target.value)}
                      placeholder={t('channels_message_ph')}
                    />
                    {messageError && (
                      <p className="text-sm text-red-400">{messageError}</p>
                    )}
                    <div className="flex justify-end">
                      <Button variant="primary" disabled={busyAction === 'message' || !composer.trim()} onClick={submitMessage}>
                        {busyAction === 'message' ? t('saving') : t('channels_send')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/30 px-4 py-3 text-sm text-slate-400">
                    {currentTeamChannelStatus === 'pending'
                      ? t('channels_pending_notice')
                      : t('channels_readonly_notice')}
                  </div>
                )}
              </div>
            </>
          )}
        </Card>
      </div>

      {showCreateModal && (
        <ModalOverlay onClickBackdrop={closeCreateModal}>
          <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-50">{t('channels_new_channel')}</h3>
                <p className="mt-1 text-sm text-slate-400">{t('channels_help')}</p>
              </div>
              <button onClick={closeCreateModal} className="text-sm text-slate-400 hover:text-slate-200">
                {t('close')}
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {t('channels_name')}
                </label>
                <Input
                  value={createDraft.name}
                  onChange={(e) => {
                    setCreateDraft((prev) => ({ ...prev, name: e.target.value }));
                    if (createError) setCreateError('');
                  }}
                  placeholder={t('channels_name')}
                />
                {createError && <p className="text-xs text-red-400">{createError}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {t('channels_description')}
                </label>
                <Textarea
                  rows={3}
                  value={createDraft.description}
                  onChange={(e) => setCreateDraft((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder={t('channels_description')}
                />
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('channels_invite_teams')}</p>
                <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                  {availableCreateTeams.map((team) => (
                    <label key={team.id} className="flex items-center gap-2 rounded-lg border border-slate-700/70 px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={createDraft.invitedTeamIds.includes(team.id)}
                        onChange={() => toggleIds(
                          (updater) => setCreateDraft((prev) => ({
                            ...prev,
                            invitedTeamIds: typeof updater === 'function' ? updater(prev.invitedTeamIds) : updater,
                          })),
                          team.id,
                        )}
                      />
                      <span>{team.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" disabled={busyAction === 'create'} onClick={closeCreateModal}>
                  {t('cancel')}
                </Button>
                <Button variant="primary" disabled={busyAction === 'create' || !createDraft.name.trim()} onClick={submitCreateChannel}>
                  {busyAction === 'create' ? t('saving') : t('channels_create')}
                </Button>
              </div>
            </div>
          </div>
        </ModalOverlay>
      )}

      {showEditModal && selectedChannel && (
        <ModalOverlay onClickBackdrop={closeEditModal}>
          <div className="w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-50">{t('channels_edit')}</h3>
                <p className="mt-1 text-sm text-slate-400">{t('channels_edit_help')}</p>
              </div>
              <button onClick={closeEditModal} className="text-sm text-slate-400 hover:text-slate-200">
                {t('close')}
              </button>
            </div>
            <div className="space-y-4">
              <Input
                value={editDraft.name}
                onChange={(e) => setEditDraft((prev) => ({ ...prev, name: e.target.value }))}
                placeholder={t('channels_name')}
              />
              <Textarea
                rows={4}
                value={editDraft.description}
                onChange={(e) => setEditDraft((prev) => ({ ...prev, description: e.target.value }))}
                placeholder={t('channels_description')}
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" disabled={busyAction === 'update'} onClick={closeEditModal}>
                  {t('cancel')}
                </Button>
                <Button variant="primary" disabled={busyAction === 'update' || !editDraft.name.trim()} onClick={submitChannelEdit}>
                  {busyAction === 'update' ? t('saving') : t('save')}
                </Button>
              </div>
            </div>
          </div>
        </ModalOverlay>
      )}

      {showInviteModal && selectedChannel && (
        <ModalOverlay onClickBackdrop={closeInviteModal}>
          <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-50">{t('channels_add_invites')}</h3>
                <p className="mt-1 text-sm text-slate-400">{t('channels_invite_help')}</p>
              </div>
              <button onClick={closeInviteModal} className="text-sm text-slate-400 hover:text-slate-200">
                {t('close')}
              </button>
            </div>
            <div className="space-y-4">
              <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {availableInviteTeams.length === 0 && (
                  <p className="text-sm text-slate-500">{t('channels_no_available_teams')}</p>
                )}
                {availableInviteTeams.map((team) => (
                  <label key={team.id} className="flex items-center gap-2 rounded-lg border border-slate-700/70 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={inviteDraft.includes(team.id)}
                      onChange={() => toggleIds(setInviteDraft, team.id)}
                    />
                    <span>{team.name}</span>
                  </label>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" disabled={busyAction === 'invite'} onClick={closeInviteModal}>
                  {t('cancel')}
                </Button>
                <Button variant="primary" disabled={busyAction === 'invite' || !inviteDraft.length} onClick={submitInviteTeams}>
                  {busyAction === 'invite' ? t('saving') : t('channels_add_invites')}
                </Button>
              </div>
            </div>
          </div>
        </ModalOverlay>
      )}
    </>
  );
}
