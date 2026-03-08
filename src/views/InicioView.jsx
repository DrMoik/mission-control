// ─── InicioView ───────────────────────────────────────────────────────────────
// Personal dashboard: quick summary of commitments and activity.
// Non-disruptive notification center — easy access to changes.

import React from 'react';
import { t } from '../strings.js';
import MyCommitmentsCard from '../components/MyCommitmentsCard.jsx';

export default function InicioView({
  team,
  teamTasks = [],
  teamWeeklyStatuses = [],
  currentMembership,
  tsToDate,
  onNavigateTasks,
  onNavigateProfile,
  onNavigateOverview,
  onNavigateFeed,
}) {
  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-base font-semibold text-slate-200">{t('nav_inicio')}</h2>
      <p className="text-xs text-slate-500">{t('inicio_desc')}</p>

      {/* My commitments — personal responsibility dashboard */}
      {currentMembership && (
        <MyCommitmentsCard
          tasks={teamTasks}
          weeklyStatuses={teamWeeklyStatuses}
          currentMembership={currentMembership}
          tsToDate={tsToDate}
          onNavigateTasks={onNavigateTasks}
          onNavigateProfile={onNavigateProfile}
        />
      )}

      {/* Quick links — non-disruptive access to key areas */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <button
          type="button"
          onClick={onNavigateOverview}
          className="p-3 rounded-lg border border-slate-600 bg-slate-800/60 hover:border-slate-500 hover:bg-slate-800 text-left transition-colors"
        >
          <span className="text-xs font-medium text-slate-200 block">{t('nav_overview')}</span>
          <span className="text-[10px] text-slate-500">{t('inicio_link_team_card')}</span>
        </button>
        <button
          type="button"
          onClick={onNavigateFeed}
          className="p-3 rounded-lg border border-slate-600 bg-slate-800/60 hover:border-slate-500 hover:bg-slate-800 text-left transition-colors"
        >
          <span className="text-xs font-medium text-slate-200 block">{t('nav_feed')}</span>
          <span className="text-[10px] text-slate-500">{t('inicio_link_activity')}</span>
        </button>
        <button
          type="button"
          onClick={onNavigateTasks}
          className="p-3 rounded-lg border border-slate-600 bg-slate-800/60 hover:border-slate-500 hover:bg-slate-800 text-left transition-colors"
        >
          <span className="text-xs font-medium text-slate-200 block">{t('nav_tasks')}</span>
          <span className="text-[10px] text-slate-500">{t('inicio_link_tasks')}</span>
        </button>
      </div>

      {!currentMembership && (
        <p className="text-xs text-slate-500 italic">{t('inicio_no_membership')}</p>
      )}
    </div>
  );
}
