// ─── SeasonResetSection ───────────────────────────────────────────────────────
// Admin panel section for purging season data and managing roster transitions.
// Shown only to teamAdmin. Two-step flow:
//   Step 1 — choose departing members + data scope
//   Step 2 — type team name to confirm, then execute

import React, { useState, useMemo } from 'react';
import { AlertTriangle, RotateCcw, Users, Calendar, ClipboardList, Target, Layers, ChevronRight, ChevronDown, Check, X } from 'lucide-react';
import RoleBadge from './ui/RoleBadge.jsx';
import { t } from '../strings.js';

// Collections that can be cleared, with labels
const SCOPE_OPTIONS = [
  {
    key: 'clearSessions',
    label: 'Sesiones de práctica',
    hint: 'Registros de asistencia incluidos',
    icon: ClipboardList,
    default: true,
    danger: true,
  },
  {
    key: 'clearEvents',
    label: 'Eventos del calendario',
    hint: 'Competencias, entregas, eventos del equipo',
    icon: Calendar,
    default: true,
    danger: true,
  },
  {
    key: 'clearMeetings',
    label: 'Reuniones',
    hint: 'Minutas y convocatorias',
    icon: Users,
    default: true,
    danger: false,
  },
  {
    key: 'clearStatuses',
    label: 'Actualizaciones semanales',
    hint: 'Historial de reportes semanales',
    icon: RotateCcw,
    default: true,
    danger: false,
  },
  {
    key: 'clearGoals',
    label: 'Metas / OKRs',
    hint: 'Objetivos y resultados clave del equipo',
    icon: Target,
    default: false,
    danger: false,
  },
  {
    key: 'clearBoards',
    label: 'Tableros Kanban',
    hint: 'SCRUM, retrospectivas, tableros de trabajo',
    icon: Layers,
    default: false,
    danger: false,
  },
];

