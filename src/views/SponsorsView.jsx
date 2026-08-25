// ─── SponsorsView ───────────────────────────────────────────────────────────
// Top-level admin view: sponsor tracking (level, contribution, contract status).
// Lives under the "Operación" admin group, not inside Herramientas — this is
// business/operations content, kept separate from engineering tools.

import React, { useState, useMemo, useCallback } from 'react';
import { t, lang } from '../strings.js';
import { HowToUse, ScopeFilter, TrashBin } from '../components/ui/index.js';
import { isGeneralLeadershipCategoryName, ensureString } from '../utils.js';
import SponsorsSection from './tools/SponsorsSection.jsx';

export default function SponsorsView({
  teamSponsors = [],
  categories = [],
  currentMembership,
  canEdit,
  canEditTools,
  resolveCanEdit,
  trashed = {},
  onRestoreItem,
  onPurgeItem,
  onCreateSponsor,
  onUpdateSponsor,
  onDeleteSponsor,
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

  const visibleSponsors = useMemo(() => teamSponsors.filter((s) => {
    if (!isVisible(s)) return false;
    if (scopeFilter === 'all') return true;
    if (scopeFilter === 'global') return !s.categoryId;
    return s.categoryId === scopeFilter;
  }), [teamSponsors, isVisible, scopeFilter]);

  const trashLabel = (item) => ensureString(item.name, lang) || '—';

  return (
    <div className="space-y-4">
      <div className="animate-fade-in">
        <h2 className="font-display text-2xl font-bold text-gradient tracking-tight">{t('nav_sponsors')}</h2>
      </div>
      <HowToUse descKey="tool_desc_sponsors" />
      <ScopeFilter value={scopeFilter} onChange={setScopeFilter}
        categories={categories} userCategoryId={userCategoryId} canEdit={canEdit}
        extraVisibleCategoryId={canEditTools ? generalLeadershipCategoryId : null} />
      <SponsorsSection
        sponsors={visibleSponsors}
        categories={categories}
        scopeCategories={creatableCategories}
        canCreate={canEditTools}
        resolveCanEdit={resolveCanEdit}
        onCreateSponsor={onCreateSponsor}
        onUpdateSponsor={onUpdateSponsor}
        onDeleteSponsor={onDeleteSponsor}
      />
      {canEdit && (
        <TrashBin
          items={(trashed?.teamSponsors || [])}
          onRestore={(id) => onRestoreItem?.('teamSponsors', id)}
          onPurge={(id) => onPurgeItem?.('teamSponsors', id)}
          renderLabel={trashLabel}
        />
      )}
    </div>
  );
}
