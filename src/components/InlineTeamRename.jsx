// ─── InlineTeamRename ────────────────────────────────────────────────────────
// Rendered in the app header so platform admins can rename or delete the
// currently-open team without leaving the page.

import React from 'react';

export default function InlineTeamRename({ team, isPlatformAdmin, onRename, onDelete, t }) {
  const [editing,  setEditing]  = React.useState(false);
  const [value,    setValue]    = React.useState('');

  if (!team) return null;

  if (!isPlatformAdmin) {
    return <span className="font-bold text-sm truncate">{team.name}</span>;
  }

  const start = () => { setValue(team.name); setEditing(true); };
  const commit = () => { onRename(team.id, value); setEditing(false); };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
          className="px-2 py-1 bg-slate-800 border border-emerald-600 rounded text-sm font-bold w-44"
        />
        <button onClick={commit}
          className="text-[11px] bg-emerald-500 text-black font-semibold px-2 py-1 rounded">
          {t('save')}
        </button>
        <button onClick={() => setEditing(false)} className="text-[11px] text-slate-400 underline">
          {t('cancel')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className="font-bold text-sm truncate">{team.name}</span>
      <button onClick={start}
        title={t('rename_team')}
        className="text-slate-500 hover:text-amber-400 transition-colors text-xs shrink-0"
      >
        …
      </button>
      <button onClick={() => onDelete(team.id)}
        title={t('delete_team')}
        className="text-slate-500 hover:text-red-400 transition-colors text-xs shrink-0"
      >
        ×
      </button>
    </div>
  );
}