function MemberRow({ membership, departing, onToggle }) {
  const isInactive = membership.status === 'inactive';
  return (
    <button
      type="button"
      onClick={() => !isInactive && onToggle(membership.id)}
      disabled={isInactive}
      className={[
        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors',
        isInactive
          ? 'opacity-40 cursor-not-allowed'
          : departing
            ? 'bg-red-950/40 border border-red-800/50 hover:bg-red-950/60'
            : 'bg-surface-raised border border-hairline hover:border-slate-600/60',
      ].join(' ')}
    >
      {/* Checkbox indicator */}
      <div className={[
        'shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors',
        departing
          ? 'bg-red-500 border-red-500'
          : 'bg-transparent border-slate-600',
      ].join(' ')}>
        {departing && <X className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
      </div>

      {/* Avatar */}
      {membership.photoURL ? (
        <img src={membership.photoURL} alt="" className="w-7 h-7 rounded-full shrink-0 object-cover" />
      ) : (
        <div className="w-7 h-7 rounded-full shrink-0 bg-slate-700 flex items-center justify-center text-xs font-semibold text-slate-300">
          {(membership.displayName || '?')[0].toUpperCase()}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-content-primary truncate">
          {membership.displayName || 'Sin nombre'}
        </div>
        {membership.ghost && (
          <span className="text-[10px] text-purple-300">externo</span>
        )}
      </div>

      <RoleBadge role={membership.role} />

      {departing && (
        <span className="text-[10px] font-semibold text-red-400 shrink-0">Salida</span>
      )}
    </button>
  );
}

export default function SeasonResetSection({ team, memberships = [], onSeasonReset }) {
  const [step, setStep] = useState(1); // 1 = configure, 2 = confirm
  const [seasonLabel, setSeasonLabel] = useState('');
  const [departing, setDeparting] = useState(new Set());
  const [scope, setScope] = useState(() =>
    Object.fromEntries(SCOPE_OPTIONS.map((o) => [o.key, o.default]))
  );
  const [confirmInput, setConfirmInput] = useState('');
  const [running, setRunning] = useState(false);
  const [expandMembers, setExpandMembers] = useState(true);

  const activeMembers = useMemo(
    () => memberships.filter((m) => m.status === 'active' || m.status === 'pending').sort((a, b) => (a.displayName || '').localeCompare(b.displayName || '')),
    [memberships]
  );

  const toggleDeparting = (id) => {
    setDeparting((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleScope = (key) => {
    setScope((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const selectedScopes = SCOPE_OPTIONS.filter((o) => scope[o.key]);
  const confirmTarget = team?.name || '';
  const canConfirm = confirmInput.trim() === confirmTarget && !running;

  const handleExecute = async () => {
    if (!canConfirm) return;
    setRunning(true);
    try {
      await onSeasonReset({
        seasonLabel: seasonLabel.trim() || null,
        departingMembershipIds: Array.from(departing),
        ...scope,
      });
      // Reset UI after success
      setStep(1);
      setDeparting(new Set());
      setConfirmInput('');
      setSeasonLabel('');
    } catch (err) {
      console.error('Season reset failed:', err);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="rounded-xl border border-red-900/40 bg-surface-raised shadow-surface-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-red-900/30 bg-red-950/20">
        <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" strokeWidth={2} />
        <div>
          <h3 className="text-sm font-bold text-content-primary">Inicio de Temporada</h3>
          <p className="text-[11px] text-content-tertiary mt-0.5">
            Purga datos de la temporada anterior · Los merits y puntajes se conservan siempre
          </p>
        </div>
        {team?.seasonStart && (
          <div className="ml-auto text-right shrink-0">
            <div className="text-[10px] text-content-tertiary uppercase tracking-wider">Temporada actual</div>
            <div className="text-xs font-semibold text-teal-300">
              {team.seasonLabel || new Date(
                team.seasonStart?.seconds ? team.seasonStart.seconds * 1000 : team.seasonStart
              ).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          </div>
        )}
      </div>

      <div className="p-5 space-y-5">

        {step === 1 && (
          <>
            {/* Season label */}
            <div>
              <label className="block text-xs font-semibold text-content-secondary mb-1.5">
                Nombre de la nueva temporada <span className="font-normal text-content-tertiary">(opcional)</span>
              </label>
              <input
                type="text"
                value={seasonLabel}
                onChange={(e) => setSeasonLabel(e.target.value)}
                placeholder="Ej. Temporada 2025–2026"
                className="w-full sm:w-72 px-3 py-1.5 bg-slate-900 border border-slate-600/70 rounded-lg text-sm text-content-primary placeholder-slate-500 focus:border-teal-500 focus:outline-none transition-colors"
              />
            </div>

            {/* Member roster */}
            <div>
              <button
                type="button"
                onClick={() => setExpandMembers((s) => !s)}
                className="flex items-center gap-2 text-xs font-semibold text-content-secondary uppercase tracking-wider mb-2 hover:text-content-primary transition-colors"
              >
                {expandMembers ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                Roster — selecciona quién sale
                {departing.size > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-red-900/50 text-red-300 text-[10px] font-bold">
                    {departing.size} salida{departing.size !== 1 ? 's' : ''}
                  </span>
                )}
              </button>

              {expandMembers && (
                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {activeMembers.length === 0 && (
                    <p className="text-xs text-content-tertiary italic px-2">Sin miembros activos</p>
                  )}
                  {activeMembers.map((m) => (
                    <MemberRow
                      key={m.id}
                      membership={m}
                      departing={departing.has(m.id)}
                      onToggle={toggleDeparting}
                    />
                  ))}
                </div>
              )}

              {departing.size > 0 && (
                <p className="mt-2 text-[11px] text-red-400">
                  {departing.size} miembro{departing.size !== 1 ? 's' : ''} marcado{departing.size !== 1 ? 's' : ''} como inactivo{departing.size !== 1 ? 's' : ''}. Su historial de puntos se conserva.
                </p>
              )}
            </div>

            {/* Data scope */}
            <div>
              <p className="text-xs font-semibold text-content-secondary uppercase tracking-wider mb-2">
                Datos a eliminar
              </p>
              <div className="space-y-2">
                {SCOPE_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const on = scope[opt.key];
                  return (
                    <label key={opt.key} className="flex items-start gap-3 cursor-pointer group">
                      <div
                        className={[
                          'mt-0.5 shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors',
                          on
                            ? opt.danger ? 'bg-red-500 border-red-500' : 'bg-teal-600 border-teal-600'
                            : 'bg-transparent border-slate-600 group-hover:border-slate-400',
                        ].join(' ')}
                        onClick={() => toggleScope(opt.key)}
                      >
                        {on && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                          <Icon className={['w-3.5 h-3.5 shrink-0', on && opt.danger ? 'text-red-400' : 'text-slate-400'].join(' ')} strokeWidth={2} />
                          <span className="text-sm text-content-primary">{opt.label}</span>
                          {opt.danger && on && (
                            <span className="text-[10px] text-red-400 font-semibold">irreversible</span>
                          )}
                        </div>
                        <p className="text-[11px] text-content-tertiary mt-0.5 ml-5">{opt.hint}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
              <p className="mt-3 text-[11px] text-content-tertiary bg-slate-900/60 border border-hairline rounded-lg px-3 py-2">
                <strong className="text-content-secondary">Nunca se eliminan:</strong> merits, eventos de puntos, módulos de academia, inventario, BOM, finanzas, canales y perfiles de miembros.
              </p>
            </div>

            {/* Next step */}
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-red-700 hover:bg-red-600 text-white transition-colors shadow-sm"
              >
                Continuar
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            {/* Summary */}
            <div className="rounded-lg border border-hairline bg-slate-900/60 p-4 space-y-3">
              <p className="text-sm font-semibold text-content-primary">Resumen de cambios</p>

              {seasonLabel && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-content-tertiary w-28 shrink-0">Nueva temporada</span>
                  <span className="font-semibold text-teal-300">{seasonLabel}</span>
                </div>
              )}

              <div className="flex items-start gap-2 text-sm">
                <span className="text-content-tertiary w-28 shrink-0">Miembros</span>
                <div>
                  {departing.size === 0 ? (
                    <span className="text-content-secondary">Sin cambios en el roster</span>
                  ) : (
                    <span className="text-red-400 font-semibold">
                      {departing.size} miembro{departing.size !== 1 ? 's' : ''} → inactivo
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-2 text-sm">
                <span className="text-content-tertiary w-28 shrink-0">Se elimina</span>
                <div className="space-y-0.5">
                  {selectedScopes.length === 0
                    ? <span className="text-content-secondary">Nada (solo se actualiza la fecha de temporada)</span>
                    : selectedScopes.map((o) => (
                      <div key={o.key} className="flex items-center gap-1.5 text-red-300">
                        <X className="w-3 h-3 shrink-0" strokeWidth={2.5} />
                        {o.label}
                      </div>
                    ))
                  }
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <span className="text-content-tertiary w-28 shrink-0">Se conserva</span>
                <span className="text-teal-300 font-semibold">Todo el historial de puntos y merits ✓</span>
              </div>
            </div>

            {/* Type-to-confirm */}
            <div>
              <label className="block text-xs font-semibold text-content-secondary mb-2">
                Escribe el nombre del equipo para confirmar:{' '}
                <span className="text-red-300 font-mono">{confirmTarget}</span>
              </label>
              <input
                type="text"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                placeholder={confirmTarget}
                autoComplete="off"
                className="w-full sm:w-72 px-3 py-1.5 bg-slate-900 border border-slate-600/70 rounded-lg text-sm text-content-primary placeholder-slate-600 focus:border-red-500 focus:outline-none transition-colors font-mono"
              />
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => { setStep(1); setConfirmInput(''); }}
                disabled={running}
                className="px-4 py-2 rounded-lg text-sm font-medium text-content-secondary hover:text-content-primary hover:bg-white/5 transition-colors disabled:opacity-40"
              >
                ← Atrás
              </button>
              <button
                type="button"
                onClick={handleExecute}
                disabled={!canConfirm}
                className={[
                  'inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all',
                  canConfirm
                    ? 'bg-red-600 hover:bg-red-500 text-white shadow-[0_0_16px_rgba(239,68,68,0.3)] hover:shadow-[0_0_24px_rgba(239,68,68,0.4)]'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed',
                ].join(' ')}
              >
                {running ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin-slow" />
                    Ejecutando…
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    Iniciar nueva temporada
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
