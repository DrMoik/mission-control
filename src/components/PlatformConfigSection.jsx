// ─── PlatformConfigSection ───────────────────────────────────────────────────
// Edits merit achievement types and domains (area tags).
// Mode 1: platformConfig + onSave → platform admin edits global defaults.
// Mode 2: teamTags + onSaveTeamTags → team admin edits their team's tags.

import React, { useState, useEffect } from 'react';
import { t } from '../strings.js';
import { MERIT_ACHIEVEMENT_TYPES, MERIT_DOMAINS } from '../constants.js';

export default function PlatformConfigSection({
  platformConfig,
  onSave,
  teamTags,
  onSaveTeamTags,
  label: labelOverride,
  t: tProp,
}) {
  const tFn = tProp || t;
  const isTeamMode = Boolean(teamTags && onSaveTeamTags);

  const typesDefault = isTeamMode
    ? (teamTags?.achievementTypes?.length ? teamTags.achievementTypes : MERIT_ACHIEVEMENT_TYPES)
    : (platformConfig?.achievementTypes?.length ? platformConfig.achievementTypes : MERIT_ACHIEVEMENT_TYPES);
  const domainsDefault = isTeamMode
    ? (teamTags?.domains?.length ? teamTags.domains : MERIT_DOMAINS)
    : (platformConfig?.domains?.length ? platformConfig.domains : MERIT_DOMAINS);

  const [types, setTypes] = useState(typesDefault.join(', '));
  const [domains, setDomains] = useState(domainsDefault.join(', '));
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setTypes(typesDefault.join(', '));
    setDomains(domainsDefault.join(', '));
  }, [isTeamMode ? teamTags : platformConfig]);

  const parseList = (s) => (s || '')
    .split(/[,\n]+/)
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);

  const handleSave = async () => {
    setSaving(true);
    const achievementTypes = parseList(types);
    const domainsArr = parseList(domains);
    if (achievementTypes.length === 0 || domainsArr.length === 0) {
      alert(tFn('platform_config_min_one') || 'Cada lista debe tener al menos un valor.');
      setSaving(false);
      return;
    }
    if (isTeamMode) await onSaveTeamTags(achievementTypes, domainsArr);
    else await onSave(achievementTypes, domainsArr);
    setSaving(false);
  };

  const resetToDefaults = () => {
    setTypes(MERIT_ACHIEVEMENT_TYPES.join(', '));
    setDomains(MERIT_DOMAINS.join(', '));
  };

  return (
    <div className="bg-slate-800 rounded-xl p-4 mt-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left flex items-center justify-between text-sm font-semibold text-slate-200 hover:text-white transition-colors"
      >
        <span>{labelOverride || (isTeamMode ? (tFn('team_config_tags') || 'Etiquetas de área y tipo de este equipo') : (tFn('platform_config_tags') || 'Etiquetas de área y tipo (logros)'))}</span>
        <span className={`inline-block text-slate-500 transition-transform ${open ? '' : '-rotate-90'}`}>▼</span>
      </button>
      {open && (
        <div className="mt-3 space-y-3 pt-3 border-t border-slate-700">
          <p className="text-[11px] text-slate-500">
            {isTeamMode ? (tFn('team_config_help') || 'Estas etiquetas se usan al crear logros en este equipo.') : (tFn('platform_config_help') || 'Estas etiquetas se usan al crear logros. Los equipos nuevos usan estos valores por defecto.')}
          </p>
          <div>
            <label className="text-[11px] text-slate-500 block mb-1">{tFn('merit_attr_types') || 'Tipos'}</label>
            <textarea
              value={types}
              onChange={(e) => setTypes(e.target.value)}
              rows={2}
              placeholder="technical, leadership, collaboration, ..."
              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs font-mono"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-500 block mb-1">{tFn('merit_attr_domains') || 'Áreas'}</label>
            <textarea
              value={domains}
              onChange={(e) => setDomains(e.target.value)}
              rows={2}
              placeholder="software, hardware, mechanical, ..."
              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs font-mono"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 bg-emerald-500 text-black text-xs font-semibold rounded hover:bg-emerald-400 disabled:opacity-50"
            >
              {saving ? '…' : (tFn('save') || 'Guardar')}
            </button>
            <button
              onClick={resetToDefaults}
              className="px-3 py-1.5 bg-slate-600 text-slate-300 text-xs rounded hover:bg-slate-500"
            >
              {tFn('platform_config_reset') || 'Reset'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
