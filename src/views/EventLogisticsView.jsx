// ─── EventLogisticsView ─────────────────────────────────────────────────────
// Top-level admin view: event logistics (owners, guests, budget, expenses).
// Lives under the "Operación" admin group, not inside Herramientas — this is
// business/operations content, kept separate from engineering tools.

import React, { useState, useMemo, useCallback } from 'react';
import { t, lang } from '../strings.js';
import { HowToUse, ScopeFilter, TrashBin } from '../components/ui/index.js';
import { isGeneralLeadershipCategoryName, ensureString } from '../utils.js';
import EventLogisticsSection from './tools/EventLogisticsSection.jsx';

export default function EventLogisticsView({
  teamEventLogistics = [],
  categories = [],
  memberships = [],
  currentMembership,
  canEdit,
  canEditTools,
  resolveCanEdit,
  trashed = {},
  onRestoreItem,
  onPurgeItem,
  onCreateEventLogistics,
  onUpdateEventLogistics,
  onDeleteEventLogistics,
}) {
  const userCategoryId = currentMembership?.categoryId || null;

  const generalLeadershipCategoryId = useMemo(
    () => (categories || []).find((c) => isGeneralLeadershipCategoryName(c.name))?.id || null,
    [categories],
  );
  const creatableCategories = useMemo(
    () => (categories || []).filter(
      (c) => !isGeneralLeadershipCategoryName(c.name) || (resolveCanEdit ? resolveCanEdit({ categoryId: c.id }) : false),
    ),
    [categories, resolveCanEdit],
  );

  const [scopeFilter, setScopeFilter] = useState('all');

  const isVisible = useCallback((item) => {
    if (!item.categoryId) return true;
    if (canEdit) return true;
    if (canEditTools && item.categoryId === generalLeadershipCategoryId) return true;
    return item.categoryId === userCategoryId;
  }, [canEdit, canEditTools, userCategoryId, generalLeadershipCategoryId]);

  const visibleEvents = useMemo(() => teamEventLogistics.filter((e) => {
    if (!isVisible(e)) return false;
    if (scopeFilter === 'all') return true;
    if (scopeFilter === 'global') return !e.categoryId;
    return e.categoryId === scopeFilter;
  }), [teamEventLogistics, isVisible, scopeFilter]);

  const trashLabel = (item) => ensureString(item.name, lang) || '—';

  return (
    <div className="space-y-4">
      <div className="animate-fade-in">
        <h2 className="font-display text-2xl font-bold text-gradient tracking-tight">{t('nav_event_logistics')}</h2>
      </div>
      <HowToUse descKey="tool_desc_logistics" />
      <ScopeFilter value={scopeFilter} onChange={setScopeFilter}
        categories={categories} userCategoryId={userCategoryId} canEdit={canEdit}
        extraVisibleCategoryId={canEditTools ? generalLeadershipCategoryId : null} />
      <EventLogisticsSection
        events={visibleEvents}
        memberships={memberships}
        categories={categories}
        scopeCategories={creatableCategories}
        canCreate={canEditTools}
        resolveCanEdit={resolveCanEdit}
        onCreateEvent={onCreateEventLogistics}
        onUpdateEvent={onUpdateEventLogistics}
        onDeleteEvent={onDeleteEventLogistics}
      />
      {canEdit && (
        <TrashBin
          items={(trashed?.teamEventLogistics || [])}
          onRestore={(id) => onRestoreItem?.('teamEventLogistics', id)}
          onPurge={(id) => onPurgeItem?.('teamEventLogistics', id)}
          renderLabel={trashLabel}
        />
      )}
    </div>
  );
}
