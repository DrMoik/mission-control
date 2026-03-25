import { t } from '../strings.js';

export default function NotificationPreferencesCard({
  isSupported,
  statusLabel,
  permissionState,
  registrationState,
  lastError,
  preferences,
  onRequestPermission,
  onTogglePreference,
}) {
  const canManageToggles = isSupported && permissionState === 'granted';

  return (
    <div className="mb-4 rounded-xl border border-slate-700/40 bg-surface-sunken/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-content-primary">{t('notifications_title')}</p>
          <p className="mt-1 text-xs text-content-tertiary">{t('notifications_description')}</p>
        </div>
        <span className="rounded-full border border-slate-600/60 px-2.5 py-1 text-[11px] text-content-secondary">
          {statusLabel}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        <label className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${canManageToggles ? 'border-slate-700/50 bg-slate-950/30' : 'border-slate-800/60 bg-slate-950/20 opacity-70'}`}>
          <div>
            <p className="text-sm text-content-primary">{t('notifications_assignments')}</p>
            <p className="text-[11px] text-content-tertiary">{t('notifications_assignments_hint')}</p>
          </div>
          <input
            type="checkbox"
            className="h-4 w-4 accent-emerald-500"
            checked={Boolean(preferences.assignmentsEnabled)}
            disabled={!canManageToggles}
            onChange={(event) => onTogglePreference('assignmentsEnabled', event.target.checked)}
          />
        </label>

        <label className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${canManageToggles ? 'border-slate-700/50 bg-slate-950/30' : 'border-slate-800/60 bg-slate-950/20 opacity-70'}`}>
          <div>
            <p className="text-sm text-content-primary">{t('notifications_sessions')}</p>
            <p className="text-[11px] text-content-tertiary">{t('notifications_sessions_hint')}</p>
          </div>
          <input
            type="checkbox"
            className="h-4 w-4 accent-emerald-500"
            checked={Boolean(preferences.sessionsEnabled)}
            disabled={!canManageToggles}
            onChange={(event) => onTogglePreference('sessionsEnabled', event.target.checked)}
          />
        </label>
      </div>

      {!isSupported && (
        <p className="mt-4 text-xs text-content-tertiary">{t('notifications_android_only')}</p>
      )}

      {isSupported && permissionState !== 'granted' && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-emerald-700/40 bg-emerald-950/20 px-3 py-2">
          <div>
            <p className="text-sm text-emerald-200">{t('notifications_enable_title')}</p>
            <p className="text-[11px] text-emerald-300/80">{t('notifications_enable_hint')}</p>
          </div>
          <button
            type="button"
            onClick={onRequestPermission}
            className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 transition-colors hover:bg-emerald-400"
          >
            {t('notifications_enable_cta')}
          </button>
        </div>
      )}

      {(registrationState === 'error' || lastError) && (
        <p className="mt-3 text-xs text-rose-300">{lastError || t('notifications_error')}</p>
      )}
    </div>
  );
}
